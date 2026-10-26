// Canonical exposure identities. No UI, no app imports.
// When a measurement round has a per-share price (S-1 p. F-47, pre-split),
// FV/carrying legs convert to share-equivalents = FV ÷ roundPricePerShare,
// then divide by the selected fully diluted share count.
import { DEFAULT_ANTH_FD_SHARES, unitPrice, unitExposurePer100 } from './unitExposure.mjs';
export { unitPrice, unitExposurePer100 };

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

export function markPricePerShare(marks, id) {
  const mark = markById(marks, id);
  if (!mark) return null;
  if (mark.pricePerShare > 0) return mark.pricePerShare;
  if (mark.pricePerShareFromMark) {
    const ref = markById(marks, mark.pricePerShareFromMark);
    if (ref?.pricePerShare > 0 && ref.postMoney > 0 && mark.postMoney > 0) {
      return ref.pricePerShare * (mark.postMoney / ref.postMoney);
    }
  }
  return null;
}

export function markImpliedFdShares(marks, id) {
  const mark = markById(marks, id);
  const pps = markPricePerShare(marks, id);
  if (!(mark?.postMoney > 0) || !(pps > 0)) return null;
  return mark.postMoney / pps;
}

export function legShareEquivalents(leg, marks) {
  if (!leg) return null;
  if (leg.basis !== "filed-fv-equiv" && leg.basis !== "carrying-value-equiv") return null;
  const fv = leg.basis === "filed-fv-equiv" ? leg.reportedFairValue : leg.reportedCarryingValue;
  const pps = markPricePerShare(marks, leg.measurementCompanyMark);
  if (!(fv > 0) || !(pps > 0)) return null;
  return fv / pps;
}

export function impliedExposure(leg, marks, { fdShares } = {}) {
  if (!leg) return null;
  switch (leg.basis) {
    case "disclosed":
    case "pro-forma":
    case "historical":
      return leg.ownershipPct > 0 ? leg.ownershipPct : null;
    case "estimate":
      return leg.estimatedOwnershipPct > 0 ? leg.estimatedOwnershipPct : null;
    case "filed-fv-equiv": {
      const shareEquiv = legShareEquivalents(leg, marks);
      if (shareEquiv != null) {
        const denom = fdShares > 0 ? fdShares : DEFAULT_ANTH_FD_SHARES;
        return shareEquiv / denom;
      }
      const round = markPostMoney(marks, leg.measurementCompanyMark);
      if (!(leg.reportedFairValue > 0) || !(round > 0)) return null;
      return leg.reportedFairValue / round;
    }
    case "carrying-value-equiv": {
      const shareEquiv = legShareEquivalents(leg, marks);
      if (shareEquiv != null) {
        const denom = fdShares > 0 ? fdShares : DEFAULT_ANTH_FD_SHARES;
        return shareEquiv / denom;
      }
      const round = markPostMoney(marks, leg.measurementCompanyMark);
      if (!(leg.reportedCarryingValue > 0) || !(round > 0)) return null;
      return leg.reportedCarryingValue / round;
    }
    case "round-implied": {
      const round = markPostMoney(marks, leg.roundPostMoneyValuation);
      if (!(leg.investmentAmount > 0) || !(round > 0)) return null;
      return leg.investmentAmount / round;
    }
    case "filed-units":
    case "commitment":
      return null;
    default:
      return null;
  }
}

export function lookThroughFiledFv({ fairValue, wrapperValue }) {
  if (!(wrapperValue > 0) || !(fairValue > 0)) return 0;
  return (fairValue * 100) / wrapperValue;
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
