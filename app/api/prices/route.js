import { NextResponse } from "next/server";
import { fetchChartPrice } from "../../../lib/yahooQuote.mjs";
import {
  PRICE_CDN_HEADERS,
  YAHOO_FETCH_CONCURRENCY,
  createLiveQuoteCache,
  mapLimit,
} from "../../../lib/liveQuoteCache.mjs";

export const dynamic = "force-dynamic";

const FALLBACK_PRICES = {
  ECHO: 88.58, // 2026-08-19
  SPCX: 138.62, // 2026-08-19
  DXYZ: 32.97, // 2026-08-19
  VCX: 40.0, // 2026-08-19
  BOT: 28.04, // 2026-08-19
};

const TICKERS = ["ECHO", "SPCX", "DXYZ", "VCX", "BOT"];

const cache = createLiveQuoteCache();

function withAlias(prices) {
  // Transition alias: pre-migration client bundles still read prices.SATS.
  // Remove once cached bundles from before 2026-07-10 have aged out.
  return { ...prices, SATS: prices.ECHO };
}

async function fetchLive(prev) {
  const prices = { ...(prev?.prices || FALLBACK_PRICES) };
  let liveCount = 0;

  await mapLimit(TICKERS, YAHOO_FETCH_CONCURRENCY, async (ticker) => {
    try {
      const parsed = await fetchChartPrice(ticker);
      if (!parsed) return;
      prices[ticker] = parsed.price;
      liveCount++;
    } catch {
      console.warn(`Price fetch failed for ${ticker}`);
    }
  });

  const source =
    liveCount === TICKERS.length
      ? "live"
      : liveCount > 0
        ? "partial"
        : prev
          ? "cache"
          : "fallback";

  return {
    ok: liveCount > 0,
    payload: {
      prices: withAlias(prices),
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
  return NextResponse.json(
    {
      prices: payload.prices,
      source,
      asOf: payload.asOf,
    },
    { headers: PRICE_CDN_HEADERS }
  );
}
