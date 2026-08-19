import { NextResponse } from "next/server";
import {
  FALLBACK_PRICES,
  WRAPPER_TICKERS,
} from "../../../lib/aiWrappers.mjs";
import { chartUrl, parseChartPrice } from "../../../lib/yahooQuote.mjs";

let cachedPrices = null;
let cacheTimestamp = 0;
const CACHE_TTL_MS = 60_000;

const YAHOO_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
};

async function fetchTickerPrice(ticker) {
  const response = await fetch(chartUrl(ticker), {
    headers: YAHOO_HEADERS,
    signal: AbortSignal.timeout(5000),
  });
  if (!response.ok) return null;
  const payload = await response.json();
  return parseChartPrice(payload, ticker);
}

export async function GET() {
  const now = Date.now();

  if (cachedPrices && now - cacheTimestamp < CACHE_TTL_MS) {
    return NextResponse.json({
      prices: cachedPrices,
      source: "cache",
      asOf: new Date(cacheTimestamp).toISOString(),
    });
  }

  const prices = { ...FALLBACK_PRICES };
  let liveCount = 0;

  await Promise.all(
    WRAPPER_TICKERS.map(async (ticker) => {
      try {
        const parsed = await fetchTickerPrice(ticker);
        if (!parsed) return;
        prices[ticker] = parsed.price;
        liveCount++;
      } catch {
        console.warn(`AI wrapper price fetch failed for ${ticker}`);
      }
    })
  );

  const source =
    liveCount === WRAPPER_TICKERS.length
      ? "live"
      : liveCount > 0
        ? "partial"
        : "fallback";

  if (liveCount > 0) {
    cachedPrices = { ...prices };
    cacheTimestamp = now;
  }

  return NextResponse.json({
    prices,
    source,
    asOf: new Date(now).toISOString(),
  });
}
