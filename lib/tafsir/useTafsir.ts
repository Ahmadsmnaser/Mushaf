"use client";

// Tafsir state for the panel: resolves which sources the server can actually
// serve, remembers the reader's choice, and loads the tafsir of the visible
// page(s). Fetch results settle into state keyed by their request; the
// current status (loading vs settled) is DERIVED by comparing that key with
// what the panel wants now, so effects never set state synchronously and a
// stale response can never be mistaken for the current one.

import { useCallback, useEffect, useMemo, useState } from "react";
import { readJSON, writeJSON } from "@/lib/storage";
import { isTafsirSourceId, TAFSIR_SOURCE_PRIORITY } from "./sources";
import {
  fetchPageTafsir,
  fetchTafsirSources,
  TAFSIR_ERROR_MESSAGES,
  TafsirError,
} from "./service";
import type {
  PageTafsir,
  TafsirErrorCode,
  TafsirSourceAvailability,
  TafsirSourceId,
} from "./types";

const SOURCE_KEY = "mushaf.v1.tafsirSource";

export type TafsirStatus = "idle" | "loading" | "error" | "success";

export interface TafsirState {
  status: TafsirStatus;
  /** One PageTafsir per requested page, in the given order (success only). */
  data: PageTafsir[];
  errorCode: TafsirErrorCode | null;
  errorMessage: string | null;
}

interface Settled {
  key: string;
  data: PageTafsir[];
  errorCode: TafsirErrorCode | null;
}

const IDLE: TafsirState = { status: "idle", data: [], errorCode: null, errorMessage: null };

const toErrorCode = (err: unknown): TafsirErrorCode =>
  err instanceof TafsirError ? err.code : "network";

export function useTafsir(pages: number[], active: boolean) {
  const [sources, setSources] = useState<TafsirSourceAvailability[]>([]);
  const [sourceId, setSourceId] = useState<TafsirSourceId | null>(null);
  const [sourcesError, setSourcesError] = useState<TafsirErrorCode | null>(null);
  const [settled, setSettled] = useState<Settled | null>(null);
  const [attempt, setAttempt] = useState(0);

  // The pages array is rebuilt every render; everything keys off its value.
  const pagesKey = pages.join(",");
  const requestKey = `${sourceId}|${pagesKey}|${attempt}`;

  // First activation: learn which sources the server can serve, then settle
  // on the stored choice if still valid, else the first available by priority.
  useEffect(() => {
    if (!active || sourceId !== null) return;
    let cancelled = false;
    fetchTafsirSources()
      .then((list) => {
        if (cancelled) return;
        setSources(list);
        setSourcesError(null);
        const stored = readJSON<string | null>(SOURCE_KEY, null, (v): v is string | null =>
          v === null || typeof v === "string"
        );
        const pick =
          (isTafsirSourceId(stored) && list.some((s) => s.id === stored && s.available)
            ? stored
            : null) ??
          TAFSIR_SOURCE_PRIORITY.find((id) =>
            list.some((s) => s.id === id && s.available)
          ) ??
          "muyassar";
        setSourceId(pick);
      })
      .catch((err: unknown) => {
        if (!cancelled) setSourcesError(toErrorCode(err));
      });
    return () => {
      cancelled = true;
    };
  }, [active, sourceId, attempt]);

  // Load the visible pages whenever the panel is active with a settled source.
  useEffect(() => {
    if (!active || sourceId === null || pagesKey === "") return;
    const key = `${sourceId}|${pagesKey}|${attempt}`;
    const wanted = pagesKey.split(",").map(Number);
    let cancelled = false;
    Promise.all(wanted.map((p) => fetchPageTafsir(sourceId, p)))
      .then((data) => {
        if (!cancelled) setSettled({ key, data, errorCode: null });
      })
      .catch((err: unknown) => {
        if (!cancelled) setSettled({ key, data: [], errorCode: toErrorCode(err) });
      });
    return () => {
      cancelled = true;
    };
  }, [active, sourceId, pagesKey, attempt]);

  const state: TafsirState = useMemo(() => {
    if (!active || pagesKey === "") return IDLE;
    if (sourceId === null) {
      // Still resolving the source list — or failed to.
      return sourcesError
        ? {
            status: "error",
            data: [],
            errorCode: sourcesError,
            errorMessage: TAFSIR_ERROR_MESSAGES[sourcesError],
          }
        : { ...IDLE, status: "loading" };
    }
    if (!settled || settled.key !== requestKey) return { ...IDLE, status: "loading" };
    if (settled.errorCode !== null) {
      return {
        status: "error",
        data: [],
        errorCode: settled.errorCode,
        errorMessage: TAFSIR_ERROR_MESSAGES[settled.errorCode],
      };
    }
    return { status: "success", data: settled.data, errorCode: null, errorMessage: null };
  }, [active, pagesKey, sourceId, sourcesError, settled, requestKey]);

  const setSource = useCallback((id: TafsirSourceId) => {
    writeJSON(SOURCE_KEY, id);
    setSourceId(id);
  }, []);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);

  const source = useMemo(
    () => sources.find((s) => s.id === sourceId) ?? null,
    [sources, sourceId]
  );

  return { state, sources, sourceId, source, setSource, retry };
}
