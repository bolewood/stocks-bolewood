import { NextResponse } from "next/server";
import { fetchChartPrice } from "../../../lib/yahooQuote.mjs";

// Fallback prices used when the upstream feed is unavailable
const FALLBACK_PRICES = {
  ECHO: 88.58, // 2026-08-19
  SPCX: 138.62, // 2026-08-19
  DXYZ: 32.97, // 2026-08-19
  VCX: 40.0, // 2026-08-19
  BOT: 28.04, // 2026-08-19
};

const TICKERS = ["ECHO", "SPCX", "DXYZ", "VCX", "BOT"];

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
    TICKERS.map(async (ticker) => {
      try {
        const parsed = await fetchChartPrice(ticker);
        if (!parsed) return;
        prices[ticker] = parsed.price;
        liveCount++;
      } catch {
        console.warn(`Price fetch failed for ${ticker}`);
      }
    })
  );

  // Transition alias: pre-migration client bundles still read prices.SATS.
  // Remove once cached bundles from before 2026-07-10 have aged out.
  prices.SATS = prices.ECHO;

  const source =
    liveCount === TICKERS.length ? "live" : liveCount > 0 ? "partial" : "fallback";

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
