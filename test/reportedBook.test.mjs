import assert from "node:assert/strict";
import { readdirSync } from "node:fs";
import { basename, join } from "node:path";
import { test } from "node:test";
import { ANTHROPIC_SPV, MONEY_MARKET, OPENAI_EQUITY_SPV } from "../lib/dxyzHoldings.mjs";
import { FILED } from "../lib/dxyzAtm.mjs";
import { loadBookSnapshots, loadCompanies } from "../lib/loadBooks.mjs";
import {
  basketLookThrough,
  bookCsv,
  canonicalCompanyId,
  currentPublications,
  diffBooks,
  fundPremium,
  fundSeries,
  orderedTickers,
  parseBookSearch,
  positionMetrics,
  sortBookRows,
  positionsByCompany,
  premiumToReportedNav,
  priorInSeries,
  reportedFairValuePer100,
  serializeBookSearch,
  weightOfPrice,
} from "../lib/reportedBook.mjs";
import { validateBook } from "../data/schema/validate.mjs";

const companies = loadCompanies();
const companyMap = companies.companies;
const snapshots = loadBookSnapshots(companies);

function book(ticker, measurementDate) {
  const found = snapshots.find(
    (snapshot) => snapshot.ticker === ticker && snapshot.measurementDate === measurementDate
  );
  assert.ok(found, `${ticker} ${measurementDate}`);
  return found;
}

function weight(snapshot, companyId) {
  return positionsByCompany(snapshot, companyMap).get(companyId)?.weight;
}

test("book filenames carry the measurement date and accession or source id", () => {
  const bookRoot = join(import.meta.dirname, "..", "data", "books");
  const files = readdirSync(bookRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .flatMap((entry) =>
      readdirSync(join(bookRoot, entry.name))
        .filter((file) => file.endsWith(".json"))
        .map((file) => basename(file))
    );
  assert.equal(files.length, snapshots.length);
  for (const file of files) {
    assert.match(file, /^\d{4}-\d{2}-\d{2}__(?:\d{10}-\d{2}-\d{6}|[a-z0-9-]+)\.json$/);
  }
  assert.equal(snapshots.length, 9);
});

test("DXYZ June 30 reconciles to the filed ledger", () => {
  const june = book("DXYZ", "2026-06-30");
  assert.equal(june.netAssets, FILED.netAssets);
  assert.equal(june.navPerShare, 34.3);
  assert.equal(june.sharesOutstanding, FILED.sharesOutstanding);
  const lines = positionsByCompany(june, companyMap);
  assert.equal(lines.get("anthropic").fairValue, ANTHROPIC_SPV.valUSD);
  assert.equal(lines.get("openai").fairValue, OPENAI_EQUITY_SPV.valUSD);
  assert.equal(lines.get("money-market").fairValue, MONEY_MARKET.valUSD);
  assert.ok(lines.get("unitemized").fairValue > 40_000_000);
  assert.equal(lines.has("boom"), false);
  assert.equal(lines.has("ai-llm"), false);
  const sum = june.lines.reduce((total, line) => total + line.fairValue, 0);
  assert.ok(Math.abs(sum - june.netAssets) < 0.05);
});

test("DXYZ OpenAI is 2.14% on June 30 and 11.32% after the cash transfer", () => {
  const june = book("DXYZ", "2026-06-30");
  const august = book("DXYZ", "2026-08-13");
  const juneWeight = weight(june, "openai");
  const augustWeight = weight(august, "openai");
  assert.ok(Math.abs(juneWeight - 35_040_868.2 / FILED.netAssets) < 1e-12);
  assert.ok(Math.abs(augustWeight - (35_040_868.2 + 150_000_000) / FILED.netAssets) < 1e-12);
  assert.ok(juneWeight < 0.03 && augustWeight > 0.11);
  assert.equal(weight(june, "anthropic"), weight(august, "anthropic"));
  assert.equal(
    positionsByCompany(august, companyMap).get("money-market").fairValue,
    MONEY_MARKET.valUSD - 169_000_000
  );
  assert.equal(august.navPerShare, june.navPerShare);
  assert.equal(august.netAssets, june.netAssets);
  assert.equal(august.navAsOf, "2026-06-30");
  assert.equal(august.unknownDilution, true);
  assert.equal(june.unknownDilution, false);
  const boom = august.lines.find((line) => line.companyId === "boom");
  assert.equal(boom.fairValue, 4_000_000);
  assert.equal(boom.valuation, "cost");
  assert.match(boom.note, /unitemized residual/);
});

test("VCX Databricks sums the common and the practical-expedient SPV", () => {
  const vcx = book("VCX", "2026-06-30");
  const databricks = positionsByCompany(vcx, companyMap).get("databricks");
  assert.equal(databricks.lines.length, 2);
  assert.ok(databricks.lines.some((line) => line.valuation === "practical-expedient"));
  assert.equal(databricks.fairValue, 23_256_000 + 72_479_780);
  const aiLlm = vcx.lines.find((line) => line.companyId === "ai-llm");
  assert.equal(aiLlm.fairValue, 23_105_000);
  assert.equal(positionsByCompany(vcx, companyMap).has("anthropic"), true);
  assert.notEqual(aiLlm.companyId, "anthropic");
  const sum = vcx.lines.reduce((total, line) => total + line.fairValue, 0);
  assert.ok(Math.abs(sum - vcx.netAssets) < 0.05);
});

test("price formulas use reported NAV and refuse a portfolio-mix percent", () => {
  const august = book("DXYZ", "2026-08-13");
  const openai = positionsByCompany(august, companyMap).get("openai");
  const price = 32.97;
  const metrics = positionMetrics(openai, august, price);
  assert.equal(metrics.weightOfNav, openai.weight);
  assert.equal(metrics.per100, 100 * openai.weight * august.navPerShare / price);
  assert.equal(metrics.weightOfPrice, weightOfPrice(openai.weight, august.navPerShare, price));
  assert.equal(fundPremium(august, price), premiumToReportedNav(price, 34.3));
  assert.equal(positionMetrics(openai, august, null).per100, null);

  const marketing = {
    ticker: "RVII",
    weightBasis: "reported-portfolio",
    premiumMode: "none",
    navPerShare: 10,
    lines: [],
  };
  const mix = { companyId: "tasklet", weight: 0.045, fairValue: null, lines: [] };
  assert.equal(positionMetrics(mix, marketing, 12).per100, null);
  assert.equal(fundPremium(marketing, 12), null);
});

test("the current DXYZ book is the August transfer, and June stays available", () => {
  const series = fundSeries(snapshots, "DXYZ");
  assert.deepEqual(series.map((snapshot) => snapshot.measurementDate), ["2026-06-30", "2026-08-13"]);
  const current = series.at(-1);
  const prior = priorInSeries(series, current);
  assert.equal(current.measurementDate, "2026-08-13");
  assert.equal(prior.measurementDate, "2026-06-30");
  const diff = diffBooks(prior, current, { price: 33, companies: companyMap });
  assert.equal(diff.comparable, true);
  assert.equal(diff.navPerShare.previous, diff.navPerShare.next);
  assert.ok(Math.abs(diff.premiumAtPrice.previous - diff.premiumAtPrice.next) < 1e-12);
  assert.ok(diff.changed.some((row) => row.companyId === "openai"));
  assert.equal(diff.changed.some((row) => row.companyId === "anthropic"), false);
  assert.deepEqual(
    diff.added.map((row) => row.companyId).sort(),
    ["boom", "fluidstack"]
  );
  assert.equal(diff.removed.length, 0);
});

test("a later publication of the same measurement date replaces the current view", () => {
  const original = book("VCX", "2026-06-30");
  const amendment = { ...original, publicationDate: "2026-09-15", accession: "0001867090-26-000200" };
  const current = currentPublications([original, amendment]).filter((snapshot) => snapshot.ticker === "VCX");
  assert.equal(current.length, 1);
  assert.equal(current[0].accession, amendment.accession);
});

test("a marketing snapshot is not diffed against an N-PORT as buys and sells", () => {
  const vcx = book("VCX", "2026-06-30");
  const marketing = {
    ticker: "RVII",
    weightBasis: "reported-portfolio",
    measurementDate: "2026-07-15",
    lines: [{ companyId: "tasklet", reportedWeight: 0.045, role: "holding" }],
  };
  const diff = diffBooks(marketing, { ...vcx, ticker: "RVII" }, { companies: companyMap });
  assert.equal(diff.comparable, false);
  assert.equal(diff.reason, "denominator");
  assert.equal(diff.added, undefined);
});

test("dbt Labs and Fivetran are one company in a diff", () => {
  const before = {
    ticker: "VCX",
    weightBasis: "net-assets",
    premiumMode: "market",
    navPerShare: 20,
    netAssets: 100,
    measurementDate: "2026-03-31",
    lines: [{ companyId: "dbt-labs", fairValue: 10, role: "holding" }],
  };
  const after = {
    ticker: "VCX",
    weightBasis: "net-assets",
    premiumMode: "market",
    navPerShare: 20,
    netAssets: 100,
    measurementDate: "2026-06-30",
    lines: [{ companyId: "fivetran", fairValue: 12, role: "holding" }],
  };
  assert.equal(canonicalCompanyId("dbt-labs", companyMap), "fivetran");
  const diff = diffBooks(before, after, { companies: companyMap });
  assert.equal(diff.added.length, 0);
  assert.equal(diff.removed.length, 0);
  assert.equal(diff.changed.length, 1);
  assert.equal(diff.changed[0].companyId, "fivetran");
});

test("interval funds cannot store a market premium", () => {
  const bad = {
    schemaVersion: "1.0.0",
    ticker: "ARKVX",
    name: "ARK Venture Fund",
    vehicleType: "interval-fund",
    yahooSymbol: "ARKVX",
    premiumMode: "market",
    weightBasis: "net-assets",
    measurementDate: "2026-04-30",
    publicationDate: "2026-06-01",
    accession: "0001213900-26-000001",
    navPerShare: 40.3,
    netAssets: 871_119_657,
    sharesOutstanding: 21_613_728,
    sources: [
      {
        fields: ["netAssets"],
        sourceClass: "primary",
        url: "https://example.com/arkvx",
        measurementDate: "2026-04-30",
      },
    ],
    lines: [{ companyId: "anthropic", fairValue: 871_119_657, role: "holding" }],
  };
  assert.throws(() => validateBook(bad, { companies }), /premiumMode must be none/);
});

test("query strings cannot override a filed weight", () => {
  const parsed = parseBookSearch("?view=nav&dxyz=2026-06-30&focus=openai&weight=0.99&openai=1", {
    tickers: ["DXYZ", "VCX"],
  });
  assert.equal(parsed.view, "nav");
  assert.equal(parsed.focus, "openai");
  assert.deepEqual(parsed.dates, { DXYZ: "2026-06-30" });
  assert.equal(Object.hasOwn(parsed, "weight"), false);
  assert.equal(parsed.sort, "name");
  assert.equal(parsed.dir, "asc");
  assert.equal(serializeBookSearch(parsed), "?view=nav&focus=openai&dxyz=2026-06-30");
  const byFund = parseBookSearch("?sort=dxyz&dir=asc", { tickers: ["DXYZ", "VCX"] });
  assert.equal(byFund.sort, "DXYZ");
  assert.equal(byFund.dir, "asc");
  assert.equal(serializeBookSearch(byFund), "?sort=dxyz&dir=asc");

  const withFilters = parseBookSearch("?q=space&overlap=1&b_dxyz=5000&b_vcx=2500", { tickers: ["DXYZ", "VCX"] });
  assert.equal(withFilters.q, "space");
  assert.equal(withFilters.overlap, true);
  assert.deepEqual(withFilters.basket, { DXYZ: 5000, VCX: 2500 });
  assert.equal(serializeBookSearch(withFilters), "?q=space&overlap=1&b_dxyz=5000&b_vcx=2500");
});

test("company rows sort A–Z within a section, and a fund column keeps blanks last", () => {
  const rows = [
    { id: "openai", name: "OpenAI", role: "holding" },
    { id: "anthropic", name: "Anthropic", role: "holding" },
    { id: "cash", name: "Treasury money market", role: "cash" },
    { id: "boom", name: "Boom", role: "holding" },
  ];
  const funds = [
    {
      ticker: "DXYZ",
      price: 32,
      snapshot: { navPerShare: 34.3, weightBasis: "net-assets", premiumMode: "market" },
      positions: new Map([
        ["anthropic", { weight: 0.14 }],
        ["openai", { weight: 0.11 }],
        ["cash", { weight: 0.47, role: "cash" }],
      ]),
    },
  ];
  assert.deepEqual(
    sortBookRows(rows, { key: "name", dir: "asc" }).map((row) => row.id),
    ["anthropic", "boom", "openai", "cash"]
  );
  assert.deepEqual(
    sortBookRows(rows, { key: "DXYZ", dir: "desc", view: "nav", funds }).map((row) => row.id),
    ["anthropic", "openai", "boom", "cash"]
  );
  assert.deepEqual(
    sortBookRows(rows, { key: "DXYZ", dir: "asc", view: "nav", funds }).map((row) => row.id),
    ["openai", "anthropic", "boom", "cash"]
  );
  const secondaryTrends = {
    companies: {
      openai: { twoYearChange: 249.98 },
      anthropic: { twoYearChange: 2035.82 },
      boom: { twoYearChange: -97.55 },
    },
  };
  assert.deepEqual(
    sortBookRows(rows, { key: "trend", dir: "desc", secondaryTrends }).map((row) => row.id),
    ["anthropic", "openai", "boom", "cash"]
  );
  assert.deepEqual(
    sortBookRows(rows, { key: "trend", dir: "asc", secondaryTrends }).map((row) => row.id),
    ["boom", "openai", "anthropic", "cash"]
  );
  const byTrend = parseBookSearch("?sort=trend", { tickers: ["DXYZ", "VCX"] });
  assert.equal(byTrend.sort, "trend");
  assert.equal(byTrend.dir, "desc");
  assert.equal(serializeBookSearch(byTrend), "?sort=trend");
});

test("new fund columns reconcile, and a portfolio-mix book stays out of dollars per $100", () => {
  const rvi = book("RVI", "2026-06-30");
  assert.equal(positionsByCompany(rvi, companyMap).get("openai").fairValue, 74_998_784);
  const pwrl = book("PWRL", "2026-06-30");
  assert.equal(positionsByCompany(pwrl, companyMap).get("spacex").fairValue, 189_523_047);
  const bot = book("BOT", "2026-08-31");
  assert.ok(Math.abs(weight(bot, "figure") - 0.138) < 1e-6);
  const arkvx = book("ARKVX", "2026-04-30");
  assert.equal(arkvx.premiumMode, "none");
  assert.equal(fundPremium(arkvx, 50), null);
  const anth = positionsByCompany(arkvx, companyMap).get("anthropic");
  assert.equal(positionMetrics(anth, arkvx, 50).per100, 100 * anth.weight);
  assert.equal(orderedTickers(snapshots).includes("RVII"), false);
  const piivx = book("PIIVX", "2026-06-30");
  assert.equal(piivx.premiumMode, "none");
  const psfSpacex = positionsByCompany(piivx, companyMap).get("spacex");
  assert.ok(Math.abs(psfSpacex.weight - 0.2368) < 0.002);
  const nslr = book("NSLR", "2026-06-30");
  assert.ok(Math.abs(weight(nslr, "whoop") - 0.4237) < 0.001);
  assert.equal(positionsByCompany(nslr, companyMap).get("openai").fairValue, 59_302_645);
});

test("basket uses reported fair value per dollar of market price", () => {
  const august = book("DXYZ", "2026-08-13");
  const price = 34.3;
  const result = basketLookThrough([{ snapshot: august, dollars: 100, price }], companyMap);
  const openai = result.rows.find((row) => row.companyId === "openai");
  assert.ok(Math.abs(openai.total - reportedFairValuePer100(weight(august, "openai"), 34.3, price)) < 1e-9);
  const skipped = basketLookThrough(
    [{ snapshot: { ...august, weightBasis: "reported-portfolio" }, dollars: 100, price }],
    companyMap
  );
  assert.deepEqual(skipped.skipped, ["DXYZ"]);
  assert.match(bookCsv([{ company: "OpenAI", ticker: "DXYZ" }]), /^company,companyId,/);
});
