// Muse Compute Split. Static research model. No live prices.
// Source chips: BEP, NSP, AA84, UA, META, AWS, ASSUME.

export const AS_OF = "2026-09-25";

export const SOURCES = [
  "BEP Research, “Meta’s Muse Rally Bought the Wrong Layer,” 21 Sep 2026 — duty-cycle CPU, 1B-user Light/Base/Heavy, 200k/10k tokens per task, EPYC 9755 list price.",
  "nextsignalprediction, “What It Takes to Give Every Personal Agent a Computer,” 23 Sep 2026 — 2 vCPU/8 GB VM, 100M-user hardware/power/depreciation.",
  "alphaseeker84, “Muse Is a Memory Story…,” 21 Sep 2026 — $3.50–$4.50 cost to serve, inference vs VM split, memory-bound view.",
  "Uncover Alpha, Muse launch economics, 8 Sep 2026 — free-tier token value, 100M MAU token volumes, $0.10–$0.20 internal cost band.",
  "Meta Model API pricing and Muse launch posts, Jul–Sep 2026 — list prices, $20/$100 plans, Secure VM architecture.",
  "Meta and AWS Graviton announcements, 24 Apr 2026 — tens of millions of Graviton cores, multi-year multi-billion deal, agentic CPU rationale.",
  "Launch coverage (Axios, TechCrunch, NYT), 8 Sep 2026 — product behavior, paid tiers, no ads in Muse.",
  "Subsequent reporting that Amazon blocked Muse on Amazon.com — used only for the commerce toggle.",
];

export const OBS = {
  threadsPerServer: 256, // BEP single-socket 256-thread box
  coresPerServer: 128, // EPYC 9755: 128 cores / 256 threads
  refVmUsers: 100e6,
  refVcpu: 2,
  refRamGb: 8,
  refFacilityGw: 1.63, // NSP ~1.63 GW facility at 100M VMs
  refItKw: 1.6,
  pue: 1.3,
  coresPerAgenticGw: 120e6, // Arm Rene Haas rule of thumb, via BEP
  aa84Low: 3.5,
  aa84High: 4.5,
  aa84WideLow: 2.5,
  aa84WideHigh: 6,
  blockGmvCut: 0.25,
  cpuWeight: 0.6, // ASSUME dollar split of NSP hardware; DRAM is the rest
  plans: { power: 20, maximum: 100 },
  powerTokensWeek: 500e6,
  maximumTokensWeek: 3e9,
};

export const DEFAULT_INPUTS = {
  registeredUsers: 100e6,
  activeRate: 0.4,
  paidMix: 0.02,
  paidArpu: 30,
  tasksPerDay: 5,
  minutesPerTask: 6,
  peakMultiplier: 3,
  tokensIn: 200_000,
  tokensOut: 10_000,
  cacheHit: 0.4,
  tokenMode: "internal",
  internalPerM: 0.12,
  standardIn: 1.25,
  standardCached: 0.15,
  standardOut: 4.25,
  persistence: "hybrid",
  warmShare: 0.15,
  vcpu: 2,
  ramGb: 8,
  processorPrice: 10_931,
  utilization: 0.7,
  hardwarePer100m: 40e9,
  usefulLife: 5.5,
  powerMarkup: 0.2,
  residualPerMonth: 0.5,
  hardwareView: "full",
  gravitonShare: 0.35,
  gravitonPerCoreYear: 80,
  committedCores: 30e6,
  capToCommitted: true,
  overflowShare: 0.15,
  ec2Premium: 1.4,
  bedrockShare: 0.05,
  bedrockMarkup: 1.8,
  bedrockMix: "meta",
  platformPct: 0.2,
  vendorPct: 0.4,
  infraPct: 0.4,
  gmvPerActive: 200,
  takeRate: 0.02,
  amazonBlocks: true,
};

export const LIMITS = {
  registeredUsers: [1e6, 2e9],
  activeRate: [0.05, 1],
  paidMix: [0, 0.2],
  paidArpu: [20, 100],
  tasksPerDay: [0.5, 20],
  minutesPerTask: [1, 30],
  peakMultiplier: [1, 5],
  tokensIn: [20_000, 1_000_000],
  tokensOut: [1_000, 200_000],
  cacheHit: [0, 0.9],
  internalPerM: [0.03, 0.25],
  standardIn: [0.1, 10],
  standardCached: [0, 2],
  standardOut: [0.1, 20],
  warmShare: [0, 1],
  vcpu: [1, 8],
  ramGb: [2, 16],
  processorPrice: [4_000, 20_000],
  utilization: [0.4, 0.85],
  hardwarePer100m: [20e9, 60e9],
  usefulLife: [3, 6],
  powerMarkup: [0, 0.5],
  residualPerMonth: [0, 2],
  gravitonShare: [0, 0.8],
  gravitonPerCoreYear: [30, 200],
  committedCores: [10e6, 80e6],
  overflowShare: [0, 0.6],
  ec2Premium: [1, 2],
  bedrockShare: [0, 0.4],
  bedrockMarkup: [1, 4],
  platformPct: [0, 1],
  vendorPct: [0, 1],
  infraPct: [0, 1],
  gmvPerActive: [0, 2000],
  takeRate: [0, 0.08],
};

const ENUMS = {
  tokenMode: ["internal", "list"],
  persistence: ["duty", "always", "hybrid"],
  hardwareView: ["full", "processor"],
  bedrockMix: ["meta", "third"],
};

export const PRESETS = {
  "bep-base": {
    label: "BEP Base",
    note: "5 tasks × 6 min. Page default: hybrid VMs, not the $1.3B processor-only line.",
    inputs: {},
  },
  "bep-light": {
    label: "BEP Light",
    note: "1B users, duty-cycle, processor-only, 3-year life. Lands near the published ~$0.25B processor line.",
    inputs: {
      tasksPerDay: 2, minutesPerTask: 3, registeredUsers: 1e9, activeRate: 1,
      persistence: "duty", hardwareView: "processor", usefulLife: 3, powerMarkup: 0,
    },
  },
  "bep-heavy": {
    label: "BEP Heavy",
    note: "1B users, duty-cycle, processor-only, 3-year life. Lands near the published ~$5.1B processor line.",
    inputs: {
      tasksPerDay: 10, minutesPerTask: 12, registeredUsers: 1e9, activeRate: 1,
      persistence: "duty", hardwareView: "processor", usefulLife: 3, powerMarkup: 0,
    },
  },
  "nsp-100m": {
    label: "100M always-on VMs",
    note: "nextsignal: one hot VM per user. Hardware slider is the $30–50B band.",
    inputs: {
      registeredUsers: 100e6,
      activeRate: 1,
      persistence: "always",
      warmShare: 1,
      hardwareView: "full",
    },
  },
  "uncover-100m": {
    label: "Uncover 100M MAU tokens",
    note: "100M actives, BEP token shape (~7.4M tokens/week), internal cost mid-band $0.15/M.",
    inputs: { registeredUsers: 100e6, activeRate: 1, internalPerM: 0.15, tokenMode: "internal" },
  },
  "subsidized-1b": {
    label: "1B subsidized users",
    note: "1B registered, 40% active, 2% paid. Other sliders return to the research default.",
    inputs: { registeredUsers: 1e9, activeRate: 0.4, paidMix: 0.02 },
  },
  "aws-conservative": {
    label: "Conservative AWS",
    note: "Small Graviton share, no EC2 overflow, Bedrock at zero.",
    inputs: { gravitonShare: 0.15, overflowShare: 0, bedrockShare: 0, warmShare: 0.1 },
  },
  "aws-aggressive": {
    label: "Aggressive AWS",
    note: "Warm VMs, high Graviton share, EC2 overflow, and a Bedrock assumption well above 5%.",
    inputs: {
      warmShare: 0.55,
      gravitonShare: 0.7,
      overflowShare: 0.5,
      ec2Premium: 1.6,
      bedrockShare: 0.3,
      bedrockMarkup: 2,
      capToCommitted: false,
    },
  },
};

export const INTENSITY = {
  light: { tasksPerDay: 2, minutesPerTask: 3, label: "Light" },
  base: { tasksPerDay: 5, minutesPerTask: 6, label: "Base" },
  heavy: { tasksPerDay: 10, minutesPerTask: 12, label: "Heavy" },
};

export const SENSITIVITY_ACTIVES = [30e6, 100e6, 250e6, 1e9];

const URL_KEYS = {
  registeredUsers: "users",
  activeRate: "active",
  paidMix: "paid",
  paidArpu: "arpu",
  tasksPerDay: "tasks",
  minutesPerTask: "minutes",
  peakMultiplier: "peak",
  tokensIn: "tin",
  tokensOut: "tout",
  cacheHit: "cache",
  tokenMode: "tmode",
  internalPerM: "internal",
  standardIn: "pin",
  standardCached: "pcache",
  standardOut: "pout",
  persistence: "persist",
  warmShare: "warm",
  vcpu: "vcpu",
  ramGb: "ram",
  processorPrice: "cpu",
  utilization: "util",
  hardwarePer100m: "hw",
  usefulLife: "life",
  powerMarkup: "power",
  residualPerMonth: "residual",
  hardwareView: "tco",
  gravitonShare: "grav",
  gravitonPerCoreYear: "gravpy",
  committedCores: "cores",
  capToCommitted: "cap",
  overflowShare: "overflow",
  ec2Premium: "prem",
  bedrockShare: "bedrock",
  bedrockMarkup: "bmark",
  bedrockMix: "bmix",
  platformPct: "plat",
  vendorPct: "vend",
  infraPct: "infra",
  gmvPerActive: "gmv",
  takeRate: "take",
  amazonBlocks: "block",
};

function clamp(n, min, max) {
  return Math.min(max, Math.max(min, n));
}

function specMultiple(vcpu, ramGb) {
  const cpu = vcpu / OBS.refVcpu;
  const mem = ramGb / OBS.refRamGb;
  return OBS.cpuWeight * cpu + (1 - OBS.cpuWeight) * mem;
}

export function resolveInputs(partial = {}) {
  const inputs = { ...DEFAULT_INPUTS, ...partial };
  for (const [key, [min, max]] of Object.entries(LIMITS)) {
    const n = Number(inputs[key]);
    inputs[key] = Number.isFinite(n) ? clamp(n, min, max) : DEFAULT_INPUTS[key];
  }
  for (const [key, allowed] of Object.entries(ENUMS)) {
    if (!allowed.includes(inputs[key])) inputs[key] = DEFAULT_INPUTS[key];
  }
  inputs.capToCommitted = Boolean(inputs.capToCommitted);
  inputs.amazonBlocks = Boolean(inputs.amazonBlocks);
  const split = inputs.platformPct + inputs.vendorPct + inputs.infraPct;
  if (split <= 0) {
    inputs.platformPct = 0.2;
    inputs.vendorPct = 0.4;
    inputs.infraPct = 0.4;
  } else if (Math.abs(split - 1) > 1e-9) {
    inputs.platformPct /= split;
    inputs.vendorPct /= split;
    inputs.infraPct /= split;
  }
  return inputs;
}

export function applyPreset(key) {
  const preset = PRESETS[key];
  if (!preset) return resolveInputs();
  return resolveInputs(preset.inputs);
}

export function matchPreset(inputs) {
  const resolved = resolveInputs(inputs);
  for (const [key, preset] of Object.entries(PRESETS)) {
    const candidate = applyPreset(key);
    const same = Object.keys(DEFAULT_INPUTS).every((field) => candidate[field] === resolved[field]);
    if (same) return key;
  }
  return "custom";
}

/** @param {URLSearchParams} params */
export function readMuseScenario(params) {
  const presetKey = params.get("preset");
  const base = PRESETS[presetKey] ? applyPreset(presetKey) : resolveInputs();
  const raw = { ...base };
  let touched = false;
  for (const [field, urlKey] of Object.entries(URL_KEYS)) {
    if (!params.has(urlKey)) continue;
    touched = true;
    const text = params.get(urlKey).trim();
    if (field === "capToCommitted" || field === "amazonBlocks") {
      raw[field] = text === "1" || text === "true";
      continue;
    }
    if (ENUMS[field]) {
      if (ENUMS[field].includes(text)) raw[field] = text;
      continue;
    }
    const n = Number(text);
    if (Number.isFinite(n)) raw[field] = n;
  }
  const inputs = resolveInputs(raw);
  const matched = matchPreset(inputs);
  return {
    inputs,
    preset: matched,
    pinned: touched,
  };
}

function compactNumber(n) {
  if (typeof n === "boolean") return n ? "1" : "0";
  if (typeof n === "string") return n;
  if (!Number.isFinite(n)) return "";
  const abs = Math.abs(n);
  if (abs >= 1e6) {
    const exp = Math.floor(Math.log10(abs));
    const mant = n / 10 ** exp;
    const rounded = Math.round(mant * 1e6) / 1e6;
    if (Math.abs(rounded - Math.round(rounded)) < 1e-6) return `${Math.round(rounded)}e${exp}`;
    return `${rounded}e${exp}`;
  }
  if (Number.isInteger(n)) return String(n);
  const s = String(Math.round(n * 1e6) / 1e6);
  return s;
}

export function writeMuseScenario(inputs, preset) {
  const resolved = resolveInputs(inputs);
  const params = new URLSearchParams();
  if (preset && preset !== "custom" && PRESETS[preset]) params.set("preset", preset);
  for (const [field, urlKey] of Object.entries(URL_KEYS)) {
    const value = resolved[field];
    if (value === DEFAULT_INPUTS[field] && !(preset && preset !== "bep-base" && preset !== "custom" && applyPreset(preset)[field] !== DEFAULT_INPUTS[field] && value === applyPreset(preset)[field])) {
      continue;
    }
    params.set(urlKey, compactNumber(value));
  }
  return params.toString();
}

export function computeMuse(partial, overrides = {}) {
  const inputs = resolveInputs(partial);
  const actives = overrides.actives != null
    ? overrides.actives
    : inputs.registeredUsers * inputs.activeRate;
  const paidUsers = actives * inputs.paidMix;
  const subRevenue = paidUsers * inputs.paidArpu * 12;

  const activeFraction = (inputs.tasksPerDay * inputs.minutesPerTask) / (24 * 60);
  const peakFraction = activeFraction * inputs.peakMultiplier;
  // BEP: threads sized off the population that actually runs tasks (actives).
  const neededThreads = actives * peakFraction / inputs.utilization;
  const neededServers = neededThreads / OBS.threadsPerServer;
  const impliedCores = neededThreads / (OBS.threadsPerServer / OBS.coresPerServer);
  const cpuCapex = neededServers * inputs.processorPrice;
  const cpuAnnualProcessors = cpuCapex / inputs.usefulLife;

  const hotUsers = inputs.persistence === "always"
    ? actives
    : inputs.persistence === "duty"
      ? 0
      : actives * inputs.warmShare;
  const dutyUsersEquivalent = actives * peakFraction;
  const vmUsersForHardware = inputs.persistence === "duty"
    ? dutyUsersEquivalent
    : inputs.persistence === "always"
      ? actives
      : Math.max(hotUsers, dutyUsersEquivalent);

  const multiple = specMultiple(inputs.vcpu, inputs.ramGb);
  const nspHardware = inputs.hardwarePer100m * (vmUsersForHardware / OBS.refVmUsers) * multiple;
  const nspDepreciation = nspHardware / inputs.usefulLife;

  // One hardware bill. Full TCO is nextsignal dollars on the persistence population.
  // Processor-only on duty-cycle is the published BEP thread formula (not 2 vCPU per user).
  // Processor-only on always-on or hybrid prices that fleet's vCPUs and leaves memory out.
  const processorPath = inputs.hardwareView === "processor";
  const bepProcessorPath = processorPath && inputs.persistence === "duty";
  const fleetSockets = vmUsersForHardware * inputs.vcpu / OBS.threadsPerServer;
  const fleetProcessorCapex = fleetSockets * inputs.processorPrice;
  let hardwareCapex;
  let depreciation;
  let cpuAnnual;
  let memoryAnnual;
  if (bepProcessorPath) {
    hardwareCapex = cpuCapex;
    depreciation = cpuAnnualProcessors;
    cpuAnnual = depreciation;
    memoryAnnual = 0;
  } else if (processorPath) {
    hardwareCapex = fleetProcessorCapex;
    depreciation = hardwareCapex / inputs.usefulLife;
    cpuAnnual = depreciation;
    memoryAnnual = 0;
  } else {
    hardwareCapex = nspHardware;
    depreciation = nspDepreciation;
    const cpuShare = multiple > 0
      ? (OBS.cpuWeight * (inputs.vcpu / OBS.refVcpu)) / multiple
      : OBS.cpuWeight;
    cpuAnnual = depreciation * cpuShare;
    memoryAnnual = depreciation - cpuAnnual;
  }
  const powerCost = depreciation * inputs.powerMarkup;
  const vmBeforePremium = depreciation + powerCost;

  const facilityServers = bepProcessorPath ? neededServers : processorPath ? fleetSockets : null;
  const facilityGw = (facilityServers != null ? facilityServers / 1.56e6 : vmUsersForHardware / OBS.refVmUsers)
    * OBS.refFacilityGw
    * (processorPath ? 1 : inputs.vcpu / OBS.refVcpu);

  const freshIn = actives * inputs.tasksPerDay * 365 * inputs.tokensIn * (1 - inputs.cacheHit);
  const cachedIn = actives * inputs.tasksPerDay * 365 * inputs.tokensIn * inputs.cacheHit;
  const outputTokens = actives * inputs.tasksPerDay * 365 * inputs.tokensOut;
  const totalTokens = freshIn + cachedIn + outputTokens;
  const listValue = (freshIn * inputs.standardIn + cachedIn * inputs.standardCached + outputTokens * inputs.standardOut) / 1e6;
  const contributorCeiling = (freshIn * 0.1 + cachedIn * 0.002 + outputTokens * 0.2) / 1e6;
  const internalCost = totalTokens * inputs.internalPerM / 1e6;
  const tokenCost = inputs.tokenMode === "list" ? listValue : internalCost;

  // Bedrock is a share of the token bill, marked up. It replaces that share of internal cost.
  const bedrockBill = tokenCost * inputs.bedrockShare * inputs.bedrockMarkup;
  const metaTokenCost = tokenCost * (1 - inputs.bedrockShare) + bedrockBill;
  const awsBedrock = inputs.bedrockMix === "third"
    ? bedrockBill * (inputs.platformPct + inputs.infraPct)
    : bedrockBill;
  const modelVendorSlice = inputs.bedrockMix === "third" ? bedrockBill * inputs.vendorPct : 0;

  const gravitonFromShare = vmBeforePremium * inputs.gravitonShare;
  const gravitonFromCores = inputs.committedCores * inputs.gravitonPerCoreYear;
  const gravitonCapBinds = inputs.capToCommitted && gravitonFromShare > gravitonFromCores;
  const awsGraviton = inputs.capToCommitted ? Math.min(gravitonFromShare, gravitonFromCores) : gravitonFromShare;
  const overflowCpu = Math.max(vmBeforePremium - awsGraviton, 0);
  const awsEc2 = overflowCpu * inputs.overflowShare * inputs.ec2Premium;
  const metaOwnedCpu = overflowCpu * (1 - inputs.overflowShare);
  const ec2Uplift = overflowCpu * inputs.overflowShare * (inputs.ec2Premium - 1);
  const vmLayer = vmBeforePremium + ec2Uplift;
  const residual = inputs.residualPerMonth * 12 * actives;
  const metaAllIn = metaTokenCost + vmLayer + residual;
  const awsTotal = awsGraviton + awsEc2 + awsBedrock;

  const gmv = actives * inputs.gmvPerActive * (inputs.amazonBlocks ? 1 - OBS.blockGmvCut : 1);
  const commerceTake = gmv * inputs.takeRate;
  const uncovered = metaAllIn - subRevenue - commerceTake;
  const takeToBreakEven = gmv > 0 ? Math.max(0, (metaAllIn - subRevenue) / gmv) : null;

  const perMonth = actives > 0 ? metaAllIn / actives / 12 : 0;
  const inferenceMonth = actives > 0 ? metaTokenCost / actives / 12 : 0;
  const vmMonth = actives > 0 ? vmLayer / actives / 12 : 0;
  const perActiveMonth = (annual) => (actives > 0 ? annual / actives / 12 : 0);

  let who = "short";
  if (metaAllIn > 0 && awsTotal / metaAllIn >= 0.5) who = "majority";
  else if (inputs.bedrockShare > 0.15 || (inputs.persistence !== "duty" && inputs.warmShare > 0.5) || inputs.persistence === "always") who = "swing";

  return {
    inputs,
    actives,
    paidUsers,
    subRevenue,
    concurrency: activeFraction,
    peakFraction,
    neededThreads,
    neededServers,
    impliedCores,
    cpuCapex,
    cpuAnnualProcessors,
    hotUsers,
    dutyUsersEquivalent,
    vmUsersForHardware,
    specMultiple: multiple,
    hardwareCapex,
    depreciation,
    cpuAnnual,
    memoryAnnual,
    powerCost,
    vmBeforePremium,
    facilityGw,
    processorPath,
    freshIn,
    cachedIn,
    outputTokens,
    totalTokens,
    tokensPerWeek: actives > 0 ? (inputs.tasksPerDay * 7 * (inputs.tokensIn + inputs.tokensOut)) : 0,
    listValue,
    contributorCeiling,
    internalCost,
    tokenCost,
    metaTokenCost,
    bedrockBill,
    awsBedrock,
    modelVendorSlice,
    gravitonFromShare,
    gravitonFromCores,
    gravitonCapBinds,
    coreGap: impliedCores - inputs.committedCores,
    coresPerGw: impliedCores / OBS.coresPerAgenticGw,
    awsGraviton,
    overflowCpu,
    awsEc2,
    metaOwnedCpu,
    ec2Uplift,
    vmLayer,
    residual,
    metaAllIn,
    awsTotal,
    awsPct: metaAllIn > 0 ? awsTotal / metaAllIn : 0,
    commerceTake,
    gmv,
    uncovered,
    takeToBreakEven,
    costPerActiveMonth: perMonth,
    inferenceMonth,
    vmMonth,
    cpuMonth: perActiveMonth(cpuAnnual),
    memoryMonth: perActiveMonth(memoryAnnual),
    powerMonth: perActiveMonth(powerCost),
    residualMonth: inputs.residualPerMonth,
    outsidePublishedBand: perMonth < OBS.aa84Low || perMonth > OBS.aa84High,
    outsideWideBand: perMonth < OBS.aa84WideLow || perMonth > OBS.aa84WideHigh,
    subCoverage: metaAllIn > 0 ? subRevenue / metaAllIn : 0,
    who,
    grokMultiple: specMultiple(8, inputs.ramGb) / multiple,
  };
}

export function sensitivityMatrix(partial) {
  const base = resolveInputs(partial);
  return SENSITIVITY_ACTIVES.map((actives) => {
    const row = { actives, cells: {} };
    for (const [key, spec] of Object.entries(INTENSITY)) {
      const result = computeMuse(
        { ...base, tasksPerDay: spec.tasksPerDay, minutesPerTask: spec.minutesPerTask },
        { actives },
      );
      row.cells[key] = { metaAllIn: result.metaAllIn, awsTotal: result.awsTotal };
    }
    return row;
  });
}

export function exportScenario(partial, preset) {
  const result = computeMuse(partial);
  const key = preset || matchPreset(result.inputs);
  return {
    name: "muse-compute-split",
    as_of: AS_OF,
    preset: key,
    inputs: result.inputs,
    derived: {
      actives: result.actives,
      concurrency_pct: result.concurrency,
      tokens_year: result.totalTokens,
      meta_token_cost: result.metaTokenCost,
      meta_vm_cpu_cost: result.vmLayer,
      meta_cpu_annual: result.cpuAnnual,
      meta_memory_annual: result.memoryAnnual,
      meta_power: result.powerCost,
      meta_residual: result.residual,
      meta_all_in: result.metaAllIn,
      aws_graviton: result.awsGraviton,
      aws_ec2_overflow: result.awsEc2,
      aws_bedrock: result.awsBedrock,
      aws_total: result.awsTotal,
      aws_pct_of_muse: result.awsPct,
      sub_revenue: result.subRevenue,
      commerce_take: result.commerceTake,
      uncovered_subsidy: result.uncovered,
      cost_per_active_month: result.costPerActiveMonth,
      implied_cores: result.impliedCores,
      list_value: result.listValue,
      outside_published_band: result.outsidePublishedBand,
    },
    sources: SOURCES,
  };
}

export function whoWinsCopy(who) {
  if (who === "majority") {
    return "This scenario has Amazon collecting the majority of the modeled bill. That only happens after you raise Bedrock, warm VMs, or both. It is still an assumption, not a disclosure.";
  }
  if (who === "swing") {
    return "Short term, warm VMs or a higher Bedrock share is what makes Amazon collect the incremental bill. Meta still funds the subsidy that subscriptions do not cover.";
  }
  return "Short term, AWS collects a contracted CPU bill and a small token assumption. Meta funds the subsidy. Longer term, Meta needs commerce or a cheaper token factory. Amazon still collects whatever CPU overflows the Graviton commitment.";
}
