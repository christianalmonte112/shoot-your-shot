import { toVariableValues, type BuyerVariableValues } from "@/lib/brief";
import {
  DEFAULT_BUYER_SETTINGS,
  DIFFICULTY_GUIDANCE,
  sanitizeBuyerSettings,
  type BuyerSettings,
} from "@/lib/buyer-settings";
import { MAX_CALL_SECONDS } from "@/lib/limits";
import { getPersona, openingLine } from "@/lib/personas";
import type { PitchBrief } from "@/lib/types";

/**
 * The browser web call and the server "Call me" route both send this object
 * as Vapi assistantOverrides. Personality and difficulty change tone only.
 * They do not replace the product brief or the coaching rules in the prompt.
 */
export type PracticeVariableValues = BuyerVariableValues & {
  buyer_difficulty: string;
  practice_questions: string;
};

export type PracticeAssistantOverrides = {
  variableValues: PracticeVariableValues;
  firstMessage: string;
  maxDurationSeconds: number;
};

export function assistantOverridesForBrief(
  brief: PitchBrief,
  settingsInput?: Partial<BuyerSettings> | null,
): PracticeAssistantOverrides {
  const settings = sanitizeBuyerSettings({
    ...DEFAULT_BUYER_SETTINGS,
    ...settingsInput,
    personality: settingsInput?.personality ?? brief.persona,
  });
  const persona = getPersona(settings.personality);
  const questions = settings.practiceQuestions.trim();

  return {
    variableValues: {
      ...toVariableValues({ ...brief, persona: settings.personality }),
      buyer_difficulty: DIFFICULTY_GUIDANCE[settings.difficulty],
      practice_questions: questions || "None. Ask what a buyer in this role would ask.",
    },
    firstMessage: openingLine(persona, brief.productName),
    maxDurationSeconds: MAX_CALL_SECONDS,
  };
}
