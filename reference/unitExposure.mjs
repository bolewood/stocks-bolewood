// Pure scenario identities, shared by the browser and offline calculator.
import capitalization from '../data/capitalization.json' with { type: 'json' };

export const CAPITALIZATION = capitalization;
export const DEFAULT_ANTH_FD_SHARES = capitalization.anthropic.defaultShares;
export const DEFAULT_OAI_FD_SHARES = capitalization.openai.defaultShares;
export const DEFAULT_DXYZ_OAI_ENTRY_PRICE = capitalization.dxyzOpenaiEntry.defaultPrice;

export function unitPrice({ valuation, fdShares, dilution = 0 }) {
  if (!Number.isFinite(valuation) || valuation < 0 || !Number.isFinite(fdShares) || fdShares <= 0 || !Number.isFinite(dilution) || dilution < 0 || dilution > 1) {
    throw new Error('Unit valuation requires finite nonnegative valuation, positive FD shares and dilution between 0 and 1');
  }
  return valuation * (1 - dilution) / fdShares;
}

export function unitExposurePer100({ units, fdShares, valuation, wrapperValue, dilution = 0 }) {
  if (!Number.isFinite(units) || units < 0 || !(wrapperValue > 0)) throw new Error('Invalid units or wrapper denominator');
  return units * unitPrice({ valuation, fdShares, dilution }) * 100 / wrapperValue;
}

// Resolve quantities before valuation. Neither IPO valuation nor FD shares is
// an acquisition-price input. The subsequent lot never scales with ATM proceeds.
export function unitLots(leg, { includeAcquisition = false, unitScale = 1, entryPrice = DEFAULT_DXYZ_OAI_ENTRY_PRICE } = {}) {
  if (leg?.basis !== 'filed-units') return [];
  const lots = [{ id: 'filed', label: leg.unitLabel || 'Filed holding', units: leg.filedUnits, carryingValue: leg.reportedFairValue ?? null, asOf: leg.unitsAsOf || leg.fairValueAsOf, evidence: 'filed' }];
  if (unitScale > 1) lots.push({ id: 'atm-deployment', label: 'Assumed pro rata deployment of ATM proceeds', units: leg.filedUnits * (unitScale - 1), carryingValue: (leg.reportedFairValue || 0) * (unitScale - 1), asOf: null, evidence: 'estimate' });
  if (includeAcquisition && leg.acquisition) {
    if (!Number.isFinite(entryPrice) || entryPrice <= 0) throw new Error('Acquisition entry price must be finite and positive');
    lots.push({ id: leg.acquisition.id, label: leg.acquisition.security, units: leg.acquisition.costUsd / entryPrice, carryingValue: leg.acquisition.costUsd, entryPrice, asOf: leg.acquisition.date, evidence: 'estimate' });
  }
  return lots;
}

export function valueUnitLots(leg, { fdShares, valuation, dilution = 0, wrapperValue, ...holdings }) {
  const pps = unitPrice({ valuation, fdShares, dilution });
  const lots = unitLots(leg, holdings).map(lot => ({ ...lot, scenarioValue: lot.units * pps }));
  const units = lots.reduce((sum, lot) => sum + lot.units, 0);
  const scenarioValue = lots.reduce((sum, lot) => sum + lot.scenarioValue, 0);
  const carryingValue = lots.every(lot => lot.carryingValue != null) ? lots.reduce((sum, lot) => sum + lot.carryingValue, 0) : null;
  return { lots, units, fdShares, pps, pct: units / fdShares, scenarioValue, carryingValue, revaluation: carryingValue == null ? null : scenarioValue - carryingValue, per100: wrapperValue > 0 ? scenarioValue * 100 / wrapperValue : 0 };
}
