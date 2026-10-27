const { OCCASIONS, CATEGORIES } = require("./occasions");
const { allocateByWeights } = require("./money");

const PRIORITY_MULTIPLIER = { high: 1.5, normal: 1, low: 0.6 };
const sum = (xs) => xs.reduce((a, b) => a + b, 0);

/** Returns the overrides map only if it is complete, valid and fits the total. */
function normalizeOverrides(occasion, total, overrides) {
  if (!overrides || typeof overrides !== "object") return null;
  let used = 0;
  for (const { id } of OCCASIONS[occasion].categories) {
    const v = overrides[id];
    if (!Number.isInteger(v) || v < 0) return null;
    used += v;
  }
  return used <= total ? overrides : null;
}

/**
 * Splits a budget across the occasion's categories by weight, scaled by the
 * user's priorities. Amounts are integers that sum exactly to the total
 * (or, when a trade-off was applied, to at most the total).
 * These are shares of the user's own money. They are NOT price predictions.
 */
function buildBudget({ occasion, total, guests, priorities = {}, overrides = null }) {
  const occ = OCCASIONS[occasion];
  const rows = occ.categories.map((c) => {
    const def = CATEGORIES[c.id];
    const priority = def.adjustable === false ? "normal" : priorities[c.id] || "normal";
    return { id: c.id, label: def.label, guestDriven: def.perGuest, priority, weight: c.weight };
  });

  const fixed = normalizeOverrides(occasion, total, overrides);
  const amounts = fixed
    ? rows.map((r) => fixed[r.id])
    : allocateByWeights(total, rows.map((r) => r.weight * PRIORITY_MULTIPLIER[r.priority]));

  const allocated = sum(amounts);
  const perGuest = Math.round(total / guests);
  return {
    total,
    guests,
    allocated,
    unallocated: total - allocated,
    perGuest,
    minPerGuest: occ.minPerGuest,
    tight: perGuest < occ.minPerGuest,
    adjusted: Boolean(fixed),
    lines: rows.map((r, i) => ({
      id: r.id,
      label: r.label,
      priority: r.priority,
      guestDriven: r.guestDriven,
      amount: amounts[i],
      share: total ? amounts[i] / total : 0,
      perGuest: Math.round(amounts[i] / guests),
    })),
  };
}

/** What changed between two budgets (used for the "what changed and why" panel). */
function diffBudgets(a, b) {
  const before = new Map(a.lines.map((l) => [l.id, l]));
  return {
    totalDelta: b.total - a.total,
    guestsDelta: b.guests - a.guests,
    lines: b.lines
      .map((l) => ({ id: l.id, label: l.label, from: before.get(l.id)?.amount ?? 0, to: l.amount, delta: l.amount - (before.get(l.id)?.amount ?? 0) }))
      .filter((l) => l.delta !== 0),
  };
}

module.exports = { buildBudget, diffBudgets, normalizeOverrides, PRIORITY_MULTIPLIER };
