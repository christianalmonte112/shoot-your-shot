"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, X } from "lucide-react";
import { briefIsReady } from "@/lib/brief";
import { PERSONA_LIST } from "@/lib/personas";
import { loadBrief, saveBrief } from "@/lib/storage";
import type { PitchBrief } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

const OBJECTION_LIMIT = 8;

type FieldErrors = {
  productName: boolean;
  productSummary: boolean;
};

export function BriefForm() {
  const router = useRouter();
  const [brief, setBrief] = useState<PitchBrief>(() => loadBrief());
  const [draft, setDraft] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({
    productName: false,
    productSummary: false,
  });

  function persist(next: PitchBrief) {
    setBrief(next);
    saveBrief(next);
  }

  function update(patch: Partial<PitchBrief>) {
    persist({ ...brief, ...patch });
    setErrors((current) => ({
      productName: patch.productName !== undefined ? false : current.productName,
      productSummary: patch.productSummary !== undefined ? false : current.productSummary,
    }));
  }

  function addObjection() {
    const next = draft.trim();
    if (!next || brief.objections.includes(next) || brief.objections.length >= OBJECTION_LIMIT) {
      setDraft("");
      return;
    }
    persist({ ...brief, objections: [...brief.objections, next] });
    setDraft("");
  }

  function removeObjection(index: number) {
    persist({
      ...brief,
      objections: brief.objections.filter((_, itemIndex) => itemIndex !== index),
    });
  }

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const pending = draft.trim();
    const objections =
      pending && !brief.objections.includes(pending) && brief.objections.length < OBJECTION_LIMIT
        ? [...brief.objections, pending]
        : brief.objections;
    const next: PitchBrief = { ...brief, objections };
    const nextErrors = {
      productName: next.productName.trim().length === 0,
      productSummary: next.productSummary.trim().length === 0,
    };
    setErrors(nextErrors);
    persist(next);
    setDraft("");
    if (!briefIsReady(next)) return;
    router.push("/call");
  }

  return (
    <form onSubmit={onSubmit} className="grid max-w-2xl gap-8" noValidate>
      <p className="text-sm text-muted-foreground">Saved on this device as you type.</p>

      <div className="grid gap-2">
        <Label htmlFor="productName">Product name</Label>
        <Input
          id="productName"
          className="h-11"
          value={brief.productName}
          onChange={(event) => update({ productName: event.target.value })}
          placeholder="Ledgerline"
          autoComplete="off"
          maxLength={120}
          aria-invalid={errors.productName || undefined}
          required
        />
        {errors.productName ? (
          <p className="text-sm text-destructive" role="alert">
            Add a product name. The buyer has to know what to ask about.
          </p>
        ) : null}
      </div>

      <div className="grid gap-2">
        <Label htmlFor="productSummary">What it is</Label>
        <Textarea
          id="productSummary"
          value={brief.productSummary}
          onChange={(event) => update({ productSummary: event.target.value })}
          placeholder="Closes the books from the bank feed, without a month-end scramble."
          className="min-h-28"
          maxLength={2000}
          aria-invalid={errors.productSummary || undefined}
          required
        />
        {errors.productSummary ? (
          <p className="text-sm text-destructive" role="alert">
            Say what it does in a sentence or two. That is the pitch they will interrupt.
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">
            One or two sentences you would actually say out loud.
          </p>
        )}
      </div>

      <div className="grid gap-2">
        <Label htmlFor="targetCustomer">Who it is for</Label>
        <Input
          id="targetCustomer"
          className="h-11"
          value={brief.targetCustomer}
          onChange={(event) => update({ targetCustomer: event.target.value })}
          placeholder="Finance leads at 20–200 person companies"
          autoComplete="off"
          maxLength={240}
        />
      </div>

      <div className="grid gap-2">
        <Label htmlFor="features">Key features</Label>
        <Textarea
          id="features"
          value={brief.features}
          onChange={(event) => update({ features: event.target.value })}
          placeholder="Bank sync, an exception inbox, an audit trail your accountant will accept."
          className="min-h-24"
          maxLength={2000}
        />
        <p className="text-sm text-muted-foreground">
          The few things you would mention. Not the whole spec.
        </p>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor="pricing">Pricing</Label>
          <Input
            id="pricing"
            className="h-11"
            value={brief.pricing}
            onChange={(event) => update({ pricing: event.target.value })}
            placeholder="$400 a month"
            autoComplete="off"
            maxLength={240}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="currentSolution">What they use today</Label>
          <Input
            id="currentSolution"
            className="h-11"
            value={brief.currentSolution}
            onChange={(event) => update({ currentSolution: event.target.value })}
            placeholder="A spreadsheet and a part-time bookkeeper"
            autoComplete="off"
            maxLength={240}
          />
        </div>
      </div>

      <fieldset className="grid gap-3">
        <legend className="text-sm font-medium">Objections you dread</legend>
        <p className="text-sm text-muted-foreground">
          The buyer will raise these if they fit. {brief.objections.length} of {OBJECTION_LIMIT}.
        </p>
        {brief.objections.length > 0 ? (
          <ul className="flex flex-wrap gap-2">
            {brief.objections.map((item, index) => (
              <li
                key={`${item}-${index}`}
                className="flex items-center gap-1 rounded-full bg-secondary py-1 pr-1 pl-3 text-sm"
              >
                <span>{item}</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  aria-label={`Remove objection: ${item}`}
                  onClick={() => removeObjection(index)}
                >
                  <X />
                </Button>
              </li>
            ))}
          </ul>
        ) : null}
        <div className="flex flex-col gap-2 sm:flex-row">
          <Label htmlFor="objection" className="sr-only">
            Add an objection
          </Label>
          <Input
            id="objection"
            className="h-11"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                addObjection();
              }
            }}
            placeholder="We already pay for an accountant"
            autoComplete="off"
            maxLength={180}
            disabled={brief.objections.length >= OBJECTION_LIMIT}
          />
          <Button
            type="button"
            variant="secondary"
            className="h-11 sm:w-auto"
            onClick={addObjection}
            disabled={brief.objections.length >= OBJECTION_LIMIT || draft.trim().length === 0}
          >
            <Plus />
            Add
          </Button>
        </div>
      </fieldset>

      <fieldset className="grid gap-3">
        <legend className="text-sm font-medium">Buyer persona</legend>
        <div role="radiogroup" aria-label="Buyer persona" className="grid gap-3 sm:grid-cols-3">
          {PERSONA_LIST.map((persona) => {
            const selected = brief.persona === persona.id;
            return (
              <button
                key={persona.id}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => update({ persona: persona.id })}
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
      </fieldset>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <Button type="submit" className="h-12 rounded-full px-6 text-base">
          Continue to the call
        </Button>
      </div>
    </form>
  );
}
