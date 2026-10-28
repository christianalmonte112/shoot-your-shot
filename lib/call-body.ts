import type { CoachingNotes } from "@/lib/coaching";
import type { TranscriptTurn } from "@/lib/types";

const MAX_TURNS = 200;
const MAX_TEXT = 4000;

/** Accept a transcript from the browser, and drop anything that is not a spoken line. */
export function sanitizeIncomingTurns(value: unknown): TranscriptTurn[] {
  if (!Array.isArray(value)) return [];
  const turns: TranscriptTurn[] = [];
  for (const item of value.slice(0, MAX_TURNS)) {
    if (!item || typeof item !== "object") continue;
    const record = item as Record<string, unknown>;
    const role = record.role === "assistant" || record.role === "user" ? record.role : null;
    if (!role || typeof record.text !== "string") continue;
    const text = record.text.trim().slice(0, MAX_TEXT);
    if (!text) continue;
    const id = typeof record.id === "string" && record.id ? record.id.slice(0, 80) : `turn-${turns.length}`;
    turns.push({ id, role, text, final: true });
  }
  return turns;
}

export function sanitizeIncomingCoaching(value: unknown): CoachingNotes | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  const clip = (field: unknown) =>
    typeof field === "string" && field.trim() ? field.trim().slice(0, MAX_TEXT) : null;
  const notes: CoachingNotes = {
    worked: clip(record.worked),
    tighten: clip(record.tighten),
    nextLine: clip(record.nextLine),
    raw: typeof record.raw === "string" ? record.raw.trim().slice(0, MAX_TEXT) : "",
  };
  if (!notes.worked && !notes.tighten && !notes.nextLine && !notes.raw) return null;
  return notes;
}

export function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}
