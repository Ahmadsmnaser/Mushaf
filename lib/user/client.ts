"use client";

import type { QuranMark } from "@/lib/marks";
import type { UserPreferences } from "@/lib/user/preferences";

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  if (!response.ok) throw new Error(`Request failed: ${response.status}`);
  return (await response.json()) as T;
}

export const userApi = {
  async getMarks() {
    return requestJson<{ marks: QuranMark[] }>("/api/user/marks");
  },
  async createMark(mark: QuranMark) {
    return requestJson<{ mark: QuranMark }>("/api/user/marks", {
      method: "POST",
      body: JSON.stringify(mark),
    });
  },
  async updateMark(id: string, patch: Partial<QuranMark>) {
    const body = Object.fromEntries(
      Object.entries(patch).map(([key, value]) => [key, value === undefined ? null : value])
    );
    return requestJson<{ mark: QuranMark }>(`/api/user/marks/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    });
  },
  async deleteMark(id: string) {
    return requestJson<{ ok: true }>(`/api/user/marks/${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
  },
  async migrateMarks(marks: QuranMark[]) {
    return requestJson<{ ok: true; added: number; updated: number; skipped: number }>(
      "/api/user/marks/migrate",
      {
        method: "POST",
        body: JSON.stringify({ marks }),
      }
    );
  },
  async getPreferences() {
    return requestJson<{ preferences: UserPreferences }>("/api/user/preferences");
  },
  async updatePreferences(patch: UserPreferences) {
    return requestJson<{ preferences: UserPreferences }>("/api/user/preferences", {
      method: "PATCH",
      body: JSON.stringify(patch),
    });
  },
};
