import { timingSafeEqual } from "node:crypto";
import type { SpokenTurn } from "@/lib/seller-coaching";

export type ParsedCallReport = {
  eventKey: string;
  vapiCallId: string;
  turns: SpokenTurn[];
};

export function secretsMatch(provided: string | null, expected: string): boolean {
  if (!expected || !provided) return false;
  const left = Buffer.from(provided);
  const right = Buffer.from(expected);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

function asRole(value: unknown): SpokenTurn["role"] | null {
  if (value === "user") return "user";
  if (value === "assistant" || value === "bot") return "assistant";
  return null;
}

function turnsFromMessages(messages: unknown): SpokenTurn[] {
  if (!Array.isArray(messages)) return [];
  const turns: SpokenTurn[] = [];
  for (const item of messages) {
    if (!item || typeof item !== "object") continue;
    const record = item as Record<string, unknown>;
    const role = asRole(record.role);
    const text =
      typeof record.message === "string"
        ? record.message
        : typeof record.content === "string"
          ? record.content
          : typeof record.transcript === "string"
            ? record.transcript
            : "";
    const trimmed = text.trim();
    if (!role || !trimmed) continue;
    turns.push({ role, text: trimmed });
  }
  return turns;
}

/** Pull a final Vapi report. Other event types are ignored. */
export function parseEndOfCallReport(body: unknown): ParsedCallReport | null {
  if (!body || typeof body !== "object") return null;
  const root = body as Record<string, unknown>;
  const message = (root.message && typeof root.message === "object" ? root.message : root) as Record<
    string,
    unknown
  >;
  if (message.type !== "end-of-call-report") return null;

  const call = message.call && typeof message.call === "object" ? (message.call as Record<string, unknown>) : {};
  const vapiCallId = typeof call.id === "string" ? call.id.trim() : "";
  if (!vapiCallId) return null;

  const artifact =
    message.artifact && typeof message.artifact === "object"
      ? (message.artifact as Record<string, unknown>)
      : {};
  const turns = turnsFromMessages(artifact.messages ?? message.messages);
  return {
    eventKey: `${vapiCallId}:end-of-call-report`,
    vapiCallId,
    turns,
  };
}

export type WebhookDecision =
  | { http: 401; action: "reject" }
  | { http: 503; action: "unconfigured" }
  | { http: 200; action: "ignore" }
  | { http: 200; action: "duplicate" }
  | { http: 503; action: "retry" }
  | { http: 200; action: "apply" };

export function decideWebhook(input: {
  secretConfigured: boolean;
  secretOk: boolean;
  parsed: ParsedCallReport | null;
  alreadyApplied: boolean;
  callFound: boolean;
}): WebhookDecision {
  if (!input.secretConfigured) return { http: 503, action: "unconfigured" };
  if (!input.secretOk) return { http: 401, action: "reject" };
  if (!input.parsed) return { http: 200, action: "ignore" };
  if (input.alreadyApplied) return { http: 200, action: "duplicate" };
  if (!input.callFound) return { http: 503, action: "retry" };
  return { http: 200, action: "apply" };
}
