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
  SPCX_UNITS_JUNE_30,
  SPCX_IN_KIND_DISTRIBUTION,
  SUBSEQUENT_DEALS,
  SUBSEQUENT_DEALS_TOTAL,
  OPENAI_AUGUST_LOT_FILED,
  filedCashNet,
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

test("September 30 NPORT-P / NPORT-EX identity checks", () => {
  assert.equal(FILED.netAssets, 1_826_366_694);
  assert.equal(FILED.portfolioValue, 1_636_202_778);
  assert.equal(FILED.portfolioCost, 1_147_126_181);
  assert.ok(Math.abs(FILED.totalAssets - FILED.liabilities - FILED.netAssets) < 0.01);
  assert.equal((FILED.netAssets / FILED.sharesOutstanding).toFixed(5), "38.32289");
  assert.equal(FILED.sharesOutstanding, 47_657_338);
  assert.equal(MONEY_MARKET.valUSD, 529_644_689);
  assert.equal((MONEY_MARKET.valUSD / FILED.netAssets * 100).toFixed(2), "29.00");
  assert.equal(otherNetAssets(), 190_163_916);
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

test("Anthropic unit mark and NAV sensitivity are filed (9/30, post-split)", () => {
  assert.equal(ANTHROPIC_SPV.units, 386_088);
  assert.equal(ANTHROPIC_SPV.postSplitUnits, 3_860_880);
  assert.equal(ANTHROPIC_SPV.valUSD, 382_879_608.72);
  assert.equal((ANTHROPIC_SPV.valUSD / ANTHROPIC_SPV.postSplitUnits).toFixed(2), "99.17");
  // ΔNAV/sh ≈ $0.081 per $1 of ANT price.
  assert.equal(anthropicNavPerDollarPps().toFixed(5), "0.08101");
  assert.equal(ANTHROPIC_SPV.carriedInterestPct, 0);
  // 20.96% of net assets (NPORT-EX).
  assert.equal((ANTHROPIC_SPV.valUSD / FILED.netAssets * 100).toFixed(2), "20.96");
});

test("OpenAI Goanna 26E re-marks to $842.52 on 269,016 units that include the August lot", () => {
  assert.equal(OPENAI_EQUITY_SPV.units, 269_016);
  assert.equal(OPENAI_EQUITY_SPV.valUSD, 226_651_360.32);
  assert.equal(OPENAI_EQUITY_SPV.cost, 186_936_949);
  assert.equal(markPerUnit(OPENAI_EQUITY_SPV).toFixed(2), "842.52");
  assert.equal(OPENAI_AUGUST_LOT_FILED.units, 218_121);
  assert.equal((OPENAI_AUGUST_LOT_FILED.costUsd / OPENAI_AUGUST_LOT_FILED.units).toFixed(2), "687.69");
  assert.equal(OPENAI_PPU_SPV.units, 11_236);
  assert.equal(OPENAI_PPU_SPV.valUSD, 9_466_554.72);
});

test("SpaceX lines mark to $150.86; MWAM's filed value is anchored, not reproduced by the bare 10% formula", () => {
  const byId = Object.fromEntries(SPCX_SPVS.map((l) => [l.id, l]));
  for (const id of ["dxyzSpaceX_I", "snowpointGrowth_2_6", "directClassA"]) {
    assert.equal((byId[id].valUSD / byId[id].units).toFixed(2), "150.86", id);
  }
  assert.equal(SPCX_UNDERLYING_FILED_PPS.toFixed(2), "150.86");
  const mwam = byId.mwamVcSpaceX_II;
  assert.equal(mwam.valUSD, 23_152_698.91);
  assert.equal((mwam.valUSD / mwam.units).toFixed(2), "134.17");
  const predicted = carriedNetPps(SPCX_UNDERLYING_FILED_PPS, costPerUnit(mwam), 0.1);
  assert.equal(predicted.toFixed(2), "137.37");
  // Documented gap: ≈2.3% (0.04% at 6/30). The position is anchored to valUSD.
  assert.ok(Math.abs(predicted / markPerUnit(mwam) - 1 - 0.0238) < 0.001);
  const mwamOnly = (pps) => mwam.valUSD * (carriedNetPps(pps, costPerUnit(mwam), 0.1) / predicted);
  assert.ok(Math.abs(mwamOnly(SPCX_UNDERLYING_FILED_PPS) - 23_152_698.91) < 1e-6);
  assert.ok(
    Math.abs(spcxPositionValueAt(SPCX_UNDERLYING_FILED_PPS) - SPCX_VAL_USD_TOTAL) < 1e-6
  );
  // Below cost, carry is not a GP rebate to the LP.
  assert.equal(carriedNetPps(10, costPerUnit(mwam), 0.1), 10);
  assert.equal(spcxPositionValueAt(0), 0);
});

test("Unit Parity 5:1 restatement: 3/31 units × 5 = 6/30 units", () => {
  assert.equal(UNIT_PARITY_SPLIT.ratio, 5);
  assert.equal(SPCX_UNITS_MARCH_31.dxyzSpaceX_I * 5, SPCX_UNITS_JUNE_30.dxyzSpaceX_I);
  assert.equal(SPCX_UNITS_MARCH_31.mwamVcSpaceX_II * 5, SPCX_UNITS_JUNE_30.mwamVcSpaceX_II);
  // Snowpoint 3/31 28,486 × 5 = 142,430; June 30 printed 142,425, Sept 30 142,430.
  assert.equal(SPCX_UNITS_MARCH_31.snowpointGrowth_2_6 * 5, 142_430);
  assert.equal(SPCX_SPVS.find((l) => l.id === "snowpointGrowth_2_6").units, 142_430);
});

test("the 109,525 direct SpaceX shares are an in-kind SPV distribution, not a purchase", () => {
  const byId = Object.fromEntries(SPCX_SPVS.map((l) => [l.id, l]));
  assert.equal(SPCX_UNITS_JUNE_30.dxyzSpaceX_I - byId.dxyzSpaceX_I.units, SPCX_IN_KIND_DISTRIBUTION.fromSpaceX_I);
  assert.equal(SPCX_UNITS_JUNE_30.mwamVcSpaceX_II - byId.mwamVcSpaceX_II.units, SPCX_IN_KIND_DISTRIBUTION.fromMwam);
  assert.equal(SPCX_IN_KIND_DISTRIBUTION.fromSpaceX_I + SPCX_IN_KIND_DISTRIBUTION.fromMwam, byId.directClassA.units);
  // Cost moved with the shares: $1,004,414 + $665,954 = $1,670,368.
  assert.equal((10_009_990 - byId.dxyzSpaceX_I.cost) + (3_419_945 - byId.mwamVcSpaceX_II.cost), byId.directClassA.cost);
  assert.equal(SPCX_UNITS_TOTAL, 607_877 + 172_558 + 142_430 + 109_525);
  // Brief checksums.
  assert.equal(byId.dxyzSpaceX_I.valUSD.toFixed(0), "91704324");
  assert.equal(byId.mwamVcSpaceX_II.valUSD.toFixed(0), "23152699");
  assert.equal(byId.snowpointGrowth_2_6.valUSD.toFixed(0), "21486990");
  assert.equal(byId.directClassA.valUSD.toFixed(0), "16522942");
});

test("named 9/30 checksums and the Q3 deployments", () => {
  const lot = (n) => MOIC_LOTS.find((l) => l.name === n).valUSD;
  assert.equal(lot("Fluidstack"), 15_000_068);
  assert.equal(lot("Boom"), 1_894_943 + 4_000_000);
  assert.equal(lot("EnduroSat"), 9_800_000);
  assert.equal(lot("Tenstorrent"), 18_356_156);
  assert.equal(lot("Synchron"), 2_701_120 + 4_999_989);
  assert.equal(lot("Erebor Bank"), 19_999_994);
  assert.equal(lot("OpenAI PPUs"), 9_466_554.72);
});

test("cash: $719.8M at 9/30 (39.4%) and $112.0M of post-9/30 deals", () => {
  assert.equal(filedCashNet(), 529_644_689 + 190_163_916);
  assert.equal((filedCashNet() / 1e6).toFixed(1), "719.8");
  assert.equal((filedCashNet() / FILED.netAssets * 100).toFixed(1), "39.4");
  assert.equal(SUBSEQUENT_DEALS.length, 5);
  assert.equal(SUBSEQUENT_DEALS_TOTAL, 112_000_000);
  assert.ok(SUBSEQUENT_DEALS.every((d) => d.date > "2026-09-30" && d.date <= "2026-11-04"));
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

test("/dxyz finder uses NPORT units and per-SPV carry, not a 5× on filed counts", () => {
  const finder = readFileSync(
    new URL("../components/DXYZNAVFinder.jsx", import.meta.url),
    "utf8"
  );
  assert.match(finder, /data\.quotes\?\.SPCX/);
  assert.doesNotMatch(finder, /useState\(32\.97\)/);
  assert.match(readFileSync(new URL("../lib/dxyzNav.mjs", import.meta.url), "utf8"), /spcxPositionValueAt/);
  assert.match(finder, /Unit Parity/);
  assert.doesNotMatch(finder, /shares_k: 177\.992/);
  assert.match(finder, /SHARE_REPURCHASE/);
  assert.match(finder, /indeterminate/);
  assert.doesNotMatch(finder, /34\.30479/);
});
