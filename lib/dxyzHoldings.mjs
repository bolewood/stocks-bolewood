// DXYZ September 30, 2026 unit-level holdings and per-SPV carry.
// Inputs are filed NPORT-P valUSD / balance (cents) and NPORT-EX schedule of
// investments dollars. Derived marks (PPS, long-tail residual) are computed,
// never stored beside inputs.

import { FILED } from "./dxyzAtm.mjs";
import DXYZ_RECORD from "../data/wrappers/DXYZ.json" with { type: "json" };

export const OPENAI_LEG = DXYZ_RECORD.openai;
// Post-9/30 OpenAI lot (Oct 13 Series D, $25.0M at cost; units undisclosed).
export const SUBSEQUENT_OPENAI_PURCHASE = OPENAI_LEG.acquisition;
export const SUBSEQUENT_OPENAI_SOURCE = OPENAI_LEG.sources.find((s) => s.fields.includes("acquisition"));
export const OTHER_SUBSEQUENT_PURCHASES = DXYZ_RECORD.otherSubsequentPurchases;
// Every post-9/30 deal the 424B3 lists ("as of November 4, 2026"), funded from cash.
export const SUBSEQUENT_DEALS = [
  { id: SUBSEQUENT_OPENAI_PURCHASE.id, name: "OpenAI — Goanna 26E Series D", date: SUBSEQUENT_OPENAI_PURCHASE.date, costUsd: SUBSEQUENT_OPENAI_PURCHASE.costUsd },
  ...OTHER_SUBSEQUENT_PURCHASES.map(({ id, name, date, costUsd }) => ({ id, name, date, costUsd })),
];
export const SUBSEQUENT_DEALS_TOTAL = SUBSEQUENT_DEALS.reduce((s, d) => s + d.costUsd, 0);
export const SUBSEQUENT_DEALS_AS_OF = "2026-11-04";

export const NPORT_SEPT_30 = {
  asOf: "2026-09-30",
  filingType: "NPORT-P",
  accession: "0000894189-26-030445",
  accepted: "2026-11-16 16:36:53",
  url: "https://www.sec.gov/Archives/edgar/data/1843974/000089418926030445/primary_doc.xml",
};

export const SOI_SEPT_30 = {
  asOf: "2026-09-30",
  filingType: "NPORT-EX",
  accession: "0000894189-26-030445",
  url: "https://www.sec.gov/Archives/edgar/data/1843974/000089418926030445/destiny4.htm",
};

export const B424_NOV_16 = {
  asOf: "2026-09-30",
  filingType: "424B3",
  accession: "0001575872-26-000797",
  accepted: "2026-11-16 16:45:57",
  url: "https://www.sec.gov/Archives/edgar/data/1843974/000157587226000797/dxyz106_424B3.htm",
};

// Prior filings, kept for the history notes and changelog.
export const NCSRS_JUNE_30 = {
  asOf: "2026-06-30",
  filingType: "N-CSRS",
  accession: "0001213900-26-095201",
  url: "https://www.sec.gov/Archives/edgar/data/1843974/000121390026095201/ea0302101-01_ncsrs.htm",
};

export const NPORT_JUNE_30 = {
  asOf: "2026-06-30",
  filingType: "NPORT-P",
  accession: "0000894189-26-024246",
  url: "https://www.sec.gov/Archives/edgar/data/1843974/000089418926024246/primary_doc.xml",
};

export const UNIT_PARITY_SPLIT = {
  ratio: 5,
  effective: "2026-05-04",
  source:
    "SpaceX 424B4 five-for-one Class A/B/C split, effective May 4, 2026. N-CSRS Level 3 table names the adjustment Unit Parity. June 30 and September 30 NPORT balances are already post-split.",
};

// 3/31 NPORT balances, pre-split. Any 3/31–6/30 unit series must be ×5.
export const SPCX_UNITS_MARCH_31 = {
  dxyzSpaceX_I: 135_135,
  mwamVcSpaceX_II: 42_857,
  snowpointGrowth_2_6: 28_486,
};

// 6/30 NPORT balances (post-split). Between 6/30 and 9/30 SpaceX I (−67,798)
// and MWAM (−41,727) distributed 109,525 SpaceX Class A shares in kind to the
// fund; cost moved with them ($1,004,414 + $665,954 = $1,670,368). This is a
// change of holding form, not a purchase.
export const SPCX_UNITS_JUNE_30 = {
  dxyzSpaceX_I: 675_675,
  mwamVcSpaceX_II: 214_285,
  snowpointGrowth_2_6: 142_425,
};
export const SPCX_IN_KIND_DISTRIBUTION = {
  shares: 109_525,
  fromSpaceX_I: 67_798,
  fromMwam: 41_727,
  cost: 1_670_368,
  note: "Between June 30 and September 30, DXYZ SpaceX I (675,675 → 607,877) and MWAM VC SpaceX-II (214,285 → 172,558) distributed 109,525 SpaceX Class A shares in kind to the fund (cost $1,004,414 + $665,954 = $1,670,368). Not a purchase.",
};

export const ANTHROPIC_SPLIT = 10;
export const ANTHROPIC_SPV = {
  name: "Anthropic",
  vehicle: "Magnitude ANC III, LLC",
  units: DXYZ_RECORD.anthropic.filedUnits, // pre-split Series B equivalents
  postSplitUnits: DXYZ_RECORD.anthropic.filedUnits * ANTHROPIC_SPLIT,
  valUSD: DXYZ_RECORD.anthropic.reportedFairValue,
  cost: 107_000_000,
  carriedInterestPct: DXYZ_RECORD.anthropic.carriedInterestPct,
};

export const OPENAI_EQUITY_SPV = {
  name: "OpenAI",
  vehicle: "Goanna Capital 26E LLC",
  units: OPENAI_LEG.filedUnits,
  valUSD: OPENAI_LEG.reportedFairValue,
  cost: 186_936_949,
  carriedInterestPct: OPENAI_LEG.carriedInterestPct,
};

// The August 13 $150.0M lot is inside the 9/30 Goanna position:
// 269,016 − 50,895 = 218,121 units ≈ $687.69 per unit.
export const OPENAI_AUGUST_LOT_FILED = {
  units: OPENAI_LEG.filedUnits - 50_895,
  costUsd: 150_000_000,
};

export const OPENAI_PPU_SPV = {
  name: "OpenAI PPUs",
  vehicle: "DXYZ OAI I LLC",
  units: OPENAI_LEG.exclusions[0].units,
  valUSD: OPENAI_LEG.exclusions[0].reportedFairValue,
  cost: 2_010_008,
  carriedInterestPct: 0,
  excludedFromIpoScaling: true,
};

export const SPCX_SPVS = [
  {
    id: "dxyzSpaceX_I",
    name: "DXYZ SpaceX I LLC",
    units: 607_877,
    valUSD: 91_704_324.22,
    cost: 9_005_576,
    carriedInterestPct: 0,
  },
  {
    id: "mwamVcSpaceX_II",
    name: "MWAM VC SpaceX-II, LLC",
    units: 172_558,
    valUSD: 23_152_698.91,
    cost: 2_753_991,
    carriedInterestPct: 0.1,
  },
  {
    id: "snowpointGrowth_2_6",
    name: "Snowpoint Growth 2.6, LLC",
    units: 142_430,
    valUSD: 21_486_989.8,
    cost: 15_397_438,
    carriedInterestPct: 0,
  },
  {
    id: "directClassA",
    name: "Space Exploration Technologies Corp. Class A (direct)",
    units: 109_525,
    valUSD: 16_522_941.5,
    cost: 1_670_368,
    carriedInterestPct: 0,
  },
];

export const SPCX_UNITS_TOTAL = SPCX_SPVS.reduce((s, l) => s + l.units, 0);
export const SPCX_VAL_USD_TOTAL = SPCX_SPVS.reduce((s, l) => s + l.valUSD, 0);

export function markPerUnit(leg) {
  return leg.valUSD / leg.units;
}

// The direct Class A line is the cleanest read of the 9/30 SPCX price ($150.86).
export const SPCX_UNDERLYING_FILED_PPS = markPerUnit(SPCX_SPVS.find((l) => l.id === "directClassA"));

export function costPerUnit(leg) {
  return leg.cost / leg.units;
}

// Filed carry formula: net = underlying − carry × max(0, underlying − cost/unit).
// The max keeps the GP from paying the LP when the mark is below cost.
export function carriedNetPps(underlyingPps, costPer, carryPct) {
  if (!(carryPct > 0)) return underlyingPps;
  return underlyingPps - carryPct * Math.max(0, underlyingPps - costPer);
}

// Carried legs are anchored to their filed valUSD and scaled by the formula's
// relative move, so the filed value reproduces at the filed price. At 9/30 the
// bare 10% formula gives $137.37/unit for MWAM vs the filed $134.17 (≈2.3% gap,
// vs 0.04% at 6/30), so the anchor, not the formula, carries the level.
export function spcxPositionValueAt(underlyingPps) {
  return SPCX_SPVS.reduce((sum, leg) => {
    if (!(leg.carriedInterestPct > 0)) return sum + underlyingPps * leg.units;
    const costPer = costPerUnit(leg);
    const liveNet = carriedNetPps(underlyingPps, costPer, leg.carriedInterestPct);
    const formulaAtFiled = carriedNetPps(SPCX_UNDERLYING_FILED_PPS, costPer, leg.carriedInterestPct);
    return sum + leg.valUSD * (liveNet / formulaAtFiled);
  }, 0);
}

/** ΔNAV per DXYZ share per $1 of post-split ANT price. */
export function anthropicNavPerDollarPps(shares = FILED.sharesOutstanding) {
  return ANTHROPIC_SPV.postSplitUnits / shares;
}

export const MONEY_MARKET = {
  name: "Cash & Cash Equivalents",
  units: 529_644_689,
  valUSD: 529_644_689,
  yield: 0.0378,
  locked: true,
};

export const SHARE_LOTS = [
  { name: "Revolut", units: 8_200, valUSD: 17_235_990, note: "Common stock (NPORT-EX 9/30)" },
  { name: "Discord", units: 10_690 + 13_110, valUSD: 353_946 + 434_072, note: "Common 10,690 + Series G 13,110 (NPORT-EX 9/30)" },
  { name: "Klarna", units: 36_924, valUSD: 457_488, note: "Common stock (NPORT-EX 9/30)" },
  { name: "Chime", units: 60_785, valUSD: 1_619_312, note: "Chime Financial Inc. common (NPORT-EX 9/30)" },
  { name: "Flexport", units: 26_000, valUSD: 76_700, note: "Common stock (NPORT-EX 9/30)" },
];

export const MOIC_LOTS = [
  { name: "OpenEvidence", valUSD: 35_365_149, note: "SP21Z Opportunities LLC (NPORT-EX 9/30)" },
  { name: "Shield AI", valUSD: 31_925_088, note: "Snowpoint Growth 2.5, LLC (NPORT-EX 9/30)" },
  { name: "Ferox Games", valUSD: 26_085_652, note: "Hexagon Master LLC Series 1 (NPORT-EX 9/30)" },
  { name: "Databricks", valUSD: 10_398_636 + 13_864_848, note: "DA-1125 Gaingels + MCTC Series L (NPORT-EX 9/30)" },
  { name: "Erebor Bank", valUSD: 19_999_994, note: "Series C preferred, acquired 2026-09-18 (NPORT-EX 9/30)" },
  { name: "Tenstorrent", valUSD: 18_356_156, note: "Prive Tens, LLC — Series E-1/E-2 preferred (NPORT-EX 9/30)" },
  { name: "CHAOS Industries", valUSD: 15_712_254, note: "WH Strategic Opportunities Fund V (NPORT-EX 9/30)" },
  { name: "Fluidstack", valUSD: 15_000_068, note: "Magnitude FSTK, LLC — Series B, acquired 2026-07-16 (NPORT-EX 9/30)" },
  { name: "Hermeus", valUSD: 15_000_000, note: "Series C preferred (NPORT-EX 9/30)" },
  { name: "Beast Industries", valUSD: 14_999_990, note: "Series C preferred (NPORT-EX 9/30)" },
  { name: "Mercury", valUSD: 14_999_987, note: "Series D preferred (NPORT-EX 9/30)" },
  { name: "Skild AI", valUSD: 10_358_226, note: "Series C preferred (NPORT-EX 9/30)" },
  { name: "EnduroSat", valUSD: 9_800_000, note: "Emphatic Partner Capital Kochav L.P. — Series C, acquired 2026-08-27 (NPORT-EX 9/30)" },
  { name: "Synchron", valUSD: 2_701_120 + 4_999_989, note: "Common $2.70M (2026-09-04) + Series D $5.00M (2026-09-23) (NPORT-EX 9/30)" },
  { name: "Boom", valUSD: 1_894_943 + 4_000_000, note: "Series B-2 $1.89M + SAFE $4.00M (2026-08-04) (NPORT-EX 9/30)" },
  { name: "OpenAI PPUs", valUSD: OPENAI_PPU_SPV.valUSD, note: "DXYZ OAI I profit participation units — not equity; in NAV, excluded from /ai IPO scaling" },
];

function namedInvestmentValue() {
  return (
    ANTHROPIC_SPV.valUSD +
    OPENAI_EQUITY_SPV.valUSD +
    SPCX_VAL_USD_TOTAL +
    SHARE_LOTS.reduce((s, l) => s + l.valUSD, 0) +
    MOIC_LOTS.reduce((s, l) => s + l.valUSD, 0) +
    MONEY_MARKET.valUSD
  );
}

export function longTailValue(portfolioValue = FILED.portfolioValue) {
  return portfolioValue - namedInvestmentValue();
}

export function otherNetAssets(netAssets = FILED.netAssets, portfolioValue = FILED.portfolioValue) {
  return netAssets - portfolioValue;
}

// Cash at 9/30: money market + other assets less liabilities. The 424B3 labels
// the latter "Other Cash & Cash Equivalents" (10.9%). Per the NPORT-P it is
// cash outside investments $200,111,559.36 + other assets $2,806,889.10 −
// liabilities $12,754,532.07 = $190,163,916.
export function filedCashNet() {
  return MONEY_MARKET.valUSD + otherNetAssets();
}
