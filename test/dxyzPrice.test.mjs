import assert from "node:assert/strict";
import { test } from "node:test";
import { resolveDxyzPrice, dxyzPriceChip } from "../lib/dxyzPrice.mjs";
import { etCivilToUtc } from "../lib/priceState.mjs";

const rows = [
  { date: "2026-10-28", close: 27.65, volume: 650_200 },
  { date: "2026-10-29", close: 26.79, volume: 541_600 },
];
// Thu 2026-10-29 14:00 ET, cash session open.
const now = etCivilToUtc(2026, 10, 29, 14, 0);

test("a hardcoded fallback is never shown silently: the last completed close wins (the 10/29 $32.97 bug)", () => {
  // At 2:00 PM ET on 10/29 the 10/29 daily bar is still in progress, so the last completed close is 10/28.
  const r = resolveDxyzPrice({ quote: { price: 32.97, quoteAsOf: null, isFallback: true, fallbackAsOf: "2026-08-19" }, historyRows: rows, historySource: "cache", now });
  assert.equal(r.price, 27.65);
  assert.equal(r.state, "last-close");
  assert.equal(r.asOfLabel, "2026-10-28 close");
  assert.match(dxyzPriceChip(r), /QUOTE FEED DOWN · LAST CLOSE 2026-10-28/);
  const evening = etCivilToUtc(2026, 10, 29, 18, 0);
  assert.equal(resolveDxyzPrice({ quote: null, historyRows: rows, now: evening }).price, 26.79);
});

test("a fresh Yahoo quote is used with its time and state", () => {
  const quoteAsOf = now - 60_000;
  const r = resolveDxyzPrice({ quote: { price: 27.02, quoteAsOf, isFallback: false }, historyRows: rows, now });
  assert.equal(r.price, 27.02);
  assert.equal(r.state, "live");
  assert.match(dxyzPriceChip(r), /^● LIVE · Oct 29, 2026, 1:59 PM ET$/);
});

test("with no history and only a fallback, the price is labelled as a dated fallback", () => {
  const r = resolveDxyzPrice({ quote: { price: 32.97, quoteAsOf: null, isFallback: true, fallbackAsOf: "2026-08-19" }, historyRows: [], now });
  assert.equal(r.state, "unavailable");
  assert.match(dxyzPriceChip(r), /FALLBACK · hardcoded 2026-08-19/);
  assert.equal(resolveDxyzPrice({ historyRows: [], now }).price, null);
});

test("a stale Yahoo print loses to a newer completed close; a fresher stale print beats an older close", () => {
  // Open session on Fri 10/30 at 10:15 ET; Yahoo still serving Wed 10/28's print.
  const fri = etCivilToUtc(2026, 10, 30, 10, 15);
  const oldPrint = { price: 27.6, quoteAsOf: etCivilToUtc(2026, 10, 28, 15, 59), isFallback: false };
  const r = resolveDxyzPrice({ quote: oldPrint, historyRows: rows, now: fri });
  assert.equal(r.state, "last-close");
  assert.equal(r.price, 26.79);
  // Same situation but history only reaches 10/27: the (stale) print is newer and is labelled STALE.
  const r2 = resolveDxyzPrice({ quote: oldPrint, historyRows: [{ date: "2026-10-27", close: 28.1 }], now: fri });
  assert.equal(r2.state, "stale");
  assert.equal(r2.price, 27.6);
  assert.match(dxyzPriceChip(r2), /^◐ STALE/);
});

test("a carried-over quote flagged servedFromCache is labelled CACHED, not LIVE", () => {
  const r = resolveDxyzPrice({ quote: { price: 27.02, quoteAsOf: now - 60_000, isFallback: false, servedFromCache: true }, historyRows: rows, now });
  assert.equal(r.state, "cached");
});
