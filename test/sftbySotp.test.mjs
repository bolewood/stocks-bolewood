import assert from 'node:assert/strict';
import { test } from 'node:test';
import { computeSotp, DEFAULT_INPUTS, OPENAI_DEFAULT_EQUITY_B, ADR_SHARES, ARM_SHARES } from '../lib/sftbySotp.mjs';
import { readSotpScenario, writeSotpScenario, PRESETS } from '../lib/sftbyScenario.mjs';
import { lookThroughPer100 } from '../reference/derive.mjs';
import wrapper from '../data/wrappers/SFTBY.json' with { type: 'json' };
import data from '../data/sftby-sotp.json' with { type: 'json' };

const close = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) < eps, `${a} != ${b}`);

test('SFTBY reproduces issuer June NAV, including rounded component reconciliation', () => {
  const result = computeSotp({ openaiCase: 'june', openaiEquityB: 852,
    armPrice: 53.13e12 / 162.39 / 922733999, usdJpy: 162.39 });
  close(result.navB, 72.30e12 / 162.39 / 1e9);
  close(result.holdingsB, 83.11e12 / 162.39 / 1e9);
  close(result.sbgNdB, 10.81e12 / 162.39 / 1e9);
  close(result.openaiChangeB, 0);
  assert.equal(result.managementB, 0);
  assert.equal(result.newFundingB, 0);
});

test('SFTBY gross OpenAI parity with /ai across price, IPO and dilution scenarios', () => {
  assert.equal(ADR_SHARES, 11398098778);
  assert.equal(OPENAI_DEFAULT_EQUITY_B, 852);
  for (const price of [16.54, 17.72, 30]) for (const value of [500, 852, 1600, 3000]) for (const dilution of [0, 10, 50, 100]) {
    const result = computeSotp({ sftbyPrice: price, openaiEquityB: value, dilutionPct: dilution });
    const independent = lookThroughPer100({ claimPct: wrapper.openai.ownershipPct,
      ipoVal: value * 1e9, wrapperValue: price * 11398098778, dilution: dilution / 100 });
    close(result.centsOpenaiGross, independent);
  }
  close(computeSotp({ openaiEquityB: 1600 }).openaiGrossB, 208);
});

test('July is a rounded fair-value scaling proxy, not cost-ratio ownership', () => {
  const july = computeSotp({ openaiCase: 'current' });
  close(july.openaiGrossB, 100);
  close(july.openaiChangeB, 10.4);
  assert.equal(july.newFundingB, 10);
  assert.equal(july.octB, 0);
  close(computeSotp({ openaiCase: 'current', openaiEquityB: 1704 }).openaiGrossB, 200);
  assert.notEqual(july.openaiGrossB, 0.13 * 54.6 / 64.6 * 852);
});

test('new investment at cost offsets its funding with no artificial NAV or management gain', () => {
  const june = computeSotp({ openaiCase: 'june' });
  const julyAtCost = computeSotp({ openaiCase: 'current', openaiEquityB: 99.6 / 100 * 852 });
  const octoberAtCost = computeSotp({ openaiEquityB: 109.6 / 0.13 });
  close(julyAtCost.navB, june.navB);
  close(octoberAtCost.navB, june.navB);
  close(julyAtCost.managementB, 0);
  close(octoberAtCost.managementB, 0);
});

test('management is only a positive incremental revaluation sensitivity', () => {
  const result = computeSotp({ openaiEquityB: 1600 });
  close(result.managementB, (208 - 89.6 - 20) * 0.1725);
  const upper = computeSotp({ openaiEquityB: 1600, managementPct: 0 });
  close(upper.navB - result.navB, result.managementB);
  close(result.allocationLowPerAdr, result.navPerAdr);
  close(result.allocationHighPerAdr, upper.navPerAdr);
  assert.equal(computeSotp({ openaiEquityB: 500 }).managementB, 0);
  assert.equal(result.svf2BaseB, upper.svf2BaseB);
});

test('every meaningful SOTP assumption changes its intended output', () => {
  const base = computeSotp({ openaiEquityB: 1600, taxPct: 10 });
  const calc = x => computeSotp({ openaiEquityB: 1600, taxPct: 10, ...x });
  assert.ok(calc({ armPrice: 300 }).navB > base.navB);
  assert.ok(calc({ openaiEquityB: 2000 }).navB > base.navB);
  assert.ok(calc({ dilutionPct: 10 }).navB < base.navB);
  assert.ok(calc({ liqHaircutPct: 10 }).navB < base.navB);
  assert.ok(calc({ managementPct: 0 }).navB > base.navB);
  assert.ok(calc({ taxPct: 20 }).navB < base.navB);
  assert.ok(calc({ armTaxBasisB: 60 }).navB > base.navB);
  assert.ok(calc({ stubMult: 0.7 }).navB < base.navB);
  close(calc({ otherNetDebtB: 12 }).navB, base.navB - 12);
  close(calc({ otherNetDebtB: -12 }).navB, base.navB + 12);
  close(calc({ usdJpy: 200 }).navB, base.navB);
  assert.ok(calc({ usdJpy: 200 }).navPerTokyoYen > base.navPerTokyoYen);
  close(calc({ sftbyPrice: 25 }).navB, base.navB);
  assert.ok(calc({ sftbyPrice: 25 }).centsOpenaiGross < base.centsOpenaiGross);
});

test('residual solver reprices its own taxes and management allocation', () => {
  for (const taxPct of [0, 10, 30]) for (const managementPct of [0, 17.25]) {
    const inputs = { armPrice: 150, sftbyPrice: 40, stubMult: 0.7, taxPct, managementPct, liqHaircutPct: 15, dilutionPct: 10 };
    const result = computeSotp(inputs);
    assert.ok(result.impliedOpenaiEquityB > 0);
    const solved = computeSotp({ ...inputs, openaiEquityB: result.impliedOpenaiEquityB });
    close(solved.navB, solved.mcapB, 1e-7);
  }
  assert.equal(computeSotp().impliedOpenaiEquityB, null);
});

test('zero/negative NAV and degenerate exposure do not display false discounts or valuations', () => {
  const negative = computeSotp({ armPrice: 0, openaiEquityB: 0, stubMult: 0 });
  assert.ok(negative.navB < 0);
  assert.equal(negative.discountPct, null);
  assert.equal(computeSotp({ dilutionPct: 100, sftbyPrice: 100 }).impliedOpenaiEquityB, null);
  assert.equal(computeSotp({ liqHaircutPct: 100, sftbyPrice: 100 }).impliedOpenaiEquityB, null);
  assert.throws(() => computeSotp({ usdJpy: 0 }), RangeError);
  assert.throws(() => computeSotp({ sftbyPrice: NaN }), RangeError);
  assert.throws(() => computeSotp({ openaiEquityB: -1 }), RangeError);
  assert.throws(() => computeSotp({ managementPct: 20 }), RangeError);
});

test('scenario links round-trip all inputs and pin quotes against fetch overwrites', () => {
  const inputs = { ...DEFAULT_INPUTS, openaiEquityB: 1600, armPrice: 260.39, usdJpy: 160.123, otherNetDebtB: -4.7, openaiCase: 'current' };
  const read = readSotpScenario(new URLSearchParams(writeSotpScenario(inputs)));
  assert.deepEqual(read.inputs, inputs);
  for (const key of ['armPrice', 'sftbyPrice', 'usdJpy']) assert.ok(read.pinned.has(key));
  assert.deepEqual(computeSotp(read.inputs), computeSotp(inputs));
});

test('malformed scenarios and out-of-range query inputs fall back safely', () => {
  const bad = readSotpScenario(new URLSearchParams('scenario=nope&usdJpy=0&sftbyPrice=-1&armPrice=NaN&openaiEquityB=Infinity&taxPct=101&openaiCase=june&stubMult='));
  assert.deepEqual(bad.inputs, DEFAULT_INPUTS);
  for (const key of Object.keys(PRESETS)) assert.ok(Number.isFinite(computeSotp(readSotpScenario(new URLSearchParams({ scenario: key })).inputs).navB));
  const legacyBull = readSotpScenario(new URLSearchParams('scenario=bull'));
  assert.equal(legacyBull.inputs.armPrice, 300);
  assert.equal(legacyBull.inputs.openaiEquityB, 1200);
  assert.equal(legacyBull.key, null);
});

test('all curated SOTP record groups carry evidence, basis and as-of dates', () => {
  for (const record of [data.ir, data.arm, data.openaiJune, data.management, data.assumptions, data.quoteSnapshot, ...data.events]) {
    assert.match(record.asOf, /^2026-\d\d-\d\d$/);
    assert.ok(record.basis);
    assert.match(record.source, /^https:\/\//);
  }
  assert.equal(ARM_SHARES, 922733999);
});
