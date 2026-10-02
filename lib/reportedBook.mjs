// Reported-book math. Weights are filed dollars ÷ that report's net assets,
// or a percent printed by the issuer. Nothing here re-marks a lot.

export const BOOK_VIEWS = ["nav", "price", "per100"];
export const BOOK_SORT_DIRS = ["asc", "desc"];

const ROLE_ORDER = { holding: 0, other: 1, cash: 2, liability: 3, residual: 4 };

export function columnSortValue(metrics, view) {
  if (!metrics) return null;
  if (view === "price") return metrics.weightOfPrice;
  if (view === "per100") return metrics.per100;
  return metrics.weightOfNav ?? metrics.reportedPortfolioWeight ?? null;
}

export function sortBookRows(rows, { key = "name", dir = "asc", view = "per100", funds = [] } = {}) {
  const direction = dir === "desc" ? -1 : 1;
  const fund = key === "name" ? null : funds.find((item) => item.ticker === key);
  const valueOf = (row) => {
    if (!fund) return null;
    const position = fund.positions.get(row.id);
    if (!position) return null;
    const metrics = positionMetrics(position, fund.snapshot, fund.price);
    const value = columnSortValue(metrics, view);
    return Number.isFinite(value) ? value : null;
  };
  return [...rows].sort((a, b) => {
    const roleDelta = (ROLE_ORDER[a.role] ?? 9) - (ROLE_ORDER[b.role] ?? 9);
    if (roleDelta) return roleDelta;
    if (key === "name" || !fund) {
      return direction * a.name.localeCompare(b.name, "en", { sensitivity: "base" });
    }
    const av = valueOf(a);
    const bv = valueOf(b);
    if (av == null && bv == null) return a.name.localeCompare(b.name, "en", { sensitivity: "base" });
    if (av == null) return 1;
    if (bv == null) return -1;
    if (av === bv) return a.name.localeCompare(b.name, "en", { sensitivity: "base" });
    return direction * (av - bv);
  });
}
export const BOOK_FUND_ORDER = ["DXYZ", "RVI", "BOT", "NSLR", "VCX", "ARKVX", "PIIVX", "PWRL"];
export const BOOK_PRICE_TICKERS = ["DXYZ", "RVI", "BOT", "NSLR", "VCX", "ARKVX", "PIIVX", "PWRL"];

const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;

export function canonicalCompanyId(id, companies = {}) {
  const seen = new Set();
  let cur = id;
  while (companies[cur]?.successor) {
    if (seen.has(cur)) return id;
    seen.add(cur);
    cur = companies[cur].successor;
  }
  return cur;
}

export function companyName(id, companies = {}) {
  return companies[id]?.name || id;
}

export function weightOfNetAssets(fairValue, netAssets) {
  if (!Number.isFinite(fairValue) || !(netAssets > 0)) return null;
  return fairValue / netAssets;
}

export function premiumToReportedNav(price, navPerShare) {
  if (!(price > 0) || !(navPerShare > 0)) return null;
  return price / navPerShare - 1;
}

export function weightOfPrice(weight, navPerShare, price) {
  if (!Number.isFinite(weight) || !(navPerShare > 0) || !(price > 0)) return null;
  return (weight * navPerShare) / price;
}

export function reportedFairValuePer100(weight, navPerShare, price) {
  const w = weightOfPrice(weight, navPerShare, price);
  return w == null ? null : 100 * w;
}

export function navPer100OfPrice(navPerShare, price) {
  if (!(navPerShare > 0) || !(price > 0)) return null;
  return (100 * navPerShare) / price;
}

function lineWeight(line, snapshot) {
  if (snapshot.weightBasis === "net-assets") {
    return weightOfNetAssets(line.fairValue, snapshot.netAssets);
  }
  return Number.isFinite(line.reportedWeight) ? line.reportedWeight : null;
}

function mergeRole(roles) {
  if (roles.includes("holding")) return "holding";
  if (roles.every((role) => role === roles[0])) return roles[0];
  return "other";
}

export function positionsByCompany(snapshot, companies = {}) {
  const grouped = new Map();
  for (const line of snapshot.lines) {
    const companyId = canonicalCompanyId(line.companyId, companies);
    const weight = lineWeight(line, snapshot);
    const existing = grouped.get(companyId);
    const piece = {
      ...line,
      companyId,
      weight,
    };
    if (!existing) {
      grouped.set(companyId, {
        companyId,
        name: companyName(companyId, companies),
        fairValue: snapshot.weightBasis === "net-assets" ? line.fairValue : null,
        weight,
        role: line.role,
        lines: [piece],
      });
      continue;
    }
    existing.lines.push(piece);
    existing.role = mergeRole(existing.lines.map((item) => item.role));
    if (snapshot.weightBasis === "net-assets") {
      existing.fairValue += line.fairValue;
      existing.weight = weightOfNetAssets(existing.fairValue, snapshot.netAssets);
    } else {
      existing.weight += line.reportedWeight;
    }
  }
  return grouped;
}

export function positionMetrics(position, snapshot, price) {
  if (!position) {
    return { weightOfNav: null, weightOfPrice: null, per100: null };
  }
  if (snapshot.weightBasis !== "net-assets") {
    return {
      weightOfNav: null,
      weightOfPrice: null,
      per100: null,
      reportedPortfolioWeight: position.weight,
    };
  }
  if (snapshot.premiumMode === "none") {
    const weight = position.weight;
    return {
      weightOfNav: weight,
      weightOfPrice: weight,
      per100: Number.isFinite(weight) ? 100 * weight : null,
      reportedPortfolioWeight: null,
    };
  }
  const usable = price > 0 ? price : null;
  return {
    weightOfNav: position.weight,
    weightOfPrice: weightOfPrice(position.weight, snapshot.navPerShare, usable),
    per100: reportedFairValuePer100(position.weight, snapshot.navPerShare, usable),
    reportedPortfolioWeight: null,
  };
}

export function fundPremium(snapshot, price) {
  if (snapshot.premiumMode !== "market") return null;
  if (!(price > 0)) return null;
  return premiumToReportedNav(price, snapshot.navPerShare);
}

function publicationRank(snapshot) {
  return `${snapshot.publicationDate}|${snapshot.accession}`;
}

export function currentPublications(snapshots) {
  const best = new Map();
  for (const snapshot of snapshots) {
    const key = `${snapshot.ticker}|${snapshot.measurementDate}`;
    const prev = best.get(key);
    if (!prev || publicationRank(snapshot) > publicationRank(prev)) best.set(key, snapshot);
  }
  return [...best.values()];
}

export function fundSeries(snapshots, ticker) {
  return currentPublications(snapshots)
    .filter((snapshot) => snapshot.ticker === ticker)
    .sort((a, b) => a.measurementDate.localeCompare(b.measurementDate) || a.accession.localeCompare(b.accession));
}

export function orderedTickers(snapshots) {
  const present = new Set(currentPublications(snapshots).map((snapshot) => snapshot.ticker));
  const ordered = BOOK_FUND_ORDER.filter((ticker) => present.has(ticker));
  const rest = [...present].filter((ticker) => !BOOK_FUND_ORDER.includes(ticker)).sort();
  return [...ordered, ...rest];
}

export function priorInSeries(series, snapshot) {
  const index = series.findIndex(
    (item) => item.measurementDate === snapshot.measurementDate && item.accession === snapshot.accession
  );
  return index > 0 ? series[index - 1] : null;
}

export function diffBooks(previous, next, { price = null, companies = {} } = {}) {
  if (!previous || !next) return { comparable: false, reason: "missing" };
  if (previous.ticker !== next.ticker) return { comparable: false, reason: "ticker" };
  if (previous.weightBasis !== "net-assets" || next.weightBasis !== "net-assets") {
    return { comparable: false, reason: "denominator" };
  }
  const prevPos = positionsByCompany(previous, companies);
  const nextPos = positionsByCompany(next, companies);
  const ids = new Set([...prevPos.keys(), ...nextPos.keys()]);
  const added = [];
  const removed = [];
  const changed = [];
  for (const id of ids) {
    const before = prevPos.get(id);
    const after = nextPos.get(id);
    if (!before) {
      added.push(after);
      continue;
    }
    if (!after) {
      removed.push(before);
      continue;
    }
    if (Math.abs(before.fairValue - after.fairValue) > 0.5) {
      changed.push({
        companyId: id,
        name: after.name,
        previousFairValue: before.fairValue,
        fairValue: after.fairValue,
        previousWeight: before.weight,
        weight: after.weight,
        lines: after.lines,
      });
    }
  }
  changed.sort(
    (a, b) => Math.abs(b.weight - b.previousWeight) - Math.abs(a.weight - a.previousWeight)
  );
  const usable = price > 0 ? price : null;
  return {
    comparable: true,
    added,
    removed,
    changed,
    navPerShare: {
      previous: previous.navPerShare,
      next: next.navPerShare,
    },
    premiumAtPrice: usable
      ? {
          price: usable,
          previous: fundPremium(previous, usable),
          next: fundPremium(next, usable),
        }
      : null,
  };
}

export function basketLookThrough(entries, companies = {}) {
  const rows = new Map();
  const skipped = [];
  for (const entry of entries) {
    const { snapshot, dollars, price } = entry;
    if (!(dollars > 0)) continue;
    const atNav = snapshot.premiumMode === "none" && snapshot.weightBasis === "net-assets";
    if (snapshot.weightBasis !== "net-assets" || (!atNav && !(price > 0))) {
      skipped.push(snapshot.ticker);
      continue;
    }
    for (const position of positionsByCompany(snapshot, companies).values()) {
      const fairValue = atNav ? dollars * position.weight : dollars * position.weight * (snapshot.navPerShare / price);
      const row = rows.get(position.companyId) || {
        companyId: position.companyId,
        name: position.name,
        role: position.role,
        total: 0,
        byTicker: {},
      };
      row.byTicker[snapshot.ticker] = fairValue;
      row.total += fairValue;
      rows.set(position.companyId, row);
    }
  }
  return {
    skipped,
    rows: [...rows.values()].sort((a, b) => b.total - a.total),
  };
}

export function parseBookSearch(search, { tickers = [] } = {}) {
  const raw = typeof search === "string" && search.startsWith("?") ? search.slice(1) : search || "";
  const params = new URLSearchParams(raw);
  const requested = params.get("view");
  const view = BOOK_VIEWS.includes(requested) ? requested : "per100";
  const focus = params.get("focus");
  const dates = {};
  for (const ticker of tickers) {
    const value = params.get(ticker.toLowerCase());
    if (value && DATE_KEY.test(value)) dates[ticker] = value;
  }
  const sortRaw = (params.get("sort") || "name").toLowerCase();
  const sortTicker = tickers.find((ticker) => ticker.toLowerCase() === sortRaw);
  const sort = sortRaw === "name" || sortTicker ? (sortTicker || "name") : "name";
  const dirRaw = params.get("dir");
  const dir = BOOK_SORT_DIRS.includes(dirRaw) ? dirRaw : sort === "name" ? "asc" : "desc";
  const q = params.get("q") || "";
  const overlap = params.get("overlap") === "1";
  const basket = {};
  for (const ticker of tickers) {
    const bVal = params.get(`b_${ticker.toLowerCase()}`);
    if (bVal && !isNaN(Number(bVal)) && Number(bVal) > 0) {
      basket[ticker] = Number(bVal);
    }
  }
  return { view, focus: focus || null, dates, sort, dir, q, overlap, basket };
}

export function serializeBookSearch({
  view,
  focus,
  dates = {},
  sort = "name",
  dir = "asc",
  q = "",
  overlap = false,
  basket = {},
}) {
  const params = new URLSearchParams();
  if (BOOK_VIEWS.includes(view) && view !== "per100") params.set("view", view);
  if (focus) params.set("focus", focus);
  if (sort && sort !== "name") params.set("sort", String(sort).toLowerCase());
  const defaultDir = !sort || sort === "name" ? "asc" : "desc";
  if (BOOK_SORT_DIRS.includes(dir) && dir !== defaultDir) params.set("dir", dir);
  for (const [ticker, date] of Object.entries(dates)) {
    if (date && DATE_KEY.test(date)) params.set(ticker.toLowerCase(), date);
  }
  if (q) params.set("q", q);
  if (overlap) params.set("overlap", "1");
  for (const [ticker, amount] of Object.entries(basket || {})) {
    const num = Number(amount);
    if (num > 0) {
      params.set(`b_${ticker.toLowerCase()}`, String(num));
    }
  }
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

function csvCell(value) {
  const text = value == null ? "" : String(value);
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export function bookCsv(rows) {
  const header = [
    "company",
    "companyId",
    "ticker",
    "measurementDate",
    "navAsOf",
    "weightBasis",
    "fairValue",
    "weightOfNav",
    "price",
    "reportedNav",
    "weightOfPrice",
    "reportedFairValuePer100",
  ];
  const lines = [header.join(",")];
  for (const row of rows) {
    lines.push(header.map((key) => csvCell(row[key])).join(","));
  }
  return lines.join("\n");
}
