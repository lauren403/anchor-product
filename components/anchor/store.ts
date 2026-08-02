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
  settings: { remindersOn: boolean };
  migratedAt: string | null;
}

const STORAGE_KEY = "bbc-anchor-v7";
const PREVIOUS_KEYS = ["bbc-anchor-v5", "bbc-anchor-v4", "bbc-anchor-v3", "bbc-anchor-v2", "bbc-anchor-v1"] as const;

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
  settings: { remindersOn: false },
  migratedAt: null,
});

function asObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function strings(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

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
    why: typeof source.why === "string" ? source.why.slice(0, 120) : "",
    medicationWindow: typeof source.medicationWindow === "string" ? source.medicationWindow : typeof settings.wearOffTime === "string" ? settings.wearOffTime : base.medicationWindow,
    rhythm: rhythm.length ? rhythm : base.rhythm,
    favourites: strings(source.favourites),
    savedFuelIds: strings(source.savedFuelIds ?? source.safeFoods),
    savedMealIds: strings(source.savedMealIds),
    checkins: Array.isArray(source.checkins) ? source.checkins.filter((item): item is CheckIn => Boolean(item && typeof item === "object")).slice(-100) : [],
    programHistory: Array.isArray(source.programHistory) ? source.programHistory.filter((item): item is { programId: string; completedAt: string } => Boolean(item && typeof item === "object" && typeof (item as { programId?: unknown }).programId === "string")).slice(-100) : [],
    oneThing: typeof source.oneThing === "string" ? source.oneThing.slice(0, 120) : "",
    settings: { remindersOn: Boolean(settings.remindersOn) },
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
    reset,
  }), [state, hydrated, update, toggleList, addCheckin, completeProgram, reset]);
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
