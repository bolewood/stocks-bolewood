import test from "node:test";
import assert from "node:assert/strict";
import {
  fullyDilutedAt, valuationFromPrice, priceFromValuation, basisLabel, laneBasis, assertLanes,
  NATIVE, UNCONFIRMED, publicBenefitTrigger, preSplitUnitPrice, OPTION_EXERCISE_PROCEEDS,
} from "../lib/shareBasis.mjs";
import capitalization from "../data/capitalization.json" with { type: "json" };

const ipo = capitalization.anthropic.ipo;

test("424B4 fully diluted table sums to 18,137,587,875 at the $83 IPO price (424B4 p. 26)", () => {
  const c = ipo.fullyDilutedTable.columns;
  assert.equal(ipo.ipoPrice.price, 83);
  assert.equal(ipo.fullyDilutedTable.atPrice, 83);
  assert.equal(c.classA + c.classN + c.optionsNetTreasury + c.rsus + c.classTF, 18137587875);
  assert.equal(ipo.fullyDilutedTable.total, 18137587875);
  assert.equal(fullyDilutedAt(83), 18137587875);
  // Same ~$5.163B exercise proceeds as S-1/A No. 2's table at $74 (69,774,828 × 74).
  assert.ok(Math.abs(OPTION_EXERCISE_PROCEEDS - 69_774_828 * 74) < 100);
  assert.equal(ipo.fullyDilutedTable.options.gross - ipo.fullyDilutedTable.options.treasuryReductionAtTablePrice, c.optionsNetTreasury);
  assert.equal(ipo.fullyDilutedTable.rsus.unvestedAt0930 + ipo.fullyDilutedTable.rsus.grantedAfter0930, c.rsus);
  assert.equal(ipo.fullyDilutedTable.amazonNotes.sharesIssuableAtFixedPrice - ipo.fullyDilutedTable.amazonNotes.convertAtIpoShares, ipo.fullyDilutedTable.rolloverNotesClassN);
  assert.ok(Math.abs(OPTION_EXERCISE_PROCEEDS / ipo.fullyDilutedTable.options.gross - 2.91) < 0.005);
});

test("outstanding after offering and placement reconciles (424B4 pp. 20–21)", () => {
  const o = ipo.outstandingAfterOffering;
  assert.equal(o.classA + o.classN + o.classT + o.classF, o.total);
  assert.equal(o.total + ipo.offering.underwriterOptionClassA, o.totalWithOption);
  assert.equal(ipo.concurrentPlacement.investors.reduce((s, i) => s + i.shares, 0), ipo.concurrentPlacement.shares);
  assert.equal(ipo.concurrentPlacement.shares, 313_253_007);
  assert.equal(o.total, 13_219_642_276);
  assert.equal(o.classN, 4_789_697_318 + o.publicBenefitFundClassN);
  assert.equal(ipo.offering.primaryClassA + ipo.offering.secondaryClassA, ipo.offering.totalClassA);
});

test("spot checks: $83 → $1,097B outstanding / $1,505B fully diluted; range table", () => {
  const rows = [[70, 925, 1269], [74, 978, 1342], [78, 1031, 1414], [83, 1097, 1505]];
  for (const [p, out, fd] of rows) {
    assert.equal(Math.round(valuationFromPrice(p, "outstanding").value / 1e9), out);
    assert.equal(Math.round(valuationFromPrice(p, "fullyDiluted").value / 1e9), fd);
  }
  assert.equal(valuationFromPrice(83, "fullyDilutedWithOption").shares, 18284587875);
});

test("Polymarket thresholds on 13.22B outstanding", () => {
  assert.equal(priceFromValuation(1.25e12, "outstanding").value.toFixed(2), "94.56");
  assert.equal(priceFromValuation(1.5e12, "outstanding").value.toFixed(2), "113.47");
  assert.equal(priceFromValuation(1.75e12, "outstanding").value.toFixed(2), "132.38");
  assert.equal(priceFromValuation(2e12, "outstanding").value.toFixed(2), "151.29");
});

test("priceFromValuation inverts valuationFromPrice on every basis", () => {
  for (const basis of ["outstanding", "fullyDiluted", "fullyDilutedWithOption"]) {
    for (const p of [20, 61.04, 74, 128, 400]) {
      const v = valuationFromPrice(p, basis).value;
      assert.ok(Math.abs(priceFromValuation(v, basis).value - p) < 1e-9, `${basis} ${p}`);
    }
  }
});

test("every conversion names its basis", () => {
  const v = valuationFromPrice(83, "outstanding");
  assert.equal(v.basis, "outstanding");
  assert.equal(v.label, "on 13.22B outstanding");
  assert.equal(basisLabel("fullyDiluted"), "on 18.14B fully diluted");
  assert.equal(priceFromValuation(1e12, "fullyDiluted").basis, "fullyDiluted");
});

test("MIXED SHARE BASES FAIL: one lane may not mix outstanding and fully diluted", () => {
  const polymarket = { key: "polymarket", price: 120, basis: "outstanding" };
  const perpFd = { key: "perp", price: 93, basis: "fullyDiluted" };
  assert.throws(() => laneBasis([polymarket, perpFd]), /Mixed share bases/);
  assert.throws(() => laneBasis([{ key: "x", price: 1 }]), /no basis/);
  // Native prices (range, round prices, NAV marks) may join any lane.
  assert.equal(laneBasis([{ key: "range", basis: NATIVE }, polymarket]), "outstanding");
  // An unconfirmed-basis mark never shares a lane with another converted mark.
  assert.throws(() => laneBasis([{ key: "ms", basis: UNCONFIRMED }, perpFd]), /Mixed share bases/);
  assert.throws(() => laneBasis([{ key: "a", basis: UNCONFIRMED }, { key: "b", basis: UNCONFIRMED }]), /Mixed share bases/);
  assert.deepEqual(assertLanes({ above: [polymarket], below: [perpFd] }), { above: "outstanding", below: "fullyDiluted" });
});

test("public-benefit trigger and pre-split unit price", () => {
  assert.equal(publicBenefitTrigger(null), null);
  assert.equal(publicBenefitTrigger(74), 111);
  assert.equal(preSplitUnitPrice(74), 740);
});

import { buildRangeVsTape } from "../lib/rangeVsTape.mjs";
import tape from "../data/anthropic-investor-day.json" with { type: "json" };

test("range-vs-tape panel never mixes share bases in a lane, for either perp basis", () => {
  for (const perpBasis of ["fullyDiluted", "outstanding"]) {
    const v = buildRangeVsTape({ perpMarkB: 1674.5, perpBasis, polymarketExpectedT: 1.42, thirdParty: tape.thirdPartyValuations });
    for (const lane of v.lanes) {
      const bases = new Set(lane.marks.map((m) => m.basis));
      assert.equal(bases.size, 1, `${lane.key} mixes ${[...bases]}`);
      assert.equal([...bases][0], lane.key);
    }
    const perp = v.lanes.flatMap((l) => l.marks).find((m) => m.key === "perp");
    assert.equal(perp.basis, perpBasis);
    assert.ok(perp.alt && perp.alt.basis !== perpBasis, "tooltip carries the other conversion");
    assert.ok(v.axis.min <= 58.90095 && v.axis.max >= 129);
  }
  const fd = buildRangeVsTape({ perpMarkB: 1674.5, perpBasis: "fullyDiluted", thirdParty: tape.thirdPartyValuations });
  const perp = fd.lanes.find((l) => l.key === "fullyDiluted").marks.find((m) => m.key === "perp");
  assert.equal(Math.round(perp.price), 92);
  assert.equal(Math.round(perp.alt.price), 127);
  const dam = fd.lanes.find((l) => l.key === "fullyDiluted").marks.find((m) => m.key === "damodaran");
  assert.equal(dam.price.toFixed(1), "81.4");
  const ms = fd.lanes.find((l) => l.key === "unconfirmed").marks.find((m) => m.key === "morningstar");
  assert.ok(ms.price > 93.5 && ms.price < 94 && ms.priceHigh > 128 && ms.priceHigh < 129.5);
});

test("every third-party valuation names a basis; unknown is unconfirmed", () => {
  for (const t of tape.thirdPartyValuations) assert.ok(["outstanding", "fullyDiluted", "unconfirmed"].includes(t.basis), t.key);
  assert.equal(tape.thirdPartyValuations.find((t) => t.key === "morningstar").basis, "unconfirmed");
});

import { headlineValuations } from "../lib/rangeVsTape.mjs";
import { readFileSync } from "node:fs";

test("tape headline $T values (hero and Polymarket tile) each carry a share basis and a per-share figure", () => {
  const h = headlineValuations({ perps: { anthropic: { markPx: 1700 } }, polymarket: { expectedClose: { valueT: 1.43 } } });
  assert.equal(h.perp.basis, "fullyDiluted");
  assert.equal(h.polymarket.basis, "outstanding");
  assert.match(h.perp.basisText, /fully diluted/);
  assert.match(h.polymarket.basisText, /outstanding/);
  // On $T the perp looks higher; per share on their own bases it is lower. Both must be shown.
  assert.ok(h.perp.valueT > h.polymarket.valueT && h.perp.perShare.value < h.polymarket.perShare.value);
  const src = readFileSync(new URL("../components/InvestorDayTape.jsx", import.meta.url), "utf8");
  assert.match(src, /headline\.perp\?\.basisText/);
  assert.match(src, /headline\.polymarket\?\.basisText/);
});
