// DXYZ's share-denominated SpaceX position, split-adjusted to public SPCX.
// Share counts: 12/31/2025 N-CSR Schedule of Investments (pre-split).
// Split: SpaceX 424B4 — five-for-one Class A/B/C common, effective 2026-05-04
// (after DXYZ's 3/31/2026 NPORT-P; before the June 2026 IPO). Also described
// in SpaceX's 10-Q for the quarter ended 2026-06-30.

import { FILED, MARCH_31_NPORT } from "./dxyzAtm.mjs";

export const SPCX_YAHOO_SYMBOL = "SPCX";

export const SPCX_FILED_SHARES = {
  dxyzSpaceX_I: 135_135,
  mwamVcSpaceX_II: 42_857,
};

export const SPCX_FILED_SHARES_TOTAL =
  SPCX_FILED_SHARES.dxyzSpaceX_I + SPCX_FILED_SHARES.mwamVcSpaceX_II;

// 12.4% of the March 31 $742.5M portfolio — frozen so the N-CSR share-count
// mark does not ride the live June 30 $1.64B portfolio.
export const SPCX_MARCH31_WEIGHT = 0.124;
// June 30 424B3: DXYZ SpaceX I 7.0% + MWAM VC SpaceX-II 2.0%. Snowpoint 2.6
// (1.5%) has no share count and stays dollar-denominated.
export const SPCX_JUNE30_WEIGHT = 0.09;

export const SPCX_SPLIT = {
  ratio: 5,
  effective: "2026-05-04",
  source:
    "SpaceX 424B4: five-for-one stock split of Class A, Class B, and Class C common stock, effective May 4, 2026 (2026 Stock Split). SpaceX 10-Q for the quarter ended June 30, 2026.",
};

export const SPCX_POST_SPLIT_SHARES =
  SPCX_FILED_SHARES_TOTAL * SPCX_SPLIT.ratio;

export function spcxPreSplitMarkPps(
  portfolioValue = MARCH_31_NPORT.portfolioValue,
  weight = SPCX_MARCH31_WEIGHT,
  filedShares = SPCX_FILED_SHARES_TOTAL
) {
  return (portfolioValue * weight) / filedShares;
}

export function spcxSplitAdjustedMarkPps(
  portfolioValue = MARCH_31_NPORT.portfolioValue,
  weight = SPCX_MARCH31_WEIGHT,
  filedShares = SPCX_FILED_SHARES_TOTAL
) {
  return spcxPreSplitMarkPps(portfolioValue, weight, filedShares) / SPCX_SPLIT.ratio;
}

export const SPCX_SPLIT_ADJUSTED_MARK_PPS = spcxSplitAdjustedMarkPps();

export function spcxJune30MarkPps(
  portfolioValue = FILED.portfolioValue,
  weight = SPCX_JUNE30_WEIGHT,
  postSplitShares = SPCX_POST_SPLIT_SHARES
) {
  return (portfolioValue * weight) / postSplitShares;
}

export const SPCX_JUNE30_MARK_PPS = spcxJune30MarkPps();

export function spcxPositionValue(pps, shares = SPCX_POST_SPLIT_SHARES) {
  return pps * shares;
}
