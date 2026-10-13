import assert from "node:assert/strict";
import { test } from "node:test";
import {
  PRICE_CLIENT_POLL_MS,
  startJsonPoll,
} from "../lib/pollLivePrices.mjs";

test("client poll interval matches the 60s CDN TTL", () => {
  assert.equal(PRICE_CLIENT_POLL_MS, 60_000);
});

test("startJsonPoll fetches immediately with cache: no-store", async () => {
  const origFetch = globalThis.fetch;
  const origDoc = globalThis.document;
  const calls = [];
  globalThis.document = {
    visibilityState: "visible",
    addEventListener() {},
    removeEventListener() {},
  };
  globalThis.fetch = async (url, opts) => {
    calls.push({ url: String(url), opts });
    return { ok: true, json: async () => ({ ok: true }) };
  };
  const seen = [];
  const stop = startJsonPoll("/api/ai-prices", {
    onData: (d) => seen.push(d),
    intervalMs: 60_000,
  });
  await new Promise((r) => setTimeout(r, 20));
  stop();
  globalThis.fetch = origFetch;
  globalThis.document = origDoc;
  assert.equal(calls[0].url, "/api/ai-prices");
  assert.equal(calls[0].opts.cache, "no-store");
  assert.equal(seen[0].ok, true);
});

test("pauseWhenHidden skips interval ticks while hidden but keeps the first load", async () => {
  const origFetch = globalThis.fetch;
  const origDoc = globalThis.document;
  const calls = [];
  const listeners = {};
  globalThis.document = {
    visibilityState: "hidden",
    addEventListener(type, fn) {
      listeners[type] = fn;
    },
    removeEventListener() {},
  };
  globalThis.fetch = async (url) => {
    calls.push(String(url));
    return { ok: true, json: async () => ({}) };
  };
  const stop = startJsonPoll("/api/investor-day", {
    intervalMs: 10,
    pauseWhenHidden: true,
  });
  await new Promise((r) => setTimeout(r, 35));
  assert.equal(calls.length, 1, "only the initial load while hidden");
  globalThis.document.visibilityState = "visible";
  listeners.visibilitychange();
  await new Promise((r) => setTimeout(r, 5));
  stop();
  globalThis.fetch = origFetch;
  globalThis.document = origDoc;
  assert.ok(calls.length >= 2, "visibility refetch resumes polling");
});
