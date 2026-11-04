import { toVariableValues, type BuyerVariableValues } from "@/lib/brief";
import { MAX_CALL_SECONDS } from "@/lib/limits";
import { getPersona, openingLine } from "@/lib/personas";
import type { PitchBrief } from "@/lib/types";

/**
 * The browser web call and the server "Call me" route both send this object
 * as Vapi assistantOverrides. One helper means the buyer hears the same brief
 * either way.
 */
export type PracticeAssistantOverrides = {
  variableValues: BuyerVariableValues;
  firstMessage: string;
  maxDurationSeconds: number;
};

export function assistantOverridesForBrief(brief: PitchBrief): PracticeAssistantOverrides {
  const persona = getPersona(brief.persona);
  return {
    variableValues: toVariableValues(brief),
    firstMessage: openingLine(persona, brief.productName),
    maxDurationSeconds: MAX_CALL_SECONDS,
  };
}
