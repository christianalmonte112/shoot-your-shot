export type PracticeChannel = "web" | "phone";

export type LedgerCall = {
  id: string;
  userId: string;
  channel: PracticeChannel;
  idempotencyKey: string | null;
  startedAt: number;
  endedAt: number | null;
};

export type Ledger = {
  usage: Record<string, number>;
  calls: LedgerCall[];
};

export const OPEN_CALL_WINDOW_MS = 45_000;

/**
 * Same rules as start_practice_call() in the safety migration:
 * lock the user's usage, replay an idempotency key, reuse an open call
 * inside the window, otherwise increment once and insert.
 * This in-memory version is what the tests run. Postgres is what production runs.
 */
export function startPracticeCall(
  ledger: Ledger,
  input: {
    userId: string;
    channel: PracticeChannel;
    idempotencyKey: string | null;
    now: number;
    limit?: number;
    openWindowMs?: number;
  },
): { ledger: Ledger; status: number; callId?: string; used: number; replayed: boolean } {
  const limit = input.limit ?? 3;
  const windowMs = input.openWindowMs ?? OPEN_CALL_WINDOW_MS;
  const usage = { ...ledger.usage };
  const calls = ledger.calls.map((call) => ({ ...call }));

  if (input.idempotencyKey) {
    const existing = calls.find(
      (call) => call.userId === input.userId && call.idempotencyKey === input.idempotencyKey,
    );
    if (existing) {
      return {
        ledger,
        status: 200,
        callId: existing.id,
        used: usage[input.userId] ?? 0,
        replayed: true,
      };
    }
  }

  const open = calls.find(
    (call) =>
      call.userId === input.userId &&
      call.endedAt === null &&
      input.now - call.startedAt < windowMs,
  );
  if (open) {
    return {
      ledger,
      status: 200,
      callId: open.id,
      used: usage[input.userId] ?? 0,
      replayed: true,
    };
  }

  const used = usage[input.userId] ?? 0;
  if (used >= limit) {
    return { ledger, status: 403, used, replayed: false };
  }

  const nextUsed = used + 1;
  usage[input.userId] = nextUsed;
  const callId = `call-${calls.length + 1}`;
  calls.push({
    id: callId,
    userId: input.userId,
    channel: input.channel,
    idempotencyKey: input.idempotencyKey,
    startedAt: input.now,
    endedAt: null,
  });

  return {
    ledger: { usage, calls },
    status: 200,
    callId,
    used: nextUsed,
    replayed: false,
  };
}

export function visibleCalls(ledger: Ledger, userId: string): LedgerCall[] {
  return ledger.calls.filter((call) => call.userId === userId);
}

export function readIdempotencyKey(value: string | null): string | null {
  const raw = value?.trim() ?? "";
  if (!/^[A-Za-z0-9_-]{8,80}$/.test(raw)) return null;
  return raw;
}
