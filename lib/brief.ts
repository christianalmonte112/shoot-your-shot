import { getPersona } from "@/lib/personas";
import {
  BUYER_PERSONAS,
  EMPTY_BRIEF,
  type BuyerPersonaId,
  type PitchBrief,
} from "@/lib/types";

/**
 * These keys are the contract with docs/buyer-prompt.md.
 * Vapi replaces {{product_name}} (and the rest) from assistantOverrides.variableValues.
 * If you add a key here, add the same {{key}} to the prompt, or the model never sees it.
 */
export const VARIABLE_KEYS = [
  "buyer_name",
  "buyer_role",
  "buyer_company_type",
  "buyer_personality",
  "current_solution",
  "product_name",
  "product_summary",
  "target_customer",
  "features",
  "pricing",
  "objections",
] as const;

export type VariableKey = (typeof VARIABLE_KEYS)[number];

export type BuyerVariableValues = Record<VariableKey, string>;

const OBJECTION_LIMIT = 8;

export function briefIsReady(brief: PitchBrief): boolean {
  return brief.productName.trim().length > 0 && brief.productSummary.trim().length > 0;
}

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function isPersona(value: unknown): value is BuyerPersonaId {
  return (
    typeof value === "string" &&
    (BUYER_PERSONAS as readonly string[]).includes(value)
  );
}

/**
 * localStorage is a string the browser (or an older version of this app)
 * can hand back in any shape. Coerce it into a brief instead of crashing.
 */
export function sanitizeBrief(value: unknown): PitchBrief {
  const record =
    value && typeof value === "object" ? (value as Record<string, unknown>) : {};

  const objections = Array.isArray(record.objections)
    ? record.objections
        .filter((item): item is string => typeof item === "string")
        .map((item) => item.trim())
        .filter(Boolean)
        .slice(0, OBJECTION_LIMIT)
    : [];

  return {
    productName: asString(record.productName),
    productSummary: asString(record.productSummary),
    targetCustomer: asString(record.targetCustomer),
    features: asString(record.features),
    pricing: asString(record.pricing),
    currentSolution: asString(record.currentSolution),
    objections,
    persona: isPersona(record.persona) ? record.persona : EMPTY_BRIEF.persona,
  };
}

function clip(value: string, fallback: string, max = 2000): string {
  const trimmed = value.trim();
  const text = trimmed || fallback;
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1)}…`;
}

/**
 * Fill every prompt variable. Empty fields get a short fallback so the
 * model does not see a blank hole and invent a product you did not describe.
 */
export function toVariableValues(brief: PitchBrief): BuyerVariableValues {
  const persona = getPersona(brief.persona);
  const objections = brief.objections
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, OBJECTION_LIMIT);

  return {
    buyer_name: persona.buyerName,
    buyer_role: persona.buyerRole,
    buyer_company_type: persona.companyType,
    buyer_personality: persona.personality,
    current_solution: clip(
      brief.currentSolution,
      "nothing specific — they did not say what you use today",
    ),
    product_name: clip(brief.productName, "the product", 160),
    product_summary: clip(
      brief.productSummary,
      "They have not explained what it does yet. Ask them to.",
    ),
    target_customer: clip(brief.targetCustomer, "a customer they have not named"),
    features: clip(brief.features, "They have not listed features."),
    pricing: clip(brief.pricing, "They have not named a price."),
    objections: clip(
      objections.join("; "),
      "They did not list objections. Raise the ones a buyer in your role would actually have.",
    ),
  };
}
