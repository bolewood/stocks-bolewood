export const SCHEMA_VERSION = "1.2.0";
export const METHODOLOGY_VERSION = "1.2.0";
export const PRIVATE_TAPE_SCHEMA_VERSION = "1.0.0";

export const BASES = [
  "disclosed",
  "pro-forma",
  "historical",
  "filed-fv-equiv",
  "filed-units",
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
  "filed-units",
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
  if (!["primary", "secondary", "assumption"].includes(src.sourceClass)) {
    fail(path, "sourceClass must be primary, secondary or assumption");
  }
  if (!isHttpUrl(src.url) && !/^\d{10}-\d{2}-\d{6}$/.test(src.accession || '')) fail(path, 'source URL or resolvable accession required');
  if (!isMeasurementDate(src.measurementDate)) fail(path, 'measurementDate required (YYYY-MM or YYYY-MM-DD)');
  if (src.publicationDate != null && !isMeasurementDate(src.publicationDate)) fail(path, 'invalid publicationDate');
  if (src.sourceClass === 'assumption' && !src.estimationMethod) fail(path, 'assumption estimationMethod required');
}

function isMeasurementDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}(-\d{2})?$/.test(value)) return false;
  const full = value.length === 7 ? value + '-01' : value;
  const date = new Date(full + 'T00:00:00Z');
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === full;
}

function isIsoDateKey(value) {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function isHttpUrl(value) {
  if (typeof value !== "string") return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
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
    case "filed-units":
      if (!Number.isFinite(leg.filedUnits) || !(leg.filedUnits > 0)) fail(path, "filedUnits required");
      if (!isMeasurementDate(leg.unitsAsOf || leg.fairValueAsOf)) fail(path, "unitsAsOf required");
      if (leg.reportedFairValue != null && (!(leg.reportedFairValue > 0) || !isMeasurementDate(leg.fairValueAsOf))) fail(path, 'USD fair value requires a value and fairValueAsOf');
      if (leg.acquisition) {
        if (!Number.isFinite(leg.acquisition.costUsd) || !(leg.acquisition.costUsd > 0) || !isMeasurementDate(leg.acquisition.date) || !leg.acquisition.entryPriceModel) fail(path, 'invalid acquisition assumption');
      }
      if (typeof leg.carriedInterestPct !== "number" || leg.carriedInterestPct < 0) {
        fail(path, "carriedInterestPct required (>= 0)");
      }
      if (leg.measurementCompanyMark) {
        fail(path, "filed-units must not carry measurementCompanyMark");
      }
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

export function validateWrapper(wrapper, { marks, capitalization } = {}) {
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
  } else if (wrapper.filedSnapshot?.sharesOutstanding > 0) {
    // DXYZ: filed share count from the N-CSRS; do not infer from rounded NAV.
  } else if (wrapper.filedSnapshot?.netAssets > 0 && wrapper.filedSnapshot?.navPerShare > 0) {
    fail(t, "filedSnapshot.sharesOutstanding required (do not infer shares from rounded NAV)");
  } else {
    fail(t, "shareCount or totalNetAssets or filedSnapshot required");
  }

  if (wrapper.denominatorType === "adr-equivalent-market-cap" && !wrapper.adrRatio) {
    fail(t, "adrRatio required for adr-equivalent-market-cap");
  }

  validateLeg(wrapper.anthropic, `${t}.anthropic`, { company: "anthropic" });
  validateLeg(wrapper.openai, `${t}.openai`, { company: "openai" });
  if (capitalization) {
    validateCapitalization(capitalization);
    for (const side of ['anthropic', 'openai']) {
      if (wrapper[side]?.basis === 'filed-units' && !capitalization[side]?.method) fail(t, `${side} FD model required`);
      if (wrapper[side]?.acquisition?.entryPriceModel && wrapper[side].acquisition.entryPriceModel !== 'dxyz-openai-august-entry') fail(t, 'unknown acquisition entry-price model');
    }
  }

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

export function validateCapitalization(config) {
  if (config?.schemaVersion !== SCHEMA_VERSION || config.methodologyVersion !== METHODOLOGY_VERSION) fail('capitalization', 'version mismatch');
  if (!isMeasurementDate(config.asOf)) fail('capitalization', 'asOf required');
  for (const side of ['anthropic', 'openai', 'dxyzOpenaiEntry']) {
    const item = config[side];
    const suffix = side === 'dxyzOpenaiEntry' ? 'Price' : 'Shares';
    for (const key of ['min', 'low', 'default', 'high', 'max']) {
      if (!Number.isFinite(item?.[key + suffix]) || item[key + suffix] <= 0) fail(side, 'finite positive assumptions required');
    }
    if (!(item['min'+suffix] <= item['low'+suffix] && item['low'+suffix] <= item['default'+suffix] && item['default'+suffix] <= item['high'+suffix] && item['high'+suffix] <= item['max'+suffix])) fail(side, 'assumptions must be ordered');
    if (!item.method || !item.sources?.length) fail(side, 'method and sources required');
    item.sources.forEach((s,i) => validateSource(s, `${side}.sources[${i}]`));
  }
}

export function validatePrivateTapeConfig(config) {
  const path = "private-tape";
  if (config?.schemaVersion !== PRIVATE_TAPE_SCHEMA_VERSION) {
    fail(path, `schemaVersion must be ${PRIVATE_TAPE_SCHEMA_VERSION}`);
  }
  if (typeof config.methodologyVersion !== "string" || config.methodologyVersion.length === 0) {
    fail(path, "methodologyVersion required");
  }
  if (!isIsoDateKey(config.asOf)) fail(path, "asOf must be YYYY-MM-DD");
  if (!(config.dxyzFiledPortfolioValue > 0)) {
    fail(path, "dxyzFiledPortfolioValue required");
  }
  if (!config.modeledAssetsNote) fail(path, "modeledAssetsNote required");
  if (!config.marketStructureNote) fail(path, "marketStructureNote required");

  const expectedCoins = {
    anthropic: "io:ANTH",
    spacex: "xyz:SPCX",
  };
  const expectedTapeRoles = {
    anthropic: "private_pre_ipo_perp",
    spacex: "public_equity_perp",
  };
  const quoteUnits = new Set(["usd_billions_implied_valuation", "usd_per_share"]);
  for (const key of ["anthropic", "spacex"]) {
    const asset = config.assets?.[key];
    const assetPath = `${path}.assets.${key}`;
    if (!asset || typeof asset !== "object") fail(assetPath, "asset required");
    if (!asset.name) fail(assetPath, "name required");
    if (asset.hyperliquidCoin !== expectedCoins[key]) {
      fail(assetPath, `hyperliquidCoin must be ${expectedCoins[key]}`);
    }
    if (asset.tapeRole !== expectedTapeRoles[key]) {
      fail(assetPath, `tapeRole must be ${expectedTapeRoles[key]}`);
    }
    if (!quoteUnits.has(asset.quoteUnit)) fail(assetPath, `unknown quoteUnit ${asset.quoteUnit}`);
    if (!(asset.filedPortfolioWeight > 0 && asset.filedPortfolioWeight < 1)) {
      fail(assetPath, "filedPortfolioWeight must be between 0 and 1");
    }
    if (!(asset.filedExposureUsd > 0)) fail(assetPath, "filedExposureUsd required");
    if (!asset.source) fail(assetPath, "source required");

    const expectedExposure = config.dxyzFiledPortfolioValue * asset.filedPortfolioWeight;
    if (Math.abs(expectedExposure - asset.filedExposureUsd) > 1) {
      fail(assetPath, "filedExposureUsd must match filedPortfolioWeight times portfolio value");
    }
  }

  const spacexListing = config.assets.spacex.publicListing;
  if (
    !spacexListing ||
    spacexListing.ticker !== "SPCX" ||
    !isIsoDateKey(spacexListing.firstTradeDate) ||
    !(spacexListing.ipoPrice > 0) ||
    !(spacexListing.sharesOffered > 0)
  ) {
    fail(`${path}.assets.spacex.publicListing`, "SPCX listing details required");
  }
  if (!config.assets.spacex.navReadThroughNote) {
    fail(`${path}.assets.spacex.navReadThroughNote`, "NAV lag note required");
  }

  const requiredSources = [
    "dxyzNport",
    "dxyz424b3",
    "hyperliquidInfoApi",
    "hyperliquidRobustPrices",
    "hyperliquidHip3",
    "kucoinEntropyContext",
    "spacexIpoPricing",
    "nasdaqSpacexListing",
  ];
  for (const key of requiredSources) {
    if (!isHttpUrl(config.sources?.[key])) {
      fail(`${path}.sources.${key}`, "valid source URL required");
    }
  }
}

export function secondaryOnly(leg) {
  if (!leg?.sources?.length) return false;
  return !hasPrimary(leg.sources);
}
