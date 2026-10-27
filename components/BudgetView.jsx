"use client";

import Link from "next/link";
import { PlanGate } from "./PlanProvider";
import { Badge, Notice, PageHeading, Panel } from "./ui";
import { OCCASIONS } from "../lib/occasions";
import { formatINR } from "../lib/money";

const PRIORITY_LABEL = { high: "Spend more", normal: "Normal", low: "Spend less" };
const PRIORITY_TONE = { high: "ok", normal: "info", low: "warn" };
const pct = (share) => Number((share * 100).toFixed(1));

function BudgetBody({ plan, budget }) {
  const occ = OCCASIONS[plan.occasion];
  return (
    <div>
      <PageHeading title="Your budget">
        Your {formatINR(budget.total)} split across the {occ.label.toLowerCase()}&rsquo;s categories, weighted by what you said matters most.
      </PageHeading>

      <div className="mb-6 space-y-3">
        <Notice>These are estimates: shares of your own budget, not vendor quotes. Real prices come from vendors, and the Vendors page helps you compare them.</Notice>
        {budget.tight && (
          <Notice tone="warn">
            At {formatINR(budget.perGuest)} per guest, this is below the {formatINR(budget.minPerGuest)} per guest our {occ.label.toLowerCase()} template assumes.
            Expect trade-offs. The <Link href="/plan/changes" className="underline">Changes</Link> page shows ways to fit.
          </Notice>
        )}
        {budget.adjusted && (
          <Notice>This split includes a trade-off you applied. You can clear it on the <Link href="/plan/changes" className="underline">Changes</Link> page.</Notice>
        )}
      </div>

      <dl className="mb-8 grid grid-cols-2 divide-x divide-y divide-line overflow-hidden rounded-lg border border-line bg-surface sm:grid-cols-4 sm:divide-y-0">
        {[
          ["Total budget", formatINR(budget.total)],
          ["Guests", String(budget.guests)],
          ["Per guest", formatINR(budget.perGuest)],
          [budget.unallocated > 0 ? "Held back" : "Unallocated", formatINR(budget.unallocated)],
        ].map(([label, value]) => (
          <div key={label} className="p-4">
            <dt className="text-sm text-ink-soft">{label}</dt>
            <dd className="num mt-1 text-2xl font-extrabold">{value}</dd>
          </div>
        ))}
      </dl>

      <Panel className="overflow-x-auto !p-0">
        <table className="w-full min-w-[34rem] text-left">
          <caption className="sr-only">Budget split by category</caption>
          <thead className="border-b border-line bg-ground text-sm text-ink-soft">
            <tr>
              <th scope="col" className="px-4 py-3 font-semibold">Category</th>
              <th scope="col" className="px-4 py-3 font-semibold">Priority</th>
              <th scope="col" className="px-4 py-3 text-right font-semibold">Amount</th>
              <th scope="col" className="px-4 py-3 font-semibold">Share of budget</th>
              <th scope="col" className="px-4 py-3 text-right font-semibold">Per guest</th>
            </tr>
          </thead>
          <tbody>
            {budget.lines.map((l) => (
              <tr key={l.id} className="border-b border-line last:border-0">
                <th scope="row" className="px-4 py-3 font-semibold">{l.label}</th>
                <td className="px-4 py-3">
                  {l.id === "buffer" ? <Badge>Fixed</Badge> : <Badge tone={PRIORITY_TONE[l.priority]}>{PRIORITY_LABEL[l.priority]}</Badge>}
                </td>
                <td className="num px-4 py-3 text-right font-bold">{formatINR(l.amount)}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div aria-hidden="true" className="h-2 w-28 rounded bg-line">
                      <div className="h-2 rounded bg-plum" style={{ width: `${Math.min(100, pct(l.share))}%` }} />
                    </div>
                    <span className="num text-sm">{pct(l.share)}%</span>
                  </div>
                </td>
                <td className="num px-4 py-3 text-right">{formatINR(l.perGuest)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>
    </div>
  );
}

export default function BudgetView() {
  return <PlanGate>{({ plan, derived }) => <BudgetBody plan={plan} budget={derived.budget} />}</PlanGate>;
}
