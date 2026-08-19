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

let cache = null;
const CACHE_TTL_MS = 60_000;

function fallbackQuotes() {
  const quotes = {};
  for (const ticker of WRAPPER_TICKERS) {
    quotes[ticker] = {
      price: FALLBACK_PRICES[ticker],
      quoteAsOf: null,
      isFallback: true,
      state: "unavailable",
    };
  }
  return quotes;
}

export async function GET() {
  const now = Date.now();
  const servedFromCache = !!(cache && now - cache.cacheWrittenAt < CACHE_TTL_MS);

  if (servedFromCache) {
    const quotes = {};
    for (const ticker of WRAPPER_TICKERS) {
      const q = cache.quotes[ticker];
      quotes[ticker] = {
        ...q,
        state: classifyQuote(
          {
            quoteAsOf: q.quoteAsOf,
            servedFromCache: true,
            isFallback: q.isFallback,
          },
          now
        ),
      };
    }
    const states = WRAPPER_TICKERS.map((t) => quotes[t].state);
    return NextResponse.json({
      prices: Object.fromEntries(
        WRAPPER_TICKERS.map((t) => [t, quotes[t].price])
      ),
      quotes,
      source: worstPriceState(states),
      fetchedAt: cache.fetchedAt,
      cacheWrittenAt: cache.cacheWrittenAt,
      asOf: cache.fetchedAt,
    });
  }

  const fetchedAt = now;
  const quotes = fallbackQuotes();
  let liveCount = 0;

  await Promise.all(
    WRAPPER_TICKERS.map(async (ticker) => {
      try {
        const parsed = await fetchChartPrice(ticker);
        if (!parsed) return;
        quotes[ticker] = {
          price: parsed.price,
          quoteAsOf: parsed.quoteAsOf,
          isFallback: false,
          state: classifyQuote(
            {
              quoteAsOf: parsed.quoteAsOf,
              servedFromCache: false,
              isFallback: false,
            },
            now
          ),
        };
        liveCount++;
      } catch {
        console.warn(`AI wrapper price fetch failed for ${ticker}`);
      }
    })
  );

  const states = WRAPPER_TICKERS.map((t) => quotes[t].state);
  const source = worstPriceState(states);
  const cacheWrittenAt = liveCount > 0 ? now : cache?.cacheWrittenAt || null;

  if (liveCount > 0) {
    cache = { quotes: { ...quotes }, fetchedAt, cacheWrittenAt };
  }

  return NextResponse.json({
    prices: Object.fromEntries(
      WRAPPER_TICKERS.map((t) => [t, quotes[t].price])
    ),
    quotes,
    source,
    fetchedAt,
    cacheWrittenAt,
    asOf: fetchedAt,
  });
}
