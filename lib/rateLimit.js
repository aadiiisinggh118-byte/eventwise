/** Sliding-window limiter. In-memory, so it is per server instance (documented in the README). */
function createRateLimiter({ limit = 10, windowMs = 60000, maxKeys = 5000, now = Date.now } = {}) {
  const hits = new Map();
  return {
    check(key) {
      const t = now();
      const recent = (hits.get(key) || []).filter((x) => t - x < windowMs);
      if (recent.length >= limit) {
        hits.set(key, recent);
        return { allowed: false, retryAfterSec: Math.max(1, Math.ceil((windowMs - (t - recent[0])) / 1000)) };
      }
      recent.push(t);
      hits.delete(key); hits.set(key, recent);
      if (hits.size > maxKeys) hits.delete(hits.keys().next().value);
      return { allowed: true, retryAfterSec: 0 };
    },
  };
}
module.exports = { createRateLimiter };
