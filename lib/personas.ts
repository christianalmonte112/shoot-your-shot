import type { BuyerPersonaId } from "@/lib/types";

/**
 * The three buyers are not three prompts. They are three sets of values
 * for the same {{variables}} in docs/buyer-prompt.md. The Vapi assistant
 * stays one assistant; the personality changes per call.
 */
export type BuyerPersona = {
  id: BuyerPersonaId;
  label: string;
  blurb: string;
  buyerName: string;
  buyerRole: string;
  companyType: string;
  personality: string;
};

export const PERSONAS: Record<BuyerPersonaId, BuyerPersona> = {
  friendly: {
    id: "friendly",
    label: "Friendly",
    blurb: "Curious and warm. Still asks whether the team would actually use it.",
    buyerName: "Maya Chen",
    buyerRole: "Head of Product",
    companyType: "a mid-size product company",
    personality:
      "Friendly and curious. You give them room to explain, you acknowledge what lands, and you still ask concrete questions about fit, price, and whether your team would use it.",
  },
  skeptical: {
    id: "skeptical",
    label: "Skeptical",
    blurb: "Presses on proof, risk, and why anyone should switch.",
    buyerName: "Jordan Hale",
    buyerRole: "VP of Operations",
    companyType: "an established company that has bought tools it later regretted",
    personality:
      "Skeptical and direct. You have been burned by tools that overpromised. You challenge claims, ask what evidence they have, and you do not fill silence for them.",
  },
  "busy-exec": {
    id: "busy-exec",
    label: "Busy exec",
    blurb: "Wants the point in one sentence and cuts the rest.",
    buyerName: "Alex Rivera",
    buyerRole: "CEO",
    companyType: "a fast-growing company with no spare time",
    personality:
      "Busy and blunt. You have almost no time. You want the point in one sentence, you interrupt rambling, and you ask what decision you are supposed to make.",
  },
};

export const PERSONA_LIST: BuyerPersona[] = [
  PERSONAS.friendly,
  PERSONAS.skeptical,
  PERSONAS["busy-exec"],
];

export function getPersona(id: BuyerPersonaId): BuyerPersona {
  return PERSONAS[id];
}

/**
 * Spoken opener for this call. The dashboard assistant may have its own
 * first message; we override it so the voice matches the persona you picked.
 */
export function openingLine(persona: BuyerPersona, productName: string): string {
  const product = productName.trim();

  if (persona.id === "busy-exec") {
    return product
      ? `${persona.buyerName}. Two minutes. What is ${product}?`
      : `${persona.buyerName}. Two minutes. What is it?`;
  }

  if (persona.id === "friendly") {
    return product
      ? `Hey, I'm ${persona.buyerName}. Tell me about ${product}.`
      : `Hey, I'm ${persona.buyerName}. What are you building?`;
  }

  return product
    ? `${persona.buyerName}. I'll be direct — why should we look at ${product}?`
    : `${persona.buyerName}. I'll be direct — why should we take this call?`;
}
