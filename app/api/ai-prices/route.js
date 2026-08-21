import { NextResponse } from "next/server";
import {
  FALLBACK_PRICES,
  WRAPPER_TICKERS,
} from "../../../lib/aiWrappers.mjs";
import { fetchChartPrice } from "../../../lib/yahooQuote.mjs";
import {
  classifyQuote,
  worstPriceState,
} from "../../../lib/priceState.mjs";
import {
  PRICE_CDN_HEADERS,
  YAHOO_FETCH_CONCURRENCY,
  createLiveQuoteCache,
  mapLimit,
} from "../../../lib/liveQuoteCache.mjs";

export const dynamic = "force-dynamic";

const cache = createLiveQuoteCache();

function fallbackQuotes() {
  const quotes = {};
  for (const ticker of WRAPPER_TICKERS) {
    quotes[ticker] = {
      price: FALLBACK_PRICES[ticker],
      quoteAsOf: null,
      isFallback: true,
    };
  }
  return quotes;
}

function jsonBody(payload, servedFromCache, now) {
  const quotes = {};
  for (const ticker of WRAPPER_TICKERS) {
    const q = payload.quotes[ticker] || fallbackQuotes()[ticker];
    quotes[ticker] = {
      ...q,
      state: classifyQuote(
        {
          quoteAsOf: q.quoteAsOf,
          servedFromCache,
          isFallback: q.isFallback,
        },
        now
      ),
    };
  }
  const states = WRAPPER_TICKERS.map((t) => quotes[t].state);
  return {
    prices: Object.fromEntries(
      WRAPPER_TICKERS.map((t) => [t, quotes[t].price])
    ),
    quotes,
    source: worstPriceState(states),
    fetchedAt: payload.fetchedAt,
    cacheWrittenAt: payload.cacheWrittenAt,
    asOf: payload.fetchedAt,
  };
}

async function fetchLive(prev) {
  const now = Date.now();
  const quotes = { ...(prev?.quotes || fallbackQuotes()) };
  let liveCount = 0;

  await mapLimit(WRAPPER_TICKERS, YAHOO_FETCH_CONCURRENCY, async (ticker) => {
    try {
      const parsed = await fetchChartPrice(ticker);
      if (!parsed) return;
      quotes[ticker] = {
        price: parsed.price,
        quoteAsOf: parsed.quoteAsOf,
        isFallback: false,
      };
      liveCount++;
    } catch {
      console.warn(`AI wrapper price fetch failed for ${ticker}`);
    }
  });

  return {
    ok: liveCount > 0,
    payload: {
      quotes,
      fetchedAt: now,
      cacheWrittenAt: liveCount > 0 ? now : prev?.cacheWrittenAt || null,
    },
  };
}

export async function GET() {
  const now = Date.now();
  const { payload, servedFromCache } = await cache.load(now, fetchLive);
  return NextResponse.json(jsonBody(payload, servedFromCache, now), {
    headers: PRICE_CDN_HEADERS,
  });
}
