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
  const r = resolveDxyzPrice({ quote: { price: 32.97, quoteAsOf: null, isFallback: true, fallbackAsOf: "2026-08-19" }, historyRows: rows, historySource: "cache", now });
  assert.equal(r.price, 26.79);
  assert.equal(r.state, "last-close");
  assert.equal(r.asOfLabel, "2026-10-29 close");
  assert.match(dxyzPriceChip(r), /QUOTE FEED DOWN · LAST CLOSE 2026-10-29/);
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
