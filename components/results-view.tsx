"use client";

import { useSyncExternalStore } from "react";
import Link from "next/link";
import { coachStartIndex, parseCoachingNotes } from "@/lib/coaching";
import { getPersona } from "@/lib/personas";
import { buildSampleCall } from "@/lib/sample-call";
import {
  getBriefServerSnapshot,
  getBriefSnapshot,
  getCallServerSnapshot,
  getCallSnapshot,
  saveCall,
  subscribeBrief,
  subscribeCall,
} from "@/lib/storage";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TranscriptLog } from "@/components/transcript-log";

const NOTE_CARDS = [
  {
    key: "worked" as const,
    title: "What worked",
    missing: "This label was not in the transcript.",
  },
  {
    key: "tighten" as const,
    title: "What to tighten",
    missing: "This label was not in the transcript.",
  },
  {
    key: "nextLine" as const,
    title: "One line to try next",
    missing: "This label was not in the transcript.",
  },
];

export function ResultsView() {
  const brief = useSyncExternalStore(subscribeBrief, getBriefSnapshot, getBriefServerSnapshot);
  const call = useSyncExternalStore(subscribeCall, getCallSnapshot, getCallServerSnapshot);

  const persona = getPersona(brief.persona);
  const turns = call?.turns ?? [];
  const notes = turns.length > 0 ? parseCoachingNotes(turns) : null;
  const hasLabeledNote = Boolean(notes && (notes.worked || notes.tighten || notes.nextLine));
  const product = brief.productName.trim();

  function previewSample() {
    saveCall(buildSampleCall(brief));
  }

  return (
    <div className="grid gap-8">
      <p className="text-sm text-muted-foreground">
        {product ? product : "No product name yet"}
        {" · "}
        {persona.label} buyer, {persona.buyerName}
      </p>

      {turns.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>No call yet</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4">
            <p className="text-sm leading-relaxed text-muted-foreground">
              Run a practice call and the notes land here after the buyer says
              “switching to coach mode”. You can also load a scripted sample to
              see the three cards before Vapi is connected.
            </p>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Button render={<Link href="/call" />} className="h-11 rounded-full px-5">
                Go to the call
              </Button>
              <Button
                type="button"
                variant="outline"
                className="h-11 rounded-full px-5"
                onClick={previewSample}
              >
                Preview with a sample call
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {turns.length > 0 && !notes ? (
        <Card>
          <CardHeader>
            <CardTitle>The buyer never switched to coach mode</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 text-sm leading-relaxed text-muted-foreground">
            <p>
              Notes are parsed from the transcript after the phrase “switching to
              coach mode”. This call ended before that. Stay on the line a little
              longer, or check that the assistant uses{" "}
              <span className="font-mono text-xs">docs/buyer-prompt.md</span>.
            </p>
          </CardContent>
        </Card>
      ) : null}

      {notes && hasLabeledNote ? (
        <div className="grid gap-4 md:grid-cols-3">
          {NOTE_CARDS.map((card) => {
            const body = notes[card.key];
            return (
              <Card key={card.key} className={card.key === "nextLine" ? "ring-primary/40" : undefined}>
                <CardHeader>
                  <CardTitle>{card.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className={body ? "text-sm leading-relaxed" : "text-sm text-muted-foreground"}>
                    {body ?? card.missing}
                  </p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : null}

      {notes && !hasLabeledNote ? (
        <Card>
          <CardHeader>
            <CardTitle>Coach mode started, labels did not</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm leading-relaxed whitespace-pre-wrap text-muted-foreground">
              {notes.raw || "The marker was there, but nothing followed it."}
            </p>
          </CardContent>
        </Card>
      ) : null}

      {turns.length > 0 ? (
        <div className="flex flex-col gap-3 sm:flex-row">
          <Button render={<Link href="/call" />} className="h-11 rounded-full px-5">
            Practice again
          </Button>
          <Button render={<Link href="/brief" />} variant="outline" className="h-11 rounded-full px-5">
            Edit the brief
          </Button>
        </div>
      ) : null}

      {turns.length > 0 ? (
        <section className="grid gap-3">
          <h2 className="font-heading text-2xl tracking-tight">Transcript</h2>
          <TranscriptLog
            turns={turns}
            buyerName={persona.buyerName}
            empty="This call has no lines yet."
          />
          {coachStartIndex(turns) === -1 ? null : (
            <p className="text-xs text-muted-foreground">
              Lines after the switch are labeled Coach.
            </p>
          )}
        </section>
      ) : null}
    </div>
  );
}
