import { normalizePhone } from "@/lib/phone";

export type OutboundDecision =
  | { ok: true; number: string }
  | { ok: false; code: "disabled" | "missing_phone" | "not_allowlisted" };

/**
 * Outbound dialing is off unless someone explicitly turns it on AND lists
 * the only numbers that may be called. An empty allowlist never means
 * "allow everyone".
 */
export function evaluateOutbound(input: {
  enabled: boolean;
  allowlist: string[];
  requestedPhone: string;
}): OutboundDecision {
  const number = normalizePhone(input.requestedPhone);
  if (!number) return { ok: false, code: "missing_phone" };

  const allowed = input.allowlist
    .map((item) => normalizePhone(item))
    .filter((item): item is string => Boolean(item));

  if (!input.enabled || allowed.length === 0) {
    return { ok: false, code: "disabled" };
  }
  if (!allowed.includes(number)) {
    return { ok: false, code: "not_allowlisted" };
  }
  return { ok: true, number };
}

export function readOutboundConfig(env: {
  enabled?: string;
  allowlist?: string;
}): { enabled: boolean; allowlist: string[] } {
  return {
    enabled: env.enabled?.trim() === "true",
    allowlist: (env.allowlist ?? "")
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean),
  };
}
