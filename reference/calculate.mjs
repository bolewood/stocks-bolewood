// Public reference calculator. Reads data/ + fixtures.json. No UI, no app/.
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { calculateScenario, referenceRow } from "./engine.mjs";

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
  return { meta, marks, wrappers, capitalization: readJson("data/capitalization.json") };
}

export const rowFromData = referenceRow;

export function calculate(dataset = loadPublicDataset(), fixtures = readJson("reference/fixtures.json")) {
  return calculateScenario(dataset, fixtures);
}

export function canonicalTable(result) {
  if (typeof result === 'number') return Number.isFinite(result) ? Number(result.toPrecision(12)) : result;
  if (Array.isArray(result)) return result.map(canonicalTable);
  if (result && typeof result === 'object') return Object.fromEntries(Object.entries(result).map(([k,v]) => [k, canonicalTable(v)]));
  return result;
}

const isMain =
  process.argv[1] && process.argv[1].replaceAll("\\", "/").endsWith("reference/calculate.mjs");
if (isMain) {
  if (process.argv[2] === '--scenario') {
    const snapshot = JSON.parse(readFileSync(process.argv[3], 'utf8'));
    if (snapshot.format !== 'ai-exposure-scenario' || !['1.3.0', '1.4.0'].includes(snapshot.version)) throw new Error('Unsupported scenario export');
    const actual = canonicalTable(calculate(snapshot.dataset, snapshot.inputs));
    if (snapshot.results && JSON.stringify(actual) !== JSON.stringify(canonicalTable(snapshot.results))) throw new Error('Exported results do not reproduce');
    console.log(JSON.stringify(actual, null, 2));
  } else {
    const write = process.argv[2] === '--write';
    const pairs = [
      ['reference/fixtures.json', 'reference/expected-results.json'],
      ['reference/estimated-fixtures.json', 'reference/estimated-expected-results.json'],
      ['reference/s1-fixtures.json', 'reference/s1-expected-results.json'],
      ['reference/s1-estimated-fixtures.json', 'reference/s1-estimated-expected-results.json'],
    ];
    const results = pairs.map(([fixture, expectedRel]) => {
      const actual = canonicalTable(calculate(loadPublicDataset(), readJson(fixture)));
      if (write) writeFileSync(join(ROOT, expectedRel), JSON.stringify(actual, null, 2) + "\n");
      else if (JSON.stringify(actual) !== JSON.stringify(readJson(expectedRel))) throw new Error(`Reference output does not match ${expectedRel}`);
      return actual;
    });
    const [table, estimated] = results;
    console.log(`${write ? 'wrote' : 'ok'} ${table.rows.length} Filed Holdings + ${estimated.rows.length} Estimated Holdings rows @ dataset ${table.datasetAsOf} (ANT $${table.anthPrice} ${table.anthShareBasis}); frozen s1 views reproduced; frozen prices ${table.priceAsOf}`);
  }
}
