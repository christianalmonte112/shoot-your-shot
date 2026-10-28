"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type Vapi from "@vapi-ai/web";
import { parseCoachingNotes } from "@/lib/coaching";
import { toVariableValues } from "@/lib/brief";
import { MAX_CALL_SECONDS } from "@/lib/limits";
import { openingLine, getPersona } from "@/lib/personas";
import { clearCall, saveCall } from "@/lib/storage";
import { applyTranscript, settleTurns } from "@/lib/transcript";
import type { CallStatus, PitchBrief, TranscriptRole, TranscriptTurn } from "@/lib/types";
import { VAPI_ASSISTANT_ID, VAPI_PUBLIC_KEY, missingVapiEnv } from "@/lib/vapi-config";
import { friendlyCallError } from "@/lib/vapi-error";

type SpokenLine = {
  role: TranscriptRole;
  text: string;
  final: boolean;
};

/**
 * Transcript events look like:
 * { type: "transcript", role, transcriptType: "partial" | "final", transcript }
 * Final-only events sometimes arrive as type "transcript[transcriptType=\"final\"]".
 */
function readTranscriptMessage(message: unknown): SpokenLine | null {
  if (!message || typeof message !== "object") return null;
  const record = message as Record<string, unknown>;
  const type = typeof record.type === "string" ? record.type : "";
  if (!type.startsWith("transcript")) return null;

  const role =
    record.role === "assistant" || record.role === "user" ? record.role : null;
  if (!role) return null;

  const text = typeof record.transcript === "string" ? record.transcript : "";
  const transcriptType =
    typeof record.transcriptType === "string" ? record.transcriptType : "";
  const final = transcriptType === "final" || type.includes("final");
  return { role, text, final };
}

type VapiCallOptions = {
  /** Server mode refuses to dial Vapi until POST /api/calls succeeds. */
  persistence?: "local" | "server";
  onAuthorized?: (freeCallsUsed: number) => void;
  onLimit?: () => void;
};

function saveLocalTurns(turns: TranscriptTurn[]): void {
  const settled = settleTurns(turns);
  if (settled.length === 0) return;
  saveCall({ turns: settled, updatedAt: new Date().toISOString() });
}

async function saveServerTurns(callId: string, turns: TranscriptTurn[]): Promise<void> {
  const settled = settleTurns(turns);
  const coaching = parseCoachingNotes(settled);
  await fetch(`/api/calls/${callId}`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ turns: settled, coaching }),
  });
}

/**
 * Owns one Vapi web call.
 *
 * The browser talks to Vapi over WebRTC. Vapi runs the assistant you created
 * in the dashboard. We never call the LLM ourselves — we pass the brief as
 * assistantOverrides.variableValues and listen for transcript events.
 */
export function useVapiCall(brief: PitchBrief, options: VapiCallOptions = {}) {
  const router = useRouter();
  const [status, setStatus] = useState<CallStatus>("idle");
  // Start empty on the server and the client. A saved transcript is read
  // through the call snapshot in the call screen, so hydration cannot diverge.
  const [turns, setTurns] = useState<TranscriptTurn[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [clientReady, setClientReady] = useState(false);
  const [stopping, setStopping] = useState(false);

  const vapiRef = useRef<Vapi | null>(null);
  const turnsRef = useRef<TranscriptTurn[]>(turns);
  const statusRef = useRef<CallStatus>(status);
  const rollbackRef = useRef<TranscriptTurn[] | null>(null);
  const callIdRef = useRef<string | null>(null);
  const optionsRef = useRef(options);

  useEffect(() => {
    optionsRef.current = options;
  });

  const setCallStatus = useCallback((next: CallStatus) => {
    statusRef.current = next;
    setStatus(next);
  }, []);

  const setTranscript = useCallback((next: TranscriptTurn[]) => {
    turnsRef.current = next;
    setTurns(next);
  }, []);

  const restoreRollback = useCallback(() => {
    const previous = rollbackRef.current;
    if (!previous) return;
    rollbackRef.current = null;
    setTranscript(previous);
    if (previous.length > 0 && optionsRef.current.persistence !== "server") {
      saveLocalTurns(previous);
    }
  }, [setTranscript]);

  useEffect(() => {
    if (!VAPI_PUBLIC_KEY || !VAPI_ASSISTANT_ID) return;

    let cancelled = false;
    let active: Vapi | null = null;

    // Import only in the browser. The SDK touches audio APIs at runtime.
    void import("@vapi-ai/web")
      .then(({ default: VapiClient }) => {
        if (cancelled) return;
        active = new VapiClient(VAPI_PUBLIC_KEY);
        vapiRef.current = active;

        active.on("call-start", () => {
          // "listening" from the assistant: the buyer can hear you.
          rollbackRef.current = null;
          setCallStatus("live");
          setError(null);
        });

        active.on("call-end", () => {
          setStopping(false);
        setCallStatus("ended");
        const settled = settleTurns(turnsRef.current);
        setTranscript(settled);
        if (optionsRef.current.persistence === "server" && callIdRef.current) {
          void saveServerTurns(callIdRef.current, settled);
        } else if (optionsRef.current.persistence !== "server") {
          saveLocalTurns(settled);
        }
      });

        active.on("call-start-failed", (event) => {
          setCallStatus("idle");
          setStopping(false);
          restoreRollback();
          setError(friendlyCallError(event.error) ?? "The call could not start.");
        });

        active.on("message", (message: unknown) => {
          const spoken = readTranscriptMessage(message);
          if (!spoken) return;
          const next = applyTranscript(
            turnsRef.current,
            spoken.role,
            spoken.text,
            spoken.final,
          );
          setTranscript(next);
          if (spoken.final) {
          const finalTurns = next.filter((turn) => turn.final);
          if (optionsRef.current.persistence === "server" && callIdRef.current) {
            void saveServerTurns(callIdRef.current, finalTurns);
          } else if (optionsRef.current.persistence !== "server") {
            saveLocalTurns(finalTurns);
          }
        }
        });

        active.on("error", (sdkError: unknown) => {
          const message = friendlyCallError(sdkError);
          if (!message) return;
          // Hanging up also surfaces a "meeting ended" error. The status
          // already says the call is over; don't paint that as a failure.
          if (statusRef.current === "ended") return;
          setError(message);
        });

        setClientReady(true);
      })
      .catch((sdkError: unknown) => {
        if (cancelled) return;
        setError(friendlyCallError(sdkError));
      });

    return () => {
      cancelled = true;
      setClientReady(false);
      const current = vapiRef.current;
      vapiRef.current = null;
      if (!current) return;
      // Next keeps this page mounted when you open Notes. Effects still
      // clean up, which is how we release the microphone on the way out.
      current.removeAllListeners();
      void current.stop().catch(() => {});
      if (statusRef.current === "live" || statusRef.current === "connecting") {
        setCallStatus("ended");
        if (optionsRef.current.persistence === "server" && callIdRef.current) {
          void saveServerTurns(callIdRef.current, turnsRef.current);
        } else if (optionsRef.current.persistence !== "server") {
          saveLocalTurns(turnsRef.current);
        }
      }
    };
  }, [restoreRollback, setCallStatus, setTranscript]);

  const start = useCallback(async () => {
    const vapi = vapiRef.current;
    if (!vapi || !VAPI_ASSISTANT_ID) return;
    // Copy the status out of the ref. Narrowing `statusRef.current` here
    // would stick for the rest of the function, even after we set it to connecting.
    const currentStatus = statusRef.current;
    if (currentStatus === "connecting" || currentStatus === "live") return;
    if (optionsRef.current.persistence !== "server") {
      setError("Sign in is required before a call can start.");
      return;
    }

    rollbackRef.current = settleTurns(turnsRef.current);
    setError(null);
    setStopping(false);
    setCallStatus("connecting");

    let callId: string;
    try {
      const response = await fetch("/api/calls", { method: "POST" });
      if (response.status === 401) {
        setCallStatus("idle");
        router.push("/login?next=/call");
        return;
      }
      if (response.status === 403) {
        setCallStatus("idle");
        optionsRef.current.onLimit?.();
        return;
      }
      if (!response.ok) {
        setCallStatus("idle");
        setError("The call was not authorized, so it did not start.");
        return;
      }
      const payload = (await response.json()) as { callId?: string; freeCallsUsed?: number };
      if (!payload.callId) {
        setCallStatus("idle");
        setError("The call was not authorized, so it did not start.");
        return;
      }
      callId = payload.callId;
      callIdRef.current = callId;
      if (typeof payload.freeCallsUsed === "number") {
        optionsRef.current.onAuthorized?.(payload.freeCallsUsed);
      }
    } catch {
      setCallStatus("idle");
      setError("The call was not authorized, so it did not start.");
      return;
    }

    setTranscript([]);
    clearCall();

    const persona = getPersona(brief.persona);

    try {
      // variableValues fills {{keys}} in the assistant prompt for this call.
      // maxDurationSeconds is the seven-minute cap, enforced by Vapi itself.
      const call = await vapi.start(VAPI_ASSISTANT_ID, {
        variableValues: toVariableValues(brief),
        firstMessage: openingLine(persona, brief.productName),
        maxDurationSeconds: MAX_CALL_SECONDS,
      });

      if (!call && statusRef.current === "connecting") {
        setCallStatus("idle");
        if (callIdRef.current) void saveServerTurns(callIdRef.current, []);
        restoreRollback();
        setError((existing) => existing ?? "The call did not start. That attempt still counts.");
        return;
      }

      if (call && statusRef.current === "connecting") {
        rollbackRef.current = null;
        setCallStatus("live");
      }
    } catch (sdkError) {
      setCallStatus("idle");
      if (callIdRef.current) void saveServerTurns(callIdRef.current, turnsRef.current);
      restoreRollback();
      setError(friendlyCallError(sdkError) ?? "The call could not start. That attempt still counts.");
    }
  }, [brief, restoreRollback, router, setCallStatus, setTranscript]);

  const end = useCallback(async () => {
    const vapi = vapiRef.current;
    if (!vapi) {
      setCallStatus("ended");
      return;
    }
    setStopping(true);
    try {
      await vapi.stop();
    } catch (sdkError) {
      const message = friendlyCallError(sdkError);
      if (message) setError(message);
    } finally {
      setStopping(false);
      setCallStatus("ended");
      const settled = settleTurns(turnsRef.current);
      setTranscript(settled);
      if (callIdRef.current) {
        const callId = callIdRef.current;
        void saveServerTurns(callId, settled).finally(() => router.refresh());
      } else {
        saveLocalTurns(settled);
      }
    }
  }, [router, setCallStatus, setTranscript]);

  return {
    status,
    turns,
    error,
    clientReady,
    stopping,
    missingEnv: missingVapiEnv(),
    dismissError: () => setError(null),
    start,
    end,
  };
}
