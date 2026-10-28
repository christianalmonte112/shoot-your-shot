import type { TranscriptRole, TranscriptTurn } from "@/lib/types";

function createId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `turn-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

/**
 * Vapi streams a partial transcript, then a final one for the same utterance.
 * We keep a single open line and replace it, so the screen does not fill
 * with ten drafts of the same sentence.
 */
export function applyTranscript(
  turns: TranscriptTurn[],
  role: TranscriptRole,
  text: string,
  isFinal: boolean,
): TranscriptTurn[] {
  const clean = text.trim();
  const next = turns.slice();
  const last = next[next.length - 1];

  if (last && last.role === role && !last.final) {
    if (!clean) {
      next.pop();
      return next;
    }
    next[next.length - 1] = { ...last, text: clean, final: isFinal };
    return next;
  }

  if (!clean) return turns;

  // The other person started speaking, so the open draft is as final as it will get.
  if (last && !last.final) {
    next[next.length - 1] = { ...last, final: true };
  }

  next.push({
    id: createId(),
    role,
    text: clean,
    final: isFinal,
  });
  return next;
}

/** Drop blanks and close any open draft. This is what we persist. */
export function settleTurns(turns: TranscriptTurn[]): TranscriptTurn[] {
  return turns
    .filter((turn) => turn.text.trim().length > 0)
    .map((turn) => ({ ...turn, text: turn.text.trim(), final: true }));
}
