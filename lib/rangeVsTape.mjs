// "The roadshow range vs the tape": one per-share axis, one lane per share
// basis. A converted mark is only ever drawn in the lane of its own basis, so
// two converted marks on the same row always share a basis (laneBasis throws
// otherwise). Native per-share prices (range, round price, NAV mark) need no
// conversion and are drawn on the shared axis.
import { NATIVE, UNCONFIRMED, RANGE, assertLanes, basisLabel, priceFromValuation } from "./shareBasis.mjs";
import capitalization from "../data/capitalization.json" with { type: "json" };

const presets = Object.fromEntries(capitalization.anthropic.ipo.scenarioPresets.map((p) => [p.key, p]));

export const PERP_BASES = ["fullyDiluted", "outstanding"];

export function nativeMarks() {
  return [
    { key: "seriesH", label: "Series H", price: presets.seriesH.price, basis: NATIVE, live: false, citation: "S-1 p. F-47 ($589.0095 pre-split ÷ 10)" },
    { key: "dxyzJune", label: "DXYZ June mark", price: presets.dxyzJune.price, basis: NATIVE, live: false, citation: "DXYZ June 30, 2026 NPORT-P ($610.41 per pre-split unit ÷ 10)" },
  ];
}

/**
 * @param {object} p
 * @param {number|null} p.perpMarkB io:ANTH mark ($B of implied valuation)
 * @param {"fullyDiluted"|"outstanding"} p.perpBasis basis chosen for the perp
 * @param {number|null} p.polymarketExpectedT Polymarket expected first-day close ($T)
 * @param {Array} p.thirdParty thirdPartyValuations records
 */
export function buildRangeVsTape({ perpMarkB = null, perpBasis = "fullyDiluted", polymarketExpectedT = null, thirdParty = [] } = {}) {
  if (!PERP_BASES.includes(perpBasis)) throw new Error(`Unknown perp basis ${perpBasis}`);
  const lanes = {
    outstanding: { key: "outstanding", title: "On shares outstanding", marks: [] },
    fullyDiluted: { key: "fullyDiluted", title: "On fully diluted shares", marks: [] },
    unconfirmed: { key: "unconfirmed", title: "Basis unconfirmed", marks: [] },
  };
  if (polymarketExpectedT > 0) {
    const c = priceFromValuation(polymarketExpectedT * 1e12, "outstanding");
    lanes.outstanding.marks.push({ key: "polymarket", label: "Polymarket expected first-day close", price: c.value, basis: "outstanding", live: true, valuation: polymarketExpectedT * 1e12, detail: `$${polymarketExpectedT.toFixed(3)}T ${c.label} (its resolution basis)` });
  }
  if (perpMarkB > 0) {
    const c = priceFromValuation(perpMarkB * 1e9, perpBasis);
    const otherBasis = perpBasis === "fullyDiluted" ? "outstanding" : "fullyDiluted";
    const o = priceFromValuation(perpMarkB * 1e9, otherBasis);
    lanes[perpBasis].marks.push({ key: "perp", label: "io:ANTH mark", price: c.value, basis: perpBasis, live: true, valuation: perpMarkB * 1e9, detail: `$${(perpMarkB / 1000).toFixed(3)}T ${c.label}`, alt: { price: o.value, basis: otherBasis, label: o.label } });
  }
  for (const t of thirdParty || []) {
    if (t.basis === UNCONFIRMED) {
      const fd = priceFromValuation(t.equityValueUsd, "fullyDiluted");
      const out = priceFromValuation(t.equityValueUsd, "outstanding");
      lanes.unconfirmed.marks.push({ key: t.key, label: t.label, price: fd.value, priceHigh: out.value, basis: UNCONFIRMED, live: false, valuation: t.equityValueUsd, detail: `$${(t.equityValueUsd / 1e12).toFixed(3)}T: $${fd.value.toFixed(2)} ${fd.label} – $${out.value.toFixed(2)} ${out.label}` });
    } else {
      const c = priceFromValuation(t.equityValueUsd, t.basis);
      lanes[t.basis].marks.push({ key: t.key, label: t.label, price: c.value, basis: t.basis, live: false, valuation: t.equityValueUsd, siteConversion: !!t.siteConversion, detail: `$${(t.equityValueUsd / 1e12).toFixed(3)}T ${c.label}${t.siteConversion ? " (site conversion)" : ""}` });
    }
  }
  // Enforce the rule on exactly what will be rendered.
  const bases = assertLanes(Object.fromEntries(Object.entries(lanes).map(([k, l]) => [k, l.marks])));
  for (const [k, b] of Object.entries(bases)) if (b !== NATIVE && b !== k) throw new Error(`Lane ${k} holds ${b} marks`);
  const natives = nativeMarks();
  const prices = [RANGE.low, RANGE.high, ...natives.map((m) => m.price), ...Object.values(lanes).flatMap((l) => l.marks.flatMap((m) => [m.price, m.priceHigh].filter(Number.isFinite)))];
  const min = Math.min(60, Math.floor(Math.min(...prices) / 10) * 10);
  const max = Math.max(140, Math.ceil(Math.max(...prices) / 10) * 10);
  return {
    axis: { min, max },
    range: { low: RANGE.low, high: RANGE.high, midpoint: RANGE.midpoint },
    natives,
    lanes: Object.values(lanes).filter((l) => l.marks.length).map((l) => ({ ...l, basisLabel: l.key === UNCONFIRMED ? "basis unconfirmed: shown on both counts" : basisLabel(l.key) })),
  };
}
