import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import {
  disclosureBannerText,
  disclosureSentence,
  extractReadmeDisclosureSection,
  isHeldTicker,
  renderReadmeDisclosureSection,
} from "../lib/disclosure.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const disclosure = JSON.parse(
  readFileSync(join(root, "data", "disclosure.json"), "utf8")
);
const readme = readFileSync(join(root, "README.md"), "utf8");

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
  assert.equal(
    disclosureSentence(disclosure),
    "As of August 19, 2026, the author holds long positions in DXYZ, SKM, ZM, AMZN, GOOG and NVDA. The DXYZ exposure includes options. Positions are subject to change without notice."
  );
  assert.equal(
    disclosureBannerText(disclosure),
    "Disclosure: As of August 19, 2026, the author holds long positions in DXYZ, SKM, ZM, AMZN, GOOG and NVDA. The DXYZ exposure includes options. Positions are subject to change without notice."
  );
  for (const t of disclosure.tickers) {
    assert.equal(isHeldTicker(t, disclosure), true);
  }
  assert.equal(isHeldTicker("ARKVX", disclosure), false);
});

test("README generated disclosure section matches data/disclosure.json", () => {
  const expected = renderReadmeDisclosureSection(disclosure);
  const actual = extractReadmeDisclosureSection(readme);
  assert.ok(actual, "README is missing BEGIN/END GENERATED DISCLOSURE markers");
  assert.equal(actual, expected);
});
