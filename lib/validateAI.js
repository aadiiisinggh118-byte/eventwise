// Validators for Gemini's JSON. Allowed ids always come from the deterministic
// engines for THIS request, so the model can't invent a category or an option.
//
// Two kinds of check, on purpose:
//  - SAFETY (strict): no money amounts, only known ids, exactly the expected items.
//  - LAYOUT (generous): length caps that only catch runaway output. Models are bad at
//    counting characters, so tight caps rejected good answers (a real bug seen in testing).

// Money in any common form. Prices come from the user or the engines, never from the model.
const MONEY_RE = /₹|\brs\.?\s*\d|\binr\b|\$|\busd\b|\brupees?\b|\d\s*(?:lakhs?|lacs?|crores?)\b|\d+\s*k\b/i;
const containsMoney = (s) => MONEY_RE.test(String(s));

const LIMITS = { title: 80, concept: 500, fit: 400, summary: 500, point: 220, bestIf: 260 };

const text = (v) => (typeof v === "string" ? v.trim() : v);
const token = (v) => (typeof v === "string" ? v.trim().toLowerCase() : v); // ids and enums: tolerate "Low", " venue"

function checkText(errors, path, value, max) {
  if (typeof value !== "string" || value.trim().length === 0) errors.push(`${path} must be a non-empty string.`);
  else if (value.length > max) errors.push(`${path} is too long (max ${max} characters).`);
  else if (containsMoney(value)) errors.push(`${path} must not state any price or money amount.`);
}

/** @returns {{valid: boolean, errors: string[], value?: {ideas: object[]}}} `value` is the cleaned copy to use. */
function validateIdeasResponse(parsed, allowedCategoryIds) {
  if (!parsed || !Array.isArray(parsed.ideas) || parsed.ideas.length !== 3) {
    return { valid: false, errors: ["`ideas` must be an array of exactly 3 items."] };
  }
  const errors = [];
  const titles = new Set();
  const ideas = parsed.ideas.map((raw, i) => {
    const p = `ideas[${i}]`;
    if (!raw || typeof raw !== "object") { errors.push(`${p} must be an object.`); return raw; }
    const idea = { title: text(raw.title), concept: text(raw.concept), fit: text(raw.fit), leansOn: token(raw.leansOn), effort: token(raw.effort) };
    checkText(errors, `${p}.title`, idea.title, LIMITS.title);
    checkText(errors, `${p}.concept`, idea.concept, LIMITS.concept);
    checkText(errors, `${p}.fit`, idea.fit, LIMITS.fit);
    if (!allowedCategoryIds.includes(idea.leansOn)) errors.push(`${p}.leansOn must be one of: ${allowedCategoryIds.join(", ")}.`);
    if (!["low", "medium", "high"].includes(idea.effort)) errors.push(`${p}.effort must be low, medium or high.`);
    const key = String(idea.title).toLowerCase();
    if (titles.has(key)) errors.push(`${p}.title duplicates another idea.`);
    titles.add(key);
    return idea;
  });
  return { valid: errors.length === 0, errors, value: { ideas } };
}

/** @returns {{valid: boolean, errors: string[], value?: object}} */
function validateNarration(parsed, optionIds) {
  if (!parsed || typeof parsed !== "object") return { valid: false, errors: ["Response is not a JSON object."] };
  const errors = [];
  checkText(errors, "summary", parsed.summary, LIMITS.summary);
  if (!Array.isArray(parsed.options) || parsed.options.length !== optionIds.length) {
    errors.push(`\`options\` must have exactly one entry for each of: ${optionIds.join(", ")}.`);
    return { valid: false, errors };
  }
  const seen = new Set();
  const options = parsed.options.map((raw, i) => {
    const p = `options[${i}]`;
    if (!raw || typeof raw !== "object") { errors.push(`${p} must be an object.`); return raw; }
    const o = { id: token(raw.id), pros: raw.pros, cons: raw.cons, bestIf: text(raw.bestIf) };
    if (!optionIds.includes(o.id) || seen.has(o.id)) errors.push(`${p}.id must be a unique one of: ${optionIds.join(", ")}.`);
    seen.add(o.id);
    ["pros", "cons"].forEach((k) => {
      if (!Array.isArray(o[k]) || o[k].length < 1 || o[k].length > 3) errors.push(`${p}.${k} must have 1 to 3 items.`);
      else { o[k] = o[k].map(text); o[k].forEach((x, j) => checkText(errors, `${p}.${k}[${j}]`, x, LIMITS.point)); }
    });
    checkText(errors, `${p}.bestIf`, o.bestIf, LIMITS.bestIf);
    return o;
  });
  return { valid: errors.length === 0, errors, value: { summary: text(parsed.summary), options } };
}

module.exports = { containsMoney, validateIdeasResponse, validateNarration, LIMITS };
