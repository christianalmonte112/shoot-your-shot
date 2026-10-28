import "server-only";

import { sanitizeBrief } from "@/lib/brief";
import type { CoachingNotes } from "@/lib/coaching";
import { FREE_CALL_LIMIT } from "@/lib/limits";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { PitchBrief, PracticeCallRecord, TranscriptTurn } from "@/lib/types";
import { EMPTY_BRIEF } from "@/lib/types";

export type AccountUser = {
  id: string;
  email: string;
};

export type AccountSnapshot = {
  user: AccountUser;
  brief: PitchBrief;
  callsUsed: number;
  callLimit: number;
  onWaitlist: boolean;
  calls: PracticeCallRecord[];
};

function asTurns(value: unknown): TranscriptTurn[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item, index) => {
    if (!item || typeof item !== "object") return [];
    const record = item as Record<string, unknown>;
    const role = record.role === "assistant" || record.role === "user" ? record.role : null;
    if (!role || typeof record.text !== "string" || !record.text.trim()) return [];
    const id = typeof record.id === "string" && record.id ? record.id : `turn-${index}`;
    return [{ id, role, text: record.text.trim(), final: true }];
  });
}

function asCoaching(row: {
  coaching_worked: string | null;
  coaching_tighten: string | null;
  coaching_next_line: string | null;
  coaching_raw: string | null;
}): CoachingNotes | null {
  const worked = row.coaching_worked?.trim() || null;
  const tighten = row.coaching_tighten?.trim() || null;
  const nextLine = row.coaching_next_line?.trim() || null;
  const raw = row.coaching_raw?.trim() || "";
  if (!worked && !tighten && !nextLine && !raw) return null;
  return { worked, tighten, nextLine, raw };
}

export async function getAccountUser(): Promise<AccountUser | null> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return null;
  const { data } = await supabase.auth.getUser();
  if (!data.user) return null;
  return { id: data.user.id, email: data.user.email ?? "" };
}

export async function loadAccount(): Promise<AccountSnapshot | { error: string } | null> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return null;
  const { data } = await supabase.auth.getUser();
  const user = data.user;
  if (!user) return null;

  const [briefResult, usageResult, callsResult, waitlistResult] = await Promise.all([
    supabase
      .from("briefs")
      .select(
        "product_name, product_summary, target_customer, features, pricing, current_solution, objections, persona",
      )
      .eq("user_id", user.id)
      .maybeSingle(),
    supabase.from("usage").select("free_calls_used").eq("user_id", user.id).maybeSingle(),
    supabase
      .from("calls")
      .select(
        "id, started_at, ended_at, duration_seconds, transcript, coaching_worked, coaching_tighten, coaching_next_line, coaching_raw",
      )
      .eq("user_id", user.id)
      .order("started_at", { ascending: false }),
    supabase.from("waitlist").select("user_id").eq("user_id", user.id).maybeSingle(),
  ]);

  const queryError = [briefResult.error, usageResult.error, callsResult.error, waitlistResult.error].find(
    (item) => item,
  );
  if (queryError) return { error: queryError.message };

  const briefRow = briefResult.data;
  const brief = briefRow
    ? sanitizeBrief({
        productName: briefRow.product_name,
        productSummary: briefRow.product_summary,
        targetCustomer: briefRow.target_customer,
        features: briefRow.features,
        pricing: briefRow.pricing,
        currentSolution: briefRow.current_solution,
        objections: briefRow.objections,
        persona: briefRow.persona,
      })
    : EMPTY_BRIEF;

  const calls: PracticeCallRecord[] = (callsResult.data ?? []).map((row) => ({
    id: row.id,
    startedAt: row.started_at,
    endedAt: row.ended_at,
    durationSeconds: row.duration_seconds,
    turns: asTurns(row.transcript),
    coaching: asCoaching(row),
  }));

  return {
    user: { id: user.id, email: user.email ?? "" },
    brief,
    callsUsed: usageResult.data?.free_calls_used ?? 0,
    callLimit: FREE_CALL_LIMIT,
    onWaitlist: Boolean(waitlistResult.data),
    calls,
  };
}
