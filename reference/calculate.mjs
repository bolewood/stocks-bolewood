// Public reference calculator. Reads data/ + fixtures.json. No UI, no app/.
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  adsEquivalentShares,
  impliedExposure,
  lookThroughPer100,
} from "./derive.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

export function readJson(rel) {
  return JSON.parse(readFileSync(join(ROOT, rel), "utf8"));
}

export function loadPublicDataset() {
  const meta = readJson("data/meta.json");
  const marks = readJson("data/marks.json");
  const dir = join(ROOT, "data/wrappers");
  const byTicker = Object.fromEntries(
    readdirSync(dir)
      .filter((f) => f.endsWith(".json"))
      .map((f) => {
        const raw = JSON.parse(readFileSync(join(dir, f), "utf8"));
        return [raw.ticker, raw];
      })
  );
  const wrappers = (meta.wrapperOrder || Object.keys(byTicker)).map((t) => {
    if (!byTicker[t]) throw new Error(`missing wrapper ${t}`);
    return byTicker[t];
  });
  return { meta, marks, wrappers };
}

function sharesOutstanding(raw) {
  if (raw.filedSnapshot?.netAssets > 0 && raw.filedSnapshot?.navPerShare > 0) {
    return raw.filedSnapshot.netAssets / raw.filedSnapshot.navPerShare;
  }
  const n = raw.shareCount?.value;
  if (!(n > 0)) return 0;
  if (raw.adrRatio) return adsEquivalentShares(n, raw.adrRatio);
  return n;
}

function wrapperValue(raw, price) {
  if (raw.denominatorType === "total-net-assets") {
    return raw.totalNetAssets?.value || 0;
  }
  const shares = sharesOutstanding(raw);
  if (!(price > 0) || !(shares > 0)) return 0;
  return price * shares;
}

function per100(pct, ipoVal, value, dilution) {
  if (!(pct > 0)) return 0;
  return lookThroughPer100({
    claimPct: pct,
    ipoVal,
    wrapperValue: value,
    dilution,
  });
}

export function rowFromData(raw, marks, fixtures) {
  const price = fixtures.prices[raw.yahooSymbol];
  const value = wrapperValue(raw, price);
  const anthPct = impliedExposure(raw.anthropic, marks);
  const oaiPct = impliedExposure(raw.openai, marks);
  const anthPer100 = per100(anthPct, fixtures.anthVal, value, fixtures.dilution);
  const oaiPer100 = per100(oaiPct, fixtures.oaiVal, value, fixtures.dilution);
  return {
    ticker: raw.ticker,
    price,
    wrapperValue: value,
    anthBasis: raw.anthropic?.basis || null,
    oaiBasis: raw.openai?.basis || null,
    anthPct,
    oaiPct,
    anthPer100,
    oaiPer100,
    combinedPer100: anthPer100 + oaiPer100,
  };
}

export function calculate(dataset = loadPublicDataset(), fixtures = readJson("reference/fixtures.json")) {
  return {
    schemaVersion: dataset.meta.schemaVersion,
    methodologyVersion: dataset.meta.methodologyVersion,
    asOf: fixtures.asOf,
    anthVal: fixtures.anthVal,
    oaiVal: fixtures.oaiVal,
    dilution: fixtures.dilution,
    rows: dataset.wrappers.map((w) => rowFromData(w, dataset.marks, fixtures)),
  };
}

function roundForCompare(n) {
  if (n == null || !Number.isFinite(n)) return n;
  return Number(n.toPrecision(12));
}

export function canonicalTable(result) {
  return {
    ...result,
    rows: result.rows.map((r) => ({
      ...r,
      wrapperValue: roundForCompare(r.wrapperValue),
      anthPct: r.anthPct == null ? null : roundForCompare(r.anthPct),
      oaiPct: r.oaiPct == null ? null : roundForCompare(r.oaiPct),
      anthPer100: roundForCompare(r.anthPer100),
      oaiPer100: roundForCompare(r.oaiPer100),
      combinedPer100: roundForCompare(r.combinedPer100),
    })),
  };
}

const isMain =
  process.argv[1] && process.argv[1].replaceAll("\\", "/").endsWith("reference/calculate.mjs");
if (isMain) {
  const table = canonicalTable(calculate());
  const expectedPath = join(ROOT, "reference/expected-results.json");
  const expected = JSON.parse(readFileSync(expectedPath, "utf8"));
  const got = JSON.stringify(table, null, 2) + "\n";
  const want = JSON.stringify(expected, null, 2) + "\n";
  if (got !== want) {
    console.error("reference output does not match reference/expected-results.json");
    process.exit(1);
  }
  console.log(`ok ${table.rows.length} rows @ ${table.asOf}`);
}
