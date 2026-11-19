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

// Nasdaq exchange codes Yahoo uses in chart meta.exchangeName.
export const NASDAQ_EXCHANGES = ["NMS", "NGM", "NCM", "NasdaqGS"];

// Shares traded in the payload's bars (interval=1d&range=1d: today's bar).
function chartVolume(payload) {
  const volumes = payload?.chart?.result?.[0]?.indicators?.quote?.[0]?.volume;
  return Array.isArray(volumes) ? volumes.reduce((sum, v) => sum + (v > 0 ? v : 0), 0) : 0;
}

// Listing-day guard for a newly listed (possibly recycled) ticker such as ANT:
// accept only a Nasdaq quote that is really trading on or after the listing date.
// listingDate: "YYYY-MM-DD" (UTC midnight).
//  - firstTradeDate before the listing date means another issuer: reject.
//  - firstTradeDate on/after the listing date: accept.
//  - No firstTradeDate (Yahoo can lag on IPO day, and shows the IPO price as a
//    placeholder before the first trade): accept only with traded volume, a
//    quote time on/after the listing date, and, when given, a matching issuer
//    name. So a pre-open placeholder is never labelled as a live price.
export function parseListedChartPrice(payload, ticker, { listingDate, exchanges = NASDAQ_EXCHANGES, issuerPattern = null } = {}) {
  const base = parseChartPrice(payload, ticker);
  if (!base) return null;
  const meta = payload.chart.result[0].meta;
  if (!exchanges.includes(meta.exchangeName)) return null;
  const listingMs = Date.parse(`${listingDate}T00:00:00Z`);
  if (!Number.isFinite(listingMs)) return null;
  if (issuerPattern && !issuerPattern.test(`${meta.longName || ""} ${meta.shortName || ""}`)) return null;
  const first = meta.firstTradeDate;
  const firstMs = typeof first === "number" ? (first > 1e12 ? first : first * 1000) : NaN;
  if (Number.isFinite(firstMs)) {
    if (firstMs < listingMs) return null;
    return { ...base, exchange: meta.exchangeName, firstTradeMs: firstMs };
  }
  const traded = chartVolume(payload) > 0 || meta.regularMarketVolume > 0;
  if (!traded || !(base.quoteAsOf >= listingMs)) return null;
  return { ...base, exchange: meta.exchangeName, firstTradeMs: null };
}

export async function fetchListedChartPrice(ticker, opts = {}, { timeoutMs = 5000 } = {}) {
  for (const host of YAHOO_CHART_HOSTS) {
    try {
      const response = await fetch(chartUrl(ticker, host), {
        headers: YAHOO_CHART_HEADERS,
        cache: "no-store",
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (!response.ok) continue;
      const parsed = parseListedChartPrice(await response.json(), ticker, opts);
      if (parsed) return parsed;
    } catch {
      continue;
    }
  }
  return null;
}
