// DXYZ June 30, 2026 unit-level holdings and per-SPV carry.
// Inputs are filed NPORT-P valUSD / balance (cents) and N-CSRS SOI dollars.
// Derived marks (PPS, long-tail residual) are computed, never stored beside inputs.

import { FILED } from "./dxyzAtm.mjs";

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

export const B424_JUNE_30 = {
  asOf: "2026-06-30",
  filingType: "424B3",
  accession: "0001575872-26-000624",
  url: "https://www.sec.gov/Archives/edgar/data/1843974/000157587226000624/dxyx104_424b3.htm",
};

export const UNIT_PARITY_SPLIT = {
  ratio: 5,
  effective: "2026-05-04",
  source:
    "SpaceX 424B4 five-for-one Class A/B/C split, effective May 4, 2026. N-CSRS Level 3 table names the adjustment Unit Parity. June 30 NPORT balances are already post-split.",
};

// 3/31 NPORT balances, pre-split. Any 3/31–6/30 unit series must be ×5.
export const SPCX_UNITS_MARCH_31 = {
  dxyzSpaceX_I: 135_135,
  mwamVcSpaceX_II: 42_857,
  snowpointGrowth_2_6: 28_486,
};

export const ANTHROPIC_SPV = {
  name: "Anthropic",
  vehicle: "Magnitude ANC III, LLC",
  units: 386_088,
  valUSD: 235_671_976.08,
  cost: 107_000_000,
  carriedInterestPct: 0,
};

export const OPENAI_EQUITY_SPV = {
  name: "OpenAI",
  vehicle: "Goanna Capital 26E LLC",
  units: 50_895,
  valUSD: 35_040_868.2,
  cost: 35_437_323,
  carriedInterestPct: 0,
};

export const OPENAI_PPU_SPV = {
  name: "OpenAI PPUs",
  vehicle: "DXYZ OAI I LLC",
  units: 11_236,
  valUSD: 7_735_911.09,
  cost: 2_010_008,
  carriedInterestPct: 0,
  excludedFromIpoScaling: true,
};

export const SPCX_SPVS = [
  {
    id: "dxyzSpaceX_I",
    name: "DXYZ SpaceX I LLC",
    units: 675_675,
    valUSD: 115_445_830.5,
    cost: 10_009_990,
    carriedInterestPct: 0,
  },
  {
    id: "mwamVcSpaceX_II",
    name: "MWAM VC SpaceX-II, LLC",
    units: 214_285,
    valUSD: 33_280_603.35,
    cost: 3_419_945,
    carriedInterestPct: 0.1,
  },
  {
    id: "snowpointGrowth_2_6",
    name: "Snowpoint Growth 2.6, LLC",
    units: 142_425,
    valUSD: 24_334_735.5,
    cost: 15_397_438,
    carriedInterestPct: 0,
  },
];

export const SPCX_UNITS_TOTAL = SPCX_SPVS.reduce((s, l) => s + l.units, 0);
export const SPCX_VAL_USD_TOTAL = SPCX_SPVS.reduce((s, l) => s + l.valUSD, 0);

export function markPerUnit(leg) {
  return leg.valUSD / leg.units;
}

export const SPCX_UNDERLYING_FILED_PPS = markPerUnit(
  SPCX_SPVS.find((l) => l.id === "dxyzSpaceX_I")
);

export function costPerUnit(leg) {
  return leg.cost / leg.units;
}

// Filed carry formula: net = underlying − carry × max(0, underlying − cost/unit).
// The max keeps the GP from paying the LP when the mark is below cost; at the
// June 30 SpaceX print the position is in-the-money, so this matches the filed identity.
export function carriedNetPps(underlyingPps, costPer, carryPct) {
  if (!(carryPct > 0)) return underlyingPps;
  return underlyingPps - carryPct * Math.max(0, underlyingPps - costPer);
}

export function spcxPositionValueAt(underlyingPps) {
  return SPCX_SPVS.reduce((sum, leg) => {
    if (!(leg.carriedInterestPct > 0)) return sum + underlyingPps * leg.units;
    const costPer = costPerUnit(leg);
    const liveNet = carriedNetPps(underlyingPps, costPer, leg.carriedInterestPct);
    const formulaAtFiled = carriedNetPps(
      SPCX_UNDERLYING_FILED_PPS,
      costPer,
      leg.carriedInterestPct
    );
    return sum + leg.valUSD * (liveNet / formulaAtFiled);
  }, 0);
}

export function anthropicNavPerDollarPps(shares = FILED.sharesOutstanding) {
  return ANTHROPIC_SPV.units / shares;
}

export const MONEY_MARKET = {
  name: "Cash & Cash Equivalents",
  units: 939_712_701,
  valUSD: 939_712_701,
  locked: true,
};

export const SHARE_LOTS = [
  {
    name: "Revolut",
    units: 8_200,
    valUSD: 16_630_994,
    note: "Common stock (N-CSRS 6/30)",
  },
  {
    name: "Discord",
    units: 10_690 + 13_110,
    valUSD: 353_946 + 434_072,
    note: "Common 10,690 + Series G 13,110 (N-CSRS 6/30)",
  },
  {
    name: "Klarna",
    units: 36_924,
    valUSD: 747_342,
    note: "Common stock (N-CSRS 6/30). Class B carried at $0.",
  },
  {
    name: "Chime",
    units: 60_785,
    valUSD: 1_244_877,
    note: "Chime Financial Inc. common (N-CSRS 6/30)",
  },
  {
    name: "Flexport",
    units: 26_000,
    valUSD: 85_800,
    note: "Common stock (N-CSRS 6/30)",
  },
];

export const MOIC_LOTS = [
  {
    name: "OpenEvidence",
    valUSD: 34_933_663,
    note: "SP21Z Opportunities LLC (N-CSRS 6/30)",
  },
  {
    name: "Shield AI",
    valUSD: 30_125_568,
    note: "Snowpoint Growth 2.5, LLC (N-CSRS 6/30)",
  },
  {
    name: "Databricks",
    valUSD: 8_400_462 + 11_200_616,
    note: "DA-1125 Gaingels + MCTC Series L (N-CSRS 6/30)",
  },
  {
    name: "CHAOS Industries",
    valUSD: 15_712_254,
    note: "WH Strategic Opportunities Fund V (N-CSRS 6/30)",
  },
  {
    name: "Hermeus",
    valUSD: 14_999_999,
    note: "Series C preferred (N-CSRS 6/30)",
  },
  {
    name: "Beast Industries",
    valUSD: 14_999_990,
    note: "Series C preferred (N-CSRS 6/30)",
  },
  {
    name: "Mercury",
    valUSD: 14_999_987,
    note: "Series D preferred (N-CSRS 6/30)",
  },
  {
    name: "Tenstorrent",
    valUSD: 12_500_000,
    note: "Prive Tens convertible note (N-CSRS 6/30)",
  },
  {
    name: "Skild AI",
    valUSD: 11_074_127,
    note: "Series C preferred (N-CSRS 6/30)",
  },
  {
    name: "Ferox Games",
    valUSD: 11_263_273,
    note: "Hexagon Master LLC Series 1 (N-CSRS 6/30)",
  },
  {
    name: "OpenAI PPUs",
    valUSD: OPENAI_PPU_SPV.valUSD,
    note: "DXYZ OAI I profit participation units — not equity; in NAV, excluded from /ai IPO scaling",
  },
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
