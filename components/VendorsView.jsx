"use client";

import { useState } from "react";
import { PlanGate } from "./PlanProvider";
import { Badge, Field, Notice, PageHeading, Panel, btnPrimary, inputCls } from "./ui";
import { vendorGuide, compareQuotes, INCLUSIONS } from "../lib/vendors";
import { toInt } from "../lib/validate";
import { formatINR } from "../lib/money";

const blankQuote = () => ({ name: "", price: "", guests: "", extra: "", taxes: "unknown", setup: "unknown", cancellation: "unknown" });

function QuoteCompare({ guide, guests }) {
  const [categoryId, setCategoryId] = useState(guide[0].id);
  const [quotes, setQuotes] = useState([blankQuote(), blankQuote(), blankQuote()]);
  const [result, setResult] = useState(null);
  const [message, setMessage] = useState("");
  const category = guide.find((g) => g.id === categoryId);

  const update = (i, key, value) => setQuotes((qs) => qs.map((q, j) => (j === i ? { ...q, [key]: value } : q)));

  function compare(e) {
    e.preventDefault();
    const parsed = quotes
      .map((q) => ({ name: q.name.trim(), price: toInt(q.price), guestsCovered: toInt(q.guests), extra: toInt(q.extra) || 0, taxes: q.taxes, setup: q.setup, cancellation: q.cancellation }))
      .filter((q) => q.price && q.price > 0);
    if (parsed.length < 2) {
      setResult(null);
      setMessage("Enter a price for at least two quotes to compare them.");
      return;
    }
    setMessage("");
    setResult(compareQuotes(parsed, { guests, categoryAmount: category.amount }));
  }

  return (
    <Panel aria-labelledby="quotes-heading">
      <h2 id="quotes-heading" className="text-xl">Compare quotes</h2>
      <p className="mt-1 max-w-prose text-ink-soft">Enter what each vendor quoted. We do the arithmetic and show what a quote doesn&rsquo;t say. We never pick a vendor for you.</p>

      <form onSubmit={compare} noValidate className="mt-5 space-y-5">
        <div className="max-w-xs">
          <Field id="quote-category" label="Which service?">
            {(p) => (
              <select {...p} value={categoryId} onChange={(e) => { setCategoryId(e.target.value); setResult(null); }} className={inputCls}>
                {guide.map((g) => <option key={g.id} value={g.id}>{g.label}</option>)}
              </select>
            )}
          </Field>
        </div>

        {quotes.map((q, i) => (
          <fieldset key={i} className="rounded-md border border-line p-4">
            <legend className="px-1 font-semibold">Quote {i + 1}</legend>
            <div className="grid gap-4 sm:grid-cols-4">
              <Field id={`q${i}-name`} label="Vendor name">{(p) => <input {...p} type="text" maxLength={60} value={q.name} onChange={(e) => update(i, "name", e.target.value)} className={inputCls} />}</Field>
              <Field id={`q${i}-price`} label="Quoted price (₹)">{(p) => <input {...p} type="text" inputMode="numeric" value={q.price} onChange={(e) => update(i, "price", e.target.value)} className={inputCls} />}</Field>
              <Field id={`q${i}-guests`} label="Guests it covers">{(p) => <input {...p} type="text" inputMode="numeric" value={q.guests} onChange={(e) => update(i, "guests", e.target.value)} className={inputCls} />}</Field>
              <Field id={`q${i}-extra`} label="Extra charges (₹)">{(p) => <input {...p} type="text" inputMode="numeric" value={q.extra} onChange={(e) => update(i, "extra", e.target.value)} className={inputCls} />}</Field>
            </div>
            <div className="mt-4 grid gap-4 sm:grid-cols-3">
              {INCLUSIONS.map((k) => (
                <Field key={k.id} id={`q${i}-${k.id}`} label={k.label}>
                  {(p) => (
                    <select {...p} value={q[k.id]} onChange={(e) => update(i, k.id, e.target.value)} className={inputCls}>
                      <option value="unknown">Not stated</option><option value="yes">Yes</option><option value="no">No</option>
                    </select>
                  )}
                </Field>
              ))}
            </div>
          </fieldset>
        ))}

        <button type="submit" className={btnPrimary}>Compare quotes</button>
      </form>

      <div aria-live="polite" className="mt-6">
        {message && <Notice tone="warn" role="alert">{message}</Notice>}
        {result && (
          <div className="reveal-once overflow-x-auto">
            <p className="mb-3 text-ink-soft">Your {category.label.toLowerCase()} budget is {formatINR(category.amount)} for {guests} guests.</p>
            <table className="w-full min-w-[36rem] text-left">
              <caption className="sr-only">Quote comparison</caption>
              <thead className="border-b border-line text-sm text-ink-soft">
                <tr>
                  <th scope="col" className="py-2 pr-3">Vendor</th>
                  <th scope="col" className="py-2 pr-3 text-right">All-in cost</th>
                  <th scope="col" className="py-2 pr-3 text-right">Per guest covered</th>
                  <th scope="col" className="py-2 pr-3">Covers all {guests} guests?</th>
                  <th scope="col" className="py-2 pr-3 text-right">Against your budget</th>
                  <th scope="col" className="py-2">Not stated or not included</th>
                </tr>
              </thead>
              <tbody>
                {result.rows.map((r) => (
                  <tr key={r.index} className="border-b border-line align-top last:border-0">
                    <th scope="row" className="py-3 pr-3 font-semibold">{r.name}{r.index === result.lowestAllInIndex && <span className="ml-2"><Badge tone="info">Lowest all-in</Badge></span>}</th>
                    <td className="num py-3 pr-3 text-right font-bold">{formatINR(r.allIn)}</td>
                    <td className="num py-3 pr-3 text-right">{r.perGuest === null ? "Not given" : formatINR(r.perGuest)}</td>
                    <td className="py-3 pr-3">{r.coversAllGuests === null ? "Not stated" : r.coversAllGuests ? "Yes" : "No, short of your headcount"}</td>
                    <td className="num py-3 pr-3 text-right">{r.vsBudget > 0 ? `${formatINR(r.vsBudget)} over` : `${formatINR(-r.vsBudget)} under`}</td>
                    <td className="py-3 text-sm">
                      {r.notIncluded.length > 0 && <p>Not included: {r.notIncluded.join(", ")}.</p>}
                      {r.notStated.length > 0 && <p>Not stated: {r.notStated.join(", ")}. Ask before booking.</p>}
                      {r.notIncluded.length === 0 && r.notStated.length === 0 && <p>Everything we check is covered.</p>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Panel>
  );
}

function VendorsBody({ budget }) {
  const guide = vendorGuide(budget);
  return (
    <div className="space-y-8">
      <PageHeading title="Vendor checklist">
        For each service: what to decide before you call, and what to ask. Open one to see it.
      </PageHeading>

      <Panel className="!p-0">
        {guide.map((g) => (
          <details key={g.id} className="group border-b border-line last:border-0">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4">
              <span className="flex items-center gap-2 font-bold">
                <span aria-hidden="true" className="inline-block text-plum transition-transform group-open:rotate-90">&rsaquo;</span>
                {g.label}
              </span>
              <span className="num text-sm text-ink-soft">{formatINR(g.amount)} in your budget</span>
            </summary>
            <div className="grid gap-6 px-5 pb-5 sm:grid-cols-2">
              <div>
                <h3 className="text-base">Decide first</h3>
                <ul className="mt-2 list-disc space-y-1 pl-5">{g.needs.map((n) => <li key={n}>{n}</li>)}</ul>
              </div>
              <div>
                <h3 className="text-base">Ask every vendor</h3>
                <ul className="mt-2 list-disc space-y-1 pl-5">{g.ask.map((a) => <li key={a}>{a}</li>)}</ul>
              </div>
            </div>
          </details>
        ))}
      </Panel>

      <QuoteCompare guide={guide} guests={budget.guests} />
    </div>
  );
}

export default function VendorsView() {
  return <PlanGate>{({ derived }) => <VendorsBody budget={derived.budget} />}</PlanGate>;
}
