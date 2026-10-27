"use client";

import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import { PlanGate } from "./PlanProvider";
import { Badge, Field, Notice, PageHeading, Panel, btnGhost, btnPrimary, inputCls } from "./ui";
import { computePlan, diffPlans, describeChanges } from "../lib/plan";
import { closeGap } from "../lib/tradeoffs";
import { validatePlanInput, toInt } from "../lib/validate";
import { formatINR } from "../lib/money";

function ReplanSection({ plan, derived, today, setPlan }) {
  const [draft, setDraft] = useState({ total: String(plan.total), guests: String(plan.guests), eventDate: plan.eventDate });
  const [applied, setApplied] = useState(false);

  // Everything here is local arithmetic: editing a value re-plans instantly, with no network call.
  const preview = useMemo(() => {
    const v = validatePlanInput({ ...plan, ...draft, overrides: null }, today);
    if (!v.ok) return { errors: v.errors, facts: [], next: null };
    const keep = v.value.total === plan.total && v.value.guests === plan.guests;
    const next = { ...v.value, overrides: keep ? plan.overrides : null };
    const facts = describeChanges(diffPlans({ plan, derived }, { plan: next, derived: computePlan(next, today) }));
    return { errors: {}, facts, next };
  }, [plan, derived, draft, today]);

  const edit = (key) => (e) => { setApplied(false); setDraft((d) => ({ ...d, [key]: e.target.value })); };

  return (
    <Panel aria-labelledby="replan-heading">
      <h2 id="replan-heading" className="text-2xl">Change your plan</h2>
      <p className="mt-1 max-w-prose text-ink-soft">Edit the budget, guest count or date. You&rsquo;ll see what changes before anything is saved, and your ticked-off tasks stay ticked.</p>

      <div className="mt-5 grid gap-5 sm:grid-cols-3">
        <Field id="chg-total" label="Total budget (₹)" error={preview.errors.total}>{(p) => <input {...p} type="text" inputMode="numeric" value={draft.total} onChange={edit("total")} className={inputCls} />}</Field>
        <Field id="chg-guests" label="Number of guests" error={preview.errors.guests}>{(p) => <input {...p} type="text" inputMode="numeric" value={draft.guests} onChange={edit("guests")} className={inputCls} />}</Field>
        <Field id="chg-date" label="Event date" error={preview.errors.eventDate}>{(p) => <input {...p} type="date" min={today} value={draft.eventDate} onChange={edit("eventDate")} className={inputCls} />}</Field>
      </div>

      <div aria-live="polite" className="mt-5">
        {preview.facts.length > 0 ? (
          <div className="rounded-r-md border-l-4 border-plum-mid bg-info-bg px-4 py-3">
            <p className="font-bold text-info">What would change</p>
            <ul className="mt-1 list-disc pl-5 text-info">{preview.facts.map((f) => <li key={f}>{f}</li>)}</ul>
          </div>
        ) : (
          !applied && Object.keys(preview.errors).length === 0 && <p className="text-ink-soft">No changes yet. Edit a value above to see the effect.</p>
        )}
        {applied && <Notice tone="ok">Plan updated on your device. Nothing was sent to a server. See your <Link href="/plan/budget" className="underline">budget</Link> and <Link href="/plan/timeline" className="underline">timeline</Link>.</Notice>}
      </div>

      <div className="mt-4">
        <button type="button" disabled={!preview.next || preview.facts.length === 0} onClick={() => { setPlan(preview.next); setApplied(true); }} className={btnPrimary}>Apply these changes</button>
      </div>
    </Panel>
  );
}

function TradeoffSection({ plan, derived, setPlan }) {
  const [overInput, setOverInput] = useState("20");
  const [narr, setNarr] = useState({ status: "idle", key: null, data: null, error: "" });
  const cache = useRef(new Map());
  const pct = toInt(overInput);
  const valid = pct !== null && pct >= 1 && pct <= 100;
  const gap = useMemo(() => (valid ? closeGap(derived.budget, pct) : null), [derived.budget, pct, valid]);
  const body = { occasion: plan.occasion, total: plan.total, guests: plan.guests, priorities: plan.priorities, overrides: plan.overrides, overPct: pct };
  const key = JSON.stringify(body);
  const narration = narr.key === key && narr.status === "done" ? narr.data : null;
  const byId = narration ? Object.fromEntries(narration.options.map((o) => [o.id, o])) : {};

  async function explain() {
    if (cache.current.has(key)) return setNarr({ status: "done", key, data: cache.current.get(key), error: "" });
    setNarr({ status: "loading", key, data: null, error: "" });
    try {
      const res = await fetch("/api/tradeoffs", { method: "POST", headers: { "Content-Type": "application/json" }, body: key });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Something went wrong.");
      cache.current.set(key, data.narration);
      setNarr({ status: "done", key, data: data.narration, error: "" });
    } catch (err) {
      setNarr({ status: "error", key, data: null, error: err.message || "Could not reach the server. Check your connection and try again." });
    }
  }

  const apply = (opt) => setPlan((p) => ({ ...p, guests: opt.guests ? opt.guests.to : p.guests, overrides: Object.fromEntries(opt.rows.map((r) => [r.id, r.to])) }));

  return (
    <Panel aria-labelledby="gap-heading">
      <h2 id="gap-heading" className="text-2xl">Costs running over?</h2>
      <p className="mt-1 max-w-prose text-ink-soft">If quotes are coming in above your split, say by how much. You&rsquo;ll get concrete ways to get back inside your {formatINR(plan.total)} budget, with the numbers worked out for you.</p>

      {derived.budget.adjusted ? (
        <div className="mt-5 space-y-3">
          <Notice>A trade-off is in effect, so your budget already reflects it. Clear it to explore other options.</Notice>
          <div className="flex flex-wrap gap-3">
            <Link href="/plan/budget" className={btnGhost}>View budget</Link>
            <button type="button" className={btnGhost} onClick={() => setPlan((p) => ({ ...p, overrides: null }))}>Clear the trade-off</button>
          </div>
        </div>
      ) : (
        <>
          <div className="mt-5 max-w-xs">
            <Field id="over-pct" label="Costs are running over by (%)" error={valid ? undefined : "Enter a percentage between 1 and 100."}>
              {(p) => <input {...p} type="text" inputMode="numeric" value={overInput} onChange={(e) => setOverInput(e.target.value)} className={inputCls} />}
            </Field>
          </div>

          {gap && (
            <div className="mt-6 space-y-5">
              <p className="num">At {pct}% over, your plan would cost <strong>{formatINR(gap.expectedTotal)}</strong>, which is <strong>{formatINR(gap.gap)}</strong> more than your budget.</p>
              <div>
                <button type="button" className={btnGhost} onClick={explain} disabled={narr.status === "loading"}>{narr.status === "loading" ? "Thinking…" : "Explain the trade-offs with Gemini"}</button>
                <span aria-live="polite" className="ml-3 text-sm">
                  {narr.key === key && narr.status === "error" && <span role="alert" className="font-semibold text-bad">{narr.error}</span>}
                </span>
              </div>
              {narration && <Notice>{narration.summary}</Notice>}

              <ol className="m-0 list-none space-y-4 p-0">
                {gap.options.map((o) => {
                  const words = byId[o.id];
                  const changed = o.rows.filter((r) => r.delta !== 0);
                  return (
                    <li key={o.id}>
                      <article aria-labelledby={`opt-${o.id}`} className="rounded-lg border border-line bg-ground p-5">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <h3 id={`opt-${o.id}`} className="text-xl">{o.title}</h3>
                          {o.fits ? <Badge tone="ok">Fits your budget</Badge> : <Badge tone="bad">Still {formatINR(o.shortfall)} over</Badge>}
                        </div>
                        <p className="mt-1 text-ink-soft">{o.summary}</p>
                        {o.guests && <p className="num mt-2 font-semibold">Guests: {o.guests.from} to {o.guests.to}</p>}
                        <table className="mt-3 w-full text-left text-sm">
                          <caption className="sr-only">Changes for {o.title}</caption>
                          <thead className="text-ink-soft"><tr><th scope="col" className="py-1 pr-3">Category</th><th scope="col" className="py-1 pr-3 text-right">Expected cost</th><th scope="col" className="py-1 text-right">Target</th></tr></thead>
                          <tbody>
                            {changed.map((r) => (
                              <tr key={r.id} className="border-t border-line">
                                <th scope="row" className="py-1.5 pr-3 font-semibold">{r.label}</th>
                                <td className="num py-1.5 pr-3 text-right">{formatINR(r.from)}</td>
                                <td className="num py-1.5 text-right font-bold">{formatINR(r.to)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        {o.buffer > 0 && <p className="num mt-2 text-sm text-ink-soft">{formatINR(o.buffer)} stays unspent as a cushion.</p>}
                        {words && (
                          <div className="mt-4 grid gap-4 border-t border-line pt-4 sm:grid-cols-2">
                            <div><h4 className="font-bold">Good about it</h4><ul className="mt-1 list-disc pl-5">{words.pros.map((x) => <li key={x}>{x}</li>)}</ul></div>
                            <div><h4 className="font-bold">What you give up</h4><ul className="mt-1 list-disc pl-5">{words.cons.map((x) => <li key={x}>{x}</li>)}</ul></div>
                            <p className="sm:col-span-2"><strong>Best if:</strong> {words.bestIf}</p>
                          </div>
                        )}
                        <div className="mt-4">
                          <button type="button" className={btnPrimary} disabled={!o.fits} onClick={() => apply(o)} aria-label={`Apply: ${o.title}`}>Use this option</button>
                          {!o.fits && <span className="ml-3 text-sm text-ink-soft">This can&rsquo;t close the whole gap on its own.</span>}
                        </div>
                      </article>
                    </li>
                  );
                })}
              </ol>
            </div>
          )}
        </>
      )}
    </Panel>
  );
}

export default function ChangesView() {
  return (
    <PlanGate>
      {({ plan, derived, today, setPlan }) => (
        <div className="space-y-8">
          <PageHeading title="When things change">Budgets shrink, guest lists grow and dates move. Re-plan without starting over.</PageHeading>
          <ReplanSection plan={plan} derived={derived} today={today} setPlan={setPlan} />
          <TradeoffSection plan={plan} derived={derived} setPlan={setPlan} />
        </div>
      )}
    </PlanGate>
  );
}
