export const SCHEMA_VERSION = "1.2.0";
export const METHODOLOGY_VERSION = "1.2.0";
export const PRIVATE_TAPE_SCHEMA_VERSION = "1.0.0";
export const BOOK_SCHEMA_VERSION = "1.0.0";

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

export const BOOK_VEHICLE_TYPES = ["closed-end-fund", "interval-fund", "bdc", "etf"];
export const BOOK_WEIGHT_BASES = ["net-assets", "reported-portfolio"];
export const BOOK_PREMIUM_MODES = ["market", "none"];
export const BOOK_LINE_ROLES = ["holding", "other", "cash", "liability", "residual"];
export const BOOK_VALUATIONS = ["filed", "cost", "practical-expedient"];
export const BOOK_RECONCILE_TOLERANCE = 0.05;

const COMPANY_ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function validateCompanies(config) {
  const path = "companies";
  if (config?.schemaVersion !== BOOK_SCHEMA_VERSION) {
    fail(path, `schemaVersion must be ${BOOK_SCHEMA_VERSION}`);
  }
  if (!config.companies || typeof config.companies !== "object") {
    fail(path, "companies object required");
  }
  for (const [id, company] of Object.entries(config.companies)) {
    const item = `${path}.${id}`;
    if (!COMPANY_ID.test(id)) fail(item, "id must be kebab-case");
    if (!company || typeof company.name !== "string" || company.name.length === 0) {
      fail(item, "name required");
    }
    if (company.successor != null && !COMPANY_ID.test(company.successor)) {
      fail(item, "successor must be a company id");
    }
    if (company.publicTicker != null && typeof company.publicTicker !== "string") {
      fail(item, "publicTicker must be a string");
    }
  }
  for (const [id, company] of Object.entries(config.companies)) {
    if (!company.successor) continue;
    if (!config.companies[company.successor]) {
      fail(`${path}.${id}`, `unknown successor ${company.successor}`);
    }
    const seen = new Set();
    let cur = id;
    while (config.companies[cur]?.successor) {
      if (seen.has(cur)) fail(`${path}.${id}`, "successor cycle");
      seen.add(cur);
      cur = config.companies[cur].successor;
    }
  }
}

export function validateBook(book, { companies } = {}) {
  const path = book?.ticker || "book";
  if (book?.schemaVersion !== BOOK_SCHEMA_VERSION) {
    fail(path, `schemaVersion must be ${BOOK_SCHEMA_VERSION}`);
  }
  if (!book.ticker || !book.name || !book.yahooSymbol) {
    fail(path, "ticker, name, and yahooSymbol required");
  }
  if (!BOOK_VEHICLE_TYPES.includes(book.vehicleType)) {
    fail(path, `unknown vehicleType ${book.vehicleType}`);
  }
  if (!BOOK_WEIGHT_BASES.includes(book.weightBasis)) {
    fail(path, `unknown weightBasis ${book.weightBasis}`);
  }
  if (!BOOK_PREMIUM_MODES.includes(book.premiumMode)) {
    fail(path, `unknown premiumMode ${book.premiumMode}`);
  }
  if (book.vehicleType === "interval-fund" && book.premiumMode === "market") {
    fail(path, "interval-fund premiumMode must be none; class NAV is not a market premium");
  }
  if (!isIsoDateKey(book.measurementDate)) fail(path, "measurementDate required");
  if (!isIsoDateKey(book.publicationDate)) fail(path, "publicationDate required");
  const hasAccession = /^\d{10}-\d{2}-\d{6}$/.test(book.accession || "");
  if (!hasAccession) {
    const sourced = (book.sources || []).some((src) => src.sourceClass === "primary" && isHttpUrl(src.url));
    if (!sourced || !/^[a-z0-9-]+$/.test(book.sourceId || "")) {
      fail(path, "accession required, or a primary source URL plus sourceId");
    }
  }
  if (book.navAsOf != null && !isIsoDateKey(book.navAsOf)) fail(path, "invalid navAsOf");
  if (book.unknownDilution != null && typeof book.unknownDilution !== "boolean") {
    fail(path, "unknownDilution must be boolean");
  }
  if (book.unknownDilution && !book.dilutionNote) {
    fail(path, "dilutionNote required when dilution after the report is unknown");
  }
  if (Object.prototype.hasOwnProperty.call(book, "weight") || Object.prototype.hasOwnProperty.call(book, "impliedExposure")) {
    fail(path, "weight is computed from dollars or a reported percent, never stored on the snapshot");
  }
  if (!Array.isArray(book.sources) || book.sources.length === 0) fail(path, "sources[] required");
  book.sources.forEach((src, i) => validateSource(src, `${path}.sources[${i}]`));
  if (!hasPrimary(book.sources)) fail(path, "at least one primary source required");
  if (!Array.isArray(book.lines) || book.lines.length === 0) fail(path, "lines[] required");

  if (book.weightBasis === "net-assets") {
    if (!(book.netAssets > 0)) fail(path, "netAssets required");
    if (book.premiumMode === "market") {
      if (!(book.navPerShare > 0)) fail(path, "navPerShare required");
      if (!(book.sharesOutstanding > 0)) fail(path, "sharesOutstanding required");
      const implied = book.navPerShare * book.sharesOutstanding;
      if (Math.abs(implied - book.netAssets) / book.netAssets > 0.002) {
        fail(path, "navPerShare × shares diverges from net assets by more than 0.2%");
      }
    } else if (book.navPerShare != null || book.sharesOutstanding != null) {
      fail(path, "a fund priced at NAV does not store a per-share NAV beside total net assets");
    }
    let sum = 0;
    for (const [i, line] of book.lines.entries()) {
      validateBookLine(line, `${path}.lines[${i}]`, book, companies);
      sum += line.fairValue;
    }
    if (Math.abs(sum - book.netAssets) > BOOK_RECONCILE_TOLERANCE) {
      fail(path, `lines sum ${sum} must equal net assets ${book.netAssets}`);
    }
  } else {
    if (book.navPerShare != null || book.netAssets != null) {
      fail(path, "reported-portfolio snapshots do not carry a NAV; dollars per $100 stay withheld");
    }
    if (book.premiumMode !== "none") {
      fail(path, "reported-portfolio premiumMode must be none");
    }
    for (const [i, line] of book.lines.entries()) {
      validateBookLine(line, `${path}.lines[${i}]`, book, companies);
    }
  }
}

function validateBookLine(line, path, book, companies) {
  if (!line || typeof line !== "object") fail(path, "line must be an object");
  if (!COMPANY_ID.test(line.companyId || "")) fail(path, "companyId required");
  if (companies && !companies.companies?.[line.companyId]) {
    fail(path, `unknown company ${line.companyId}`);
  }
  if (!BOOK_LINE_ROLES.includes(line.role)) fail(path, `unknown role ${line.role}`);
  if (line.valuation != null && !BOOK_VALUATIONS.includes(line.valuation)) {
    fail(path, `unknown valuation ${line.valuation}`);
  }
  if ((line.valuation === "cost" || line.valuation === "practical-expedient") && !line.note) {
    fail(path, `${line.valuation} lines need a note`);
  }
  for (const banned of ["weight", "impliedExposure", "reportedWeightOfNav"]) {
    if (Object.prototype.hasOwnProperty.call(line, banned)) {
      fail(path, `${banned} is computed, not stored`);
    }
  }
  const hasFair = Object.prototype.hasOwnProperty.call(line, "fairValue");
  const hasReported = Object.prototype.hasOwnProperty.call(line, "reportedWeight");
  if (hasFair && hasReported) fail(path, "a line cannot carry both fairValue and reportedWeight");
  if (book.weightBasis === "net-assets") {
    if (!hasFair || !Number.isFinite(line.fairValue)) fail(path, "fairValue required");
    if (hasReported) fail(path, "net-assets lines store dollars, not a reported percent");
  } else {
    if (!hasReported || !Number.isFinite(line.reportedWeight)) fail(path, "reportedWeight required");
    if (hasFair) fail(path, "reported-portfolio lines do not store dollars");
  }
}
