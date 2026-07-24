"use client";

import { useCallback, useEffect, useState } from "react";
import { fetchSurahGuide, SurahGuideError } from "./service";
import type { SurahGuideData } from "./types";

type GuideState =
  | { status: "idle" | "loading" }
  | { status: "success"; data: SurahGuideData }
  | { status: "error"; message: string };

interface StoredState {
  key: string | null;
  value: GuideState;
}

export function useSurahGuide(surahNumber: number | null, open: boolean) {
  const key = open && surahNumber ? String(surahNumber) : null;
  const [stored, setStored] = useState<StoredState>({
    key: null,
    value: { status: "idle" },
  });
  const [retryVersion, setRetryVersion] = useState(0);
  const state: GuideState =
    key === null
      ? { status: "idle" }
      : stored.key === key
        ? stored.value
        : { status: "loading" };

  useEffect(() => {
    if (!key || !surahNumber) return;
    let current = true;
    fetchSurahGuide(surahNumber).then(
      (data) => {
        if (current) {
          setStored({ key, value: { status: "success", data } });
        }
      },
      (error) => {
        if (current) {
          setStored({
            key,
            value: {
              status: "error",
              message:
                error instanceof SurahGuideError
                  ? error.message
                  : "تعذّر تحميل معلومات السورة.",
            },
          });
        }
      }
    );
    return () => {
      current = false;
    };
  }, [key, retryVersion, surahNumber]);

  const retry = useCallback(() => {
    if (key) {
      setStored({ key: null, value: { status: "idle" } });
      setRetryVersion((version) => version + 1);
    }
  }, [key]);

  return { state, retry };
}
