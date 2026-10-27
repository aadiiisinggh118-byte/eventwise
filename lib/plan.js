const { buildBudget, diffBudgets } = require("./budget");
const { buildTimeline, diffTimelines } = require("./timeline");
const { daysBetween } = require("./dates");
const { formatINR } = require("./money");

/** The whole plan, derived from the saved inputs. Pure, instant, no network. */
function computePlan(plan, today) {
  return {
    budget: buildBudget(plan),
    timeline: buildTimeline({ occasion: plan.occasion, eventDate: plan.eventDate, today, done: plan.done, delays: plan.delays }),
  };
}

/** Everything that changes between two (plan, derived) pairs. */
function diffPlans(before, after) {
  const budget = diffBudgets(before.derived.budget, after.derived.budget);
  const timeline = diffTimelines(before.derived.timeline, after.derived.timeline);
  return {
    budget,
    timeline,
    dateShiftDays: daysBetween(before.plan.eventDate, after.plan.eventDate),
    newlyCompressed: !before.derived.timeline.compressed && after.derived.timeline.compressed,
    daysOut: after.derived.timeline.daysOut,
    leadDays: after.derived.timeline.leadDays,
  };
}

/** Plain-English list of what a change does. Deterministic, so it works instantly and offline. */
function describeChanges(diff) {
  const out = [];
  const { budget, timeline } = diff;
  if (budget.totalDelta) out.push(`Budget ${budget.totalDelta < 0 ? "decreases" : "increases"} by ${formatINR(Math.abs(budget.totalDelta))}.`);
  if (budget.guestsDelta) out.push(`Guest count ${budget.guestsDelta < 0 ? "drops" : "rises"} by ${Math.abs(budget.guestsDelta)}.`);
  if (diff.dateShiftDays) out.push(`The event moves ${Math.abs(diff.dateShiftDays)} day${Math.abs(diff.dateShiftDays) === 1 ? "" : "s"} ${diff.dateShiftDays < 0 ? "earlier" : "later"}.`);
  if (budget.lines.length) {
    const biggest = [...budget.lines].sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))[0];
    out.push(`${budget.lines.length} budget ${budget.lines.length === 1 ? "category changes" : "categories change"}; the biggest is ${biggest.label} (${biggest.delta < 0 ? "-" : "+"}${formatINR(Math.abs(biggest.delta))}).`);
  }
  if (timeline.moved.length) out.push(`${timeline.moved.length} task date${timeline.moved.length === 1 ? "" : "s"} move.`);
  if (timeline.newlyOverdue.length) out.push(`${timeline.newlyOverdue.length} task${timeline.newlyOverdue.length === 1 ? " becomes" : "s become"} overdue.`);
  if (diff.newlyCompressed) out.push(`The timeline is now compressed: ${Math.max(diff.daysOut, 0)} days remain against the usual ${diff.leadDays}, so every task date is pulled closer together.`);
  return out;
}

module.exports = { computePlan, diffPlans, describeChanges };
