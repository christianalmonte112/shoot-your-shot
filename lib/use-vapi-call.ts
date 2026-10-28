"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type Vapi from "@vapi-ai/web";
import { toVariableValues } from "@/lib/brief";
import { openingLine, getPersona } from "@/lib/personas";
import { clearCall, getCallSnapshot, saveCall } from "@/lib/storage";
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

function persistTurns(turns: TranscriptTurn[]): void {
  const settled = settleTurns(turns);
  if (settled.length === 0) return;
  saveCall({ turns: settled, updatedAt: new Date().toISOString() });
}

/**
 * Owns one Vapi web call.
 *
 * The browser talks to Vapi over WebRTC. Vapi runs the assistant you created
 * in the dashboard. We never call the LLM ourselves — we pass the brief as
 * assistantOverrides.variableValues and listen for transcript events.
 */
export function useVapiCall(brief: PitchBrief) {
  const [status, setStatus] = useState<CallStatus>("idle");
  const [turns, setTurns] = useState<TranscriptTurn[]>(() => getCallSnapshot()?.turns ?? []);
  const [error, setError] = useState<string | null>(null);
  const [clientReady, setClientReady] = useState(false);
  const [stopping, setStopping] = useState(false);

  const vapiRef = useRef<Vapi | null>(null);
  const turnsRef = useRef<TranscriptTurn[]>(turns);
  const statusRef = useRef<CallStatus>(status);
  const rollbackRef = useRef<TranscriptTurn[] | null>(null);

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
    if (previous.length > 0) persistTurns(previous);
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
          persistTurns(settled);
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
          if (spoken.final) persistTurns(next.filter((turn) => turn.final));
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
        persistTurns(turnsRef.current);
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

    rollbackRef.current = settleTurns(turnsRef.current);
    setError(null);
    setStopping(false);
    setCallStatus("connecting");
    setTranscript([]);
    clearCall();

    const persona = getPersona(brief.persona);

    try {
      // Second argument is assistantOverrides. variableValues fills {{keys}}
      // in the assistant's system prompt for this call only.
      const call = await vapi.start(VAPI_ASSISTANT_ID, {
        variableValues: toVariableValues(brief),
        firstMessage: openingLine(persona, brief.productName),
      });

      if (!call && statusRef.current === "connecting") {
        setCallStatus("idle");
        restoreRollback();
        setError((existing) => existing ?? "The call did not start.");
        return;
      }

      if (call && statusRef.current === "connecting") {
        rollbackRef.current = null;
        setCallStatus("live");
      }
    } catch (sdkError) {
      setCallStatus("idle");
      restoreRollback();
      setError(friendlyCallError(sdkError) ?? "The call could not start.");
    }
  }, [brief, restoreRollback, setCallStatus, setTranscript]);

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
      persistTurns(settled);
    }
  }, [setCallStatus, setTranscript]);

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
