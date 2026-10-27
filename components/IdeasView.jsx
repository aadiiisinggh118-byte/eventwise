"use client";

import { useRef, useState } from "react";
import { PlanGate } from "./PlanProvider";
import { Badge, Field, Notice, PageHeading, Panel, btnPrimary, inputCls } from "./ui";
import { CATEGORIES } from "../lib/occasions";

const PREFS = [
  ["vibe", "The atmosphere you want", "Quiet and traditional, lively, intimate…"],
  ["ages", "Who is coming (ages)", "Many children, elderly relatives…"],
  ["culture", "Cultural or food preferences", "Satvik menu, regional traditions…"],
  ["accessibility", "Accessibility needs", "Wheelchair access, seating for elders…"],
  ["venue", "Venue limits", "Indoor only, no loudspeakers after 9pm…"],
];
const EFFORT = { low: ["ok", "Low effort"], medium: ["warn", "Medium effort"], high: ["bad", "High effort"] };

function IdeasBody({ plan, setPlan }) {
  const [prefs, setPrefs] = useState(plan.preferences || {});
  const [refine, setRefine] = useState("");
  const [state, setState] = useState({ status: "idle", ideas: null, error: "" });
  const cache = useRef(new Map()); // identical requests are answered locally, with no network call

  async function ask(e) {
    e.preventDefault();
    const cleaned = Object.fromEntries(Object.entries(prefs).filter(([, v]) => v && v.trim()));
    setPlan((p) => ({ ...p, preferences: cleaned }));
    const body = { occasion: plan.occasion, total: plan.total, guests: plan.guests, priorities: plan.priorities, preferences: cleaned, refine: refine.trim() };
    const key = JSON.stringify(body);

    if (cache.current.has(key)) {
      setState({ status: "done", ideas: cache.current.get(key), error: "" });
      return;
    }
    setState((s) => ({ ...s, status: "loading", error: "" }));
    try {
      const res = await fetch("/api/ideas", { method: "POST", headers: { "Content-Type": "application/json" }, body: key });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Something went wrong.");
      cache.current.set(key, data.ideas);
      setState({ status: "done", ideas: data.ideas, error: "" });
    } catch (err) {
      setState((s) => ({ ...s, status: "error", error: err.message || "Could not reach the server. Check your connection and try again." }));
    }
  }

  return (
    <div>
      <PageHeading title="Ideas that fit you">
        Tell us a little about the people and the place. Gemini suggests three ideas that respect your budget priorities. Ask for changes and it adapts.
      </PageHeading>

      <form onSubmit={ask} className="space-y-6">
        <Panel>
          <div className="grid gap-5 sm:grid-cols-2">
            {PREFS.map(([key, label, placeholder]) => (
              <Field key={key} id={`pref-${key}`} label={label}>
                {(p) => <input {...p} type="text" maxLength={200} placeholder={placeholder} value={prefs[key] || ""} onChange={(e) => setPrefs((s) => ({ ...s, [key]: e.target.value }))} className={inputCls} />}
              </Field>
            ))}
          </div>
          {state.ideas && (
            <div className="mt-5 max-w-xl">
              <Field id="ideas-refine" label="Want something different?" hint="For example: cheaper, more kid-friendly, less formal.">
                {(p) => <input {...p} type="text" maxLength={200} value={refine} onChange={(e) => setRefine(e.target.value)} className={inputCls} />}
              </Field>
            </div>
          )}
          <div className="mt-5">
            <button type="submit" disabled={state.status === "loading"} className={btnPrimary}>
              {state.status === "loading" ? "Thinking…" : state.ideas ? "Refine ideas" : "Get ideas"}
            </button>
          </div>
        </Panel>
      </form>

      <div aria-live="polite" className="mt-6">
        {state.status === "error" && <Notice tone="bad" role="alert">{state.error}</Notice>}
        {state.status === "loading" && <p className="text-ink-soft">Gemini is working on ideas for your event…</p>}
        {state.status === "done" && state.ideas && (
          <section aria-labelledby="ideas-heading" className="reveal-once space-y-4">
            <h2 id="ideas-heading" className="text-2xl">Three ideas</h2>
            <ol className="m-0 list-none space-y-4 p-0">
              {state.ideas.map((idea) => (
                <li key={idea.title}>
                  <Panel>
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <h3 className="text-xl">{idea.title}</h3>
                      <Badge tone={EFFORT[idea.effort][0]}>{EFFORT[idea.effort][1]}</Badge>
                    </div>
                    <p className="mt-2">{idea.concept}</p>
                    <p className="mt-2 text-ink-soft"><strong className="text-ink">Why it fits:</strong> {idea.fit}</p>
                    <p className="mt-2 text-sm text-ink-soft">Leans mostly on your <strong className="text-ink">{CATEGORIES[idea.leansOn]?.label.toLowerCase()}</strong> budget.</p>
                  </Panel>
                </li>
              ))}
            </ol>
            <Notice>Ideas are starting points. They don&rsquo;t include prices or confirm that any vendor is available.</Notice>
          </section>
        )}
      </div>
    </div>
  );
}

export default function IdeasView() {
  return <PlanGate>{({ plan, setPlan }) => <IdeasBody plan={plan} setPlan={setPlan} />}</PlanGate>;
}
