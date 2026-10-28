/**
 * The Vapi Web SDK runs in the browser, so these must be NEXT_PUBLIC_.
 * Next inlines them at build time. A private server key does not belong here.
 *
 * An empty string counts as missing. The call screen shows a setup notice
 * instead of constructing a client with a blank key.
 */
export const VAPI_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPI_PUBLIC_KEY?.trim() ?? "";
export const VAPI_ASSISTANT_ID = process.env.NEXT_PUBLIC_VAPI_ASSISTANT_ID?.trim() ?? "";

export function missingVapiEnv(): string[] {
  const missing: string[] = [];
  if (!VAPI_PUBLIC_KEY) missing.push("NEXT_PUBLIC_VAPI_PUBLIC_KEY");
  if (!VAPI_ASSISTANT_ID) missing.push("NEXT_PUBLIC_VAPI_ASSISTANT_ID");
  return missing;
}

export function vapiIsConfigured(): boolean {
  return missingVapiEnv().length === 0;
}
