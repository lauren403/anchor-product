"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, ChevronRight, RotateCcw, ShieldCheck, Sparkles } from "lucide-react";
import { barrierLabels, moments, supports, TAXONOMY_VERSION } from "@/lib/anchor/taxonomy";
import { recommendSupport } from "@/lib/anchor/recommendation";
import { addPattern, deviceConsent, loadAnchorState, saveAnchorState } from "@/lib/anchor/storage";
import type { AnchorState, Barrier, Capacity, Outcome, RecommendationInput, SupportMode } from "@/lib/anchor/types";

const capacities: Array<{ id: Capacity; label: string; description: string }> = [
  { id: "very-low", label: "Very little", description: "One tiny action is the ceiling." },
  { id: "some", label: "Some", description: "A few bounded steps may be workable." },
  { id: "steady", label: "Steadier", description: "There is room to read, reflect or plan." },
];

const modes: Array<{ id: SupportMode; label: string }> = [
  { id: "do", label: "Help me do one thing" },
  { id: "read", label: "Help me understand" },
  { id: "connect", label: "Help me connect" },
];

export function MomentFinder() {
  const [initialMoment] = useState(() => {
    if (typeof window === "undefined") return "";
    const query = new URLSearchParams(window.location.search);
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const requested = hash.get("moment") ?? query.get("moment") ?? "";
    return moments.some((item) => item.id === requested) ? requested : "";
  });
  const [state, setState] = useState<AnchorState>({ schemaVersion: 1, consent: [], patterns: [] });
  const [step, setStep] = useState(initialMoment ? 1 : 0);
  const [momentId, setMomentId] = useState(initialMoment);
  const [capacity, setCapacity] = useState<Capacity | "">("");
  const [barrier, setBarrier] = useState<Barrier | "">(() => moments.find((item) => item.id === initialMoment)?.defaultBarriers[0] ?? "");
  const [mode, setMode] = useState<SupportMode | "">("");
  const [outcome, setOutcome] = useState<Outcome | "">("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const query = new URLSearchParams(window.location.search);
    const frame = window.requestAnimationFrame(() => {
      setState(loadAnchorState());
      if (initialMoment) {
        document.getElementById("moment-finder")?.scrollIntoView({ block: "start" });
      }
      if (query.has("moment")) {
        query.delete("moment");
        const cleanQuery = query.toString();
        window.history.replaceState(null, "", `${window.location.pathname}${cleanQuery ? `?${cleanQuery}` : ""}${window.location.hash}`);
      }
    });
    return () => window.cancelAnimationFrame(frame);
  }, [initialMoment]);

  const input = useMemo<RecommendationInput | null>(() => {
    if (!momentId || !capacity || !barrier || !mode) return null;
    return { momentId, capacity, barrier, mode };
  }, [momentId, capacity, barrier, mode]);
  const result = useMemo(() => input ? recommendSupport(input) : null, [input]);
  const selectedMoment = moments.find((item) => item.id === momentId);
  const visibleBarriers = selectedMoment
    ? Array.from(new Set([...selectedMoment.defaultBarriers, ...Object.keys(barrierLabels) as Barrier[]]))
    : Object.keys(barrierLabels) as Barrier[];
  const availableModes = modes.filter((item) => selectedMoment?.supportIds.some((supportId) => {
    const support = supports.find((candidate) => candidate.id === supportId);
    return support?.capacity.includes(capacity as Capacity) && support.modes.includes(item.id);
  }));

  function chooseMoment(id: string) {
    setMomentId(id);
    setBarrier(moments.find((item) => item.id === id)?.defaultBarriers[0] ?? "decision-load");
    setCapacity("");
    setMode("");
  }

  function recordOutcome(next: Outcome) {
    if (!input || !result) return;
    const hasConsent = state.consent.some((record) => record.purpose === "device-storage" && record.granted);
    const consent = hasConsent ? state.consent : [...state.consent, deviceConsent(true)];
    const updated = addPattern({ ...state, consent }, { ...input, supportId: result.support.id, outcome: next });
    setState(updated);
    saveAnchorState(updated);
    setOutcome(next);
    setSaved(true);
  }

  function restart() {
    setStep(0); setMomentId(""); setCapacity(""); setBarrier(""); setMode(""); setOutcome(""); setSaved(false);
  }

  const canContinue = (step === 0 && Boolean(momentId)) || (step === 1 && Boolean(capacity)) || (step === 2 && Boolean(barrier)) || (step === 3 && Boolean(mode));

  return (
    <section className="moment-finder" id="moment-finder" aria-labelledby="moment-finder-title">
      <div className="moment-finder-intro">
        <div><p className="eyebrow">Anchor moment finder · transparent recommendations</p><h2 id="moment-finder-title">Tell us what is happening—not what you should achieve.</h2></div>
        <p>Four small choices lead to one bounded support. The rules are fixed and explainable; Anchor does not generate health advice.</p>
      </div>
      <div className="finder-progress" aria-label={`Step ${Math.min(step + 1, 5)} of 5`}>{[0, 1, 2, 3, 4].map((item) => <span key={item} className={item <= step ? "active" : ""} />)}</div>
      {step === 0 && <div className="finder-step"><h3>Which sentence is closest?</h3><div className="finder-grid moments">{moments.map((item) => <button key={item.id} aria-pressed={momentId === item.id} className={momentId === item.id ? "selected" : ""} onClick={() => chooseMoment(item.id)}><span>{item.pillar}</span><strong>{item.title}</strong><small>{item.description}</small></button>)}</div></div>}
      {step === 1 && <div className="finder-step"><h3>How much capacity is available?</h3><div className="finder-grid">{capacities.map((item) => <button key={item.id} aria-pressed={capacity === item.id} className={capacity === item.id ? "selected" : ""} onClick={() => { setCapacity(item.id); setMode(""); }}><strong>{item.label}</strong><small>{item.description}</small></button>)}</div></div>}
      {step === 2 && <div className="finder-step"><h3>What is most in the way?</h3><div className="finder-grid">{visibleBarriers.map((id) => <button key={id} aria-pressed={barrier === id} className={barrier === id ? "selected" : ""} onClick={() => setBarrier(id)}><strong>{barrierLabels[id].label}</strong><small>{barrierLabels[id].description}</small></button>)}</div></div>}
      {step === 3 && <div className="finder-step"><h3>What kind of support would fit?</h3><div className="finder-grid">{availableModes.map((item) => <button key={item.id} aria-pressed={mode === item.id} className={mode === item.id ? "selected" : ""} onClick={() => setMode(item.id)}><strong>{item.label}</strong></button>)}</div></div>}
      {step === 4 && result && <div className="finder-result">
        <div className="finder-why"><Sparkles size={18} /><p><strong>Why this appeared:</strong> {result.explanation}</p></div>
        <article><p className="eyebrow">The smallest support that could help</p><h3>{result.support.title}</h3><p>{result.support.intro}</p><ol>{result.support.steps.map((item) => <li key={item}>{item}</li>)}</ol><div className="finder-boundary"><ShieldCheck size={18} /><p><strong>Boundary:</strong> {result.support.boundary}</p></div></article>
        <div className="finder-outcome"><strong>Did this help enough for now?</strong><div>{(["yes", "a-little", "not-today"] as Outcome[]).map((value) => <button key={value} className={outcome === value ? "selected" : ""} onClick={() => recordOutcome(value)}>{value === "yes" ? "Yes" : value === "a-little" ? "A little" : "Not today"}</button>)}</div>{saved && <span role="status"><Check size={16} /> Saved privately on this device</span>}</div>
      </div>}
      <div className="finder-actions">
        {step > 0 && step < 4 ? <button className="button secondary" onClick={() => setStep((value) => value - 1)}>Back</button> : <p><ShieldCheck size={15} /> Nothing is sent to Body Belonging Clinic, the ADHD Hub or advertisers.</p>}
        {step < 4 ? <button className="button primary" disabled={!canContinue} onClick={() => setStep((value) => value + 1)}>Continue <ChevronRight size={18} /></button> : <button className="button primary" onClick={restart}><RotateCcw size={17} /> Try another moment</button>}
      </div>
      <p className="finder-version">Taxonomy {TAXONOMY_VERSION} · prototype content review status is visible in the evidence register.</p>
    </section>
  );
}
