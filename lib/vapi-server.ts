import "server-only";

import { VAPI_ASSISTANT_ID } from "@/lib/vapi-config";

/**
 * Outbound phone calls use Vapi's REST API. These values stay on the server.
 * VAPI_PRIVATE_KEY must never be imported from a client component.
 */
export function outboundVapiEnv(): {
  privateKey: string;
  phoneNumberId: string;
  assistantId: string;
  missing: string[];
} {
  const privateKey = process.env.VAPI_PRIVATE_KEY?.trim() ?? "";
  const phoneNumberId = process.env.VAPI_PHONE_NUMBER_ID?.trim() ?? "";
  const missing: string[] = [];
  if (!privateKey) missing.push("VAPI_PRIVATE_KEY");
  if (!phoneNumberId) missing.push("VAPI_PHONE_NUMBER_ID");
  if (!VAPI_ASSISTANT_ID) missing.push("NEXT_PUBLIC_VAPI_ASSISTANT_ID");
  return {
    privateKey,
    phoneNumberId,
    assistantId: VAPI_ASSISTANT_ID,
    missing,
  };
}

/** A short message for the builder. Never the raw response, which can be huge. */
export function publicVapiError(body: unknown): string {
  if (!body || typeof body !== "object") return "Vapi could not place the call.";
  const record = body as Record<string, unknown>;
  const message = typeof record.message === "string" ? record.message.trim() : "";
  if (!message) return "Vapi could not place the call.";
  return message.slice(0, 280);
}
