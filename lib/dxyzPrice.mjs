// Which DXYZ market price /dxyz shows, and how it is labelled.
//
// The 10/29 bug: /api/prices seeded every ticker from a hardcoded 8/19
// fallback ($32.97), and a failed DXYZ fetch next to a live SPCX only showed
// "PARTIAL". The page then priced the premium off $32.97 while DXYZ traded at
// ~$27. Rules:
//  1. A Yahoo quote with a quoteAsOf is used, labelled with its state and time.
//  2. A hardcoded/fallback quote is never used silently. If the daily history
//     feed has a completed close, use that close and say so ("LAST CLOSE").
//  3. Otherwise show the fallback with an explicit UNAVAILABLE label and date.
import { classifyQuote, formatQuoteEt, etCivilToUtc } from "./priceState.mjs";

// 4:00 PM ET on a YYYY-MM-DD session date (DST-aware).
function closeMsOf(date) {
  const [y, m, d] = date.split("-").map(Number);
  return etCivilToUtc(y, m, d, 16, 0);
}

export function resolveDxyzPrice({ quote = null, servedFromCache = false, historyRows = [], historySource = null, now = Date.now() } = {}) {
  const live = quote && quote.price > 0 && quote.quoteAsOf > 0 && !quote.isFallback;
  const fromCache = Boolean(servedFromCache || quote?.servedFromCache);
  if (live) {
    const state = classifyQuote({ quoteAsOf: quote.quoteAsOf, servedFromCache: fromCache }, now);
    if (state !== "unavailable" && state !== "stale") {
      return { price: quote.price, state, asOfMs: quote.quoteAsOf, asOfLabel: formatQuoteEt(quote.quoteAsOf), source: "yahoo-quote" };
    }
  }
  // Only completed sessions count as a "close" (today's in-progress daily bar does not).
  const last = [...(historyRows || [])].reverse().find((r) => r && r.close > 0 && r.date && closeMsOf(r.date) <= now);
  const lastQuoteMs = live ? quote.quoteAsOf : null;
  const lastCloseMs = last ? closeMsOf(last.date) : null;
  // Prefer the newer of (a stale/old Yahoo print) and (the last completed close).
  if (last && (!lastQuoteMs || lastCloseMs >= lastQuoteMs)) {
    return { price: last.close, state: "last-close", asOfMs: lastCloseMs, asOfLabel: `${last.date} close`, source: `dxyz-history${historySource ? `:${historySource}` : ""}` };
  }
  if (live) {
    return { price: quote.price, state: "stale", asOfMs: quote.quoteAsOf, asOfLabel: formatQuoteEt(quote.quoteAsOf), source: "yahoo-quote" };
  }
  if (quote?.price > 0) {
    return { price: quote.price, state: "unavailable", asOfMs: null, asOfLabel: quote.fallbackAsOf ? `hardcoded ${quote.fallbackAsOf}` : "hardcoded fallback", source: "fallback" };
  }
  return { price: null, state: "unavailable", asOfMs: null, asOfLabel: null, source: "none" };
}

export function dxyzPriceChip(r) {
  if (!r || !(r.price > 0)) return "○ PRICE UNAVAILABLE";
  switch (r.state) {
    case "live": return `● LIVE · ${r.asOfLabel}`;
    case "cached": return `● CACHED · ${r.asOfLabel}`;
    case "close": return `● CLOSE · ${r.asOfLabel}`;
    case "stale": return `◐ STALE · ${r.asOfLabel}`;
    case "last-close": return `◐ QUOTE FEED DOWN · LAST CLOSE ${r.asOfLabel.replace(" close", "")}`;
    case "manual": return "● MANUAL";
    default: return `○ FALLBACK · ${r.asOfLabel}`;
  }
}
