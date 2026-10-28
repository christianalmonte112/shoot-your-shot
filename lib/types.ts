/**
 * Shared shapes for the practice session.
 *
 * Nothing here is stored on a server. The brief and the last transcript
 * live in localStorage (see lib/storage.ts) so a refresh keeps your place.
 */

export const BUYER_PERSONAS = ["friendly", "skeptical", "busy-exec"] as const;

export type BuyerPersonaId = (typeof BUYER_PERSONAS)[number];

export type PitchBrief = {
  productName: string;
  /** What it is, in plain language. */
  productSummary: string;
  targetCustomer: string;
  features: string;
  pricing: string;
  /** What the buyer uses today. */
  currentSolution: string;
  /** Objections the builder hopes the buyer will not raise. */
  objections: string[];
  persona: BuyerPersonaId;
};

export const EMPTY_BRIEF: PitchBrief = {
  productName: "",
  productSummary: "",
  targetCustomer: "",
  features: "",
  pricing: "",
  currentSolution: "",
  objections: [],
  persona: "skeptical",
};

/** The four states the call screen is allowed to show. */
export type CallStatus = "idle" | "connecting" | "live" | "ended";

export type TranscriptRole = "user" | "assistant";

export type TranscriptTurn = {
  id: string;
  role: TranscriptRole;
  text: string;
  /**
   * Vapi first sends a partial draft, then a final line.
   * Only final lines are worth keeping for coaching notes.
   */
  final: boolean;
};

export type SavedCall = {
  turns: TranscriptTurn[];
  updatedAt: string;
};
