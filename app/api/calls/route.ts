import { FREE_CALL_LIMIT } from "@/lib/limits";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { missingSupabaseEnv, supabaseIsConfigured } from "@/lib/supabase/env";

/**
 * Authorize one practice call.
 *
 * The browser must get a 200 from this route before it calls vapi.start().
 * The count lives in Postgres (start_practice_call), so two tabs cannot
 * both slip through as call number 3.
 *
 * TODO(stripe): a paid plan should be decided in that SQL function, not here.
 */
export async function POST() {
  if (!supabaseIsConfigured()) {
    return Response.json(
      { error: "supabase_unconfigured", missing: missingSupabaseEnv() },
      { status: 503 },
    );
  }

  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return Response.json({ error: "supabase_unconfigured" }, { status: 503 });
  }

  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    return Response.json({ error: "unauthenticated" }, { status: 401 });
  }

  const { data, error } = await supabase.rpc("start_practice_call");
  if (error) {
    if (error.message.includes("free_call_limit") || error.code === "P0001") {
      return Response.json(
        {
          error: "free_call_limit",
          freeCallsUsed: FREE_CALL_LIMIT,
          freeCallLimit: FREE_CALL_LIMIT,
        },
        { status: 403 },
      );
    }
    return Response.json({ error: "start_failed" }, { status: 500 });
  }

  const payload = data as { call_id?: string; free_calls_used?: number; free_call_limit?: number } | null;
  if (!payload?.call_id) {
    return Response.json({ error: "start_failed" }, { status: 500 });
  }

  return Response.json({
    callId: payload.call_id,
    freeCallsUsed: payload.free_calls_used ?? 0,
    freeCallLimit: payload.free_call_limit ?? FREE_CALL_LIMIT,
  });
}
