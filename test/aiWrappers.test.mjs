import { test } from "node:test";
import assert from "node:assert/strict";

import { impliedMarch31Shares, FILED } from "../lib/dxyzAtm.mjs";
import {
  ANTHROPIC_ROUND_FEB_2026,
  OPENAI_ROUND_FEB_2026,
  LAST_PRIMARY_ROUNDS,
  WRAPPERS,
  lookThroughPer100,
  fundClaimPct,
  marketCapUsd,
  rowMetrics,
  chipMatching,
  chipMultipleLine,
  fmtLastRoundMultiple,
  parseScenarioSearch,
  serializeScenarioSearch,
  stalenessLevel,
  daysSinceAsOf,
  SCENARIO_CHIPS,
  DEFAULT_ANTH_VAL,
  DEFAULT_OAI_VAL,
  billionsFromLogPos,
  lastRoundTickPct,
  logPosFromBillions,
  fmtSliderTrillions,
} from "../lib/aiWrappers.mjs";
import { parseChartPrice, chartUrl } from "../lib/yahooQuote.mjs";

test("lookThroughPer100 is zero when stake, cap, or IPO val is missing", () => {
  assert.equal(
    lookThroughPer100({
      claimPct: 0.2,
      ipoVal: 1e12,
      marketCap: 0,
    }),
    0
  );
  assert.equal(
    lookThroughPer100({
      claimPct: 0,
      ipoVal: 1e12,
      marketCap: 1e12,
    }),
    0
  );
  assert.equal(
    lookThroughPer100({
      claimPct: 0.2,
      ipoVal: 0,
      marketCap: 1e12,
    }),
    0
  );
});

test("10% dilution scales look-through linearly", () => {
  const base = lookThroughPer100({
    claimPct: 0.2,
    ipoVal: 1e12,
    marketCap: 2e12,
    dilution: 0,
  });
  const haircut = lookThroughPer100({
    claimPct: 0.2,
    ipoVal: 1e12,
    marketCap: 2e12,
    dilution: 0.1,
  });
  assert.ok(Math.abs(haircut - base * 0.9) < 1e-12);
});

test("Aug 7 AMZN pin: 21% × $1T / $2,988B mcap → ~$7.03 per $100", () => {
  // Screenshot table (Aug 7 close): AMZN ~21.0% of Anthropic, mcap $2,988B,
  // @ $1T → printed $7.03. Shares are the 10-Q cover count; price is that
  // cap divided by those shares so both are written down.
  const ownershipPct = 0.21;
  const shares = 10_786_313_572;
  const marketCapPin = 2_988_000_000_000;
  const price = marketCapPin / shares;
  const ipoVal = 1_000_000_000_000;
  const dilution = 0;

  const forward =
    (ownershipPct * (1 - dilution) * ipoVal * 100) / (price * shares);
  const got = lookThroughPer100({
    claimPct: ownershipPct,
    ipoVal,
    marketCap: marketCapUsd(price, shares),
    dilution,
  });

  assert.equal(got, forward);
  // 0.21 × $1T / $2,988B × 100 = 7.028112... — the table rounded to $7.03.
  assert.ok(Math.abs(forward - 7.028112) < 1e-5, `forward=${forward}`);
});

test("Aug 7 DXYZ Anthropic pin: FV / round / $1.25B mcap at $1T", () => {
  // Screenshot table: DXYZ mcap $1.25B, est. 0.0354% of Anthropic @ $1T
  // printed ~$28.32. 0.0354% is 18.1% of the $742.5M portfolio ÷ the Feb
  // 2026 $380B round, rounded. Pins below are the unrounded filed numbers.
  const fairValue = 0.181 * FILED.portfolioValue; // $134,392,500
  const roundVal = ANTHROPIC_ROUND_FEB_2026; // $380,000,000,000
  const shares = impliedMarch31Shares(); // 30,470,724 = round(filed NAV / $24.56)
  const marketCapPin = 1_250_000_000;
  const price = marketCapPin / shares;
  const ipoVal = 1_000_000_000_000;
  const dilution = 0;

  assert.equal(fairValue, 134_392_500);
  assert.equal(shares, 30_470_724);

  const claimPct = fundClaimPct(fairValue, roundVal);
  const forward =
    (fairValue / (price * shares)) * (ipoVal / roundVal) * (1 - dilution) * 100;
  const got = lookThroughPer100({
    claimPct,
    ipoVal,
    marketCap: marketCapUsd(price, shares),
    dilution,
  });

  assert.ok(Math.abs(got - forward) < 1e-12);
  // 134_392_500 / $1.25B × ($1T / $380B) × 100 = 28.29315789...
  // The table's $28.32 used the rounded 0.0354% company stake.
  assert.ok(Math.abs(forward - 28.29315789) < 1e-8, `forward=${forward}`);
});

test("DXYZ OpenAI Series C scales; PPU slice is not in WRAPPERS FV", () => {
  const dxyz = WRAPPERS.find((w) => w.ticker === "DXYZ");
  const seriesC = 0.047 * FILED.portfolioValue;
  const ppus = 0.01 * FILED.portfolioValue;
  assert.equal(dxyz.openai.fairValue, seriesC);
  assert.ok(dxyz.openai.fairValue < seriesC + ppus);
  assert.equal(dxyz.openai.fairValue + ppus, 0.057 * FILED.portfolioValue);
});

test("combined per $100 is the sum of the two legs", () => {
  const amzn = WRAPPERS.find((w) => w.ticker === "AMZN");
  const row = rowMetrics(amzn, 264.655, {
    anthVal: DEFAULT_ANTH_VAL,
    oaiVal: DEFAULT_OAI_VAL,
    dilution: 0,
  });
  assert.ok(row.anthPer100 > 0);
  assert.ok(row.oaiPer100 > 0);
  assert.equal(row.combinedPer100, row.anthPer100 + row.oaiPer100);
});

test("default sliders match no scenario chip", () => {
  assert.equal(chipMatching(DEFAULT_ANTH_VAL, DEFAULT_OAI_VAL), null);
  assert.equal(
    chipMatching(SCENARIO_CHIPS.base.anthVal, SCENARIO_CHIPS.base.oaiVal),
    "base"
  );
  assert.equal(
    chipMatching(SCENARIO_CHIPS.bull.anthVal, SCENARIO_CHIPS.bull.oaiVal),
    "bull"
  );
});

test("AGIX and ARKVX point estimates are single FVs with range in the source note", () => {
  const agix = WRAPPERS.find((w) => w.ticker === "AGIX");
  const arkvx = WRAPPERS.find((w) => w.ticker === "ARKVX");
  assert.equal(agix.anthropic.fairValue, 12_926_025);
  assert.match(agix.anthropic.source, /1\.9–2\.8%/);
  assert.equal(arkvx.anthropic.fairValue, 23_083_673);
  assert.equal(arkvx.openai.fairValue, 72_512_628);
  assert.match(arkvx.anthropic.source, /3\.5–6\.4%/);
  assert.match(arkvx.openai.source, /8\.5–11\.5%/);
});

test("parseChartPrice requires matching symbol and a positive price", () => {
  assert.equal(parseChartPrice({}, "AMZN"), null);
  assert.equal(
    parseChartPrice(
      { chart: { result: [{ meta: { symbol: "ECHO", regularMarketPrice: 10 } }] } },
      "AMZN"
    ),
    null
  );
  assert.equal(
    parseChartPrice(
      { chart: { result: [{ meta: { symbol: "AMZN", regularMarketPrice: 0 } }] } },
      "AMZN"
    ),
    null
  );
  assert.deepEqual(
    parseChartPrice(
      {
        chart: {
          result: [{ meta: { symbol: "AMZN", regularMarketPrice: 264.655 } }],
        },
      },
      "AMZN"
    ),
    { ticker: "AMZN", price: 264.655 }
  );
});

test("chartUrl is the v8 chart path used by /api/prices and /api/ai-prices", () => {
  assert.equal(
    chartUrl("VCX"),
    "https://query1.finance.yahoo.com/v8/finance/chart/VCX?interval=1d&range=1d"
  );
});

test("OpenAI last primary is below Anthropic Series H", () => {
  assert.equal(LAST_PRIMARY_ROUNDS.anthropic.postMoney, 965_000_000_000);
  assert.equal(LAST_PRIMARY_ROUNDS.openai.postMoney, 852_000_000_000);
  assert.ok(
    LAST_PRIMARY_ROUNDS.openai.postMoney < LAST_PRIMARY_ROUNDS.anthropic.postMoney
  );
  assert.equal(LAST_PRIMARY_ROUNDS.asOf, "2026-08-19");
});

test("Base chip multiples are vs last primary rounds", () => {
  const base = SCENARIO_CHIPS.base;
  assert.equal(
    fmtLastRoundMultiple(base.anthVal, LAST_PRIMARY_ROUNDS.anthropic.postMoney),
    "0.67x"
  );
  assert.equal(
    fmtLastRoundMultiple(base.oaiVal, LAST_PRIMARY_ROUNDS.openai.postMoney),
    "1.5x"
  );
  assert.equal(chipMultipleLine(base), "0.67x / 1.5x last round");
});

test("staleness: SKM 2026-01-25 is red and NVDA 2026-02-20 is amber on 2026-08-19", () => {
  const today = new Date(2026, 7, 19); // local Aug 19, 2026
  assert.equal(daysSinceAsOf("2026-01-25", today), 206);
  assert.equal(stalenessLevel("2026-01-25", today), "red");
  assert.equal(daysSinceAsOf("2026-02-20", today), 180);
  assert.equal(stalenessLevel("2026-02-20", today), "amber");
  assert.equal(stalenessLevel("2026-06-30", today), "ok");
  const nvda = WRAPPERS.find((w) => w.ticker === "NVDA");
  assert.equal(nvda.sharesAsOf, "2026-02-20");
  assert.equal(stalenessLevel(nvda.sharesAsOf, today), "amber");
});

test("scenario query params clamp and round-trip", () => {
  const parsed = parseScenarioSearch("?anth=1000&oai=1250&dil=0&sort=combined");
  assert.equal(parsed.anthB, 1000);
  assert.equal(parsed.oaiB, 1250);
  assert.equal(parsed.dilutionPct, 0);
  assert.equal(parsed.sortKey, "combinedPer100");
  assert.equal(
    serializeScenarioSearch(parsed),
    "anth=1000&oai=1250&dil=0&basis=estimated&deploy=range&sort=combined"
  );

  const clamped = parseScenarioSearch("?anth=50&oai=99999&dil=-3&sort=nope");
  assert.equal(clamped.anthB, 500);
  assert.equal(clamped.oaiB, 5000);
  assert.equal(clamped.dilutionPct, 0);
  assert.equal(clamped.sortKey, "combinedPer100");
});

test("IPO sliders are log-mapped $0.5T–$5.0T; display is trillions", () => {
  assert.equal(billionsFromLogPos(0), 500);
  assert.equal(billionsFromLogPos(1000), 5000);
  assert.equal(fmtSliderTrillions(1000), "1.00");
  assert.equal(fmtSliderTrillions(1250), "1.25");
  assert.equal(fmtSliderTrillions(965), "0.965");
  const anthTick = lastRoundTickPct(LAST_PRIMARY_ROUNDS.anthropic.postMoney);
  const oaiTick = lastRoundTickPct(LAST_PRIMARY_ROUNDS.openai.postMoney);
  assert.ok(anthTick > 20 && anthTick < 40, anthTick);
  assert.ok(oaiTick > 15 && oaiTick < 35, oaiTick);
  assert.equal(logPosFromBillions(500), 0);
  assert.equal(logPosFromBillions(5000), 1000);
});

test("AMZN and GOOG are non-linear; funds are Fund NAV; SFTBY has navNote", () => {
  const amzn = WRAPPERS.find((w) => w.ticker === "AMZN");
  const goog = WRAPPERS.find((w) => w.ticker === "GOOG");
  const msft = WRAPPERS.find((w) => w.ticker === "MSFT");
  const nvda = WRAPPERS.find((w) => w.ticker === "NVDA");
  const sftby = WRAPPERS.find((w) => w.ticker === "SFTBY");
  const agix = WRAPPERS.find((w) => w.ticker === "AGIX");
  assert.equal(amzn.security.label, "Conv + Pfd");
  assert.equal(amzn.security.linear, false);
  assert.equal(goog.security.label, "Common (15% cap)");
  assert.equal(goog.security.linear, false);
  assert.equal(msft.security.label, "Equity");
  assert.equal(nvda.security.label, "Undisclosed");
  assert.equal(agix.security.label, "Fund NAV");
  assert.match(sftby.navNote.body, /¥58\.3T/);
  assert.match(sftby.navNote.body, /do not double-count/);
});
