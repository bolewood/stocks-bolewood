import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  FILED,
  OTHER_NET_ASSETS,
  PROSPECTUS_424B5,
  impliedMarch31Shares,
  inferredAprMayShares,
  windowStats,
  calibrate,
  simulatePostMay,
  computeAtmBridge,
} from "../lib/dxyzAtm.mjs";

const snapshot = JSON.parse(
  readFileSync(new URL("../app/api/dxyz-history/snapshot.json", import.meta.url))
);

test("filed baseline reconciles: portfolio + other net assets = filed net assets", () => {
  assert.ok(
    Math.abs(FILED.portfolioValue + OTHER_NET_ASSETS - FILED.netAssets) < 0.01
  );
  assert.ok(
    Math.abs(FILED.totalAssets - FILED.liabilities - FILED.netAssets) < 0.01
  );
});

test("implied March 31 shares ≈ 30.47M and reproduce $24.56 filed NAV", () => {
  const shares = impliedMarch31Shares();
  assert.ok(Math.abs(shares - 30_470_723) < 5);
  assert.equal((FILED.netAssets / shares).toFixed(2), "24.56");
});

test("zero issuance (Filed Only) reproduces $24.56", () => {
  const b = computeAtmBridge({ mode: "filed", rows: snapshot.rows });
  assert.equal(b.proFormaNav.toFixed(2), "24.56");
  assert.equal(b.proFormaShares, impliedMarch31Shares());
  assert.equal(b.aprMay.shares, 0);
  assert.equal(b.postMay.shares, 0);
  assert.equal(b.accretionPerShare, 0);
});

test("inferred Apr 1–May 21 issuance ≈ 10.90M shares", () => {
  const shares = inferredAprMayShares();
  assert.ok(Math.abs(shares - 10_900_000) < 25_000, `got ${shares}`);
});

test("calibrated participation from snapshot ≈ 8.3%", () => {
  const cal = calibrate(snapshot.rows);
  assert.ok(Math.abs(cal.participation - 0.083) < 0.002, `got ${cal.participation}`);
  assert.ok(Math.abs(cal.aprMayAvgPrice - 46.23) < 0.25, `got ${cal.aprMayAvgPrice}`);
});

test("issuance gross proceeds cannot exceed $1B capacity", () => {
  // Huge synthetic volume at a big premium would raise ~$60B unconstrained.
  const rows = Array.from({ length: 30 }, (_, i) => ({
    date: `2026-06-${String(i + 1).padStart(2, "0")}`,
    close: 100,
    volume: 200_000_000,
  }));
  const sim = simulatePostMay({
    rows,
    participation: 0.1,
    commissionRate: 0.005,
    startingNetAssets: FILED.netAssets,
    startingShares: impliedMarch31Shares(),
  });
  assert.ok(sim.gross <= PROSPECTUS_424B5.capacityGross + 0.01, `gross ${sim.gross}`);
  assert.equal(sim.capacityRemaining, 0);
  assert.ok(sim.exhaustedOn !== null);
  assert.ok(Math.abs(sim.net - sim.gross * 0.995) < 1);
});

test("days with market price below rolling NAV issue zero shares", () => {
  const rows = Array.from({ length: 10 }, (_, i) => ({
    date: `2026-06-${String(i + 1).padStart(2, "0")}`,
    close: 20, // below the ~$24.56 rolling NAV
    volume: 5_000_000,
  }));
  const sim = simulatePostMay({
    rows,
    participation: 0.083,
    commissionRate: 0.005,
    startingNetAssets: FILED.netAssets,
    startingShares: impliedMarch31Shares(),
  });
  assert.equal(sim.shares, 0);
  assert.equal(sim.gross, 0);
  assert.equal(sim.daysIssued, 0);
  assert.equal(sim.daysSkipped, 10);
});

test("ATM issuance above NAV is accretive", () => {
  const b = computeAtmBridge({
    mode: "calibrated",
    rows: snapshot.rows,
    expenseDragAnnualRate: 0, // isolate issuance accretion from fee drag
  });
  assert.ok(b.proFormaNav > b.markedNav, `${b.proFormaNav} vs ${b.markedNav}`);
  assert.ok(b.accretionPerShare > 0);
  assert.ok(b.proFormaShares > impliedMarch31Shares());
});

test("higher commission reduces net proceeds and pro forma NAV", () => {
  const lo = computeAtmBridge({ mode: "calibrated", rows: snapshot.rows, commissionRate: 0 });
  const hi = computeAtmBridge({ mode: "calibrated", rows: snapshot.rows, commissionRate: 0.03 });
  assert.ok(hi.aprMay.net < lo.aprMay.net);
  assert.ok(hi.postMay.net < lo.postMay.net);
  assert.ok(hi.proFormaNav < lo.proFormaNav);
});

test("windowStats matches filed-period observations", () => {
  const w = windowStats(snapshot.rows, "2026-04-01", "2026-05-21");
  assert.ok(Math.abs(w.volume - 131_338_000) < 2_000_000, `vol ${w.volume}`);
});

test("custom overrides are respected", () => {
  const b = computeAtmBridge({
    mode: "custom",
    rows: snapshot.rows,
    aprMayShares: 5_000_000,
    aprMayAvgPrice: 40,
    participation: 0.05,
    commissionRate: 0.01,
    expenseDragAnnualRate: 0,
    asOfDate: "2026-06-15",
  });
  assert.equal(b.aprMay.shares, 5_000_000);
  assert.ok(Math.abs(b.aprMay.net - 5_000_000 * 40 * 0.99) < 1);
  assert.equal(b.asOfDate, "2026-06-15");
  // no post-May rows beyond the as-of date contribute; identical inputs with
  // a later as-of date can only add issuance
  const later = computeAtmBridge({
    mode: "custom",
    rows: snapshot.rows,
    aprMayShares: 5_000_000,
    aprMayAvgPrice: 40,
    participation: 0.05,
    commissionRate: 0.01,
    expenseDragAnnualRate: 0,
  });
  assert.ok(later.postMay.shares >= b.postMay.shares);
  assert.ok(later.asOfDate > b.asOfDate);
});
