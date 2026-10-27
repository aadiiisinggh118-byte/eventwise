const { callGemini } = require("./callGemini");

/**
 * Call Gemini, parse its JSON and validate it. If validation fails, feed the
 * errors back for exactly ONE retry. So a request costs one model call, and
 * never more than two. If the second answer is also invalid we fail safely
 * rather than show something unchecked.
 */
async function runWithSelfHealingRetry({ buildPrompt, validate, callOptions = {} }) {
  const attemptOnce = async (feedback) => {
    const { systemInstruction, prompt } = buildPrompt(feedback);
    const raw = await callGemini({ systemInstruction, prompt, ...callOptions });
    let parsed;
    // JSON mode normally returns bare JSON; tolerate a stray ```json fence just in case.
    try { parsed = JSON.parse(String(raw).trim().replace(/^```(?:json)?\s*|\s*```$/g, "")); } catch { return { ok: false, errors: ["Response was not valid JSON."] }; }
    const { valid, errors, value } = validate(parsed);
    return valid ? { ok: true, data: value ?? parsed } : { ok: false, errors };
  };

  const first = await attemptOnce();
  if (first.ok) return first.data;
  const second = await attemptOnce(first.errors.join("; "));
  if (second.ok) return second.data;

  const err = new Error("The AI answer didn't pass our checks, so we're not showing it. Please try again.");
  err.expose = true;
  err.status = 502;
  err.details = second.errors.join("; ").slice(0, 400); // for server logs only, never sent to the browser
  throw err;
}

module.exports = { runWithSelfHealingRetry };
