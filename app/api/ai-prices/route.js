import { NextResponse } from "next/server";
import {
  FALLBACK_PRICES,
  WRAPPER_TICKERS,
} from "../../../lib/aiWrappers.mjs";
import { fetchChartPrice } from "../../../lib/yahooQuote.mjs";

let cachedPrices = null;
let cacheTimestamp = 0;
const CACHE_TTL_MS = 60_000;

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
        const parsed = await fetchChartPrice(ticker);
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
