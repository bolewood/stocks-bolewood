// Parse Yahoo v8 finance/chart payloads. The v7 quote and v10 quoteSummary
// endpoints are crumb/cookie-gated (401). Chart meta carries price only —
// no sharesOutstanding or marketCap.

export function parseChartPrice(payload, ticker) {
  const meta = payload?.chart?.result?.[0]?.meta;
  if (!meta) return null;
  // Recycled-ticker guard: drop the quote unless Yahoo confirms the symbol.
  if (meta.symbol !== ticker) return null;
  const price = meta.regularMarketPrice;
  if (typeof price !== "number" || !(price > 0)) return null;
  const t = meta.regularMarketTime;
  const quoteAsOf =
    typeof t === "number" && t > 0 ? (t > 1e12 ? t : t * 1000) : null;
  return { ticker, price, quoteAsOf };
}

export const YAHOO_CHART_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
};

export const YAHOO_CHART_HOSTS = [
  "query1.finance.yahoo.com",
  "query2.finance.yahoo.com",
];

export function chartUrl(ticker, host = YAHOO_CHART_HOSTS[0]) {
  return `https://${host}/v8/finance/chart/${encodeURIComponent(
    ticker
  )}?interval=1d&range=1d`;
}

export async function fetchChartPrice(ticker, { timeoutMs = 5000 } = {}) {
  for (const host of YAHOO_CHART_HOSTS) {
    try {
      const response = await fetch(chartUrl(ticker, host), {
        headers: YAHOO_CHART_HEADERS,
        cache: "no-store",
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (response.status === 429 || response.status === 503) continue;
      if (!response.ok) continue;
      const parsed = parseChartPrice(await response.json(), ticker);
      if (parsed) return parsed;
    } catch {
      continue;
    }
  }
  return null;
}
