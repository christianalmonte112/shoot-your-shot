/**
 * E.164: a leading +, a country code that does not start with 0, then up to
 * 15 digits total. Spaces, dashes, and parentheses are ignored so
 * "+1 (555) 123-4567" still counts.
 */
const E164 = /^\+[1-9]\d{1,14}$/;

export function normalizePhone(input: string): string | null {
  const compact = input.trim().replace(/[\s().-]/g, "");
  if (!E164.test(compact)) return null;
  return compact;
}
