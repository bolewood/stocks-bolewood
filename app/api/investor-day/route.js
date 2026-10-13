import { NextResponse } from "next/server";
import {
  YAHOO_CHART_HEADERS,
  YAHOO_CHART_HOSTS,
  parseChartPrice,
} from "../../../lib/yahooQuote.mjs";
import {
  YAHOO_FETCH_CONCURRENCY,
  createLiveQuoteCache,
  mapLimit,
} from "../../../lib/liveQuoteCache.mjs";
import {
  etDateKey,
  isNyseSessionDate,
  marketOpenMs,
} from "../../../lib/privateTape.mjs";
import {
  IPO_BY_LEGS,
  KALSHI_MARKETS,
  MARKET_CONTROL,
  PERP_COINS,
  POLYMARKET_SLUGS,
  PROXIES,
  averageDailyVolume,
  averageHourlyNotional,
  bracketMidpointT,
  etMidnightMs,
  expectedCloseT,
  findMarket,
  gammaLeg,
  kalshiCandleMid,
  kalshiQuote,
  num,
  openAtOrAfter,
  notionalSince,
  pctChange,
  priorDailyNorm,
  simpleReturns,
  stdev,
  unusualMove,
  valueAtOrBefore,
  volumeBand,
  volumeRatio,
} from "../../../lib/investorDay.mjs";

export const dynamic = "force-dynamic";

const DAY_MS = 24 * 60 * 60 * 1000;
const LIVE_TTL_MS = 15 * 1000;
const BASELINE_TTL_MS = 10 * 60 * 1000;
// A partial baseline is kept briefly so one flaky upstream does not refetch
// ~17 histories on every 15s tick.
const BASELINE_PARTIAL_TTL_MS = 60 * 1000;
const SIGMA_LOOKBACK_DAYS = 30;
const FETCH_TIMEOUT_MS = 8000;

const cache = createLiveQuoteCache({ ttlMs: LIVE_TTL_MS, failureTtlMs: LIVE_TTL_MS });

// Browser: never cache (Next overwrites Cache-Control on route handlers; see
// PRICE_CDN_HEADERS). Edge: 15s + SWR, matching the client poll.
const INVESTOR_DAY_HEADERS = {
  "Cache-Control": "private, no-store, no-cache, must-revalidate",
  "CDN-Cache-Control": "public, s-maxage=15, stale-while-revalidate=60",
  "Vercel-CDN-Cache-Control": "public, s-maxage=15, stale-while-revalidate=60",
};

async function getJson(url, init = {}) {
  const response = await fetch(url, {
    ...init,
    cache: "no-store",
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}

async function capture(label, fn, errors, fallback = null) {
  try {
    return await fn();
  } catch (err) {
    errors.push(`${label}: ${err.message}`);
    return fallback;
  }
}

// ---- Hyperliquid ---------------------------------------------------------

function hyperliquid(body) {
  return getJson("https://api.hyperliquid.xyz/info", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

async function fetchPerpContexts() {
  const data = await hyperliquid({ type: "metaAndAssetCtxs", dex: "io" });
  const universe = data?.[0]?.universe;
  const ctxs = data?.[1];
  if (!Array.isArray(universe) || !Array.isArray(ctxs)) {
    throw new Error("metaAndAssetCtxs payload was not [meta, ctxs]");
  }
  const out = {};
  for (const [key, coin] of Object.entries(PERP_COINS)) {
    const i = universe.findIndex((a) => a.name === coin);
    const ctx = ctxs[i];
    const markPx = num(ctx?.markPx);
    if (i < 0 || !(markPx > 0)) throw new Error(`${coin} missing from io dex`);
    const openInterest = num(ctx.openInterest);
    out[key] = {
      coin,
      markPx,
      prevDayPx: num(ctx.prevDayPx),
      oraclePx: num(ctx.oraclePx),
      change24h: pctChange(num(ctx.prevDayPx), markPx),
      openInterest,
      openInterestUsd: openInterest != null ? openInterest * markPx : null,
      dayNtlVlm: num(ctx.dayNtlVlm),
      funding: num(ctx.funding),
    };
  }
  return out;
}

async function fetchCandles(coin, interval, startMs, endMs) {
  const data = await hyperliquid({
    type: "candleSnapshot",
    req: { coin, interval, startTime: startMs, endTime: endMs },
  });
  if (!Array.isArray(data)) throw new Error(`${coin} ${interval} candles were not an array`);
  return data
    .map((row) => ({
      startMs: Number(row.t),
      endMs: Number(row.T) + 1,
      open: num(row.o),
      close: num(row.c),
      volume: num(row.v) ?? 0,
    }))
    .filter((row) => row.startMs > 0 && row.open > 0 && row.close > 0)
    .sort((a, b) => a.startMs - b.startMs);
}

// ---- Polymarket ----------------------------------------------------------

async function fetchGammaEvent(slug) {
  const data = await getJson(
    `https://gamma-api.polymarket.com/events?slug=${encodeURIComponent(slug)}`
  );
  const event = Array.isArray(data) ? data[0] : null;
  if (!event?.markets?.length) throw new Error(`no markets for ${slug}`);
  return event;
}

async function fetchClobHistory(tokenId, startMs, endMs) {
  const qs = new URLSearchParams({
    market: tokenId,
    startTs: String(Math.floor(startMs / 1000)),
    endTs: String(Math.floor(endMs / 1000)),
    fidelity: "5",
  });
  const data = await getJson(`https://clob.polymarket.com/prices-history?${qs}`);
  return (data?.history || []).map((pt) => ({ t: Number(pt.t) * 1000, p: num(pt.p) }));
}

// ---- Kalshi --------------------------------------------------------------

const KALSHI_BASE = "https://api.elections.kalshi.com/trade-api/v2";

async function fetchKalshiMarket(ticker) {
  const data = await getJson(`${KALSHI_BASE}/markets/${encodeURIComponent(ticker)}`);
  if (!data?.market) throw new Error(`no market payload for ${ticker}`);
  return data.market;
}

// Hourly candles for the trailing 7 days: the mid at or before atMs (00:00
// ET) and total contract volume for the 7-day norm.
async function fetchKalshiBaseline({ series, ticker }, atMs, now) {
  const qs = new URLSearchParams({
    start_ts: String(Math.floor((now - 7 * DAY_MS) / 1000)),
    end_ts: String(Math.floor(now / 1000)),
    period_interval: "60",
  });
  const data = await getJson(
    `${KALSHI_BASE}/series/${series}/markets/${ticker}/candlesticks?${qs}`
  );
  const raw = data?.candlesticks || [];
  const candles = raw.map((c) => ({ t: Number(c.end_period_ts) * 1000, p: kalshiCandleMid(c) }));
  return {
    mid: valueAtOrBefore(candles, atMs)?.p ?? null,
    volume7d: raw.reduce((sum, c) => sum + (num(c.volume_fp) ?? 0), 0),
  };
}

// ---- Yahoo ---------------------------------------------------------------

// One 5m/1d chart call gives price, prior close, and the 9:30 open; the
// recycled-ticker guard comes from parseChartPrice on the same payload.
async function fetchYahooIntraday(ticker) {
  const path = `v8/finance/chart/${encodeURIComponent(ticker)}?interval=5m&range=1d&includePrePost=false`;
  for (const host of YAHOO_CHART_HOSTS) {
    try {
      const response = await fetch(`https://${host}/${path}`, {
        headers: YAHOO_CHART_HEADERS,
        cache: "no-store",
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      });
      if (!response.ok) continue;
      const payload = await response.json();
      const quote = parseChartPrice(payload, ticker);
      if (!quote) continue;
      const result = payload.chart.result[0];
      const meta = result.meta;
      const regularStartMs = (meta.currentTradingPeriod?.regular?.start ?? 0) * 1000;
      const timestamps = result.timestamp || [];
      const opens = result.indicators?.quote?.[0]?.open || [];
      let open = null;
      for (let i = 0; i < timestamps.length; i++) {
        if (timestamps[i] * 1000 >= regularStartMs && opens[i] > 0) {
          open = opens[i];
          break;
        }
      }
      return {
        price: quote.price,
        quoteAsOf: quote.quoteAsOf,
        previousClose: num(meta.chartPreviousClose ?? meta.previousClose),
        volume: num(meta.regularMarketVolume),
        open,
        regularStartMs,
      };
    } catch {
      continue;
    }
  }
  throw new Error(`no usable chart for ${ticker}`);
}

// ---- Proxy average daily volume, cached for the ET day -------------------
// Separate from the 5m/1d call: chartPreviousClose differs on longer ranges.

async function fetchYahooDailyVolumes(ticker) {
  const path = `v8/finance/chart/${encodeURIComponent(ticker)}?interval=1d&range=1mo`;
  for (const host of YAHOO_CHART_HOSTS) {
    try {
      const response = await fetch(`https://${host}/${path}`, {
        headers: YAHOO_CHART_HEADERS,
        cache: "no-store",
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      });
      if (!response.ok) continue;
      const result = (await response.json())?.chart?.result?.[0];
      if (result?.meta?.symbol !== ticker) continue;
      const volumes = result.indicators?.quote?.[0]?.volume || [];
      return (result.timestamp || []).map((t, i) => ({
        date: etDateKey(t * 1000),
        volume: num(volumes[i]),
      }));
    } catch {
      continue;
    }
  }
  throw new Error(`no usable daily volume for ${ticker}`);
}

const DAILY_VOLUME_RETRY_MS = 60 * 1000;
let dailyVolumeEntry = null;
let dailyVolumeInFlight = null;

async function loadAverageVolumes(today, now, errors) {
  const fresh =
    dailyVolumeEntry?.today === today &&
    (!dailyVolumeEntry.errors.length || now - dailyVolumeEntry.writtenAt < DAILY_VOLUME_RETRY_MS);
  if (!fresh && !dailyVolumeInFlight) {
    dailyVolumeInFlight = (async () => {
      const localErrors = [];
      const rows = await mapLimit(PROXY_TICKERS, YAHOO_FETCH_CONCURRENCY, (t) =>
        fetchYahooDailyVolumes(t).catch((err) => {
          localErrors.push(`Yahoo ${t} daily volume: ${err.message}`);
          return null;
        })
      );
      const averages = Object.fromEntries(
        PROXY_TICKERS.map((t, i) => [
          t,
          averageDailyVolume(rows[i], today) ??
            (dailyVolumeEntry?.today === today ? dailyVolumeEntry.averages[t] : null),
        ])
      );
      dailyVolumeEntry = { today, writtenAt: now, averages, errors: localErrors };
      return dailyVolumeEntry;
    })().finally(() => {
      dailyVolumeInFlight = null;
    });
  }
  const entry = dailyVolumeInFlight ? await dailyVolumeInFlight : dailyVolumeEntry;
  errors.push(...entry.errors);
  return entry.averages;
}

// ---- Proxy quotes, cached 60s -------------------------------------------
// Matches the other Yahoo-backed routes' 60s cadence; the 15s tick is for
// Hyperliquid / Polymarket / Kalshi. A ticker that fails keeps its last-good
// quote (its quoteAsOf shows the age) and only errors when none exists.

const PROXY_TTL_MS = 60 * 1000;
const PROXY_TICKERS = [...PROXIES.map((p) => p.ticker), MARKET_CONTROL];
let proxyEntry = null;
let proxyInFlight = null;

async function loadProxyQuotes(now, errors) {
  if (proxyEntry && now - proxyEntry.writtenAt < PROXY_TTL_MS) {
    errors.push(...proxyEntry.errors);
    return proxyEntry.quotes;
  }
  if (!proxyInFlight) {
    proxyInFlight = (async () => {
      const localErrors = [];
      const fresh = await mapLimit(PROXY_TICKERS, YAHOO_FETCH_CONCURRENCY, (t) =>
        fetchYahooIntraday(t).catch((err) => {
          if (!proxyEntry?.quotes[PROXY_TICKERS.indexOf(t)]) {
            localErrors.push(`Yahoo ${t}: ${err.message}`);
          }
          return null;
        })
      );
      const quotes = fresh.map((q, i) => q ?? proxyEntry?.quotes[i] ?? null);
      proxyEntry = { writtenAt: now, quotes, errors: localErrors };
      return proxyEntry;
    })().finally(() => {
      proxyInFlight = null;
    });
  }
  const entry = await proxyInFlight;
  errors.push(...entry.errors);
  return entry.quotes;
}

// ---- Baselines (midnight ET), cached ~10 min ----------------------------

let baselineEntry = null;

async function loadBaselines({ midnightMs, tokenIds, now, errors }) {
  const key = `${midnightMs}|${tokenIds.join(",")}`;
  if (baselineEntry?.key === key && now - baselineEntry.writtenAt < baselineEntry.ttlMs) {
    return baselineEntry.value;
  }
  const localErrors = [];
  const sigmaStart = now - SIGMA_LOOKBACK_DAYS * DAY_MS;
  const [candles15m, polymarket, kalshi] = await Promise.all([
    capture("Hyperliquid io:ANTH 15m", () =>
      fetchCandles(PERP_COINS.anthropic, "15m", sigmaStart, now), localErrors, []),
    mapLimit(tokenIds, 4, (id) =>
      capture(`Polymarket CLOB ${id.slice(0, 8)}…`, async () =>
        valueAtOrBefore(await fetchClobHistory(id, midnightMs - 12 * 60 * 60 * 1000, midnightMs), midnightMs)?.p ?? null,
      localErrors)
    ),
    mapLimit(KALSHI_MARKETS, 3, (m) =>
      capture(`Kalshi ${m.ticker} candles`, () => fetchKalshiBaseline(m, midnightMs, now), localErrors)
    ),
  ]);
  const returns = simpleReturns(candles15m.map((c) => c.close));
  const value = {
    sigma15m: stdev(returns),
    sigmaN: returns.length,
    anthAvgHourNotional: averageHourlyNotional(candles15m),
    polymarket: Object.fromEntries(tokenIds.map((id, i) => [id, polymarket[i]])),
    kalshi: Object.fromEntries(KALSHI_MARKETS.map((m, i) => [m.ticker, kalshi[i]?.mid ?? null])),
    kalshiVolume7d: Object.fromEntries(
      KALSHI_MARKETS.map((m, i) => [m.ticker, kalshi[i]?.volume7d ?? null])
    ),
  };
  errors.push(...localErrors);
  baselineEntry = {
    key,
    writtenAt: now,
    ttlMs: localErrors.length ? BASELINE_PARTIAL_TTL_MS : BASELINE_TTL_MS,
    value,
  };
  return value;
}

// ---- Assembly ------------------------------------------------------------

function withBaseline(leg, baselines) {
  if (!leg) return null;
  const baseline = leg.tokenId ? baselines.polymarket[leg.tokenId] ?? null : null;
  return {
    ...leg,
    baseline,
    change: Number.isFinite(baseline) ? leg.price - baseline : null,
  };
}

async function fetchLive(prev) {
  const now = Date.now();
  const errors = [];
  const today = etDateKey(now);
  const midnightMs = etMidnightMs(now);
  const openMs = marketOpenMs(today);
  const sessionOpen = isNyseSessionDate(today) && now >= openMs;

  // Memoized per ET day; started first so a cold isolate fetches it in parallel.
  const averageVolumesPromise = loadAverageVolumes(today, now, errors);
  const [perps, candles5m, events, kalshiMarkets, proxyQuotes] = await Promise.all([
    capture("Hyperliquid metaAndAssetCtxs", fetchPerpContexts, errors),
    capture("Hyperliquid io:ANTH 5m", () =>
      fetchCandles(PERP_COINS.anthropic, "5m", midnightMs - 60 * 60 * 1000, now), errors, []),
    Promise.all(
      Object.entries(POLYMARKET_SLUGS).map(async ([key, slug]) => [
        key,
        await capture(`Polymarket ${slug}`, () => fetchGammaEvent(slug), errors),
      ])
    ).then(Object.fromEntries),
    mapLimit(KALSHI_MARKETS, 3, (m) =>
      capture(`Kalshi ${m.ticker}`, () => fetchKalshiMarket(m.ticker), errors)
    ),
    loadProxyQuotes(now, errors),
  ]);
  const averageVolumes = await averageVolumesPromise;

  // Polymarket legs
  const brackets = (events.closingCap?.markets || [])
    .map((m) => ({ ...gammaLeg(m), midT: bracketMidpointT(m.groupItemTitle) }))
    .filter((b) => b.price != null);
  const capBrackets = brackets.filter((b) => b.midT != null).sort((a, b) => a.midT - b.midT);
  const noIpo = brackets.find((b) => b.midT == null) ?? null;
  const ipoBy = IPO_BY_LEGS.map((title) => {
    const leg = gammaLeg(findMarket(events.ipoBy, title));
    return leg ? { ...leg, key: title } : null;
  }).filter(Boolean);
  const bestModel = gammaLeg(findMarket(events.bestModel, "Anthropic"));
  const vsOpenai = gammaLeg(events.vsOpenai?.markets?.[0], "Anthropic");

  const tokenIds = [...capBrackets, ...ipoBy, bestModel]
    .map((l) => l?.tokenId)
    .filter(Boolean);
  const baselines = await loadBaselines({ midnightMs, tokenIds, now, errors });

  const bracketsOut = capBrackets.map((b) => withBaseline(b, baselines));
  const expected = expectedCloseT(bracketsOut);
  const expectedBaseline = bracketsOut.every((b) => Number.isFinite(b.baseline))
    ? expectedCloseT(bracketsOut, "baseline")
    : null;

  // Perps
  const anthropic = perps?.anthropic ?? null;
  const midnightPx = openAtOrAfter(candles5m, midnightMs);
  const openPx = sessionOpen ? openAtOrAfter(candles5m, openMs) : null;
  const sparkline = candles5m
    .filter((c) => c.startMs >= midnightMs)
    .map((c) => ({ t: c.endMs, p: c.close }));

  // Proxies
  const quotesByTicker = {};
  PROXY_TICKERS.forEach((t, i) => {
    quotesByTicker[t] = proxyQuotes[i];
  });
  const shape = (ticker, extra = {}) => {
    const q = quotesByTicker[ticker];
    if (!q) return { ticker, ...extra, price: null };
    // Pre-open, Yahoo's last print is the prior session; never label it "Day".
    const printedToday =
      sessionOpen && q.quoteAsOf >= openMs && etDateKey(q.quoteAsOf) === today;
    const sessionToday = etDateKey(q.regularStartMs) === today && printedToday;
    return {
      ticker,
      ...extra,
      price: q.price,
      previousClose: q.previousClose,
      open: sessionToday ? q.open : null,
      dayPct: printedToday ? pctChange(q.previousClose, q.price) : null,
      sinceOpenPct: sessionToday ? pctChange(q.open, q.price) : null,
      sessionDate: q.regularStartMs ? etDateKey(q.regularStartMs) : null,
      quoteAsOf: q.quoteAsOf,
      // Share of a 20-day average day, no intraday projection (volume is
      // U-shaped, so a linear pace overstates the morning).
      volume: printedToday ? q.volume : null,
      avgDailyVolume: averageVolumes[ticker]?.average ?? null,
      volumeOfAvgDay: printedToday
        ? volumeRatio(q.volume, averageVolumes[ticker]?.average)
        : null,
    };
  };
  const control = shape(MARKET_CONTROL, { note: "Invesco QQQ (market control)" });
  const proxies = PROXIES.map((p) => {
    const row = shape(p.ticker, { heldAs: p.heldAs ?? null, note: p.note });
    return {
      ...row,
      excessDay:
        row.dayPct != null && control.dayPct != null ? row.dayPct - control.dayPct : null,
      excessSinceOpen:
        row.sinceOpenPct != null && control.sinceOpenPct != null
          ? row.sinceOpenPct - control.sinceOpenPct
          : null,
    };
  });

  // Kalshi
  const kalshi = KALSHI_MARKETS.map((m, i) => {
    const market = kalshiMarkets[i];
    if (!market) return { ...m, mid: null };
    const quote = kalshiQuote(market);
    const baseline = baselines.kalshi[m.ticker] ?? null;
    return {
      ...m,
      ...quote,
      baseline,
      change: quote.mid != null && baseline != null ? quote.mid - baseline : null,
    };
  });

  // Volume vs normal: one row per venue, each with its own window.
  const pmVolumeRow = (key, label, source) => {
    const v24 = num(source?.volume24hr);
    const normal = priorDailyNorm(v24, num(source?.volume1wk));
    const ratio = volumeRatio(v24, normal);
    return { key, venue: "Polymarket", label, window: "24h vs prior 6-day avg", unit: "usd", current: v24, normal, ratio, band: volumeBand(ratio) };
  };
  const anthHourNotional = notionalSince(candles5m, now - 60 * 60 * 1000);
  const anthRatio = candles5m.length
    ? volumeRatio(anthHourNotional, baselines.anthAvgHourNotional)
    : null;
  const volumeRows = [
    {
      key: "anthPerp",
      venue: "Hyperliquid",
      label: "io:ANTH perp notional",
      window: "last 60 min vs 30-day avg hour",
      unit: "usd",
      current: candles5m.length ? anthHourNotional : null,
      normal: baselines.anthAvgHourNotional,
      ratio: anthRatio,
      band: volumeBand(anthRatio),
    },
    pmVolumeRow("pmClosingCap", "Closing-cap brackets (event)", events.closingCap),
    pmVolumeRow("pmIpoBy", "IPO-by dates (event)", events.ipoBy),
    pmVolumeRow("pmBestModel", "Best model end of Oct: Anthropic", findMarket(events.bestModel, "Anthropic")),
    ...kalshi.map((k) => {
      const normal = priorDailyNorm(k.volume24h, baselines.kalshiVolume7d[k.ticker]);
      const ratio = volumeRatio(k.volume24h, normal);
      return {
        key: `kalshi:${k.ticker}`,
        venue: "Kalshi",
        label: k.label,
        window: "24h vs prior 6-day avg",
        unit: "contracts",
        current: k.volume24h ?? null,
        normal,
        ratio,
        band: volumeBand(ratio),
      };
    }),
  ];

  const payload = {
    asOf: new Date(now).toISOString(),
    source: errors.length ? "partial" : "live",
    baselines: {
      midnightMs,
      openMs,
      sessionOpen,
      today,
      note: "Changes are measured from 00:00 ET today unless labeled since open.",
    },
    perps: {
      anthropic: anthropic
        ? {
            ...anthropic,
            midnightPx,
            openPx,
            changeSinceMidnight: pctChange(midnightPx, anthropic.markPx),
            changeSinceOpen: pctChange(openPx, anthropic.markPx),
            sparkline,
            unusual: {
              ...unusualMove(candles5m, baselines.sigma15m),
              sigmaN: baselines.sigmaN,
              lookbackDays: SIGMA_LOOKBACK_DAYS,
            },
          }
        : null,
      openai: perps?.openai ?? null,
    },
    polymarket: {
      brackets: bracketsOut,
      noIpo,
      expectedClose: expected
        ? {
            ...expected,
            baselineT: expectedBaseline?.valueT ?? null,
            changeT: expectedBaseline ? expected.valueT - expectedBaseline.valueT : null,
          }
        : null,
      ipoBy: ipoBy.map((l) => withBaseline(l, baselines)),
      bestModel: withBaseline(bestModel, baselines),
      vsOpenai,
    },
    kalshi,
    volume: { rows: volumeRows },
    proxies: { rows: proxies, control },
    errors,
  };

  const ok = !!anthropic;
  return { ok: ok || !!prev, payload: ok ? payload : prev ?? payload };
}

export async function GET() {
  const { payload, servedFromCache, reason } = await cache.load(Date.now(), fetchLive);
  const source =
    servedFromCache && (reason === "ttl" || reason === "coalesced") ? "cache" : payload.source;
  return NextResponse.json({ ...payload, source }, { headers: INVESTOR_DAY_HEADERS });
}
