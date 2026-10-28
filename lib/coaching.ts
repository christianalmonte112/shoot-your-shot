/**
 * Coaching notes are not a second model call.
 *
 * The buyer prompt (docs/buyer-prompt.md) tells the voice agent to leave
 * character by saying "switching to coach mode", then three labeled lines.
 * This file reads those lines back out of the transcript. If you change
 * the phrase or the labels in the prompt, change them here too.
 */

export const COACH_MARKER = "switching to coach mode";

export type CoachingNotes = {
  worked: string | null;
  tighten: string | null;
  nextLine: string | null;
  /** Everything after the marker, kept when the labels are missing or partial. */
  raw: string;
};

const LABEL_PATTERNS: {
  key: keyof Pick<CoachingNotes, "worked" | "tighten" | "nextLine">;
  pattern: RegExp;
}[] = [
  {
    key: "worked",
    // The label has to start a sentence. Otherwise "what worked" inside
    // a note would split the note in half. The captured word is where the
    // label itself starts, so the previous sentence keeps its period.
    pattern: /(?:^|[\n.!?])\s*(what worked)\s*[:\-—]?\s*/i,
  },
  {
    key: "tighten",
    pattern: /(?:^|[\n.!?])\s*(what to tighten)\s*[:\-—]?\s*/i,
  },
  {
    key: "nextLine",
    pattern: /(?:^|[\n.!?])\s*(one line to try next(?: call)?)\s*[:\-—]?\s*/i,
  },
];

export function transcriptText(turns: { text: string }[]): string {
  return turns
    .map((turn) => turn.text.trim())
    .filter(Boolean)
    .join("\n");
}

export function parseCoachingNotes(turns: { text: string }[]): CoachingNotes | null {
  const blob = transcriptText(turns).replace(/\*\*/g, "").replace(/__/g, "");
  const markerAt = blob.toLowerCase().indexOf(COACH_MARKER);
  if (markerAt === -1) return null;

  const raw = blob
    .slice(markerAt + COACH_MARKER.length)
    .replace(/^[\s:.\-—]+/, "")
    .trim();

  const hits: {
    key: keyof Pick<CoachingNotes, "worked" | "tighten" | "nextLine">;
    labelStart: number;
    contentStart: number;
  }[] = [];

  for (const label of LABEL_PATTERNS) {
    const match = label.pattern.exec(raw);
    if (!match) continue;
    const word = match[1] ?? "";
    const wordAt = word ? match[0].toLowerCase().indexOf(word.toLowerCase()) : 0;
    hits.push({
      key: label.key,
      labelStart: match.index + (wordAt === -1 ? 0 : wordAt),
      contentStart: match.index + match[0].length,
    });
  }

  hits.sort((a, b) => a.labelStart - b.labelStart);

  const notes: CoachingNotes = {
    worked: null,
    tighten: null,
    nextLine: null,
    raw,
  };

  for (let index = 0; index < hits.length; index += 1) {
    const current = hits[index];
    const next = hits[index + 1];
    const end = next ? next.labelStart : raw.length;
    const value = raw.slice(current.contentStart, end).trim();
    notes[current.key] = value || null;
  }

  return notes;
}

/** Index of the first turn that contains the coach-mode marker, or -1. */
export function coachStartIndex(turns: { text: string }[]): number {
  let blob = "";
  for (let index = 0; index < turns.length; index += 1) {
    blob = `${blob}\n${turns[index].text}`;
    if (blob.toLowerCase().includes(COACH_MARKER)) return index;
  }
  return -1;
}
