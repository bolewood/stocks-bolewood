import assert from "node:assert/strict";
import { test } from "node:test";
import {
  averageDailyVolume,
  averageHourlyNotional,
  bracketMidpointT,
  createLastGood,
  etMidnightMs,
  expectedCloseT,
  gammaLeg,
  kalshiCandleMid,
  kalshiQuote,
  notionalSince,
  priorDailyNorm,
  trailingReturn,
  unusualMove,
  unusualMoveBand,
  valueAtOrBefore,
  volumeBand,
  volumeRatio,
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

test("24h volume norm excludes the trailing 24h from its own baseline", () => {
  // 7-day total 1300 with 400 in the last 24h → prior six days average 150.
  assert.equal(priorDailyNorm(400, 1300), 150);
  assert.ok(Math.abs(volumeRatio(400, priorDailyNorm(400, 1300)) - 400 / 150) < 1e-12);
  assert.equal(priorDailyNorm(400, 400), null, "no prior volume → no norm");
  assert.equal(priorDailyNorm(null, 1300), null);
});

test("volume bands", () => {
  assert.equal(volumeBand(0.5), "quiet");
  assert.equal(volumeBand(1), "normal");
  assert.equal(volumeBand(2), "busy");
  assert.equal(volumeBand(4), "heavy");
  assert.equal(volumeBand(null), null);
  assert.equal(volumeRatio(5, 0), null);
});

test("perp notional: last-hour sum and average hourly norm", () => {
  const h = 60 * 60 * 1000;
  const candles = [0, 1, 2, 3].map((i) => ({
    startMs: i * h,
    endMs: (i + 1) * h,
    close: 2000,
    volume: i + 1,
  }));
  assert.equal(notionalSince(candles, 2 * h), (3 + 4) * 2000);
  assert.equal(averageHourlyNotional(candles), ((1 + 2 + 3 + 4) * 2000) / 4);
});

test("average daily volume skips today and empty days", () => {
  const days = [
    { date: "2026-10-09", volume: 100 },
    { date: "2026-10-12", volume: null },
    { date: "2026-10-12", volume: 300 },
    { date: "2026-10-13", volume: 999 },
  ];
  assert.deepEqual(averageDailyVolume(days, "2026-10-13"), { average: 200, n: 2 });
});

test("unusual move: rolling window vs the mark, signed sigma, and today's peak", () => {
  const m = 60_000;
  // 5m candles from 00:00; a +2.6% spike lands in the candle ending at 00:30, then fades.
  const closes = [100, 100, 100, 100, 100, 102.6, 102.5, 102.4, 102.4, 102.4];
  const candles = closes.map((close, i) => ({ startMs: i * 5 * m, endMs: (i + 1) * 5 * m, open: close, close }));
  const sigma = 0.01;
  const now = 50 * m + 2 * m; // two minutes into the next candle
  const out = unusualMove(candles, sigma, { markPx: 102.0, now, sinceMs: 0 });
  // Mark 102.0 vs the close at or before 00:37 → candle ending 00:35 (102.5).
  assert.equal(out.fromMs, 35 * m);
  assert.ok(out.sigmas < 0, "signed: the mark is below 15 minutes ago");
  assert.equal(out.band, "calm");
  // Peak: 102.6 at 00:30 vs 100 at 00:15 → +2.6σ.
  assert.equal(out.peak.atMs, 30 * m);
  assert.ok(Math.abs(out.peak.sigmas - 2.6) < 1e-9);
  assert.equal(out.peak.band, "moving");
});

test("last-good carries a failed venue forward for up to 30 minutes, flagged", () => {
  const keep = createLastGood();
  const m = 60_000;
  assert.deepEqual(keep("pm", { p: 1 }, 0, []), { p: 1 });
  const reused = [];
  assert.deepEqual(keep("pm", null, 10 * m, reused), { p: 1 });
  assert.deepEqual(reused, ["pm"]);
  assert.deepEqual(keep("candles", [], 0, []), [], "nothing stored yet → stays empty");
  const late = [];
  assert.equal(keep("pm", null, 31 * m, late), null, "too old → blank, not stale data");
  assert.deepEqual(late, []);
});
