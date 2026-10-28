"use client";

import { useSyncExternalStore } from "react";
import Link from "next/link";
import { Mic, PhoneOff } from "lucide-react";
import { BriefSummary } from "@/components/brief-summary";
import { SetupNotice } from "@/components/setup-notice";
import { TranscriptLog } from "@/components/transcript-log";
import { Button } from "@/components/ui/button";
import { briefIsReady } from "@/lib/brief";
import { getPersona } from "@/lib/personas";
import { getBriefServerSnapshot, getBriefSnapshot, subscribeBrief } from "@/lib/storage";
import type { CallStatus } from "@/lib/types";
import { useVapiCall } from "@/lib/use-vapi-call";
import { vapiIsConfigured } from "@/lib/vapi-config";
import { cn } from "@/lib/utils";

const STATUS_LABEL: Record<CallStatus, string> = {
  idle: "Idle",
  connecting: "Connecting",
  live: "Live",
  ended: "Ended",
};

export function CallRoom() {
  const brief = useSyncExternalStore(subscribeBrief, getBriefSnapshot, getBriefServerSnapshot);
  const {
    status,
    turns,
    error,
    clientReady,
    stopping,
    missingEnv,
    dismissError,
    start,
    end,
  } = useVapiCall(brief);
  const configured = vapiIsConfigured();
  const ready = briefIsReady(brief);
  const persona = getPersona(brief.persona);
  const inCall = status === "connecting" || status === "live";
  const canStart = configured && ready && clientReady && !inCall;

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.2fr)]">
      <BriefSummary brief={brief} />

      <section className="grid gap-4" aria-label="Call">
        {missingEnv.length > 0 ? <SetupNotice missing={missingEnv} /> : null}

        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="flex items-center gap-2 text-sm font-medium" aria-live="polite">
            <span
              className={cn(
                "size-2 rounded-full bg-muted-foreground",
                status === "connecting" && "bg-primary motion-safe:animate-pulse",
                status === "live" && "bg-emerald-400 motion-safe:animate-pulse",
                status === "ended" && "bg-foreground/50",
              )}
              aria-hidden
            />
            {STATUS_LABEL[status]}
          </p>
          {!ready ? (
            <Link
              href="/brief"
              className="text-sm font-medium text-primary underline-offset-4 hover:underline"
            >
              Finish the brief
            </Link>
          ) : null}
        </div>

        {error ? (
          <div
            role="alert"
            className="flex items-start justify-between gap-3 rounded-xl bg-destructive/10 px-3 py-3 text-sm text-destructive ring-1 ring-destructive/30"
          >
            <p>{error}</p>
            <button type="button" className="shrink-0 font-medium underline-offset-4 hover:underline" onClick={dismissError}>
              Dismiss
            </button>
          </div>
        ) : null}

        <div className="grid gap-3">
          {inCall ? (
            <Button
              type="button"
              variant="secondary"
              className="h-14 w-full rounded-full text-base sm:h-16 sm:text-lg"
              onClick={() => void end()}
              disabled={status === "connecting" || stopping}
            >
              <PhoneOff />
              {stopping ? "Ending the call…" : status === "connecting" ? "Connecting…" : "End call"}
            </Button>
          ) : configured ? (
            <Button
              type="button"
              className="h-14 w-full rounded-full text-base sm:h-16 sm:text-lg"
              onClick={() => void start()}
              disabled={!canStart}
            >
              <Mic />
              {!clientReady
                ? "Preparing the call…"
                : turns.length > 0
                  ? "Start a new call"
                  : "Start call"}
            </Button>
          ) : null}

          {configured && status === "idle" ? (
            <p className="text-sm text-muted-foreground">
              Your browser will ask for the microphone. {persona.buyerName} speaks first.
            </p>
          ) : null}

          {status === "ended" || (status === "idle" && turns.length > 0) ? (
            <Button
              render={<Link href="/results" />}
              variant="outline"
              className="h-11 rounded-full"
            >
              Read coaching notes
            </Button>
          ) : null}
        </div>

        <div className="grid gap-2">
          <h2 className="text-sm font-medium">
            {status === "live" || status === "connecting" ? "Live transcript" : "Transcript"}
          </h2>
          <TranscriptLog
            turns={turns}
            buyerName={persona.buyerName}
            empty={
              configured
                ? "The transcript shows up here once someone speaks."
                : "Connect Vapi to hear the buyer. Until then this stays empty."
            }
          />
        </div>
      </section>
    </div>
  );
}
