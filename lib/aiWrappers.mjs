// Anthropic / OpenAI look-through math. Curated wrapper records come from
// data/ via loadAiData.mjs — this module must not define ticker-specific
// financial inputs. Live data is price only (Yahoo v8 chart).

export {
  ANTHROPIC_ROUND_FEB_2026,
  ANTHROPIC_ROUND_SERIES_H,
  ARKVX_CLASS_D_SO,
  ARKVX_CLASS_D_SO_ASOF,
  ARKVX_NPORT_ASOF,
  ARKVX_NPORT_TNA,
  LAST_PRIMARY_ROUNDS,
  OPENAI_ROUND_FEB_2026,
  OPENAI_ROUND_MAR_2026,
  VCX_FILED_NAV,
  VCX_FILED_NET_ASSETS,
  VCX_LISTED,
  WRAPPERS,
} from "./loadAiData.mjs";

import {
  ANTHROPIC_ROUND_SERIES_H,
  LAST_PRIMARY_ROUNDS,
  OPENAI_ROUND_MAR_2026,
  WRAPPERS,
} from "./loadAiData.mjs";


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

export const WRAPPER_TICKERS = WRAPPERS.map((w) => w.yahooSymbol);

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
