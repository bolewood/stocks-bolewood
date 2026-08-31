// DXYZ SpaceX legs: June 30 NPORT unit counts (already post 5-for-1 split).
// Carry is per-SPV. Do not multiply these units by SPCX_SPLIT.ratio.

import { MARCH_31_NPORT } from "./dxyzAtm.mjs";
import {
  SPCX_SPVS,
  SPCX_UNITS_MARCH_31,
  SPCX_UNITS_TOTAL,
  SPCX_VAL_USD_TOTAL,
  SPCX_UNDERLYING_FILED_PPS,
  UNIT_PARITY_SPLIT,
  markPerUnit,
  spcxPositionValueAt,
} from "./dxyzHoldings.mjs";

export const SPCX_YAHOO_SYMBOL = "SPCX";

export const SPCX_SPLIT = UNIT_PARITY_SPLIT;

export const SPCX_FILED_SHARES = {
  dxyzSpaceX_I: SPCX_UNITS_MARCH_31.dxyzSpaceX_I,
  mwamVcSpaceX_II: SPCX_UNITS_MARCH_31.mwamVcSpaceX_II,
};

export const SPCX_FILED_SHARES_TOTAL =
  SPCX_FILED_SHARES.dxyzSpaceX_I + SPCX_FILED_SHARES.mwamVcSpaceX_II;

export const SPCX_MARCH31_WEIGHT = 0.124;

export const SPCX_POST_SPLIT_SHARES = SPCX_UNITS_TOTAL;

export const SPCX_JUNE30_MARK_PPS = SPCX_UNDERLYING_FILED_PPS;

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

export function spcxJune30MarkPps() {
  return SPCX_UNDERLYING_FILED_PPS;
}

export function spcxPositionValue(pps, shares = SPCX_POST_SPLIT_SHARES) {
  if (shares === SPCX_POST_SPLIT_SHARES) return spcxPositionValueAt(pps);
  return pps * shares;
}

export {
  SPCX_SPVS,
  SPCX_VAL_USD_TOTAL,
  markPerUnit,
  spcxPositionValueAt,
};
