import test from "node:test";
import assert from "node:assert/strict";
import {
  fullyDilutedAt, valuationFromPrice, priceFromValuation, basisLabel, laneBasis, assertLanes,
  NATIVE, UNCONFIRMED, publicBenefitTrigger, preSplitUnitPrice, OPTION_EXERCISE_PROCEEDS,
} from "../lib/shareBasis.mjs";
import capitalization from "../data/capitalization.json" with { type: "json" };

const ipo = capitalization.anthropic.ipo;

test("s1a2 fully diluted table sums to 18,012,993,381 at $74 (S-1/A No. 2 p. 24)", () => {
  const c = ipo.fullyDilutedTable.columns;
  assert.equal(c.classA + c.classN + c.optionsNetTreasury + c.rsus + c.classTF, 18012993381);
  assert.equal(ipo.fullyDilutedTable.total, 18012993381);
  assert.equal(fullyDilutedAt(74), 18012993381);
  assert.equal(ipo.fullyDilutedTable.options.gross - ipo.fullyDilutedTable.options.treasuryReductionAtTablePrice, c.optionsNetTreasury);
  assert.equal(ipo.fullyDilutedTable.rsus.unvestedAt0930 + ipo.fullyDilutedTable.rsus.grantedAfter0930, c.rsus);
  assert.equal(ipo.fullyDilutedTable.amazonNotes.sharesIssuableAtFixedPrice - ipo.fullyDilutedTable.amazonNotes.convertAtIpoShares, ipo.fullyDilutedTable.rolloverNotesClassN);
  assert.ok(Math.abs(OPTION_EXERCISE_PROCEEDS / ipo.fullyDilutedTable.options.gross - 2.91) < 0.005);
});

test("outstanding after offering and placement reconciles (S-1/A No. 2 pp. 19–20)", () => {
  const o = ipo.outstandingAfterOffering;
  assert.equal(o.classA + o.classN + o.classT + o.classF, o.total);
  assert.equal(o.total + ipo.offering.underwriterOptionClassA, o.totalWithOption);
  assert.equal(ipo.concurrentPlacement.investors.reduce((s, i) => s + i.sharesAtMidpoint, 0), ipo.concurrentPlacement.sharesAtMidpoint);
  assert.equal(ipo.offering.primaryClassA + ipo.offering.secondaryClassA, ipo.offering.totalClassA);
});

test("spot checks: $74 → $968B outstanding / $1,333B fully diluted; range table", () => {
  const rows = [[70, 916, 1261], [74, 968, 1333], [78, 1021, 1405]];
  for (const [p, out, fd] of rows) {
    assert.equal(Math.round(valuationFromPrice(p, "outstanding").value / 1e9), out);
    assert.equal(Math.round(valuationFromPrice(p, "fullyDiluted").value / 1e9), fd);
  }
  assert.equal(valuationFromPrice(74, "fullyDilutedWithOption").shares, 18136743381);
});

test("Polymarket thresholds on 13.087B outstanding", () => {
  assert.equal(priceFromValuation(1.25e12, "outstanding").value.toFixed(2), "95.52");
  assert.equal(priceFromValuation(1.5e12, "outstanding").value.toFixed(2), "114.62");
  assert.equal(priceFromValuation(1.75e12, "outstanding").value.toFixed(2), "133.72");
  assert.equal(priceFromValuation(2e12, "outstanding").value.toFixed(2), "152.83");
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
  const v = valuationFromPrice(74, "outstanding");
  assert.equal(v.basis, "outstanding");
  assert.equal(v.label, "on 13.09B outstanding");
  assert.equal(basisLabel("fullyDiluted"), "on 18.01B fully diluted");
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
