const { callGemini } = require("../ai/callGemini");

const ok = (text) => ({ ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ text }] } }] }) });
const fail = (status) => ({ ok: false, status, json: async () => ({ error: { message: "internal detail with key=abc" } }) });
const args = { systemInstruction: "sys", prompt: "hi" };

beforeEach(() => {
  process.env.GEMINI_API_KEY = "TEST-KEY";
  delete process.env.GEMINI_MODEL;
  global.fetch = jest.fn();
});
afterEach(() => { delete process.env.GEMINI_API_KEY; delete process.env.GEMINI_MODEL; });

describe("callGemini", () => {
  it("refuses politely when no key is configured", async () => {
    delete process.env.GEMINI_API_KEY;
    await expect(callGemini(args)).rejects.toMatchObject({ expose: true, status: 503 });
    expect(fetch).not.toHaveBeenCalled();
  });
  it("sends the key in a header, never in the URL, and asks for JSON", async () => {
    fetch.mockResolvedValueOnce(ok("{}"));
    await callGemini(args);
    const [url, init] = fetch.mock.calls[0];
    expect(url).not.toContain("TEST-KEY");
    expect(url).not.toContain("key=");
    expect(init.headers["x-goog-api-key"]).toBe("TEST-KEY");
    const body = JSON.parse(init.body);
    expect(body.generationConfig.responseMimeType).toBe("application/json");
    expect(body.generationConfig.thinkingConfig).toEqual({ thinkingBudget: 0 });
  });
  it("only sets thinking options on models that support them", async () => {
    process.env.GEMINI_MODEL = "some-other-model";
    fetch.mockResolvedValueOnce(ok("{}"));
    await callGemini(args);
    expect(JSON.parse(fetch.mock.calls[0][1].body).generationConfig.thinkingConfig).toBeUndefined();
    expect(fetch.mock.calls[0][0]).toContain("some-other-model");
  });
  it("retries once on 429 and then succeeds", async () => {
    fetch.mockResolvedValueOnce(fail(429)).mockResolvedValueOnce(ok('{"a":1}'));
    await expect(callGemini(args)).resolves.toBe('{"a":1}');
    expect(fetch).toHaveBeenCalledTimes(2);
  });
  it("does not retry client errors, and never leaks the upstream error body", async () => {
    fetch.mockResolvedValue(fail(400));
    const err = await callGemini(args).catch((e) => e);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(err.expose).toBe(true);
    expect(err.message).not.toMatch(/internal detail|key=abc|TEST-KEY/);
  });
  it("gives up after one retry on repeated server errors", async () => {
    fetch.mockResolvedValue(fail(503));
    await expect(callGemini(args)).rejects.toMatchObject({ expose: true });
    expect(fetch).toHaveBeenCalledTimes(2);
  });
  it("aborts a hung request after the timeout", async () => {
    fetch.mockImplementation((_u, init) => new Promise((_res, rej) => init.signal.addEventListener("abort", () => rej(Object.assign(new Error("aborted"), { name: "AbortError" })))));
    await expect(callGemini({ ...args, timeoutMs: 30 })).rejects.toMatchObject({ expose: true, status: 504 });
  });
  it("treats an empty answer as a safe error", async () => {
    fetch.mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({}) });
    await expect(callGemini(args)).rejects.toMatchObject({ expose: true });
  });
});
