import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { FILED } from "../lib/dxyzAtm.mjs";
import {
  SPCX_FILED_SHARES,
  SPCX_FILED_SHARES_TOTAL,
  SPCX_MARCH31_WEIGHT,
  SPCX_POST_SPLIT_SHARES,
  SPCX_SPLIT,
  SPCX_SPLIT_ADJUSTED_MARK_PPS,
  SPCX_YAHOO_SYMBOL,
  spcxPositionValue,
  spcxPreSplitMarkPps,
  spcxSplitAdjustedMarkPps,
} from "../lib/dxyzSpcx.mjs";

test("DXYZ SpaceX N-CSR share count is DXYZ SpaceX I + MWAM VC SpaceX-II", () => {
  assert.equal(SPCX_FILED_SHARES.dxyzSpaceX_I, 135_135);
  assert.equal(SPCX_FILED_SHARES.mwamVcSpaceX_II, 42_857);
  assert.equal(SPCX_FILED_SHARES_TOTAL, 177_992);
});

test("SpaceX 5-for-1 split is after the 3/31 N-PORT and before the IPO", () => {
  assert.equal(SPCX_SPLIT.ratio, 5);
  assert.equal(SPCX_SPLIT.effective, "2026-05-04");
  assert.ok(SPCX_SPLIT.effective > "2026-03-31");
  assert.ok(SPCX_SPLIT.effective < "2026-06-12");
  assert.match(SPCX_SPLIT.source, /424B4/);
  assert.match(SPCX_SPLIT.source, /10-Q/);
  assert.equal(SPCX_YAHOO_SYMBOL, "SPCX");
  assert.equal(SPCX_POST_SPLIT_SHARES, 889_960);
});

test("split-adjusted mark keeps the March 31 SpaceX dollar value", () => {
  const pre = spcxPreSplitMarkPps();
  const post = spcxSplitAdjustedMarkPps();
  assert.ok(Math.abs(pre - 517.27) < 0.01);
  assert.equal(post, pre / 5);
  assert.equal(SPCX_SPLIT_ADJUSTED_MARK_PPS, post);
  const filedValue = pre * SPCX_FILED_SHARES_TOTAL;
  const splitValue = post * SPCX_POST_SPLIT_SHARES;
  assert.ok(Math.abs(filedValue - splitValue) < 1e-6);
  assert.ok(
    Math.abs(filedValue - FILED.portfolioValue * SPCX_MARCH31_WEIGHT) < 1
  );
});

test("live SPCX marks the post-split share count, not the N-CSR print", () => {
  const live = 138.62;
  assert.equal(spcxPositionValue(live), live * 889_960);
  assert.ok(spcxPositionValue(live) > spcxPositionValue(SPCX_SPLIT_ADJUSTED_MARK_PPS));
});

test("/dxyz SpaceX row is wired to the shared /api/prices SPCX quote", () => {
  const finder = readFileSync(
    new URL("../components/DXYZNAVFinder.jsx", import.meta.url),
    "utf8"
  );
  assert.match(finder, /data\.prices\?\.SPCX/);
  assert.match(finder, /SPCX_POST_SPLIT_SHARES/);
  assert.match(finder, /5-for-1 split/);
  assert.doesNotMatch(finder, /shares_k: 177\.992/);
});
