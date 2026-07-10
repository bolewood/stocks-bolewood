import { NextResponse } from "next/server";

// Fallback prices used when the upstream feed is unavailable
const FALLBACK_PRICES = {
  ECHO: 95.88, // 2026-07-09; ticker changed from SATS on 6/24/26
  SPCX: 148.53, // 2026-07-09
  DXYZ: 27.60, // 2026-07-09 close
  VCX: 69.17, // 2026-07-09 close
  BOT: 15.00,
};

// Cache: store last successful fetch in-memory across requests
let cachedPrices = null;
let cacheTimestamp = 0;
const CACHE_TTL_MS = 60_000; // 60 seconds

export async function GET() {
  const now = Date.now();

  // Serve from cache if fresh
  if (cachedPrices && now - cacheTimestamp < CACHE_TTL_MS) {
    return NextResponse.json({
      prices: cachedPrices,
      source: "cache",
      asOf: new Date(cacheTimestamp).toISOString(),
    });
  }

  const tickers = ["ECHO", "SPCX", "DXYZ", "VCX", "BOT"];
  const prices = { ...FALLBACK_PRICES };
  let liveCount = 0;

  await Promise.all(
    tickers.map(async (ticker) => {
      try {
        const response = await fetch(
          `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?interval=1d&range=1d`,
          {
            headers: {
              "User-Agent":
                "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
            },
            signal: AbortSignal.timeout(5000), // 5s timeout per ticker
          }
        );

        if (!response.ok) return;

        const data = await response.json();
        const price = data?.chart?.result?.[0]?.meta?.regularMarketPrice;

        if (typeof price === "number" && price > 0) {
          prices[ticker] = price;
          liveCount++;
        }
      } catch {
        // Silently fall back — logged server-side only
        console.warn(`Price fetch failed for ${ticker}`);
      }
    })
  );

  // Transition alias: pre-migration client bundles still read prices.SATS.
  // Remove once cached bundles from before 2026-07-10 have aged out.
  prices.SATS = prices.ECHO;

  const source = liveCount === tickers.length ? "live" : liveCount > 0 ? "partial" : "fallback";

  // Update cache only if we got at least one live price
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
