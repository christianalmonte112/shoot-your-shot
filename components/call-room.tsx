"use client";

import { useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { Mic, PhoneOff } from "lucide-react";
import { BriefSummary } from "@/components/brief-summary";
import { SetupNotice } from "@/components/setup-notice";
import { TranscriptLog } from "@/components/transcript-log";
import { Button } from "@/components/ui/button";
import { FreeCallWall } from "@/components/free-call-wall";
import { briefIsReady } from "@/lib/brief";
import { freeCallsLabel, remainingFreeCalls } from "@/lib/limits";
import { getPersona } from "@/lib/personas";
import {
  getBriefServerSnapshot,
  getBriefSnapshot,
  getCallServerSnapshot,
  getCallSnapshot,
  subscribeBrief,
  subscribeCall,
} from "@/lib/storage";
import type { CallStatus, TranscriptTurn } from "@/lib/types";
import { useVapiCall } from "@/lib/use-vapi-call";
import { vapiIsConfigured } from "@/lib/vapi-config";
import { cn } from "@/lib/utils";

const STATUS_LABEL: Record<CallStatus, string> = {
  idle: "Idle",
  connecting: "Connecting",
  live: "Live",
  ended: "Ended",
};

export function CallRoom({
  source = "local",
  email = "",
  callsUsed = 0,
  callLimit = 3,
  onWaitlist = false,
  pastTurns = [],
}: {
  source?: "local" | "account";
  email?: string;
  callsUsed?: number;
  callLimit?: number;
  onWaitlist?: boolean;
  pastTurns?: TranscriptTurn[];
}) {
  const brief = useSyncExternalStore(subscribeBrief, getBriefSnapshot, getBriefServerSnapshot);
  const savedCall = useSyncExternalStore(subscribeCall, getCallSnapshot, getCallServerSnapshot);
  const [used, setUsed] = useState(callsUsed);
  const [blocked, setBlocked] = useState(false);
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
  } = useVapiCall(brief, {
    persistence: source === "account" ? "server" : "local",
    onAuthorized: (freeCallsUsed) => setUsed(freeCallsUsed),
    onLimit: () => {
      setUsed(callLimit);
      setBlocked(true);
    },
  });
  const configured = vapiIsConfigured();
  const ready = briefIsReady(brief);
  const persona = getPersona(brief.persona);
  const inCall = status === "connecting" || status === "live";
  const remaining = remainingFreeCalls(Math.max(used, callsUsed, blocked ? callLimit : 0), callLimit);
  const canStart =
    source === "account" && remaining > 0 && configured && ready && clientReady && !inCall;
  const remembered = source === "account" ? pastTurns : (savedCall?.turns ?? []);
  // Live lines win. Before a call starts, show the transcript from the last call.
  const visibleTurns = turns.length > 0 ? turns : inCall ? [] : remembered;
  const showWall = source === "account" && remaining <= 0 && !inCall;

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
          {source === "account" ? (
            <p className="text-sm font-medium text-primary">{freeCallsLabel(used, callLimit)}</p>
          ) : (
            <p className="text-sm text-muted-foreground">
              Calls start only after you sign in, so the free-call limit is checked on the server.
            </p>
          )}

          {showWall ? (
            <FreeCallWall email={email} alreadyJoined={onWaitlist} />
          ) : inCall ? (
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
          ) : source === "account" && configured ? (
            <Button
              type="button"
              className="h-14 w-full rounded-full text-base sm:h-16 sm:text-lg"
              onClick={() => void start()}
              disabled={!canStart}
            >
              <Mic />
              {!clientReady
                ? "Preparing the call…"
                : visibleTurns.length > 0
                  ? "Start a new call"
                  : "Start call"}
            </Button>
          ) : null}

          {source === "account" && configured && status === "idle" && remaining > 0 ? (
            <p className="text-sm text-muted-foreground">
              Starting a call uses one free call. Your browser will ask for the microphone. {persona.buyerName} speaks first.
            </p>
          ) : null}

          {status === "ended" || (status === "idle" && visibleTurns.length > 0) ? (
            <Button
              nativeButton={false}
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
            turns={visibleTurns}
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
