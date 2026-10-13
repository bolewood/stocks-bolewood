import assert from "node:assert/strict";
import { test } from "node:test";
import {
  bracketMidpointT,
  etMidnightMs,
  expectedCloseT,
  gammaLeg,
  kalshiCandleMid,
  kalshiQuote,
  trailingReturn,
  unusualMoveBand,
  valueAtOrBefore,
} from "../lib/investorDay.mjs";

test("bracket midpoints, including open-ended tails", () => {
  assert.equal(bracketMidpointT("<$1.25T"), 1.125);
  assert.equal(bracketMidpointT("$1.75–$2.0T"), 1.875);
  assert.equal(bracketMidpointT("$3.0T+"), 3.125);
  assert.equal(bracketMidpointT("No IPO by December 31, 2027"), null);
});

test("expected close reproduces the Oct 13 brief snapshot (~$2.1T)", () => {
  const snapshot = [
    ["<$1.25T", 0.024], ["$1.25–$1.5T", 0.046], ["$1.5–$1.75T", 0.1015],
    ["$1.75–$2.0T", 0.255], ["$2.0–$2.25T", 0.268], ["$2.25–$2.5T", 0.17],
    ["$2.5–$2.75T", 0.0805], ["$2.75–$3.0T", 0.037], ["$3.0T+", 0.0475],
  ].map(([label, price]) => ({ label, price, midT: bracketMidpointT(label) }));
  const out = expectedCloseT(snapshot);
  assert.ok(Math.abs(out.valueT - 2.11) < 0.01, `got ${out.valueT}`);
  assert.ok(out.probabilitySum > 1, "overround is normalized away");
});

test("gammaLeg parses JSON-string fields and picks the named outcome", () => {
  const market = {
    groupItemTitle: "",
    question: "Anthropic vs OpenAI",
    outcomes: '["Anthropic", "OpenAI"]',
    outcomePrices: '["0.92", "0.08"]',
    clobTokenIds: '["111", "222"]',
    bestBid: 0.91,
    bestAsk: 0.93,
  };
  const anth = gammaLeg(market, "Anthropic");
  assert.equal(anth.price, 0.92);
  assert.equal(anth.tokenId, "111");
  const oai = gammaLeg(market, "OpenAI");
  assert.equal(oai.price, 0.08);
  assert.equal(oai.bid, null);
  assert.equal(gammaLeg(market), null, "no Yes outcome in a head-to-head market");
});

test("Kalshi quotes use the *_dollars fields and a bid/ask mid", () => {
  const q = kalshiQuote({ yes_bid_dollars: "0.6600", yes_ask_dollars: "0.7000", last_price_dollars: "0.7000" });
  assert.ok(Math.abs(q.mid - 0.68) < 1e-9);
  assert.equal(kalshiQuote({ last_price_dollars: "0.5" }).mid, 0.5);
  assert.equal(
    kalshiCandleMid({ yes_bid: { close_dollars: "0.70" }, yes_ask: { close_dollars: "0.72" } }),
    0.71
  );
});

test("valueAtOrBefore picks the last point not after the timestamp", () => {
  const pts = [{ t: 10, p: 1 }, { t: 20, p: 2 }, { t: 30, p: 3 }];
  assert.equal(valueAtOrBefore(pts, 25).p, 2);
  assert.equal(valueAtOrBefore(pts, 5), null);
});

test("unusual-move bands and trailing 15m return", () => {
  assert.equal(unusualMoveBand(1.2), "calm");
  assert.equal(unusualMoveBand(2), "moving");
  assert.equal(unusualMoveBand(3.5), "something");
  const m = 60_000;
  const candles = [0, 5, 10, 15, 20].map((start, i) => ({
    startMs: start * m,
    endMs: (start + 5) * m,
    close: 100 + i,
  }));
  const r = trailingReturn(candles);
  assert.equal(r.fromMs, 10 * m);
  assert.ok(Math.abs(r.value - (104 / 101 - 1)) < 1e-12);
});

test("midnight ET is the start of the ET calendar day", () => {
  // 2026-10-14 13:00 UTC is 09:00 EDT → midnight EDT is 04:00 UTC.
  assert.equal(etMidnightMs(Date.UTC(2026, 9, 14, 13)), Date.UTC(2026, 9, 14, 4));
});
