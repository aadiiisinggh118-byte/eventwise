"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { usePlan } from "./PlanProvider";
import { Field, Notice, PageHeading, Panel, btnPrimary, inputCls } from "./ui";
import { OCCASIONS, CATEGORIES, adjustableCategoryIds } from "../lib/occasions";
import { validatePlanInput, toInt } from "../lib/validate";
import { formatCompactINR } from "../lib/money";

const PRIORITY_OPTIONS = [["high", "Spend more"], ["normal", "Normal"], ["low", "Spend less"]];

export default function SetupForm() {
  const { ready, today, plan, setPlan } = usePlan();
  const router = useRouter();
  const [occasion, setOccasion] = useState("wedding");
  const [total, setTotal] = useState("");
  const [guests, setGuests] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [priorities, setPriorities] = useState({});
  const [errors, setErrors] = useState({});

  if (!ready) return <p role="status" className="text-ink-soft">Loading…</p>;

  const totalNum = toInt(total);

  function submit(e) {
    e.preventDefault();
    const v = validatePlanInput({ occasion, total, guests, eventDate, priorities }, today);
    if (!v.ok) {
      setErrors(v.errors);
      return;
    }
    setErrors({});
    setPlan({ ...v.value, preferences: plan?.preferences || {} });
    router.push("/plan/budget");
  }

  return (
    <div>
      <PageHeading title="Set up your event">
        Four answers are enough to start. You can change any of them later without losing your progress.
      </PageHeading>

      {plan && (
        <div className="mb-6">
          <Notice>
            You already have a plan. Building a new one here replaces it. To revise the budget, guests or date and keep your progress, use{" "}
            <Link href="/plan/changes" className="underline">Changes</Link>.
          </Notice>
        </div>
      )}

      <form onSubmit={submit} noValidate className="space-y-8">
        {Object.keys(errors).length > 0 && (
          <Notice tone="bad" role="alert">Some answers need fixing. They are marked below.</Notice>
        )}

        <fieldset>
          <legend className="mb-2 font-semibold">What are you planning?</legend>
          <div className="grid gap-3 sm:grid-cols-3">
            {Object.entries(OCCASIONS).map(([key, occ]) => (
              <label key={key} className="cursor-pointer rounded-lg border border-edge bg-white p-4 has-[:checked]:border-plum has-[:checked]:bg-info-bg has-[:checked]:ring-2 has-[:checked]:ring-plum">
                <input
                  type="radio" name="occasion" value={key} checked={occasion === key}
                  onChange={() => { setOccasion(key); setPriorities({}); }}
                  className="mr-2"
                />
                <span className="font-bold">{occ.label}</span>
                <span className="mt-1 block text-sm text-ink-soft">{occ.blurb}</span>
              </label>
            ))}
          </div>
          {errors.occasion && <p className="mt-1 text-sm font-semibold text-bad">{errors.occasion}</p>}
        </fieldset>

        <Panel>
          <div className="grid gap-5 sm:grid-cols-3">
            <Field id="setup-total" label="Total budget (₹)" hint={totalNum ? `That is ${formatCompactINR(totalNum)}.` : "For example 8,00,000"} error={errors.total}>
              {(p) => <input {...p} type="text" inputMode="numeric" autoComplete="off" value={total} onChange={(e) => setTotal(e.target.value)} className={inputCls} />}
            </Field>
            <Field id="setup-guests" label="Number of guests" error={errors.guests}>
              {(p) => <input {...p} type="text" inputMode="numeric" autoComplete="off" value={guests} onChange={(e) => setGuests(e.target.value)} className={inputCls} />}
            </Field>
            <Field id="setup-date" label="Event date" error={errors.eventDate}>
              {(p) => <input {...p} type="date" min={today} value={eventDate} onChange={(e) => setEventDate(e.target.value)} className={inputCls} />}
            </Field>
          </div>
        </Panel>

        <fieldset>
          <legend className="font-semibold">What matters most to you?</legend>
          <p className="mb-3 text-sm text-ink-soft">Money shifts toward what you mark &ldquo;Spend more&rdquo; and away from &ldquo;Spend less&rdquo;. Leave everything on Normal if unsure.</p>
          <div className="grid gap-4 sm:grid-cols-2">
            {adjustableCategoryIds(occasion).map((id) => (
              <Field key={id} id={`setup-priority-${id}`} label={CATEGORIES[id].label}>
                {(p) => (
                  <select {...p} value={priorities[id] || "normal"} onChange={(e) => setPriorities((s) => ({ ...s, [id]: e.target.value }))} className={inputCls}>
                    {PRIORITY_OPTIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                )}
              </Field>
            ))}
          </div>
        </fieldset>

        <button type="submit" className={btnPrimary}>Build my plan</button>
      </form>
    </div>
  );
}
