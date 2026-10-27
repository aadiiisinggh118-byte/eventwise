const { createRateLimiter } = require("./rateLimit");
const { createCache } = require("./cache");

/** Server logs get a short message with the API key (if it ever appeared) redacted. */
function redact(message) {
  const key = process.env.GEMINI_API_KEY;
  const text = String(message || "").slice(0, 160);
  return key ? text.split(key).join("[redacted]") : text;
}

const json = (body, status = 200, headers = {}) =>
  Response.json(body, { status, headers: { "Cache-Control": "no-store", ...headers } });

/**
 * Shared handler for the AI routes, so both get identical protection:
 * rate limit, body-size cap, validation, response cache, and error messages
 * that never leak internals.
 */
function createApiHandler({ name, validate, run, limit = 10, windowMs = 60000, cacheMax = 50, ttlMs = 600000, maxBodyBytes = 8192 }) {
  const limiter = createRateLimiter({ limit, windowMs });
  const cache = createCache({ max: cacheMax, ttlMs });

  return async function POST(request) {
    try {
      const ip = (request.headers.get("x-forwarded-for") || "").split(",")[0].trim() || "anonymous";
      const rl = limiter.check(ip);
      if (!rl.allowed) {
        return json({ error: "Too many requests. Please wait a moment and try again." }, 429, { "Retry-After": String(rl.retryAfterSec) });
      }

      const declared = Number(request.headers.get("content-length") || 0);
      if (declared > maxBodyBytes) return json({ error: "That request is too large." }, 413);
      const text = await request.text();
      if (text.length > maxBodyBytes) return json({ error: "That request is too large." }, 413);

      let body;
      try { body = JSON.parse(text); } catch { return json({ error: "The request wasn't valid JSON." }, 400); }

      const v = validate(body);
      if (!v.ok) return json({ error: "Please check your inputs.", fields: v.errors }, 400);

      const key = JSON.stringify(v.value);
      const hit = cache.get(key);
      if (hit) return json({ ...hit, cached: true });

      const result = await run(v.value);
      cache.set(key, result);
      return json(result);
    } catch (err) {
      console.error(`[${name}]`, redact(err && err.message), err && err.details ? `| reason: ${redact(err.details)}` : "");
      const exposed = err && err.expose === true;
      return json({ error: exposed ? err.message : "Something went wrong. Please try again." }, exposed && err.status ? err.status : 500);
    }
  };
}

module.exports = { createApiHandler };
