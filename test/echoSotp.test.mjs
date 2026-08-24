import assert from "node:assert/strict";
import { test } from "node:test";
import {
  ATT_PROCEEDS_B,
  DEFAULT_BOOST_B,
  DEFAULT_DBS_B,
  DEFAULT_HUGHES_B,
  DEFAULT_NET_CASH_B,
  DEFAULT_STUB_B,
  ECHO_SHARES_BASIC_M,
  ECHO_SHARES_DILUTED_M,
  FCC_TRUST_RESTRICTED_B,
  POST_ATT_GROSS_CASH_B,
  PRE_DEAL_NET_DEBT_B,
  RESIDUAL_HOLDCO_DEBT_B,
  SELLER_NOTES_B,
  SPACEX_FIXED_SHARES_M,
  SPACEX_PROCEEDS_B,
  SPECTRUM_CLOSE_ISO,
  SPECTRUM_PROCEEDS_B,
  allocateSpectrumTax,
  calculateEchoSotp,
  echoShareCountM,
  yearsToClose,
} from "../lib/echoSotp.mjs";

test("pins 261.8M SpaceX shares, $42.40 contract, 290.49M basic ECHO shares", () => {
  assert.equal(SPACEX_FIXED_SHARES_M, 261.8);
  assert.equal(ECHO_SHARES_BASIC_M, 290.490708);
  assert.equal(ECHO_SHARES_DILUTED_M, 304.4);
  assert.equal(echoShareCountM("basic"), ECHO_SHARES_BASIC_M);
  assert.equal(echoShareCountM("diluted"), ECHO_SHARES_DILUTED_M);
});

test("spectrum proceeds split AT&T vs SpaceX sums to $42.25B", () => {
  assert.equal(SPACEX_PROCEEDS_B, 19.6);
  assert.equal(ATT_PROCEEDS_B, 22.65);
  assert.equal(SPECTRUM_PROCEEDS_B, 42.25);
  assert.equal(SPACEX_PROCEEDS_B + ATT_PROCEEDS_B, SPECTRUM_PROCEEDS_B);
});

test("Seller Notes are sourced and not part of the net-cash stack", () => {
  assert.equal(SELLER_NOTES_B, 9.821);
  assert.equal(POST_ATT_GROSS_CASH_B, 14.5);
  assert.equal(FCC_TRUST_RESTRICTED_B, 2.4);
  assert.equal(RESIDUAL_HOLDCO_DEBT_B, 5.0);
  assert.equal(DEFAULT_NET_CASH_B, 7.1);
  assert.equal(
    POST_ATT_GROSS_CASH_B - FCC_TRUST_RESTRICTED_B - RESIDUAL_HOLDCO_DEBT_B,
    DEFAULT_NET_CASH_B
  );
  assert.equal(PRE_DEAL_NET_DEBT_B, 27.7);
});

test("stub defaults Boost going-concern, DBS stalking-horse, Hughes zero", () => {
  assert.equal(DEFAULT_BOOST_B, 4.0);
  assert.equal(DEFAULT_DBS_B, 0.3);
  assert.equal(DEFAULT_HUGHES_B, 0);
  assert.equal(DEFAULT_STUB_B, 4.3);
});

test("years-to-close vs 30 Nov 2027 from 24 Aug 2026", () => {
  assert.equal(SPECTRUM_CLOSE_ISO, "2027-11-30");
  const y = yearsToClose(new Date("2026-08-24T00:00:00Z"));
  assert.ok(Math.abs(y - 1.2676) < 0.002);
});

test("AT&T tax is realized; SpaceX tax is close-prob × PV", () => {
  const full = allocateSpectrumTax({
    taxBasisB: 5,
    nolsB: 1,
    taxRate: 25,
    closeProbability: 100,
    pvFactor: 1,
  });
  assert.ok(Math.abs(full.attTaxableB + full.sxTaxableB - 36.25) < 1e-9);
  assert.ok(Math.abs(full.corporateTaxB - 9.0625) < 1e-9);

  const haircut = allocateSpectrumTax({
    taxBasisB: 5,
    nolsB: 1,
    taxRate: 25,
    closeProbability: 50,
    pvFactor: 0.5,
  });
  assert.equal(haircut.attTaxB, full.attTaxB);
  assert.ok(Math.abs(haircut.sxTaxB - full.sxTaxGrossB * 0.25) < 1e-9);
});

test("base SOTP uses live-style inputs and does not haircut on-plan DISH", () => {
  const nav = calculateEchoSotp({
    spcxPrice: 140,
    echoPrice: 90,
    asOf: new Date("2026-08-24T00:00:00Z"),
  });
  assert.ok(nav.stubValM / 1e9 - 4.3 < 1e-9);
  assert.equal(nav.distressHaircutAmt, 0);
  assert.ok(nav.attTaxVal > nav.spacexTaxVal);
  assert.ok(nav.riskAdjustedPerEchoShare > 0);
  assert.ok(nav.timeToClose > 1.2 && nav.timeToClose < 1.3);
});
