// Shared last-good cache for Yahoo-backed price routes.
// Vercel isolates do not share process memory, so routes also send
// Cache-Control for the CDN. This module still coalesces thundering herds
// inside one isolate and avoids re-hitting Yahoo after a failure.

export const QUOTE_CACHE_TTL_MS = 60_000;
export const QUOTE_FAILURE_TTL_MS = 60_000;
export const YAHOO_FETCH_CONCURRENCY = 3;

export const PRICE_CDN_HEADERS = {
  // Next App Router overwrites Cache-Control on Route Handlers (production
  // was serving bare `public` with no max-age, so browsers kept Wednesday's
  // JSON). Browser: never cache. Vercel edge: 60s + SWR via CDN-Cache-Control,
  // which Next does not strip.
  "Cache-Control": "private, no-store, no-cache, must-revalidate",
  "CDN-Cache-Control": "public, s-maxage=60, stale-while-revalidate=120",
  "Vercel-CDN-Cache-Control":
    "public, s-maxage=60, stale-while-revalidate=120",
};

export async function mapLimit(items, limit, fn) {
  const results = new Array(items.length);
  let next = 0;
  async function worker() {
    for (;;) {
      const i = next++;
      if (i >= items.length) return;
      results[i] = await fn(items[i], i);
    }
  }
  const n = Math.max(1, Math.min(limit, items.length));
  await Promise.all(Array.from({ length: n }, worker));
  return results;
}

export function createLiveQuoteCache({
  ttlMs = QUOTE_CACHE_TTL_MS,
  failureTtlMs = QUOTE_FAILURE_TTL_MS,
} = {}) {
  let entry = null;
  let inFlight = null;
  let failedAt = 0;

  return {
    async load(now, fetchLive) {
      if (entry && now - entry.writtenAt < ttlMs) {
        return { payload: entry.payload, servedFromCache: true, reason: "ttl" };
      }
      if (inFlight) {
        const result = await inFlight;
        return { ...result, servedFromCache: true, reason: "coalesced" };
      }
      if (entry && failedAt > 0 && now - failedAt < failureTtlMs) {
        return {
          payload: entry.payload,
          servedFromCache: true,
          reason: "backoff",
        };
      }

      inFlight = (async () => {
        const live = await fetchLive(entry?.payload ?? null);
        if (live.ok) {
          entry = { payload: live.payload, writtenAt: now };
          failedAt = 0;
          return {
            payload: live.payload,
            servedFromCache: false,
            reason: "live",
          };
        }
        failedAt = now;
        if (entry) {
          return {
            payload: entry.payload,
            servedFromCache: true,
            reason: "last-good",
          };
        }
        return {
          payload: live.payload,
          servedFromCache: false,
          reason: "fallback",
        };
      })().finally(() => {
        inFlight = null;
      });

      return inFlight;
    },
  };
}
