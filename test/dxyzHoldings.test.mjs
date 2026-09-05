import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { FILED } from "../lib/dxyzAtm.mjs";
import {
  ANTHROPIC_SPV,
  OPENAI_EQUITY_SPV,
  OPENAI_PPU_SPV,
  SPCX_SPVS,
  SPCX_UNITS_MARCH_31,
  SPCX_UNITS_TOTAL,
  SPCX_VAL_USD_TOTAL,
  SPCX_UNDERLYING_FILED_PPS,
  UNIT_PARITY_SPLIT,
  SHARE_LOTS,
  MOIC_LOTS,
  MONEY_MARKET,
  markPerUnit,
  carriedNetPps,
  costPerUnit,
  spcxPositionValueAt,
  anthropicNavPerDollarPps,
  longTailValue,
  otherNetAssets,
} from "../lib/dxyzHoldings.mjs";
import { WRAPPERS } from "../lib/loadAiData.mjs";

test("N-CSRS / NPORT identity checks", () => {
  assert.equal(FILED.netAssets, 1_634_830_252);
  assert.equal(FILED.portfolioValue, 1_640_039_144);
  assert.equal((FILED.netAssets / FILED.sharesOutstanding).toFixed(5), "34.30385");
  assert.equal(FILED.sharesOutstanding, 47_657_338);
  assert.equal(MONEY_MARKET.valUSD, 939_712_701);
  assert.equal((MONEY_MARKET.valUSD / FILED.netAssets * 100).toFixed(2), "57.48");
  assert.ok(Math.abs(otherNetAssets() - (FILED.netAssets - FILED.portfolioValue)) < 1e-6);
  const named =
    ANTHROPIC_SPV.valUSD +
    OPENAI_EQUITY_SPV.valUSD +
    SPCX_VAL_USD_TOTAL +
    SHARE_LOTS.reduce((s, l) => s + l.valUSD, 0) +
    MOIC_LOTS.reduce((s, l) => s + l.valUSD, 0) +
    MONEY_MARKET.valUSD;
  assert.ok(Math.abs(named + longTailValue() - FILED.portfolioValue) < 0.02);
});

test("Anthropic unit mark and NAV sensitivity are filed", () => {
  assert.equal(ANTHROPIC_SPV.units, 386_088);
  assert.equal(markPerUnit(ANTHROPIC_SPV).toFixed(2), "610.41");
  assert.equal(anthropicNavPerDollarPps().toFixed(6), "0.008101");
  assert.equal(ANTHROPIC_SPV.carriedInterestPct, 0);
});

test("SpaceX I and Snowpoint mark to $170.86; MWAM is 10% carry", () => {
  const spaceXI = SPCX_SPVS.find((l) => l.id === "dxyzSpaceX_I");
  const snow = SPCX_SPVS.find((l) => l.id === "snowpointGrowth_2_6");
  const mwam = SPCX_SPVS.find((l) => l.id === "mwamVcSpaceX_II");
  assert.equal((spaceXI.valUSD / spaceXI.units).toFixed(2), "170.86");
  assert.equal((snow.valUSD / snow.units).toFixed(2), "170.86");
  assert.equal((mwam.valUSD / mwam.units).toFixed(2), "155.31");
  const predicted = carriedNetPps(
    SPCX_UNDERLYING_FILED_PPS,
    costPerUnit(mwam),
    0.1
  );
  assert.equal(predicted.toFixed(2), "155.37");
  assert.ok(Math.abs(predicted - markPerUnit(mwam)) < 0.07);
  assert.ok(
    Math.abs(spcxPositionValueAt(SPCX_UNDERLYING_FILED_PPS) - SPCX_VAL_USD_TOTAL) < 1e-6
  );
  // Below cost, carry is not a GP rebate to the LP.
  assert.equal(carriedNetPps(10, costPerUnit(mwam), 0.1), 10);
  assert.equal(spcxPositionValueAt(0), 0);
});

test("Unit Parity 5:1 restatement: 3/31 units × 5 = 6/30 units", () => {
  assert.equal(UNIT_PARITY_SPLIT.ratio, 5);
  assert.equal(SPCX_UNITS_MARCH_31.dxyzSpaceX_I * 5, 675_675);
  assert.equal(SPCX_UNITS_MARCH_31.mwamVcSpaceX_II * 5, 214_285);
  // Snowpoint 3/31 28,486 × 5 = 142,430; June 30 NPORT prints 142,425.
  assert.equal(SPCX_UNITS_MARCH_31.snowpointGrowth_2_6 * 5, 142_430);
  assert.equal(SPCX_SPVS.find((l) => l.id === "snowpointGrowth_2_6").units, 142_425);
  assert.equal(SPCX_UNITS_TOTAL, 675_675 + 214_285 + 142_425);
});

test("Level 3 buckets reconcile to the named SPVs", () => {
  const vw = ANTHROPIC_SPV.valUSD + OPENAI_EQUITY_SPV.valUSD + OPENAI_PPU_SPV.valUSD;
  assert.equal(vw.toFixed(0), "278448755");
  assert.equal(SPCX_VAL_USD_TOTAL.toFixed(0), "173061169");
});

test("/ai DXYZ legs match the holdings module (one source of truth)", () => {
  const dxyz = WRAPPERS.find((w) => w.ticker === "DXYZ");
  assert.equal(dxyz.anthropic.basisId, "filed-units");
  assert.equal(dxyz.anthropic.filedUnits, ANTHROPIC_SPV.units);
  assert.equal(dxyz.anthropic.fairValue, ANTHROPIC_SPV.valUSD);
  assert.equal(dxyz.openai.filedUnits, OPENAI_EQUITY_SPV.units);
  assert.equal(dxyz.openai.fairValue, OPENAI_EQUITY_SPV.valUSD);
  assert.equal(dxyz.anthropic.computed.impliedExposure, null);
  assert.equal(dxyz.openai.computed.impliedExposure, null);
});

test("/dxyz finder uses NPORT units and per-SPV carry, not a 5× on June 30 counts", () => {
  const finder = readFileSync(
    new URL("../components/DXYZNAVFinder.jsx", import.meta.url),
    "utf8"
  );
  assert.match(finder, /data\.prices\?\.SPCX/);
  assert.match(readFileSync(new URL("../lib/dxyzNav.mjs", import.meta.url), "utf8"), /spcxPositionValueAt/);
  assert.match(finder, /Unit Parity/);
  assert.doesNotMatch(finder, /shares_k: 177\.992/);
  assert.match(finder, /SHARE_REPURCHASE/);
  assert.match(finder, /indeterminate/);
  assert.doesNotMatch(finder, /34\.30479/);
});
