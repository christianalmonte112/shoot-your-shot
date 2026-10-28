function digMessage(error: unknown): string | null {
  if (!error) return null;
  if (typeof error === "string") return error.trim() || null;
  if (error instanceof Error) return error.message.trim() || null;
  if (typeof error !== "object") return null;

  const record = error as Record<string, unknown>;
  if (typeof record.message === "string" && record.message.trim()) {
    return record.message.trim();
  }
  if (typeof record.error === "string" && record.error.trim()) {
    return record.error.trim();
  }
  if (record.error && typeof record.error === "object") {
    return digMessage(record.error);
  }
  return null;
}

/**
 * Noise-cancellation setup can fail without ending the call.
 * The SDK reports that on the same `error` channel as a real failure.
 */
export function isIgnorableVapiError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const record = error as Record<string, unknown>;
  const type = typeof record.type === "string" ? record.type : "";
  const stage = typeof record.stage === "string" ? record.stage : "";
  const haystack = `${type} ${stage}`;
  return haystack.includes("audio-processing") || haystack.includes("audio-processor");
}

export function friendlyCallError(error: unknown): string | null {
  if (isIgnorableVapiError(error)) return null;
  const message = digMessage(error);
  if (!message) return "Something went wrong with the call.";
  const lower = message.toLowerCase();
  if (
    lower.includes("permission") ||
    lower.includes("notallowed") ||
    lower.includes("not allowed")
  ) {
    return "The microphone is blocked. Allow it in the browser and start the call again.";
  }
  if (
    lower.includes("notfound") ||
    lower.includes("no live microphone") ||
    lower.includes("requested device not found")
  ) {
    return "No microphone was found. Connect one and start the call again.";
  }
  if (message.length > 280) return `${message.slice(0, 279)}…`;
  return message;
}
