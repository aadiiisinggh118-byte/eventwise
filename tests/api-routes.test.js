jest.mock("../ai/callGemini");
const { callGemini } = require("../ai/callGemini");
const { POST: ideasPOST } = require("../app/api/ideas/route");
const { POST: tradeoffsPOST } = require("../app/api/tradeoffs/route");
const { createApiHandler } = require("../lib/handleApi");
const { closeGap } = require("../lib/tradeoffs");
const { buildBudget } = require("../lib/budget");

let n = 0;
const req = (body, { ip = `10.0.0.${++n}`, raw } = {}) =>
  new Request("http://localhost/api/x", { method: "POST", headers: { "x-forwarded-for": ip, "content-type": "application/json" }, body: raw ?? JSON.stringify(body) });

const base = { occasion: "birthday", total: 100000, guests: 40 };
const ideas = { ideas: ["a", "b", "c"].map((t) => ({ title: `Idea ${t}`, concept: "Fun.", fit: "Fits.", leansOn: "venue", effort: "low" })) };
const narration = (ids) => ({ summary: "Three ways.", options: ids.map((id) => ({ id, pros: ["p"], cons: ["c"], bestIf: "b" })) });

let errSpy;
beforeEach(() => { errSpy = jest.spyOn(console, "error").mockImplementation(() => {}); });
afterEach(() => { jest.resetAllMocks(); errSpy.mockRestore(); });

describe("POST /api/ideas", () => {
  it("returns validated ideas", async () => {
    callGemini.mockResolvedValueOnce(JSON.stringify(ideas));
    const res = await ideasPOST(req(base));
    expect(res.status).toBe(200);
    expect((await res.json()).ideas).toHaveLength(3);
    expect(res.headers.get("cache-control")).toBe("no-store");
  });
  it("answers an identical request from cache without a second model call", async () => {
    callGemini.mockResolvedValue(JSON.stringify(ideas));
    const body = { ...base, guests: 41 };
    await ideasPOST(req(body));
    const second = await ideasPOST(req(body));
    expect((await second.json()).cached).toBe(true);
    expect(callGemini).toHaveBeenCalledTimes(1);
  });
  it.each([
    [{ ...base, total: 5 }, "budget"],
    [{ ...base, occasion: "x" }, "occasion"],
    [{ ...base, guests: -1 }, "guests"],
  ])("rejects invalid input %#, without calling the model", async (body) => {
    const res = await ideasPOST(req(body));
    expect(res.status).toBe(400);
    expect(callGemini).not.toHaveBeenCalled();
  });
  it("rejects malformed JSON and oversized bodies", async () => {
    expect((await ideasPOST(req(null, { raw: "{nope" }))).status).toBe(400);
    expect((await ideasPOST(req({ ...base, refine: "x".repeat(20000) }))).status).toBe(413);
  });
  it("never leaks internal error details", async () => {
    callGemini.mockRejectedValueOnce(new Error("connect ECONNREFUSED key=SECRET-123"));
    const res = await ideasPOST(req({ ...base, guests: 42 }));
    const text = await res.text();
    expect(res.status).toBe(500);
    expect(text).not.toMatch(/SECRET|ECONNREFUSED/);
  });
  it("logs WHY the AI answer was rejected (for the developer) without showing it to the user", async () => {
    const bad = { ideas: ["a", "b", "c"].map((t) => ({ title: `Idea ${t}`, concept: "c", fit: "f", leansOn: "helicopter", effort: "low" })) };
    callGemini.mockResolvedValue(JSON.stringify(bad));
    const res = await ideasPOST(req({ ...base, guests: 45 }));
    const body = await res.text();
    expect(res.status).toBe(502);
    expect(body).not.toMatch(/leansOn|helicopter/);
    expect(errSpy.mock.calls.flat().join(" ")).toMatch(/reason:.*leansOn must be one of/);
  });
  it("redacts the API key from server logs even if an upstream error contains it", async () => {
    process.env.GEMINI_API_KEY = "KEY-IN-LOGS-999";
    callGemini.mockRejectedValueOnce(new Error("bad request for KEY-IN-LOGS-999"));
    await ideasPOST(req({ ...base, guests: 44 }));
    expect(errSpy.mock.calls.flat().join(" ")).not.toContain("KEY-IN-LOGS-999");
    delete process.env.GEMINI_API_KEY;
  });
  it("passes through safe, intentionally exposed messages with their status", async () => {
    callGemini.mockRejectedValueOnce(Object.assign(new Error("The AI service is busy."), { expose: true, status: 429 }));
    const res = await ideasPOST(req({ ...base, guests: 43 }));
    expect(res.status).toBe(429);
    expect((await res.json()).error).toBe("The AI service is busy.");
  });
});

describe("POST /api/tradeoffs", () => {
  it("rebuilds the options server-side and returns the narration", async () => {
    const body = { ...base, overPct: 20 };
    const ids = closeGap(buildBudget(base), 20).options.map((o) => o.id);
    callGemini.mockResolvedValueOnce(JSON.stringify(narration(ids)));
    const res = await tradeoffsPOST(req(body));
    expect(res.status).toBe(200);
    expect((await res.json()).narration.options.map((o) => o.id)).toEqual(ids);
  });
  it("rejects an out-of-range percentage", async () => {
    expect((await tradeoffsPOST(req({ ...base, overPct: 500 }))).status).toBe(400);
    expect(callGemini).not.toHaveBeenCalled();
  });
});

describe("deployment settings", () => {
  it("both AI routes run on Node and allow enough time for a model call plus one retry", () => {
    for (const route of [require("../app/api/ideas/route"), require("../app/api/tradeoffs/route")]) {
      expect(route.runtime).toBe("nodejs");
      expect(route.maxDuration).toBe(60);
    }
  });
});

describe("rate limiting", () => {
  it("returns 429 with Retry-After once a client exceeds the limit", async () => {
    const handler = createApiHandler({ name: "t", validate: () => ({ ok: true, value: {} }), run: async () => ({ fine: true }), limit: 2 });
    const same = { ip: "9.9.9.9" };
    expect((await handler(req({}, same))).status).toBe(200);
    expect((await handler(req({}, same))).status).toBe(200);
    const blocked = await handler(req({}, same));
    expect(blocked.status).toBe(429);
    expect(Number(blocked.headers.get("retry-after"))).toBeGreaterThanOrEqual(1);
    expect((await handler(req({}, { ip: "8.8.8.8" }))).status).toBe(200);
  });
});
