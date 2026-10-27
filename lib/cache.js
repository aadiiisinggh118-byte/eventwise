/** Small TTL + LRU cache: identical requests are answered without calling the model again. */
function createCache({ max = 50, ttlMs = 600000, now = Date.now } = {}) {
  const map = new Map();
  return {
    get(key) {
      const e = map.get(key);
      if (!e) return undefined;
      if (now() - e.t > ttlMs) { map.delete(key); return undefined; }
      map.delete(key); map.set(key, e); // refresh recency
      return e.v;
    },
    set(key, v) {
      map.delete(key);
      map.set(key, { v, t: now() });
      while (map.size > max) map.delete(map.keys().next().value);
    },
    get size() { return map.size; },
  };
}
module.exports = { createCache };
