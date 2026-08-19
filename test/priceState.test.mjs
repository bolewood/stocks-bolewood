import assert from "node:assert/strict";
import { test } from "node:test";
import {
  PRICE_THRESHOLDS,
  classifyQuote,
  formatQuoteEt,
  oldestQuoteAsOf,
  pagePriceState,
  priceChipLabel,
  worstPriceState,
} from "../lib/priceState.mjs";

const now = Date.UTC(2026, 7, 19, 20, 0, 0); // 16:00 ET on 2026-08-19 (EDT)

test("price thresholds are explicit: live < 15m, stale < 18h", () => {
  assert.equal(PRICE_THRESHOLDS.liveMaxQuoteAgeMs, 15 * 60 * 1000);
  assert.equal(PRICE_THRESHOLDS.staleMaxQuoteAgeMs, 18 * 60 * 60 * 1000);
});

test("classifyQuote covers LIVE, CACHED, STALE, and UNAVAILABLE", () => {
  assert.equal(
    classifyQuote(
      { quoteAsOf: now - 60_000, servedFromCache: false, isFallback: false },
      now
    ),
    "live"
  );
  assert.equal(
    classifyQuote(
      { quoteAsOf: now - 60_000, servedFromCache: true, isFallback: false },
      now
    ),
    "cached"
  );
  assert.equal(
    classifyQuote(
      {
        quoteAsOf: now - PRICE_THRESHOLDS.liveMaxQuoteAgeMs,
        servedFromCache: false,
        isFallback: false,
      },
      now
    ),
    "stale"
  );
  assert.equal(
    classifyQuote(
      {
        quoteAsOf: now - 3 * 60 * 60 * 1000,
        servedFromCache: false,
        isFallback: false,
      },
      now
    ),
    "stale"
  );
  assert.equal(
    classifyQuote(
      {
        quoteAsOf: now - PRICE_THRESHOLDS.staleMaxQuoteAgeMs,
        servedFromCache: false,
        isFallback: false,
      },
      now
    ),
    "unavailable"
  );
  assert.equal(
    classifyQuote({ quoteAsOf: now - 1000, isFallback: true }, now),
    "unavailable"
  );
  assert.equal(
    classifyQuote({ quoteAsOf: null, servedFromCache: false }, now),
    "unavailable"
  );
});

test("page-level state is the worst material row and cannot be LIVE if any row is stale", () => {
  const tickers = ["AMZN", "GOOG", "DXYZ"];
  const live = { quoteAsOf: now - 30_000, isFallback: false, state: "live" };
  const stale = {
    quoteAsOf: now - 2 * 60 * 60 * 1000,
    isFallback: false,
    state: "stale",
  };
  const cached = {
    quoteAsOf: now - 30_000,
    isFallback: false,
    state: "cached",
  };
  const missing = { quoteAsOf: null, isFallback: true, state: "unavailable" };

  assert.equal(
    pagePriceState({ AMZN: live, GOOG: live, DXYZ: live }, tickers, now),
    "live"
  );
  assert.equal(
    pagePriceState({ AMZN: live, GOOG: cached, DXYZ: live }, tickers, now),
    "cached"
  );
  assert.equal(
    pagePriceState({ AMZN: live, GOOG: live, DXYZ: stale }, tickers, now),
    "stale"
  );
  assert.equal(
    pagePriceState({ AMZN: live, GOOG: missing, DXYZ: live }, tickers, now),
    "unavailable"
  );
  assert.equal(worstPriceState(["live", "cached", "stale", "live"]), "stale");
});

test("price chip shows an absolute dated quoteAsOf, not a bare clock", () => {
  const quoteAsOf = Date.UTC(2026, 7, 19, 19, 32, 0); // 15:32 ET
  const label = priceChipLabel("cached", quoteAsOf);
  assert.match(label, /^CACHED · quote /);
  assert.match(label, /Aug 19, 2026/);
  assert.match(label, /3:32\sPM ET/);
  assert.doesNotMatch(label, /^CACHED · \d{1,2}:\d{2}/);
  assert.equal(formatQuoteEt(quoteAsOf), "Aug 19, 2026, 3:32 PM ET");
});

test("oldestQuoteAsOf is the earliest struck time among material rows", () => {
  const a = now - 10_000;
  const b = now - 120_000;
  assert.equal(
    oldestQuoteAsOf(
      { AMZN: { quoteAsOf: a }, GOOG: { quoteAsOf: b }, DXYZ: { quoteAsOf: null } },
      ["AMZN", "GOOG", "DXYZ"]
    ),
    b
  );
});
