// Pure helpers for /investor-day. The route owns fetching; this module owns
// parsing, baselines, and the arithmetic so it can be unit-tested offline.

import { etCivilToUtc } from "./priceState.mjs";
import { etDateKey } from "./privateTape.mjs";

export const INVESTOR_DAY_POLL_MS = 15_000;
export const MINUTE_MS = 60 * 1000;
export const UNUSUAL_WINDOW_MS = 15 * MINUTE_MS;

export const PERP_COINS = { anthropic: "io:ANTH", openai: "io:OAI" };

export const POLYMARKET_SLUGS = {
  closingCap: "anthropic-ipo-closing-market-cap-higher-strikes",
  ipoBy: "anthropic-ipo-by",
  bestModel: "which-company-has-the-best-ai-model-end-of-october",
  vsOpenai: "anthropic-vs-openai-higher-valuation-on-december-31",
};

// Legs of anthropic-ipo-by shown on the page, matched on groupItemTitle.
export const IPO_BY_LEGS = ["November 15, 2026", "November 30, 2026", "December 31, 2026"];

export const KALSHI_MARKETS = [
  { key: "ipoBefore2027", series: "KXIPO", ticker: "KXIPO-26-ANTHROPIC", label: "Anthropic IPO before 2027" },
  { key: "announceByDec1", series: "KXIPOANTHROPIC", ticker: "KXIPOANTHROPIC-DATE-26DEC01", label: "IPO announced before Dec 1" },
  { key: "bestModelOct", series: "KXLLM1", ticker: "KXLLM1-26OCT31-A", label: "Claude best AI end of October" },
];

// heldAs: the disclosure lists the GOOG share class; GOOGL is the proxy quoted.
export const PROXIES = [
  { ticker: "DXYZ", note: "Destiny Tech100" },
  { ticker: "VCX", note: "Fundrise Innovation Fund" },
  { ticker: "LAZR", note: "Tema Photonics & Optical ETF" },
  { ticker: "AGIX", note: "KraneShares Public-Private AI ETF" },
  { ticker: "ZM", note: "Zoom Communications" },
  { ticker: "SKM", note: "SK Telecom" },
  { ticker: "AMZN", note: "Amazon" },
  { ticker: "GOOGL", heldAs: "GOOG", note: "Alphabet Class A" },
];
export const MARKET_CONTROL = "QQQ";

// Open-ended closing-cap brackets are centred half a bracket (0.125T) past
// their bound: "<$1.25T" → 1.125T, "$3.0T+" → 3.125T.
export const BRACKET_TAIL_HALF_WIDTH_T = 0.125;

export function etMidnightMs(now = Date.now()) {
  const [y, m, d] = etDateKey(now).split("-").map(Number);
  return etCivilToUtc(y, m, d, 0, 0);
}

export function num(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

// Gamma ships outcomes / outcomePrices / clobTokenIds as JSON strings.
export function jsonArray(value) {
  if (Array.isArray(value)) return value;
  if (typeof value !== "string") return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function pctChange(from, to) {
  return from > 0 && Number.isFinite(to) ? to / from - 1 : null;
}

// Yes-side price, token, and book for one Gamma market. `outcome` picks the
// side by name (e.g. "Anthropic" in the vs-OpenAI market); default "Yes".
export function gammaLeg(market, outcome = "Yes") {
  const outcomes = jsonArray(market?.outcomes);
  const prices = jsonArray(market?.outcomePrices);
  const tokens = jsonArray(market?.clobTokenIds);
  const i = outcomes.indexOf(outcome);
  if (i < 0) return null;
  const price = num(prices[i]);
  if (price == null) return null;
  const isYes = i === 0;
  return {
    label: market.groupItemTitle || market.question || outcome,
    question: market.question ?? null,
    price,
    // Gamma bestBid/bestAsk quote the first outcome only.
    bid: isYes ? num(market.bestBid) : null,
    ask: isYes ? num(market.bestAsk) : null,
    tokenId: tokens[i] ?? null,
  };
}

export function findMarket(event, groupItemTitle) {
  return (event?.markets || []).find((m) => m.groupItemTitle === groupItemTitle) ?? null;
}

// "<$1.25T" | "$1.25–$1.5T" | "$3.0T+" → midpoint in $T, or null for
// non-bracket legs such as "No IPO by December 31, 2027".
export function bracketMidpointT(label) {
  const s = String(label || "");
  const nums = (s.match(/\d+(?:\.\d+)?/g) || []).map(Number);
  if (!/T/.test(s) || !nums.length) return null;
  if (s.trim().startsWith("<")) return nums[0] - BRACKET_TAIL_HALF_WIDTH_T;
  if (s.trim().endsWith("+")) return nums[0] + BRACKET_TAIL_HALF_WIDTH_T;
  if (nums.length >= 2) return (nums[0] + nums[1]) / 2;
  return null;
}

// Probability-weighted expected first-day close, normalized for overround.
export function expectedCloseT(brackets, key = "price") {
  let weight = 0;
  let sum = 0;
  for (const b of brackets) {
    const p = b?.[key];
    if (!Number.isFinite(p) || !Number.isFinite(b.midT)) continue;
    weight += p;
    sum += p * b.midT;
  }
  return weight > 0 ? { valueT: sum / weight, probabilitySum: weight } : null;
}

// Last point at or before ms. points: [{ t: ms, p }] in any order.
export function valueAtOrBefore(points, ms) {
  let best = null;
  for (const pt of points || []) {
    if (!(pt.t <= ms) || !Number.isFinite(pt.p)) continue;
    if (!best || pt.t > best.t) best = pt;
  }
  return best;
}

export function bidAskMid(bid, ask, fallback = null) {
  if (bid > 0 && ask > 0 && ask >= bid) return (bid + ask) / 2;
  return Number.isFinite(fallback) ? fallback : null;
}

export function kalshiQuote(market) {
  const bid = num(market?.yes_bid_dollars);
  const ask = num(market?.yes_ask_dollars);
  const last = num(market?.last_price_dollars);
  return {
    bid,
    ask,
    last,
    mid: bidAskMid(bid, ask, last),
    previous: num(market?.previous_price_dollars),
    volume24h: num(market?.volume_24h_fp),
    title: market?.title ?? null,
    subtitle: market?.yes_sub_title ?? null,
    status: market?.status ?? null,
  };
}

// Kalshi candlestick → bid/ask mid at the candle close, falling back to last.
export function kalshiCandleMid(candle) {
  return bidAskMid(
    num(candle?.yes_bid?.close_dollars),
    num(candle?.yes_ask?.close_dollars),
    num(candle?.price?.close_dollars) ?? num(candle?.price?.previous_dollars)
  );
}

export function simpleReturns(closes) {
  const out = [];
  for (let i = 1; i < closes.length; i++) {
    if (closes[i - 1] > 0 && closes[i] > 0) out.push(closes[i] / closes[i - 1] - 1);
  }
  return out;
}

export function stdev(values) {
  const xs = values.filter(Number.isFinite);
  if (xs.length < 2) return null;
  const mean = xs.reduce((a, b) => a + b, 0) / xs.length;
  const v = xs.reduce((a, b) => a + (b - mean) ** 2, 0) / (xs.length - 1);
  return Math.sqrt(v);
}

export function unusualMoveBand(sigmas) {
  if (!Number.isFinite(sigmas)) return null;
  if (sigmas < 1.5) return "calm";
  if (sigmas <= 3) return "moving";
  return "something";
}

// candles: [{ startMs, endMs, open, close }] sorted ascending.
// Return over the trailing window ending at the latest close.
export function trailingReturn(candles, windowMs = UNUSUAL_WINDOW_MS) {
  if (!candles?.length) return null;
  const last = candles[candles.length - 1];
  const target = last.endMs - windowMs;
  let base = null;
  for (const c of candles) {
    if (c.endMs <= target) base = c;
    else break;
  }
  if (!base) return null;
  return { value: pctChange(base.close, last.close), fromMs: base.endMs, toMs: last.endMs };
}

export function unusualMove(candles5m, sigma15m) {
  const r = trailingReturn(candles5m);
  if (!r || !(sigma15m > 0)) return { current: r?.value ?? null, sigma15m, sigmas: null, band: null };
  const sigmas = Math.abs(r.value) / sigma15m;
  return { current: r.value, fromMs: r.fromMs, toMs: r.toMs, sigma15m, sigmas, band: unusualMoveBand(sigmas) };
}

// First candle opening at or after ms → its open (the price "at" ms).
export function openAtOrAfter(candles, ms) {
  const c = (candles || []).find((row) => row.startMs >= ms);
  return c ? c.open : null;
}

// ---- Volume vs normal ----------------------------------------------------

export const VOLUME_BANDS = [
  { key: "quiet", label: "Quiet", max: 0.75 },
  { key: "normal", label: "Normal", max: 1.5 },
  { key: "busy", label: "Busy", max: 3 },
  { key: "heavy", label: "Heavy", max: Infinity },
];

export function volumeBand(ratio) {
  if (!Number.isFinite(ratio)) return null;
  return VOLUME_BANDS.find((b) => ratio < b.max)?.key ?? "heavy";
}

export function volumeRatio(current, normal) {
  return Number.isFinite(current) && normal > 0 ? current / normal : null;
}

// Average day over the six days before the trailing 24h. A 7-day total
// already contains the last 24h, so it must not sit in its own baseline.
export function priorDailyNorm(volume24h, volume7d) {
  if (!Number.isFinite(volume24h) || !Number.isFinite(volume7d)) return null;
  const prior = volume7d - volume24h;
  return prior > 0 ? prior / 6 : null;
}

// candles: [{ startMs, close, volume }] with volume in base units.
export function notionalSince(candles, fromMs) {
  let sum = 0;
  for (const c of candles || []) {
    if (c.startMs >= fromMs && c.volume > 0 && c.close > 0) sum += c.volume * c.close;
  }
  return sum;
}

// Mean notional per hour across a candle set (any interval).
export function averageHourlyNotional(candles) {
  if (!candles?.length) return null;
  const first = candles[0].startMs;
  const last = candles[candles.length - 1].endMs;
  const hours = (last - first) / (60 * MINUTE_MS);
  if (!(hours > 0)) return null;
  return notionalSince(candles, first) / hours;
}

// Average of completed daily volumes, excluding the given date.
// days: [{ date: "YYYY-MM-DD", volume }]
export function averageDailyVolume(days, excludeDate, maxDays = 20) {
  const rows = (days || [])
    .filter((d) => d.date !== excludeDate && d.volume > 0)
    .slice(-maxDays);
  if (!rows.length) return null;
  return { average: rows.reduce((a, d) => a + d.volume, 0) / rows.length, n: rows.length };
}
