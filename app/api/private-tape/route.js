import { NextResponse } from "next/server";
import {
  YAHOO_CHART_HEADERS,
  YAHOO_CHART_HOSTS,
  fetchChartPrice,
} from "../../../lib/yahooQuote.mjs";
import { createLiveQuoteCache } from "../../../lib/liveQuoteCache.mjs";
import { PRIVATE_TAPE_ENDPOINTS } from "../../../lib/privateTapeManifest.mjs";
import {
  MIN_CORRELATION_N,
  MIN_MULTI_REGRESSION_N,
  MIN_REGRESSION_N,
  PRIVATE_TAPE_CONFIG,
  RETURN_INTERVAL_MS,
  buildCurrentOvernightSignal,
  buildIndexSeries,
  buildOvernightSamples,
  buildPrivateReturnSamples,
  buildRthReturnSamples,
  bucketOvernightSamples,
  correlationSummary,
  cumulativeResidualSeries,
  currentPrivateIndex,
  etDateKey,
  etMinuteKey,
  latestWindowReturn,
  linearRegression,
  marketCloseMs,
  modeledAssetWeights,
  rollingCorrelationSeries,
  samplesToCsv,
} from "../../../lib/privateTape.mjs";

export const dynamic = "force-dynamic";

const DAY_MS = 24 * 60 * 60 * 1000;
const DAILY_START_MS = Date.UTC(2026, 2, 31, 4, 0, 0);
const INTRADAY_LOOKBACK_DAYS = 45;
const HYPERLIQUID_LOOKBACK_DAYS = 90;
const API_CACHE_TTL_MS = 60 * 1000;

const cache = createLiveQuoteCache({
  ttlMs: API_CACHE_TTL_MS,
  failureTtlMs: API_CACHE_TTL_MS,
});

const PRIVATE_TAPE_HEADERS = {
  "Cache-Control": "private, no-store, no-cache, must-revalidate",
  "CDN-Cache-Control": "public, s-maxage=60, stale-while-revalidate=120",
  "Vercel-CDN-Cache-Control": "public, s-maxage=60, stale-while-revalidate=120",
};

function intervalToMs(interval) {
  if (interval === "30m") return 30 * 60 * 1000;
  if (interval === "1h") return 60 * 60 * 1000;
  if (interval === "1d") return DAY_MS;
  throw new Error(`unsupported interval ${interval}`);
}

function cleanNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function parseYahooCandles(payload, ticker, interval) {
  const result = payload?.chart?.result?.[0];
  const meta = result?.meta;
  if (!result || meta?.symbol !== ticker) return [];
  const timestamps = result.timestamp || [];
  const quote = result.indicators?.quote?.[0] || {};
  const intervalMs = intervalToMs(interval);
  const rows = [];

  for (let i = 0; i < timestamps.length; i++) {
    const startMs = timestamps[i] * 1000;
    const open = cleanNumber(quote.open?.[i]);
    const high = cleanNumber(quote.high?.[i]);
    const low = cleanNumber(quote.low?.[i]);
    const close = cleanNumber(quote.close?.[i]);
    const volume = Number(quote.volume?.[i]) || 0;
    if (!open || !high || !low || !close) continue;

    const date = etDateKey(startMs);
    rows.push({
      ticker,
      date,
      startMs,
      endMs: interval === "1d" ? marketCloseMs(date) : startMs + intervalMs,
      open,
      high,
      low,
      close,
      volume,
    });
  }
  return rows.sort((a, b) => a.endMs - b.endMs);
}

async function fetchYahooCandles(ticker, interval, startMs, endMs) {
  const period1 = Math.floor(startMs / 1000);
  const period2 = Math.floor(endMs / 1000);
  const path = `v8/finance/chart/${encodeURIComponent(
    ticker
  )}?interval=${interval}&period1=${period1}&period2=${period2}&includePrePost=false`;

  for (const host of YAHOO_CHART_HOSTS) {
    try {
      const response = await fetch(`https://${host}/${path}`, {
        headers: YAHOO_CHART_HEADERS,
        cache: "no-store",
        signal: AbortSignal.timeout(8000),
      });
      if (response.status === 429 || response.status === 503) continue;
      if (!response.ok) continue;
      const rows = parseYahooCandles(await response.json(), ticker, interval);
      if (rows.length) return rows;
    } catch {
      continue;
    }
  }
  throw new Error(`Yahoo returned no usable ${interval} rows for ${ticker}`);
}

async function fetchHyperliquidCandles(coin, interval, startMs, endMs) {
  const response = await fetch("https://api.hyperliquid.xyz/info", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      type: "candleSnapshot",
      req: { coin, interval, startTime: startMs, endTime: endMs },
    }),
    cache: "no-store",
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) {
    throw new Error(`Hyperliquid responded ${response.status} for ${coin}`);
  }
  const data = await response.json();
  if (!Array.isArray(data)) throw new Error(`Hyperliquid ${coin} payload was not an array`);

  return data
    .map((row) => ({
      symbol: row.s || coin,
      interval: row.i || interval,
      startMs: Number(row.t),
      endMs: Number(row.T) + 1,
      open: cleanNumber(row.o),
      high: cleanNumber(row.h),
      low: cleanNumber(row.l),
      close: cleanNumber(row.c),
      volume: Number(row.v) || 0,
      trades: Number(row.n) || 0,
    }))
    .filter((row) => row.startMs > 0 && row.endMs > 0 && row.close > 0)
    .sort((a, b) => a.endMs - b.endMs);
}

function trimSeries(rows, maxRows = 260) {
  return rows.length > maxRows ? rows.slice(rows.length - maxRows) : rows;
}

function latestPoint(rows) {
  return rows?.length ? rows[rows.length - 1] : null;
}

function pctOrNull(n) {
  return Number.isFinite(n) ? n : null;
}

function valuationCards({ anthropicCandles, spacexCandles, dxyzQuote, dxyzDaily, indexSeries, currentIndex, currentSignal }) {
  const anthropicLatest = latestPoint(anthropicCandles);
  const spacexLatest = latestPoint(spacexCandles);
  const anthropic24h = latestWindowReturn(anthropicCandles, DAY_MS);
  const spacex24h = latestWindowReturn(spacexCandles, DAY_MS);
  const weights = modeledAssetWeights();
  const weighted24h =
    anthropic24h && spacex24h
      ? weights.anthropic * anthropic24h.return + weights.spacex * spacex24h.return
      : null;
  const dxyzLast = dxyzQuote?.price ?? latestPoint(dxyzDaily)?.close ?? null;

  return {
    anthropic: anthropicLatest
      ? {
          label: "Anthropic implied valuation",
          valueUsd: anthropicLatest.close * 1_000_000_000,
          displayUnit: "valuation",
          price: anthropicLatest.close,
          quoteUnit: "USD billions",
          asOfMs: anthropicLatest.endMs,
        }
      : null,
    spacex: spacexLatest
      ? {
          label: "SpaceX implied valuation",
          valueUsd:
            spacexLatest.close *
            PRIVATE_TAPE_CONFIG.assets.spacex.referenceFullyDilutedShares,
          displayUnit: "approx valuation",
          price: spacexLatest.close,
          quoteUnit: "USD/share",
          asOfMs: spacexLatest.endMs,
        }
      : null,
    move24h: {
      weighted: pctOrNull(weighted24h),
      anthropic: pctOrNull(anthropic24h?.return),
      spacex: pctOrNull(spacex24h?.return),
      asOfMs: Math.min(anthropic24h?.latestAtMs ?? Infinity, spacex24h?.latestAtMs ?? Infinity),
    },
    overnight: currentSignal
      ? {
          weighted: currentSignal.weightedReturn,
          anthropic: currentSignal.anthropic,
          spacex: currentSignal.spacex,
          startMs: currentSignal.startMs,
          asOfMs: Math.min(currentSignal.anthropicAtMs, currentSignal.spacexAtMs),
          nyseOpen: currentSignal.nyseOpen,
          nextOpenMs: currentSignal.nextOpenMs,
        }
      : null,
    privateIndex: currentIndex
      ? {
          value: currentIndex.value,
          baseDate: indexSeries[0]?.date ?? null,
          asOfMs: Math.min(currentIndex.anthropicAtMs, currentIndex.spacexAtMs),
        }
      : null,
    dxyz: {
      price: dxyzLast,
      previousClose: currentSignal?.dxyzPreviousClose ?? latestPoint(dxyzDaily)?.close ?? null,
      previousCloseDate: currentSignal?.dxyzPreviousCloseDate ?? latestPoint(dxyzDaily)?.date ?? null,
      quoteAsOfMs: dxyzQuote?.quoteAsOf ?? null,
    },
    overnightGapSignal: currentSignal
      ? {
          weightedPrivateMove: currentSignal.weightedReturn,
          predictedGap: currentSignal.predictedGap,
          nyseOpen: currentSignal.nyseOpen,
          nextOpenMs: currentSignal.nextOpenMs,
        }
      : null,
  };
}

async function capture(label, fn, errors) {
  try {
    return await fn();
  } catch (err) {
    errors.push(`${label}: ${err.message}`);
    return [];
  }
}

async function fetchLive(prev) {
  const now = Date.now();
  const errors = [];
  const intradayStartMs = now - INTRADAY_LOOKBACK_DAYS * DAY_MS;
  const hyperliquidStartMs = now - HYPERLIQUID_LOOKBACK_DAYS * DAY_MS;
  const endMs = now + RETURN_INTERVAL_MS;
  const anthropicCoin = PRIVATE_TAPE_CONFIG.assets.anthropic.hyperliquidCoin;
  const spacexCoin = PRIVATE_TAPE_CONFIG.assets.spacex.hyperliquidCoin;

  const [
    anthropicCandles,
    spacexCandles,
    dxyzDaily,
    qqqDaily,
    dxyzIntraday,
    qqqIntraday,
    dxyzQuote,
  ] = await Promise.all([
    capture("Hyperliquid io:ANTH", () =>
      fetchHyperliquidCandles(anthropicCoin, "30m", hyperliquidStartMs, endMs), errors),
    capture("Hyperliquid xyz:SPCX", () =>
      fetchHyperliquidCandles(spacexCoin, "30m", hyperliquidStartMs, endMs), errors),
    capture("Yahoo DXYZ daily", () =>
      fetchYahooCandles("DXYZ", "1d", DAILY_START_MS, endMs), errors),
    capture("Yahoo QQQ daily", () =>
      fetchYahooCandles("QQQ", "1d", DAILY_START_MS, endMs), errors),
    capture("Yahoo DXYZ 30m", () =>
      fetchYahooCandles("DXYZ", "30m", intradayStartMs, endMs), errors),
    capture("Yahoo QQQ 30m", () =>
      fetchYahooCandles("QQQ", "30m", intradayStartMs, endMs), errors),
    fetchChartPrice("DXYZ").catch((err) => {
      errors.push(`Yahoo DXYZ quote: ${err.message}`);
      return null;
    }),
  ]);

  const rthSamples = buildRthReturnSamples({
    dxyz: dxyzIntraday,
    qqq: qqqIntraday,
    anthropic: anthropicCandles,
    spacex: spacexCandles,
  });
  const privateSamples = buildPrivateReturnSamples({
    anthropic: anthropicCandles,
    spacex: spacexCandles,
  });
  const overnightSamples = buildOvernightSamples({
    dxyzDaily,
    qqqDaily,
    anthropic: anthropicCandles,
    spacex: spacexCandles,
  });
  const completedDxyzDaily = dxyzDaily.filter(
    (row) => row.date && marketCloseMs(row.date) <= now
  );

  const overnightRegression = linearRegression(
    overnightSamples,
    "dxyzGap",
    ["weightedReturn"],
    { minN: MIN_REGRESSION_N }
  );
  const currentSignal = buildCurrentOvernightSignal({
    dxyzDaily,
    anthropic: anthropicCandles,
    spacex: spacexCandles,
    regression: overnightRegression,
  }, now);
  const indexSeries = buildIndexSeries({
    dxyzDaily: completedDxyzDaily,
    anthropic: anthropicCandles,
    spacex: spacexCandles,
  });
  const currentIndex = currentPrivateIndex({ indexSeries, anthropic: anthropicCandles, spacex: spacexCandles }, now);

  const residualRegression = linearRegression(
    rthSamples,
    "dxyz",
    ["anthropic", "spacex", "qqq"],
    { minN: MIN_MULTI_REGRESSION_N }
  );
  const residualSeries = cumulativeResidualSeries(residualRegression);

  const payload = {
    source: errors.length ? "partial" : "live",
    asOf: new Date(now).toISOString(),
    config: {
      methodologyVersion: PRIVATE_TAPE_CONFIG.methodologyVersion,
      weights: modeledAssetWeights(),
      assets: PRIVATE_TAPE_CONFIG.assets,
      sources: PRIVATE_TAPE_CONFIG.sources,
      returnConvention: "simple",
      minimums: {
        correlationN: MIN_CORRELATION_N,
        overnightRegressionN: MIN_REGRESSION_N,
        residualRegressionN: MIN_MULTI_REGRESSION_N,
      },
    },
    marketStatus: {
      nyseOpen: currentSignal?.nyseOpen ?? false,
      nowEt: etMinuteKey(now),
      nextOpenMs: currentSignal?.nextOpenMs ?? null,
    },
    cards: valuationCards({
      anthropicCandles,
      spacexCandles,
      dxyzQuote,
      dxyzDaily,
      indexSeries,
      currentIndex,
      currentSignal,
    }),
    analyses: {
      plainCorrelation: [
        {
          key: "dxyzAnthropic",
          label: "DXYZ vs ANTH",
          scope: "NYSE-hours 30m returns",
          ...correlationSummary(rthSamples, "anthropic", "dxyz"),
        },
        {
          key: "dxyzSpacex",
          label: "DXYZ vs SPCX",
          scope: "NYSE-hours 30m returns",
          ...correlationSummary(rthSamples, "spacex", "dxyz"),
        },
        {
          key: "anthropicSpacex",
          label: "ANTH vs SPCX",
          scope: "24/7 overlapping 30m returns",
          ...correlationSummary(privateSamples, "anthropic", "spacex"),
        },
      ],
      overnight: {
        correlation: correlationSummary(
          overnightSamples,
          "weightedReturn",
          "dxyzGap",
          { minN: MIN_REGRESSION_N }
        ),
        regression: overnightRegression
          ? {
              n: overnightRegression.n,
              intercept: overnightRegression.intercept,
              slope: overnightRegression.slopes.weightedReturn,
              r2: overnightRegression.r2,
            }
          : null,
        buckets: bucketOvernightSamples(overnightSamples),
        samples: overnightSamples,
      },
      privateIndex: trimSeries(indexSeries, 180),
      rollingCorrelations: {
        dxyzAnthropic: trimSeries(
          rollingCorrelationSeries(rthSamples, "anthropic", "dxyz"),
          220
        ),
        dxyzSpacex: trimSeries(
          rollingCorrelationSeries(rthSamples, "spacex", "dxyz"),
          220
        ),
        anthropicSpacex: trimSeries(
          rollingCorrelationSeries(privateSamples, "anthropic", "spacex"),
          220
        ),
      },
      residual: residualRegression
        ? {
            regression: {
              n: residualRegression.n,
              intercept: residualRegression.intercept,
              slopes: residualRegression.slopes,
              r2: residualRegression.r2,
            },
            series: trimSeries(residualSeries, 220),
          }
        : {
            regression: null,
            series: [],
            minN: MIN_MULTI_REGRESSION_N,
            n: rthSamples.filter((s) => Number.isFinite(s.qqq)).length,
          },
    },
    datasets: {
      rth: rthSamples,
      overnight: overnightSamples,
    },
    downloads: PRIVATE_TAPE_ENDPOINTS,
    errors,
  };

  const ok = anthropicCandles.length > 0 && spacexCandles.length > 0 && dxyzDaily.length > 0;
  return {
    ok: ok || !!prev,
    payload: ok ? payload : prev ?? payload,
  };
}

function csvForPayload(payload, dataset) {
  if (dataset === "rth") {
    return samplesToCsv(payload.datasets.rth, [
      { header: "date", value: "date" },
      { header: "time_et", value: "timeEt" },
      { header: "end_ms", value: "endMs" },
      { header: "dxyz_return", value: "dxyz" },
      { header: "anthropic_return", value: "anthropic" },
      { header: "spacex_return", value: "spacex" },
      { header: "qqq_return", value: "qqq" },
    ]);
  }
  return samplesToCsv(payload.datasets.overnight, [
    { header: "date", value: "date" },
    { header: "prior_date", value: "priorDate" },
    { header: "start_et", value: (row) => etMinuteKey(row.startMs) },
    { header: "end_et", value: (row) => etMinuteKey(row.endMs) },
    { header: "dxyz_opening_gap", value: "dxyzGap" },
    { header: "weighted_private_return", value: "weightedReturn" },
    { header: "anthropic_return", value: "anthropic" },
    { header: "spacex_return", value: "spacex" },
    { header: "qqq_opening_gap", value: "qqqGap" },
    { header: "anthropic_start_at_et", value: (row) => etMinuteKey(row.anthropicStartAtMs) },
    { header: "anthropic_end_at_et", value: (row) => etMinuteKey(row.anthropicEndAtMs) },
    { header: "spacex_start_at_et", value: (row) => etMinuteKey(row.spacexStartAtMs) },
    { header: "spacex_end_at_et", value: (row) => etMinuteKey(row.spacexEndAtMs) },
  ]);
}

export async function GET(request) {
  const url = new URL(request.url);
  const { payload, servedFromCache, reason } = await cache.load(Date.now(), fetchLive);
  const source = servedFromCache
    ? reason === "ttl" || reason === "coalesced"
      ? "cache"
      : payload.source
    : payload.source;
  const finalPayload = { ...payload, source };

  if (url.searchParams.get("format") === "csv") {
    const dataset = url.searchParams.get("dataset") === "rth" ? "rth" : "overnight";
    return new Response(csvForPayload(finalPayload, dataset), {
      headers: {
        ...PRIVATE_TAPE_HEADERS,
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="private-tape-${dataset}.csv"`,
      },
    });
  }

  return NextResponse.json(finalPayload, { headers: PRIVATE_TAPE_HEADERS });
}
