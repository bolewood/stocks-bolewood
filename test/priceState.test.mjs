import assert from "node:assert/strict";
import { test } from "node:test";
import {
  PRICE_THRESHOLDS,
  classifyQuote,
  etCivilToUtc,
  formatQuoteEt,
  isCashSessionOpen,
  lastCompletedSession,
  oldestQuoteAsOf,
  newestQuoteAsOf,
  chipQuoteAsOf,
  pagePriceState,
  priceChipLabel,
  worstPriceState,
} from "../lib/priceState.mjs";

// Wednesday Aug 19, 2026 is a cash session. EDT = UTC−4.
const rthNow = etCivilToUtc(2026, 8, 19, 11, 0); // 11:00 ET
const closeBell = etCivilToUtc(2026, 8, 19, 16, 0); // 16:00 ET
const evening = etCivilToUtc(2026, 8, 19, 20, 0); // 20:00 ET
const saturday = etCivilToUtc(2026, 8, 22, 14, 0); // Sat 14:00 ET
const mondayRth = etCivilToUtc(2026, 8, 24, 10, 30); // Mon 10:30 ET
const fridayClose = etCivilToUtc(2026, 8, 21, 16, 0);

test("etCivilToUtc pins known EDT offsets", () => {
  assert.equal(closeBell, Date.UTC(2026, 7, 19, 20, 0, 0));
  assert.equal(isCashSessionOpen(rthNow), true);
  assert.equal(isCashSessionOpen(closeBell), false);
  assert.equal(isCashSessionOpen(evening), false);
  assert.equal(isCashSessionOpen(saturday), false);
});

test("price thresholds are explicit: live < 15m; RTH 9:30–16:00 ET", () => {
  assert.equal(PRICE_THRESHOLDS.liveMaxQuoteAgeMs, 15 * 60 * 1000);
  assert.equal(PRICE_THRESHOLDS.staleMaxQuoteAgeMs, 18 * 60 * 60 * 1000);
  assert.equal(PRICE_THRESHOLDS.rthOpenMinutes, 9 * 60 + 30);
  assert.equal(PRICE_THRESHOLDS.rthCloseMinutes, 16 * 60);
});

test("while the cash session is open: LIVE, CACHED, UNAVAILABLE; same-day lag is CACHED", () => {
  assert.equal(
    classifyQuote(
      { quoteAsOf: rthNow - 60_000, servedFromCache: false, isFallback: false },
      rthNow
    ),
    "live"
  );
  assert.equal(
    classifyQuote(
      { quoteAsOf: rthNow - 60_000, servedFromCache: true, isFallback: false },
      rthNow
    ),
    "cached"
  );
  assert.equal(
    classifyQuote(
      {
        quoteAsOf: rthNow - PRICE_THRESHOLDS.liveMaxQuoteAgeMs,
        servedFromCache: false,
        isFallback: false,
      },
      rthNow
    ),
    "cached"
  );
  assert.equal(
    classifyQuote(
      {
        quoteAsOf: rthNow - 3 * 60 * 60 * 1000,
        servedFromCache: false,
        isFallback: false,
      },
      rthNow
    ),
    "cached"
  );
  assert.equal(
    classifyQuote({ quoteAsOf: null, servedFromCache: false }, rthNow),
    "unavailable"
  );
  assert.equal(
    classifyQuote({ quoteAsOf: rthNow - 1000, isFallback: true }, rthNow),
    "unavailable"
  );
});

test("after the close and on the weekend the last session print is CLOSE, not STALE", () => {
  assert.equal(
    classifyQuote(
      { quoteAsOf: closeBell, servedFromCache: true, isFallback: false },
      evening
    ),
    "close"
  );
  assert.equal(
    classifyQuote(
      { quoteAsOf: fridayClose, servedFromCache: false, isFallback: false },
      saturday
    ),
    "close"
  );
  const label = priceChipLabel("close", closeBell);
  assert.match(label, /^CLOSE · /);
  assert.match(label, /Aug 19, 2026/);
  assert.match(label, /4:00\sPM ET/);
  assert.doesNotMatch(label, /STALE/);
});

test("STALE is a prior-day print while the cash session is open", () => {
  const fridayRth = etCivilToUtc(2026, 8, 21, 11, 20);
  assert.equal(
    classifyQuote(
      { quoteAsOf: closeBell, servedFromCache: false, isFallback: false },
      fridayRth
    ),
    "stale"
  );
  assert.equal(
    classifyQuote(
      { quoteAsOf: fridayClose, servedFromCache: false, isFallback: false },
      mondayRth
    ),
    "stale"
  );
  assert.equal(
    pagePriceState(
      {
        AMZN: { quoteAsOf: fridayClose, isFallback: false, state: "stale" },
        GOOG: { quoteAsOf: fridayClose, isFallback: false, state: "stale" },
      },
      ["AMZN", "GOOG"],
      mondayRth
    ),
    "stale"
  );
});

test("page-level state is the worst material row and cannot be LIVE if any row is stale", () => {
  const tickers = ["AMZN", "GOOG", "DXYZ"];
  const live = { quoteAsOf: rthNow - 30_000, isFallback: false, state: "live" };
  const stale = {
    quoteAsOf: etCivilToUtc(2026, 8, 18, 16, 0),
    isFallback: false,
    state: "stale",
  };
  const cached = {
    quoteAsOf: rthNow - 30_000,
    isFallback: false,
    state: "cached",
  };
  const missing = { quoteAsOf: null, isFallback: true, state: "unavailable" };
  const close = { quoteAsOf: closeBell, isFallback: false, state: "close" };

  assert.equal(
    pagePriceState({ AMZN: live, GOOG: live, DXYZ: live }, tickers, rthNow),
    "live"
  );
  assert.equal(
    pagePriceState({ AMZN: live, GOOG: cached, DXYZ: live }, tickers, rthNow),
    "cached"
  );
  assert.equal(
    pagePriceState({ AMZN: live, GOOG: live, DXYZ: stale }, tickers, rthNow),
    "stale"
  );
  assert.equal(
    pagePriceState({ AMZN: live, GOOG: missing, DXYZ: live }, tickers, rthNow),
    "unavailable"
  );
  assert.equal(
    pagePriceState({ AMZN: close, GOOG: close, DXYZ: close }, tickers, evening),
    "close"
  );
  assert.equal(worstPriceState(["live", "cached", "close", "live"]), "close");
  assert.equal(worstPriceState(["close", "stale"]), "stale");
});

test("price chip shows an absolute dated quoteAsOf, not a bare clock", () => {
  const quoteAsOf = etCivilToUtc(2026, 8, 19, 15, 32);
  const label = priceChipLabel("cached", quoteAsOf);
  assert.match(label, /^CACHED · quote /);
  assert.match(label, /Aug 19, 2026/);
  assert.match(label, /3:32\sPM ET/);
  assert.doesNotMatch(label, /^CACHED · \d{1,2}:\d{2}/);
  assert.equal(formatQuoteEt(quoteAsOf), "Aug 19, 2026, 3:32 PM ET");
});

test("oldestQuoteAsOf is the earliest struck time among material rows", () => {
  const a = rthNow - 10_000;
  const b = rthNow - 120_000;
  const quotes = {
    AMZN: { quoteAsOf: a },
    GOOG: { quoteAsOf: b },
    DXYZ: { quoteAsOf: null },
  };
  const tickers = ["AMZN", "GOOG", "DXYZ"];
  assert.equal(oldestQuoteAsOf(quotes, tickers), b);
  assert.equal(newestQuoteAsOf(quotes, tickers), a);
  assert.equal(chipQuoteAsOf("cached", quotes, tickers), a);
  assert.equal(chipQuoteAsOf("stale", quotes, tickers), b);
});

test("last completed session on Wednesday evening is Wednesday 9:30–16:00 ET", () => {
  const session = lastCompletedSession(evening);
  assert.equal(session.openMs, etCivilToUtc(2026, 8, 19, 9, 30));
  assert.equal(session.closeMs, closeBell);
});
