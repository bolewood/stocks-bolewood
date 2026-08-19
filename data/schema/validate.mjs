export const SCHEMA_VERSION = "1.0.0";
export const METHODOLOGY_VERSION = "1.0.0";

export const BASES = [
  "disclosed",
  "pro-forma",
  "historical",
  "filed-fv-equiv",
  "carrying-value-equiv",
  "round-implied",
  "commitment",
  "estimate",
];

export const PRIMARY_REQUIRED_BASES = [
  "disclosed",
  "pro-forma",
  "historical",
  "filed-fv-equiv",
  "carrying-value-equiv",
  "round-implied",
];

export const HOLDING_SECURITIES = [
  "common",
  "preferred",
  "convertible",
  "spv-interest",
  "fund-interest",
  "mixed",
  "unknown",
];

export const WRAPPER_TYPES = [
  "operating-company",
  "closed-end-fund",
  "interval-fund",
  "holding-company",
  "adr",
  "etf",
  "unknown",
];

export const DENOMINATOR_TYPES = [
  "market-cap",
  "adr-equivalent-market-cap",
  "total-net-assets",
  "unknown",
];

function fail(path, msg) {
  throw new Error(`${path}: ${msg}`);
}

function hasPrimary(sources) {
  return (sources || []).some((s) => s.sourceClass === "primary");
}

function validateSource(src, path) {
  if (!src || typeof src !== "object") fail(path, "source must be an object");
  if (!Array.isArray(src.fields) || src.fields.length === 0) {
    fail(path, "source.fields must be a non-empty array");
  }
  if (src.sourceClass !== "primary" && src.sourceClass !== "secondary") {
    fail(path, "sourceClass must be primary or secondary");
  }
}

function validateLeg(leg, path, { company }) {
  if (leg == null) return;
  if (typeof leg !== "object") fail(path, "leg must be an object");
  if (Object.prototype.hasOwnProperty.call(leg, "value")) {
    fail(path, "generic 'value' field is forbidden");
  }
  if (Object.prototype.hasOwnProperty.call(leg, "impliedExposure")) {
    fail(path, "impliedExposure must live under computed.*, never as a sibling of inputs");
  }
  if (leg.computed && Object.prototype.hasOwnProperty.call(leg, "impliedExposure")) {
    fail(path, "hand-authored impliedExposure next to inputs is forbidden");
  }
  if (!BASES.includes(leg.basis)) fail(path, `unknown basis ${leg.basis}`);
  if (!HOLDING_SECURITIES.includes(leg.holdingSecurity)) {
    fail(path, `unknown holdingSecurity ${leg.holdingSecurity}`);
  }
  if (!Array.isArray(leg.sources) || leg.sources.length === 0) {
    fail(path, "leg must have sources[]");
  }
  leg.sources.forEach((s, i) => validateSource(s, `${path}.sources[${i}]`));

  if (PRIMARY_REQUIRED_BASES.includes(leg.basis) && !hasPrimary(leg.sources)) {
    fail(
      path,
      `${leg.basis} requires at least one primary source; secondary-only is allowed only for estimate, and for commitment when no primary announcement exists`
    );
  }

  switch (leg.basis) {
    case "disclosed":
    case "pro-forma":
    case "historical":
      if (!(leg.ownershipPct > 0)) fail(path, "ownershipPct required");
      if (!leg.ownershipAsOf) fail(path, "ownershipAsOf required");
      break;
    case "estimate":
      if (!(leg.estimatedOwnershipPct > 0)) fail(path, "estimatedOwnershipPct required");
      if (!leg.estimateAsOf) fail(path, "estimateAsOf required");
      if (!leg.methodology) fail(path, "methodology required");
      break;
    case "filed-fv-equiv":
      if (!(leg.reportedFairValue > 0)) fail(path, "reportedFairValue required");
      if (!leg.fairValueAsOf) fail(path, "fairValueAsOf required");
      if (!leg.measurementCompanyMark) fail(path, "measurementCompanyMark required");
      if (!leg.measurementMarkAsOf) fail(path, "measurementMarkAsOf required");
      break;
    case "carrying-value-equiv":
      if (!(leg.reportedCarryingValue > 0)) fail(path, "reportedCarryingValue required");
      if (!leg.carryingValueAsOf) fail(path, "carryingValueAsOf required");
      if (!leg.measurementCompanyMark) fail(path, "measurementCompanyMark required");
      if (!leg.measurementMarkAsOf) fail(path, "measurementMarkAsOf required");
      break;
    case "round-implied":
      if (!(leg.investmentAmount > 0)) fail(path, "investmentAmount required");
      if (!leg.investmentAsOf) fail(path, "investmentAsOf required");
      if (!leg.roundPostMoneyValuation) fail(path, "roundPostMoneyValuation required");
      break;
    case "commitment":
      if (leg.ownershipPct) fail(path, "commitment must not carry ownershipPct");
      if (!leg.commitmentAsOf) fail(path, "commitmentAsOf required");
      if (!leg.status) fail(path, "status required");
      break;
    default:
      break;
  }

  if (company && !["anthropic", "openai"].includes(company)) {
    fail(path, `unexpected company ${company}`);
  }
}

export function validateWrapper(wrapper, { marks } = {}) {
  const t = wrapper?.ticker || "?";
  if (wrapper.schemaVersion !== SCHEMA_VERSION) {
    fail(t, `schemaVersion must be ${SCHEMA_VERSION}`);
  }
  if (wrapper.methodologyVersion !== METHODOLOGY_VERSION) {
    fail(t, `methodologyVersion must be ${METHODOLOGY_VERSION}`);
  }
  if (!wrapper.ticker || !wrapper.yahooSymbol || !wrapper.name) {
    fail(t, "ticker, yahooSymbol, name required");
  }
  if (!WRAPPER_TYPES.includes(wrapper.wrapperType)) {
    fail(t, `unknown wrapperType ${wrapper.wrapperType}`);
  }
  if (!DENOMINATOR_TYPES.includes(wrapper.denominatorType)) {
    fail(t, `unknown denominatorType ${wrapper.denominatorType}`);
  }
  if (!Array.isArray(wrapper.sources) || wrapper.sources.length === 0) {
    fail(t, "wrapper.sources[] required");
  }
  wrapper.sources.forEach((s, i) => validateSource(s, `${t}.sources[${i}]`));

  if (wrapper.denominatorType === "total-net-assets") {
    if (!(wrapper.totalNetAssets?.value > 0) || !wrapper.totalNetAssets?.asOf) {
      fail(t, "totalNetAssets.value and asOf required");
    }
  } else if (wrapper.shareCount) {
    if (!(wrapper.shareCount.value > 0) || !wrapper.shareCount.asOf) {
      fail(t, "shareCount.value and asOf required");
    }
  } else if (wrapper.filedSnapshot?.netAssets > 0 && wrapper.filedSnapshot?.navPerShare > 0) {
    // DXYZ: shares are implied by filed NAV.
  } else {
    fail(t, "shareCount or totalNetAssets or filedSnapshot required");
  }

  if (wrapper.denominatorType === "adr-equivalent-market-cap" && !wrapper.adrRatio) {
    fail(t, "adrRatio required for adr-equivalent-market-cap");
  }

  validateLeg(wrapper.anthropic, `${t}.anthropic`, { company: "anthropic" });
  validateLeg(wrapper.openai, `${t}.openai`, { company: "openai" });

  if (marks) {
    for (const leg of [wrapper.anthropic, wrapper.openai]) {
      if (!leg) continue;
      const markId = leg.measurementCompanyMark || leg.roundPostMoneyValuation;
      if (markId) {
        const found = Object.values(marks.companies || {}).some((c) =>
          (c.rounds || []).some((r) => r.id === markId)
        );
        if (!found) fail(t, `unknown mark id ${markId}`);
      }
    }
  }
}

export function validateMarks(marks) {
  if (marks.schemaVersion !== SCHEMA_VERSION) {
    fail("marks", `schemaVersion must be ${SCHEMA_VERSION}`);
  }
  if (!marks.companies?.anthropic || !marks.companies?.openai) {
    fail("marks", "companies.anthropic and companies.openai required");
  }
  for (const [name, company] of Object.entries(marks.companies)) {
    (company.rounds || []).forEach((r, i) => {
      const path = `marks.${name}.rounds[${i}]`;
      if (!r.id || !(r.postMoney > 0)) fail(path, "id and postMoney required");
      if (!Array.isArray(r.sources) || r.sources.length === 0) {
        fail(path, "sources[] required");
      }
      r.sources.forEach((s, j) => validateSource(s, `${path}.sources[${j}]`));
    });
  }
}

export function secondaryOnly(leg) {
  if (!leg?.sources?.length) return false;
  return !hasPrimary(leg.sources);
}
