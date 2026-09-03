"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { defaultRhythm } from "./content";

export interface RhythmMoment {
  id: string;
  label: string;
  time: string;
  enabled: boolean;
}

export interface CheckIn extends Record<string, unknown> {
  id?: string;
  createdAt?: string;
  pattern?: string;
  note?: string;
}

export interface AnchorProductState {
  version: 7;
  onboarded: boolean;
  name: string;
  why: string;
  medicationWindow: string;
  rhythm: RhythmMoment[];
  favourites: string[];
  savedFuelIds: string[];
  savedMealIds: string[];
  checkins: CheckIn[];
  programHistory: Array<{ programId: string; completedAt: string }>;
  oneThing: string;
  settings: { remindersOn: boolean; lowStimulation: boolean };
  migratedAt: string | null;
}

const STORAGE_KEY = "bbc-anchor-v7";
// Older builds this device may have written to. Ordered newest-first so the most
// recent prior state wins. Includes the very first v0.1 key `bbc-anchor:v1`
// (colon), which some of the earliest testers may still carry.
const PREVIOUS_KEYS = ["bbc-anchor-v5", "bbc-anchor-v4", "bbc-anchor-v3", "bbc-anchor-v2", "bbc-anchor-v1", "bbc-anchor:v1"] as const;

export function localId(): string {
  if (typeof globalThis.crypto?.randomUUID === "function") return globalThis.crypto.randomUUID();
  if (typeof globalThis.crypto?.getRandomValues === "function") {
    const bytes = globalThis.crypto.getRandomValues(new Uint8Array(16));
    return `local-${Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("")}`;
  }
  return `local-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

const freshState = (): AnchorProductState => ({
  version: 7,
  onboarded: false,
  name: "",
  why: "",
  medicationWindow: "16:30",
  rhythm: defaultRhythm.map((item: RhythmMoment) => ({ ...item })),
  favourites: [],
  savedFuelIds: [],
  savedMealIds: [],
  checkins: [],
  programHistory: [],
  oneThing: "",
  settings: { remindersOn: false, lowStimulation: false },
  migratedAt: null,
});

function asObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function strings(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

// --- Legacy check-in / wins migration -------------------------------------
// The deployed v1/v2 apps (key bbc-anchor-v1 / bbc-anchor-v2) stored a simpler
// shape than v7 renders: check-ins as { at, ate, feeling, hunger, energy, note }
// and a separate wins[] of { at, text } (the "spark" input writes here). The
// very first v0.1 build (bbc-anchor:v1) used { ts, cue, note } and wins { ts,
// label }. We translate all of these into v7's CheckIn shape so nothing is lost
// and history displays with real dates. Per product decision, wins/sparks are
// folded into the check-in/spark stream rather than a separate view.

const FEELING_LABELS: Record<string, string> = { steady: "Steady", foggy: "Foggy", wired: "Wired", low: "Low", okay: "Okay" };
const ATE_LABELS: Record<string, string> = { yes: "Yes", "a-little": "A little", "not-yet": "Not yet" };
const HUNGER_LABELS: Record<string, string> = { none: "Nothing yet", faint: "A whisper", clear: "Clearly hungry", "not-sure": "Not sure" };
const ENERGY_LABELS: Record<string, string> = { low: "Low", steady: "Steady", wired: "Wired" };
const CUE_LABELS: Record<string, string> = { fed: "Fed", okay: "Okay", "getting-empty": "Getting empty", "running-on-empty": "Running on empty" };

function toIso(value: unknown): string {
  if (typeof value === "number" && Number.isFinite(value)) return new Date(value).toISOString();
  if (typeof value === "string" && value) {
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? new Date(parsed).toISOString() : value;
  }
  return new Date().toISOString();
}

function translateCheckin(entry: unknown): CheckIn | null {
  const item = asObject(entry);
  if (!Object.keys(item).length) return null;
  const createdAt = typeof item.createdAt === "string" ? item.createdAt : toIso(item.at ?? item.ts);
  // Already v7-shaped: keep as-is (only ensure a createdAt exists). Detect via
  // fields ONLY v7 writes (createdAt / pattern / brain / spark). Do NOT include
  // energy or fuel here — the live v1 check-in also carries an `energy` field,
  // so keying on it would wrongly skip translating a legacy entry.
  if (typeof item.createdAt === "string" || typeof item.pattern === "string" || typeof item.brain === "string" || typeof item.spark === "string") {
    return { ...(item as CheckIn), createdAt };
  }
  const out: CheckIn = { id: typeof item.id === "string" && item.id ? item.id : localId(), createdAt };
  if (typeof item.note === "string" && item.note) out.note = item.note.slice(0, 500);
  if (typeof item.feeling === "string") out.brain = FEELING_LABELS[item.feeling] ?? item.feeling;
  if (typeof item.ate === "string") out.fuel = ATE_LABELS[item.ate] ?? item.ate;
  if (typeof item.energy === "string") out.energy = ENERGY_LABELS[item.energy] ?? item.energy;
  if (typeof item.hunger === "string") out.body = HUNGER_LABELS[item.hunger] ?? item.hunger;
  else if (typeof item.cue === "string") out.body = CUE_LABELS[item.cue] ?? item.cue;
  return out;
}

function winToCheckin(entry: unknown): CheckIn | null {
  const item = asObject(entry);
  const text = typeof item.text === "string" ? item.text : typeof item.label === "string" ? item.label : "";
  if (!text) return null;
  return { id: typeof item.id === "string" && item.id ? item.id : localId(), createdAt: toIso(item.at ?? item.ts), pattern: "A small win", spark: text.slice(0, 180) };
}

function mergeLegacyCheckins(source: Record<string, unknown>): CheckIn[] {
  const checkins = Array.isArray(source.checkins) ? source.checkins.map(translateCheckin).filter((item): item is CheckIn => Boolean(item)) : [];
  const wins = Array.isArray(source.wins) ? source.wins.map(winToCheckin).filter((item): item is CheckIn => Boolean(item)) : [];
  return [...checkins, ...wins]
    .sort((a, b) => String(a.createdAt ?? "").localeCompare(String(b.createdAt ?? "")))
    .slice(-100);
}
// --------------------------------------------------------------------------

function normalise(raw: unknown): AnchorProductState {
  const source = asObject(raw);
  const base = freshState();
  const settings = asObject(source.settings);
  const rawRhythm = Array.isArray(source.rhythm) ? source.rhythm : [];
  const rhythm = rawRhythm.flatMap((entry, index) => {
    const item = asObject(entry);
    const time = typeof item.time === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(item.time) ? item.time : "12:00";
    return [{
      id: typeof item.id === "string" && item.id ? item.id : `migrated-${index}`,
      label: typeof item.label === "string" ? item.label.slice(0, 60) : `Gentle moment ${index + 1}`,
      time,
      enabled: item.enabled !== false,
    }];
  });

  return {
    ...base,
    onboarded: Boolean(source.onboarded ?? settings.onboarded),
    name: typeof source.name === "string" ? source.name.slice(0, 40) : typeof settings.name === "string" ? settings.name.slice(0, 40) : "",
    why: typeof source.why === "string" ? source.why.slice(0, 120) : typeof settings.values === "string" ? settings.values.slice(0, 120) : "",
    medicationWindow: typeof source.medicationWindow === "string" ? source.medicationWindow : typeof settings.wearOffTime === "string" ? settings.wearOffTime : typeof settings.medsWearOff === "string" ? settings.medsWearOff : base.medicationWindow,
    rhythm: rhythm.length ? rhythm : base.rhythm,
    favourites: strings(source.favourites),
    savedFuelIds: strings(source.savedFuelIds ?? source.safeFoods),
    savedMealIds: strings(source.savedMealIds),
    checkins: mergeLegacyCheckins(source),
    programHistory: Array.isArray(source.programHistory) ? source.programHistory.filter((item): item is { programId: string; completedAt: string } => Boolean(item && typeof item === "object" && typeof (item as { programId?: unknown }).programId === "string")).slice(-100) : [],
    oneThing: typeof source.oneThing === "string" ? source.oneThing.slice(0, 120) : "",
    settings: { remindersOn: Boolean(settings.remindersOn), lowStimulation: Boolean(settings.lowStimulation) },
    migratedAt: typeof source.migratedAt === "string" ? source.migratedAt : new Date().toISOString(),
  };
}

function loadState(): AnchorProductState {
  if (typeof window === "undefined") return freshState();
  try {
    const current = window.localStorage.getItem(STORAGE_KEY);
    if (current) return normalise(JSON.parse(current));
    for (const key of PREVIOUS_KEYS) {
      const previous = window.localStorage.getItem(key);
      if (previous) return normalise(JSON.parse(previous));
    }
  } catch {
    // The in-memory experience remains available if storage is unavailable.
  }
  return freshState();
}

export function useAnchorStore() {
  const [state, setState] = useState<AnchorProductState>(freshState);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      setState(loadState());
      setHydrated(true);
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch { /* remain usable in memory */ }
  }, [hydrated, state]);

  const update = useCallback((patch: Partial<AnchorProductState>) => setState((previous) => ({ ...previous, ...patch })), []);
  const toggleList = useCallback((key: "favourites" | "savedFuelIds" | "savedMealIds", id: string) => {
    setState((previous) => ({ ...previous, [key]: previous[key].includes(id) ? previous[key].filter((item) => item !== id) : [...previous[key], id] }));
  }, []);
  const addCheckin = useCallback((checkin: CheckIn) => setState((previous) => ({ ...previous, checkins: [...previous.checkins, { ...checkin, id: localId(), createdAt: new Date().toISOString() }].slice(-100) })), []);
  const toggleLowStimulation = useCallback(() => setState((previous) => ({ ...previous, settings: { ...previous.settings, lowStimulation: !previous.settings.lowStimulation } })), []);
  const completeProgram = useCallback((programId: string) => setState((previous) => ({ ...previous, programHistory: [...previous.programHistory, { programId, completedAt: new Date().toISOString() }].slice(-100) })), []);
  const reset = useCallback(() => {
    try {
      window.localStorage.removeItem(STORAGE_KEY);
      PREVIOUS_KEYS.forEach((key) => window.localStorage.removeItem(key));
    } catch { /* in-memory reset still succeeds */ }
    setState(freshState());
  }, []);

  return useMemo(() => ({
    state,
    hydrated,
    update,
    toggleFavourite: (id: string) => toggleList("favourites", id),
    toggleFuel: (id: string) => toggleList("savedFuelIds", id),
    toggleMeal: (id: string) => toggleList("savedMealIds", id),
    addCheckin,
    completeProgram,
    toggleLowStimulation,
    reset,
  }), [state, hydrated, update, toggleList, addCheckin, completeProgram, toggleLowStimulation, reset]);
}

export function getNextMoment(rhythm: RhythmMoment[], now = new Date()) {
  const enabled = rhythm.filter((item) => item.enabled !== false).map((item) => {
    const [hour, minute] = item.time.split(":").map(Number);
    const date = new Date(now);
    date.setHours(hour, minute, 0, 0);
    return { ...item, date };
  }).sort((a, b) => a.date.getTime() - b.date.getTime());
  const today = enabled.find((item) => item.date > now);
  if (today) return { ...today, tomorrow: false };
  if (!enabled.length) return null;
  const first = { ...enabled[0], date: new Date(enabled[0].date) };
  first.date.setDate(first.date.getDate() + 1);
  return { ...first, tomorrow: true };
}

export function formatTime(time: string) {
  const [hour, minute] = time.split(":").map(Number);
  return new Intl.DateTimeFormat("en-AU", { hour: "numeric", minute: "2-digit" }).format(new Date(2020, 0, 1, hour, minute));
}
