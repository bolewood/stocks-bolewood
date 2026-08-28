import assert from "node:assert/strict";
import { test } from "node:test";
import { etCivilToUtc } from "../lib/priceState.mjs";
import {
  buildIndexSeries,
  buildOvernightSamples,
  buildRthReturnSamples,
  bucketOvernightSamples,
  etMinuteKey,
  isNyseSessionDate,
  linearRegression,
  marketCloseMs,
  marketOpenMs,
  modeledAssetWeights,
  simpleReturn,
  weightedTapeReturn,
  weightedPrivateReturn,
} from "../lib/privateTape.mjs";
import {
  PRIVATE_TAPE_DATA_COLUMNS,
  PRIVATE_TAPE_ENDPOINTS,
  privateTapeOpenDataManifest,
} from "../lib/privateTapeManifest.mjs";

const point = (endMs, close) => ({ endMs, close });

test("Private Tape two-asset weights normalize DXYZ June 30 Anthropic and SpaceX exposure", () => {
  const weights = modeledAssetWeights();
  assert.ok(Math.abs(weights.totalFiledWeight - 0.249) < 1e-12);
  assert.ok(Math.abs(weights.anthropic - 0.5783132530120482) < 1e-10);
  assert.ok(Math.abs(weights.spacex - 0.42168674698795183) < 1e-10);
  assert.ok(Math.abs(simpleReturn(100, 112) - 0.12) < 1e-12);
  assert.ok(
    Math.abs(weightedPrivateReturn({ anthropic: 0.10, spacex: -0.02 }) - 0.04939759036144578) <
      1e-10
  );
  assert.equal(
    weightedTapeReturn({ anthropic: 0.10, spacex: -0.02 }),
    weightedPrivateReturn({ anthropic: 0.10, spacex: -0.02 })
  );
});

test("Private Tape open-data manifest distinguishes private ANTH from public SPCX tape", () => {
  const manifest = privateTapeOpenDataManifest();
  assert.equal(manifest.staticConfigPath, "data/private-tape.json");
  assert.equal(manifest.schemaPath, "data/schema/private-tape.schema.json");
  assert.equal(manifest.endpoints.manifest, PRIVATE_TAPE_ENDPOINTS.manifest);
  assert.equal(manifest.liveMarketData.redistributedInRepo, false);
  assert.ok(manifest.usageBoundary.includes("not a recommendation"));
  assert.ok(manifest.sources.kucoinEntropyContext.includes("kucoin.com/news"));
  assert.ok(manifest.sources.spacexIpoPricing.includes("ir.spacex.com"));
  assert.ok(manifest.sources.nasdaqSpacexListing.includes("nasdaqtrader.com"));
  assert.equal(manifest.returnConvention.type, "simple_return");
  assert.ok(manifest.modeledSleeve.marketStructureNote.includes("public trading under SPCX"));
  assert.ok(manifest.caveats.some((caveat) => caveat.includes("SPCX is now a public")));
  assert.ok(
    manifest.datasets
      .find((dataset) => dataset.id === "overnight")
      .columns.includes("weighted_tape_return")
  );
  assert.ok(PRIVATE_TAPE_DATA_COLUMNS.rth.includes("dxyz_return"));
  assert.ok(Math.abs(manifest.modeledSleeve.weights.anthropic - 0.5783132530120482) < 1e-10);
});

test("NYSE session calendar handles 2026 holidays and DST boundaries", () => {
  assert.equal(isNyseSessionDate("2026-04-03"), false); // Good Friday
  assert.equal(isNyseSessionDate("2026-06-19"), false); // Juneteenth
  assert.equal(isNyseSessionDate("2026-07-03"), false); // July 4 observed
  assert.equal(isNyseSessionDate("2026-08-27"), true);

  assert.equal(etMinuteKey(marketCloseMs("2026-03-06")), "2026-03-06T16:00");
  assert.equal(etMinuteKey(marketOpenMs("2026-03-09")), "2026-03-09T09:30");
  assert.equal(marketCloseMs("2026-03-06"), Date.UTC(2026, 2, 6, 21, 0));
  assert.equal(marketOpenMs("2026-03-09"), Date.UTC(2026, 2, 9, 13, 30));
});

test("overnight samples use only private prints available before the DXYZ open", () => {
  const start = marketCloseMs("2026-04-02");
  const open = marketOpenMs("2026-04-06");
  const afterOpen = open + 30 * 60 * 1000;
  const rows = buildOvernightSamples({
    dxyzDaily: [
      { date: "2026-04-02", open: 9, close: 10 },
      { date: "2026-04-06", open: 11, close: 12 },
    ],
    qqqDaily: [
      { date: "2026-04-02", open: 98, close: 100 },
      { date: "2026-04-06", open: 101, close: 102 },
    ],
    anthropic: [point(start, 100), point(open, 110), point(afterOpen, 999)],
    spacex: [point(start, 200), point(open, 198), point(afterOpen, 999)],
  });

  assert.equal(rows.length, 1);
  assert.equal(rows[0].date, "2026-04-06");
  assert.equal(rows[0].priorDate, "2026-04-02");
  assert.equal(rows[0].anthropicEndAtMs, open);
  assert.equal(rows[0].spacexEndAtMs, open);
  assert.ok(Math.abs(rows[0].anthropic - 0.1) < 1e-12);
  assert.equal(rows[0].spacex, -0.010000000000000009);
  assert.equal(rows[0].dxyzGap, 0.10000000000000009);
  assert.equal(rows[0].qqqGap, 0.010000000000000009);
});

test("RTH return samples require overlapping same-day windows and skip overnight gaps", () => {
  const t1000 = etCivilToUtc(2026, 8, 27, 10, 0);
  const t1030 = etCivilToUtc(2026, 8, 27, 10, 30);
  const nextDay = etCivilToUtc(2026, 8, 28, 10, 0);
  const rows = buildRthReturnSamples({
    dxyz: [point(t1000, 100), point(t1030, 101), point(nextDay, 120)],
    anthropic: [point(t1000, 2000), point(t1030, 2020), point(nextDay, 2060)],
    spacex: [point(t1000, 150), point(t1030, 147), point(nextDay, 148)],
    qqq: [point(t1000, 600), point(t1030, 603), point(nextDay, 610)],
  });

  assert.equal(rows.length, 1);
  assert.equal(rows[0].date, "2026-08-27");
  assert.equal(rows[0].timeEt, "10:30");
  assert.equal(rows[0].dxyz, 0.010000000000000009);
  assert.equal(rows[0].anthropic, 0.010000000000000009);
  assert.equal(rows[0].spacex, -0.020000000000000018);
  assert.equal(rows[0].qqq, 0.004999999999999893);
});

test("DXYZ tape sleeve normalizes unlike quote units to the first common observation", () => {
  const close1 = marketCloseMs("2026-08-26");
  const close2 = marketCloseMs("2026-08-27");
  const weights = modeledAssetWeights();
  const series = buildIndexSeries({
    dxyzDaily: [
      { date: "2026-08-26", close: 50 },
      { date: "2026-08-27", close: 55 },
    ],
    anthropic: [point(close1, 1000), point(close2, 1100)],
    spacex: [point(close1, 200), point(close2, 180)],
  });

  assert.equal(series.length, 2);
  assert.equal(series[0].privateIndex, 100);
  assert.equal(series[0].tapeSleeveIndex, 100);
  assert.equal(series[0].dxyzIndex, 100);
  assert.ok(
    Math.abs(
      series[1].tapeSleeveIndex -
        100 * (weights.anthropic * 1.1 + weights.spacex * 0.9)
    ) < 1e-10
  );
  assert.equal(series[1].privateIndex, series[1].tapeSleeveIndex);
  assert.equal(series[1].dxyzIndex, 110.00000000000001);
});

test("OLS residual regression recovers a simple multi-factor return model", () => {
  const samples = Array.from({ length: 12 }, (_, i) => {
    const anthropic = i / 100;
    const spacex = ((i * 2) % 7) / 100;
    const qqq = ((i * 3) % 5) / 100;
    return {
      anthropic,
      spacex,
      qqq,
      dxyz: 0.001 + 2 * anthropic - 3 * spacex + 0.5 * qqq,
    };
  });
  const fit = linearRegression(samples, "dxyz", ["anthropic", "spacex", "qqq"]);
  assert.ok(fit);
  assert.ok(Math.abs(fit.intercept - 0.001) < 1e-10);
  assert.ok(Math.abs(fit.slopes.anthropic - 2) < 1e-10);
  assert.ok(Math.abs(fit.slopes.spacex + 3) < 1e-10);
  assert.ok(Math.abs(fit.slopes.qqq - 0.5) < 1e-10);
});

test("overnight buckets preserve requested threshold order", () => {
  const buckets = bucketOvernightSamples([
    { weightedReturn: 0.04, dxyzGap: 0.08 },
    { weightedReturn: 0.02, dxyzGap: 0.03 },
    { weightedReturn: 0, dxyzGap: 0.01 },
    { weightedReturn: -0.02, dxyzGap: -0.03 },
    { weightedReturn: -0.04, dxyzGap: -0.07 },
  ]);
  assert.deepEqual(
    buckets.map((b) => b.label),
    ["> +3%", "+1% to +3%", "-1% to +1%", "-3% to -1%", "< -3%"]
  );
  assert.deepEqual(
    buckets.map((b) => b.n),
    [1, 1, 1, 1, 1]
  );
});
