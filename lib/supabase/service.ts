import "server-only";

import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL } from "@/lib/supabase/env";

/**
 * Used only by the Vapi webhook. The service role bypasses row-level
 * security, so this module must never be imported from a client component.
 * The webhook secret is checked before any call is made with this client.
 */
export function createSupabaseServiceClient() {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? "";
  if (!SUPABASE_URL || !serviceKey) return null;
  return createClient(SUPABASE_URL, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
