"use client";

import Link from "next/link";
import { useState } from "react";
import { usePathname } from "next/navigation";
import { usePlan } from "./PlanProvider";
import { OCCASIONS } from "../lib/occasions";
import { formatCompactINR } from "../lib/money";
import { formatDate } from "../lib/dates";
import { btnGhost } from "./ui";

const LINKS = [
  { href: "/plan", label: "Setup" },
  { href: "/plan/budget", label: "Budget" },
  { href: "/plan/timeline", label: "Timeline" },
  { href: "/plan/vendors", label: "Vendors" },
  { href: "/plan/ideas", label: "Ideas" },
  { href: "/plan/changes", label: "Changes" },
];

export default function PlanShell({ children }) {
  const pathname = usePathname();
  const { plan, derived, reset } = usePlan();
  const [confirming, setConfirming] = useState(false);
  const daysOut = derived?.timeline.daysOut;

  return (
    <div className="mx-auto max-w-page px-5 py-8">
      {plan && derived && (
        <div className="on-dark mb-6 flex flex-wrap items-end justify-between gap-4 rounded-lg bg-plum p-5 text-white">
          <div>
            <p className="text-on-dark">{OCCASIONS[plan.occasion].label} on {formatDate(plan.eventDate)}</p>
            <p className="num text-3xl font-extrabold">
              {formatCompactINR(plan.total)} <span className="text-lg font-semibold text-on-dark">for {plan.guests} guests</span>
            </p>
          </div>
          <p className="text-right">
            <span className="num block text-3xl font-extrabold text-marigold">{daysOut >= 0 ? daysOut : "Past"}</span>
            <span className="text-sm text-on-dark">{daysOut >= 0 ? "days to go" : "event date has passed"}</span>
          </p>
        </div>
      )}

      <nav aria-label="Plan sections" className="mb-8 border-b border-line">
        <ul className="m-0 flex list-none gap-1 overflow-x-auto p-0">
          {LINKS.map((l) => {
            const active = pathname === l.href;
            return (
              <li key={l.href}>
                <Link
                  href={l.href}
                  aria-current={active ? "page" : undefined}
                  className={`block whitespace-nowrap border-b-4 px-4 py-3 ${active ? "border-marigold font-bold text-plum" : "border-transparent font-medium text-ink-soft hover:text-plum"}`}
                >
                  {l.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {children}

      {plan && (
        <div className="mt-12 border-t border-line pt-4 text-sm">
          {confirming ? (
            <p className="flex flex-wrap items-center gap-3">
              <span>This deletes your plan from this browser.</span>
              <button type="button" className={btnGhost} onClick={() => { reset(); setConfirming(false); }}>Yes, clear it</button>
              <button type="button" className={btnGhost} onClick={() => setConfirming(false)}>Keep it</button>
            </p>
          ) : (
            <button type="button" className="font-semibold text-ink-soft underline" onClick={() => setConfirming(true)}>Clear my plan</button>
          )}
        </div>
      )}
    </div>
  );
}
