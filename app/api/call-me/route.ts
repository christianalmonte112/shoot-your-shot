import { assistantOverridesForBrief } from "@/lib/assistant-overrides";
import { briefIsReady, sanitizeBrief } from "@/lib/brief";
import { sanitizeBuyerSettings } from "@/lib/buyer-settings";
import { readIdempotencyKey } from "@/lib/call-accounting";
import { FREE_CALL_LIMIT } from "@/lib/limits";
import { evaluateOutbound, readOutboundConfig } from "@/lib/outbound-policy";
import { normalizePhone } from "@/lib/phone";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { missingSupabaseEnv, supabaseIsConfigured } from "@/lib/supabase/env";
import { publicVapiError } from "@/lib/vapi-error";
import { outboundVapiEnv } from "@/lib/vapi-server";

/**
 * Place an outbound practice call to the signed-in user's phone.
 *
 * Order matters: a bad number or missing server key returns before
 * start_practice_call(), so a typo does not burn a free call. A real
 * dial uses the same counter as the browser call.
 *
 * VAPI_PRIVATE_KEY is read here and sent only to api.vapi.ai.
 */
export async function POST(request: Request) {
  if (!supabaseIsConfigured()) {
    return Response.json(
      { error: "supabase_unconfigured", missing: missingSupabaseEnv() },
      { status: 503 },
    );
  }

  const vapi = outboundVapiEnv();
  if (vapi.missing.length > 0 || !vapi.privateKey) {
    return Response.json({ error: "phone_unconfigured", missing: vapi.missing }, { status: 503 });
  }

  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return Response.json({ error: "supabase_unconfigured" }, { status: 503 });
  }

  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;
  if (!user) {
    return Response.json({ error: "unauthenticated" }, { status: 401 });
  }

  let body: unknown = {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }
  const raw = body && typeof body === "object" ? (body as Record<string, unknown>).phone : "";
  const phone = normalizePhone(typeof raw === "string" ? raw : "");
  if (!phone) {
    return Response.json({ error: "missing_phone" }, { status: 400 });
  }

  const outbound = evaluateOutbound({
    ...readOutboundConfig({
      enabled: process.env.OUTBOUND_CALLS_ENABLED,
      allowlist: process.env.OUTBOUND_ALLOWED_NUMBERS,
    }),
    requestedPhone: phone,
  });
  if (!outbound.ok) {
    const status = outbound.code === "missing_phone" ? 400 : 403;
    return Response.json({ error: outbound.code }, { status });
  }

  const { error: profileError } = await supabase.from("profiles").upsert({
    user_id: user.id,
    phone: outbound.number,
    updated_at: new Date().toISOString(),
  });
  if (profileError) {
    return Response.json({ error: "save_failed" }, { status: 500 });
  }

  const { data: briefRow, error: briefError } = await supabase
    .from("briefs")
    .select(
      "product_name, product_summary, target_customer, features, pricing, current_solution, objections, persona",
    )
    .eq("user_id", user.id)
    .maybeSingle();

  if (briefError) {
    return Response.json({ error: "brief_unreadable" }, { status: 500 });
  }

  const brief = sanitizeBrief(
    briefRow
      ? {
          productName: briefRow.product_name,
          productSummary: briefRow.product_summary,
          targetCustomer: briefRow.target_customer,
          features: briefRow.features,
          pricing: briefRow.pricing,
          currentSolution: briefRow.current_solution,
          objections: briefRow.objections,
          persona: briefRow.persona,
        }
      : {},
  );

  if (!briefIsReady(brief)) {
    return Response.json({ error: "brief_incomplete" }, { status: 400 });
  }

  const { data: settingsRow, error: settingsError } = await supabase
    .from("buyer_settings")
    .select("personality, difficulty, practice_questions")
    .eq("user_id", user.id)
    .maybeSingle();
  if (settingsError) {
    return Response.json({ error: "settings_unreadable" }, { status: 500 });
  }
  const settings = sanitizeBuyerSettings(
    settingsRow
      ? {
          personality: settingsRow.personality,
          difficulty: settingsRow.difficulty,
          practiceQuestions: settingsRow.practice_questions,
        }
      : { personality: brief.persona },
  );

  const idempotencyKey = readIdempotencyKey(request.headers.get("idempotency-key"));
  const { data, error } = await supabase.rpc("start_practice_call", {
    p_channel: "phone",
    p_idempotency_key: idempotencyKey,
  });
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

  const started = data as { call_id?: string; free_calls_used?: number } | null;
  const callId = started?.call_id;
  if (!callId) {
    return Response.json({ error: "start_failed" }, { status: 500 });
  }

  const overrides = assistantOverridesForBrief(brief, settings);
  let vapiResponse: Response;
  try {
    vapiResponse = await fetch("https://api.vapi.ai/call", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${vapi.privateKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        assistantId: vapi.assistantId,
        phoneNumberId: vapi.phoneNumberId,
        customer: { number: outbound.number },
        assistantOverrides: {
          variableValues: overrides.variableValues,
          firstMessage: overrides.firstMessage,
          maxDurationSeconds: overrides.maxDurationSeconds,
        },
      }),
    });
  } catch {
    await closeFailedCall(supabase, callId, user.id);
    return Response.json({ error: "vapi_error", message: "Vapi could not be reached." }, { status: 502 });
  }

  const vapiBody: unknown = await vapiResponse.json().catch(() => null);
  if (!vapiResponse.ok) {
    await closeFailedCall(supabase, callId, user.id);
    return Response.json(
      { error: "vapi_error", message: publicVapiError(vapiBody) },
      { status: 502 },
    );
  }

  const vapiCallId =
    vapiBody && typeof vapiBody === "object" && typeof (vapiBody as { id?: unknown }).id === "string"
      ? (vapiBody as { id: string }).id
      : null;

  if (vapiCallId) {
    await supabase
      .from("calls")
      .update({ vapi_call_id: vapiCallId })
      .eq("id", callId)
      .eq("user_id", user.id);
  }

  return Response.json({
    callId,
    vapiCallId,
    freeCallsUsed: started?.free_calls_used ?? 0,
    phone: outbound.number,
  });
}

async function closeFailedCall(
  supabase: NonNullable<Awaited<ReturnType<typeof createSupabaseServerClient>>>,
  callId: string,
  userId: string,
) {
  await supabase
    .from("calls")
    .update({
      ended_at: new Date().toISOString(),
      duration_seconds: 0,
    })
    .eq("id", callId)
    .eq("user_id", userId);
}
