// Date helpers on ISO strings ("YYYY-MM-DD") using UTC arithmetic, so results
// never depend on the server/browser time zone (no off-by-one days, no
// server/client hydration mismatches).
const MS_DAY = 86400000;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** @returns {number|null} UTC milliseconds, or null if not a real calendar date */
function parseISO(s) {
  if (typeof s !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const [y, m, d] = s.split("-").map(Number);
  const t = Date.UTC(y, m - 1, d);
  const dt = new Date(t);
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return null;
  return t;
}

const toISO = (ms) => new Date(ms).toISOString().slice(0, 10);

function addDays(iso, n) {
  const t = parseISO(iso);
  if (t === null) throw new Error(`Invalid date: ${iso}`);
  return toISO(t + n * MS_DAY);
}

const daysBetween = (fromIso, toIso) => Math.round((parseISO(toIso) - parseISO(fromIso)) / MS_DAY);

function formatDate(iso) {
  const t = parseISO(iso);
  if (t === null) return "";
  const d = new Date(t);
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

module.exports = { parseISO, toISO, addDays, daysBetween, formatDate };
