import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  FALLBACK_PRICES,
  WRAPPERS,
  DEFAULT_ANTH_VAL,
  DEFAULT_OAI_VAL,
} from "../lib/aiWrappers.mjs";
import {
  ARKVX_SHARES_EST,
  BASIS_ESTIMATED,
  BASIS_FILED,
  DEPLOY_CASH,
  DEPLOY_PRORATA,
  DEPLOY_RANGE,
  dxyzBridgeFromRows,
  fundRowMetrics,
  resolveFund,
  cappedConfidence,
} from "../lib/aiFundBasis.mjs";
import { computeAtmBridge, impliedFiledShares } from "../lib/dxyzAtm.mjs";

const snapshot = JSON.parse(
  readFileSync(new URL("../app/api/dxyz-history/snapshot.json", import.meta.url))
);

const today = new Date(2026, 7, 19);

test("DXYZ ESTIMATED shares equal computeAtmBridge on the same rows", () => {
  const rows = snapshot.rows;
  const bridge = computeAtmBridge({
    mode: "calibrated",
    rows,
    markedNetAssets: undefined,
  });
  const fromHelper = dxyzBridgeFromRows(rows, { mode: BASIS_ESTIMATED });
  assert.equal(fromHelper.proFormaShares, bridge.proFormaShares);
  assert.equal(fromHelper.proFormaAssets, bridge.proFormaAssets);

  const w = WRAPPERS.find((x) => x.ticker === "DXYZ");
  const est = resolveFund(w, {
    basis: BASIS_ESTIMATED,
    deploy: DEPLOY_CASH,
    dxyzBridge: fromHelper,
  });
  assert.equal(est.shares, bridge.proFormaShares);
  assert.equal(est.confidence, "medium");

  const filed = resolveFund(w, {
    basis: BASIS_FILED,
    deploy: DEPLOY_CASH,
    dxyzBridge: fromHelper,
  });
  assert.equal(filed.shares, impliedFiledShares());
  assert.equal(filed.oaiFv, 34_440_000);
  assert.equal(est.oaiFv, 34_440_000 + 150_000_000);
});

test("ARKVX ESTIMATED cash combined is ~$13.49 at the fallback NAV", () => {
  const w = WRAPPERS.find((x) => x.ticker === "ARKVX");
  const price = FALLBACK_PRICES.ARKVX;
  const filed = resolveFund(w, { basis: BASIS_FILED, deploy: DEPLOY_CASH });
  const cash = resolveFund(w, { basis: BASIS_ESTIMATED, deploy: DEPLOY_CASH });
  assert.equal(cash.shares, ARKVX_SHARES_EST);
  assert.equal(filed.netAssets, 871_119_657);

  const pin = { anthVal: 1_000_000_000_000, oaiVal: 1_250_000_000_000, dilution: 0 };
  const filedM = fundRowMetrics(w, price, { ...pin, resolved: filed });
  const cashM = fundRowMetrics(w, price, { ...pin, resolved: cash });
  assert.ok(Math.abs(filedM.combinedPer100 - 19.19) < 0.08, filedM.combinedPer100);
  assert.ok(Math.abs(cashM.combinedPer100 - 13.49) < 0.12, cashM.combinedPer100);

  const book = resolveFund(w, { basis: BASIS_ESTIMATED, deploy: DEPLOY_PRORATA });
  const bookM = fundRowMetrics(w, price, { ...pin, resolved: book });
  assert.ok(Math.abs(bookM.combinedPer100 - filedM.combinedPer100) < 0.05);
});

test("FILED/ESTIMATED leaves strategic shares untouched", () => {
  const goog = WRAPPERS.find((x) => x.ticker === "GOOG");
  const a = resolveFund(goog, { basis: BASIS_FILED, deploy: DEPLOY_RANGE });
  const b = resolveFund(goog, { basis: BASIS_ESTIMATED, deploy: DEPLOY_RANGE });
  assert.equal(a.shares, b.shares);
  assert.equal(a.affected, false);
  assert.equal(b.affected, false);
});

test("VCX ESTIMATED keeps shares, rolls marks, and holds stake %", () => {
  const w = WRAPPERS.find((x) => x.ticker === "VCX");
  const filed = resolveFund(w, { basis: BASIS_FILED, deploy: DEPLOY_CASH });
  const est = resolveFund(w, { basis: BASIS_ESTIMATED, deploy: DEPLOY_CASH });
  assert.equal(est.shares, filed.shares);
  assert.ok(est.anthFv > filed.anthFv);
  assert.ok(Math.abs(est.anthFv / filed.anthFv - 965e9 / w.anthropic.roundVal) < 1e-9);
  assert.ok(est.netAssets > filed.netAssets);
  assert.ok(est.nav > filed.nav);

  const filedM = fundRowMetrics(w, FALLBACK_PRICES.VCX, {
    anthVal: DEFAULT_ANTH_VAL,
    oaiVal: DEFAULT_OAI_VAL,
    dilution: 0,
    resolved: filed,
  });
  const estM = fundRowMetrics(w, FALLBACK_PRICES.VCX, {
    anthVal: DEFAULT_ANTH_VAL,
    oaiVal: DEFAULT_OAI_VAL,
    dilution: 0,
    resolved: est,
  });
  assert.equal(filedM.anthPct, estM.anthPct);
  assert.equal(filedM.oaiPct, estM.oaiPct);
  const remainingMarchAnth = 56_388_340 + 20_000_000;
  assert.ok(Math.abs(filedM.anthPct - remainingMarchAnth / 380_000_000_000) < 1e-12);
  assert.ok(Math.abs(estM.combinedPer100 - filedM.combinedPer100) < 1e-9);
  assert.ok(estM.combinedPer100 < 25, estM.combinedPer100);
  assert.ok(estM.combinedPer100 > 15, estM.combinedPer100);
  assert.ok(estM.premium < filedM.premium);
  assert.ok(filedM.premium > 0.7); // ~+83% at fallback $39.78 / $21.70
  assert.ok(estM.premium > 0.5);
});

test("fund stake % is identical across filed and estimated (cash)", () => {
  const rows = snapshot.rows;
  const bridge = dxyzBridgeFromRows(rows, { mode: BASIS_ESTIMATED });
  for (const w of WRAPPERS.filter((x) => x.type === "Fund")) {
    const filed = resolveFund(w, {
      basis: BASIS_FILED,
      deploy: DEPLOY_CASH,
      dxyzBridge: bridge,
    });
    const est = resolveFund(w, {
      basis: BASIS_ESTIMATED,
      deploy: DEPLOY_CASH,
      dxyzBridge: bridge,
    });
    const filedM = fundRowMetrics(w, FALLBACK_PRICES[w.yahooSymbol], {
      anthVal: DEFAULT_ANTH_VAL,
      oaiVal: DEFAULT_OAI_VAL,
      dilution: 0,
      resolved: filed,
    });
    const estM = fundRowMetrics(w, FALLBACK_PRICES[w.yahooSymbol], {
      anthVal: DEFAULT_ANTH_VAL,
      oaiVal: DEFAULT_OAI_VAL,
      dilution: 0,
      resolved: est,
    });
    assert.equal(filedM.anthPct, estM.anthPct, `${w.ticker} anthPct`);
    if (w.ticker === "DXYZ") {
      const subsequent = w.openai?.subsequentPurchasesUsd || 0;
      const round = w.openai?.roundVal;
      assert.ok(subsequent > 0);
      assert.equal(
        estM.oaiPct,
        (filed.oaiFv + subsequent) / round,
        "DXYZ ESTIMATED OpenAI % includes the filed subsequent purchase"
      );
      assert.notEqual(filedM.oaiPct, estM.oaiPct);
    } else {
      assert.equal(filedM.oaiPct, estM.oaiPct, `${w.ticker} oaiPct`);
    }
  }
});

test("no HIGH confidence when as-of is >90 days old", () => {
  assert.equal(cappedConfidence("high", "2026-02-20", today), "medium");
  assert.equal(cappedConfidence("high", "2026-06-30", today), "high");
  assert.equal(cappedConfidence("low", "2026-02-20", today), "low");
  const msft = WRAPPERS.find((x) => x.ticker === "MSFT");
  const r = resolveFund(msft, { basis: BASIS_ESTIMATED, deploy: DEPLOY_RANGE });
  assert.equal(r.confidence, "medium");
});

test("DXYZ deploy range spans cash < prorata", () => {
  const w = WRAPPERS.find((x) => x.ticker === "DXYZ");
  const bridge = computeAtmBridge({
    mode: "calibrated",
    rows: [
      { date: "2026-07-01", close: 50, volume: 5_000_000 },
      { date: "2026-07-02", close: 50, volume: 5_000_000 },
    ],
    participation: 0.08,
    expenseDragAnnualRate: 0,
  });
  const ranged = resolveFund(w, {
    basis: BASIS_ESTIMATED,
    deploy: DEPLOY_RANGE,
    dxyzBridge: bridge,
  });
  assert.equal(ranged.deployRange, true);
  assert.ok(ranged.anthFvHigh > ranged.anthFv);
  const m = fundRowMetrics(w, FALLBACK_PRICES.DXYZ, {
    anthVal: DEFAULT_ANTH_VAL,
    oaiVal: DEFAULT_OAI_VAL,
    dilution: 0,
    resolved: ranged,
  });
  assert.ok(m.combinedPer100High > m.combinedPer100);
});
