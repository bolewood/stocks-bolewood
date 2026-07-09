import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  FILED,
  OTHER_NET_ASSETS,
  PROSPECTUS_424B5,
  PRIOR_ATM,
  Q1_ATM,
  DEFAULTS,
  impliedMarch31Shares,
  inferredAprMayShares,
  priorShelfRemainingApr1,
  windowStats,
  completedTradingRows,
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

test("empty windows are zero-safe: windowStats, calibrate, and computeAtmBridge", () => {
  const w = windowStats(snapshot.rows, "2031-01-01", "2031-12-31");
  assert.equal(w.days, 0);
  assert.equal(w.volume, 0);
  assert.equal(w.cvwap, 0); // volume > 0 guard, not NaN

  const cal = calibrate([]);
  assert.equal(cal.participation, 0); // division-by-zero guard
  assert.equal(cal.aprMayAvgPrice, 0);

  // No history rows means the inferred bridge cannot be valued: no inferred
  // shares are added (10.9M shares at $0 proceeds would crater NAV), so the
  // bridge degrades to the marked baseline.
  const b = computeAtmBridge({ mode: "calibrated", rows: [] });
  assert.equal(b.asOfDate, FILED.asOf);
  assert.equal(b.days, 0);
  assert.equal(b.drag, 0);
  assert.equal(b.aprMay.shares, 0);
  assert.equal(b.postMay.shares, 0);
  assert.equal(b.proFormaNav.toFixed(2), "24.56");
});

test("modeled issuance is invariant to user re-marks (filed-basis gate)", () => {
  // The fund issues against its own NAV, not the viewer's hypothetical marks:
  // tripling the marked net assets must not change how many shares the model
  // says were sold, only the asset side of the pro forma NAV.
  const atFiled = computeAtmBridge({ mode: "calibrated", rows: snapshot.rows });
  const atDream = computeAtmBridge({
    mode: "calibrated",
    rows: snapshot.rows,
    markedNetAssets: FILED.netAssets * 3,
  });
  assert.equal(atDream.postMay.shares, atFiled.postMay.shares);
  assert.equal(atDream.postMay.gross, atFiled.postMay.gross);
  assert.equal(atDream.aprMay.shares, atFiled.aprMay.shares);
  assert.ok(atDream.proFormaAssets > atFiled.proFormaAssets);
  assert.ok(atDream.proFormaNav > atFiled.proFormaNav);
});

test("out-of-range rates are clamped: commission to [0,1], participation to >= 0", () => {
  const rows = Array.from({ length: 5 }, (_, i) => ({
    date: `2026-06-${String(i + 1).padStart(2, "0")}`,
    close: 60,
    volume: 5_000_000,
  }));
  const base = {
    rows,
    startingNetAssets: FILED.netAssets,
    startingShares: impliedMarch31Shares(),
  };
  const overCommission = simulatePostMay({ ...base, participation: 0.083, commissionRate: 1.5 });
  assert.ok(overCommission.shares > 0);
  assert.equal(overCommission.net, 0); // clamped to 100%, never negative

  const negParticipation = simulatePostMay({ ...base, participation: -0.5, commissionRate: 0.005 });
  assert.equal(negParticipation.shares, 0);
  assert.equal(negParticipation.gross, 0);
});

test("as-of dates before the new program start are clamped to May 26", () => {
  // An earlier as-of would still carry the full Apr–May inferred layer,
  // presenting ~10.9M shares that had not been issued by that date.
  const b = computeAtmBridge({
    mode: "custom",
    rows: snapshot.rows,
    asOfDate: "2026-04-10",
  });
  assert.equal(b.asOfDate, "2026-05-26");
});

test("negative or NaN custom inputs cannot invert the issuance gate", () => {
  // Negative Apr–May shares once produced startingShares=0 → rollingNav=-Infinity
  // → gate always open → negative pro forma NAV.
  const neg = computeAtmBridge({
    mode: "custom",
    rows: snapshot.rows,
    aprMayShares: -impliedMarch31Shares(),
  });
  assert.equal(neg.aprMay.shares, 0);
  assert.ok(neg.proFormaNav > 0, `got ${neg.proFormaNav}`);
  assert.ok(neg.proFormaShares > 0);

  const nan = computeAtmBridge({
    mode: "custom",
    rows: snapshot.rows,
    participation: NaN,
    minPremium: -1, // would turn the below-NAV gate into "always issue"
    expenseDragAnnualRate: -0.5, // would add assets
  });
  assert.equal(nan.postMay.shares, 0); // NaN participation → no issuance
  assert.equal(nan.drag >= 0, true);
  assert.ok(Number.isFinite(nan.proFormaNav));
});

test("partial calibration windows are rejected, not misinterpreted", () => {
  // One Apr row would assign all 10.9M inferred shares to a single day's
  // volume (absurd participation) — a truncated feed must degrade exactly
  // like an empty one.
  const partial = [
    { date: "2026-04-15", close: 35, volume: 3_000_000 },
    { date: "2026-06-01", close: 40, volume: 2_000_000 },
  ];
  const cal = calibrate(partial);
  assert.equal(cal.participation, 0);
  assert.equal(cal.aprMayAvgPrice, 0);
  const b = computeAtmBridge({ mode: "calibrated", rows: partial });
  assert.equal(b.aprMay.shares, 0);
  assert.equal(b.postMay.shares, 0);
  // Full snapshot still calibrates normally.
  assert.ok(calibrate(snapshot.rows).participation > 0.08);
});

test("completedTradingRows drops the in-progress session only", () => {
  const rows = [
    { date: "2026-07-07", close: 24.54, volume: 862_300 },
    { date: "2026-07-08", close: 24.86, volume: 751_400 },
    { date: "2026-07-09", close: 27.6, volume: 1_121_930 },
  ];
  const trimmed = completedTradingRows(rows, "2026-07-09");
  assert.equal(trimmed.length, 2);
  assert.equal(trimmed[trimmed.length - 1].date, "2026-07-08");
  // A later "today" keeps the now-completed bar.
  assert.equal(completedTradingRows(rows, "2026-07-10").length, 3);
  // After the 16:00 ET close (16:05 buffer), today's bar is completed and kept
  // — dropping it until midnight would leave the bridge a session stale.
  assert.equal(completedTradingRows(rows, "2026-07-09", 15 * 60).length, 2); // 3:00pm
  assert.equal(completedTradingRows(rows, "2026-07-09", 16 * 60 + 5).length, 3); // 4:05pm
});

test("prior shelf remainder reconciles to filed gross usage", () => {
  // $1B registered − 2025 gross (11,096,400 × $29.48, N-CSR) − Q1 gross
  // (8,489,359 × $28.76, 424B3) ≈ $428.7M entering April 1.
  const remaining = priorShelfRemainingApr1();
  assert.ok(Math.abs(remaining - 428_724_163) < 1_000, `got ${remaining}`);
  // Pin each filed component independently (not the formula against itself):
  // 2025 gross ≈ $327.1M (N-CSR) and Q1 gross ≈ $244.2M (424B3).
  assert.ok(Math.abs(PRIOR_ATM.sold2025.shares * PRIOR_ATM.sold2025.wavgPrice - 327_121_872) < 1_000);
  assert.ok(Math.abs(Q1_ATM.shares * Q1_ATM.wavgPrice - 244_153_965) < 1_000);
  assert.equal(PRIOR_ATM.registered, 1_000_000_000);
});

test("Apr–May proceeds are capped at the prior shelf's filed remainder", () => {
  // At the observed ~$46.23 close-VWAP, 10.9M shares would gross ~$504M —
  // more than the old shelf could legally supply. The cap binds and the
  // effective average price falls out of the division.
  const b = computeAtmBridge({ mode: "calibrated", rows: snapshot.rows });
  assert.equal(b.aprMay.capped, true);
  assert.ok(Math.abs(b.aprMay.gross - priorShelfRemainingApr1()) < 1);
  assert.ok(Math.abs(b.aprMay.avgPrice - 39.32) < 0.05, `got ${b.aprMay.avgPrice}`);
  assert.ok(b.aprMay.avgPrice < 46); // strictly below the uncapped VWAP
  // Cap must not bind when modeled proceeds fit inside the remainder.
  const low = computeAtmBridge({
    mode: "custom",
    rows: snapshot.rows,
    aprMayAvgPrice: 30,
  });
  assert.equal(low.aprMay.capped, false);
  assert.equal(low.aprMay.avgPrice, 30);
});

test("explicit price overrides bypass the cap; shares-only overrides stay capped", () => {
  // A typed price is the user's counterfactual — honoring it silently clamped
  // would present unchanged math as if the override were applied.
  const explicit = computeAtmBridge({
    mode: "custom",
    rows: snapshot.rows,
    aprMayAvgPrice: 50,
    expenseDragAnnualRate: 0,
  });
  assert.equal(explicit.aprMay.capped, false);
  assert.equal(explicit.aprMay.avgPrice, 50);
  assert.ok(explicit.aprMay.gross > priorShelfRemainingApr1());

  // Shares-only override: price stays estimated (VWAP), so the filed shelf
  // cap still applies and re-derives the effective average.
  const sharesOnly = computeAtmBridge({
    mode: "custom",
    rows: snapshot.rows,
    aprMayShares: 20_000_000,
    expenseDragAnnualRate: 0,
  });
  assert.equal(sharesOnly.aprMay.capped, true);
  assert.ok(Math.abs(sharesOnly.aprMay.gross - priorShelfRemainingApr1()) < 1);
  assert.ok(Math.abs(sharesOnly.aprMay.avgPrice - priorShelfRemainingApr1() / 20_000_000) < 0.01);
});

test("every mode exposes the cap flag and prior-shelf remainder the UI reads", () => {
  // The UI renders atmBridge.aprMay.capped / .priorRemaining unconditionally;
  // the filed-mode early return must supply the same contract as the full path.
  const filed = computeAtmBridge({ mode: "filed", rows: snapshot.rows });
  assert.equal(filed.aprMay.capped, false); // no inferred layer → cap never binds
  assert.equal(filed.aprMay.priorRemaining, priorShelfRemainingApr1());

  const cal = computeAtmBridge({ mode: "calibrated", rows: snapshot.rows });
  assert.equal(cal.aprMay.priorRemaining, priorShelfRemainingApr1());

  // Empty history degrades to zero inferred issuance — must not report capped.
  const empty = computeAtmBridge({ mode: "calibrated", rows: [] });
  assert.equal(empty.aprMay.capped, false);
  assert.equal(empty.aprMay.priorRemaining, priorShelfRemainingApr1());
});

test("commission default is calibrated to the filed ~0.95% effective rate", () => {
  // N-CSR: 11,096,400 shares at $29.48 wavg grossed ~$327.1M for $324.0M net
  // → ~0.95% effective; the 1.0% default must round from that, and flow into
  // the capped Apr–May net proceeds.
  const gross2025 = PRIOR_ATM.sold2025.shares * PRIOR_ATM.sold2025.wavgPrice;
  const effective = 1 - PRIOR_ATM.sold2025.netProceeds / gross2025;
  assert.ok(Math.abs(effective - 0.0095) < 0.0005, `got ${effective}`);
  assert.equal(DEFAULTS.commissionRate, 0.01);

  const b = computeAtmBridge({ mode: "calibrated", rows: snapshot.rows });
  assert.ok(
    Math.abs(b.aprMay.net - priorShelfRemainingApr1() * (1 - DEFAULTS.commissionRate)) < 1,
    `net ${b.aprMay.net}`
  );
});

test("computeAtmBridge enforces the filed 3% commission cap", () => {
  // The UI advertises "up to 3.0%"; a typed 30 must not model 30% commission.
  const capped = computeAtmBridge({
    mode: "custom",
    rows: snapshot.rows,
    commissionRate: 0.30,
    expenseDragAnnualRate: 0,
  });
  const atCap = computeAtmBridge({
    mode: "custom",
    rows: snapshot.rows,
    commissionRate: PROSPECTUS_424B5.commissionCap,
    expenseDragAnnualRate: 0,
  });
  assert.equal(capped.aprMay.net, atCap.aprMay.net);
  assert.equal(capped.proFormaNav, atCap.proFormaNav);
});

test("minPremium gates issuance on days at a premium below the threshold", () => {
  // Close ≈ $25 is ~1.8% above the ~$24.56 rolling NAV.
  const rows = Array.from({ length: 10 }, (_, i) => ({
    date: `2026-06-${String(i + 1).padStart(2, "0")}`,
    close: 25,
    volume: 5_000_000,
  }));
  const base = {
    rows,
    participation: 0.083,
    commissionRate: 0.005,
    startingNetAssets: FILED.netAssets,
    startingShares: impliedMarch31Shares(),
  };
  const open = simulatePostMay({ ...base, minPremium: 0 });
  assert.equal(open.daysIssued, 10);
  assert.ok(open.shares > 0);

  const gated = simulatePostMay({ ...base, minPremium: 0.1 }); // require +10%
  assert.equal(gated.daysIssued, 0);
  assert.equal(gated.daysSkipped, 10);
  assert.equal(gated.shares, 0);
});

test("simulatePostMay ignores rows before the program start date", () => {
  const preStart = Array.from({ length: 5 }, (_, i) => ({
    date: `2026-05-${String(i + 10).padStart(2, "0")}`, // May 10–14 < May 26
    close: 60,
    volume: 5_000_000,
  }));
  const postStart = Array.from({ length: 3 }, (_, i) => ({
    date: `2026-06-${String(i + 1).padStart(2, "0")}`,
    close: 60,
    volume: 5_000_000,
  }));
  const base = {
    participation: 0.083,
    commissionRate: 0.005,
    startingNetAssets: FILED.netAssets,
    startingShares: impliedMarch31Shares(),
  };
  const withPre = simulatePostMay({ ...base, rows: [...preStart, ...postStart] });
  const withoutPre = simulatePostMay({ ...base, rows: postStart });
  assert.equal(withPre.daysIssued + withPre.daysSkipped, 3); // May rows excluded
  assert.equal(withPre.shares, withoutPre.shares);
  assert.equal(withPre.gross, withoutPre.gross);
});

test("expense drag accrues at rate × days/365 × average assets and lowers NAV", () => {
  const noDrag = computeAtmBridge({
    mode: "calibrated",
    rows: snapshot.rows,
    expenseDragAnnualRate: 0,
  });
  const withDrag = computeAtmBridge({
    mode: "calibrated",
    rows: snapshot.rows,
    expenseDragAnnualRate: 0.025,
  });
  assert.equal(noDrag.drag, 0);
  assert.ok(withDrag.drag > 0);
  const avgAssets =
    FILED.netAssets + (withDrag.aprMay.net + withDrag.postMay.net) / 2;
  const expected = 0.025 * (withDrag.days / 365) * avgAssets;
  assert.ok(Math.abs(withDrag.drag - expected) < 1, `drag ${withDrag.drag} vs ${expected}`);
  assert.ok(withDrag.proFormaNav < noDrag.proFormaNav);
  assert.equal(withDrag.proFormaShares, noDrag.proFormaShares); // drag burns assets, not shares
});

test("degenerate baselines are guarded: zero shares and re-marked net assets", () => {
  // baselineShares = 0 must not divide by zero in markedNav.
  const zero = computeAtmBridge({
    mode: "calibrated",
    rows: snapshot.rows,
    baselineShares: 0,
  });
  assert.equal(zero.markedNav, 0);
  assert.ok(Number.isFinite(zero.proFormaNav));

  // A re-marked (higher) baseline flows through markedNav and pro forma NAV.
  const marked = computeAtmBridge({
    mode: "calibrated",
    rows: snapshot.rows,
    markedNetAssets: FILED.netAssets * 1.5,
  });
  const filedBase = computeAtmBridge({ mode: "calibrated", rows: snapshot.rows });
  assert.ok(Math.abs(marked.markedNav - FILED.navPerShare * 1.5) < 0.01);
  assert.ok(marked.proFormaNav > filedBase.proFormaNav);
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
