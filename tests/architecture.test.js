// These tests protect the design, not a feature: code decides, AI only explains.
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const read = (p) => fs.readFileSync(path.join(root, p), "utf8");
const list = (dir, ext) => fs.readdirSync(path.join(root, dir)).filter((f) => ext.test(f)).map((f) => `${dir}/${f}`);

const { computePlan, diffPlans, describeChanges } = require("../lib/plan");
const { closeGap } = require("../lib/tradeoffs");
const { buildBudget } = require("../lib/budget");

describe("deterministic core stays pure", () => {
  const engines = list("lib", /\.js$/).filter((f) => !/handleApi/.test(f));

  it.each(engines)("%s makes no network calls, reads no secrets and does not import the AI layer", (file) => {
    const src = read(file);
    expect(src).not.toMatch(/\bfetch\s*\(/);
    expect(src).not.toMatch(/process\.env/);
    expect(src).not.toMatch(/require\(["']\.\.\/ai/);
    expect(src).not.toMatch(/Math\.random|Date\.now\(\)\s*(?!.*now\b)/); // no hidden randomness; clocks are injected
  });

  it("re-planning (budget, timeline, diff, trade-offs) never touches the network", () => {
    global.fetch = jest.fn();
    const plan = { occasion: "wedding", total: 800000, guests: 200, eventDate: "2027-02-21", priorities: {}, done: [], delays: { "w-venue": 10 }, overrides: null };
    const before = { plan, derived: computePlan(plan, "2026-10-24") };
    const next = { ...plan, total: 600000, guests: 150, eventDate: "2026-12-30" };
    describeChanges(diffPlans(before, { plan: next, derived: computePlan(next, "2026-10-24") }));
    closeGap(buildBudget(plan), 25);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("the whole plan for every occasion is computed fast (500 plans in well under 2 seconds)", () => {
    const start = performance.now();
    for (let i = 0; i < 500; i++) {
      for (const occasion of ["wedding", "birthday", "community"]) {
        computePlan({ occasion, total: 100000 + i * 997, guests: 20 + (i % 300), eventDate: "2027-03-01", priorities: { venue: "high" }, done: ["w-budget"], delays: {}, overrides: null }, "2026-10-24");
      }
    }
    const ms = performance.now() - start;
    console.log(`1500 full plans computed in ${ms.toFixed(1)} ms (${(ms / 1500).toFixed(3)} ms each)`);
    expect(ms).toBeLessThan(2000);
  });
});

describe("secrets and the AI boundary", () => {
  it("only the Gemini client and the log redactor ever reference the API key", () => {
    const files = [...list("lib", /\.js$/), ...list("ai", /\.js$/), ...list("components", /\.jsx$/), ...list("app", /\.jsx$/), "app/api/ideas/route.js", "app/api/tradeoffs/route.js", "next.config.js"];
    const offenders = files.filter((f) => /GEMINI_API_KEY/.test(read(f)));
    expect(offenders.sort()).toEqual(["ai/callGemini.js", "lib/handleApi.js"]);
  });

  it("no browser code imports the AI layer or server-only modules (so nothing secret can be bundled)", () => {
    const client = [...list("components", /\.jsx$/), "app/layout.jsx", "app/page.jsx"];
    client.forEach((f) => {
      const src = read(f);
      expect(src).not.toMatch(/from ["'](\.\.\/)+ai\//);
      expect(src).not.toMatch(/handleApi|callGemini|validateAI/);
    });
  });

  it("only the Gemini client talks to an external host", () => {
    const files = [...list("lib", /\.js$/), ...list("ai", /\.js$/), ...list("components", /\.jsx$/)];
    const external = files.filter((f) => /https?:\/\/(?!localhost)/.test(read(f).replace(/^\s*\/\/.*$/gm, "")));
    expect(external).toEqual(["ai/callGemini.js"]);
  });

  it("the API key is never placed in a URL", () => {
    expect(read("ai/callGemini.js")).not.toMatch(/\?key=|[&?]key=/);
  });

  it("there are exactly two Gemini-backed features, each with a single call site", () => {
    const callers = list("ai", /\.js$/).filter((f) => /callGemini\(/.test(read(f)) && !/callGemini\.js$/.test(f));
    expect(callers).toEqual(["ai/runWithSelfHealingRetry.js"]); // one shared, bounded call site
    const routes = fs.readdirSync(path.join(root, "app/api"));
    expect(routes.sort()).toEqual(["ideas", "tradeoffs"]);
  });
});

describe("repository hygiene", () => {
  it(".gitignore protects secrets without hiding .env.example", () => {
    const ig = read(".gitignore").split("\n").map((l) => l.trim());
    ["node_modules", ".next", ".env", ".env.local", ".env.*.local"].forEach((e) => expect(ig).toContain(e));
    expect(ig).not.toContain(".env*");
    expect(fs.existsSync(path.join(root, ".env.example"))).toBe(true);
    expect(read(".env.example")).not.toMatch(/AIza[0-9A-Za-z_-]{20,}/); // no real Google key committed
  });
  it("no real-looking API key appears anywhere in the source", () => {
    const files = [...list("lib", /\.js$/), ...list("ai", /\.js$/), ...list("components", /\.jsx$/), ".env.example", "README.md"].filter((f) => fs.existsSync(path.join(root, f)));
    files.forEach((f) => expect(read(f)).not.toMatch(/AIza[0-9A-Za-z_-]{30,}/));
  });
});
