import {
  MIN_CORRELATION_N,
  MIN_MULTI_REGRESSION_N,
  MIN_REGRESSION_N,
  PRIVATE_TAPE_CONFIG,
  modeledAssetWeights,
} from "./privateTape.mjs";

export const PRIVATE_TAPE_ENDPOINTS = Object.freeze({
  json: "/api/private-tape",
  manifest: "/api/private-tape/manifest",
  overnightCsv: "/api/private-tape?format=csv&dataset=overnight",
  rthCsv: "/api/private-tape?format=csv&dataset=rth",
});

export const PRIVATE_TAPE_DATA_COLUMNS = Object.freeze({
  overnight: Object.freeze([
    "date",
    "prior_date",
    "start_et",
    "end_et",
    "dxyz_opening_gap",
    "weighted_private_return",
    "anthropic_return",
    "spacex_return",
    "qqq_opening_gap",
    "anthropic_start_at_et",
    "anthropic_end_at_et",
    "spacex_start_at_et",
    "spacex_end_at_et",
  ]),
  rth: Object.freeze([
    "date",
    "time_et",
    "end_ms",
    "dxyz_return",
    "anthropic_return",
    "spacex_return",
    "qqq_return",
  ]),
});

export function privateTapeOpenDataManifest(config = PRIVATE_TAPE_CONFIG) {
  const weights = modeledAssetWeights(config);

  return {
    title: "Private Tape / DXYZ Shadow NAV",
    slug: "private-tape",
    productLanguage:
      "Private Tape: what the 24/7 markets for Anthropic and SpaceX imply for DXYZ before the NYSE opens.",
    schemaVersion: config.schemaVersion,
    methodologyVersion: config.methodologyVersion,
    staticConfigPath: "data/private-tape.json",
    schemaPath: "data/schema/private-tape.schema.json",
    endpoints: PRIVATE_TAPE_ENDPOINTS,
    license: {
      curatedData: "CC BY 4.0, to the extent applicable rights exist",
      code: "MIT",
      attribution: "stocks.bolewood.com",
    },
    updatePolicy: {
      curatedConfig:
        "Modeled assets, filed weights, source links, and methodology notes live in the open repo.",
      liveExports:
        "Aligned observations are generated at request time from Hyperliquid and Yahoo market data.",
    },
    liveMarketData: {
      redistributedInRepo: false,
      note:
        "Raw Hyperliquid candles, Yahoo candles, and live quotes are runtime inputs and are not committed to data/.",
    },
    returnConvention: {
      type: "simple_return",
      formula: "end_price / start_price - 1",
      note: "Do not use raw price-level correlation for Private Tape analyses.",
    },
    modeledSleeve: {
      asOf: config.asOf,
      dxyzFiledPortfolioValue: config.dxyzFiledPortfolioValue,
      totalFiledWeight: weights.totalFiledWeight,
      weights: {
        anthropic: weights.anthropic,
        spacex: weights.spacex,
      },
      note: config.modeledAssetsNote,
    },
    datasets: [
      {
        id: "json",
        label: "Full Private Tape payload",
        endpoint: PRIVATE_TAPE_ENDPOINTS.json,
        format: "json",
        includes: ["config", "marketStatus", "cards", "analyses", "datasets"],
      },
      {
        id: "overnight",
        label: "Overnight lead/lag samples",
        endpoint: PRIVATE_TAPE_ENDPOINTS.overnightCsv,
        format: "csv",
        grain: "one row per NYSE session with a prior close and next open",
        columns: PRIVATE_TAPE_DATA_COLUMNS.overnight,
      },
      {
        id: "rth",
        label: "Overlapping NYSE-hours return samples",
        endpoint: PRIVATE_TAPE_ENDPOINTS.rthCsv,
        format: "csv",
        grain: "30-minute returns where DXYZ, ANTH, SPCX, and optionally QQQ overlap",
        columns: PRIVATE_TAPE_DATA_COLUMNS.rth,
      },
    ],
    analysisMinimums: {
      correlationN: MIN_CORRELATION_N,
      overnightRegressionN: MIN_REGRESSION_N,
      residualRegressionN: MIN_MULTI_REGRESSION_N,
    },
    methodology: [
      "Use simple returns consistently.",
      "Compare DXYZ to private markets only during overlapping NYSE cash-session windows.",
      "For overnight lead/lag, use private-market prices closed at or before the prior DXYZ close and the next DXYZ open.",
      "Normalize the two-asset private index and DXYZ to 100 at the first common close.",
      "Regress DXYZ short-window returns on ANTH, SPCX, and QQQ before displaying the residual series.",
    ],
    caveats: [
      "ANTH is very new, so sample sizes may be tiny.",
      "Hyperliquid HIP-3 oracle/index methodology may incorporate external references and local market-price smoothing.",
      "Perpetual-market volume is not equivalent to cash equity turnover.",
      "No causal claim is made.",
      "The two-asset modeled sleeve is not full DXYZ NAV and is not fair value.",
    ],
    sources: config.sources,
  };
}
