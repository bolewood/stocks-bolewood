// Anthropic / OpenAI look-through math and curated wrapper table.
// Live data is price only (Yahoo v8 chart). Shares, ownership %, and fund
// FVs are curated with asOf dates — private AI stakes are not 13F securities.

import { impliedMarch31Shares, FILED } from "./dxyzAtm.mjs";

export const ANTHROPIC_ROUND_FEB_2026 = 380_000_000_000; // Series G; Zoom 10-Q
export const ANTHROPIC_ROUND_SERIES_H = 965_000_000_000; // May 2026 primary
export const OPENAI_ROUND_FEB_2026 = 850_000_000_000; // ~VC round / Hiive $851B; fund FV marks
export const OPENAI_ROUND_MAR_2026 = 852_000_000_000; // OpenAI newsroom, closed 2026-03-31

// Last known primary-round post-money. Single place to update chip/input multiples.
// asOf is when we last verified the anchors — not the round close date.
export const LAST_PRIMARY_ROUNDS = {
  asOf: "2026-08-19",
  anthropic: {
    round: "Series H",
    postMoney: ANTHROPIC_ROUND_SERIES_H, // $965B; Anthropic newsroom 2026-05-28
    closed: "2026-05-28",
    source: "https://www.anthropic.com/news/series-h",
  },
  openai: {
    round: "Mar 2026 primary",
    postMoney: OPENAI_ROUND_MAR_2026, // $852B post-money, $122B committed; OpenAI 2026-03-31
    closed: "2026-03-31",
    source: "https://openai.com/index/accelerating-the-next-phase-ai/",
  },
};

export const DEFAULT_ANTH_VAL = 1_000_000_000_000; // unpaired default; Series H ~$965B
export const DEFAULT_OAI_VAL = 1_250_000_000_000; // sheet Base
export const DEFAULT_DILUTION = 0;

export const SLIDER_BOUNDS = {
  anth: { min: 400, max: 2500, step: 25 }, // $B
  oai: { min: 500, max: 4000, step: 25 }, // $B
  dil: { min: 0, max: 30, step: 1 }, // %
};

export const SORT_QUERY_KEYS = {
  ticker: "ticker",
  type: "type",
  security: "security",
  price: "price",
  shares: "shares",
  marketCap: "marketCap",
  anthPct: "anthPct",
  anth: "anthPer100",
  anthPer100: "anthPer100",
  oaiPct: "oaiPct",
  oai: "oaiPer100",
  oaiPer100: "oaiPer100",
  combined: "combinedPer100",
  combinedPer100: "combinedPer100",
  confidence: "confidence",
};

const SORT_QUERY_SHORT = {
  ticker: "ticker",
  type: "type",
  security: "security",
  price: "price",
  shares: "shares",
  marketCap: "marketCap",
  anthPct: "anthPct",
  anthPer100: "anth",
  oaiPct: "oaiPct",
  oaiPer100: "oai",
  combinedPer100: "combined",
  confidence: "confidence",
};

// Coherent pairs from the March 2026 Excel. Load state matches no chip.
export const SCENARIO_CHIPS = {
  bear: { label: "Bear", anthVal: 400_000_000_000, oaiVal: 850_000_000_000 },
  base: { label: "Base", anthVal: 650_000_000_000, oaiVal: 1_250_000_000_000 },
  bull: { label: "Bull", anthVal: 1_000_000_000_000, oaiVal: 2_000_000_000_000 },
  ultra: {
    label: "Ultra",
    anthVal: 1_500_000_000_000,
    oaiVal: 3_500_000_000_000,
  },
};

export const FALLBACK_PRICES = {
  GOOG: 341.39,
  AMZN: 264.655,
  MSFT: 484.37,
  SFTBY: 16.54,
  NVDA: 219.6,
  SKM: 38.515,
  ZM: 108.16,
  AGIX: 44.5,
  DXYZ: 32.84,
  ARKVX: 57.43,
  VCX: 39.78,
};

const DXYZ_PORTFOLIO = FILED.portfolioValue; // $742.5M at 2026-03-31
const DXYZ_ANTH_FV = 0.181 * DXYZ_PORTFOLIO; // 18.1% Magnitude ANC III
const DXYZ_OAI_SERIES_C_FV = 0.047 * DXYZ_PORTFOLIO; // Goanna Series C SPV
// 1.0% DXYZ OAI I PPUs are not equity and are excluded from IPO scaling.

const ARKVX_NPORT_NAV = 862_446_918.77; // NPORT-P as of 2026-04-30
const ARKVX_APR30_NAV_PS = 50.38; // YCharts NAV 2026-04-30
const ARKVX_SHARES = Math.round(ARKVX_NPORT_NAV / ARKVX_APR30_NAV_PS);

export function marketCapUsd(price, shares) {
  if (!(price > 0) || !(shares > 0)) return 0;
  return price * shares;
}

export function lookThroughPer100({
  claimPct,
  ipoVal,
  marketCap,
  dilution = 0,
}) {
  if (!(marketCap > 0) || !(ipoVal > 0) || !(claimPct > 0)) return 0;
  const dil = Math.min(1, Math.max(0, dilution));
  return (claimPct * (1 - dil) * ipoVal * 100) / marketCap;
}

export function fundClaimPct(fairValue, roundVal) {
  if (!(fairValue > 0) || !(roundVal > 0)) return 0;
  return fairValue / roundVal;
}

function corporateLeg(ownershipPct, extras = {}) {
  if (!ownershipPct) return null;
  return { kind: "equity", ownershipPct, ...extras };
}

function fundLeg(fairValue, roundVal, extras = {}) {
  if (!fairValue) return null;
  return { kind: "fund", fairValue, roundVal, ...extras };
}

export const WRAPPERS = [
  {
    ticker: "GOOG",
    yahooSymbol: "GOOG",
    name: "Alphabet Inc.",
    type: "Strategic",
    sharesOutstanding: 12_230_000_000, // A+B+C; 10-Q period ended 2026-06-30
    sharesAsOf: "2026-06-30",
    sharesNote: "Class A+B+C. GOOG price × all classes ≈ Alphabet market cap.",
    anthropic: corporateLeg(0.14, {
      confidence: "medium",
      asOf: "2025-03-11",
      source: "NYT / court docs; 15% cap, non-voting. 10-Q does not name Anthropic.",
    }),
    openai: null,
    confidence: "medium",
    note: "14% as of Mar 2025; later rounds may have diluted unless Alphabet bought more.",
    // NYT / court docs 2025-03-11: ~14%, contractually hard-capped at 15%.
    security: {
      label: "Common (15% cap)",
      linear: false,
      footnote:
        "~14%, contractually hard-capped at 15% (NYT / court docs, 2025-03-11).",
    },
  },
  {
    ticker: "AMZN",
    yahooSymbol: "AMZN",
    name: "Amazon.com Inc.",
    type: "Strategic",
    sharesOutstanding: 10_786_313_572, // 10-Q cover, as of 2026-07-22
    sharesAsOf: "2026-07-22",
    anthropic: corporateLeg(0.2, {
      confidence: "low",
      asOf: "2026-06-30",
      pctLow: 0.08,
      pctHigh: 0.21,
      source:
        "Not issuer-disclosed. ~20% is carrying-value ÷ round (Aug 7 table ~21%). 10-Q cites an ownership cap on the convertibles. $100B AWS is not equity.",
    }),
    openai: corporateLeg(0.05, {
      confidence: "medium",
      asOf: "2026-08",
      source:
        "$50B Series C preferred (10-Q). ~5% is press, not Amazon's %. $100B AWS is not equity.",
    }),
    confidence: "low",
    note: "Anthropic 20% inferred (range 8–21%). OpenAI ~5% after the $50B close.",
    // AMZN 10-Q period ended 2026-03-31: convertibles ~$42.2B, nonvoting pfd ~$32.0B.
    security: {
      label: "Conv + Pfd",
      linear: false,
      footnote:
        "~$42.2B convertible notes + ~$32B nonvoting preferred; conversion terms undisclosed (AMZN 10-Q as of 2026-03-31).",
    },
  },
  {
    ticker: "MSFT",
    yahooSymbol: "MSFT",
    name: "Microsoft Corporation",
    type: "Strategic",
    sharesOutstanding: 7_428_434_704, // 10-Q as of 2026-04-23
    sharesAsOf: "2026-04-23",
    anthropic: corporateLeg(0.02, {
      confidence: "low",
      asOf: "2025-11",
      source: "~$5B Nov 2025; % not disclosed. Excel 2.6% was $5B ÷ an older round.",
    }),
    openai: corporateLeg(0.27, {
      confidence: "high",
      asOf: "2026-03-31",
      source: "10-Q: ~27% of OpenAI as-converted, equity method.",
    }),
    confidence: "high",
    note: "OpenAI 27% is the only Big Tech percentage in an SEC filing.",
    // MSFT 10-Q as of 2026-03-31: ~27% of OpenAI as-converted, equity method.
    security: {
      label: "Equity",
      linear: true,
      footnote: "27%, only Big Tech % in an SEC filing (MSFT 10-Q as of 2026-03-31).",
    },
  },
  {
    ticker: "SFTBY",
    yahooSymbol: "SFTBY",
    name: "SoftBank Group ADR",
    type: "Strategic",
    // Tokyo common 5,698,923,701 (issued 5,711,848,120 − treasury 12,924,419)
    // as of 2026-03-31. OTC ADR prints ~½ the USD-converted 9984.T price, so
    // issuer-equivalent ADR shares are 2× common for price × shares ≈ full cap.
    sharesOutstanding: 11_397_847_402,
    sharesAsOf: "2026-03-31",
    sharesNote:
      "Issuer-equivalent ADR shares (2× Tokyo common). SFTBY lags 9984.T; do not multiply the 5.70B common count by the ADR quote.",
    anthropic: null,
    openai: corporateLeg(0.13, {
      confidence: "high",
      asOf: "2026-02-27",
      source:
        "SoftBank: ~13% at $64.6B. ~$55B in as of Aug 2026; last $10B tranche due 2026-10-01.",
    }),
    confidence: "high",
    note: "No Anthropic. OpenAI is Vision Fund 2 preferred.",
    security: {
      label: "VF2 Pfd",
      linear: true,
      footnote:
        "OpenAI is Vision Fund 2 preferred; SoftBank ~13% at $64.6B (2026-02-27 release).",
    },
    // SBG Q1 FY2026 earnings (presented 2026-08-06): pro forma NAV ¥58.3T using
    // Aug 5, 2026 prices/FX. Arm ¥49.91T / holdings ¥83.11T = ~60% (data sheet
    // 2026-06-30). LTV 13.0% vs 25% policy cap. ¥31.46T mcap and ~46% discount
    // from contemporaneous coverage of that print. $10B OpenAI-secured margin
    // loan announced with those results; $40B bridge from the same financing wave.
    navNote: {
      summary: "NAV discount",
      body: "NAV ¥58.3T vs market cap ¥31.46T = ~46% discount (pro forma 2026-08-05). Arm is ~60% of NAV; LTV 13% vs a 25% policy cap, plus a recent $40B bridge loan and $10B margin loan secured by the OpenAI stake. The high per-$100 reflects the NAV discount, not OpenAI concentration. SBG's OpenAI exposure sits partly inside SVF2 — don't double-count against the Vision Fund line.",
    },
  },
  {
    ticker: "NVDA",
    yahooSymbol: "NVDA",
    name: "NVIDIA Corporation",
    type: "Strategic",
    sharesOutstanding: 24_300_000_000, // 10-K as of 2026-02-20
    sharesAsOf: "2026-02-20",
    anthropic: corporateLeg(0.026, {
      confidence: "low",
      asOf: "2025-11",
      source: "Up to $10B commitment; % not disclosed.",
    }),
    openai: corporateLeg(0.03, {
      confidence: "low",
      asOf: "2026-02",
      source:
        "$30B closed (not the $100B GPU LOI). 3.0% is a Low-confidence re-derive; the March sheet used ~3.6%.",
    }),
    confidence: "low",
    note: "Neither percentage is issuer-disclosed.",
    security: {
      label: "Undisclosed",
      linear: true,
      footnote: "Neither Anthropic nor OpenAI percentage is issuer-disclosed.",
    },
  },
  {
    ticker: "SKM",
    yahooSymbol: "SKM",
    name: "SK Telecom Co.",
    type: "Strategic",
    // March Excel $10.8B / $29.14. Tracks the Aug 7 ~$14.5B cap at later prices.
    sharesOutstanding: 370_624_571,
    sharesAsOf: "2026-03-25",
    sharesNote:
      "Issuer-equivalent ADR shares so SKM USD price × shares ≈ SK Telecom cap. Seoul listing is 017670.KS.",
    anthropic: corporateLeg(0.003, {
      confidence: "low",
      asOf: "2026-06",
      pctLow: 0.003,
      pctHigh: 0.007,
      source:
        "Aug 7 table / Hana ~0.30%. Excel 0.58% was pre–Series H. Undisclosed H follow-on (Jun 2026).",
    }),
    openai: null,
    confidence: "low",
    note: "Anthropic 0.30% (range 0.30–0.70%). No OpenAI.",
    security: {
      label: "Equity",
      linear: true,
      footnote:
        "Anthropic equity; % not issuer-disclosed (Aug 7 table / Hana ~0.30%).",
    },
  },
  {
    ticker: "ZM",
    yahooSymbol: "ZM",
    name: "Zoom Communications",
    type: "Strategic",
    sharesOutstanding: 296_454_680,
    sharesAsOf: "2026-07",
    anthropic: corporateLeg(0.003334, {
      confidence: "medium",
      asOf: "2026-04-30",
      pctLow: 0.0033,
      pctHigh: 0.01,
      source:
        "10-Q: $1,266.9M carrying value after +$46M, marked to the Feb 12, 2026 round (~$380B) ≈ 0.33%. Range 0.33–1.0.",
    }),
    openai: null,
    confidence: "medium",
    note: "OpenAI is a product/API partner, not equity.",
    // ZM 10-Q period ended 2026-04-30: $1,266.9M carrying value, Anthropic preferred.
    security: {
      label: "Preferred",
      linear: true,
      footnote: "Anthropic preferred; 10-Q carrying value $1,266.9M as of 2026-04-30.",
    },
  },
  {
    ticker: "AGIX",
    yahooSymbol: "AGIX",
    name: "KraneShares Public-Private AI ETF",
    type: "Fund",
    sharesOutstanding: 14_400_002, // KraneShares, 2026-08-18
    sharesAsOf: "2026-08-18",
    sharesNote: "ETF share count drifts with creations/redemptions.",
    anthropic: fundLeg(12_926_025, ANTHROPIC_ROUND_SERIES_H, {
      confidence: "high",
      asOf: "2026-08-18",
      source:
        "KraneShares holdings: Anthropic PBC $12,926,025 (1.92% of NAV). Point estimate is the latest holdings-page FV. NAV weight has printed ~1.9–2.8% (Mar 31 report 2.7%; Jul 31 blog 2.82%). Marked to Series H ~$965B.",
    }),
    openai: null,
    confidence: "high",
    note: "Not the SingularityNET token. No OpenAI in disclosed holdings.",
    security: {
      label: "Fund NAV",
      linear: true,
      footnote: "Look-through from filed fair value ÷ the round used to mark that FV.",
    },
  },
  {
    ticker: "DXYZ",
    yahooSymbol: "DXYZ",
    name: "Destiny Tech100",
    type: "Fund",
    sharesOutstanding: impliedMarch31Shares(), // ~30,470,723; ATM will drift
    sharesAsOf: "2026-03-31",
    sharesNote:
      "Implied by filed NAV ($748.36M / $24.56). Active ATM — this count will drift; /dxyz models issuance.",
    anthropic: fundLeg(DXYZ_ANTH_FV, ANTHROPIC_ROUND_FEB_2026, {
      confidence: "high",
      asOf: "2026-03-31",
      source:
        "18.1% of $742.5M portfolio (Magnitude ANC III SPV) marked at the Feb 2026 ~$380B round.",
    }),
    openai: fundLeg(DXYZ_OAI_SERIES_C_FV, OPENAI_ROUND_FEB_2026, {
      confidence: "low",
      asOf: "2026-03-31",
      source:
        "4.7% Goanna Series C SPV only. 1.0% DXYZ OAI I PPUs are not equity (N-CSR) and are excluded from IPO scaling.",
    }),
    confidence: "high",
    note: "OpenAI PPUs excluded from the scaled numerator.",
    security: {
      label: "Fund NAV",
      linear: true,
      footnote: "Look-through from filed fair value ÷ the round used to mark that FV.",
    },
  },
  {
    ticker: "ARKVX",
    yahooSymbol: "ARKVX",
    name: "ARK Venture Fund",
    type: "Fund",
    sharesOutstanding: ARKVX_SHARES, // NPORT-P net assets / Apr 30 NAV
    sharesAsOf: "2026-04-30",
    sharesNote:
      "Interval fund; Yahoo price is NAV. Share count from Apr 30 NPORT-P ($862.4M / $50.38). Q2 AUM later printed ~$1.3B, so this count will understate after inflows.",
    anthropic: fundLeg(23_083_673, ANTHROPIC_ROUND_FEB_2026, {
      confidence: "medium",
      asOf: "2026-04-30",
      source:
        "NPORT-P: Anthropic, Inc. $23,083,673 (2.68% of NAV). Point estimate is the filed dollar FV. Fact-sheet NAV weight has ranged ~3.5–6.4% (Mar 31 3.54%; May 31 6.40%).",
    }),
    openai: fundLeg(72_512_628, OPENAI_ROUND_FEB_2026, {
      confidence: "medium",
      asOf: "2026-04-30",
      source:
        "NPORT-P: OpenAI lots $7.32M + $11.21M + $50.00M Series C + $3.99M SPV = $72,512,628 (~8.41% of NAV). Fact-sheet weight has ranged ~8.5–11.5% (May 31 8.48%; Mar 31 11.49%).",
    }),
    confidence: "medium",
    note: "Limited quarterly liquidity. Priced at NAV (~1.00×).",
    security: {
      label: "Fund NAV",
      linear: true,
      footnote: "Look-through from filed fair value ÷ the round used to mark that FV.",
    },
  },
  {
    ticker: "VCX",
    yahooSymbol: "VCX",
    name: "Fundrise Innovation Fund",
    type: "Fund",
    sharesOutstanding: 35_797_138, // audited 2026-03-31
    sharesAsOf: "2026-03-31",
    anthropic: fundLeg(112_418_000, ANTHROPIC_ROUND_FEB_2026, {
      confidence: "high",
      asOf: "2026-03-31",
      source: "N-CSR/A: Anthropic, PBC $112,418k — 16.5% of net assets.",
    }),
    openai: fundLeg(84_163_000, OPENAI_ROUND_FEB_2026, {
      confidence: "high",
      asOf: "2026-03-31",
      source: "N-CSR/A: OpenAI Group PBC $84,163k — 12.4% of net assets.",
    }),
    confidence: "high",
    note: "Trades at a large premium to NAV. Denominator is market cap, not NAV.",
    security: {
      label: "Fund NAV",
      linear: true,
      footnote: "Look-through from filed fair value ÷ the round used to mark that FV.",
    },
  },
];

export const WRAPPER_TICKERS = WRAPPERS.map((w) => w.yahooSymbol);

export function claimPct(leg) {
  if (!leg) return 0;
  if (leg.kind === "fund") return fundClaimPct(leg.fairValue, leg.roundVal);
  return leg.ownershipPct || 0;
}

export function rowMetrics(wrapper, price, { anthVal, oaiVal, dilution }) {
  const mcap = marketCapUsd(price, wrapper.sharesOutstanding);
  const anthPct = claimPct(wrapper.anthropic);
  const oaiPct = claimPct(wrapper.openai);
  const anthPer100 = lookThroughPer100({
    claimPct: anthPct,
    ipoVal: anthVal,
    marketCap: mcap,
    dilution,
  });
  const oaiPer100 = lookThroughPer100({
    claimPct: oaiPct,
    ipoVal: oaiVal,
    marketCap: mcap,
    dilution,
  });
  return {
    ticker: wrapper.ticker,
    price,
    shares: wrapper.sharesOutstanding,
    marketCap: mcap,
    anthPct,
    oaiPct,
    anthPer100,
    oaiPer100,
    combinedPer100: anthPer100 + oaiPer100,
  };
}

export function chipMatching(anthVal, oaiVal) {
  for (const [key, chip] of Object.entries(SCENARIO_CHIPS)) {
    if (chip.anthVal === anthVal && chip.oaiVal === oaiVal) return key;
  }
  return null;
}

export function lastRoundMultiple(val, postMoney) {
  if (!(val > 0) || !(postMoney > 0)) return null;
  return val / postMoney;
}

export function fmtLastRoundMultiple(val, postMoney) {
  const x = lastRoundMultiple(val, postMoney);
  if (x == null) return "—";
  return x >= 1 ? `${x.toFixed(1)}x` : `${x.toFixed(2)}x`;
}

export function fmtTrillions(val) {
  return `$${(val / 1e12).toFixed(2)}T`;
}

export function chipMultipleLine(chip) {
  const anthX = fmtLastRoundMultiple(
    chip.anthVal,
    LAST_PRIMARY_ROUNDS.anthropic.postMoney
  );
  const oaiX = fmtLastRoundMultiple(
    chip.oaiVal,
    LAST_PRIMARY_ROUNDS.openai.postMoney
  );
  return `${anthX} / ${oaiX} last round`;
}

function clamp(n, min, max) {
  return Math.min(max, Math.max(min, n));
}

function parseBoundedInt(raw, { min, max }, fallback) {
  if (raw == null || raw === "") return fallback;
  const n = Number(raw);
  if (!Number.isFinite(n)) return fallback;
  return Math.round(clamp(n, min, max));
}

export function parseScenarioSearch(search) {
  const qs =
    typeof search === "string" && search.startsWith("?")
      ? search.slice(1)
      : search || "";
  const params = new URLSearchParams(qs);
  const anthB = parseBoundedInt(
    params.get("anth"),
    SLIDER_BOUNDS.anth,
    valToBillions(DEFAULT_ANTH_VAL)
  );
  const oaiB = parseBoundedInt(
    params.get("oai"),
    SLIDER_BOUNDS.oai,
    valToBillions(DEFAULT_OAI_VAL)
  );
  const dilutionPct = parseBoundedInt(
    params.get("dil"),
    SLIDER_BOUNDS.dil,
    DEFAULT_DILUTION * 100
  );
  const sortRaw = params.get("sort");
  const sortKey = SORT_QUERY_KEYS[sortRaw] || "combinedPer100";
  return { anthB, oaiB, dilutionPct, sortKey };
}

export function serializeScenarioSearch({ anthB, oaiB, dilutionPct, sortKey }) {
  const params = new URLSearchParams();
  params.set("anth", String(anthB));
  params.set("oai", String(oaiB));
  params.set("dil", String(dilutionPct));
  params.set("sort", SORT_QUERY_SHORT[sortKey] || "combined");
  return params.toString();
}

export function valToBillions(v) {
  return Math.round(v / 1e9);
}

export function billionsToVal(b) {
  return b * 1e9;
}

export function parseAsOfDate(asOf) {
  if (!asOf) return null;
  const m = String(asOf).match(/^(\d{4})-(\d{2})(?:-(\d{2}))?/);
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3] || 1);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return new Date(year, month - 1, day);
}

export function daysSinceAsOf(asOf, now = new Date()) {
  const then = parseAsOfDate(asOf);
  if (!then) return null;
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((today - then) / 86_400_000);
}

export function stalenessLevel(asOf, now = new Date()) {
  const days = daysSinceAsOf(asOf, now);
  if (days == null) return "unknown";
  if (days > 180) return "red";
  if (days > 90) return "amber";
  return "ok";
}
