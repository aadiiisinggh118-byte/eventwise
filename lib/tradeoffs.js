const { allocateByWeights } = require("./money");

// How far each priority tier may be cut, as a share of its expected cost.
const CUT_LIMIT = { low: 0.5, normal: 0.25, high: 0 };
const sum = (xs) => xs.reduce((a, b) => a + b, 0);

function makeOption(id, title, summary, lines, to, total, guests) {
  const spend = sum(to);
  return {
    id,
    title,
    summary,
    rows: lines.map((l, i) => ({ id: l.id, label: l.label, priority: l.priority, from: l.expected, to: to[i], delta: to[i] - l.expected })),
    guests,
    shortfall: Math.max(0, spend - total),
    buffer: Math.max(0, total - spend),
    fits: spend <= total,
  };
}

function protectOption(lines, total, gap) {
  const to = lines.map((l) => l.expected);
  let remaining = gap;
  for (const tier of ["low", "normal", "high"]) {
    if (remaining <= 0) break;
    const idx = lines.map((_, i) => i).filter((i) => lines[i].priority === tier);
    const caps = idx.map((i) => Math.floor(lines[i].expected * CUT_LIMIT[tier]));
    const capTotal = sum(caps);
    if (capTotal === 0) continue;
    const take = Math.min(remaining, capTotal);
    allocateByWeights(take, caps).forEach((cut, k) => { to[idx[k]] -= cut; });
    remaining -= take;
  }
  return makeOption("protect", "Protect your priorities", "Cuts come from lower-priority categories first. High-priority categories are never cut.", lines, to, total, null);
}

function evenOption(lines, total, gap) {
  const cuts = allocateByWeights(gap, lines.map((l) => l.expected));
  return makeOption("even", "Spread the cut evenly", "Every category shrinks by the same share, so nothing is sacrificed more than the rest.", lines, lines.map((l, i) => l.expected - cuts[i]), total, null);
}

function guestsOption(lines, total, gap, guests) {
  const perGuestCost = sum(lines.filter((l) => l.guestDriven).map((l) => l.expected)) / guests;
  if (!(perGuestCost > 0)) return null;
  const scaled = (n) => lines.map((l) => (l.guestDriven ? Math.round((l.expected * n) / guests) : l.expected));
  let newGuests = guests - Math.ceil(gap / perGuestCost);
  while (newGuests >= 1 && sum(scaled(newGuests)) > total) newGuests -= 1; // rounding safety
  if (newGuests < 1) return null;
  const removed = guests - newGuests;
  return makeOption("guests", "Invite fewer guests", `Invite ${removed} fewer guest${removed === 1 ? "" : "s"}. Costs that scale with headcount (like catering) shrink with it.`, lines, scaled(newGuests), total, { from: guests, to: newGuests });
}

/**
 * "Costs are running N% over." Given the current budget, works out how far
 * over we are and builds up to three concrete ways to get back inside it.
 * Pure arithmetic: the AI only explains these options, it never invents them.
 */
function closeGap(budget, overPct) {
  // Scale the plan by (1 + pct) and spread the rounding with the same largest-remainder
  // method as the budget itself, so the expected total is exactly budget x (1 + pct)
  // (e.g. ₹10,00,000 at 20% is ₹12,00,000, not ₹11,99,999 from per-line rounding).
  const expectedTotal = Math.round(budget.allocated * (1 + overPct / 100));
  const expected = allocateByWeights(expectedTotal, budget.lines.map((l) => l.amount));
  const lines = budget.lines.map((l, i) => ({ ...l, expected: expected[i] }));
  const gap = Math.max(0, expectedTotal - budget.total);
  if (gap === 0) return { overPct, expectedTotal, gap, options: [] };
  const options = [
    protectOption(lines, budget.total, gap),
    evenOption(lines, budget.total, gap),
    guestsOption(lines, budget.total, gap, budget.guests),
  ].filter(Boolean);
  return { overPct, expectedTotal, gap, options };
}

module.exports = { closeGap, CUT_LIMIT };
