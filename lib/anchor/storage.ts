import { CONSENT_VERSION, TAXONOMY_VERSION } from "./taxonomy.ts";
import type { AnchorState, ConsentRecord, PatternEntry } from "./types.ts";

export const STORAGE_KEY = "bbc-anchor-v7-recommendations";

export const freshState = (): AnchorState => ({
  schemaVersion: 1,
  consent: [],
  patterns: [],
});

export function loadAnchorState(): AnchorState {
  if (typeof window === "undefined") return freshState();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return freshState();
    const parsed = JSON.parse(raw) as Partial<AnchorState>;
    return {
      schemaVersion: 1,
      consent: Array.isArray(parsed.consent) ? parsed.consent : [],
      patterns: Array.isArray(parsed.patterns) ? parsed.patterns.slice(-100) : [],
    };
  } catch {
    return freshState();
  }
}

export function saveAnchorState(state: AnchorState): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Anchor remains usable for this visit if device storage is unavailable.
  }
}

export function deviceConsent(granted: boolean): ConsentRecord {
  return {
    version: CONSENT_VERSION,
    purpose: "device-storage",
    granted,
    recordedAt: new Date().toISOString(),
  };
}

function localId(): string {
  if (typeof globalThis.crypto?.randomUUID === "function") return globalThis.crypto.randomUUID();
  if (typeof globalThis.crypto?.getRandomValues === "function") {
    const bytes = globalThis.crypto.getRandomValues(new Uint8Array(16));
    return `local-${Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("")}`;
  }
  return `local-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

export function addPattern(state: AnchorState, entry: Omit<PatternEntry, "id" | "createdAt" | "taxonomyVersion">): AnchorState {
  return {
    ...state,
    patterns: [
      ...state.patterns,
      {
        ...entry,
        id: localId(),
        createdAt: new Date().toISOString(),
        taxonomyVersion: TAXONOMY_VERSION,
      },
    ].slice(-100),
  };
}

export function clearAnchorState(): AnchorState {
  if (typeof window !== "undefined") window.localStorage.removeItem(STORAGE_KEY);
  return freshState();
}
