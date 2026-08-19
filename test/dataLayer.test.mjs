import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import {
  impliedExposure,
  markPostMoney,
} from "../reference/derive.mjs";
import {
  canonicalTable,
  calculate,
  loadPublicDataset,
  readJson,
} from "../reference/calculate.mjs";
import {
  PRIMARY_REQUIRED_BASES,
  secondaryOnly,
  validateMarks,
  validateWrapper,
} from "../data/schema/validate.mjs";
import { RAW_AI_WRAPPERS, WRAPPERS } from "../lib/loadAiData.mjs";
import {
  FALLBACK_PRICES,
  fundClaimPct,
} from "../lib/aiWrappers.mjs";
import {
  BASIS_ESTIMATED,
  BASIS_FILED,
  DEPLOY_CASH,
  fundRowMetrics,
  resolveFund,
} from "../lib/aiFundBasis.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

test("every wrapper and marks.json validate against the schema", () => {
  const { marks, wrappers } = loadPublicDataset();
  validateMarks(marks);
  for (const w of wrappers) validateWrapper(w, { marks });
  assert.equal(wrappers.length, 11);
});

test("impliedExposure exists only under computed.* and matches a fresh derivation", () => {
  const { marks } = loadPublicDataset();
  for (const raw of RAW_AI_WRAPPERS) {
    const hydrated = WRAPPERS.find((w) => w.ticker === raw.ticker);
    for (const side of ["anthropic", "openai"]) {
      const rawLeg = raw[side];
      const leg = hydrated[side];
      if (!rawLeg) {
        assert.equal(leg, null);
        continue;
      }
      assert.equal(Object.prototype.hasOwnProperty.call(rawLeg, "impliedExposure"), false);
      assert.equal(Object.prototype.hasOwnProperty.call(rawLeg, "value"), false);
      const derived = impliedExposure(rawLeg, marks);
      assert.equal(leg.computed.impliedExposure, derived);
      if (rawLeg.basis === "commitment") {
        assert.equal(derived, null);
      }
    }
  }
});

test("schema rejects a disclosed record whose only source is secondary", () => {
  const { marks, wrappers } = loadPublicDataset();
  const goog = structuredClone(wrappers.find((w) => w.ticker === "GOOG"));
  goog.anthropic.sources = [
    {
      fields: ["ownershipPct"],
      sourceClass: "secondary",
      note: "press only",
    },
  ];
  assert.throws(
    () => validateWrapper(goog, { marks }),
    /requires at least one primary source/
  );
  for (const basis of PRIMARY_REQUIRED_BASES) {
    assert.ok(basis !== "estimate" && basis !== "commitment");
  }
});

test("holdingSecurity, wrapperType and denominatorType are separate fields", () => {
  for (const raw of RAW_AI_WRAPPERS) {
    assert.ok(raw.wrapperType);
    assert.ok(raw.denominatorType);
    for (const side of ["anthropic", "openai"]) {
      if (raw[side]) assert.ok(raw[side].holdingSecurity);
    }
  }
});

test("share count, ADR ratio, TNA and marks each carry as-of and sources", () => {
  const { marks } = loadPublicDataset();
  const skm = RAW_AI_WRAPPERS.find((w) => w.ticker === "SKM");
  assert.equal(skm.shareCount.value, 212_982_275);
  assert.equal(skm.shareCount.asOf, "2025-12-31");
  assert.deepEqual([skm.adrRatio.ordinary, skm.adrRatio.ads], [5, 9]);
  assert.ok(skm.sources.some((s) => s.fields.includes("shareCount")));
  assert.ok(skm.sources.some((s) => s.fields.includes("adrRatio")));

  const arkvx = RAW_AI_WRAPPERS.find((w) => w.ticker === "ARKVX");
  assert.equal(arkvx.totalNetAssets.value, 871_119_657);
  assert.equal(arkvx.totalNetAssets.asOf, "2026-04-30");
  assert.ok(arkvx.sources.some((s) => s.fields.includes("totalNetAssets")));

  for (const company of Object.values(marks.companies)) {
    for (const round of company.rounds) {
      assert.ok(round.postMoney > 0);
      assert.ok(round.sources.length);
    }
  }
});

test("scenario valuation does not change FV-equivalent exposure %", () => {
  const { marks } = loadPublicDataset();
  for (const raw of RAW_AI_WRAPPERS) {
    const w = WRAPPERS.find((x) => x.ticker === raw.ticker);
    const resolved = resolveFund(w, {
      basis: BASIS_FILED,
      deploy: DEPLOY_CASH,
      dxyzBridge: null,
    });
    const price = FALLBACK_PRICES[w.yahooSymbol];
    const lo = fundRowMetrics(w, price, {
      anthVal: 965_000_000_000,
      oaiVal: 852_000_000_000,
      dilution: 0,
      resolved,
    });
    const hi = fundRowMetrics(w, price, {
      anthVal: 2_000_000_000_000,
      oaiVal: 3_000_000_000_000,
      dilution: 0,
      resolved,
    });
    for (const side of ["anthropic", "openai"]) {
      const basis = raw[side]?.basis;
      if (basis !== "filed-fv-equiv" && basis !== "carrying-value-equiv") continue;
      const key = side === "anthropic" ? "anthPct" : "oaiPct";
      assert.equal(lo[key], hi[key], `${w.ticker} ${side} % moved with scenario val`);
      const fv = raw[side].reportedFairValue || raw[side].reportedCarryingValue;
      const round = markPostMoney(
        marks,
        raw[side].measurementCompanyMark
      );
      assert.equal(lo[key], fundClaimPct(fv, round));
    }
  }
});

test("npm run reference reproduces expected-results.json from data/", () => {
  const expected = readJson("reference/expected-results.json");
  const got = canonicalTable(calculate());
  assert.deepEqual(got, expected);
});

test("SKM estimate is secondary-only; disclosed legs are not", () => {
  const skm = RAW_AI_WRAPPERS.find((w) => w.ticker === "SKM");
  assert.equal(secondaryOnly(skm.anthropic), true);
  const msft = RAW_AI_WRAPPERS.find((w) => w.ticker === "MSFT");
  assert.equal(secondaryOnly(msft.openai), false);
  assert.equal(secondaryOnly(msft.anthropic), true);
});

test("production modules do not define ticker-keyed wrapper financials", () => {
  const skip = new Set([
    "lib/loadAiData.mjs",
    "lib/aiWrappers.mjs", // re-exports WRAPPERS; scan body for inline tables
  ]);
  const roots = ["app", "components", "lib"];
  const banned =
    /sharesOutstanding:\s*\d|reportedFairValue|estimatedOwnershipPct|ARKVX_NPORT_TNA\s*=\s*\d|ownershipPct:\s*0\.\d/;
  const hits = [];
  function walk(dir) {
    for (const name of readdirSync(dir, { withFileTypes: true })) {
      const p = join(dir, name.name);
      const rel = p.slice(root.length + 1);
      if (name.isDirectory()) {
        walk(p);
        continue;
      }
      if (!/\.(js|jsx|mjs)$/.test(name.name)) continue;
      if (rel === "lib/loadAiData.mjs") continue;
      if (rel.startsWith("reference/")) continue;
      const src = readFileSync(p, "utf8");
      if (rel === "lib/aiWrappers.mjs" && src.includes("export const WRAPPERS = [")) {
        hits.push(`${rel}: inline WRAPPERS table`);
      }
      if (rel !== "lib/aiWrappers.mjs" && rel !== "lib/loadAiData.mjs" && banned.test(src)) {
        const m = src.match(banned);
        hits.push(`${rel}: ${m[0]}`);
      }
    }
  }
  for (const r of roots) walk(join(root, r));
  assert.deepEqual(hits, []);
  assert.ok(!skip.has("no-op"));
});
