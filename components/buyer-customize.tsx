"use client";

import { DIFFICULTY_OPTIONS, PRACTICE_QUESTIONS_MAX, type BuyerSettings } from "@/lib/buyer-settings";
import { PERSONA_LIST } from "@/lib/personas";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

export function BuyerCustomize({
  settings,
  onChange,
}: {
  settings: BuyerSettings;
  onChange: (next: BuyerSettings) => void;
}) {
  return (
    <fieldset className="grid gap-5">
      <legend className="text-sm font-medium">Customize your buyer</legend>
      <p className="text-sm text-muted-foreground">
        Tone and difficulty only. The buyer still judges the product in your brief, and the coaching is about what you said.
      </p>

      <div className="grid gap-3">
        <p className="text-sm font-medium">Personality</p>
        <div role="radiogroup" aria-label="Buyer personality" className="grid gap-3 sm:grid-cols-3">
          {PERSONA_LIST.map((persona) => {
            const selected = settings.personality === persona.id;
            return (
              <button
                key={persona.id}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => onChange({ ...settings, personality: persona.id })}
                className={cn(
                  "rounded-xl p-4 text-left ring-1 transition-colors",
                  selected
                    ? "bg-primary/10 ring-primary"
                    : "bg-card ring-foreground/10 hover:ring-foreground/25",
                )}
              >
                <span className="block text-sm font-medium">{persona.label}</span>
                <span className="mt-1 block text-sm text-muted-foreground">{persona.blurb}</span>
                <span className="mt-3 block text-xs text-muted-foreground">
                  {persona.buyerName}, {persona.buyerRole}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid gap-3">
        <p className="text-sm font-medium">Difficulty</p>
        <div role="radiogroup" aria-label="Buyer difficulty" className="grid gap-3 sm:grid-cols-3">
          {DIFFICULTY_OPTIONS.map((option) => {
            const selected = settings.difficulty === option.id;
            return (
              <button
                key={option.id}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => onChange({ ...settings, difficulty: option.id })}
                className={cn(
                  "rounded-xl p-4 text-left ring-1 transition-colors",
                  selected
                    ? "bg-primary/10 ring-primary"
                    : "bg-card ring-foreground/10 hover:ring-foreground/25",
                )}
              >
                <span className="block text-sm font-medium">{option.label}</span>
                <span className="mt-1 block text-sm text-muted-foreground">{option.blurb}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid gap-2">
        <Label htmlFor="practice-questions">Questions to practice</Label>
        <Textarea
          id="practice-questions"
          value={settings.practiceQuestions}
          maxLength={PRACTICE_QUESTIONS_MAX}
          placeholder="Ask what happens to the spreadsheet in month one."
          className="min-h-24"
          onChange={(event) =>
            onChange({
              ...settings,
              practiceQuestions: event.target.value.slice(0, PRACTICE_QUESTIONS_MAX),
            })
          }
        />
        <p className="text-sm text-muted-foreground">
          Optional. {settings.practiceQuestions.length} of {PRACTICE_QUESTIONS_MAX}. These are asked only when they fit the call.
        </p>
      </div>
    </fieldset>
  );
}
