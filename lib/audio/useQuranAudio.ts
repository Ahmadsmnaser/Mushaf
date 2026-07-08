"use client";

// Recitation playback state, owned by the Reader and shared by the tafsir
// panel and the floating mini-player. ONE shared HTMLAudioElement lives
// behind this hook — two ayahs can never sound at once. Every async step is
// guarded by a generation counter (same stale-response discipline as
// useTafsir): only the newest user intent may touch the element or the state.
//
// Lifecycle: `active` flips on with the first playback and stays on through
// pause/stop — it drives the mini-bar, which must outlive the sound — and
// only dismiss() (or unmount) turns it off. stop() keeps the queue and the
// current ayah so «متابعة» and next/prev still work afterwards.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DEFAULT_RECITER_ID, getReciter } from "./reciters";
import { AUDIO_ERROR_MESSAGES, AudioError, resolveAyahAudioUrl } from "./service";
import type { Reciter } from "./types";

/** An ayah the reader can play: its key plus the mushaf page that lists it. */
export interface AyahRef {
  verseKey: string;
  pageNumber: number;
}

export type PlaybackMode = "single-ayah" | "page";

interface PlayerState {
  /** The ayah the player is on — sounding, paused or stopped-at. */
  currentVerseKey: string | null;
  isLoading: boolean;
  isPlaying: boolean;
  playbackMode: PlaybackMode | null;
  /** Arabic user-facing message; null when the last action succeeded. */
  error: string | null;
  /** True from the first playback until dismissed: shows the mini-bar. */
  active: boolean;
  hasNext: boolean;
  hasPrev: boolean;
}

const IDLE: PlayerState = {
  currentVerseKey: null,
  isLoading: false,
  isPlaying: false,
  playbackMode: null,
  error: null,
  active: false,
  hasNext: false,
  hasPrev: false,
};

const toErrorMessage = (err: unknown): string =>
  err instanceof AudioError ? AUDIO_ERROR_MESSAGES[err.code] : AUDIO_ERROR_MESSAGES.upstream_error;

export interface QuranAudioController extends PlayerState {
  reciter: Reciter;
  /**
   * Play this ayah; if it is already the current one, stop when sounding and
   * continue when paused/stopped. `contextQueue` (the listed entries, in
   * reading order) gives next/prev something to walk through.
   */
  toggleAyah: (ayah: AyahRef, contextQueue?: AyahRef[]) => void;
  /** Play the given ayahs in order; if page playback is sounding, stop it. */
  togglePage: (queue: AyahRef[]) => void;
  pause: () => void;
  /** Resume the paused ayah, or replay the stopped-at one. */
  resume: () => void;
  next: () => void;
  prev: () => void;
  /** Halt playback but keep the queue/position — the mini-bar stays up. */
  stop: () => void;
  /** Full reset: silences everything and hides the mini-bar. */
  dismiss: () => void;
}

export function useQuranAudio(): QuranAudioController {
  const reciter = useMemo(() => getReciter(DEFAULT_RECITER_ID), []);
  const [state, setState] = useState<PlayerState>(IDLE);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  // Queue being walked; index points at the entry the player is on.
  const queueRef = useRef<AyahRef[]>([]);
  const indexRef = useRef(0);
  const modeRef = useRef<PlaybackMode>("single-ayah");
  /** verseKey whose mp3 is loaded in the element (resume without refetch). */
  const loadedRef = useRef<string | null>(null);
  // Bumped by every user action; async continuations compare against it.
  const generationRef = useRef(0);
  // startAt is recursive through the 'ended' event; a ref breaks the cycle.
  const advanceRef = useRef<() => void>(() => {});

  /** Merge a state change, refreshing hasNext/hasPrev from the queue refs. */
  const commit = useCallback((partial: Partial<PlayerState>) => {
    const count = queueRef.current.length;
    const hasNext = count > 0 && indexRef.current < count - 1;
    const hasPrev = count > 0 && indexRef.current > 0;
    setState((prev) => ({ ...prev, ...partial, hasNext, hasPrev }));
  }, []);

  const getAudio = useCallback((): HTMLAudioElement => {
    if (!audioRef.current) {
      const el = new Audio();
      el.preload = "auto";
      el.addEventListener("ended", () => advanceRef.current());
      audioRef.current = el;
    }
    return audioRef.current;
  }, []);

  const haltElement = useCallback(() => {
    const el = audioRef.current;
    if (el) {
      el.pause();
      el.removeAttribute("src");
    }
    loadedRef.current = null;
  }, []);

  /** Load + play queueRef[index]; on error report it and hold position. */
  const startAt = useCallback(
    async (index: number, mode: PlaybackMode, generation: number) => {
      const ayah = queueRef.current[index];
      if (!ayah) return;
      indexRef.current = index;
      modeRef.current = mode;
      commit({
        currentVerseKey: ayah.verseKey,
        isLoading: true,
        isPlaying: false,
        playbackMode: mode,
        error: null,
        active: true,
      });
      try {
        const url = await resolveAyahAudioUrl(reciter.id, ayah.verseKey, ayah.pageNumber);
        if (generation !== generationRef.current) return;
        const el = getAudio();
        el.src = url;
        loadedRef.current = ayah.verseKey;
        await el.play();
        if (generation !== generationRef.current) return;
        commit({ isLoading: false, isPlaying: true });
      } catch (err) {
        // A stop()/new play during the await pauses the element and rejects
        // play() — that is the intended outcome, not an error to surface.
        if (generation !== generationRef.current) return;
        loadedRef.current = null;
        commit({ isLoading: false, isPlaying: false, error: toErrorMessage(err) });
      }
    },
    [reciter.id, commit, getAudio]
  );

  // 'ended' → next queue entry (page mode) or come to rest on this ayah.
  useEffect(() => {
    advanceRef.current = () => {
      const generation = generationRef.current;
      const next = indexRef.current + 1;
      if (modeRef.current === "page" && next < queueRef.current.length) {
        void startAt(next, "page", generation);
      } else {
        commit({ isPlaying: false });
      }
    };
  }, [startAt, commit]);

  const stop = useCallback(() => {
    generationRef.current++;
    haltElement();
    commit({ isLoading: false, isPlaying: false });
  }, [haltElement, commit]);

  const dismiss = useCallback(() => {
    generationRef.current++;
    haltElement();
    queueRef.current = [];
    indexRef.current = 0;
    setState(IDLE);
  }, [haltElement]);

  const pause = useCallback(() => {
    audioRef.current?.pause();
    commit({ isPlaying: false });
  }, [commit]);

  const resume = useCallback(() => {
    const current = queueRef.current[indexRef.current];
    if (!current) return;
    const el = audioRef.current;
    if (el && loadedRef.current === current.verseKey && el.currentSrc) {
      // Still loaded: resume in place (play() restarts from 0 after 'ended').
      const generation = generationRef.current;
      el.play()
        .then(() => {
          if (generation === generationRef.current) {
            commit({ isPlaying: true, error: null });
          }
        })
        .catch(() => {
          // superseded by a stop/new play — nothing to report
        });
    } else {
      void startAt(indexRef.current, modeRef.current, ++generationRef.current);
    }
  }, [commit, startAt]);

  const next = useCallback(() => {
    if (indexRef.current + 1 < queueRef.current.length) {
      void startAt(indexRef.current + 1, modeRef.current, ++generationRef.current);
    }
  }, [startAt]);

  const prev = useCallback(() => {
    if (indexRef.current > 0 && queueRef.current.length > 0) {
      void startAt(indexRef.current - 1, modeRef.current, ++generationRef.current);
    }
  }, [startAt]);

  const toggleAyah = useCallback(
    (ayah: AyahRef, contextQueue?: AyahRef[]) => {
      if (state.currentVerseKey === ayah.verseKey) {
        if (state.isPlaying || state.isLoading) stop();
        else resume();
        return;
      }
      const queue =
        contextQueue && contextQueue.some((a) => a.verseKey === ayah.verseKey)
          ? contextQueue
          : [ayah];
      generationRef.current++;
      audioRef.current?.pause();
      queueRef.current = [...queue];
      const index = queue.findIndex((a) => a.verseKey === ayah.verseKey);
      void startAt(index, "single-ayah", generationRef.current);
    },
    [state.currentVerseKey, state.isPlaying, state.isLoading, stop, resume, startAt]
  );

  const togglePage = useCallback(
    (queue: AyahRef[]) => {
      if (state.playbackMode === "page" && (state.isPlaying || state.isLoading)) {
        stop();
        return;
      }
      if (queue.length === 0) return;
      generationRef.current++;
      audioRef.current?.pause();
      queueRef.current = [...queue];
      void startAt(0, "page", generationRef.current);
    },
    [state.playbackMode, state.isPlaying, state.isLoading, stop, startAt]
  );

  // Unmount: silence the element and drop it (its listener dies with it).
  useEffect(() => {
    const generation = generationRef;
    const audio = audioRef;
    return () => {
      generation.current++;
      audio.current?.pause();
      audio.current?.removeAttribute("src");
      audio.current = null;
    };
  }, []);

  return {
    ...state,
    reciter,
    toggleAyah,
    togglePage,
    pause,
    resume,
    next,
    prev,
    stop,
    dismiss,
  };
}
