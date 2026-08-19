// Single loader over data/. Production modules must not define wrapper-specific
// financial inputs; they import hydrated records from here.

import meta from "../data/meta.json" with { type: "json" };
import marks from "../data/marks.json" with { type: "json" };
import goog from "../data/wrappers/GOOG.json" with { type: "json" };
import amzn from "../data/wrappers/AMZN.json" with { type: "json" };
import msft from "../data/wrappers/MSFT.json" with { type: "json" };
import sftby from "../data/wrappers/SFTBY.json" with { type: "json" };
import nvda from "../data/wrappers/NVDA.json" with { type: "json" };
import skm from "../data/wrappers/SKM.json" with { type: "json" };
import zm from "../data/wrappers/ZM.json" with { type: "json" };
import agix from "../data/wrappers/AGIX.json" with { type: "json" };
import dxyz from "../data/wrappers/DXYZ.json" with { type: "json" };
import arkvx from "../data/wrappers/ARKVX.json" with { type: "json" };
import vcx from "../data/wrappers/VCX.json" with { type: "json" };
import {
  impliedExposure,
  markById,
  markPostMoney,
  adsEquivalentShares,
} from "../reference/derive.mjs";
import { secondaryOnly } from "../data/schema/validate.mjs";

const RAW_WRAPPERS = [
  goog,
  amzn,
  msft,
  sftby,
  nvda,
  skm,
  zm,
  agix,
  dxyz,
  arkvx,
  vcx,
];

const BASIS_TO_APP = {
  disclosed: "disclosed",
  "pro-forma": "proforma",
  historical: "historical",
  "filed-fv-equiv": "filedFv",
  "carrying-value-equiv": "carrying",
  "round-implied": "roundImplied",
  commitment: "commitment",
  estimate: "estimate",
};

const DENOM_TO_APP = {
  "market-cap": "marketCap",
  "adr-equivalent-market-cap": "adrMarketCap",
  "total-net-assets": "netAssets",
  unknown: "marketCap",
};

const FUND_TYPES = new Set([
  "closed-end-fund",
  "interval-fund",
  "etf",
]);

function sourceBlurb(leg) {
  return (leg.sources || [])
    .map((s) => s.note)
    .filter(Boolean)
    .join(" ");
}

function hydrateLeg(raw) {
  if (!raw) return null;
  const exposure = impliedExposure(raw, marks);
  const markId = raw.measurementCompanyMark || raw.roundPostMoneyValuation;
  const roundVal = markPostMoney(marks, markId);
  const asOf =
    raw.ownershipAsOf ||
    raw.estimateAsOf ||
    raw.fairValueAsOf ||
    raw.carryingValueAsOf ||
    raw.investmentAsOf ||
    raw.commitmentAsOf ||
    null;
  const markAsOf = raw.measurementMarkAsOf || null;
  const common = {
    basis: BASIS_TO_APP[raw.basis],
    basisId: raw.basis,
    holdingSecurity: raw.holdingSecurity,
    confidence: raw.confidence,
    asOf,
    markAsOf,
    source: sourceBlurb(raw),
    sources: raw.sources,
    secondaryOnly: secondaryOnly(raw),
    computed: { impliedExposure: exposure },
    exclusions: raw.exclusions || null,
    displayAsMax: !!raw.displayAsMax,
    capPct: raw.capPct || null,
    pctLow: raw.pctLow,
    pctHigh: raw.pctHigh,
  };

  if (raw.basis === "commitment") {
    return {
      kind: "commitment",
      ownershipPct: null,
      contributePer100: false,
      showPct: false,
      investmentUsd: raw.commitmentAmount || null,
      status: raw.status,
      ...common,
    };
  }
  if (raw.basis === "filed-fv-equiv" || raw.basis === "carrying-value-equiv") {
    return {
      kind: "fund",
      fairValue: raw.reportedFairValue || raw.reportedCarryingValue,
      roundVal,
      ownershipPct: exposure,
      ...common,
    };
  }
  if (raw.basis === "round-implied") {
    return {
      kind: "round-implied",
      investmentUsd: raw.investmentAmount,
      roundVal,
      ownershipPct: exposure,
      ...common,
    };
  }
  return {
    kind: "equity",
    ownershipPct: exposure,
    ...common,
  };
}

function sharesOutstandingOf(raw) {
  if (raw.filedSnapshot?.netAssets > 0 && raw.filedSnapshot?.navPerShare > 0) {
    return raw.filedSnapshot.netAssets / raw.filedSnapshot.navPerShare;
  }
  const n = raw.shareCount?.value;
  if (!(n > 0)) return 0;
  if (raw.adrRatio) return adsEquivalentShares(n, raw.adrRatio);
  return n;
}

function sharesAsOfOf(raw) {
  if (raw.denominatorType === "total-net-assets") {
    return raw.totalNetAssets?.asOf || raw.shareCount?.asOf;
  }
  return (
    raw.shareCount?.asOf ||
    raw.filedSnapshot?.asOf ||
    raw.totalNetAssets?.asOf ||
    null
  );
}

export function hydrateWrapper(raw) {
  return {
    ticker: raw.ticker,
    yahooSymbol: raw.yahooSymbol,
    name: raw.name,
    type: FUND_TYPES.has(raw.wrapperType) ? "Fund" : "Strategic",
    wrapperType: raw.wrapperType,
    denominatorType: raw.denominatorType,
    denomKind: DENOM_TO_APP[raw.denominatorType] || "marketCap",
    sharesOutstanding: sharesOutstandingOf(raw),
    sharesAsOf: sharesAsOfOf(raw),
    sharesNote: raw.sharesNote || raw.shareCount?.note || null,
    snapshotNote: raw.snapshotNote || null,
    note: raw.note || null,
    confidence: raw.confidence,
    security: raw.security || null,
    navNote: raw.navNote || null,
    anthropic: hydrateLeg(raw.anthropic),
    openai: hydrateLeg(raw.openai),
    totalNetAssets: raw.totalNetAssets?.value ?? null,
    totalNetAssetsAsOf: raw.totalNetAssets?.asOf ?? null,
    classDShareCount: raw.shareCount?.unit === "class-d" ? raw.shareCount.value : null,
    classDShareCountAsOf: raw.shareCount?.unit === "class-d" ? raw.shareCount.asOf : null,
    filedNavPerShare: raw.filedNavPerShare ?? null,
    filedNetAssets: raw.filedNetAssets ?? null,
    listedOn: raw.listedOn ?? null,
    filedSnapshot: raw.filedSnapshot
      ? {
          asOf: raw.filedSnapshot.asOf,
          navPerShare: raw.filedSnapshot.navPerShare,
          totalAssets: raw.filedSnapshot.totalAssets,
          liabilities: raw.filedSnapshot.liabilities,
          netAssets: raw.filedSnapshot.netAssets,
          portfolioValue: raw.filedSnapshot.portfolioValue,
        }
      : null,
    raw,
  };
}

export const META = meta;
export const MARKS = marks;
export const RAW_AI_WRAPPERS = RAW_WRAPPERS;
export const WRAPPERS = RAW_WRAPPERS.map(hydrateWrapper);

export function wrapperByTicker(ticker) {
  return WRAPPERS.find((w) => w.ticker === ticker);
}

function lastPrimarySide(companyKey) {
  const id = marks.lastPrimary[companyKey];
  const round = markById(marks, id);
  const src = round?.sources?.find((s) => s.url) || round?.sources?.[0];
  return {
    round: round.name,
    postMoney: round.postMoney,
    closed: round.closed,
    source: src?.url || src?.note || "",
  };
}

export const LAST_PRIMARY_ROUNDS = {
  asOf: marks.asOf,
  anthropic: lastPrimarySide("anthropic"),
  openai: lastPrimarySide("openai"),
};

export const ANTHROPIC_ROUND_FEB_2026 = markPostMoney(marks, "anthropic-series-g");
export const ANTHROPIC_ROUND_SERIES_H = markPostMoney(marks, "anthropic-series-h");
export const OPENAI_ROUND_FEB_2026 = markPostMoney(marks, "openai-feb-2026");
export const OPENAI_ROUND_MAR_2026 = markPostMoney(marks, "openai-mar-2026");

const arkvxW = wrapperByTicker("ARKVX");
export const ARKVX_NPORT_TNA = arkvxW.totalNetAssets;
export const ARKVX_NPORT_ASOF = arkvxW.totalNetAssetsAsOf;
export const ARKVX_CLASS_D_SO = arkvxW.classDShareCount;
export const ARKVX_CLASS_D_SO_ASOF = arkvxW.classDShareCountAsOf;

const vcxW = wrapperByTicker("VCX");
export const VCX_FILED_NAV = vcxW.filedNavPerShare;
export const VCX_FILED_NET_ASSETS = vcxW.filedNetAssets;
export const VCX_LISTED = vcxW.listedOn;

const dxyzW = wrapperByTicker("DXYZ");
export const DXYZ_FILED = dxyzW.filedSnapshot;
