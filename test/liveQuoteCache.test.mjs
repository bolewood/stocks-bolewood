import assert from "node:assert/strict";
import { test } from "node:test";
import {
  PRICE_CDN_HEADERS,
  createLiveQuoteCache,
  mapLimit,
} from "../lib/liveQuoteCache.mjs";
import { chartUrl, fetchChartPrice, YAHOO_CHART_HOSTS } from "../lib/yahooQuote.mjs";

test("mapLimit respects concurrency and preserves order", async () => {
  const seen = [];
  const out = await mapLimit(["a", "b", "c", "d"], 2, async (item) => {
    seen.push(item);
    return item.toUpperCase();
  });
  assert.deepEqual(out, ["A", "B", "C", "D"]);
  assert.deepEqual(seen.sort(), ["a", "b", "c", "d"]);
});

test("live quote cache hits TTL without calling fetchLive again", async () => {
  const cache = createLiveQuoteCache({ ttlMs: 1_000, failureTtlMs: 1_000 });
  let calls = 0;
  const fetchLive = async () => {
    calls++;
    return { ok: true, payload: { n: calls } };
  };
  const first = await cache.load(1_000, fetchLive);
  const second = await cache.load(1_500, fetchLive);
  assert.equal(calls, 1);
  assert.equal(first.reason, "live");
  assert.equal(first.servedFromCache, false);
  assert.equal(second.reason, "ttl");
  assert.equal(second.servedFromCache, true);
  assert.equal(second.payload.n, 1);
});

test("concurrent loads coalesce to one upstream fetch", async () => {
  const cache = createLiveQuoteCache({ ttlMs: 60_000, failureTtlMs: 60_000 });
  let calls = 0;
  let release;
  const gate = new Promise((resolve) => {
    release = resolve;
  });
  const fetchLive = async () => {
    calls++;
    await gate;
    return { ok: true, payload: { n: calls } };
  };
  const pending = Promise.all([
    cache.load(0, fetchLive),
    cache.load(0, fetchLive),
    cache.load(0, fetchLive),
  ]);
  release();
  const results = await pending;
  assert.equal(calls, 1);
  assert.equal(results[0].reason, "live");
  assert.equal(results[1].reason, "coalesced");
  assert.equal(results[2].reason, "coalesced");
  assert.equal(results[1].servedFromCache, true);
});

test("failed fetch serves last-good and backs off before retrying", async () => {
  const cache = createLiveQuoteCache({ ttlMs: 100, failureTtlMs: 1_000 });
  let calls = 0;
  const fetchLive = async () => {
    calls++;
    if (calls === 1) return { ok: true, payload: { n: 1 } };
    return { ok: false, payload: { n: "fallback" } };
  };
  await cache.load(0, fetchLive);
  const lastGood = await cache.load(200, fetchLive);
  assert.equal(lastGood.reason, "last-good");
  assert.equal(lastGood.payload.n, 1);
  assert.equal(calls, 2);
  const backedOff = await cache.load(500, fetchLive);
  assert.equal(backedOff.reason, "backoff");
  assert.equal(calls, 2);
  const retried = await cache.load(1_300, fetchLive);
  assert.equal(retried.reason, "last-good");
  assert.equal(calls, 3);
});

test("failed fetch without last-good returns the fallback payload", async () => {
  const cache = createLiveQuoteCache({ ttlMs: 60_000, failureTtlMs: 60_000 });
  const result = await cache.load(0, async () => ({
    ok: false,
    payload: { n: "fallback" },
  }));
  assert.equal(result.reason, "fallback");
  assert.equal(result.servedFromCache, false);
  assert.equal(result.payload.n, "fallback");
});

test("price routes tell browsers not to cache; Vercel edge still has a 60s CDN TTL", () => {
  assert.match(PRICE_CDN_HEADERS["Cache-Control"], /no-store/);
  assert.match(PRICE_CDN_HEADERS["CDN-Cache-Control"], /s-maxage=60/);
  assert.match(PRICE_CDN_HEADERS["Vercel-CDN-Cache-Control"], /s-maxage=60/);
});

test("fetchChartPrice falls back to query2 after query1 429", async () => {
  const calls = [];
  const orig = globalThis.fetch;
  globalThis.fetch = async (url) => {
    calls.push(String(url));
    if (String(url).includes("query1")) {
      return { ok: false, status: 429 };
    }
    return {
      ok: true,
      status: 200,
      json: async () => ({
        chart: {
          result: [
            {
              meta: {
                symbol: "DXYZ",
                regularMarketPrice: 32.84,
                regularMarketTime: 1_787_173_920,
              },
            },
          ],
        },
      }),
    };
  };
  try {
    const parsed = await fetchChartPrice("DXYZ");
    assert.equal(parsed.price, 32.84);
    assert.ok(calls[0].includes(YAHOO_CHART_HOSTS[0]));
    assert.ok(calls[1].includes(YAHOO_CHART_HOSTS[1]));
    assert.equal(
      chartUrl("DXYZ", YAHOO_CHART_HOSTS[1]),
      "https://query2.finance.yahoo.com/v8/finance/chart/DXYZ?interval=1d&range=1d"
    );
  } finally {
    globalThis.fetch = orig;
  }
});
