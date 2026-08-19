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
  return { ticker, price };
}

export const YAHOO_CHART_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
};

export function chartUrl(ticker) {
  return `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
    ticker
  )}?interval=1d&range=1d`;
}

export async function fetchChartPrice(ticker, { timeoutMs = 5000 } = {}) {
  const response = await fetch(chartUrl(ticker), {
    headers: YAHOO_CHART_HEADERS,
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!response.ok) return null;
  const payload = await response.json();
  return parseChartPrice(payload, ticker);
}
