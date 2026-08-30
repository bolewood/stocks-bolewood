import assert from "node:assert/strict";
import { test } from "node:test";
import { MARCH_31_NPORT } from "../lib/dxyzAtm.mjs";
import {
  SPCX_FILED_SHARES,
  SPCX_FILED_SHARES_TOTAL,
  SPCX_MARCH31_WEIGHT,
  SPCX_POST_SPLIT_SHARES,
  SPCX_SPLIT,
  SPCX_SPLIT_ADJUSTED_MARK_PPS,
  SPCX_JUNE30_MARK_PPS,
  SPCX_YAHOO_SYMBOL,
  SPCX_VAL_USD_TOTAL,
  spcxPositionValue,
  spcxPreSplitMarkPps,
  spcxSplitAdjustedMarkPps,
} from "../lib/dxyzSpcx.mjs";

test("3/31 N-CSR share count is DXYZ SpaceX I + MWAM VC SpaceX-II (pre-split)", () => {
  assert.equal(SPCX_FILED_SHARES.dxyzSpaceX_I, 135_135);
  assert.equal(SPCX_FILED_SHARES.mwamVcSpaceX_II, 42_857);
  assert.equal(SPCX_FILED_SHARES_TOTAL, 177_992);
});

test("SpaceX 5-for-1 Unit Parity is after the 3/31 N-PORT and before the IPO", () => {
  assert.equal(SPCX_SPLIT.ratio, 5);
  assert.equal(SPCX_SPLIT.effective, "2026-05-04");
  assert.ok(SPCX_SPLIT.effective > "2026-03-31");
  assert.ok(SPCX_SPLIT.effective < "2026-06-12");
  assert.equal(SPCX_YAHOO_SYMBOL, "SPCX");
  assert.equal(SPCX_POST_SPLIT_SHARES, 1_032_385);
});

test("split-adjusted mark keeps the March 31 SpaceX dollar value", () => {
  const pre = spcxPreSplitMarkPps();
  const post = spcxSplitAdjustedMarkPps();
  assert.ok(Math.abs(pre - 517.27) < 0.01);
  assert.equal(post, pre / 5);
  assert.equal(SPCX_SPLIT_ADJUSTED_MARK_PPS, post);
  const filedValue = pre * SPCX_FILED_SHARES_TOTAL;
  const splitValue = post * SPCX_FILED_SHARES_TOTAL * 5;
  assert.ok(Math.abs(filedValue - splitValue) < 1e-6);
  assert.ok(
    Math.abs(filedValue - MARCH_31_NPORT.portfolioValue * SPCX_MARCH31_WEIGHT) < 1
  );
});

test("June 30 underlying mark is $170.86 and live SPCX uses per-SPV carry", () => {
  assert.equal(SPCX_JUNE30_MARK_PPS.toFixed(2), "170.86");
  const live = 170.86;
  assert.ok(Math.abs(spcxPositionValue(live) - SPCX_VAL_USD_TOTAL) < 1e-6);
  const higher = spcxPositionValue(180);
  assert.ok(higher > SPCX_VAL_USD_TOTAL);
});
