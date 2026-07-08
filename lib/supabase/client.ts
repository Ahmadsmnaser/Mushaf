"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseBrowserConfig, isSupabaseConfigured } from "./config";

let browserClient: SupabaseClient | null = null;

export function createClientSupabaseClient(): SupabaseClient | null {
  if (!isSupabaseConfigured()) return null;
  if (browserClient) return browserClient;
  const { url, publishableKey } = getSupabaseBrowserConfig();
  browserClient = createBrowserClient(url, publishableKey);
  return browserClient;
}
