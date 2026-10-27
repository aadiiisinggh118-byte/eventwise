const { OCCASIONS, adjustableCategoryIds } = require("./occasions");
const { parseISO, daysBetween } = require("./dates");

const PRIORITIES = ["high", "normal", "low"];
const PREFERENCE_KEYS = ["vibe", "ages", "culture", "accessibility", "venue"];
const LIMITS = { minTotal: 5000, maxTotal: 50000000, maxGuests: 5000, maxDelay: 90, maxDaysAhead: 1095 };

/** Accepts 800000, "800000" or "8,00,000". Returns null for anything else. */
function toInt(v) {
  if (typeof v === "number") return Number.isSafeInteger(v) ? v : null;
  if (typeof v !== "string") return null;
  const s = v.replace(/[,\s]/g, "");
  return /^\d{1,12}$/.test(s) ? parseInt(s, 10) : null;
}

/** Trims, strips control characters and caps length. */
function cleanText(v, max = 200) {
  if (typeof v !== "string") return "";
  return v.replace(/[\u0000-\u001F\u007F]/g, " ").replace(/\s+/g, " ").trim().slice(0, max);
}

function cleanPriorities(occasion, raw) {
  const out = {};
  if (!raw || typeof raw !== "object") return out;
  for (const id of adjustableCategoryIds(occasion)) {
    if (PRIORITIES.includes(raw[id]) && raw[id] !== "normal") out[id] = raw[id];
  }
  return out;
}

function cleanPreferences(raw) {
  const out = {};
  if (!raw || typeof raw !== "object") return out;
  for (const k of PREFERENCE_KEYS) {
    const v = cleanText(raw[k]);
    if (v) out[k] = v;
  }
  return out;
}

function cleanOverrides(occasion, total, raw) {
  if (!raw || typeof raw !== "object") return null;
  let used = 0;
  const out = {};
  for (const { id } of OCCASIONS[occasion].categories) {
    if (!Number.isInteger(raw[id]) || raw[id] < 0) return null;
    out[id] = raw[id];
    used += raw[id];
  }
  return used <= total ? out : null;
}

function validateCore(raw, errors) {
  const r = raw && typeof raw === "object" ? raw : {};
  const occasion = typeof r.occasion === "string" && OCCASIONS[r.occasion] ? r.occasion : null;
  if (!occasion) errors.occasion = "Choose what you are planning.";
  const total = toInt(r.total);
  if (total === null || total < LIMITS.minTotal || total > LIMITS.maxTotal) errors.total = "Enter a budget between ₹5,000 and ₹5 crore.";
  const guests = toInt(r.guests);
  if (guests === null || guests < 1 || guests > LIMITS.maxGuests) errors.guests = `Enter a guest count between 1 and ${LIMITS.maxGuests}.`;
  return { r, occasion, total, guests };
}

/**
 * Validates and sanitises a full plan. Used for the setup form, for the
 * Changes page, and for anything read back from localStorage (never trusted).
 * `value` only contains known, cleaned fields.
 */
function validatePlanInput(raw, today, { allowPast = false } = {}) {
  const errors = {};
  const { r, occasion, total, guests } = validateCore(raw, errors);

  const dateMs = parseISO(r.eventDate);
  if (dateMs === null) errors.eventDate = "Pick the event date.";
  else if (!allowPast && daysBetween(today, r.eventDate) < 0) errors.eventDate = "The event date can't be in the past.";
  else if (daysBetween(today, r.eventDate) > LIMITS.maxDaysAhead) errors.eventDate = "Pick a date within the next 3 years.";

  if (Object.keys(errors).length) return { ok: false, errors, value: null };

  const taskIds = new Set(OCCASIONS[occasion].tasks.map((t) => t.id));
  const delays = {};
  if (r.delays && typeof r.delays === "object") {
    for (const [id, d] of Object.entries(r.delays)) {
      if (taskIds.has(id) && Number.isInteger(d) && d >= 1 && d <= LIMITS.maxDelay) delays[id] = d;
    }
  }
  return {
    ok: true,
    errors,
    value: {
      occasion,
      total,
      guests,
      eventDate: r.eventDate,
      priorities: cleanPriorities(occasion, r.priorities),
      preferences: cleanPreferences(r.preferences),
      done: Array.isArray(r.done) ? [...new Set(r.done.filter((id) => taskIds.has(id)))] : [],
      delays,
      overrides: cleanOverrides(occasion, total, r.overrides),
    },
  };
}

/** Request body for POST /api/ideas */
function validateIdeasRequest(raw) {
  const errors = {};
  const { r, occasion, total, guests } = validateCore(raw, errors);
  if (Object.keys(errors).length) return { ok: false, errors, value: null };
  return {
    ok: true,
    errors,
    value: {
      occasion,
      total,
      guests,
      priorities: cleanPriorities(occasion, r.priorities),
      preferences: cleanPreferences(r.preferences),
      refine: cleanText(r.refine, 200),
    },
  };
}

/** Request body for POST /api/tradeoffs (the server rebuilds the options itself). */
function validateTradeoffRequest(raw) {
  const errors = {};
  const { r, occasion, total, guests } = validateCore(raw, errors);
  const overPct = toInt(r.overPct);
  if (overPct === null || overPct < 1 || overPct > 100) errors.overPct = "Enter a percentage between 1 and 100.";
  if (Object.keys(errors).length) return { ok: false, errors, value: null };
  return {
    ok: true,
    errors,
    value: { occasion, total, guests, priorities: cleanPriorities(occasion, r.priorities), overrides: cleanOverrides(occasion, total, r.overrides), overPct },
  };
}

module.exports = { toInt, cleanText, validatePlanInput, validateIdeasRequest, validateTradeoffRequest, LIMITS, PREFERENCE_KEYS };
