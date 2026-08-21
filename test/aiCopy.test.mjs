import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const finder = readFileSync(
  join(root, "components", "AIPerDollarFinder.jsx"),
  "utf8"
);
const page = readFileSync(join(root, "app", "ai", "page.jsx"), "utf8");

test("headline uses 'and'; title and og:title use '&' plus the site suffix", () => {
  assert.match(
    finder,
    /Pre-IPO Anthropic and OpenAI per \$100/
  );
  assert.match(page, /title: "Pre-IPO Anthropic & OpenAI per \$100"/);
  assert.match(
    page,
    /OG_TITLE = "Pre-IPO Anthropic & OpenAI per \$100 \| stocks\.bolewood\.com"/
  );
  assert.notEqual(
    "Pre-IPO Anthropic and OpenAI per $100",
    "Pre-IPO Anthropic & OpenAI per $100 | stocks.bolewood.com"
  );
});

test("subtitle says estimated exposure of wrapper value, not market cap", () => {
  assert.match(finder, /Estimated Anthropic and OpenAI exposure per \$100 of wrapper value/);
  assert.match(finder, /curated denominator inputs/);
  assert.doesNotMatch(finder, /wrapper market\s*cap/);
  assert.doesNotMatch(finder, /curated share counts/);
  assert.doesNotMatch(page, /wrapper market cap/);
  assert.doesNotMatch(page, /curated share counts/);
});

test("open-data callout sits above Sources & footnotes with a two-line audit prompt", () => {
  const calloutAt = finder.indexOf("<OpenDataCallout />");
  const sourcesAt = finder.indexOf("Sources & footnotes");
  assert.ok(calloutAt >= 0 && sourcesAt > calloutAt);
  assert.match(finder, /Underlying Open Source Data/);
  assert.match(finder, /github\.com\/bolewood\/stocks-bolewood/);
  const promptMatch = finder.match(
    /export const OPEN_DATA_AUDIT_PROMPT = `([^`]+)`/
  );
  assert.ok(promptMatch, "OPEN_DATA_AUDIT_PROMPT is a template literal");
  const lines = promptMatch[1].split("\n");
  assert.equal(lines.length, 2);
  assert.match(lines[0], /github\.com\/bolewood\/stocks-bolewood/);
  assert.match(lines[0], /npm run reference/);
  assert.match(lines[1], /derived \(not stored\)/);
  assert.match(lines[1], /expected-results\.json/);
});

test("/ai polls Yahoo-backed prices with cache: no-store", () => {
  assert.match(finder, /startJsonPoll\("\/api\/ai-prices"/);
});
