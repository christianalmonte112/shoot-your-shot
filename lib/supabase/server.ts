import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { SUPABASE_ANON_KEY, SUPABASE_URL, supabaseIsConfigured } from "@/lib/supabase/env";

/**
 * Server client bound to the request cookies. Call it from a Suspense
 * boundary: reading cookies opts the render out of the static shell.
 */
export async function createSupabaseServerClient() {
  if (!supabaseIsConfigured()) return null;
  const cookieStore = await cookies();

  return createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Server Components cannot always write cookies. proxy.ts refreshes
          // the session on the way in, which is what keeps the user signed in.
        }
      },
    },
  });
}
