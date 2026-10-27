// Indian digit grouping (12,34,567) done by hand so output is identical in
// every runtime (no Intl/ICU differences between server and browser).
function groupIndian(digits) {
  if (digits.length <= 3) return digits;
  const rest = digits.slice(0, -3).replace(/\B(?=(\d{2})+(?!\d))/g, ",");
  return `${rest},${digits.slice(-3)}`;
}

function formatINR(n) {
  const v = Math.round(Number(n) || 0);
  return `${v < 0 ? "-" : ""}₹${groupIndian(String(Math.abs(v)))}`;
}

function formatCompactINR(n) {
  const v = Math.round(Number(n) || 0);
  const a = Math.abs(v);
  const sign = v < 0 ? "-" : "";
  const fmt = (x) => String(Number(x.toFixed(2)));
  if (a >= 1e7) return `${sign}₹${fmt(a / 1e7)} crore`;
  if (a >= 1e5) return `${sign}₹${fmt(a / 1e5)} lakh`;
  return formatINR(v);
}

/**
 * Splits an integer total across weights using the largest-remainder method:
 * results are non-negative integers that sum to EXACTLY `total`, so a budget
 * can never be off by a rupee from rounding.
 * @param {number} total non-negative integer
 * @param {number[]} weights non-negative numbers, at least one > 0
 * @returns {number[]}
 */
function allocateByWeights(total, weights) {
  const sum = weights.reduce((a, b) => a + b, 0);
  if (!(sum > 0)) throw new Error("allocateByWeights needs at least one positive weight");
  const quotas = weights.map((w) => (total * w) / sum);
  const out = quotas.map(Math.floor);
  let remainder = total - out.reduce((a, b) => a + b, 0);
  const order = quotas
    .map((q, i) => ({ i, frac: q - Math.floor(q) }))
    .sort((a, b) => b.frac - a.frac || a.i - b.i);
  for (let k = 0; remainder > 0; k = (k + 1) % order.length) {
    out[order[k].i] += 1;
    remainder -= 1;
  }
  // Guard against float error pushing the floors above the total.
  while (remainder < 0) {
    const j = out.indexOf(Math.max(...out));
    out[j] -= 1;
    remainder += 1;
  }
  return out;
}

module.exports = { formatINR, formatCompactINR, allocateByWeights };
