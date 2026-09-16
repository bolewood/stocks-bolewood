// Pure holdings valuation shared by the DXYZ page and regression checks.
import { FILED, OTHER_NET_ASSETS } from "./dxyzAtm.mjs";
import { SPCX_POST_SPLIT_SHARES, SPCX_SPLIT, SPCX_JUNE30_MARK_PPS, SPCX_YAHOO_SYMBOL, SPCX_VAL_USD_TOTAL, spcxPositionValueAt } from "./dxyzSpcx.mjs";
import { ANTHROPIC_SPV, OPENAI_EQUITY_SPV, SHARE_LOTS, MOIC_LOTS, MONEY_MARKET, longTailValue, markPerUnit, anthropicNavPerDollarPps } from "./dxyzHoldings.mjs";
import { OPENAI_LEG, AUGUST_OPENAI_PURCHASE, OTHER_SUBSEQUENT_PURCHASES } from "./dxyzHoldings.mjs";
import { unitLots, impliedValuation, CAPITALIZATION, DEFAULT_DXYZ_OAI_ENTRY_PRICE } from "../reference/unitExposure.mjs";
const ANTHROPIC_NAV_SENS = anthropicNavPerDollarPps();

export const SHARE_DENOMINATED = [
  {
    name: "SpaceX",
    yahooSymbol: SPCX_YAHOO_SYMBOL,
    units: SPCX_POST_SPLIT_SHARES,
    shares_k: SPCX_POST_SPLIT_SHARES / 1000,
    mark_pps_1231: SPCX_JUNE30_MARK_PPS,
    filedValue: SPCX_VAL_USD_TOTAL,
    valueAt: spcxPositionValueAt,
    note: `DXYZ SpaceX I 675,675 + Snowpoint 2.6 142,425 at SPCX; MWAM VC SpaceX-II 214,285 with 10% carry. June 30 units are post ${SPCX_SPLIT.ratio}-for-1 Unit Parity (${SPCX_SPLIT.effective}). Do not re-split.`,
  },
  {
    name: "Anthropic",
    units: ANTHROPIC_SPV.units,
    shares_k: ANTHROPIC_SPV.units / 1000,
    mark_pps_1231: markPerUnit(ANTHROPIC_SPV),
    filedValue: ANTHROPIC_SPV.valUSD,
    fdShares: CAPITALIZATION.anthropic.defaultShares,
    note: `${ANTHROPIC_SPV.vehicle} · ${ANTHROPIC_SPV.units.toLocaleString("en-US")} units · 0% carry · ΔNAV/share = $${ANTHROPIC_NAV_SENS.toFixed(6)} per $1 of Anthropic share price`,
  },
  {
    name: "OpenAI",
    units: OPENAI_EQUITY_SPV.units,
    shares_k: OPENAI_EQUITY_SPV.units / 1000,
    mark_pps_1231: markPerUnit(OPENAI_EQUITY_SPV),
    filedValue: OPENAI_EQUITY_SPV.valUSD,
    fdShares: CAPITALIZATION.openai.defaultShares,
    note: `${OPENAI_EQUITY_SPV.vehicle} Series C · ${OPENAI_EQUITY_SPV.units.toLocaleString("en-US")} units · 0% carry. PPUs are a separate NAV line, excluded from /ai IPO scaling.`,
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

export const OTHER_HOLDINGS = [
  {
    name: MONEY_MARKET.name,
    value_k: MONEY_MARKET.valUSD / 1000,
    locked: true,
    note: "First American Treasury Obligations, 57.48% of net assets (N-CSRS 6/30)",
  },
  {
    name: "Long Tail Private Holdings",
    value_k: longTailValue() / 1000,
    note: "Residual of unnamed June 30 lots so named holdings + cash + residual = filed investments",
  },
  {
    name: "Other Net Assets",
    value_k: OTHER_NET_ASSETS / 1000,
    locked: true,
    note: "Other assets less liabilities on the N-CSRS schedule of investments (−$5,208,892)",
  },
];

export function calculateDxyzNav({
  ppsOverrides = Object.fromEntries(SHARE_DENOMINATED.map(p => [p.name, p.mark_pps_1231])),
  dxyzShares = FILED.sharesOutstanding / 1e6,
  dollarMOICs = Object.fromEntries(DOLLAR_DENOMINATED.map(p => [p.name, 1])),
  otherMOICs = Object.fromEntries(OTHER_HOLDINGS.map(p => [p.name, 1])),
  includeAugust = true,
  entryPrice = DEFAULT_DXYZ_OAI_ENTRY_PRICE,
} = {}) {
  if (!Number.isFinite(dxyzShares) || dxyzShares <= 0) throw new Error("DXYZ shares must be positive");
  const acquisitionLot = unitLots(OPENAI_LEG, { includeAcquisition: includeAugust, entryPrice })
    .find(lot => lot.id === AUGUST_OPENAI_PURCHASE.id);
  const otherPurchases = includeAugust ? OTHER_SUBSEQUENT_PURCHASES : [];
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
    const navPerShare = positionValue / (dxyzShares * 1_000_000);
    const companyValue = p.fdShares > 0 ? impliedValuation({ pps, fdShares: p.fdShares }) : null;
    return { ...p, pps, positionValue, navPerShare, companyValue };
  });

  const augustValue = acquisitionLot ? acquisitionLot.units * shareRows.find(p => p.name === "OpenAI").pps : 0;
  if (acquisitionLot) shareRows.splice(3, 0, {
    name: "OpenAI — August purchase", inputName: "OpenAI", estimated: true,
    units: acquisitionLot.units, shares_k: acquisitionLot.units / 1000,
    pps: shareRows.find(p => p.name === "OpenAI").pps, mark_pps_1231: entryPrice,
    positionValue: augustValue, navPerShare: augustValue / (dxyzShares * 1e6),
    note: `${acquisitionLot.asOf} · ${AUGUST_OPENAI_PURCHASE.security}. Estimated units = filed cost ÷ assumed entry price. Same scenario PPS as June preferred; parity assumed.`,
  });
  const dollarRows = DOLLAR_DENOMINATED.map((p) => {
    const moic = Math.max(0, Number(dollarMOICs[p.name] ?? 1) || 0);
    const positionValue = p.value_k * 1000 * moic;
    return {
      ...p,
      moic,
      markValue: p.value_k * 1000,
      positionValue,
      navPerShare: positionValue / (dxyzShares * 1_000_000),
    };
  });

  const otherRows = OTHER_HOLDINGS.map((p) => {
    const moic = p.locked ? 1 : Math.max(0, Number(otherMOICs[p.name] ?? 1) || 0);
    const positionValue = p.value_k * 1000 * moic - (p.name === MONEY_MARKET.name ? cashSpent : 0);
    return {
      ...p,
      moic,
      markValue: p.value_k * 1000,
      positionValue,
      navPerShare: positionValue / (dxyzShares * 1_000_000),
    };
  });

  if (includeAugust) {
    const cashRow = otherRows.find(p => p.name === MONEY_MARKET.name);
    cashRow.note = `June 30 money market less $${(cashSpent / 1e6).toFixed(0)}M of filed subsequent purchases. Before modeled ATM proceeds and other cash movements.`;
    for (const p of otherPurchases) otherRows.push({
      name: p.name, note: `${p.date} · ${p.security}. ${p.valuationBasis}.`, locked: true,
      markValue: p.costUsd, positionValue: p.costUsd, navPerShare: p.costUsd / (dxyzShares * 1e6), moic: 1,
    });
  }
  const shareTotal = shareRows.reduce((s, r) => s + r.positionValue, 0);
  const dollarTotal = dollarRows.reduce((s, r) => s + r.positionValue, 0);
  const otherTotal = otherRows.reduce((s, r) => s + r.positionValue, 0);
  const totalNAV = shareTotal + dollarTotal + otherTotal;
  const navPerShare = totalNAV / (dxyzShares * 1_000_000);

  return { shareRows, dollarRows, otherRows, shareTotal, dollarTotal, otherTotal, totalNAV, navPerShare, acquisitionLot, augustValue, cashSpent, augustGain: augustValue - (acquisitionLot?.carryingValue || 0) };
}
