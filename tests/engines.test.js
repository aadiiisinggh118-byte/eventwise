const { OCCASIONS, CATEGORIES, adjustableCategoryIds } = require("../lib/occasions");
const { buildBudget, diffBudgets } = require("../lib/budget");
const { buildTimeline, diffTimelines } = require("../lib/timeline");
const { closeGap } = require("../lib/tradeoffs");
const { vendorGuide, compareQuotes } = require("../lib/vendors");
const { computePlan, diffPlans, describeChanges } = require("../lib/plan");
const { addDays, daysBetween } = require("../lib/dates");

const TODAY = "2026-10-24";
const wedding = { occasion: "wedding", total: 800000, guests: 200, priorities: {}, overrides: null };

describe("occasion data integrity", () => {
  it.each(Object.keys(OCCASIONS))("%s: weights, categories and task graph are consistent", (key) => {
    const occ = OCCASIONS[key];
    expect(occ.categories.reduce((a, c) => a + c.weight, 0)).toBe(100);
    const catIds = new Set(occ.categories.map((c) => c.id));
    catIds.forEach((id) => expect(CATEGORIES[id]).toBeDefined());
    const index = new Map(occ.tasks.map((t, i) => [t.id, i]));
    expect(index.size).toBe(occ.tasks.length); // unique ids
    occ.tasks.forEach((task, i) => {
      if (task.category) expect(catIds.has(task.category)).toBe(true);
      expect(task.offsetDays).toBeLessThanOrEqual(occ.leadDays);
      task.dependsOn.forEach((dep) => {
        expect(index.get(dep)).toBeLessThan(i); // prerequisites listed first (also rules out cycles)
        expect(occ.tasks[index.get(dep)].offsetDays).toBeGreaterThanOrEqual(task.offsetDays);
      });
    });
  });
});

describe("buildBudget", () => {
  it("splits an 8 lakh wedding exactly by the template", () => {
    const b = buildBudget(wedding);
    expect(Object.fromEntries(b.lines.map((l) => [l.id, l.amount]))).toEqual({
      venue: 176000, catering: 240000, decor: 96000, photography: 64000, attire: 96000, entertainment: 40000, logistics: 40000, buffer: 48000,
    });
    expect(b.allocated).toBe(800000);
    expect(b.perGuest).toBe(4000);
    expect(b.tight).toBe(false);
  });
  it("priorities shift money but the total stays exact; the buffer can't be prioritised", () => {
    const b = buildBudget({ ...wedding, priorities: { decor: "high", photography: "low" } });
    const base = buildBudget(wedding);
    const get = (x, id) => x.lines.find((l) => l.id === id).amount;
    expect(get(b, "decor")).toBeGreaterThan(get(base, "decor"));
    expect(get(b, "photography")).toBeLessThan(get(base, "photography"));
    expect(b.allocated).toBe(800000);
    expect(adjustableCategoryIds("wedding")).not.toContain("buffer");
  });
  it("flags a budget below the per-guest assumption", () => {
    expect(buildBudget({ ...wedding, total: 300000 }).tight).toBe(true);
  });
  it("uses a complete, valid overrides map and ignores an invalid one", () => {
    const base = buildBudget(wedding);
    const fixed = Object.fromEntries(base.lines.map((l) => [l.id, l.amount - 1000]));
    const adj = buildBudget({ ...wedding, overrides: fixed });
    expect(adj.adjusted).toBe(true);
    expect(adj.unallocated).toBe(8000);
    expect(buildBudget({ ...wedding, overrides: { venue: 1 } }).adjusted).toBe(false);
    expect(buildBudget({ ...wedding, overrides: { ...fixed, venue: 9999999 } }).adjusted).toBe(false);
  });
  it("diffBudgets reports only the categories that changed", () => {
    const d = diffBudgets(buildBudget(wedding), buildBudget({ ...wedding, total: 600000 }));
    expect(d.totalDelta).toBe(-200000);
    expect(d.lines.length).toBe(8);
  });
});

describe("buildTimeline", () => {
  const eventDate = "2027-02-21"; // exactly 120 days after TODAY = the wedding lead time
  const run = (extra = {}, ev = eventDate) => buildTimeline({ occasion: "wedding", eventDate: ev, today: TODAY, ...extra });

  it("schedules backwards from the event with no compression when time is enough", () => {
    const tl = run();
    expect(tl.compressed).toBe(false);
    expect(tl.tasks.find((t) => t.id === "w-venue").dueDate).toBe(addDays(eventDate, -105));
    expect(tl.tasks.find((t) => t.id === "w-budget").dueDate).toBe(TODAY);
  });
  it("compresses proportionally when the event is closer than the lead time, keeping order and staying in range", () => {
    const ev = addDays(TODAY, 45);
    const tl = run({}, ev);
    expect(tl.compressed).toBe(true);
    tl.tasks.forEach((t) => {
      expect(t.dueDate >= TODAY && t.dueDate <= ev).toBe(true);
      t.dependsOn.forEach((dep) => expect(tl.tasks.find((x) => x.id === dep).dueDate <= t.dueDate).toBe(true));
      expect(t.status).not.toBe("overdue");
    });
  });
  it("a delayed task pushes the tasks that depend on it, and names them", () => {
    const tl = run({ delays: { "w-venue": 20 } });
    const venue = tl.tasks.find((t) => t.id === "w-venue");
    const caterer = tl.tasks.find((t) => t.id === "w-caterer");
    expect(venue.dueDate).toBe(addDays(eventDate, -85));
    expect(caterer.dueDate).toBe(venue.dueDate);
    expect(caterer.pushed).toBe(true);
    expect(tl.tasks.find((t) => t.id === "w-guestlist").pushed).toBe(false);
    expect(tl.tasks.find((t) => t.id === "w-decor").pushed).toBe(false); // already later than the venue
  });
  it("a finished prerequisite never pushes anything, and blockers are listed for the rest", () => {
    const tl = run({ delays: { "w-venue": 20 }, done: ["w-venue"] });
    expect(tl.tasks.find((t) => t.id === "w-caterer").pushed).toBe(false);
    expect(tl.tasks.find((t) => t.id === "w-caterer").blockedBy).toEqual(["Draft the guest list"]);
  });
  it("derives statuses and counts", () => {
    const tl = run({ done: ["w-budget"] });
    expect(tl.counts.done).toBe(1);
    expect(tl.counts.total).toBe(OCCASIONS.wedding.tasks.length);
    expect(tl.nextUp).toHaveLength(3);
    expect(run({}, addDays(TODAY, 3)).tasks.some((t) => t.status === "due-soon")).toBe(true);
  });
  it("diffTimelines reports moved tasks when the event moves earlier", () => {
    const d = diffTimelines(run(), run({}, addDays(eventDate, -14)));
    // The first task stays anchored to today when time compresses; every later task moves.
    expect(d.moved.length).toBe(OCCASIONS.wedding.tasks.length - 1);
    expect(d.moved.map((m) => m.id)).not.toContain("w-budget");
    d.moved.forEach((m) => expect(m.to < m.from).toBe(true));
  });
});

describe("closeGap (costs running over)", () => {
  const budget = buildBudget(wedding);
  const gap = closeGap(budget, 20);

  it("computes the gap from the inflated costs", () => {
    expect(gap.expectedTotal).toBe(960000);
    expect(gap.gap).toBe(160000);
    expect(gap.options.map((o) => o.id)).toEqual(["protect", "even", "guests"]);
  });
  it("every option that fits lands at or under the budget, with consistent arithmetic", () => {
    gap.options.forEach((o) => {
      const spend = o.rows.reduce((a, r) => a + r.to, 0);
      expect(o.fits).toBe(spend <= 800000);
      expect(o.shortfall).toBe(Math.max(0, spend - 800000));
      expect(o.buffer).toBe(Math.max(0, 800000 - spend));
      o.rows.forEach((r) => expect(r.to).toBeGreaterThanOrEqual(0));
    });
    expect(gap.options.find((o) => o.id === "even").shortfall).toBe(0);
    expect(gap.options.find((o) => o.id === "guests").guests).toEqual({ from: 200, to: 104 });
  });
  it("'protect' never cuts a high-priority category and respects each tier's limit", () => {
    const b = buildBudget({ ...wedding, priorities: { catering: "high", venue: "low" } });
    const o = closeGap(b, 20).options.find((x) => x.id === "protect");
    expect(o.rows.find((r) => r.id === "catering").delta).toBe(0);
    const venue = o.rows.find((r) => r.id === "venue");
    expect(venue.to).toBeGreaterThanOrEqual(Math.ceil(venue.from * 0.5));
    expect(o.fits).toBe(true);
  });
  it("reports a shortfall instead of pretending when protected categories can't absorb the gap", () => {
    const allHigh = Object.fromEntries(adjustableCategoryIds("wedding").map((id) => [id, "high"]));
    const o = closeGap(buildBudget({ ...wedding, priorities: allHigh }), 20).options.find((x) => x.id === "protect");
    expect(o.fits).toBe(false);
    expect(o.shortfall).toBeGreaterThan(0);
  });
  it("the over-budget total is exactly budget x (1 + pct), with no rounding drift (a bug seen in manual testing)", () => {
    const priorities = { venue: "high", catering: "high", logistics: "high", entertainment: "low" };
    const g = closeGap(buildBudget({ ...wedding, total: 1000000, priorities }), 20);
    expect(g.expectedTotal).toBe(1200000); // was 11,99,999 when each line was rounded separately
    expect(g.gap).toBe(200000);
    for (const pct of [1, 7, 13, 20, 33, 50, 100]) {
      for (const total of [5000, 123457, 999999, 1000000, 50000000]) {
        const r = closeGap(buildBudget({ ...wedding, total, priorities }), pct);
        expect(r.expectedTotal).toBe(Math.round(total * (1 + pct / 100)));
        expect(r.options.every((o) => o.rows.reduce((a, x) => a + x.from, 0) === r.expectedTotal)).toBe(true);
      }
    }
  });
  it("returns no options when nothing is over", () => {
    expect(closeGap(budget, 0).options).toEqual([]);
  });
});

describe("vendors", () => {
  it("builds a checklist for every category that has a guide (not the buffer)", () => {
    const g = vendorGuide(buildBudget(wedding));
    expect(g.map((x) => x.id)).not.toContain("buffer");
    g.forEach((x) => { expect(x.needs.length).toBeGreaterThan(0); expect(x.ask.length).toBeGreaterThan(0); });
  });
  it("compares quotes with all-in cost, per-guest cost and what is not stated, without picking a winner", () => {
    const r = compareQuotes(
      [
        { name: "A", price: 200000, guestsCovered: 150, extra: 20000, taxes: "yes", setup: "unknown", cancellation: "no" },
        { name: "B", price: 230000, guestsCovered: 200, extra: 0, taxes: "unknown", setup: "yes", cancellation: "yes" },
      ],
      { guests: 200, categoryAmount: 240000 }
    );
    expect(r.rows[0]).toMatchObject({ allIn: 220000, perGuest: 1467, coversAllGuests: false, vsBudget: -20000 });
    expect(r.rows[0].notStated).toEqual(["Setup and cleanup included"]);
    expect(r.rows[0].notIncluded).toEqual(["Cancellation terms in writing"]);
    expect(r.rows[1].coversAllGuests).toBe(true);
    expect(r.lowestAllInIndex).toBe(0);
  });
});

describe("computePlan / diffPlans / describeChanges (the re-plan engine)", () => {
  const plan = { ...wedding, eventDate: "2027-02-21", done: [], delays: {}, preferences: {} };
  const before = { plan, derived: computePlan(plan, TODAY) };

  it("re-plans for a smaller budget, fewer guests and an earlier date, and says what changed", () => {
    const next = { ...plan, total: 640000, guests: 150, eventDate: addDays(TODAY, 60) };
    const after = { plan: next, derived: computePlan(next, TODAY) };
    const facts = describeChanges(diffPlans(before, after));
    expect(facts.join(" ")).toMatch(/Budget decreases by ₹1,60,000/);
    expect(facts.join(" ")).toMatch(/Guest count drops by 50/);
    expect(facts.join(" ")).toMatch(/moves 60 days earlier/);
    expect(facts.join(" ")).toMatch(/timeline is now compressed/);
  });
  it("reports no changes for identical plans", () => {
    expect(describeChanges(diffPlans(before, before))).toEqual([]);
  });
});
