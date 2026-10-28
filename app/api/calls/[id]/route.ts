import { isUuid, sanitizeIncomingCoaching, sanitizeIncomingTurns } from "@/lib/call-body";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { supabaseIsConfigured } from "@/lib/supabase/env";

type RouteContext = {
  params: Promise<{ id: string }>;
};

/**
 * Save the end of a call the server already authorized.
 * Duration is computed here from started_at, not from the browser clock.
 */
export async function PATCH(request: Request, context: RouteContext) {
  if (!supabaseIsConfigured()) {
    return Response.json({ error: "supabase_unconfigured" }, { status: 503 });
  }

  const { id } = await context.params;
  if (!isUuid(id)) {
    return Response.json({ error: "bad_id" }, { status: 400 });
  }

  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return Response.json({ error: "supabase_unconfigured" }, { status: 503 });
  }

  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    return Response.json({ error: "unauthenticated" }, { status: 401 });
  }

  let body: unknown = {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }
  const record = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  const turns = sanitizeIncomingTurns(record.turns);
  const coaching = sanitizeIncomingCoaching(record.coaching);

  const { data: existing, error: readError } = await supabase
    .from("calls")
    .select("started_at")
    .eq("id", id)
    .eq("user_id", userData.user.id)
    .maybeSingle();

  if (readError || !existing) {
    return Response.json({ error: "not_found" }, { status: 404 });
  }

  const started = new Date(existing.started_at).getTime();
  const endedAt = new Date();
  const durationSeconds = Number.isFinite(started)
    ? Math.max(0, Math.round((endedAt.getTime() - started) / 1000))
    : null;

  const { error } = await supabase
    .from("calls")
    .update({
      ended_at: endedAt.toISOString(),
      duration_seconds: durationSeconds,
      transcript: turns,
      coaching_worked: coaching?.worked ?? null,
      coaching_tighten: coaching?.tighten ?? null,
      coaching_next_line: coaching?.nextLine ?? null,
      coaching_raw: coaching?.raw || null,
    })
    .eq("id", id)
    .eq("user_id", userData.user.id);

  if (error) {
    return Response.json({ error: "save_failed" }, { status: 500 });
  }

  return Response.json({ ok: true, durationSeconds });
}
