// Server-side only. The key is read from the environment, sent in a header
// (never in the URL, where it would end up in logs), and never returned.

const BASE = "https://generativelanguage.googleapis.com/v1beta/models";

function userError(message, status) {
  const err = new Error(message);
  err.expose = true; // safe to show to the user; anything else becomes a generic message
  err.status = status;
  return err;
}

/**
 * One JSON-mode generateContent call with a hard timeout and one retry on 429/5xx.
 * @returns {Promise<string>} the model's raw JSON text
 */
async function callGemini({ systemInstruction, prompt, maxOutputTokens = 800, temperature = 0.5, timeoutMs = 20000 }) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw userError("The AI service isn't configured on this server yet.", 503);
  const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";

  const generationConfig = { responseMimeType: "application/json", maxOutputTokens, temperature };
  // These are short, structured rewrites: skip the model's optional "thinking" for speed and cost.
  if (/gemini-2\.5-flash/.test(model)) generationConfig.thinkingConfig = { thinkingBudget: 0 };

  const body = JSON.stringify({
    systemInstruction: { parts: [{ text: systemInstruction }] },
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    generationConfig,
  });

  const attempt = async () => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(`${BASE}/${model}:generateContent`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": key },
        body,
        signal: controller.signal,
      });
      if (!res.ok) {
        const err = userError(res.status === 429 ? "The AI service is busy. Please try again in a minute." : "The AI service couldn't answer. Please try again.", res.status);
        err.retryable = res.status === 429 || res.status >= 500;
        throw err;
      }
      const data = await res.json();
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) throw userError("The AI service returned an empty answer. Please try again.", 502);
      return text;
    } catch (e) {
      if (e.name === "AbortError") throw userError("The AI service took too long. Please try again.", 504);
      throw e;
    } finally {
      clearTimeout(timer);
    }
  };

  try {
    return await attempt();
  } catch (e) {
    if (!e.retryable) throw e;
    await new Promise((r) => setTimeout(r, 800));
    return attempt();
  }
}

module.exports = { callGemini };
