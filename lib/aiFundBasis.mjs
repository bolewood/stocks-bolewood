// Select filed or estimated holdings, then revalue quantified legs in either
// mode. Measurement dates and scenario assumptions remain separate.

import {
  FILED,
  impliedFiledShares,
  computeAtmBridge,
} from "./dxyzAtm.mjs";
import {
  ANTHROPIC_ROUND_FEB_2026,
  ANTHROPIC_ROUND_SERIES_H,
  ARKVX_CLASS_D_SO,
  ARKVX_CLASS_D_SO_ASOF,
  ARKVX_NPORT_ASOF,
  ARKVX_NPORT_TNA,
  OPENAI_ROUND_FEB_2026,
  OPENAI_ROUND_MAR_2026,
  VCX_FILED_NAV,
  VCX_FILED_NET_ASSETS,
  VCX_LISTED,
  WRAPPERS,
  claimPct,
  fundClaimPct,
  lookThroughPer100,
  marketCapUsd,
  stalenessLevel,
} from "./aiWrappers.mjs";
import { CAPITALIZATION, DEFAULT_ANTH_FD_SHARES, DEFAULT_OAI_FD_SHARES, DEFAULT_DXYZ_OAI_ENTRY_PRICE, valueUnitLots } from '../reference/unitExposure.mjs';

export const BASIS_FILED = "filed";
export const BASIS_ESTIMATED = "estimated";
export const DEPLOY_CASH = "cash";
export const DEPLOY_PRORATA = "prorata";
export const DEPLOY_RANGE = "range";

// Class D published SO — current-assets proxy only, not fund TNA.
export const ARKVX_SHARES_EST = ARKVX_CLASS_D_SO;
export const ARKVX_SHARES_EST_ASOF = ARKVX_CLASS_D_SO_ASOF;

export { VCX_FILED_NAV, VCX_FILED_NET_ASSETS, VCX_LISTED };

function wrapperByTicker(ticker) {
  return WRAPPERS.find((w) => w.ticker === ticker);
}

function filedFv(leg) {
  return leg?.kind === "fund" || leg?.kind === "filed-units" ? leg.fairValue : 0;
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
    baselineShares: impliedFiledShares(),
  });
}

export function resolveDxyz(basis, deploy, bridge) {
  const w = wrapperByTicker("DXYZ");
  const filedShares = impliedFiledShares();
  const anthFiled = filedFv(w.anthropic);
  const oaiFiled = filedFv(w.openai);
  const subsequentOai = Number(w.openai?.subsequentPurchasesUsd) || 0;
  const filedNav = FILED.navPerShare;

  if (basis === BASIS_FILED) {
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
      includeAcquisition: false,
      unitScale: 1,
      unitScaleHigh: 1,
      ...filedRounds(w),
    };
  }

  const shares = bridge?.proFormaShares || filedShares;
  const nav = bridge?.proFormaNav || filedNav;
  const netAssets = bridge?.proFormaAssets || FILED.netAssets;
  const inflowScale =
    FILED.netAssets > 0 ? Math.max(1, netAssets / FILED.netAssets) : 1;
  // Subsequent OpenAI purchase is a mix shift from cash already inside June 30
  // NAV — add the dollars, do not grow net assets, do not scale with later ATM.
  const cashAnth = applyDeploy(anthFiled, inflowScale, DEPLOY_CASH);
  const cashOai = applyDeploy(oaiFiled, inflowScale, DEPLOY_CASH) + subsequentOai;
  const bookAnth = applyDeploy(anthFiled, inflowScale, DEPLOY_PRORATA);
  const bookOai = applyDeploy(oaiFiled, inflowScale, DEPLOY_PRORATA) + subsequentOai;
  const range = deploy === DEPLOY_RANGE;
  const pick = deploy === DEPLOY_PRORATA ? "book" : "cash";

  return {
    shares,
    sharesAsOf: bridge?.asOfDate || FILED.asOf,
    includeAcquisition: true,
    unitScale: pick === 'book' ? inflowScale : 1,
    unitScaleHigh: range || pick === 'book' ? inflowScale : 1,
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
  const anthFiled = filedFv(w.anthropic);
  const oaiFiled = filedFv(w.openai);
  const tnaFiled = ARKVX_NPORT_TNA;

  if (basis === BASIS_FILED) {
    return {
      shares: ARKVX_CLASS_D_SO,
      sharesAsOf: ARKVX_NPORT_ASOF,
      anthFv: anthFiled,
      oaiFv: oaiFiled,
      anthFvHigh: anthFiled,
      oaiFvHigh: oaiFiled,
      nav: null,
      netAssets: tnaFiled,
      confidence: cappedConfidence(w.confidence, ARKVX_NPORT_ASOF),
      affected: true,
      deployRange: false,
      snapshot: true,
      ...filedRounds(w),
    };
  }

  const range = deploy === DEPLOY_RANGE;
  const pick = deploy === DEPLOY_PRORATA ? "book" : "cash";
  // Into-book: same Apr 30 TNA and holdings → per-$100 is the coherent snapshot.
  // Cash: Apr 30 holdings over a larger current-assets proxy (Class D SO × NAV).
  return {
    shares: ARKVX_CLASS_D_SO,
    sharesAsOf: pick === "book" ? ARKVX_NPORT_ASOF : ARKVX_CLASS_D_SO_ASOF,
    anthFv: anthFiled,
    oaiFv: oaiFiled,
    anthFvHigh: anthFiled,
    oaiFvHigh: oaiFiled,
    nav: null,
    netAssets: pick === "book" ? tnaFiled : null,
    confidence: cappedConfidence(w.confidence, ARKVX_NPORT_ASOF),
    affected: true,
    deployRange: range,
    snapshot: true,
    ...filedRounds(w),
  };
}

export function resolveVcx(basis) {
  const w = wrapperByTicker("VCX");
  const anthFiled = filedFv(w.anthropic);
  const oaiFiled = filedFv(w.openai);
  const shares = w.sharesOutstanding;
  const anthFiledRound = w.anthropic?.roundVal || ANTHROPIC_ROUND_FEB_2026;
  const oaiFiledRound = w.openai?.roundVal || OPENAI_ROUND_FEB_2026;

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
      anthPct: fundClaimPct(anthFiled, anthFiledRound),
      oaiPct: fundClaimPct(oaiFiled, oaiFiledRound),
    };
  }

  // ESTIMATED: share count held (listed CEF, no ATM). Marks rolled from the
  // round that produced the June 30 NPORT FV to last known primary post-money.
  // Stake % = FV / the round that marked it, so the denominator rolls too.
  // Anthropic remaining lots are already at an implied ~$864B NPORT mark, not
  // Series G; OpenAI lots were unchanged at the Feb 2026 ~$850B fund mark.
  const anthEst = scaleFv(
    anthFiled,
    anthFiledRound,
    ANTHROPIC_ROUND_SERIES_H
  );
  const oaiEst = scaleFv(oaiFiled, oaiFiledRound, OPENAI_ROUND_MAR_2026);
  const netAssets =
    VCX_FILED_NET_ASSETS - anthFiled - oaiFiled + anthEst + oaiEst;
  const nav = shares > 0 ? netAssets / shares : VCX_FILED_NAV;
  const asOf = LAST_PRIMARY_ASOF;
  return {
    shares,
    sharesAsOf: w.sharesAsOf,
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
    anthPct: fundClaimPct(anthFiled, anthFiledRound),
    oaiPct: fundClaimPct(oaiFiled, oaiFiledRound),
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

export function fundRowMetrics(wrapper, price, { anthVal, oaiVal, dilution = 0, resolved, anthFdShares = DEFAULT_ANTH_FD_SHARES, oaiFdShares = DEFAULT_OAI_FD_SHARES, dxyzOaiEntryPrice = DEFAULT_DXYZ_OAI_ENTRY_PRICE }) {
  const shares = resolved.shares;
  const mcap = marketCapUsd(price, shares);
  const denomKind = wrapper.denomKind || "marketCap";
  const proxy = denomKind === "netAssets" ? ARKVX_CLASS_D_SO * price : null;
  const wrapperValue = denomKind === "netAssets" ? (resolved.netAssets ?? proxy) : mcap;
  const highDenom = resolved.deployRange && denomKind === 'netAssets' ? ARKVX_NPORT_TNA : wrapperValue;
  const legs = {};
  for (const [side, key, valuation, fdShares] of [['anthropic','anth',anthVal,anthFdShares], ['openai','oai',oaiVal,oaiFdShares]]) {
    const leg = wrapper[side];
    if (leg?.kind === 'filed-units') {
      const opts = { valuation, fdShares, dilution, wrapperValue, includeAcquisition: !!resolved.includeAcquisition, unitScale: resolved.unitScale || 1, entryPrice: dxyzOaiEntryPrice };
      const point = valueUnitLots(leg.raw, opts);
      const high = valueUnitLots(leg.raw, { ...opts, wrapperValue: highDenom, unitScale: resolved.unitScaleHigh || 1 });
      const cap = CAPITALIZATION[side];
      const lowFd = valueUnitLots(leg.raw, { ...opts, fdShares: cap.highShares, entryPrice: leg.raw.acquisition ? CAPITALIZATION.dxyzOpenaiEntry.highPrice : dxyzOaiEntryPrice });
      const highFd = valueUnitLots(leg.raw, { ...opts, fdShares: cap.lowShares, entryPrice: leg.raw.acquisition ? CAPITALIZATION.dxyzOpenaiEntry.lowPrice : dxyzOaiEntryPrice });
      legs[key] = { ...point, high, sensitivity: { low: lowFd.per100, high: highFd.per100 }, assumption: 'Filed units / estimated FD; gross conversion at parity' };
    } else {
      const round = resolved[key + 'Round'] || leg?.roundVal;
      const pct = resolved[key + 'Pct'] ?? (leg?.kind === 'fund' || leg?.kind === 'carrying' ? fundClaimPct(resolved[key + 'Fv'], round) : claimPct(leg));
      const highPct = resolved.deployRange && resolved[key + 'FvHigh'] !== resolved[key + 'Fv'] ? fundClaimPct(resolved[key + 'FvHigh'], round) : pct;
      const pointValue = pct * (1 - dilution) * valuation;
      legs[key] = { pct, scenarioValue: pointValue, per100: wrapperValue > 0 ? pointValue * 100 / wrapperValue : 0, high: { per100: lookThroughPer100({ claimPct: highPct, ipoVal: valuation, marketCap: highDenom, dilution }), wrapperValue: highDenom }, lots: [] };
    }
  }
  const anthLo = Math.min(legs.anth.per100, legs.anth.high.per100);
  const anthHi = Math.max(legs.anth.per100, legs.anth.high.per100);
  const oaiLo = Math.min(legs.oai.per100, legs.oai.high.per100);
  const oaiHi = Math.max(legs.oai.per100, legs.oai.high.per100);
  const nav = resolved.nav ?? (wrapper.ticker === 'AGIX' ? price : null);
  const revaluation = [legs.anth, legs.oai].reduce((sum, leg) => sum + (leg.revaluation || 0), 0);
  return {
    ticker: wrapper.ticker, price, shares, sharesAsOf: resolved.sharesAsOf,
    marketCap: mcap, wrapperValue, denomKind,
    anthPct: legs.anth.pct, oaiPct: legs.oai.pct,
    anthPer100: anthLo, oaiPer100: oaiLo, anthPer100High: anthHi, oaiPer100High: oaiHi,
    combinedPer100: anthLo + oaiLo, combinedPer100High: anthHi + oaiHi,
    anthDetail: legs.anth, oaiDetail: legs.oai,
    // The August purchase exchanged cash for equity; only valuation less
    // carrying cost changes assets. Baseline NAV stays a separate observation.
    scenarioNetAssets: wrapper.ticker === 'DXYZ' ? resolved.netAssets + revaluation : null,
    nav, premium: nav > 0 && price > 0 && wrapper.type === 'Fund' && denomKind !== 'netAssets' ? price / nav - 1 : null,
    confidence: wrapper.anthropic?.hasAssumptions || wrapper.openai?.hasAssumptions ? 'low' : resolved.confidence,
    affected: resolved.affected, deployRange: resolved.deployRange, snapshot: !!resolved.snapshot,
  };
}
