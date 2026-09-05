import { DEFAULT_INPUTS } from './sftbySotp.mjs';

export const INPUT_LIMITS = {
  armPrice: [0, 10000], sftbyPrice: [0.01, 10000], usdJpy: [1, 1000],
  openaiEquityB: [0, 100000], dilutionPct: [0, 100], taxPct: [0, 100],
  armTaxBasisB: [0, 1000], liqHaircutPct: [0, 100], managementPct: [0, 17.25],
  otherNetDebtB: [-500, 500], stubMult: [0, 10],
};
export const PRESETS = {
  base: { label: 'Base · pro forma 13%', note: '$852B anchor; October funding included. Zero tax and liquidity discounts.', inputs: {} },
  current: { label: 'July funded FV proxy', note: 'Scale July’s rounded $100B fair value. Current ownership remains undisclosed.', inputs: { openaiCase: 'current' } },
  ipo1600: { label: 'OpenAI IPO at $1.6T', note: 'Pro forma 13%, zero dilution, tax and liquidity discounts.', inputs: { openaiEquityB: 1600 } },
  bear: { label: 'Stress case', note: 'Arm $150; OpenAI $500B; 10% dilution, 30% liquidity discount and 25% illustrative tax.', inputs: { armPrice: 150, openaiEquityB: 500, dilutionPct: 10, liqHaircutPct: 30, taxPct: 25, stubMult: 0.7 } },
};

export function readSotpScenario(params) {
  const aliases = { funded13: 'base' };
  const legacy = {
    bull: { armPrice: 300, openaiEquityB: 1200, stubMult: 1.1 },
    core: { openaiCase: 'current', stubMult: 0, taxPct: 10, liqHaircutPct: 15 },
  };
  const requested = params.get('scenario') || 'base';
  const key = aliases[requested] || requested;
  const selected = PRESETS[key]?.inputs || legacy[key] || {};
  const inputs = { ...DEFAULT_INPUTS, ...selected };
  const pinned = new Set(Object.keys(selected));
  let custom = Boolean(legacy[key]);
  for (const [field, [min, max]] of Object.entries(INPUT_LIMITS)) {
    if (!params.has(field) || params.get(field).trim() === '') continue;
    const value = Number(params.get(field));
    if (Number.isFinite(value) && value >= min && value <= max) {
      inputs[field] = value;
      pinned.add(field);
      custom = true;
    }
  }
  if (['current', 'funded13'].includes(params.get('openaiCase'))) {
    inputs.openaiCase = params.get('openaiCase');
    custom = true;
  }
  return { inputs, key: custom ? null : PRESETS[key] ? key : 'base', pinned };
}

export function writeSotpScenario(inputs) {
  return new URLSearchParams(Object.entries(inputs).map(([k, v]) => [k, String(v)])).toString();
}
