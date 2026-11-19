import { fullyDilutedAt } from '../lib/shareBasis.mjs';
import { anthropicPpsFromValuation, ANTHROPIC_FILED_MARK_PPS, SHARE_DENOMINATED, OTHER_CASH_NAME } from '../lib/dxyzNav.mjs';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { calculateDxyzNav } from '../lib/dxyzNav.mjs';
import { CAPITALIZATION, DEFAULT_DXYZ_OAI_ENTRY_PRICE, DEFAULT_ANTH_FD_SHARES, DEFAULT_OAI_FD_SHARES, impliedValuation, unitPrice } from '../reference/unitExposure.mjs';
import { FILED, computeAtmBridge } from '../lib/dxyzAtm.mjs';
import { MONEY_MARKET, OPENAI_PPU_SPV, OTHER_SUBSEQUENT_PURCHASES, SUBSEQUENT_OPENAI_PURCHASE, anthropicNavPerDollarPps } from '../lib/dxyzHoldings.mjs';
import { WRAPPERS } from '../lib/loadAiData.mjs';
import { resolveFund, fundRowMetrics } from '../lib/aiFundBasis.mjs';

const close = (actual, expected, tol = 0.00001) => assert.ok(Math.abs(actual - expected) < tol, `${actual} != ${expected}`);
const position = (calc, name) => [...calc.shareRows, ...calc.dollarRows, ...calc.otherRows].find(p => p.name === name);
const OCT = 'OpenAI — October 13 Series D';
const COST = SUBSEQUENT_OPENAI_PURCHASE.costUsd;
const marks = () => Object.fromEntries(SHARE_DENOMINATED.map((p) => [p.name, p.mark_pps_1231]));

// Acceptance 4 helper: estimated NAV = filed NAV + SPCX + ANT re-marks − fee − other + interest.
function estimatedNav({ ant, spcx, asOfDate = '2026-11-16' }) {
  const c = calculateDxyzNav({ ppsOverrides: { ...marks(), Anthropic: ant, SpaceX: spcx } });
  return computeAtmBridge({ mode: 'calibrated', rows: [], markedNetAssets: c.totalNAV, baselineShares: FILED.sharesOutstanding, asOfDate });
}

test('acceptance 1: filed basis reproduces net assets $1,826.37M and NAV/share $38.32', () => {
  const filed = calculateDxyzNav({ includeSubsequent: false });
  close(filed.totalNAV, 1_826_366_694, 0.01);
  assert.equal((filed.totalNAV / 1e6).toFixed(2), '1826.37');
  assert.ok(Math.abs(filed.navPerShare - 38.32) <= 0.01);
});

test('acceptance 2: Anthropic $99.17/sh, ~$1.80T fully diluted (424B4 count), 20.96% of net assets', () => {
  const filed = calculateDxyzNav({ includeSubsequent: false });
  const a = position(filed, 'Anthropic');
  assert.equal(a.pps.toFixed(2), '99.17');
  assert.equal(a.units, 3_860_880);
  assert.equal((a.companyValue / 1e12).toFixed(2), '1.80');
  assert.match(a.companyValueLabel, /fully diluted/);
  assert.equal((a.positionValue / FILED.netAssets * 100).toFixed(2), '20.96');
  // Sensitivity ≈ $0.081 per $1; break-even vs the 9/30 mark is $99.17.
  assert.equal(anthropicNavPerDollarPps().toFixed(3), '0.081');
  const up = calculateDxyzNav({ includeSubsequent: false, ppsOverrides: { ...marks(), Anthropic: ANTHROPIC_FILED_MARK_PPS + 1 } });
  close(up.navPerShare - filed.navPerShare, 3_860_880 / FILED.sharesOutstanding);
});

test('acceptance 3: cash ~$719.8M at 9/30 (39.4%) and ~$600M (≈33%) after the 11/4 deals', () => {
  const filed = calculateDxyzNav({ includeSubsequent: false });
  const after = calculateDxyzNav();
  assert.equal((filed.cashAfter / 1e6).toFixed(1), '719.8');
  assert.equal((filed.cashAfter / filed.totalNAV * 100).toFixed(1), '39.4');
  assert.equal(after.cashSpent, 112_000_000);
  assert.equal((after.cashAfter / 1e6).toFixed(1), '607.8');
  assert.ok(Math.abs(after.cashAfter / after.totalNAV - 0.333) < 0.005);
  close(position(after, OTHER_CASH_NAME).positionValue, 190_163_916);
});

test('acceptance 4: ANT $74 / SPCX $137.36 → est. NAV ≈ $35.9; ANT $99.17 equals the base roll-forward ≈ $37.97', () => {
  const at74 = estimatedNav({ ant: 74, spcx: 137.36 });
  const atMark = estimatedNav({ ant: 99.17, spcx: 137.36 });
  const base = estimatedNav({ ant: ANTHROPIC_FILED_MARK_PPS, spcx: 137.36 });
  assert.equal(at74.days, 47);
  assert.ok(Math.abs(at74.proFormaNav - 35.9) < 0.05, `${at74.proFormaNav}`);
  assert.ok(Math.abs(atMark.proFormaNav - 37.97) < 0.02, `${atMark.proFormaNav}`);
  close(atMark.proFormaNav, base.proFormaNav, 0.001);
  // ΔNAV between them is (99.17 − 74) × 0.081, less the fee on that extra gross asset.
  close(atMark.proFormaNav - at74.proFormaNav, (99.17 - 74) * 3_860_880 / FILED.sharesOutstanding * (1 - 0.025 * 47 / 365), 0.0005);
  // Components: fee on gross assets, money-market interest, zero issuance below NAV.
  assert.ok(at74.fee > 5e6 && at74.interest > 2e6 && at74.postMay.shares === 0);
});

test('Class N / lock-up discount (default 0) scales only the Anthropic sleeve', () => {
  const base = calculateDxyzNav({ ppsOverrides: { ...marks(), Anthropic: 74 } });
  const disc = calculateDxyzNav({ ppsOverrides: { ...marks(), Anthropic: 74 }, anthClassNDiscount: 0.2 });
  close(position(base, 'Anthropic').positionValue, 3_860_880 * 74);
  close(position(disc, 'Anthropic').positionValue, 3_860_880 * 74 * 0.8);
  close(base.totalNAV - disc.totalNAV, 3_860_880 * 74 * 0.2);
  close(position(disc, 'OpenAI').positionValue, position(base, 'OpenAI').positionValue);
});

test('October OpenAI Series D adds $25M upside when its entry price doubles', () => {
  const inputs = { ppsOverrides: { OpenAI: 2 * DEFAULT_DXYZ_OAI_ENTRY_PRICE } };
  const filed = calculateDxyzNav({ ...inputs, includeSubsequent: false });
  const withDeals = calculateDxyzNav({ ...inputs, includeSubsequent: true });
  assert.ok(Math.abs(withDeals.totalNAV - filed.totalNAV - COST) < 0.01);
});

test('9/30 exact NAV restores; post-9/30 deals at default entry exchange cash for assets without adding NAV', () => {
  const filed = calculateDxyzNav({ includeSubsequent: false });
  const withDeals = calculateDxyzNav();
  close(filed.totalNAV, FILED.netAssets, 0.01);
  close(withDeals.totalNAV, FILED.netAssets, 0.01);
  close(filed.navPerShare, FILED.netAssets / FILED.sharesOutstanding);
  close(withDeals.subsequentValue, COST, 1e-6);
  close(withDeals.subsequentGain, 0, 1e-6);
  close(withDeals.acquisitionLot.units, COST / DEFAULT_DXYZ_OAI_ENTRY_PRICE);
  close(position(filed, MONEY_MARKET.name).positionValue, MONEY_MARKET.valUSD);
  close(position(withDeals, MONEY_MARKET.name).positionValue, MONEY_MARKET.valUSD - 112e6);
  close(withDeals.cashSpent, 112e6);
  for (const p of OTHER_SUBSEQUENT_PURCHASES) {
    assert.equal(p.basis, 'filed-cost');
    assert.ok(p.date > '2026-09-30' && p.publicationDate && p.source.startsWith('https://www.sec.gov/'));
    close(position(withDeals, p.name).positionValue, p.costUsd);
    assert.equal(position(filed, p.name), undefined);
  }
});

test('entry changes units independently; PPS moves both equity lots and leaves cash and PPUs unchanged', () => {
  for (const entryPrice of [CAPITALIZATION.dxyzOpenaiEntry.lowPrice, DEFAULT_DXYZ_OAI_ENTRY_PRICE, CAPITALIZATION.dxyzOpenaiEntry.highPrice]) {
    const a = calculateDxyzNav({ entryPrice, ppsOverrides: { OpenAI: 600 } });
    const b = calculateDxyzNav({ entryPrice, ppsOverrides: { OpenAI: 1200 } });
    close(a.acquisitionLot.units, COST / entryPrice);
    close(b.acquisitionLot.units, a.acquisitionLot.units);
    for (const name of ['OpenAI', OCT]) close(position(b, name).positionValue, 2 * position(a, name).positionValue);
    close(position(a, MONEY_MARKET.name).positionValue, position(b, MONEY_MARKET.name).positionValue);
    close(position(b, 'OpenAI PPUs').positionValue, OPENAI_PPU_SPV.valUSD);
  }
  const zero = calculateDxyzNav({ ppsOverrides: { OpenAI: 0 } });
  close(zero.subsequentGain, -COST);
  close(position(zero, 'OpenAI').positionValue, 0);
});

test('/dxyz and /ai agree on exposure and revalued NAV at identical valuation, FD, dilution, entry and wrapper inputs', () => {
  const wrapper = WRAPPERS.find(w => w.ticker === 'DXYZ');
  for (const includeSubsequent of [false, true]) for (const dilution of [0, 0.25, 1]) {
    const anthVal = 1e12, oaiVal = 1.6e12;
    const anthFdShares = CAPITALIZATION.anthropic.lowShares; // pre-split
    const oaiFdShares = CAPITALIZATION.openai.highShares;
    const entryPrice = CAPITALIZATION.dxyzOpenaiEntry.highPrice;
    const nav = calculateDxyzNav({ includeSubsequent, entryPrice, ppsOverrides: {
      // /dxyz takes ANT (post-split) prices; /ai's unit price here is pre-split.
      Anthropic: unitPrice({ valuation: anthVal, fdShares: anthFdShares, dilution }) / 10,
      OpenAI: unitPrice({ valuation: oaiVal, fdShares: oaiFdShares, dilution }),
    } });
    const resolved = resolveFund(wrapper, { basis: includeSubsequent ? 'estimated' : 'filed', deploy: 'cash' });
    const ai = fundRowMetrics(wrapper, 32, { anthVal, oaiVal, anthFdShares, oaiFdShares, dilution, resolved, dxyzOaiEntryPrice: entryPrice });
    const oaiValue = nav.shareRows.filter(p => p.name.startsWith('OpenAI')).reduce((sum, p) => sum + p.positionValue, 0);
    close(oaiValue, ai.oaiDetail.scenarioValue, 1e-4);
    close(position(nav, 'Anthropic').positionValue, ai.anthDetail.scenarioValue, 1e-4);
    close(nav.totalNAV, ai.scenarioNetAssets, 1e-3);
    close(oaiValue * 100 / (32 * FILED.sharesOutstanding), ai.oaiPer100);
  }
});

test('ATM and wrapper share-count changes do not create additional October units or repeat the cash deduction', () => {
  const nav = calculateDxyzNav({ ppsOverrides: { OpenAI: 2 * DEFAULT_DXYZ_OAI_ENTRY_PRICE } });
  const moreShares = calculateDxyzNav({ dxyzShares: FILED.sharesOutstanding * 2 / 1e6, ppsOverrides: { OpenAI: 2 * DEFAULT_DXYZ_OAI_ENTRY_PRICE } });
  close(moreShares.totalNAV, nav.totalNAV);
  close(moreShares.acquisitionLot.units, nav.acquisitionLot.units);
  close(moreShares.navPerShare * 2, nav.navPerShare);
  const bridge = computeAtmBridge({ mode: 'custom', markedNetAssets: nav.totalNAV, rows: [{ date: '2026-10-14', close: 60, volume: 1e6 }], participation: 0.1, expenseDragAnnualRate: 0, moneyMarketYield: 0 });
  assert.ok(bridge.postMay.shares > 0);
  close(bridge.proFormaAssets, nav.totalNAV + bridge.postMay.net);
  close(nav.cashSpent, 112e6);
});

test('invalid acquisition prices and wrapper share counts cannot create infinite NAV', () => {
  for (const entryPrice of [0, -1, Infinity, NaN]) assert.throws(() => calculateDxyzNav({ entryPrice }));
  for (const dxyzShares of [0, -1, Infinity, NaN]) assert.throws(() => calculateDxyzNav({ dxyzShares }));
});

test('impliedValuation inverts unitPrice at dilution 0; Anthropic EV is ANT price × fully diluted at that price', () => {
  const near = (actual, expected) => assert.ok(Math.abs(actual - expected) / expected < 1e-12, `${actual} != ${expected}`);
  const headline = 1.2e12;
  const pps = unitPrice({ valuation: headline, fdShares: DEFAULT_OAI_FD_SHARES });
  near(impliedValuation({ pps, fdShares: DEFAULT_OAI_FD_SHARES }), headline);
  near(impliedValuation({
    pps: unitPrice({ valuation: 965e9, fdShares: DEFAULT_ANTH_FD_SHARES }),
    fdShares: DEFAULT_ANTH_FD_SHARES,
  }), 965e9);
  for (const n of [0, -1, NaN, Infinity]) assert.throws(() => impliedValuation({ pps: 1, fdShares: n }));
  const filed = calculateDxyzNav({ includeSubsequent: false });
  const anth = position(filed, 'Anthropic');
  assert.equal(anth.evBasis, 'fullyDiluted');
  assert.equal(anth.splitFactor, 10);
  near(anth.companyValue, anth.pps * fullyDilutedAt(anth.pps));
  assert.match(anth.companyValueLabel, /fully diluted/);
  const atMid = calculateDxyzNav({ includeSubsequent: false, ppsOverrides: { Anthropic: 74 } });
  near(position(atMid, 'Anthropic').companyValue, 74 * fullyDilutedAt(74));
  near(position(atMid, 'Anthropic').positionValue, 3860880 * 74);
  near(anthropicPpsFromValuation(74 * fullyDilutedAt(74)), 74);
  const atIpo = calculateDxyzNav({ includeSubsequent: false, ppsOverrides: { Anthropic: 83 } });
  near(position(atIpo, 'Anthropic').companyValue, 83 * 18137587875);
  // OpenAI FD stays the $852B ÷ June-mark calibration proxy: the 9/30 mark implies ≈$1.04T.
  assert.equal((position(filed, 'OpenAI').companyValue / 1e12).toFixed(2), '1.04');
  const marked = calculateDxyzNav({ ppsOverrides: { OpenAI: pps } });
  near(position(marked, 'OpenAI').companyValue, headline);
  close(position(marked, 'OpenAI').pps, pps);
  close(position(marked, OCT).pps, pps);
  assert.ok(position(marked, OCT).companyValue == null);
  assert.ok(position(filed, 'SpaceX').companyValue == null);
});
