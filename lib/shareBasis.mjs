// Share bases for Anthropic $T <-> $/share conversions.
// Every conversion returns { value, basis, shares, label } so a caller can
// never display a converted number without its basis. Counts are post-split
// ANT shares from dataset s1a2 (S-1/A No. 2, filed 2026-11-10).
import capitalization from "../data/capitalization.json" with { type: "json" };

const IPO = capitalization.anthropic.ipo;
const FD = IPO.fullyDilutedTable;
const OUT = IPO.outstandingAfterOffering;

export const ANTH_IPO = IPO;
export const ANTH_SPLIT = capitalization.anthropic.splitFactor || 10;
export const RANGE = IPO.priceRange;

// Aggregate option exercise proceeds implied by the company's own table:
// reduction 69,774,828 at the $74 table price (S-1/A No. 2 p. 24).
export const OPTION_EXERCISE_PROCEEDS = FD.options.treasuryReductionAtTablePrice * FD.atPrice;

const FD_EX_OPTIONS = FD.columns.classA + FD.columns.classN + FD.columns.rsus + FD.columns.classTF;

/** Fully diluted ANT shares at price P (treasury stock method for options only). */
export function fullyDilutedAt(price = FD.atPrice) {
  if (!(price > 0)) throw new Error("fullyDilutedAt requires a positive price");
  const reduction = Math.min(FD.options.gross, OPTION_EXERCISE_PROCEEDS / price);
  return FD_EX_OPTIONS + FD.options.gross - reduction;
}

export const SHARE_BASES = {
  outstanding: {
    key: "outstanding",
    short: "outstanding",
    citation: "S-1/A No. 2 p. 20",
    shares: () => OUT.total,
  },
  fullyDiluted: {
    key: "fullyDiluted",
    short: "fully diluted",
    citation: "S-1/A No. 2 p. 24 (treasury method at the price shown)",
    shares: (price) => fullyDilutedAt(price),
  },
  fullyDilutedWithOption: {
    key: "fullyDilutedWithOption",
    short: "fully diluted incl. option",
    citation: "S-1/A No. 2 pp. 19, 24",
    shares: (price) => fullyDilutedAt(price) + IPO.offering.underwriterOptionClassA,
  },
};

// Bases that are NOT a share count: a native per-share price (range, round
// price, NAV mark) or a valuation whose source does not state its basis.
export const NATIVE = "native";
export const UNCONFIRMED = "unconfirmed";

export function basisShares(basis, price = FD.atPrice) {
  const b = SHARE_BASES[basis];
  if (!b) throw new Error(`Unknown share basis: ${basis}`);
  return b.shares(price);
}

export function fmtBillionsShares(shares) {
  return `${(shares / 1e9).toFixed(2)}B`;
}

export function basisLabel(basis, price = FD.atPrice) {
  if (basis === NATIVE) return "per-share price";
  if (basis === UNCONFIRMED) return "basis unconfirmed";
  return `on ${fmtBillionsShares(basisShares(basis, price))} ${SHARE_BASES[basis].short}`;
}

/** $/share -> $ valuation on a basis. */
export function valuationFromPrice(price, basis) {
  const shares = basisShares(basis, price);
  return { value: price * shares, basis, shares, label: basisLabel(basis, price) };
}

/**
 * $ valuation -> $/share on a basis. Fully diluted depends on price through the
 * treasury method, so solve V = P × FD(P): P = (V + proceeds) / (FD_ex + gross).
 */
export function priceFromValuation(valuation, basis) {
  if (!(valuation > 0)) throw new Error("priceFromValuation requires a positive valuation");
  let price;
  if (basis === "outstanding") price = valuation / OUT.total;
  else {
    const extra = basis === "fullyDilutedWithOption" ? IPO.offering.underwriterOptionClassA : 0;
    if (!SHARE_BASES[basis]) throw new Error(`Unknown share basis: ${basis}`);
    price = (valuation + OPTION_EXERCISE_PROCEEDS) / (FD_EX_OPTIONS + FD.options.gross + extra);
    // Guard the (never reached in practice) region where proceeds exceed gross.
    if (OPTION_EXERCISE_PROCEEDS / price > FD.options.gross) price = valuation / (FD_EX_OPTIONS + extra);
  }
  const shares = basisShares(basis, price);
  return { value: price, basis, shares, label: basisLabel(basis, price) };
}

/**
 * A converted mark is { price, basis, ... }. Within one lane (one axis or one
 * comparison), every converted mark must share one basis. Native prices are
 * basis-free. "unconfirmed" never equals another basis, so an unconfirmed mark
 * can only share a lane with native prices. Throws on a mixed lane.
 */
export function laneBasis(marks) {
  let basis = null;
  for (const m of marks) {
    if (!m || m.basis == null) throw new Error(`Mark ${m?.key ?? "?"} has no basis`);
    if (m.basis === NATIVE) continue;
    if (m.basis === UNCONFIRMED) {
      if (basis !== null) throw new Error(`Mixed share bases in one lane: ${basis} and ${UNCONFIRMED} (${m.key})`);
      basis = UNCONFIRMED + ":" + m.key; // unique: no other converted mark may join
      continue;
    }
    if (basis !== null && basis !== m.basis) throw new Error(`Mixed share bases in one lane: ${basis} and ${m.basis} (${m.key})`);
    basis = m.basis;
  }
  return basis === null ? NATIVE : basis.startsWith(UNCONFIRMED) ? UNCONFIRMED : basis;
}

export function assertLanes(lanes) {
  return Object.fromEntries(Object.entries(lanes).map(([k, marks]) => [k, laneBasis(marks)]));
}

/** Premium of a per-share price vs a reference price. */
export function premiumTo(price, reference) {
  return price > 0 && reference > 0 ? price / reference - 1 : null;
}

/** Pre-split unit price (wrapper filings) for a post-split ANT price. */
export function preSplitUnitPrice(antPrice) {
  return antPrice * ANTH_SPLIT;
}

/** First public-benefit issuance trigger (IPO price × 1.5), null until priced. */
export function publicBenefitTrigger(ipoPrice, step = 1) {
  if (!(ipoPrice > 0)) return null;
  return ipoPrice * IPO.publicBenefitIssuance.triggerMultiple ** step;
}
