// Offline implementation from raw observations and frozen runtime inputs.
// No browser, application modules, network, clock, or inferred live prices.
import { adsEquivalentShares, impliedExposure, markPostMoney, lookThroughPer100 } from './derive.mjs';
import { CAPITALIZATION, valueUnitLots } from './unitExposure.mjs';

export function referenceRow(raw, marks, input, caps = CAPITALIZATION) {
  const price = input.prices[raw.yahooSymbol];
  if (!Number.isFinite(price) || price <= 0) throw new Error(`Missing positive frozen price: ${raw.ticker}`);
  const estimated = input.holdingsBasis === 'estimated';
  const deploy = input.deploy || 'cash';
  const bridge = estimated ? input.dxyzBridge : null;
  let shares = raw.filedSnapshot?.sharesOutstanding ?? adsEquivalentShares(raw.shareCount?.value, raw.adrRatio);
  let sharesAsOf = raw.shareCount?.asOf || raw.filedSnapshot?.asOf;
  let scale = 1;
  if (raw.ticker === 'DXYZ' && bridge) {
    if (!(bridge.proFormaShares > 0) || !(bridge.proFormaAssets > 0)) throw new Error('Invalid frozen DXYZ bridge');
    shares = bridge.proFormaShares;
    sharesAsOf = bridge.asOfDate || raw.filedSnapshot.asOf;
    scale = Math.max(1, bridge.proFormaAssets / raw.filedSnapshot.netAssets);
  }
  const tna = raw.denominatorType === 'total-net-assets';
  const proxy = tna ? raw.shareCount.value * price : null;
  const filedValue = tna ? raw.totalNetAssets.value : shares * price;
  const wrapperValue = tna && estimated && deploy !== 'prorata' ? proxy : filedValue;
  const highDenom = tna && estimated && deploy === 'range' ? filedValue : wrapperValue;
  const legs = {};
  for (const [side, key, val, fd] of [['anthropic','anth',input.anthVal,input.anthFdShares ?? caps.anthropic.defaultShares],['openai','oai',input.oaiVal,input.oaiFdShares ?? caps.openai.defaultShares]]) {
    const leg = raw[side];
    if (leg?.basis === 'filed-units') {
      const opts = { valuation: val, fdShares: fd, dilution: input.dilution, wrapperValue, includeAcquisition: estimated, entryPrice: input.dxyzOaiEntryPrice ?? caps.dxyzOpenaiEntry.defaultPrice, unitScale: deploy === 'prorata' ? scale : 1 };
      const point = valueUnitLots(leg, opts);
      const high = valueUnitLots(leg, { ...opts, unitScale: deploy === 'range' || deploy === 'prorata' ? scale : 1, wrapperValue: highDenom });
      const sensitivityLow = valueUnitLots(leg, { ...opts, fdShares: caps[side].highShares, entryPrice: leg.acquisition ? caps.dxyzOpenaiEntry.highPrice : opts.entryPrice });
      const sensitivityHigh = valueUnitLots(leg, { ...opts, fdShares: caps[side].lowShares, entryPrice: leg.acquisition ? caps.dxyzOpenaiEntry.lowPrice : opts.entryPrice });
      legs[key] = { pct: point.pct, lo: Math.min(point.per100, high.per100), hi: Math.max(point.per100, high.per100), lots: point.lots, units: point.units, revaluation: point.revaluation, pps: point.pps, sensitivity: { low: sensitivityLow.per100, high: sensitivityHigh.per100 } };
    } else {
      const pct = impliedExposure(leg, marks) || 0;
      const args = { claimPct: pct, ipoVal: val, dilution: input.dilution };
      const point = lookThroughPer100({ ...args, wrapperValue });
      const high = lookThroughPer100({ ...args, wrapperValue: highDenom });
      legs[key] = { pct, lo: Math.min(point, high), hi: Math.max(point, high), lots: [], units: null };
    }
  }
  let nav = raw.filedSnapshot?.navPerShare ?? raw.filedNavPerShare ?? (raw.ticker === 'AGIX' ? price : null);
  let netAssets = raw.filedSnapshot?.netAssets ?? raw.filedNetAssets;
  if (raw.ticker === 'DXYZ' && estimated && bridge) { nav = bridge.proFormaNav || nav; netAssets = bridge.proFormaAssets; }
  if (raw.ticker === 'VCX' && estimated) {
    for (const side of ['anthropic', 'openai']) {
      const leg = raw[side];
      netAssets += leg.reportedFairValue * (markPostMoney(marks, marks.lastPrimary[side]) / markPostMoney(marks, leg.measurementCompanyMark) - 1);
    }
    nav = netAssets / shares;
  }
  return {
    ticker: raw.ticker, price, shares, sharesAsOf: tna ? (estimated && deploy !== 'prorata' ? raw.shareCount.asOf : raw.totalNetAssets.asOf) : sharesAsOf,
    wrapperValue, anthBasis: raw.anthropic?.basis || null, oaiBasis: raw.openai?.basis || null,
    anthPct: legs.anth.pct, oaiPct: legs.oai.pct,
    anthPer100: legs.anth.lo, oaiPer100: legs.oai.lo,
    anthPer100High: legs.anth.hi, oaiPer100High: legs.oai.hi,
    combinedPer100: legs.anth.lo + legs.oai.lo, combinedPer100High: legs.anth.hi + legs.oai.hi,
    anthUnits: legs.anth.units, oaiUnits: legs.oai.units, anthLots: legs.anth.lots, oaiLots: legs.oai.lots,
    anthPps: legs.anth.pps ?? null, oaiPps: legs.oai.pps ?? null,
    anthSensitivity: legs.anth.sensitivity ?? null, oaiSensitivity: legs.oai.sensitivity ?? null,
    nav, premium: nav > 0 && ['closed-end-fund','etf'].includes(raw.wrapperType) ? price / nav - 1 : null,
    scenarioNetAssets: raw.ticker === 'DXYZ' ? netAssets + (legs.anth.revaluation || 0) + (legs.oai.revaluation || 0) : null,
  };
}

export function calculateScenario(dataset, input) {
  if (dataset.meta.schemaVersion !== '1.2.0' || dataset.meta.methodologyVersion !== '1.2.0') throw new Error('Unsupported dataset version');
  for (const key of ['anthVal', 'oaiVal']) if (!Number.isFinite(input[key]) || input[key] < 0) throw new Error(`Invalid ${key}`);
  if (!Number.isFinite(input.dilution) || input.dilution < 0 || input.dilution > 1) throw new Error('Invalid dilution');
  if (!['filed','estimated'].includes(input.holdingsBasis || 'filed')) throw new Error('Invalid holdingsBasis');
  if (!['cash','prorata','range'].includes(input.deploy || 'cash')) throw new Error('Invalid deploy');
  return { schemaVersion: dataset.meta.schemaVersion, methodologyVersion: dataset.meta.methodologyVersion, datasetAsOf: dataset.meta.asOf, priceAsOf: input.priceAsOf || input.asOf, asOf: input.asOf, anthVal: input.anthVal, oaiVal: input.oaiVal, dilution: input.dilution, holdingsBasis: input.holdingsBasis || 'filed', deploy: input.deploy || 'cash', anthFdShares: input.anthFdShares ?? dataset.capitalization?.anthropic.defaultShares ?? CAPITALIZATION.anthropic.defaultShares, oaiFdShares: input.oaiFdShares ?? dataset.capitalization?.openai.defaultShares ?? CAPITALIZATION.openai.defaultShares, dxyzOaiEntryPrice: input.dxyzOaiEntryPrice ?? dataset.capitalization?.dxyzOpenaiEntry.defaultPrice ?? CAPITALIZATION.dxyzOpenaiEntry.defaultPrice, rows: dataset.wrappers.map(raw => referenceRow(raw, dataset.marks, input, dataset.capitalization)) };
}

export function createScenarioExport(dataset, inputs, metadata = {}) {
  return { format: 'ai-exposure-scenario', version: '1.2.0', dataset, inputs, metadata, results: calculateScenario(dataset, inputs) };
}
