import { BUYER_PERSONAS, type BuyerPersonaId } from "@/lib/types";

/** Tone only. These cannot rename the buyer or cancel the coaching rules. */
export const BUYER_DIFFICULTIES = ["easy", "standard", "tough"] as const;

export type BuyerDifficulty = (typeof BUYER_DIFFICULTIES)[number];

export const PRACTICE_QUESTIONS_MAX = 800;

export type BuyerSettings = {
  personality: BuyerPersonaId;
  difficulty: BuyerDifficulty;
  practiceQuestions: string;
};

export const DEFAULT_BUYER_SETTINGS: BuyerSettings = {
  personality: "skeptical",
  difficulty: "standard",
  practiceQuestions: "",
};

export const DIFFICULTY_GUIDANCE: Record<BuyerDifficulty, string> = {
  easy: "Easy. Raise one gentle objection, leave room to answer, and do not stack pressure.",
  standard: "Standard. Raise two to four real objections. If they dodge, ask once more, then move on.",
  tough: "Tough. Be impatient with waffle, do not accept a vague answer, and keep turns very short.",
};

export const DIFFICULTY_OPTIONS: { id: BuyerDifficulty; label: string; blurb: string }[] = [
  { id: "easy", label: "Easy", blurb: "One soft objection and time to answer." },
  { id: "standard", label: "Standard", blurb: "A few real objections, then a second ask if you dodge." },
  { id: "tough", label: "Tough", blurb: "Short patience. Vague answers do not stand." },
];

function isPersonality(value: unknown): value is BuyerPersonaId {
  return typeof value === "string" && (BUYER_PERSONAS as readonly string[]).includes(value);
}

function isDifficulty(value: unknown): value is BuyerDifficulty {
  return typeof value === "string" && (BUYER_DIFFICULTIES as readonly string[]).includes(value);
}

/** Drop anything outside the bounded options. Questions are plain text, length-capped. */
const SETTINGS_KEY = "shoot-your-shot:buyer-settings";
const settingsListeners = new Set<() => void>();
let settingsLoaded = false;
let settingsCache: BuyerSettings = DEFAULT_BUYER_SETTINGS;

function readStoredSettings(): BuyerSettings {
  if (typeof window === "undefined") return DEFAULT_BUYER_SETTINGS;
  try {
    const raw = window.localStorage.getItem(SETTINGS_KEY);
    if (!raw) return DEFAULT_BUYER_SETTINGS;
    return sanitizeBuyerSettings(JSON.parse(raw) as unknown);
  } catch {
    return DEFAULT_BUYER_SETTINGS;
  }
}

export function subscribeBuyerSettings(listener: () => void): () => void {
  settingsListeners.add(listener);
  return () => {
    settingsListeners.delete(listener);
  };
}

export function getBuyerSettingsSnapshot(): BuyerSettings {
  if (!settingsLoaded) {
    settingsLoaded = true;
    settingsCache = readStoredSettings();
  }
  return settingsCache;
}

export function getBuyerSettingsServerSnapshot(): BuyerSettings {
  return DEFAULT_BUYER_SETTINGS;
}

export function saveLocalBuyerSettings(settings: BuyerSettings): void {
  settingsCache = settings;
  settingsLoaded = true;
  if (typeof window !== "undefined") {
    window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  }
  for (const listener of settingsListeners) listener();
}

export function sanitizeBuyerSettings(value: unknown): BuyerSettings {
  const record = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  const questions = typeof record.practiceQuestions === "string" ? record.practiceQuestions.trim() : "";
  return {
    personality: isPersonality(record.personality) ? record.personality : DEFAULT_BUYER_SETTINGS.personality,
    difficulty: isDifficulty(record.difficulty) ? record.difficulty : DEFAULT_BUYER_SETTINGS.difficulty,
    practiceQuestions: questions.slice(0, PRACTICE_QUESTIONS_MAX),
  };
}
