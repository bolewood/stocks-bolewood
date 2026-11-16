// Pure holdings valuation shared by the DXYZ page and regression checks.
// Baseline: September 30, 2026 NPORT-P / NPORT-EX (filed Nov 16).
import { FILED, OTHER_NET_ASSETS } from "./dxyzAtm.mjs";
import { SPCX_POST_SPLIT_SHARES, SPCX_SPLIT, SPCX_FILED_MARK_PPS, SPCX_YAHOO_SYMBOL, SPCX_VAL_USD_TOTAL, spcxPositionValueAt } from "./dxyzSpcx.mjs";
import { ANTHROPIC_SPV, OPENAI_EQUITY_SPV, SHARE_LOTS, MOIC_LOTS, MONEY_MARKET, longTailValue, markPerUnit, anthropicNavPerDollarPps, SPCX_IN_KIND_DISTRIBUTION } from "./dxyzHoldings.mjs";
import { OPENAI_LEG, SUBSEQUENT_OPENAI_PURCHASE, OTHER_SUBSEQUENT_PURCHASES, SUBSEQUENT_DEALS_AS_OF } from "./dxyzHoldings.mjs";
import { unitLots, impliedValuation, CAPITALIZATION, DEFAULT_DXYZ_OAI_ENTRY_PRICE } from "../reference/unitExposure.mjs";
import { valuationFromPrice, priceFromValuation } from "./shareBasis.mjs";

// Anthropic on /dxyz is an ANT (post-split) $/share input. Implied valuation =
// price × the fully diluted count at that price (S-1/A No. 2 p. 24, treasury
// method), labelled with its basis.
export const ANTHROPIC_EV_BASIS = "fullyDiluted";
export function anthropicImpliedValuation(antPrice, basis = ANTHROPIC_EV_BASIS) {
  if (!(antPrice > 0)) return null;
  return valuationFromPrice(antPrice, basis);
}
export function anthropicPpsFromValuation(valuation, basis = ANTHROPIC_EV_BASIS) {
  return priceFromValuation(valuation, basis).value;
}
const ANTHROPIC_NAV_SENS = anthropicNavPerDollarPps();

// 9/30 Anthropic mark per post-split share: $382,879,609 ÷ 3,860,880 = $99.17.
export const ANTHROPIC_FILED_MARK_PPS = ANTHROPIC_SPV.valUSD / ANTHROPIC_SPV.postSplitUnits;

// Class N / lock-up discount on the Anthropic sleeve once marked to ANT
// (DXYZ's Series B converts to non-voting, unlisted Class N). Default 0.
export const DEFAULT_ANTH_CLASS_N_DISCOUNT = 0;

export const SHARE_DENOMINATED = [
  {
    name: "SpaceX",
    yahooSymbol: SPCX_YAHOO_SYMBOL,
    units: SPCX_POST_SPLIT_SHARES,
    shares_k: SPCX_POST_SPLIT_SHARES / 1000,
    mark_pps_1231: SPCX_FILED_MARK_PPS,
    filedValue: SPCX_VAL_USD_TOTAL,
    valueAt: spcxPositionValueAt,
    note: `DXYZ SpaceX I 607,877 + Snowpoint 2.6 142,430 + direct Class A 109,525 at SPCX; MWAM VC SpaceX-II 172,558 with 10% carry. ${SPCX_IN_KIND_DISTRIBUTION.shares.toLocaleString("en-US")} direct shares came from an in-kind SPV distribution, not a purchase. Units are post ${SPCX_SPLIT.ratio}-for-1 Unit Parity (${SPCX_SPLIT.effective}). Do not re-split.`,
  },
  {
    name: "Anthropic",
    units: ANTHROPIC_SPV.postSplitUnits,
    shares_k: ANTHROPIC_SPV.postSplitUnits / 1000,
    mark_pps_1231: ANTHROPIC_FILED_MARK_PPS,
    filedValue: ANTHROPIC_SPV.valUSD,
    evBasis: ANTHROPIC_EV_BASIS,
    splitFactor: CAPITALIZATION.anthropic.splitFactor,
    classNDiscount: true,
    note: `${ANTHROPIC_SPV.vehicle} · ${ANTHROPIC_SPV.units.toLocaleString("en-US")} pre-split units = ${ANTHROPIC_SPV.postSplitUnits.toLocaleString("en-US")} ANT share-equivalents (10-for-1 split effective 2026-09-17) · 0% carry · ΔNAV/share = $${ANTHROPIC_NAV_SENS.toFixed(5)} per $1 of ANT price. Series B converts to non-voting, unlisted Class N (S-1 pp. 20, 309).`,
  },
  {
    name: "OpenAI",
    units: OPENAI_EQUITY_SPV.units,
    shares_k: OPENAI_EQUITY_SPV.units / 1000,
    mark_pps_1231: markPerUnit(OPENAI_EQUITY_SPV),
    filedValue: OPENAI_EQUITY_SPV.valUSD,
    fdShares: CAPITALIZATION.openai.defaultShares,
    note: `${OPENAI_EQUITY_SPV.vehicle} Series C preferred + Class A common · ${OPENAI_EQUITY_SPV.units.toLocaleString("en-US")} units (incl. the August 13 $150M lot) · 0% carry. PPUs are a separate NAV line, excluded from /ai IPO scaling.`,
  },
  ...SHARE_LOTS.map((lot) => ({
    name: lot.name,
    units: lot.units,
    shares_k: lot.units / 1000,
    mark_pps_1231: Number((lot.valUSD / lot.units).toFixed(2)),
    filedValue: lot.valUSD,
    note: lot.note,
  })),
];

export const DOLLAR_DENOMINATED = MOIC_LOTS.map((lot) => ({
  name: lot.name,
  value_k: lot.valUSD / 1000,
  note: lot.note,
}));

export const OTHER_CASH_NAME = "Other Cash & Equivalents (net)";

export const OTHER_HOLDINGS = [
  {
    name: MONEY_MARKET.name,
    value_k: MONEY_MARKET.valUSD / 1000,
    locked: true,
    note: "First American Treasury Obligations, 3.78%, 29.00% of net assets (NPORT-EX 9/30)",
  },
  {
    name: "Long Tail Private Holdings",
    value_k: longTailValue() / 1000,
    note: "Residual of unnamed September 30 lots so named holdings + cash + residual = filed investments",
  },
  {
    name: OTHER_CASH_NAME,
    value_k: OTHER_NET_ASSETS / 1000,
    locked: true,
    note: "Other assets less liabilities on the 9/30 schedule ($190,163,916, 10.41%); the 424B3 labels it Other Cash & Cash Equivalents. Gross cash $200.1M less net liabilities.",
  },
];

export function calculateDxyzNav({
  ppsOverrides = Object.fromEntries(SHARE_DENOMINATED.map(p => [p.name, p.mark_pps_1231])),
  dxyzShares = FILED.sharesOutstanding / 1e6,
  dollarMOICs = Object.fromEntries(DOLLAR_DENOMINATED.map(p => [p.name, 1])),
  otherMOICs = Object.fromEntries(OTHER_HOLDINGS.map(p => [p.name, 1])),
  includeSubsequent = true,
  entryPrice = DEFAULT_DXYZ_OAI_ENTRY_PRICE,
  anthClassNDiscount = DEFAULT_ANTH_CLASS_N_DISCOUNT,
} = {}) {
  if (!Number.isFinite(dxyzShares) || dxyzShares <= 0) throw new Error("DXYZ shares must be positive");
  const discount = Math.min(Math.max(Number(anthClassNDiscount) || 0, 0), 0.95);
  const acquisitionLot = unitLots(OPENAI_LEG, { includeAcquisition: includeSubsequent, entryPrice })
    .find(lot => lot.id === SUBSEQUENT_OPENAI_PURCHASE.id);
  const otherPurchases = includeSubsequent ? OTHER_SUBSEQUENT_PURCHASES : [];
  const cashSpent = (acquisitionLot?.carryingValue || 0) + otherPurchases.reduce((sum, p) => sum + p.costUsd, 0);
  const shareRows = SHARE_DENOMINATED.map((p) => {
    const pps = Math.max(0, Number(ppsOverrides[p.name] ?? p.mark_pps_1231) || 0);
    const units = p.units ?? p.shares_k * 1000;
    let positionValue;
    if (p.valueAt) positionValue = p.valueAt(pps);
    else if (p.name !== "OpenAI" && p.name !== "Anthropic" && p.filedValue != null && Math.abs(pps - p.mark_pps_1231) < 0.005) {
      positionValue = p.filedValue;
    } else {
      positionValue = pps * units;
    }
    const discountApplied = p.classNDiscount ? discount : 0;
    if (discountApplied > 0) positionValue *= 1 - discountApplied;
    const navPerShare = positionValue / (dxyzShares * 1_000_000);
    const anthEv = p.evBasis ? anthropicImpliedValuation(pps, p.evBasis) : null;
    const companyValue = anthEv ? anthEv.value : p.fdShares > 0 ? impliedValuation({ pps, fdShares: p.fdShares }) : null;
    return { ...p, pps, positionValue, navPerShare, companyValue, companyValueLabel: anthEv?.label ?? null, discountApplied };
  });

  const openaiPps = shareRows.find(p => p.name === "OpenAI").pps;
  const subsequentValue = acquisitionLot ? acquisitionLot.units * openaiPps : 0;
  if (acquisitionLot) shareRows.splice(3, 0, {
    name: "OpenAI — October 13 Series D", inputName: "OpenAI", estimated: true,
    units: acquisitionLot.units, shares_k: acquisitionLot.units / 1000,
    pps: openaiPps, mark_pps_1231: entryPrice,
    positionValue: subsequentValue, navPerShare: subsequentValue / (dxyzShares * 1e6),
    note: `${acquisitionLot.asOf} · ${SUBSEQUENT_OPENAI_PURCHASE.security}, $${(SUBSEQUENT_OPENAI_PURCHASE.costUsd / 1e6).toFixed(1)}M. Estimated units = filed cost ÷ assumed entry price (default: 9/30 Goanna mark). Same scenario PPS as the 9/30 position; parity assumed.`,
  });
  const dollarRows = DOLLAR_DENOMINATED.map((p) => {
    const moic = Math.max(0, Number(dollarMOICs[p.name] ?? 1) || 0);
    const positionValue = p.value_k * 1000 * moic;
    return { ...p, moic, markValue: p.value_k * 1000, positionValue, navPerShare: positionValue / (dxyzShares * 1_000_000) };
  });

  const otherRows = OTHER_HOLDINGS.map((p) => {
    const moic = p.locked ? 1 : Math.max(0, Number(otherMOICs[p.name] ?? 1) || 0);
    const positionValue = p.value_k * 1000 * moic - (p.name === MONEY_MARKET.name ? cashSpent : 0);
    return { ...p, moic, markValue: p.value_k * 1000, positionValue, navPerShare: positionValue / (dxyzShares * 1_000_000) };
  });

  if (includeSubsequent) {
    const cashRow = otherRows.find(p => p.name === MONEY_MARKET.name);
    cashRow.note = `September 30 money market less $${(cashSpent / 1e6).toFixed(1)}M of post-9/30 deals (424B3, as of ${SUBSEQUENT_DEALS_AS_OF}). Before modeled ATM proceeds, fees and interest.`;
    for (const p of otherPurchases) otherRows.push({
      name: p.name, note: `${p.date} · ${p.security}. ${p.valuationBasis}.`, locked: true, subsequent: true,
      markValue: p.costUsd, positionValue: p.costUsd, navPerShare: p.costUsd / (dxyzShares * 1e6), moic: 1,
    });
  }
  const shareTotal = shareRows.reduce((s, r) => s + r.positionValue, 0);
  const dollarTotal = dollarRows.reduce((s, r) => s + r.positionValue, 0);
  const otherTotal = otherRows.reduce((s, r) => s + r.positionValue, 0);
  const totalNAV = shareTotal + dollarTotal + otherTotal;
  const navPerShare = totalNAV / (dxyzShares * 1_000_000);
  const cashAfter = otherRows.filter(r => r.name === MONEY_MARKET.name || r.name === OTHER_CASH_NAME).reduce((s, r) => s + r.positionValue, 0);

  return { shareRows, dollarRows, otherRows, shareTotal, dollarTotal, otherTotal, totalNAV, navPerShare, acquisitionLot, subsequentValue, cashSpent, cashAfter, subsequentGain: subsequentValue - (acquisitionLot?.carryingValue || 0) };
}
