// Canonical exposure identities. No UI, no app imports.
// FV-equivalent % = reported fair value ÷ the company valuation that produced it.

export function markById(marks, id) {
  if (!id || !marks?.companies) return null;
  for (const company of Object.values(marks.companies)) {
    const hit = (company.rounds || []).find((r) => r.id === id);
    if (hit) return hit;
  }
  return null;
}

export function markPostMoney(marks, id) {
  const mark = markById(marks, id);
  return mark?.postMoney > 0 ? mark.postMoney : null;
}

export function impliedExposure(leg, marks) {
  if (!leg) return null;
  switch (leg.basis) {
    case "disclosed":
    case "pro-forma":
    case "historical":
      return leg.ownershipPct > 0 ? leg.ownershipPct : null;
    case "estimate":
      return leg.estimatedOwnershipPct > 0 ? leg.estimatedOwnershipPct : null;
    case "filed-fv-equiv": {
      const round = markPostMoney(marks, leg.measurementCompanyMark);
      if (!(leg.reportedFairValue > 0) || !(round > 0)) return null;
      return leg.reportedFairValue / round;
    }
    case "carrying-value-equiv": {
      const round = markPostMoney(marks, leg.measurementCompanyMark);
      if (!(leg.reportedCarryingValue > 0) || !(round > 0)) return null;
      return leg.reportedCarryingValue / round;
    }
    case "round-implied": {
      const round = markPostMoney(marks, leg.roundPostMoneyValuation);
      if (!(leg.investmentAmount > 0) || !(round > 0)) return null;
      return leg.investmentAmount / round;
    }
    case "commitment":
      return null;
    default:
      return null;
  }
}

export function lookThroughPer100({ claimPct, ipoVal, wrapperValue, dilution = 0 }) {
  if (!(wrapperValue > 0) || !(ipoVal > 0) || !(claimPct > 0)) return 0;
  const dil = Math.min(1, Math.max(0, dilution));
  return (claimPct * (1 - dil) * ipoVal * 100) / wrapperValue;
}

export function adsEquivalentShares(ordinary, adr) {
  if (!(ordinary > 0) || !adr) return ordinary;
  if (adr.ordinary && adr.ads) return (ordinary * adr.ads) / adr.ordinary;
  if (adr.ordinaryPerAdr > 0) return ordinary / adr.ordinaryPerAdr;
  return ordinary;
}
