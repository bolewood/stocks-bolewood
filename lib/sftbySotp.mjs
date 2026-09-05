import data from '../data/sftby-sotp.json' with { type: 'json' };
import wrapper from '../data/wrappers/SFTBY.json' with { type: 'json' };
import marks from '../data/marks.json' with { type: 'json' };
import { adsEquivalentShares, markPostMoney } from '../reference/derive.mjs';

export { data as SFTBY_SOTP_DATA };
export const IR_JPY_T = data.ir.jpyT;
export const IR_USDJPY = data.ir.usdJpy;
export const ARM_SHARES = data.arm.shares;
export const TOKYO_SHARES = wrapper.shareCount.value;
export const ADR_SHARES = adsEquivalentShares(TOKYO_SHARES, wrapper.adrRatio);
export const OPENAI_DEFAULT_EQUITY_B = markPostMoney(marks, marks.lastPrimary.openai) / 1e9;
export const OPENAI_OWNERSHIP_AT_COMPLETION = wrapper.openai.ownershipPct;
export const jpyTToUsdB = (t, fx = IR_USDJPY) => t * 1000 / fx;

const julyB = wrapper.openai.fundingEvents.find(e => e.date === '2026-07-01').amountUsd / 1e9;
const octoberB = wrapper.openai.fundingEvents.find(e => e.date === '2026-10-01').amountUsd / 1e9;

export const DEFAULT_INPUTS = {
  armPrice: data.quoteSnapshot.ARM,
  sftbyPrice: data.quoteSnapshot.SFTBY,
  usdJpy: data.quoteSnapshot.USDJPY,
  openaiEquityB: OPENAI_DEFAULT_EQUITY_B,
  openaiCase: 'funded13',
  dilutionPct: 0,
  taxPct: data.assumptions.defaultTaxPct,
  armTaxBasisB: data.assumptions.armTaxBasisProxyUsdB,
  liqHaircutPct: data.assumptions.defaultLiquidityPct,
  managementPct: data.assumptions.defaultManagementPct,
  otherNetDebtB: data.assumptions.defaultOtherNetDebtUsdB,
  stubMult: 1,
};

function validate(p) {
  for (const [key, value] of Object.entries(p)) {
    if (key !== 'openaiCase' && !Number.isFinite(value)) throw new RangeError(`${key} must be finite`);
  }
  for (const key of ['armPrice', 'openaiEquityB', 'armTaxBasisB', 'stubMult']) {
    if (p[key] < 0) throw new RangeError(`${key} must not be negative`);
  }
  if (p.usdJpy <= 0 || p.sftbyPrice <= 0) throw new RangeError('FX and SFTBY price must be positive');
  for (const key of ['taxPct', 'liqHaircutPct', 'dilutionPct']) {
    if (p[key] < 0 || p[key] > 100) throw new RangeError(`${key} must be 0–100`);
  }
  if (p.managementPct < 0 || p.managementPct > data.management.equityInterestPct) throw new RangeError('Management sensitivity out of range');
  if (!['current', 'funded13', 'june'].includes(p.openaiCase)) throw new RangeError('Unknown OpenAI case');
}

function calculate(p) {
  const june = p.openaiCase === 'june'; // For an exact historical bridge check.
  const funded = p.openaiCase === 'funded13';
  const newFundingB = june ? 0 : julyB + (funded ? octoberB : 0);
  // The July FV-equivalent coefficient is a valuation calibration, NOT ownership.
  const grossCoefficient = funded ? OPENAI_OWNERSHIP_AT_COMPLETION
    : (june ? data.openaiJune.fairValueUsdB : wrapper.openai.fairValueApproxUsd / 1e9) / OPENAI_DEFAULT_EQUITY_B;
  const openaiGrossB = grossCoefficient * p.openaiEquityB * (1 - p.dilutionPct / 100);
  const openaiNetB = openaiGrossB * (1 - p.liqHaircutPct / 100);
  const openaiChangeB = openaiNetB - data.openaiJune.fairValueUsdB;
  const newRevaluationB = openaiChangeB - newFundingB;
  const managementB = Math.max(0, newRevaluationB) * p.managementPct / 100;
  const armGrossB = ARM_SHARES * p.armPrice / 1e9;
  const armAbfB = jpyTToUsdB(IR_JPY_T.armAbf);
  const armNetB = armGrossB - armAbfB;
  const svf2BaseB = jpyTToUsdB(IR_JPY_T.svf2);
  // Preserve the total (and its rounding) instead of stripping a gross fund
  // holding out of an SBG-attributable NAV and claiming a known net allocation.
  const otherBaseB = jpyTToUsdB(IR_JPY_T.holdings - IR_JPY_T.armAdj - IR_JPY_T.svf2);
  const stubB = otherBaseB * p.stubMult;
  const holdingsB = armNetB + svf2BaseB + stubB + openaiChangeB - managementB;
  const ndJun30B = jpyTToUsdB(IR_JPY_T.sbgAdjNd);
  const sbgNdB = ndJun30B + newFundingB + p.otherNetDebtB;
  const openaiCostB = data.openaiJune.costUsdB + newFundingB;
  const taxB = p.taxPct / 100 * (Math.max(0, armGrossB - p.armTaxBasisB)
    + Math.max(0, openaiNetB - managementB - openaiCostB));
  const navB = holdingsB - sbgNdB - taxB;
  const mcapB = p.sftbyPrice * ADR_SHARES / 1e9;
  return {
    armGrossB, armAbfB, armNetB, openaiGrossB, openaiNetB, openaiChangeB,
    managementB, newRevaluationB, newFundingB, svf2BaseB, stubB, holdingsB,
    ndJun30B, julyB: june ? 0 : julyB, octB: funded ? octoberB : 0,
    otherNetDebtB: p.otherNetDebtB, sbgNdB, taxB, navB, mcapB,
    navPerAdr: navB * 1e9 / ADR_SHARES,
    navPerTokyo: navB * 1e9 / TOKYO_SHARES,
    navPerTokyoYen: navB * 1e9 / TOKYO_SHARES * p.usdJpy,
    discountPct: navB > 0 ? (1 - mcapB / navB) * 100 : null,
    ltvPct: holdingsB > 0 ? sbgNdB / holdingsB * 100 : null,
    centsArmGross: armGrossB / mcapB * 100,
    centsOpenaiGross: openaiGrossB / mcapB * 100,
    consolNdB: jpyTToUsdB(IR_JPY_T.consolNibd),
  };
}

export function computeSotp(inputs = {}) {
  const p = { ...DEFAULT_INPUTS, ...inputs };
  validate(p);
  const result = calculate(p);
  const low = calculate({ ...p, managementPct: data.management.equityInterestPct });
  const high = calculate({ ...p, managementPct: 0 });
  const atZero = calculate({ ...p, openaiEquityB: 0 });
  let impliedOpenaiEquityB = null;
  // Solve the whole piecewise model, including tax and management sensitivity.
  // A negative residual is not an economically meaningful company valuation.
  if (atZero.navB === result.mcapB) impliedOpenaiEquityB = 0;
  else if (atZero.navB < result.mcapB && p.dilutionPct < 100 && p.liqHaircutPct < 100 && p.taxPct < 100) {
    let lower = 0;
    let upper = Math.max(1, p.openaiEquityB);
    while (upper < 1e9 && calculate({ ...p, openaiEquityB: upper }).navB < result.mcapB) upper *= 2;
    if (calculate({ ...p, openaiEquityB: upper }).navB >= result.mcapB) {
      for (let i = 0; i < 80; i++) {
        const middle = (lower + upper) / 2;
        if (calculate({ ...p, openaiEquityB: middle }).navB < result.mcapB) lower = middle;
        else upper = middle;
      }
      impliedOpenaiEquityB = (lower + upper) / 2;
    }
  }
  return { ...result, impliedOpenaiEquityB,
    residualReason: atZero.navB > result.mcapB ? 'Other modeled assets already cover market cap at $0 OpenAI.' : 'No unique positive solution under these haircuts.',
    allocationLowPerAdr: low.navPerAdr, allocationHighPerAdr: high.navPerAdr,
  };
}
