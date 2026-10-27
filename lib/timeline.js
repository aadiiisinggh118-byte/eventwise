const { OCCASIONS, CATEGORIES } = require("./occasions");
const { addDays, daysBetween } = require("./dates");

const PHASES = ["8+ weeks before", "4 to 7 weeks before", "1 to 3 weeks before", "Final week", "Event day", "After the event"];

function phaseOf(daysBefore) {
  if (daysBefore < 0) return PHASES[5];
  if (daysBefore === 0) return PHASES[4];
  if (daysBefore <= 7) return PHASES[3];
  if (daysBefore <= 27) return PHASES[2];
  if (daysBefore <= 55) return PHASES[1];
  return PHASES[0];
}

/**
 * Turns an event date into a dated, dependency-aware task list.
 *  - Tasks are scheduled backwards from the event date.
 *  - If less time remains than the template assumes, every offset is scaled
 *    down proportionally (order is preserved) instead of failing.
 *  - A delayed task pushes later any task that depends on it, and the result
 *    names which tasks were pushed. Done prerequisites never push anything.
 */
function buildTimeline({ occasion, eventDate, today, done = [], delays = {} }) {
  const occ = OCCASIONS[occasion];
  const doneSet = new Set(done);
  const daysOut = daysBetween(today, eventDate);
  const scale = daysOut >= occ.leadDays ? 1 : Math.max(daysOut, 0) / occ.leadDays;
  const byId = new Map();
  const tasks = [];

  for (const tpl of occ.tasks) {
    const baseDue = addDays(eventDate, -Math.round(tpl.offsetDays * scale));
    const delay = delays[tpl.id] || 0;
    let dueDate = addDays(baseDue, delay);
    for (const dep of tpl.dependsOn) {
      const d = byId.get(dep);
      if (!d.done && d.dueDate > dueDate) dueDate = d.dueDate; // ISO dates sort as strings
    }
    const isDone = doneSet.has(tpl.id);
    const daysUntilDue = daysBetween(today, dueDate);
    const task = {
      id: tpl.id,
      title: tpl.title,
      category: tpl.category,
      categoryLabel: tpl.category ? CATEGORIES[tpl.category].label : null,
      dependsOn: tpl.dependsOn,
      baseDue,
      dueDate,
      delay,
      done: isDone,
      pushed: !isDone && delay === 0 && dueDate > baseDue,
      afterEvent: dueDate > eventDate,
      daysUntilDue,
      status: isDone ? "done" : daysUntilDue < 0 ? "overdue" : daysUntilDue <= 7 ? "due-soon" : "upcoming",
      phase: phaseOf(daysBetween(dueDate, eventDate)),
      blockedBy: isDone ? [] : tpl.dependsOn.filter((id) => !byId.get(id).done).map((id) => byId.get(id).title),
    };
    byId.set(tpl.id, task);
    tasks.push(task);
  }

  const count = (s) => tasks.filter((x) => x.status === s).length;
  return {
    tasks,
    daysOut,
    leadDays: occ.leadDays,
    compressed: scale < 1,
    counts: { total: tasks.length, done: count("done"), overdue: count("overdue"), dueSoon: count("due-soon"), upcoming: count("upcoming") },
    nextUp: tasks.filter((x) => !x.done).sort((a, b) => (a.dueDate < b.dueDate ? -1 : a.dueDate > b.dueDate ? 1 : 0)).slice(0, 3),
  };
}

/** Tasks whose date moved between two timelines, plus any that became overdue. */
function diffTimelines(a, b) {
  const before = new Map(a.tasks.map((t) => [t.id, t]));
  const moved = b.tasks
    .filter((t) => before.get(t.id) && before.get(t.id).dueDate !== t.dueDate)
    .map((t) => ({ id: t.id, title: t.title, from: before.get(t.id).dueDate, to: t.dueDate }));
  const newlyOverdue = b.tasks.filter((t) => t.status === "overdue" && before.get(t.id)?.status !== "overdue");
  return { moved, newlyOverdue };
}

module.exports = { buildTimeline, diffTimelines, phaseOf, PHASES };
