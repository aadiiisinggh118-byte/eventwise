const { toInt, cleanText, validatePlanInput, validateIdeasRequest, validateTradeoffRequest } = require("../lib/validate");
const { createCache } = require("../lib/cache");
const { createRateLimiter } = require("../lib/rateLimit");

const TODAY = "2026-10-24";
const good = { occasion: "wedding", total: "8,00,000", guests: "200", eventDate: "2027-02-21" };

describe("input parsing and sanitising", () => {
  it("toInt accepts Indian-formatted numbers and rejects junk", () => {
    expect(toInt("8,00,000")).toBe(800000);
    expect(toInt(" 12 ")).toBe(12);
    ["", "12.5", "-3", "abc", null, undefined, {}, 1e30].forEach((v) => expect(toInt(v)).toBeNull());
  });
  it("cleanText strips control characters, collapses whitespace and caps length", () => {
    expect(cleanText("  hi\u0000\n  there  ")).toBe("hi there");
    expect(cleanText("x".repeat(500))).toHaveLength(200);
    expect(cleanText(42)).toBe("");
  });
});

describe("validatePlanInput", () => {
  it("accepts a valid plan and returns only known, cleaned fields", () => {
    const v = validatePlanInput({ ...good, evil: "<script>", priorities: { decor: "high", venue: "bogus", nope: "low" }, preferences: { vibe: "calm", hack: "x" } }, TODAY);
    expect(v.ok).toBe(true);
    expect(v.value).toEqual({
      occasion: "wedding", total: 800000, guests: 200, eventDate: "2027-02-21",
      priorities: { decor: "high" }, preferences: { vibe: "calm" }, done: [], delays: {}, overrides: null,
    });
  });
  it.each([
    [{ ...good, occasion: "funeral" }, "occasion"],
    [{ ...good, total: "100" }, "total"],
    [{ ...good, total: "999999999999" }, "total"],
    [{ ...good, guests: "0" }, "guests"],
    [{ ...good, guests: "99999" }, "guests"],
    [{ ...good, eventDate: "2026-10-01" }, "eventDate"],
    [{ ...good, eventDate: "2031-01-01" }, "eventDate"],
    [{ ...good, eventDate: "not-a-date" }, "eventDate"],
    [null, "occasion"],
  ])("rejects bad input %#", (input, field) => {
    const v = validatePlanInput(input, TODAY);
    expect(v.ok).toBe(false);
    expect(v.errors[field]).toBeTruthy();
  });
  it("allows a past date only when restoring saved data", () => {
    expect(validatePlanInput({ ...good, eventDate: "2026-10-01" }, TODAY, { allowPast: true }).ok).toBe(true);
  });
  it("drops unknown task ids, bad delays and invalid overrides from saved data", () => {
    const v = validatePlanInput({ ...good, done: ["w-budget", "x-fake", "w-budget"], delays: { "w-venue": 10, "w-photo": 500, "x-fake": 3 }, overrides: { venue: 1 } }, TODAY);
    expect(v.value.done).toEqual(["w-budget"]);
    expect(v.value.delays).toEqual({ "w-venue": 10 });
    expect(v.value.overrides).toBeNull();
  });
});

describe("request validators", () => {
  it("ideas: sanitises refine text and preferences", () => {
    const v = validateIdeasRequest({ ...good, refine: "cheaper\u0000 please", preferences: { ages: "kids and elders" } });
    expect(v.ok).toBe(true);
    expect(v.value.refine).toBe("cheaper please");
    expect(v.value).not.toHaveProperty("eventDate");
  });
  it("tradeoffs: needs a sensible percentage", () => {
    expect(validateTradeoffRequest({ ...good, overPct: 20 }).ok).toBe(true);
    expect(validateTradeoffRequest({ ...good, overPct: 0 }).ok).toBe(false);
    expect(validateTradeoffRequest({ ...good, overPct: 101 }).ok).toBe(false);
  });
});

describe("cache and rate limiter", () => {
  it("cache expires entries and evicts the least recently used", () => {
    let now = 0;
    const c = createCache({ max: 2, ttlMs: 100, now: () => now });
    c.set("a", 1); c.set("b", 2); c.get("a"); c.set("c", 3);
    expect(c.get("b")).toBeUndefined();
    expect(c.get("a")).toBe(1);
    now = 500;
    expect(c.get("a")).toBeUndefined();
  });
  it("limiter blocks after the limit, reports when to retry, and recovers", () => {
    let now = 0;
    const l = createRateLimiter({ limit: 2, windowMs: 1000, now: () => now });
    expect(l.check("ip").allowed).toBe(true);
    expect(l.check("ip").allowed).toBe(true);
    const blocked = l.check("ip");
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSec).toBeGreaterThanOrEqual(1);
    expect(l.check("other").allowed).toBe(true);
    now = 1500;
    expect(l.check("ip").allowed).toBe(true);
  });
});
