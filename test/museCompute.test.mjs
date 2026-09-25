import assert from "node:assert/strict";
import { test } from "node:test";
import {
  applyPreset,
  computeMuse,
  DEFAULT_INPUTS,
  exportScenario,
  matchPreset,
  readMuseScenario,
  writeMuseScenario,
} from "../lib/museCompute.mjs";

const close = (a, b, eps, label) =>
  assert.ok(Math.abs(a - b) <= eps, `${label || ""} ${a} != ${b} (±${eps})`);

test("BEP Light / Base / Heavy processor line at 1B users, duty-cycle, 3-year life", () => {
  const common = {
    registeredUsers: 1e9,
    activeRate: 1,
    persistence: "duty",
    hardwareView: "processor",
    usefulLife: 3,
    powerMarkup: 0,
    tokensIn: 200_000,
    tokensOut: 10_000,
    peakMultiplier: 3,
    utilization: 0.7,
    processorPrice: 10_931,
  };
  const light = computeMuse({ ...common, tasksPerDay: 2, minutesPerTask: 3 });
  const base = computeMuse({ ...common, tasksPerDay: 5, minutesPerTask: 6 });
  const heavy = computeMuse({ ...common, tasksPerDay: 10, minutesPerTask: 12 });

  close(light.concurrency, 0.0042, 0.0002, "light concurrency");
  close(base.concurrency, 0.021, 0.001, "base concurrency");
  close(heavy.concurrency, 0.083, 0.002, "heavy concurrency");
  close(light.cpuAnnualProcessors, 0.25e9, 0.02e9, "light cpu");
  close(base.cpuAnnualProcessors, 1.3e9, 0.05e9, "base cpu");
  close(heavy.cpuAnnualProcessors, 5.1e9, 0.15e9, "heavy cpu");
  close(base.impliedCores, 45e6, 1e6, "base cores");
  close(heavy.impliedCores, 179e6, 2e6, "heavy cores");
  assert.equal(base.hardwareCapex, base.cpuCapex);
  assert.ok(base.vmLayer < base.cpuCapex);
});

test("hybrid does not add duty-cycle capex on top of always-on hardware", () => {
  const hybrid = computeMuse();
  const duty = computeMuse({ persistence: "duty", hardwareView: "full" });
  const always = computeMuse({ persistence: "always" });
  assert.ok(hybrid.hardwareCapex < duty.cpuCapex + always.hardwareCapex);
  assert.equal(hybrid.processorPath, false);
  const warmUsers = hybrid.actives * DEFAULT_INPUTS.warmShare;
  close(hybrid.vmUsersForHardware, warmUsers, 1, "warm binds");
  close(hybrid.hardwareCapex, 40e9 * (warmUsers / 100e6), 1, "nsp scale");
});

test("nextsignal 100M always-on depreciation band at 5.5 years", () => {
  for (const hardware of [30e9, 40e9, 50e9]) {
    const result = computeMuse({
      registeredUsers: 100e6,
      activeRate: 1,
      persistence: "always",
      hardwarePer100m: hardware,
      usefulLife: 5.5,
      powerMarkup: 0,
      vcpu: 2,
      ramGb: 8,
    });
    close(result.hardwareCapex, hardware, 1, "capex");
    close(result.depreciation, hardware / 5.5, 1, "dep");
  }
  const low = 30e9 / 5.5;
  const high = 50e9 / 5.5;
  assert.ok(low > 5.4e9 && low < 5.6e9);
  assert.ok(high > 9e9 && high < 9.2e9);
});

test("Uncover 100M MAU × 7.5M tokens/week × $0.15/M ≈ $5.9B", () => {
  const tokensPerTask = 7.5e6 / (5 * 7);
  const result = computeMuse({
    registeredUsers: 100e6,
    activeRate: 1,
    tasksPerDay: 5,
    tokensIn: tokensPerTask - 10_000,
    tokensOut: 10_000,
    tokenMode: "internal",
    internalPerM: 0.15,
    bedrockShare: 0,
  });
  close(result.tokensPerWeek, 7.5e6, 1, "weekly");
  close(result.internalCost, 5.85e9, 0.05e9, "inference");
});

test("default story: tokens dominate, AWS is a minority, subs do not cover", () => {
  const page = computeMuse();
  const at100m = computeMuse({ registeredUsers: 100e6, activeRate: 1 });
  for (const result of [page, at100m]) {
    assert.ok(result.metaTokenCost > result.vmLayer, "tokens bigger than VMs");
    assert.ok(result.awsPct > 0.05 && result.awsPct < 0.35, `aws pct ${result.awsPct}`);
    assert.ok(result.subCoverage < 0.5);
    assert.equal(result.who, "short");
    assert.equal(result.inputs.bedrockShare, 0.05);
  }
  assert.ok(page.costPerActiveMonth > 2.5 && page.costPerActiveMonth < 6);
  assert.equal(page.outsideWideBand, false);
  assert.equal(page.outsidePublishedBand, true);
});

test("raising Bedrock or warm share moves the who-wins readout", () => {
  assert.equal(computeMuse({ bedrockShare: 0.2 }).who, "swing");
  assert.equal(computeMuse({ warmShare: 0.55 }).who, "swing");
  const aggressive = computeMuse(applyPreset("aws-aggressive"));
  assert.ok(aggressive.awsPct > 0.35);
});

test("Graviton cap stops a heavy case from inventing infinite cores", () => {
  const open = computeMuse({
    registeredUsers: 1e9,
    activeRate: 1,
    persistence: "always",
    capToCommitted: false,
    gravitonShare: 0.8,
  });
  const capped = computeMuse({
    registeredUsers: 1e9,
    activeRate: 1,
    persistence: "always",
    capToCommitted: true,
    gravitonShare: 0.8,
  });
  assert.ok(capped.gravitonCapBinds);
  close(capped.awsGraviton, 30e6 * 80, 1, "cap");
  assert.ok(capped.awsGraviton < open.awsGraviton);
  assert.ok(capped.impliedCores > capped.inputs.committedCores);
});

test("scenario URL round-trips and rejects junk", () => {
  const inputs = computeMuse({
    registeredUsers: 2.5e8,
    tasksPerDay: 8,
    warmShare: 0.2,
    gravitonShare: 0.5,
    bedrockShare: 0.1,
    amazonBlocks: false,
    persistence: "hybrid",
  }).inputs;
  const query = writeMuseScenario(inputs, "custom");
  const back = readMuseScenario(new URLSearchParams(query));
  assert.equal(back.inputs.registeredUsers, inputs.registeredUsers);
  assert.equal(back.inputs.tasksPerDay, inputs.tasksPerDay);
  assert.equal(back.inputs.warmShare, 0.2);
  assert.equal(back.inputs.bedrockShare, 0.1);
  assert.equal(back.inputs.amazonBlocks, false);
  const bad = readMuseScenario(new URLSearchParams("users=nope&bedrock=9&persist=nope&active=-1"));
  assert.equal(bad.inputs.registeredUsers, DEFAULT_INPUTS.registeredUsers);
  assert.equal(bad.inputs.bedrockShare, 0.4);
  assert.equal(bad.inputs.persistence, "hybrid");
  assert.equal(matchPreset(applyPreset("bep-base")), "bep-base");
  const exported = exportScenario(applyPreset("nsp-100m"), "nsp-100m");
  assert.equal(exported.name, "muse-compute-split");
  assert.equal(exported.preset, "nsp-100m");
  assert.ok(exported.derived.meta_all_in > 0);
  assert.equal(exported.sources.length, 8);
});

test("string enums survive a copied assumptions link", () => {
  const query = writeMuseScenario({
    persistence: "always",
    tokenMode: "list",
    hardwareView: "processor",
    bedrockMix: "third",
  }, "custom");
  assert.match(query, /persist=always/);
  assert.match(query, /tmode=list/);
  assert.match(query, /tco=processor/);
  assert.match(query, /bmix=third/);
  const back = readMuseScenario(new URLSearchParams(query));
  assert.equal(back.inputs.persistence, "always");
  assert.equal(back.inputs.tokenMode, "list");
  assert.equal(back.inputs.hardwareView, "processor");
  assert.equal(back.inputs.bedrockMix, "third");
  const stale = readMuseScenario(new URLSearchParams("preset=nsp-100m&persist="));
  assert.equal(stale.inputs.persistence, "always");
});

test("hardware toggle changes duty-cycle dollars and sizes always-on processors to the fleet", () => {
  const dutyFull = computeMuse({ persistence: "duty", hardwareView: "full", powerMarkup: 0 });
  const dutyProc = computeMuse({ persistence: "duty", hardwareView: "processor", powerMarkup: 0 });
  assert.notEqual(dutyFull.hardwareCapex, dutyProc.hardwareCapex);
  assert.equal(dutyProc.hardwareCapex, dutyProc.cpuCapex);
  assert.equal(dutyProc.memoryAnnual, 0);
  assert.ok(dutyFull.memoryAnnual > 0);
  close(dutyFull.cpuAnnual + dutyFull.memoryAnnual, dutyFull.depreciation, 1, "split");

  const alwaysProc = computeMuse({
    registeredUsers: 100e6,
    activeRate: 1,
    persistence: "always",
    hardwareView: "processor",
    vcpu: 2,
    processorPrice: 10931,
    usefulLife: 5.5,
    powerMarkup: 0,
  });
  const sockets = 100e6 * 2 / 256;
  close(alwaysProc.hardwareCapex, sockets * 10931, 1, "fleet sockets");
  assert.ok(alwaysProc.hardwareCapex > alwaysProc.cpuCapex);
});

test("BEP light and heavy presets reproduce the published processor line", () => {
  const light = computeMuse(applyPreset("bep-light"));
  const heavy = computeMuse(applyPreset("bep-heavy"));
  close(light.cpuAnnualProcessors, 0.25e9, 0.02e9, "light preset");
  close(heavy.cpuAnnualProcessors, 5.1e9, 0.15e9, "heavy preset");
  assert.equal(light.hardwareCapex, light.cpuCapex);
  assert.equal(heavy.depreciation, heavy.cpuAnnualProcessors);
});

test("accounting identity holds and memory is inside full TCO only", () => {
  const result = computeMuse();
  const gap = result.metaOwnedCpu
    + result.tokenCost * (1 - result.inputs.bedrockShare)
    + result.modelVendorSlice
    + result.residual;
  close(result.metaAllIn - result.awsTotal, gap, 1, "gap");
  assert.ok(result.metaAllIn >= result.awsTotal);
  close(result.cpuAnnual + result.memoryAnnual, result.depreciation, 1, "dep");
  assert.ok(result.memoryAnnual > 0);
  assert.ok(result.cpuAnnual > result.memoryAnnual);
});
