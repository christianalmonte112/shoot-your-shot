import { getPersona } from "@/lib/personas";
import type { PitchBrief, SavedCall, TranscriptTurn } from "@/lib/types";

function turn(role: TranscriptTurn["role"], text: string, index: number): TranscriptTurn {
  return {
    id: `sample-${index}`,
    role,
    text,
    final: true,
  };
}

/**
 * A scripted call so the notes screen can be read before Vapi is connected.
 * It goes through the same parser as a real transcript.
 */
export function buildSampleCall(brief: PitchBrief): SavedCall {
  const persona = getPersona(brief.persona);
  const product = brief.productName.trim() || "Ledgerline";
  const objection =
    brief.objections.find((item) => item.trim())?.trim() ||
    "We already pay for something that does this.";

  const turns: TranscriptTurn[] = [
    turn(
      "assistant",
      persona.id === "busy-exec"
        ? `${persona.buyerName}. Two minutes. What is ${product}?`
        : `This is ${persona.buyerName}. Why should we look at ${product}?`,
      0,
    ),
    turn(
      "user",
      `${product} replaces the Friday scramble. The team sees what changed, and who has to act, without opening another dashboard.`,
      1,
    ),
    turn(
      "assistant",
      `${objection} What do we stop doing if we buy this?`,
      2,
    ),
    turn(
      "user",
      "You stop reconciling it by hand. The first month runs beside what you use today, so nobody has to trust it blind.",
      3,
    ),
    turn(
      "assistant",
      [
        "switching to coach mode",
        `What worked: You said what ${product} replaces, not a list of features.`,
        "What to tighten: The buyer asked what they stop doing, and you answered with a rollout plan. Answer the job first.",
        `One line to try next: ${product} retires the manual pass your team does every Friday.`,
      ].join("\n"),
      4,
    ),
  ];

  return {
    turns,
    updatedAt: new Date().toISOString(),
  };
}
