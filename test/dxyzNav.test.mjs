import assert from 'node:assert/strict';
import { test } from 'node:test';
import { calculateDxyzNav } from '../lib/dxyzNav.mjs';
import { DEFAULT_DXYZ_OAI_ENTRY_PRICE } from '../reference/unitExposure.mjs';
import { CAPITALIZATION, unitPrice } from '../reference/unitExposure.mjs';
import { FILED, computeAtmBridge } from '../lib/dxyzAtm.mjs';
import { MONEY_MARKET, OPENAI_PPU_SPV, OTHER_SUBSEQUENT_PURCHASES } from '../lib/dxyzHoldings.mjs';
import { WRAPPERS } from '../lib/loadAiData.mjs';
import { resolveFund, fundRowMetrics } from '../lib/aiFundBasis.mjs';

const close = (actual, expected) => assert.ok(Math.abs(actual - expected) < 0.00001, `${actual} != ${expected}`);
const position = (calc, name) => [...calc.shareRows, ...calc.dollarRows, ...calc.otherRows].find(p => p.name === name);

test('August OpenAI purchase adds $150M upside when its entry price doubles', () => {
  const inputs = { ppsOverrides: { OpenAI: 2 * DEFAULT_DXYZ_OAI_ENTRY_PRICE } };
  const june = calculateDxyzNav({ ...inputs, includeAugust: false });
  const august = calculateDxyzNav({ ...inputs, includeAugust: true });
  assert.ok(Math.abs(august.totalNAV - june.totalNAV - 150_000_000) < 0.01);
});

test('June exact NAV restores; subsequent purchases at default entry exchange cash for assets without adding NAV', () => {
  const june = calculateDxyzNav({ includeAugust: false });
  const august = calculateDxyzNav();
  close(june.totalNAV, FILED.netAssets);
  close(august.totalNAV, FILED.netAssets);
  close(june.navPerShare, FILED.netAssets / FILED.sharesOutstanding);
  close(august.augustValue, 150e6);
  close(august.augustGain, 0);
  close(august.acquisitionLot.units, 150e6 / DEFAULT_DXYZ_OAI_ENTRY_PRICE);
  close(position(june, MONEY_MARKET.name).positionValue, MONEY_MARKET.valUSD);
  close(position(august, MONEY_MARKET.name).positionValue, 770712701);
  close(august.cashSpent, 169e6);
  for (const p of OTHER_SUBSEQUENT_PURCHASES) {
    assert.equal(p.basis, 'filed-cost');
    assert.ok(p.date && p.publicationDate && p.source.startsWith('https://www.sec.gov/'));
    close(position(august, p.name).positionValue, p.costUsd);
    assert.equal(position(june, p.name), undefined);
  }
});

test('entry changes units independently; PPS moves both equity lots and leaves cash and PPUs unchanged', () => {
  for (const entryPrice of [CAPITALIZATION.dxyzOpenaiEntry.lowPrice, DEFAULT_DXYZ_OAI_ENTRY_PRICE, CAPITALIZATION.dxyzOpenaiEntry.highPrice]) {
    const a = calculateDxyzNav({ entryPrice, ppsOverrides: { OpenAI: 600 } });
    const b = calculateDxyzNav({ entryPrice, ppsOverrides: { OpenAI: 1200 } });
    close(a.acquisitionLot.units, 150e6 / entryPrice);
    close(b.acquisitionLot.units, a.acquisitionLot.units);
    for (const name of ['OpenAI', 'OpenAI — August purchase']) close(position(b, name).positionValue, 2 * position(a, name).positionValue);
    close(position(a, MONEY_MARKET.name).positionValue, position(b, MONEY_MARKET.name).positionValue);
    close(position(b, 'OpenAI PPUs').positionValue, OPENAI_PPU_SPV.valUSD);
  }
  const zero = calculateDxyzNav({ ppsOverrides: { OpenAI: 0 } });
  close(zero.augustGain, -150e6);
  close(position(zero, 'OpenAI').positionValue, 0);
});

test('/dxyz and /ai agree on exposure and revalued NAV at identical valuation, FD, dilution, entry and wrapper inputs', () => {
  const wrapper = WRAPPERS.find(w => w.ticker === 'DXYZ');
  for (const includeAugust of [false, true]) for (const dilution of [0, 0.25, 1]) {
    const anthVal = 1e12, oaiVal = 1.6e12;
    const anthFdShares = CAPITALIZATION.anthropic.lowShares;
    const oaiFdShares = CAPITALIZATION.openai.highShares;
    const entryPrice = CAPITALIZATION.dxyzOpenaiEntry.highPrice;
    const nav = calculateDxyzNav({ includeAugust, entryPrice, ppsOverrides: {
      Anthropic: unitPrice({ valuation: anthVal, fdShares: anthFdShares, dilution }),
      OpenAI: unitPrice({ valuation: oaiVal, fdShares: oaiFdShares, dilution }),
    } });
    const resolved = resolveFund(wrapper, { basis: includeAugust ? 'estimated' : 'filed', deploy: 'cash' });
    const ai = fundRowMetrics(wrapper, 32, { anthVal, oaiVal, anthFdShares, oaiFdShares, dilution, resolved, dxyzOaiEntryPrice: entryPrice });
    const oaiValue = nav.shareRows.filter(p => p.name.startsWith('OpenAI')).reduce((sum, p) => sum + p.positionValue, 0);
    close(oaiValue, ai.oaiDetail.scenarioValue);
    close(position(nav, 'Anthropic').positionValue, ai.anthDetail.scenarioValue);
    close(nav.totalNAV, ai.scenarioNetAssets);
    close(oaiValue * 100 / (32 * FILED.sharesOutstanding), ai.oaiPer100);
  }
});

test('ATM and wrapper share-count changes do not create additional August units or repeat the cash deduction', () => {
  const nav = calculateDxyzNav({ ppsOverrides: { OpenAI: 2 * DEFAULT_DXYZ_OAI_ENTRY_PRICE } });
  const moreShares = calculateDxyzNav({ dxyzShares: FILED.sharesOutstanding * 2 / 1e6, ppsOverrides: { OpenAI: 2 * DEFAULT_DXYZ_OAI_ENTRY_PRICE } });
  close(moreShares.totalNAV, nav.totalNAV);
  close(moreShares.acquisitionLot.units, nav.acquisitionLot.units);
  close(moreShares.navPerShare * 2, nav.navPerShare);
  const bridge = computeAtmBridge({ mode: 'custom', markedNetAssets: nav.totalNAV, rows: [{ date: '2026-08-14', close: 60, volume: 1e6 }], participation: 0.1, expenseDragAnnualRate: 0 });
  assert.ok(bridge.postMay.shares > 0);
  close(bridge.proFormaAssets, nav.totalNAV + bridge.postMay.net);
  close(nav.cashSpent, 169e6);
});

test('invalid acquisition prices and wrapper share counts cannot create infinite NAV', () => {
  for (const entryPrice of [0, -1, Infinity, NaN]) assert.throws(() => calculateDxyzNav({ entryPrice }));
  for (const dxyzShares of [0, -1, Infinity, NaN]) assert.throws(() => calculateDxyzNav({ dxyzShares }));
});
