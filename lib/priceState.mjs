// Quote-feed state for /ai. Three clocks, four states, explicit thresholds.
//
// quoteAsOf      — when the market price was struck (Yahoo regularMarketTime)
// fetchedAt      — when we requested Yahoo
// cacheWrittenAt — when we stored the successful fetch
//
// LIVE        quote age < 15m and this response is a fresh Yahoo fetch
// CACHED      quote age < 15m but served from our in-memory cache
// STALE       quote age ≥ 15m and < 18h (typical after the cash session)
// UNAVAILABLE no quoteAsOf, hardcoded fallback, or quote age ≥ 18h

export const PRICE_STATES = ["live", "cached", "stale", "unavailable"];

export const PRICE_THRESHOLDS = {
  liveMaxQuoteAgeMs: 15 * 60 * 1000,
  staleMaxQuoteAgeMs: 18 * 60 * 60 * 1000,
};

const RANK = { live: 0, cached: 1, stale: 2, unavailable: 3 };

export function classifyQuote(
  {
    quoteAsOf,
    servedFromCache = false,
    isFallback = false,
  },
  now = Date.now()
) {
  if (isFallback || !(quoteAsOf > 0)) return "unavailable";
  const age = now - quoteAsOf;
  if (age >= PRICE_THRESHOLDS.staleMaxQuoteAgeMs) return "unavailable";
  if (age >= PRICE_THRESHOLDS.liveMaxQuoteAgeMs) return "stale";
  if (servedFromCache) return "cached";
  return "live";
}

export function worstPriceState(states) {
  let worst = "live";
  for (const s of states) {
    if ((RANK[s] ?? 0) > RANK[worst]) worst = s;
  }
  return worst;
}

export function formatQuoteEt(ms) {
  if (!(ms > 0)) return null;
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).formatToParts(new Date(ms));
  const get = (t) => parts.find((p) => p.type === t)?.value;
  return `${get("month")} ${get("day")}, ${get("year")}, ${get("hour")}:${get("minute")} ${get("dayPeriod")} ET`;
}

export function formatQuoteAge(ms, now = Date.now()) {
  if (!(ms > 0)) return null;
  const sec = Math.max(0, Math.round((now - ms) / 1000));
  if (sec < 60) return `${sec}s old`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m old`;
  const hr = Math.floor(min / 60);
  const rem = min % 60;
  if (hr < 48) return rem ? `${hr}h ${rem}m old` : `${hr}h old`;
  const days = Math.floor(hr / 24);
  return `${days}d old`;
}

export function priceChipLabel(state, quoteAsOf) {
  const abs = formatQuoteEt(quoteAsOf);
  const head =
    state === "live"
      ? "LIVE"
      : state === "cached"
        ? "CACHED"
        : state === "stale"
          ? "STALE"
          : "UNAVAILABLE";
  if (!abs) return `${head} PRICES`;
  return `${head} · quote ${abs}`;
}

export function priceChipTitle(state, quoteAsOf, now = Date.now()) {
  const age = formatQuoteAge(quoteAsOf, now);
  const abs = formatQuoteEt(quoteAsOf);
  const bits = [`state ${state}`];
  if (abs) bits.push(`struck ${abs}`);
  if (age) bits.push(age);
  return bits.join(" · ");
}

export function pagePriceState(quotes, tickers, now = Date.now()) {
  return worstPriceState(
    tickers.map((ticker) => {
      const q = quotes?.[ticker];
      if (!q) return "unavailable";
      return classifyQuote(
        {
          quoteAsOf: q.quoteAsOf,
          servedFromCache: q.state === "cached",
          isFallback: q.isFallback,
        },
        now
      );
    })
  );
}

export function oldestQuoteAsOf(quotes, tickers) {
  let oldest = null;
  for (const ticker of tickers) {
    const t = quotes?.[ticker]?.quoteAsOf;
    if (t > 0 && (oldest == null || t < oldest)) oldest = t;
  }
  return oldest;
}
