/**
 * Free practice allowance.
 *
 * The number 3 is also written in supabase/migrations/20261028160000_init.sql
 * inside start_practice_call(). The database function is what actually
 * refuses the fourth call. This constant is what the UI prints.
 *
 * TODO(stripe): a paid plan should replace this cap. Checkout can mark the
 * account as paid, and start_practice_call() can skip the free limit for
 * those rows. The waitlist button is the stand-in until that exists.
 */
export const FREE_CALL_LIMIT = 3;

/** Seven minutes. Passed to Vapi as assistantOverrides.maxDurationSeconds. */
export const MAX_CALL_SECONDS = 420;

export function remainingFreeCalls(used: number, limit = FREE_CALL_LIMIT): number {
  if (!Number.isFinite(used) || used < 0) return limit;
  return Math.max(0, limit - Math.floor(used));
}

export function freeCallsLabel(used: number, limit = FREE_CALL_LIMIT): string {
  const left = remainingFreeCalls(used, limit);
  return `${left} of ${limit} free calls left`;
}

export function safeNextPath(value: string | null | undefined): string {
  if (!value) return "/brief";
  if (!value.startsWith("/") || value.startsWith("//") || value.includes("\\")) return "/brief";
  if (value.startsWith("/login") || value.startsWith("/auth")) return "/brief";
  return value;
}
