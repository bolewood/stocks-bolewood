import { NextResponse } from "next/server";
import { fetchChartPrice, fetchListedChartPrice } from "../../../lib/yahooQuote.mjs";
import { classifyQuote } from "../../../lib/priceState.mjs";
import ipoTapeData from "../../../data/anthropic-investor-day.json";
import {
  PRICE_CDN_HEADERS,
  YAHOO_FETCH_CONCURRENCY,
  createLiveQuoteCache,
  mapLimit,
} from "../../../lib/liveQuoteCache.mjs";

export const dynamic = "force-dynamic";

// Last-resort values only. Each is served with isFallback + fallbackAsOf in
// `quotes`, so clients can refuse to show them silently (/dxyz falls back to
// the last completed close from /api/dxyz-history instead).
const FALLBACK_AS_OF = {
  ECHO: "2026-08-19",
  SPCX: "2026-08-19",
  DXYZ: "2026-08-19",
  VCX: "2026-08-19",
  SFTBY: "2026-08-24",
  ARM: "2026-08-24",
  TOKYO9984: "2026-08-24",
  USDJPY: "2026-08-24",
};
const FALLBACK_PRICES = {
  ECHO: 88.58, // 2026-08-19
  SPCX: 138.62, // 2026-08-19
  DXYZ: 32.97, // 2026-08-19
  VCX: 40.0, // 2026-08-19
  SFTBY: 16.53, // 2026-08-24
  ARM: 238, // 2026-08-24
  TOKYO9984: 5255, // 2026-08-24
  USDJPY: 159, // 2026-08-24
};

const TICKERS = [
  { yahoo: "ECHO", key: "ECHO" },
  { yahoo: "SPCX", key: "SPCX" },
  { yahoo: "DXYZ", key: "DXYZ" },
  { yahoo: "VCX", key: "VCX" },
  { yahoo: "SFTBY", key: "SFTBY" },
  { yahoo: "ARM", key: "ARM" },
  { yahoo: "9984.T", key: "TOKYO9984" },
  { yahoo: "USDJPY=X", key: "USDJPY" },
];

// ANT (Anthropic, Nasdaq) once listed: guarded so a recycled ticker or a
// pre-listing quote never reaches /dxyz. Null until the first Nasdaq trade.
const ANT_LISTING_DATE = ipoTapeData.lockupSchedule?.pricingDate || null;

function fallbackQuotes() {
  return Object.fromEntries(
    TICKERS.map(({ key }) => [key, { price: FALLBACK_PRICES[key], quoteAsOf: null, isFallback: true, fallbackAsOf: FALLBACK_AS_OF[key] }])
  );
}

const cache = createLiveQuoteCache();

function withAlias(prices) {
  // Transition alias: pre-migration client bundles still read prices.SATS.
  // Remove once cached bundles from before 2026-07-10 have aged out.
  return { ...prices, SATS: prices.ECHO };
}

async function loadAnt(now) {
  if (!ANT_LISTING_DATE || now < Date.parse(`${ANT_LISTING_DATE}T00:00:00Z`)) return null;
  try {
    const q = await fetchListedChartPrice("ANT", { listingDate: ANT_LISTING_DATE, issuerPattern: /anthropic/i });
    return q ? { price: q.price, quoteAsOf: q.quoteAsOf, isFallback: false, exchange: q.exchange } : null;
  } catch {
    return null;
  }
}

async function fetchLive(prev) {
  // Quotes carried over from the previous payload are marked so a partial
  // refresh never labels them as freshly fetched.
  const quotes = Object.fromEntries(
    Object.entries(prev?.quotes || fallbackQuotes()).map(([k, q]) => [k, q.isFallback ? q : { ...q, carriedFromCache: true }])
  );
  let liveCount = 0;

  await mapLimit(TICKERS, YAHOO_FETCH_CONCURRENCY, async ({ yahoo, key }) => {
    try {
      const parsed = await fetchChartPrice(yahoo);
      if (!parsed) return;
      quotes[key] = { price: parsed.price, quoteAsOf: parsed.quoteAsOf, isFallback: false };
      liveCount++;
    } catch {
      console.warn(`Price fetch failed for ${yahoo}`);
    }
  });
  const ant = await loadAnt(Date.now());
  if (ant) quotes.ANT = ant;
  const antStale = !ant && !!quotes.ANT;
  const anyLive = liveCount > 0 || Boolean(ant);
  const prices = Object.fromEntries(Object.entries(quotes).map(([k, q]) => [k, q.price]));

  const source =
    liveCount === TICKERS.length && !antStale
      ? "live"
      : anyLive
        ? "partial"
        : prev
          ? "cache"
          : "fallback";

  return {
    ok: anyLive,
    payload: {
      prices: withAlias(prices),
      quotes,
      source,
      asOf: new Date().toISOString(),
    },
  };
}

export async function GET() {
  const { payload, servedFromCache, reason } = await cache.load(
    Date.now(),
    fetchLive
  );
  const source = servedFromCache
    ? reason === "last-good" || reason === "backoff"
      ? "cache"
      : payload.source === "live"
        ? "cache"
        : payload.source
    : payload.source;
  const now = Date.now();
  const quotes = Object.fromEntries(
    Object.entries(payload.quotes || {}).map(([k, { carriedFromCache, ...q }]) => {
      const cached = servedFromCache || !!carriedFromCache;
      return [k, { ...q, servedFromCache: cached, state: classifyQuote({ quoteAsOf: q.quoteAsOf, servedFromCache: cached, isFallback: q.isFallback }, now) }];
    })
  );
  return NextResponse.json(
    {
      prices: payload.prices,
      quotes,
      source,
      asOf: payload.asOf,
    },
    { headers: PRICE_CDN_HEADERS }
  );
}
