import { NextResponse } from "next/server";
import { BOOK_PRICE_TICKERS } from "../../../lib/reportedBook.mjs";
import { fetchChartPrice } from "../../../lib/yahooQuote.mjs";
import { classifyQuote, worstPriceState } from "../../../lib/priceState.mjs";
import {
  PRICE_CDN_HEADERS,
  YAHOO_FETCH_CONCURRENCY,
  createLiveQuoteCache,
  mapLimit,
} from "../../../lib/liveQuoteCache.mjs";

export const dynamic = "force-dynamic";

const cache = createLiveQuoteCache();

function emptyQuote() {
  return { price: null, quoteAsOf: null, isFallback: true };
}

function jsonBody(payload, servedFromCache, now) {
  const quotes = {};
  for (const ticker of BOOK_PRICE_TICKERS) {
    const q = payload.quotes[ticker] || emptyQuote();
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
  return {
    prices: Object.fromEntries(BOOK_PRICE_TICKERS.map((ticker) => [ticker, quotes[ticker].price])),
    quotes,
    source: worstPriceState(BOOK_PRICE_TICKERS.map((ticker) => quotes[ticker].state)),
    fetchedAt: payload.fetchedAt,
    cacheWrittenAt: payload.cacheWrittenAt,
    asOf: payload.fetchedAt,
  };
}

async function fetchLive(prev) {
  const now = Date.now();
  const quotes = { ...(prev?.quotes || {}) };
  let liveCount = 0;
  await mapLimit(BOOK_PRICE_TICKERS, YAHOO_FETCH_CONCURRENCY, async (ticker) => {
    try {
      const parsed = await fetchChartPrice(ticker);
      if (!parsed) return;
      quotes[ticker] = { price: parsed.price, quoteAsOf: parsed.quoteAsOf, isFallback: false };
      liveCount++;
    } catch {
      console.warn(`Book price fetch failed for ${ticker}`);
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
