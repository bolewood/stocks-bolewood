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

export const DEFAULT_ANTH_VAL = ANTHROPIC_ROUND_SERIES_H; // 1.0x Series H $965B
export const DEFAULT_OAI_VAL = OPENAI_ROUND_MAR_2026; // 1.0x Mar 2026 primary $852B
export const DEFAULT_DILUTION = 0;

// Explicit $1.0T / $1.25T pair used only in tests that pin the Aug 7 table.
export const PIN_ANTH_1T = 1_000_000_000_000;
export const PIN_OAI_1_25T = 1_250_000_000_000;

export const SLIDER_BOUNDS = {
  anth: { min: 500, max: 5000, step: 50 }, // $B = $0.5T–$5.0T, step $0.05T
  oai: { min: 500, max: 5000, step: 50 },
  dil: { min: 0, max: 30, step: 1 }, // %
};

// Log-mapped IPO sliders so $0.85T / $0.97T aren't crushed into the left 10%.
export const SLIDER_T_MIN = 0.5;
export const SLIDER_T_MAX = 5.0;
export const SLIDER_T_STEP = 0.05;
export const LOG_SLIDER_STEPS = 1000;

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
  premium: "premium",
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
  premium: "premium",
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

// ARKVX NPORT-EX schedule as of 2026-04-30: Net Assets–100.0% $871,119,657.
// Holdings FVs below are from the same schedule. NPORT-P XML netAssets is
// $862,446,918.77 — a different line; do not mix the two.
export const ARKVX_NPORT_TNA = 871_119_657;
export const ARKVX_NPORT_ASOF = "2026-04-30";
// Class D published SO as of 2026-07-31 — used only as a current-assets proxy
// (SO × live Class D NAV) for the cash end of the deploy range. Not fund TNA.
export const ARKVX_CLASS_D_SO = 21_613_728;
export const ARKVX_CLASS_D_SO_ASOF = "2026-07-31";

// SK Telecom 20-F / 6-K: 212,982,275 ordinary outstanding net of treasury
// as of 2025-12-31. Citi depositary: each ADS (NYSE: SKM) represents 5/9 of
// one ordinary share. ADS-equivalent = 212,982,275 × 9/5 = 383,368,095.
const SKM_ORDINARY = 212_982_275;
const SKM_ADS_EQUIV = (SKM_ORDINARY * 9) / 5;

function corporateLeg(ownershipPct, extras = {}) {
  const kind = extras.kind || "equity";
  if (kind !== "commitment" && !(ownershipPct > 0) && !extras.investmentUsd) {
    return null;
  }
  return { kind, ownershipPct: ownershipPct || null, ...extras };
}

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
    sharesOutstanding: 12_230_000_000, // Class A+B+C; 10-Q period ended 2026-06-30
    sharesAsOf: "2026-06-30",
    sharesNote: "Class A 5,868M + B 835M + C 5,527M = 12,230M (10-Q 2026-06-30). GOOG price × all classes ≈ Alphabet market cap.",
    denomKind: "marketCap",
    anthropic: corporateLeg(0.14, {
      basis: "historical",
      displayAsMax: true,
      capPct: 0.15,
      confidence: "medium",
      asOf: "2025-03-11",
      markAsOf: "2025-03-11",
      source: "NYT / court docs; 15% cap, non-voting. 10-Q does not name Anthropic. Later rounds may have diluted.",
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
    denomKind: "marketCap",
    anthropic: fundLeg(190_400_000_000, ANTHROPIC_ROUND_SERIES_H, {
      basis: "filedFv",
      confidence: "medium",
      asOf: "2026-06-30",
      markAsOf: "2026-05-28",
      source:
        "AMZN 10-Q as of 2026-06-30: nonvoting preferred $92.5B + convertible notes FV $97.9B = $190.4B. $190.4B ÷ Series H $965B ≈ 19.73% equivalent, not issuer-disclosed ownership. Conversion terms and the ownership cap are undisclosed. $100B AWS is not equity.",
    }),
    openai: {
      kind: "round-implied",
      basis: "roundImplied",
      investmentUsd: 50_000_000_000,
      roundVal: OPENAI_ROUND_MAR_2026,
      ownershipPct: 50_000_000_000 / OPENAI_ROUND_MAR_2026,
      confidence: "medium",
      asOf: "2026-06-30",
      markAsOf: "2026-03-31",
      source:
        "AMZN 10-Q: $15.0B Series C in Q1 + $13.7B in Q2 = $28.7B on the 2026-06-30 balance sheet; subsequent event funded the remaining $21.3B, completing $50B. $50B ÷ $852B ≈ 5.87%. Not Amazon's disclosed ownership %. $100B AWS is not equity.",
    },
    confidence: "medium",
    note: "Anthropic is filed carrying-value equivalent, not an ownership %. OpenAI is round-implied from the $50B Series C.",
    security: {
      label: "Conv + Pfd",
      linear: false,
      footnote:
        "Anthropic: $92.5B preferred + $97.9B convertible notes (AMZN 10-Q as of 2026-06-30). Conversion terms undisclosed.",
    },
  },
  {
    ticker: "MSFT",
    yahooSymbol: "MSFT",
    name: "Microsoft Corporation",
    type: "Strategic",
    sharesOutstanding: 7_428_434_704, // 10-Q as of 2026-04-23
    sharesAsOf: "2026-04-23",
    denomKind: "marketCap",
    anthropic: corporateLeg(null, {
      kind: "commitment",
      basis: "commitment",
      contributePer100: false,
      showPct: false,
      confidence: "low",
      asOf: "2025-11",
      source: "Capital committed to Anthropic; ownership percentage not disclosed. No per-$100 is computed from an undisclosed %.",
    }),
    openai: corporateLeg(0.27, {
      basis: "disclosed",
      confidence: "high",
      asOf: "2026-03-31",
      markAsOf: "2026-03-31",
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
    denomKind: "adrMarketCap",
    sharesNote:
      "Issuer-equivalent ADR shares (2× Tokyo common). Citi ORD:DR is 1:2 — each SFTBY ADR is ½ of one 9984.T share. Tokyo common 5,698,923,701 (issued 5,711,848,120 − treasury 12,924,419) as of 2026-03-31. OTC ADR prints ~½ the USD-converted 9984.T price, so 2× common × ADR quote ≈ full-issuer cap.",
    anthropic: null,
    openai: corporateLeg(0.13, {
      basis: "proforma",
      confidence: "high",
      asOf: "2026-02-27",
      markAsOf: "2026-02-27",
      source:
        "SoftBank: ~13% upon completion of the investment program ($64.6B by 2026-10-01), not current funded ownership. ~$55B in as of Aug 2026; last $10B tranche due 2026-10-01.",
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
      body: "NAV ¥58.3T vs market cap ¥31.46T ≈ 46% discount (pro forma 2026-08-05). Arm is ~60% of holdings (¥49.91T / ¥83.11T, SBG Q1 FY2026 data sheet 2026-06-30); Vision Funds (SVF1+SVF2+LatAm) ~28.8%; SoftBank Corp. ¥2.79T; T-Mobile adjusted to ~0 after asset-backed finance. LTV 13% against a 25% policy cap, plus a recent $40B bridge loan and $10B margin loan secured by the OpenAI stake. The high per-$100 reflects the NAV discount, not OpenAI concentration. SBG's OpenAI exposure sits partly inside SVF2 — do not double-count it against the Vision Fund line.",
    },
  },
  {
    ticker: "NVDA",
    yahooSymbol: "NVDA",
    name: "NVIDIA Corporation",
    type: "Strategic",
    sharesOutstanding: 24_300_000_000, // 10-K as of 2026-02-20
    sharesAsOf: "2026-02-20",
    denomKind: "marketCap",
    anthropic: corporateLeg(null, {
      kind: "commitment",
      basis: "commitment",
      contributePer100: false,
      showPct: false,
      investmentUsd: 10_000_000_000,
      confidence: "low",
      asOf: "2025-11",
      source:
        "Up to $10B Anthropic commitment (Huang / Nov 2025 announcement). Not an NVDA 10-K ownership %. No percentage is shown.",
    }),
    openai: {
      kind: "round-implied",
      basis: "roundImplied",
      investmentUsd: 30_000_000_000,
      roundVal: OPENAI_ROUND_MAR_2026,
      ownershipPct: 30_000_000_000 / OPENAI_ROUND_MAR_2026,
      confidence: "low",
      asOf: "2026-02-27",
      markAsOf: "2026-03-31",
      source:
        "OpenAI 2026-02-27 round announcement: Nvidia invested $30B. $30B ÷ $852B ≈ 3.52% round-implied, not an NVDA 10-K ownership %.",
    },
    confidence: "low",
    note: "Neither figure is an NVDA-disclosed ownership percentage.",
    security: {
      label: "Undisclosed",
      linear: true,
      footnote: "OpenAI is round-implied from OpenAI's $30B announcement. Anthropic is a commitment with no ownership %.",
    },
  },
  {
    ticker: "SKM",
    yahooSymbol: "SKM",
    name: "SK Telecom Co.",
    type: "Strategic",
    // 20-F / 6-K: 212,982,275 ordinary net of treasury as of 2025-12-31.
    // ADS ratio 5/9 (Citi; 20-F cover). ADS-equivalent = 212,982,275 × 9/5.
    sharesOutstanding: SKM_ADS_EQUIV,
    sharesAsOf: "2025-12-31",
    denomKind: "adrMarketCap",
    sharesNote:
      "ADS-equivalent so SKM USD price × shares ≈ SK Telecom cap. 212,982,275 ordinary outstanding (20-F / 6-K as of 2025-12-31, net of 1,807,778 treasury) ÷ (5/9) = 383,368,095 ADS. Seoul listing is 017670.KS.",
    anthropic: corporateLeg(0.003, {
      basis: "estimate",
      confidence: "low",
      asOf: "2026-06",
      pctLow: 0.003,
      pctHigh: 0.007,
      source:
        "Analyst estimate ~0.30% (Aug 7 table / Hana). Not issuer-disclosed. Undisclosed H follow-on (Jun 2026).",
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
    denomKind: "marketCap",
    anthropic: fundLeg(1_266_900_000, ANTHROPIC_ROUND_FEB_2026, {
      basis: "carrying",
      confidence: "medium",
      asOf: "2026-04-30",
      markAsOf: "2026-02-12",
      source:
        "10-Q: $1,266.9M carrying value after +$46M, marked to the Feb 12, 2026 round (~$380B) ≈ 0.3334%. Not disclosed ownership.",
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
    denomKind: "marketCap",
    sharesNote: "ETF share count drifts with creations/redemptions.",
    anthropic: fundLeg(12_926_025, ANTHROPIC_ROUND_SERIES_H, {
      basis: "filedFv",
      confidence: "high",
      asOf: "2026-08-18",
      source:
        "KraneShares holdings: Anthropic PBC $12,926,025 (1.92% of NAV). Point estimate is the latest holdings-page FV. NAV weight has printed ~1.9–2.8% (Mar 31 report 2.7%; Jul 31 blog 2.82%). Marked to Series H ~$965B.",
    }),
    openai: null,
    confidence: "high",
    note: "Not the SingularityNET token. No OpenAI in disclosed holdings. Public-Private AI ETF: Anthropic is a small NAV sleeve (~1.9–2.8%), which is why look-through is a few dollars per $100.",
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
    sharesOutstanding: impliedMarch31Shares(), // FILED 2026-03-31; ESTIMATED uses computeAtmBridge
    sharesAsOf: "2026-03-31",
    denomKind: "marketCap",
    sharesNote:
      "FILED: implied by $748.36M / $24.56 (N-PORT 2026-03-31). ESTIMATED: /dxyz ATM bridge (same computeAtmBridge). Active ATM.",
    anthropic: fundLeg(DXYZ_ANTH_FV, ANTHROPIC_ROUND_FEB_2026, {
      basis: "filedFv",
      confidence: "high",
      asOf: "2026-03-31",
      source:
        "18.1% of $742.5M portfolio (Magnitude ANC III SPV) marked at the Feb 2026 ~$380B round.",
    }),
    openai: fundLeg(DXYZ_OAI_SERIES_C_FV, OPENAI_ROUND_FEB_2026, {
      basis: "filedFv",
      confidence: "low",
      asOf: "2026-03-31",
      source:
        "4.7% Goanna Series C SPV only. 1.0% DXYZ OAI I PPUs are not equity (N-CSR) and are excluded from IPO scaling.",
    }),
    confidence: "medium",
    note: "OpenAI PPUs excluded from the scaled numerator. Confidence is MEDIUM: ATM issuance is estimated, not filed.",
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
    sharesOutstanding: ARKVX_CLASS_D_SO, // Class D SO; denominator is TNA, not this
    sharesAsOf: ARKVX_NPORT_ASOF,
    denomKind: "netAssets",
    snapshotNote: "Snapshot as of 2026-04-30 — not live",
    sharesNote:
      "Unlisted interval fund, multiple share classes. Denominator is NPORT-EX total net assets $871,119,657 as of 2026-04-30 (same schedule as the holdings). Class D SO 21,613,728 as of 2026-07-31 is a current-assets proxy only (× live Class D NAV) for the cash end of the deploy range — it is not fund TNA.",
    anthropic: fundLeg(23_083_673, ANTHROPIC_ROUND_FEB_2026, {
      basis: "filedFv",
      confidence: "medium",
      asOf: "2026-04-30",
      markAsOf: "2026-02-12",
      source:
        "NPORT-EX: Anthropic, Inc. Series C-1 $23,083,673. Same schedule TNA $871,119,657.",
    }),
    openai: fundLeg(72_512_628, OPENAI_ROUND_MAR_2026, {
      basis: "filedFv",
      confidence: "medium",
      asOf: "2026-04-30",
      markAsOf: "2026-03-31",
      source:
        "NPORT-EX: OpenAI lots $7,321,148 + $11,205,221 + $49,999,651 + SPV $3,986,608 = $72,512,628. Marked to Mar 2026 $852B post-money.",
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
    sharesOutstanding: 35_797_138, // audited 2026-03-31; listed CEF, no post-listing ATM
    sharesAsOf: "2026-03-31",
    denomKind: "marketCap",
    sharesNote:
      "35,797,138 common (N-CSR/A 2026-03-31). Converted from a tender-offer fund to a listed CEF on 2026-03-19 (NYSE: VCX). Continuous offering did not continue post-listing — share count held stable. ESTIMATED rolls Anthropic/OpenAI marks from the Feb 2026 rounds to last primary post-money; other holdings stay at 3/31.",
    anthropic: fundLeg(112_418_000, ANTHROPIC_ROUND_FEB_2026, {
      basis: "filedFv",
      confidence: "high",
      asOf: "2026-03-31",
      source: "N-CSR/A: Anthropic, PBC $112,418k — 16.5% of net assets.",
    }),
    openai: fundLeg(84_163_000, OPENAI_ROUND_FEB_2026, {
      basis: "filedFv",
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
  if (leg.kind === "commitment" || leg.contributePer100 === false) return 0;
  if (leg.kind === "fund" || leg.kind === "carrying") {
    return fundClaimPct(leg.fairValue, leg.roundVal);
  }
  if (leg.kind === "round-implied") {
    return fundClaimPct(leg.investmentUsd, leg.roundVal);
  }
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
  const basisRaw = (params.get("basis") || "").toLowerCase();
  const basis = basisRaw === "filed" ? "filed" : "estimated";
  const deployRaw = (params.get("deploy") || "").toLowerCase();
  const deploy =
    deployRaw === "cash" || deployRaw === "prorata" ? deployRaw : "range";
  return { anthB, oaiB, dilutionPct, sortKey, basis, deploy };
}

export function serializeScenarioSearch({
  anthB,
  oaiB,
  dilutionPct,
  sortKey,
  basis = "estimated",
  deploy = "range",
}) {
  const params = new URLSearchParams();
  params.set("anth", String(anthB));
  params.set("oai", String(oaiB));
  params.set("dil", String(dilutionPct));
  params.set("basis", basis === "filed" ? "filed" : "estimated");
  params.set("deploy", deploy === "cash" || deploy === "prorata" ? deploy : "range");
  params.set("sort", SORT_QUERY_SHORT[sortKey] || "combined");
  return params.toString();
}

export function valToBillions(v) {
  return Math.round(v / 1e9);
}

export function billionsToVal(b) {
  return b * 1e9;
}

export function billionsToTrillions(b) {
  return b / 1000;
}

export function trillionsToBillions(t) {
  return Math.round(t * 1000);
}

export function snapTrillions(t) {
  const snapped = Math.round(t / SLIDER_T_STEP) * SLIDER_T_STEP;
  return Math.min(
    SLIDER_T_MAX,
    Math.max(SLIDER_T_MIN, Number(snapped.toFixed(2)))
  );
}

// Display $T with 2 decimals on the $0.05T grid, 3 if the value is an exact
// last-round (e.g. 0.965T) that isn't on that grid.
export function fmtSliderTrillions(billions) {
  const t = billionsToTrillions(billions);
  const onStep =
    Math.abs(t / SLIDER_T_STEP - Math.round(t / SLIDER_T_STEP)) < 1e-6;
  return onStep ? t.toFixed(2) : t.toFixed(3);
}

export function logPosFromBillions(billions) {
  const t = Math.min(
    SLIDER_T_MAX,
    Math.max(SLIDER_T_MIN, billionsToTrillions(billions))
  );
  return Math.round(
    (Math.log(t / SLIDER_T_MIN) / Math.log(SLIDER_T_MAX / SLIDER_T_MIN)) *
      LOG_SLIDER_STEPS
  );
}

export function billionsFromLogPos(pos) {
  const clamped = Math.min(LOG_SLIDER_STEPS, Math.max(0, Number(pos) || 0));
  const t =
    SLIDER_T_MIN *
    Math.pow(SLIDER_T_MAX / SLIDER_T_MIN, clamped / LOG_SLIDER_STEPS);
  return trillionsToBillions(snapTrillions(t));
}

export function lastRoundTickPct(postMoneyUsd) {
  return (logPosFromBillions(valToBillions(postMoneyUsd)) / LOG_SLIDER_STEPS) * 100;
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
