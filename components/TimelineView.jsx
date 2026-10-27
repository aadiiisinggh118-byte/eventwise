"use client";

import { PlanGate } from "./PlanProvider";
import { Badge, Notice, PageHeading, Panel, inputCls } from "./ui";
import { PHASES } from "../lib/timeline";
import { formatDate } from "../lib/dates";

const STATUS = { done: ["ok", "Done"], overdue: ["bad", "Overdue"], "due-soon": ["warn", "Due soon"], upcoming: ["info", "Upcoming"] };
const DELAY_CHOICES = [0, 3, 7, 14, 30];

function when(days) {
  if (days === 0) return "today";
  return days > 0 ? `in ${days} day${days === 1 ? "" : "s"}` : `${-days} day${days === -1 ? "" : "s"} ago`;
}

function TaskRow({ task, setPlan }) {
  const [tone, label] = STATUS[task.status];
  const choices = DELAY_CHOICES.includes(task.delay) ? DELAY_CHOICES : [...DELAY_CHOICES, task.delay].sort((a, b) => a - b);

  const toggle = (checked) => setPlan((p) => ({ ...p, done: checked ? [...new Set([...p.done, task.id])] : p.done.filter((x) => x !== task.id) }));
  const delay = (days) => setPlan((p) => {
    const delays = { ...p.delays };
    if (days > 0) delays[task.id] = days; else delete delays[task.id];
    return { ...p, delays };
  });

  return (
    <li className="flex flex-wrap items-start gap-x-4 gap-y-2 border-b border-line py-3 last:border-0">
      <div className="flex min-w-[14rem] flex-1 items-start gap-3">
        <input id={`done-${task.id}`} type="checkbox" checked={task.done} onChange={(e) => toggle(e.target.checked)} className="mt-1.5 h-4 w-4" />
        <div>
          <label htmlFor={`done-${task.id}`} className={`font-semibold ${task.done ? "text-ink-soft line-through" : ""}`}>{task.title}</label>
          <p className="text-sm text-ink-soft">
            {task.categoryLabel ? `${task.categoryLabel}. ` : ""}Due {formatDate(task.dueDate)}{!task.done && ` (${when(task.daysUntilDue)})`}
          </p>
          {task.pushed && <p className="mt-1 text-sm font-semibold text-warn">Pushed later because a task it depends on is delayed.</p>}
          {task.afterEvent && !task.done && <p className="mt-1 text-sm font-semibold text-bad">Now falls after the event date.</p>}
          {task.blockedBy.length > 0 && <p className="mt-1 text-sm text-ink-soft">Waiting on: {task.blockedBy.join(", ")}.</p>}
        </div>
      </div>
      <Badge tone={tone}>{label}</Badge>
      {!task.done && (
        <div>
          <label htmlFor={`delay-${task.id}`} className="sr-only">Delay for {task.title}</label>
          <select id={`delay-${task.id}`} value={task.delay} onChange={(e) => delay(Number(e.target.value))} className={`${inputCls} !w-auto py-1.5 text-sm`}>
            {choices.map((d) => <option key={d} value={d}>{d === 0 ? "On schedule" : `Delayed ${d} days`}</option>)}
          </select>
        </div>
      )}
    </li>
  );
}

function TimelineBody({ tl, setPlan }) {
  const groups = PHASES.map((phase) => ({ phase, tasks: tl.tasks.filter((t) => t.phase === phase).sort((a, b) => (a.dueDate < b.dueDate ? -1 : a.dueDate > b.dueDate ? 1 : 0)) })).filter((g) => g.tasks.length);

  return (
    <div>
      <PageHeading title="Your timeline">
        Tasks are dated backwards from the event. Tick them off, or mark one as delayed to see which other tasks it pushes.
      </PageHeading>

      {tl.compressed && (
        <div className="mb-6">
          <Notice tone="warn">
            Only {Math.max(tl.daysOut, 0)} days remain, against the usual {tl.leadDays} for this kind of event. Every date has been pulled closer together, in the same order. Book the first tasks now.
          </Notice>
        </div>
      )}

      <dl className="mb-8 grid grid-cols-2 divide-x divide-y divide-line overflow-hidden rounded-lg border border-line bg-surface sm:grid-cols-4 sm:divide-y-0">
        {[
          ["Days to go", tl.daysOut >= 0 ? String(tl.daysOut) : "Past"],
          ["Done", `${tl.counts.done} of ${tl.counts.total}`],
          ["Overdue", String(tl.counts.overdue)],
          ["Due this week", String(tl.counts.dueSoon)],
        ].map(([label, value]) => (
          <div key={label} className="p-4">
            <dt className="text-sm text-ink-soft">{label}</dt>
            <dd className="num mt-1 text-2xl font-extrabold">{value}</dd>
          </div>
        ))}
      </dl>

      {tl.nextUp.length > 0 && (
        <Panel className="mb-8" aria-labelledby="next-up-heading">
          <h2 id="next-up-heading" className="text-xl">Do these next</h2>
          <ul className="mt-2 list-disc pl-5">
            {tl.nextUp.map((t) => <li key={t.id}>{t.title}, due {formatDate(t.dueDate)}</li>)}
          </ul>
        </Panel>
      )}

      <div className="space-y-8">
        {groups.map((g) => (
          <section key={g.phase} aria-labelledby={`phase-${g.phase.replace(/\W+/g, "-")}`}>
            <h2 id={`phase-${g.phase.replace(/\W+/g, "-")}`} className="mb-1 text-xl">{g.phase}</h2>
            <Panel className="!py-1">
              <ul className="m-0 list-none p-0">{g.tasks.map((t) => <TaskRow key={t.id} task={t} setPlan={setPlan} />)}</ul>
            </Panel>
          </section>
        ))}
      </div>
    </div>
  );
}

export default function TimelineView() {
  return <PlanGate>{({ derived, setPlan }) => <TimelineBody tl={derived.timeline} setPlan={setPlan} />}</PlanGate>;
}
