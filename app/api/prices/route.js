import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const FALLBACK_PRICES = {
  SATS: 114.00,
  SPCX: 160.95,
  DXYZ: 12.50, // Let's use standard default or fetch
  VCX: 211.00,
  BOT: 15.00,
};

export async function GET() {
  const tickers = ["SATS", "SPCX", "DXYZ", "VCX", "BOT"];
  const prices = { ...FALLBACK_PRICES };

  await Promise.all(
    tickers.map(async (ticker) => {
      try {
        const response = await fetch(
          `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?interval=1m&range=1d`,
          {
            headers: {
              "User-Agent":
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
            },
            next: { revalidate: 60 }, // cache for 1 minute
          }
        );

        if (!response.ok) {
          console.warn(`Failed to fetch price for ${ticker}: ${response.statusText}`);
          return;
        }

        const data = await response.json();
        const result = data?.chart?.result?.[0];
        const regularMarketPrice = result?.meta?.regularMarketPrice;

        if (typeof regularMarketPrice === "number") {
          prices[ticker] = regularMarketPrice;
        }
      } catch (error) {
        console.error(`Error fetching price for ${ticker}:`, error);
      }
    })
  );

  return NextResponse.json(prices);
}
