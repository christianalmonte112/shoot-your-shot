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
