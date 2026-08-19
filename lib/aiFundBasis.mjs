// Coherent FILED vs ESTIMATED basis for /ai fund rows.
// Live Yahoo price × filed shares is not a date — this module rolls shares,
// net assets, stake FVs, and marks together, or leaves them all at the filing.

import {
  FILED,
  impliedMarch31Shares,
  computeAtmBridge,
} from "./dxyzAtm.mjs";
import {
  ANTHROPIC_ROUND_FEB_2026,
  ANTHROPIC_ROUND_SERIES_H,
  OPENAI_ROUND_FEB_2026,
  OPENAI_ROUND_MAR_2026,
  WRAPPERS,
  claimPct,
  fundClaimPct,
  lookThroughPer100,
  marketCapUsd,
  stalenessLevel,
} from "./aiWrappers.mjs";

export const BASIS_FILED = "filed";
export const BASIS_ESTIMATED = "estimated";
export const DEPLOY_CASH = "cash";
export const DEPLOY_PRORATA = "prorata";
export const DEPLOY_RANGE = "range";

// ARK Venture Fund — interval fund, continuous offering. Yahoo price is NAV.
// Filed: NPORT-P 2026-04-30 net assets / $50.38 NAV.
// Estimated shares: 21,613,728 as of 2026-07-31 (ARK published SO; interval
// inflows since the NPORT). Swap this constant when ARK prints a newer figure.
export const ARKVX_SHARES_EST = 21_613_728;
export const ARKVX_SHARES_EST_ASOF = "2026-07-31";

// VCX N-CSR/A as of 2026-03-31: net assets $678,918k, NAV $18.97, 35,797,138 sh.
// Listed CEF as of 2026-03-19 (converted from a tender-offer fund). Continuous
// offering did not continue post-listing — share count is treated as stable.
export const VCX_FILED_NAV = 18.97;
export const VCX_FILED_NET_ASSETS = 678_918_000;
export const VCX_LISTED = "2026-03-19";

function wrapperByTicker(ticker) {
  return WRAPPERS.find((w) => w.ticker === ticker);
}

function filedFv(leg) {
  return leg?.kind === "fund" ? leg.fairValue : 0;
}

function scaleFv(fv, fromRound, toRound) {
  if (!(fv > 0) || !(fromRound > 0) || !(toRound > 0)) return fv;
  return fv * (toRound / fromRound);
}

function applyDeploy(filedFv, scale, deploy) {
  if (deploy === DEPLOY_PRORATA) return filedFv * scale;
  return filedFv; // cash: new capital sits in cash; FVs unchanged
}

function filedRounds(w) {
  return {
    anthRound: w.anthropic?.roundVal || 0,
    oaiRound: w.openai?.roundVal || 0,
  };
}

export function cappedConfidence(base, asOf, now = new Date()) {
  // P0.4: no HIGH on an as-of older than 90 days.
  if (base === "high" && stalenessLevel(asOf, now) !== "ok") return "medium";
  return base;
}

export function dxyzBridgeFromRows(rows, { mode = "calibrated" } = {}) {
  return computeAtmBridge({
    mode: mode === BASIS_FILED ? "filed" : "calibrated",
    rows: rows || [],
    markedNetAssets: FILED.netAssets,
    baselineShares: impliedMarch31Shares(),
  });
}

export function resolveDxyz(basis, deploy, bridge) {
  const w = wrapperByTicker("DXYZ");
  const filedShares = impliedMarch31Shares();
  const anthFiled = filedFv(w.anthropic);
  const oaiFiled = filedFv(w.openai);
  const filedNav = FILED.navPerShare;

  if (basis === BASIS_FILED || !bridge || bridge.mode === "filed") {
    return {
      shares: filedShares,
      sharesAsOf: FILED.asOf,
      anthFv: anthFiled,
      oaiFv: oaiFiled,
      anthFvHigh: anthFiled,
      oaiFvHigh: oaiFiled,
      nav: filedNav,
      netAssets: FILED.netAssets,
      confidence: cappedConfidence("medium", FILED.asOf), // P0.1: MEDIUM until/while ATM
      affected: true,
      deployRange: false,
      ...filedRounds(w),
    };
  }

  const shares = bridge.proFormaShares;
  const nav = bridge.proFormaNav;
  const netAssets = bridge.proFormaAssets;
  const inflowScale =
    FILED.netAssets > 0 ? netAssets / FILED.netAssets : 1;
  const cashAnth = applyDeploy(anthFiled, inflowScale, DEPLOY_CASH);
  const cashOai = applyDeploy(oaiFiled, inflowScale, DEPLOY_CASH);
  const bookAnth = applyDeploy(anthFiled, inflowScale, DEPLOY_PRORATA);
  const bookOai = applyDeploy(oaiFiled, inflowScale, DEPLOY_PRORATA);
  const range = deploy === DEPLOY_RANGE;
  const pick = deploy === DEPLOY_PRORATA ? "book" : "cash";

  return {
    shares,
    sharesAsOf: bridge.asOfDate,
    anthFv: pick === "book" ? bookAnth : cashAnth,
    oaiFv: pick === "book" ? bookOai : cashOai,
    anthFvHigh: range ? Math.max(cashAnth, bookAnth) : (pick === "book" ? bookAnth : cashAnth),
    oaiFvHigh: range ? Math.max(cashOai, bookOai) : (pick === "book" ? bookOai : cashOai),
    anthFvLow: range ? Math.min(cashAnth, bookAnth) : (pick === "book" ? bookAnth : cashAnth),
    oaiFvLow: range ? Math.min(cashOai, bookOai) : (pick === "book" ? bookOai : cashOai),
    nav,
    netAssets,
    confidence: "medium",
    affected: true,
    deployRange: range,
    ...filedRounds(w),
  };
}

export function resolveArkvx(basis, deploy) {
  const w = wrapperByTicker("ARKVX");
  const filedShares = w.sharesOutstanding;
  const anthFiled = filedFv(w.anthropic);
  const oaiFiled = filedFv(w.openai);
  // Interval fund: Yahoo price is NAV, so filed NAV/sh ≈ Apr 30 $50.38 print.
  const filedNav = 50.38; // YCharts NAV 2026-04-30; NPORT net / this = share count

  if (basis === BASIS_FILED) {
    return {
      shares: filedShares,
      sharesAsOf: w.sharesAsOf,
      anthFv: anthFiled,
      oaiFv: oaiFiled,
      anthFvHigh: anthFiled,
      oaiFvHigh: oaiFiled,
      nav: filedNav,
      netAssets: filedShares * filedNav,
      confidence: cappedConfidence(w.confidence, w.sharesAsOf),
      affected: true,
      deployRange: false,
      ...filedRounds(w),
    };
  }

  const shares = ARKVX_SHARES_EST;
  const inflowScale = filedShares > 0 ? shares / filedShares : 1;
  const cashAnth = applyDeploy(anthFiled, inflowScale, DEPLOY_CASH);
  const cashOai = applyDeploy(oaiFiled, inflowScale, DEPLOY_CASH);
  const bookAnth = applyDeploy(anthFiled, inflowScale, DEPLOY_PRORATA);
  const bookOai = applyDeploy(oaiFiled, inflowScale, DEPLOY_PRORATA);
  const range = deploy === DEPLOY_RANGE;
  const pick = deploy === DEPLOY_PRORATA ? "book" : "cash";
  // ESTIMATED NAV/sh stays the live Yahoo price (interval fund); net assets
  // ≈ price × shares is applied in rowMetrics. Keep a placeholder nav here.
  return {
    shares,
    sharesAsOf: ARKVX_SHARES_EST_ASOF,
    anthFv: pick === "book" ? bookAnth : cashAnth,
    oaiFv: pick === "book" ? bookOai : cashOai,
    anthFvHigh: range ? Math.max(cashAnth, bookAnth) : (pick === "book" ? bookAnth : cashAnth),
    oaiFvHigh: range ? Math.max(cashOai, bookOai) : (pick === "book" ? bookOai : cashOai),
    anthFvLow: range ? Math.min(cashAnth, bookAnth) : (pick === "book" ? bookAnth : cashAnth),
    oaiFvLow: range ? Math.min(cashOai, bookOai) : (pick === "book" ? bookOai : cashOai),
    nav: null, // filled from live price (NAV)
    netAssets: null,
    confidence: cappedConfidence(w.confidence, ARKVX_SHARES_EST_ASOF),
    affected: true,
    deployRange: range,
    ...filedRounds(w),
  };
}

export function resolveVcx(basis) {
  const w = wrapperByTicker("VCX");
  const anthFiled = filedFv(w.anthropic);
  const oaiFiled = filedFv(w.openai);
  const shares = w.sharesOutstanding;

  if (basis === BASIS_FILED) {
    return {
      shares,
      sharesAsOf: w.sharesAsOf,
      anthFv: anthFiled,
      oaiFv: oaiFiled,
      anthFvHigh: anthFiled,
      oaiFvHigh: oaiFiled,
      nav: VCX_FILED_NAV,
      netAssets: VCX_FILED_NET_ASSETS,
      confidence: cappedConfidence(w.confidence, w.sharesAsOf),
      affected: true,
      deployRange: false,
      ...filedRounds(w),
      anthPct: fundClaimPct(anthFiled, ANTHROPIC_ROUND_FEB_2026),
      oaiPct: fundClaimPct(oaiFiled, OPENAI_ROUND_FEB_2026),
    };
  }

  // ESTIMATED: share count held (listed CEF, no ATM). Marks rolled from the
  // Feb 2026 rounds used in the 3/31 filing to last known primary post-money.
  // Stake % = FV / the round that marked it, so the denominator rolls too:
  // (FV × 965/380) / 965 == FV / 380. Ownership does not change because the
  // company got more valuable — only the dollar mark and NAV do.
  const anthEst = scaleFv(
    anthFiled,
    ANTHROPIC_ROUND_FEB_2026,
    ANTHROPIC_ROUND_SERIES_H
  );
  const oaiEst = scaleFv(oaiFiled, OPENAI_ROUND_FEB_2026, OPENAI_ROUND_MAR_2026);
  const netAssets =
    VCX_FILED_NET_ASSETS - anthFiled - oaiFiled + anthEst + oaiEst;
  const nav = shares > 0 ? netAssets / shares : VCX_FILED_NAV;
  const asOf = LAST_PRIMARY_ASOF;
  return {
    shares,
    sharesAsOf: asOf,
    anthFv: anthEst,
    oaiFv: oaiEst,
    anthFvHigh: anthEst,
    oaiFvHigh: oaiEst,
    nav,
    netAssets,
    confidence: cappedConfidence("medium", asOf),
    affected: true,
    deployRange: false,
    anthRound: ANTHROPIC_ROUND_SERIES_H,
    oaiRound: OPENAI_ROUND_MAR_2026,
    // Same shares of Anthropic/OpenAI as filed — do not recompute % from
    // (FV × 965/380) / 965, which is not bit-identical to FV / 380.
    anthPct: fundClaimPct(anthFiled, ANTHROPIC_ROUND_FEB_2026),
    oaiPct: fundClaimPct(oaiFiled, OPENAI_ROUND_FEB_2026),
  };
}

const LAST_PRIMARY_ASOF = "2026-05-28"; // Series H close; OAI round is 2026-03-31

export function resolveAgix(basis) {
  const w = wrapperByTicker("AGIX");
  const asOf = w.sharesAsOf;
  return {
    shares: w.sharesOutstanding,
    sharesAsOf: asOf,
    anthFv: filedFv(w.anthropic),
    oaiFv: 0,
    anthFvHigh: filedFv(w.anthropic),
    oaiFvHigh: 0,
    nav: null, // live Yahoo
    netAssets: null,
    confidence: cappedConfidence(w.confidence, asOf),
    affected: w.type === "Fund",
    deployRange: false,
    ...filedRounds(w),
    // ETF SO already 2026-08-18; FILED and ESTIMATED share the same snapshot.
    sameInBothBases: true,
  };
}

export function resolveFund(wrapper, { basis, deploy, dxyzBridge }) {
  if (wrapper.type !== "Fund") {
    return {
      shares: wrapper.sharesOutstanding,
      sharesAsOf: wrapper.sharesAsOf,
      anthFv: filedFv(wrapper.anthropic),
      oaiFv: filedFv(wrapper.openai),
      anthFvHigh: filedFv(wrapper.anthropic),
      oaiFvHigh: filedFv(wrapper.openai),
      nav: null,
      netAssets: null,
      confidence: cappedConfidence(wrapper.confidence, wrapper.sharesAsOf),
      affected: false,
      deployRange: false,
      ...filedRounds(wrapper),
    };
  }
  if (wrapper.ticker === "DXYZ") return resolveDxyz(basis, deploy, dxyzBridge);
  if (wrapper.ticker === "ARKVX") return resolveArkvx(basis, deploy);
  if (wrapper.ticker === "VCX") return resolveVcx(basis);
  if (wrapper.ticker === "AGIX") return resolveAgix(basis);
  return {
    shares: wrapper.sharesOutstanding,
    sharesAsOf: wrapper.sharesAsOf,
    anthFv: filedFv(wrapper.anthropic),
    oaiFv: filedFv(wrapper.openai),
    anthFvHigh: filedFv(wrapper.anthropic),
    oaiFvHigh: filedFv(wrapper.openai),
    nav: null,
    netAssets: null,
    confidence: cappedConfidence(wrapper.confidence, wrapper.sharesAsOf),
    affected: true,
    deployRange: false,
    ...filedRounds(wrapper),
  };
}

export function fundRowMetrics(wrapper, price, { anthVal, oaiVal, dilution, resolved }) {
  const shares = resolved.shares;
  const mcap = marketCapUsd(price, shares);
  const nav = resolved.nav ?? (wrapper.ticker === "ARKVX" || wrapper.ticker === "AGIX" ? price : null);
  const netAssets = resolved.netAssets ?? (nav != null ? nav * shares : null);
  const premium =
    nav > 0 && price > 0 && wrapper.type === "Fund" ? price / nav - 1 : null;

  const anthRound = resolved.anthRound || wrapper.anthropic?.roundVal;
  const oaiRound = resolved.oaiRound || wrapper.openai?.roundVal;
  const anthPct =
    resolved.anthPct != null
      ? resolved.anthPct
      : anthRound
        ? fundClaimPct(resolved.anthFv, anthRound)
        : claimPct(wrapper.anthropic);
  const oaiPct =
    resolved.oaiPct != null
      ? resolved.oaiPct
      : oaiRound
        ? fundClaimPct(resolved.oaiFv, oaiRound)
        : claimPct(wrapper.openai);
  const anthPer100 = lookThroughPer100({
    claimPct: anthPct,
    ipoVal: anthVal,
    marketCap: mcap,
    dilution,
  });
  const oaiPer100 = lookThroughPer100({
    claimPct: oaiPct,
    ipoVal: oaiVal,
    marketCap: mcap,
    dilution,
  });

  let anthPer100High = anthPer100;
  let oaiPer100High = oaiPer100;
  if (resolved.deployRange && resolved.anthFvHigh !== resolved.anthFv) {
    anthPer100High = lookThroughPer100({
      claimPct: fundClaimPct(resolved.anthFvHigh, anthRound),
      ipoVal: anthVal,
      marketCap: mcap,
      dilution,
    });
    oaiPer100High = lookThroughPer100({
      claimPct: fundClaimPct(resolved.oaiFvHigh, oaiRound),
      ipoVal: oaiVal,
      marketCap: mcap,
      dilution,
    });
  }

  const anthLo = Math.min(anthPer100, anthPer100High);
  const anthHi = Math.max(anthPer100, anthPer100High);
  const oaiLo = Math.min(oaiPer100, oaiPer100High);
  const oaiHi = Math.max(oaiPer100, oaiPer100High);

  return {
    ticker: wrapper.ticker,
    price,
    shares,
    sharesAsOf: resolved.sharesAsOf,
    marketCap: mcap,
    anthPct,
    oaiPct,
    anthPer100: anthLo,
    oaiPer100: oaiLo,
    anthPer100High: anthHi,
    oaiPer100High: oaiHi,
    combinedPer100: anthLo + oaiLo,
    combinedPer100High: anthHi + oaiHi,
    nav,
    premium,
    confidence: resolved.confidence,
    affected: resolved.affected,
    deployRange: resolved.deployRange,
  };
}
