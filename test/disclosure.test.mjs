import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import {
  DISCLOSURE_MARKERS,
  DISCLOSURE_MAX_AGE_DAYS,
  WORKED_EXAMPLE_MARKERS,
  assertDisclosureFresh,
  disclosureAgeDays,
  disclosureSentence,
  extractMarkedSection,
  isHeldTicker,
  renderReadmeDisclosureSection,
} from "../lib/disclosure.mjs";
import {
  dxyzAnthropicWorkedExample,
  renderWorkedExampleMarkdown,
} from "../reference/workedExample.mjs";
import { readJson } from "../reference/calculate.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const disclosure = JSON.parse(
  readFileSync(join(root, "data", "disclosure.json"), "utf8")
);
const readme = readFileSync(join(root, "README.md"), "utf8");
const finder = readFileSync(
  join(root, "components", "AIPerDollarFinder.jsx"),
  "utf8"
);
const expectedResults = readJson("reference/expected-results.json");

const CANONICAL_SENTENCE =
  "As of August 19, 2026, the author holds long positions in DXYZ, SKM, ZM, AMZN, GOOG and NVDA. The DXYZ exposure includes options. Positions are subject to change without notice.";

test("disclosure.json lists the six held tickers with a dated note", () => {
  assert.equal(disclosure.asOf, "2026-08-19");
  assert.deepEqual(disclosure.tickers, [
    "DXYZ",
    "SKM",
    "ZM",
    "AMZN",
    "GOOG",
    "NVDA",
  ]);
  assert.match(disclosure.notes, /DXYZ exposure includes options/);
  assert.equal(disclosureSentence(disclosure), CANONICAL_SENTENCE);
  for (const t of disclosure.tickers) {
    assert.equal(isHeldTicker(t, disclosure), true);
  }
  assert.equal(isHeldTicker("ARKVX", disclosure), false);
});

test("README generated disclosure section matches data/disclosure.json", () => {
  const expected = renderReadmeDisclosureSection(disclosure);
  const actual = extractMarkedSection(readme, DISCLOSURE_MARKERS);
  assert.ok(actual, "README is missing BEGIN/END GENERATED: disclosure markers");
  assert.equal(actual, expected);
  assert.equal(
    actual.slice(
      DISCLOSURE_MARKERS.begin.length + 1,
      actual.length - DISCLOSURE_MARKERS.end.length - 1
    ),
    CANONICAL_SENTENCE
  );
});

test("site and README render the same disclosure sentence", () => {
  assert.match(finder, /\{disclosureSentence\(disclosure\)\}/);
  assert.match(finder, /title=\{disclosureSentence\(disclosure\)\}/);
  assert.doesNotMatch(finder, /Disclosure:/);
  assert.doesNotMatch(finder, /disclosureBannerText/);
  assert.ok(readme.includes(CANONICAL_SENTENCE));
});

test("README generated worked example matches data/ + fixtures", () => {
  const expected = renderWorkedExampleMarkdown();
  const actual = extractMarkedSection(readme, WORKED_EXAMPLE_MARKERS);
  assert.ok(
    actual,
    "README is missing BEGIN/END GENERATED: worked-example markers"
  );
  assert.equal(actual, expected);

  const ex = dxyzAnthropicWorkedExample();
  const dxyz = expectedResults.rows.find((r) => r.ticker === "DXYZ");
  assert.equal(ex.basis, "filed-fv-equiv");
  assert.equal(ex.reportedFairValue, 134392500);
  assert.equal(ex.price, 32.84);
  assert.ok(Math.abs(ex.impliedExposure - dxyz.anthPct) < 1e-15);
  assert.ok(Math.abs(ex.per100 - dxyz.anthPer100) < 1e-9);
  assert.ok(Math.abs(ex.wrapperValue - dxyz.wrapperValue) < 1e-2);
  assert.match(expected, /reference\/fixtures\.json/);
});

test("disclosure.asOf fails CI when older than 30 days", () => {
  assert.equal(DISCLOSURE_MAX_AGE_DAYS, 30);
  assert.equal(
    disclosureAgeDays("2026-08-19", new Date("2026-09-18T12:00:00-04:00")),
    30
  );
  assert.doesNotThrow(() =>
    assertDisclosureFresh(
      "2026-08-19",
      new Date("2026-09-18T12:00:00-04:00")
    )
  );
  assert.throws(
    () =>
      assertDisclosureFresh(
        "2026-08-19",
        new Date("2026-09-19T12:00:00-04:00")
      ),
    /31d old/
  );
  assertDisclosureFresh(disclosure.asOf);
});

test("README is the dataset front door, not Create-Next-App boilerplate", () => {
  assert.match(readme, /^# Pre-IPO Anthropic & OpenAI Exposure — Open Data/m);
  assert.match(readme, /## Development[\s\S]*npm run sync:readme/);
  const developmentAt = readme.indexOf("## Development");
  const firstHeading = readme.indexOf("# ");
  assert.ok(developmentAt > firstHeading);
  assert.doesNotMatch(readme, /Create Next App|create-next-app|geist/i);
  assert.doesNotMatch(readme, /get started by editing/i);
  assert.doesNotMatch(readme, /best proxy|most attractive|recommended wrapper/i);
});
