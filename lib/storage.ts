import { sanitizeBrief } from "@/lib/brief";
import {
  EMPTY_BRIEF,
  type PitchBrief,
  type SavedCall,
  type TranscriptTurn,
} from "@/lib/types";

/**
 * v1 has no account and no database. The brief and the last call live in
 * this browser under these keys. Clearing site data clears the practice.
 */
const BRIEF_KEY = "shoot-your-shot:brief";
const CALL_KEY = "shoot-your-shot:call";

type Envelope<T> = { v: 1; data: T };

function readRaw(key: string): unknown {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as unknown;
  } catch {
    // Private mode, a full disk, or a value we did not write.
    return null;
  }
}

function writeRaw(key: string, data: unknown): void {
  if (typeof window === "undefined") return;
  try {
    const envelope: Envelope<unknown> = { v: 1, data };
    window.localStorage.setItem(key, JSON.stringify(envelope));
  } catch {
    // Saving is best-effort. The in-memory form still works for this visit.
  }
}

function readBrief(): PitchBrief {
  const parsed = readRaw(BRIEF_KEY);
  if (!parsed || typeof parsed !== "object") return EMPTY_BRIEF;
  const envelope = parsed as Partial<Envelope<unknown>>;
  if (envelope.v !== 1) return EMPTY_BRIEF;
  return sanitizeBrief(envelope.data);
}

type Listener = () => void;

const briefListeners = new Set<Listener>();
let briefLoaded = false;
let briefSnapshot: PitchBrief = EMPTY_BRIEF;

function emit(listeners: Set<Listener>) {
  for (const listener of listeners) listener();
}

/**
 * Cached snapshots for useSyncExternalStore. The call and notes screens stay
 * mounted when you leave them, so they subscribe instead of copying state
 * once and going stale.
 */
export function subscribeBrief(listener: Listener): () => void {
  briefListeners.add(listener);
  return () => {
    briefListeners.delete(listener);
  };
}

export function getBriefSnapshot(): PitchBrief {
  if (!briefLoaded) {
    briefLoaded = true;
    briefSnapshot = readBrief();
  }
  return briefSnapshot;
}

export function getBriefServerSnapshot(): PitchBrief {
  return EMPTY_BRIEF;
}

export function loadBrief(): PitchBrief {
  return getBriefSnapshot();
}

export function saveBrief(brief: PitchBrief): void {
  const clean = sanitizeBrief(brief);
  briefSnapshot = clean;
  briefLoaded = true;
  writeRaw(BRIEF_KEY, clean);
  emit(briefListeners);
}

function sanitizeTurn(value: unknown): TranscriptTurn | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  const role = record.role === "assistant" || record.role === "user" ? record.role : null;
  if (!role || typeof record.text !== "string" || !record.text.trim()) return null;
  const id = typeof record.id === "string" && record.id ? record.id : `turn-${role}-${record.text.slice(0, 12)}`;
  return {
    id,
    role,
    text: record.text.trim(),
    final: true,
  };
}

function readCall(): SavedCall | null {
  const parsed = readRaw(CALL_KEY);
  if (!parsed || typeof parsed !== "object") return null;
  const envelope = parsed as Partial<Envelope<unknown>>;
  if (envelope.v !== 1 || !envelope.data || typeof envelope.data !== "object") return null;
  const data = envelope.data as Record<string, unknown>;
  if (!Array.isArray(data.turns)) return null;
  const turns = data.turns
    .map(sanitizeTurn)
    .filter((turn): turn is TranscriptTurn => turn !== null);
  if (turns.length === 0) return null;
  return {
    turns,
    updatedAt: typeof data.updatedAt === "string" ? data.updatedAt : "",
  };
}

const callListeners = new Set<Listener>();
let callLoaded = false;
let callSnapshot: SavedCall | null = null;

export function subscribeCall(listener: Listener): () => void {
  callListeners.add(listener);
  return () => {
    callListeners.delete(listener);
  };
}

export function getCallSnapshot(): SavedCall | null {
  if (!callLoaded) {
    callLoaded = true;
    callSnapshot = readCall();
  }
  return callSnapshot;
}

export function getCallServerSnapshot(): SavedCall | null {
  return null;
}

export function loadCall(): SavedCall | null {
  return getCallSnapshot();
}

export function saveCall(call: SavedCall): void {
  const turns = call.turns
    .map(sanitizeTurn)
    .filter((turn): turn is TranscriptTurn => turn !== null);
  if (turns.length === 0) return;
  callSnapshot = { turns, updatedAt: call.updatedAt };
  callLoaded = true;
  writeRaw(CALL_KEY, callSnapshot);
  emit(callListeners);
}

export function clearCall(): void {
  callSnapshot = null;
  callLoaded = true;
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(CALL_KEY);
  } catch {
    // Ignore. The next successful save will overwrite it.
  }
  emit(callListeners);
}
