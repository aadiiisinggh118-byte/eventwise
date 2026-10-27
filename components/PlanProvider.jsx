"use client";

import Link from "next/link";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { computePlan } from "../lib/plan";
import { validatePlanInput } from "../lib/validate";
import { Panel, btnPrimary } from "./ui";

export const STORAGE_KEY = "eventwise.plan.v1";
const PlanContext = createContext(null);

/** Local calendar date as YYYY-MM-DD. */
export function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/**
 * Holds the one plan for the whole /plan section and keeps it in localStorage.
 * Saved data is re-validated on load (never trusted). Everything derived from
 * the plan (budget, timeline) is computed here, locally, with no network call.
 */
export function PlanProvider({ children, initialToday }) {
  const [state, setState] = useState({ ready: false, plan: null, today: null });

  useEffect(() => {
    const today = initialToday || todayISO();
    let plan = null;
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const v = validatePlanInput(JSON.parse(raw), today, { allowPast: true });
        if (v.ok) plan = v.value;
      }
    } catch { /* corrupt or unavailable storage: start fresh */ }
    setState({ ready: true, plan, today });
  }, [initialToday]);

  useEffect(() => {
    if (!state.ready) return;
    try {
      if (state.plan) window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state.plan));
      else window.localStorage.removeItem(STORAGE_KEY);
    } catch { /* storage full or blocked: the plan still works for this visit */ }
  }, [state.plan, state.ready]);

  const setPlan = useCallback((updater) => setState((s) => ({ ...s, plan: typeof updater === "function" ? updater(s.plan) : updater })), []);
  const derived = useMemo(() => (state.plan && state.today ? computePlan(state.plan, state.today) : null), [state.plan, state.today]);
  const value = useMemo(() => ({ ...state, derived, setPlan, reset: () => setPlan(null) }), [state, derived, setPlan]);

  return <PlanContext.Provider value={value}>{children}</PlanContext.Provider>;
}

export function usePlan() {
  const ctx = useContext(PlanContext);
  if (!ctx) throw new Error("usePlan must be used inside <PlanProvider>");
  return ctx;
}

/** Renders `children(ctx)` once a plan exists; otherwise a loading state or a prompt to set one up. */
export function PlanGate({ children }) {
  const ctx = usePlan();
  if (!ctx.ready) return <p role="status" className="text-ink-soft">Loading your plan…</p>;
  if (!ctx.plan) {
    return (
      <Panel>
        <h1 className="text-2xl">You haven&rsquo;t set up an event yet</h1>
        <p className="mt-2 max-w-prose text-ink-soft">Tell us the occasion, budget, guest count and date, and we&rsquo;ll build your budget split, timeline and vendor checklist.</p>
        <Link href="/plan" className={`${btnPrimary} mt-4`}>Set up your event</Link>
      </Panel>
    );
  }
  return children(ctx);
}
