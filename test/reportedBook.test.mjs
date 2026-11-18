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
  defaultSnapshot,
  diffBooks,
  fundPremium,
  impliedHoldingsPerShare,
  isStaleNav,
  navAgeDays,
  netCashPerShare,
  priceToNav,
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
  assert.equal(snapshots.length, 13);
});

test("DXYZ June 30 reconciles to the filed ledger", () => {
  // Historical book: June 30 N-CSRS literals (the live ledger is now 9/30).
  const june = book("DXYZ", "2026-06-30");
  assert.equal(june.netAssets, 1_634_830_252);
  assert.equal(june.navPerShare, 34.3);
  assert.equal(june.sharesOutstanding, 47_657_338);
  const lines = positionsByCompany(june, companyMap);
  assert.equal(lines.get("anthropic").fairValue, 235_671_976.08);
  assert.equal(lines.get("openai").fairValue, 35_040_868.2);
  assert.equal(lines.get("money-market").fairValue, 939_712_701);
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
  assert.ok(Math.abs(juneWeight - 35_040_868.2 / june.netAssets) < 1e-12);
  assert.ok(Math.abs(augustWeight - (35_040_868.2 + 150_000_000) / june.netAssets) < 1e-12);
  assert.ok(juneWeight < 0.03 && augustWeight > 0.11);
  assert.equal(weight(june, "anthropic"), weight(august, "anthropic"));
  assert.equal(
    positionsByCompany(august, companyMap).get("money-market").fairValue,
    939_712_701 - 169_000_000
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

test("the default DXYZ book is the filed 9/30 N-PORT; the Nov 4 post-deal estimate stays selectable", () => {
  const series = fundSeries(snapshots, "DXYZ");
  assert.deepEqual(series.map((snapshot) => snapshot.measurementDate), ["2026-06-30", "2026-08-13", "2026-09-30", "2026-11-04"]);
  assert.equal(defaultSnapshot(series).measurementDate, "2026-09-30");
  const current = series.at(-1);
  assert.equal(current.estimated, true);
  const prior = priorInSeries(series, current);
  assert.equal(current.measurementDate, "2026-11-04");
  assert.equal(prior.measurementDate, "2026-09-30");
  const diff = diffBooks(prior, current, { price: 27, companies: companyMap });
  assert.equal(diff.comparable, true);
  assert.equal(diff.navPerShare.previous, diff.navPerShare.next);
  assert.ok(Math.abs(diff.premiumAtPrice.previous - diff.premiumAtPrice.next) < 1e-12);
  assert.ok(diff.changed.some((row) => row.companyId === "openai"));
  assert.equal(diff.changed.some((row) => row.companyId === "anthropic"), false);
  assert.deepEqual(
    diff.added.map((row) => row.companyId).sort(),
    ["blue-origin", "blykalla", "together-ai", "varda"]
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
  assert.equal(orderedTickers(snapshots).includes("RVII"), true);
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

test("DXYZ September 30 book reconciles to the 9/30 ledger; the Nov 4 book adds the five deals at cost", () => {
  const sept = book("DXYZ", "2026-09-30");
  const nov = book("DXYZ", "2026-11-04");
  assert.equal(sept.netAssets, FILED.netAssets);
  assert.equal(sept.navPerShare, 38.32);
  assert.equal(sept.sharesOutstanding, FILED.sharesOutstanding);
  const lines = positionsByCompany(sept, companyMap);
  assert.equal(lines.get("anthropic").fairValue, ANTHROPIC_SPV.valUSD);
  assert.equal(lines.get("openai").fairValue, OPENAI_EQUITY_SPV.valUSD);
  assert.equal(lines.get("money-market").fairValue, MONEY_MARKET.valUSD);
  assert.ok(Math.abs(weight(sept, "anthropic") - 0.2096) < 0.0001);
  const sum = (b) => b.lines.reduce((total, line) => total + line.fairValue, 0);
  assert.ok(Math.abs(sum(sept) - sept.netAssets) < 0.05);
  assert.ok(Math.abs(sum(nov) - nov.netAssets) < 0.05);
  assert.equal(nov.navAsOf, "2026-09-30");
  assert.equal(nov.unknownDilution, true);
  assert.equal(positionsByCompany(nov, companyMap).get("money-market").fairValue, MONEY_MARKET.valUSD - 112_000_000);
  assert.equal(positionsByCompany(nov, companyMap).get("openai").fairValue, OPENAI_EQUITY_SPV.valUSD + 25_000_000);
  for (const id of ["blue-origin", "varda", "together-ai", "blykalla"]) {
    const line = nov.lines.find((l) => l.companyId === id);
    assert.equal(line.valuation, "cost", id);
  }
});

// Acceptance for the 2026-11-18 /book update: each fund's ratios recompute from
// one report (NAV, net assets, shares, cash and holdings from the same filing).
test("NSLR 9/30 10-Q: ties to the balance sheet, 0.43x at $5.46", () => {
  const nslr = defaultSnapshot(fundSeries(snapshots, "NSLR"));
  assert.equal(nslr.measurementDate, "2026-09-30");
  assert.equal(nslr.accession, "0001493152-26-049893");
  assert.equal(nslr.netAssets, 334_698_480);
  assert.equal(nslr.sharesOutstanding, 26_473_222);
  assert.ok(Math.abs(nslr.navPerShare * nslr.sharesOutstanding - nslr.netAssets) / nslr.netAssets < 0.001);
  const sum = nslr.lines.reduce((total, line) => total + line.fairValue, 0);
  assert.equal(sum, nslr.netAssets);
  const holdings = nslr.lines.filter((line) => line.role === "holding").reduce((t, l) => t + l.fairValue, 0);
  assert.equal(holdings, 377_196_404);
  const pos = positionsByCompany(nslr, companyMap);
  assert.equal(pos.get("whoop").fairValue, 141_968_736 + 1_358_060);
  assert.equal(pos.get("openai").fairValue, 59_444_942);
  assert.equal(pos.get("vast-data").fairValue, 33_976_149);
  assert.equal(pos.get("tensorwave").fairValue, 20_406_033);
  assert.equal(pos.get("coreweave").fairValue, 12_325_378);
  assert.equal(pos.get("canva").fairValue, 13_101_914);
  assert.equal(pos.get("blink-health").fairValue, 13_115_662);
  assert.equal(pos.get("locus-robotics").fairValue, 12_532_759);
  assert.equal(pos.get("clickhouse").fairValue, 9_471_170);
  assert.equal(pos.get("plaid").fairValue, 6_922_679);
  assert.equal(pos.get("cash-unscheduled").fairValue, 40_853_490);
  assert.equal(pos.has("learneo"), false);
  assert.equal(priceToNav(5.46, nslr.navPerShare).toFixed(2), "0.43");
  const whoop = positionMetrics(pos.get("whoop"), nslr, 5.46);
  assert.ok(Math.abs(whoop.per100 - (100 * (143_326_796 / 334_698_480) * 12.64) / 5.46) < 1e-9);
});

test("RVII 9/30 10-Q: SAFEs grouped, net cash $19.25/sh, 0.59x at $13.71", () => {
  const rvii = defaultSnapshot(fundSeries(snapshots, "RVII"));
  assert.equal(rvii.measurementDate, "2026-09-30");
  assert.equal(rvii.netAssets, 210_433_394);
  assert.equal(rvii.sharesOutstanding, 9_066_384);
  assert.equal(rvii.lines.reduce((total, line) => total + line.fairValue, 0), rvii.netAssets);
  const pos = positionsByCompany(rvii, companyMap);
  assert.equal(pos.get("rvii-safes").fairValue, 35_610_699);
  assert.equal(pos.get("limrun").fairValue, 335_004);
  assert.equal(pos.get("money-market").fairValue, 180_213_058);
  assert.equal(priceToNav(13.71, rvii.navPerShare).toFixed(2), "0.59");
  assert.equal(netCashPerShare(rvii).toFixed(2), "19.25");
  assert.ok(impliedHoldingsPerShare(rvii, 13.71) < 0);
  const safes = positionMetrics(pos.get("rvii-safes"), rvii, 13.71);
  assert.ok(Math.abs(safes.per100 - (100 * (35_610_699 / 210_433_394) * 23.21) / 13.71) < 1e-9);
});

test("DXYZ 9/30 basis: 0.69x at $26.50; cash ~$719.8M from the same N-PORT", () => {
  const dxyz = defaultSnapshot(fundSeries(snapshots, "DXYZ"));
  assert.equal(dxyz.measurementDate, "2026-09-30");
  assert.equal(priceToNav(26.5, dxyz.navPerShare).toFixed(2), "0.69");
  const pos = positionsByCompany(dxyz, companyMap);
  const cash = pos.get("money-market").fairValue + pos.get("other-net-assets").fairValue;
  assert.ok(Math.abs(cash - 719_808_605) < 1);
  assert.ok(Math.abs(pos.get("spacex").fairValue - 152_866_954.43) < 0.01);
  const anth = positionMetrics(pos.get("anthropic"), dxyz, 26.5);
  assert.ok(Math.abs(anth.per100 - (100 * (382_879_608.72 / 1_826_366_694) * 38.32) / 26.5) < 1e-9);
});

test("NAV staleness is measured from today's date, over 75 days", () => {
  assert.equal(navAgeDays("2026-09-30", "2026-11-18"), 49);
  assert.equal(isStaleNav("2026-09-30", "2026-11-18"), false);
  assert.equal(isStaleNav("2026-08-31", "2026-11-18"), true);
  assert.equal(isStaleNav("2026-09-04", "2026-11-18"), false);
  assert.equal(isStaleNav("2026-09-03", "2026-11-18"), true);
  assert.equal(isStaleNav("2026-09-30", null), null);
  for (const ticker of ["VCX", "RVI"]) {
    const current = defaultSnapshot(fundSeries(snapshots, ticker));
    assert.equal(current.measurementDate, "2026-06-30");
    assert.equal(current.pendingFiling.form, "NPORT-P");
    assert.equal(current.pendingFiling.dueBy, "2026-11-29");
  }
});
