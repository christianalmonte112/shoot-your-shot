"use client";

import { createBrowserClient } from "@supabase/ssr";
import { SUPABASE_ANON_KEY, SUPABASE_URL, supabaseIsConfigured } from "@/lib/supabase/env";

/** Browser client for sign-in and sign-out. Returns null when env is missing. */
export function createSupabaseBrowserClient() {
  if (!supabaseIsConfigured()) return null;
  return createBrowserClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}
