import { coachSeller } from "@/lib/seller-coaching";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { decideWebhook, parseEndOfCallReport, secretsMatch } from "@/lib/vapi-webhook";

/**
 * Vapi calls this when a phone or web call ends.
 * Requests without VAPI_WEBHOOK_SECRET are rejected.
 * The written notes are computed here from the seller's lines, not copied
 * from the buyer's own coaching monologue.
 */
export async function POST(request: Request) {
  const expected = process.env.VAPI_WEBHOOK_SECRET?.trim() ?? "";
  const header = request.headers.get("x-vapi-secret");
  const bearer = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? null;
  const provided = header?.trim() || bearer?.trim() || null;

  let body: unknown = null;
  try {
    body = await request.json();
  } catch {
    body = null;
  }
  const parsed = parseEndOfCallReport(body);

  const decision = decideWebhook({
    secretConfigured: expected.length > 0,
    secretOk: secretsMatch(provided, expected),
    parsed,
    alreadyApplied: false,
    callFound: true,
  });

  if (decision.action === "unconfigured") {
    return Response.json({ error: "webhook_unconfigured" }, { status: 503 });
  }
  if (decision.action === "reject") {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  if (decision.action === "ignore" || !parsed) {
    return Response.json({ ok: true, ignored: true });
  }

  const service = createSupabaseServiceClient();
  if (!service) {
    return Response.json({ error: "webhook_unconfigured" }, { status: 503 });
  }

  const notes = coachSeller(parsed.turns);
  const transcript = parsed.turns.map((turn, index) => ({
    id: `vapi-${index}`,
    role: turn.role,
    text: turn.text,
    final: true,
  }));

  const { data, error } = await service.rpc("apply_vapi_report", {
    p_event_key: parsed.eventKey,
    p_vapi_call_id: parsed.vapiCallId,
    p_transcript: transcript,
    p_worked: notes.worked,
    p_tighten: notes.tighten,
    p_next_line: notes.nextLine,
  });

  if (error) {
    return Response.json({ error: "save_failed" }, { status: 500 });
  }

  const status = data && typeof data === "object" ? (data as { status?: string }).status : "";
  if (status === "unknown_call") {
    return Response.json({ error: "unknown_call" }, { status: 503 });
  }
  if (status === "duplicate") {
    return Response.json({ ok: true, duplicate: true });
  }

  return Response.json({ ok: true, applied: true });
}
