export type SpokenTurn = {
  role: "user" | "assistant";
  text: string;
};

export type WrittenCoaching = {
  worked: string;
  tighten: string;
  nextLine: string;
  /** Exact substrings of the seller's turns. Empty when the seller never spoke. */
  evidence: string[];
};

const COACH_MARKER = "switching to coach mode";

function sellerLines(turns: SpokenTurn[]): string[] {
  const lines: string[] = [];
  for (const turn of turns) {
    if (turn.role !== "user") continue;
    const text = turn.text.trim();
    if (!text) continue;
    if (text.toLowerCase().includes(COACH_MARKER)) break;
    lines.push(text);
  }
  return lines;
}

function quoteFrom(line: string): string {
  const sentence = line.split(/(?<=[.!?])\s+/)[0]?.trim() || line.trim();
  return sentence.length > 180 ? `${sentence.slice(0, 179).trim()}…` : sentence;
}

/**
 * Written notes are about the human seller only.
 * Quotes are copied from their turns. Buyer lines are never used as evidence.
 */
export function coachSeller(turns: SpokenTurn[]): WrittenCoaching {
  const sellers = sellerLines(turns);
  if (sellers.length === 0) {
    return {
      worked: "No seller speech was captured, so there is no evidence of what worked.",
      tighten: "Coaching can only use your words. The other side of the transcript is the buyer, not you.",
      nextLine: "Start with one sentence: who it is for, and what it replaces.",
      evidence: [],
    };
  }

  const quote = quoteFrom(sellers.slice().sort((a, b) => b.length - a.length)[0] ?? sellers[0]);
  const grounded = sellers.some((line) => line.includes(quote.replace(/…$/, "")));
  const evidence = grounded ? [quote.replace(/…$/, "")] : [];
  const spoken = evidence[0] ?? sellers[0];

  return {
    worked: `You said “${spoken}” That is a concrete line a buyer can react to.`,
    tighten: `Stay with “${spoken}” and add what the buyer stops doing if they switch.`,
    nextLine: `Next time, start from your own words: “${spoken}” Then name who it is for.`,
    evidence: [spoken],
  };
}

export function coachingQuotes(notes: WrittenCoaching): string[] {
  return [...`${notes.worked} ${notes.tighten} ${notes.nextLine}`.matchAll(/“([^”]+)”/g)].map(
    (match) => match[1] ?? "",
  );
}

export function quotesAreSellerWords(notes: WrittenCoaching, turns: SpokenTurn[]): boolean {
  const sellers = sellerLines(turns);
  return coachingQuotes(notes).every((quote) => sellers.some((line) => line.includes(quote)));
}
