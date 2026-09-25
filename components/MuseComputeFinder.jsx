"use client";

import { useMemo, useState } from "react";
import {
  DEFAULT_INPUTS,
  INTENSITY,
  LIMITS,
  OBS,
  PRESETS,
  SOURCES,
  applyPreset,
  computeMuse,
  exportScenario,
  matchPreset,
  sensitivityMatrix,
  whoWinsCopy,
  writeMuseScenario,
} from "@/lib/museCompute.mjs";

const mono = "var(--font-mono), 'JetBrains Mono', monospace";

function money(n, digits = 2) {
  if (!Number.isFinite(n)) return "—";
  const sign = n < 0 ? "−" : "";
  const a = Math.abs(n);
  if (a >= 1e12) return `${sign}$${(a / 1e12).toFixed(digits)}T`;
  if (a >= 1e9) return `${sign}$${(a / 1e9).toFixed(digits)}B`;
  if (a >= 1e6) return `${sign}$${(a / 1e6).toFixed(a >= 100e6 ? 0 : 1)}M`;
  if (a >= 1e3) return `${sign}$${(a / 1e3).toFixed(0)}k`;
  return `${sign}$${a.toFixed(2)}`;
}

function compactCount(n) {
  if (!Number.isFinite(n)) return "—";
  const a = Math.abs(n);
  if (a >= 1e15) return `${(n / 1e15).toFixed(2)} quadrillion`;
  if (a >= 1e12) return `${(n / 1e12).toFixed(2)} trillion`;
  if (a >= 1e9) return `${(n / 1e9).toFixed(2)}B`;
  if (a >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  if (a >= 1e3) return `${(n / 1e3).toFixed(1)}k`;
  return n.toFixed(0);
}

function pct(n, digits = 1) {
  if (!Number.isFinite(n)) return "—";
  return `${(n * 100).toFixed(digits)}%`;
}

function Chip({ id }) {
  const assume = id === "ASSUME";
  return (
    <span style={{
      fontFamily: mono,
      fontSize: 9,
      letterSpacing: "0.08em",
      fontWeight: 700,
      padding: "2px 5px",
      border: `1px solid ${assume ? "#f59e0b" : "#d6d3d1"}`,
      color: assume ? "#92400e" : "#57534e",
      background: assume ? "#fffbeb" : "#fafaf9",
      marginLeft: 6,
      verticalAlign: "middle",
    }}
    >
      {id}
    </span>
  );
}

function Slider({ label, chip, hint, min, max, step, value, onChange, format, log, unit }) {
  const pos = log
    ? ((Math.log10(value) - Math.log10(min)) / (Math.log10(max) - Math.log10(min))) * 1000
    : undefined;
  const fromPos = (p) => {
    const t = p / 1000;
    return 10 ** (Math.log10(min) + t * (Math.log10(max) - Math.log10(min)));
  };
  return (
    <label style={styles.slider}>
      <span style={styles.sliderTop}>
        <span style={styles.sliderLabel}>
          {label}
          {unit ? <span style={styles.unit}> ({unit})</span> : null}
          <Chip id={chip} />
        </span>
        <span style={styles.sliderValue}>{format(value)}</span>
      </span>
      <input
        type="range"
        aria-label={`${label}${unit ? ` (${unit})` : ""}`}
        min={log ? 0 : min}
        max={log ? 1000 : max}
        step={log ? 1 : step}
        value={log ? pos : value}
        onChange={(e) => onChange(log ? fromPos(Number(e.target.value)) : Number(e.target.value))}
        style={styles.range}
      />
      {hint ? <span style={styles.hint}>{hint}</span> : null}
    </label>
  );
}

function Choice({ label, value, options, onChange }) {
  return (
    <div style={styles.choice}>
      <div style={styles.sliderLabel}>{label}</div>
      <div style={styles.choiceRow}>
        {options.map((opt) => (
          <button
            key={opt.id}
            type="button"
            aria-pressed={value === opt.id}
            onClick={() => onChange(opt.id)}
            style={{ ...styles.choiceBtn, ...(value === opt.id ? styles.choiceOn : {}) }}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function MuseComputeFinder({ initialInputs, initialPreset }) {
  const [inputs, setInputs] = useState(() => ({ ...DEFAULT_INPUTS, ...initialInputs }));
  const [copied, setCopied] = useState(false);
  const result = useMemo(() => computeMuse(inputs), [inputs]);
  const preset = matchPreset(result.inputs);
  const matrix = useMemo(() => sensitivityMatrix(inputs), [inputs]);
  const activePreset = preset === "custom" ? initialPreset === "custom" ? null : preset : preset;

  const writeUrl = (next, key) => {
    const query = writeMuseScenario(next, key);
    const url = `${window.location.pathname}${query ? `?${query}` : ""}`;
    queueMicrotask(() => window.history.replaceState({}, "", url));
  };

  const set = (field) => (value) => {
    setInputs((prev) => {
      const next = { ...prev, [field]: value };
      writeUrl(next, matchPreset(next));
      return next;
    });
  };

  const setSplit = (field) => (value) => {
    setInputs((prev) => {
      const keys = ["platformPct", "vendorPct", "infraPct"];
      const next = { ...prev, [field]: value };
      const others = keys.filter((k) => k !== field);
      const remain = Math.max(0, 1 - value);
      const sum = others.reduce((s, k) => s + prev[k], 0);
      others.forEach((k) => {
        next[k] = sum > 0 ? remain * (prev[k] / sum) : remain / others.length;
      });
      writeUrl(next, matchPreset(next));
      return next;
    });
  };

  const apply = (key) => {
    const next = applyPreset(key);
    setInputs(next);
    writeUrl(next, key);
  };

  const copyLink = async () => {
    const query = writeMuseScenario(result.inputs, preset);
    const url = `${window.location.origin}/muse${query ? `?${query}` : ""}`;
    window.history.replaceState({}, "", `${window.location.pathname}${query ? `?${query}` : ""}`);
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  };

  const download = () => {
    const payload = exportScenario(result.inputs, preset);
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `muse-compute-${preset}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const bridgeMax = Math.max(result.listValue, result.metaAllIn, result.awsTotal, 1);
  const bar = (value, color, ghost) => (
    <span style={{
      display: "block",
      height: 8,
      width: `${Math.max(2, (Math.abs(value) / bridgeMax) * 100)}%`,
      background: ghost ? "transparent" : color,
      border: ghost ? "1px dashed #a8a29e" : "none",
      marginTop: 6,
    }}
    />
  );

  return (
    <main className="muse-wrap" style={styles.wrap}>
      <header style={styles.hero}>
        <div style={styles.eyebrow}>META × AMZN / RESEARCH MODEL</div>
        <h1 style={styles.title}>Muse Compute Split</h1>
        <p style={styles.subtitle}>
          Duty-cycle CPU + token burn + VM persistence, with explicit sliders for how much of the runtime lands on AWS.
        </p>
      </header>

      <section style={styles.section}>
        <div style={styles.sectionHeader}>
          <span style={styles.sectionNum}>00</span>
          <h2 style={styles.sectionTitle}>How this works in 30 seconds</h2>
        </div>
        <ol style={styles.steps}>
          <li>Set users and how hard they use the agent.</li>
          <li>The model splits cost into tokens, VMs/CPU, and a small residual (safety, connectors, power markup).</li>
          <li>AWS sliders allocate only the runtime/CPU and optional token overflow. They do not assume Muse Spark is hosted on Bedrock.</li>
          <li>Compare the Meta subsidy with subscriptions and a hypothetical commerce take-rate.</li>
        </ol>
        <p style={styles.prose}>
          Muse has two expensive layers. The model burns tokens. The agent also occupies a cloud computer — a browser, disk, and CPU — even when the user is not staring at the app. Published models disagree on whether that computer is mostly idle (duty-cycle) or mostly reserved (always-on). This page lets you sit between them.
        </p>
        <p style={styles.prose}>
          Amazon’s disclosed relationship is a large Graviton CPU commitment for agentic work, plus a longer AWS/Bedrock relationship. That is not the same thing as “Muse runs on Bedrock.” The AWS sliders are labeled assumptions so you can test both the conservative and the aggressive read.
        </p>
      </section>

      <section className="muse-results" style={styles.results} aria-live="polite">
        <Tile label="Meta all-in annual cost" value={money(result.metaAllIn)} sub={`${compactCount(result.actives)} actives · ${pct(result.concurrency)} concurrency`} />
        <Tile label="Cost per active / month" value={money(result.costPerActiveMonth)} sub={result.outsidePublishedBand ? "Outside the $3.50–$4.50 cross-check" : "Inside the $3.50–$4.50 cross-check"} amber={result.outsidePublishedBand} />
        <Tile label="Token layer vs VM/CPU" value={money(result.metaTokenCost)} sub={`CPU ${money(result.cpuAnnual)} · memory ${money(result.memoryAnnual)} · power ${money(result.powerCost)} · residual ${money(result.residual)}`} />
        <Tile
          label="Estimated AWS annual bill"
          value={money(result.awsTotal)}
          sub={`${pct(result.awsPct)} of Meta Muse compute`}
          pills={[
            ["Graviton", result.awsGraviton],
            ["EC2 overflow", result.awsEc2],
            ["Bedrock", result.awsBedrock],
          ]}
        />
        <Tile label="Subscription coverage" value={pct(result.subCoverage)} sub={`${money(result.subRevenue)} / year from ${compactCount(result.paidUsers)} paid`} />
        <Tile label="Commerce take to break even" value={result.takeToBreakEven == null ? "—" : pct(result.takeToBreakEven)} sub={`After subs · GMV ${money(result.gmv)} · take now ${money(result.commerceTake)}`} />
      </section>

      <p style={styles.who}>{whoWinsCopy(result.who)}</p>

      <div className="muse-presets" style={styles.presets}>
        {Object.entries(PRESETS).map(([key, item]) => (
          <button
            key={key}
            type="button"
            className="preset-btn"
            aria-pressed={activePreset === key || preset === key}
            onClick={() => apply(key)}
            style={{ ...styles.preset, ...((preset === key) ? styles.presetOn : {}) }}
          >
            {item.label}{key === "bep-base" ? " (default)" : ""}
          </button>
        ))}
        <button type="button" onClick={copyLink} style={styles.action}>{copied ? "Copied" : "Copy assumptions link"}</button>
        <button type="button" onClick={download} style={styles.action}>Export scenario JSON</button>
      </div>
      {PRESETS[preset] ? <p style={styles.presetNote}>{PRESETS[preset].note}</p> : <p style={styles.presetNote}>Custom scenario. Presets only move sliders.</p>}

      <div className="muse-controls">
        <Group n="01" title="Scale">
          <div className="muse-slider-grid" style={styles.grid}>
            <Slider label="Registered users" unit="people" chip="ASSUME" log min={LIMITS.registeredUsers[0]} max={LIMITS.registeredUsers[1]} value={inputs.registeredUsers} onChange={set("registeredUsers")} format={compactCount} hint="Actives = registered × active rate." />
            <Slider label="Active rate" unit="share of registered" chip="ASSUME" min={0.05} max={1} step={0.01} value={inputs.activeRate} onChange={set("activeRate")} format={pct} />
            <Slider label="Paid mix" unit="share of actives" chip="ASSUME" min={0} max={0.2} step={0.005} value={inputs.paidMix} onChange={set("paidMix")} format={pct} />
            <Slider label="Paid ARPU" unit="$ / month" chip="META" min={20} max={100} step={1} value={inputs.paidArpu} onChange={set("paidArpu")} format={(n) => `$${n.toFixed(0)}`} hint="Blend of the $20 Power and $100 Maximum plans." />
          </div>
          <p style={styles.derived}>{compactCount(result.actives)} actives · {compactCount(result.paidUsers)} paid · {money(result.subRevenue)} subscription revenue / year.</p>
        </Group>

        <Group n="02" title="Intensity">
          <div className="muse-slider-grid" style={styles.grid}>
            <Slider label="Tasks / active / day" unit="tasks" chip="BEP" min={0.5} max={20} step={0.5} value={inputs.tasksPerDay} onChange={set("tasksPerDay")} format={(n) => n.toFixed(1)} />
            <Slider label="Minutes / task" unit="minutes" chip="BEP" min={1} max={30} step={0.5} value={inputs.minutesPerTask} onChange={set("minutesPerTask")} format={(n) => n.toFixed(1)} />
            <Slider label="Peak multiplier" unit="× average" chip="BEP" min={1} max={5} step={0.1} value={inputs.peakMultiplier} onChange={set("peakMultiplier")} format={(n) => `${n.toFixed(1)}×`} />
            <Slider label="Tokens in / task" unit="tokens" chip="BEP" min={20_000} max={1_000_000} step={10_000} value={inputs.tokensIn} onChange={set("tokensIn")} format={compactCount} />
            <Slider label="Tokens out / task" unit="tokens" chip="BEP" min={1_000} max={200_000} step={1_000} value={inputs.tokensOut} onChange={set("tokensOut")} format={compactCount} />
            <Slider label="Cache hit rate" unit="share of input" chip="ASSUME" min={0} max={0.9} step={0.01} value={inputs.cacheHit} onChange={set("cacheHit")} format={pct} />
          </div>
          <p style={styles.derived}>
            Live concurrency {pct(result.concurrency, 2)} = tasks × minutes / 1,440.
            {" "}{compactCount(result.tokensPerWeek)} tokens / active / week · {compactCount(result.totalTokens)} tokens / year.
          </p>
        </Group>

        <Group n="03" title="Token pricing">
          <Choice
            label={<>Internal cost is who-pays. List price is API value given away. <Chip id="UA" /></>}
            value={inputs.tokenMode}
            onChange={set("tokenMode")}
            options={[{ id: "internal", label: "Internal cost" }, { id: "list", label: "List price" }]}
          />
          <div className="muse-slider-grid" style={{ ...styles.grid, marginTop: 16 }}>
            <Slider label="Internal $ / 1M blended" unit="$ / million tokens" chip="UA" min={0.03} max={0.25} step={0.01} value={inputs.internalPerM} onChange={set("internalPerM")} format={(n) => `$${n.toFixed(2)}`} hint="Uncover band is $0.10–$0.20. Contributor $0.10 in / $0.20 out is the public ceiling, not the default." />
            <Slider label="Standard input" unit="$ / 1M" chip="META" min={0.1} max={10} step={0.05} value={inputs.standardIn} onChange={set("standardIn")} format={(n) => `$${n.toFixed(2)}`} hint="Observation $1.25. Override only to test the list-price ghost." />
            <Slider label="Cached input" unit="$ / 1M" chip="META" min={0} max={2} step={0.01} value={inputs.standardCached} onChange={set("standardCached")} format={(n) => `$${n.toFixed(2)}`} hint="Observation $0.15." />
            <Slider label="Standard output" unit="$ / 1M" chip="META" min={0.1} max={20} step={0.05} value={inputs.standardOut} onChange={set("standardOut")} format={(n) => `$${n.toFixed(2)}`} hint="Observation $4.25." />
          </div>
          <p style={styles.derived}>
            Selected token bill {money(result.tokenCost)} · list-price ghost {money(result.listValue)} · contributor-shaped ceiling {money(result.contributorCeiling)}.
            Internal mode applies the blended rate to every token. Cache only changes the list-price ghost.
          </p>
        </Group>

        <Group n="04" title="VM / CPU hardware">
          <Choice
            label="VM persistence. Duty-cycle and always-on are two views of the same layer. They are not added."
            value={inputs.persistence}
            onChange={set("persistence")}
            options={[{ id: "duty", label: "Duty-cycle (BEP)" }, { id: "hybrid", label: "Hybrid" }, { id: "always", label: "Always-on" }]}
          />
          <Choice
            label="Hardware dollars. Full TCO uses the nextsignal schedule on this mode’s machine count, split into CPU and memory. Processor-only prices sockets: the BEP thread formula on duty-cycle, or the fleet’s vCPUs on always-on and hybrid. Processor-only excludes memory."
            value={inputs.hardwareView}
            onChange={set("hardwareView")}
            options={[{ id: "full", label: "Full VM TCO" }, { id: "processor", label: "Processor-only" }]}
          />
          <div className="muse-slider-grid" style={{ ...styles.grid, marginTop: 16 }}>
            <Slider label="Warm share of actives" unit="share kept hot" chip="ASSUME" min={0} max={1} step={0.01} value={inputs.warmShare} onChange={set("warmShare")} format={pct} hint="Hybrid only. Default 15%." />
            <Slider label="vCPU / VM" unit="vCPU" chip="NSP" min={1} max={8} step={1} value={inputs.vcpu} onChange={set("vcpu")} format={(n) => n.toFixed(0)} />
            <Slider label="RAM / VM" unit="GB" chip="NSP" min={2} max={16} step={1} value={inputs.ramGb} onChange={set("ramGb")} format={(n) => n.toFixed(0)} />
            <Slider label="Processor $ / 256-thread socket" unit="$ list" chip="BEP" min={4000} max={20000} step={1} value={inputs.processorPrice} onChange={set("processorPrice")} format={(n) => `$${Math.round(n).toLocaleString("en-US")}`} hint="EPYC 9755 list about $10,931. Excludes memory, chassis, power, and ops." />
            <Slider label="CPU utilization" unit="share" chip="BEP" min={0.4} max={0.85} step={0.01} value={inputs.utilization} onChange={set("utilization")} format={pct} />
            <Slider label="Hardware $ / 100M hot VMs" unit="$ capex" chip="NSP" min={20e9} max={60e9} step={1e9} value={inputs.hardwarePer100m} onChange={set("hardwarePer100m")} format={(n) => money(n, 0)} hint="Published band $30–50B. Default $40B." />
            <Slider label="Useful life" unit="years" chip="NSP" min={3} max={6} step={0.1} value={inputs.usefulLife} onChange={set("usefulLife")} format={(n) => n.toFixed(1)} hint="5.5 years matches nextsignal. Slide to 3 for BEP’s “fleet built over three years.”" />
            <Slider label="Facility power markup" unit="share of depreciation" chip="ASSUME" min={0} max={0.5} step={0.01} value={inputs.powerMarkup} onChange={set("powerMarkup")} format={pct} hint="NSP also cites ~1.60 kW IT and PUE 1.3. Dollars here are a percent of depreciation, not a tariff." />
            <Slider label="Safety / connectors" unit="$ / active / month" chip="AA84" min={0} max={2} step={0.05} value={inputs.residualPerMonth} onChange={set("residualPerMonth")} format={(n) => `$${n.toFixed(2)}`} />
          </div>
          <p style={styles.derived}>
            {result.processorPath ? "Processor-only" : "Full VM TCO"} · {compactCount(result.vmUsersForHardware)} VM-equivalents · capex {money(result.hardwareCapex)} · CPU {money(result.cpuAnnual)}/yr · memory {money(result.memoryAnnual)}/yr · power {money(result.powerCost)}/yr · ~{result.facilityGw.toFixed(2)} GW scaled from the 1.63 GW / 100M VM observation.
            An 8 vCPU box is {result.grokMultiple.toFixed(1)}× this VM on a 60/40 CPU/memory split of the nextsignal schedule <Chip id="ASSUME" />.
            BEP’s ~$1.3B processor line is 1B users, duty-cycle, 3-year life, before power — not this default.
          </p>
        </Group>

        <Group n="05" title="AWS allocation">
          <p style={styles.method}>
            Graviton dollars are EC2/custom-silicon dollars. Bedrock dollars are managed-inference dollars. This calculator will not collapse them. Default Bedrock share is 5% because Muse Spark is sold on Meta’s own API. Raise it only if you believe Meta will overflow tokens onto Bedrock or call third-party models there.
          </p>
          <h3 style={styles.subhead}>Graviton / agentic CPU <Chip id="AWS" /> <Chip id="ASSUME" /></h3>
          <div className="muse-slider-grid" style={styles.grid}>
            <Slider label="Graviton share of VM/CPU $" unit="share" chip="ASSUME" min={0} max={0.8} step={0.01} value={inputs.gravitonShare} onChange={set("gravitonShare")} format={pct} hint="April 2026 deal is “tens of millions of cores” for agentic CPU. BEP Base at 1B users is about 45M cores. Default is not “all Muse VMs live at AWS.”" />
            <Slider label="Graviton $ / core-year" unit="$ / core-year" chip="ASSUME" min={30} max={200} step={1} value={inputs.gravitonPerCoreYear} onChange={set("gravitonPerCoreYear")} format={(n) => `$${n.toFixed(0)}`} hint="Back-solved from “multi-billion over several years” ÷ tens of millions of cores. Contract terms are undisclosed." />
            <Slider label="Committed Graviton cores" unit="cores" chip="AWS" min={10e6} max={80e6} step={1e6} value={inputs.committedCores} onChange={set("committedCores")} format={compactCount} hint="Observation: “tens of millions.”" />
          </div>
          <label style={styles.check}>
            <input type="checkbox" checked={inputs.capToCommitted} onChange={(e) => set("capToCommitted")(e.target.checked)} />
            Cap Graviton dollars at committed cores × $ / core-year <Chip id="ASSUME" />
          </label>
          {result.impliedCores > inputs.committedCores ? (
            <p style={styles.warn}>Needed cores exceed the commitment. Overflow moves to the owned fleet or general EC2.</p>
          ) : null}
          {result.gravitonCapBinds ? (
            <p style={styles.warn}>Share of VM/CPU would exceed the core cap. Graviton bill is capped at {money(result.gravitonFromCores)}.</p>
          ) : null}

          <h3 style={styles.subhead}>General AWS CPU overflow <Chip id="ASSUME" /></h3>
          <div className="muse-slider-grid" style={styles.grid}>
            <Slider label="Overflow to general AWS EC2" unit="share of non-Graviton CPU" chip="ASSUME" min={0} max={0.6} step={0.01} value={inputs.overflowShare} onChange={set("overflowShare")} format={pct} />
            <Slider label="EC2 premium vs owned" unit="multiple" chip="ASSUME" min={1} max={2} step={0.05} value={inputs.ec2Premium} onChange={set("ec2Premium")} format={(n) => `${n.toFixed(2)}×`} />
          </div>

          <h3 style={styles.subhead}>Bedrock token overflow <Chip id="ASSUME" /></h3>
          <p style={styles.hint}>Most speculative slider on the page. Muse Spark is first-party. Bedrock is more plausible for routing, fallback models, Llama-family calls, or enterprise-adjacent features than for the core consumer agent. Default is low on purpose.</p>
          <div className="muse-slider-grid" style={styles.grid}>
            <Slider label="Bedrock share of tokens" unit="share" chip="ASSUME" min={0} max={0.4} step={0.01} value={inputs.bedrockShare} onChange={set("bedrockShare")} format={pct} />
            <Slider label="Bedrock $ / 1M vs Meta internal" unit="multiple" chip="ASSUME" min={1} max={4} step={0.1} value={inputs.bedrockMarkup} onChange={set("bedrockMarkup")} format={(n) => `${n.toFixed(1)}×`} hint="Managed inference. Expect a stack markup if it is used at all." />
          </div>
          <Choice
            label="Bedrock mix"
            value={inputs.bedrockMix}
            onChange={set("bedrockMix")}
            options={[{ id: "meta", label: "Meta models on Bedrock" }, { id: "third", label: "Third-party models on Bedrock" }]}
          />
          {inputs.bedrockMix === "third" ? (
            <>
              <p style={styles.hint}>Anecdotal split from former-AWS commentary circulating in 2026 notes. The three shares are forced to sum to 100%.</p>
              <div className="muse-slider-grid" style={styles.grid}>
                <Slider label="AWS platform take" unit="share of Bedrock bill" chip="ASSUME" min={0} max={1} step={0.01} value={inputs.platformPct} onChange={setSplit("platformPct")} format={pct} />
                <Slider label="Model vendor slice" unit="share of Bedrock bill" chip="ASSUME" min={0} max={1} step={0.01} value={inputs.vendorPct} onChange={setSplit("vendorPct")} format={pct} />
                <Slider label="AWS infra inside Bedrock" unit="share of Bedrock bill" chip="ASSUME" min={0} max={1} step={0.01} value={inputs.infraPct} onChange={setSplit("infraPct")} format={pct} />
              </div>
              <p style={styles.derived}>Vendor (not AWS) {money(result.modelVendorSlice)} · AWS platform + infra {money(result.awsBedrock)}.</p>
            </>
          ) : null}
        </Group>

        <Group n="06" title="Who pays the subsidy">
          <div className="muse-slider-grid" style={styles.grid}>
            <Slider label="Commerce GMV / active / year" unit="$" chip="ASSUME" min={0} max={2000} step={10} value={inputs.gmvPerActive} onChange={set("gmvPerActive")} format={(n) => `$${Math.round(n)}`} />
            <Slider label="Meta take-rate" unit="share of GMV" chip="ASSUME" min={0} max={0.08} step={0.005} value={inputs.takeRate} onChange={set("takeRate")} format={pct} />
          </div>
          <label style={styles.check}>
            <input type="checkbox" checked={inputs.amazonBlocks} onChange={(e) => set("amazonBlocks")(e.target.checked)} />
            Amazon blocks Muse shopping on Amazon.com — cut GMV 25%. Other merchants are not blocked. <Chip id="ASSUME" />
          </label>
          <p style={styles.derived}>Uncovered after subs and commerce: {money(result.uncovered)}. No ads inside Muse at launch <Chip id="META" />.</p>
        </Group>
      </div>

      <section style={styles.section}>
        <div style={styles.sectionHeader}>
          <span style={styles.sectionNum}>07</span>
          <h2 style={styles.sectionTitle}>Cost bridge</h2>
        </div>
        <div style={styles.bridge}>
          <BridgeRow label="List-price token value (ghost)" value={result.listValue} bar={bar(result.listValue, "#a8a29e", true)} ghost />
          <BridgeRow label="Meta token spend, after Bedrock markup" value={result.metaTokenCost} bar={bar(result.metaTokenCost, "#1c1917")} />
          <BridgeRow label="CPU depreciation" value={result.cpuAnnual} bar={bar(result.cpuAnnual, "#d97706")} />
          <BridgeRow label="Memory depreciation" value={result.memoryAnnual} bar={bar(result.memoryAnnual, "#b45309")} />
          <BridgeRow label="Power" value={result.powerCost} bar={bar(result.powerCost, "#78716c")} />
          <BridgeRow label="EC2 premium above owned CPU" value={result.ec2Uplift} bar={bar(result.ec2Uplift, "#0284c7")} />
          <BridgeRow label="VM layer" value={result.vmLayer} bar={bar(result.vmLayer, "#d97706")} strong />
          <BridgeRow label="Residual safety / connectors" value={result.residual} bar={bar(result.residual, "#78716c")} />
          <BridgeRow label="Meta all-in" value={result.metaAllIn} bar={bar(result.metaAllIn, "#1c1917")} strong />
          <BridgeRow label="of which AWS Graviton" value={result.awsGraviton} bar={bar(result.awsGraviton, "#0369a1")} />
          <BridgeRow label="of which AWS EC2 overflow" value={result.awsEc2} bar={bar(result.awsEc2, "#0284c7")} />
          <BridgeRow label="of which Bedrock (AWS portion)" value={result.awsBedrock} bar={bar(result.awsBedrock, "#7c3aed")} />
          <BridgeRow label="AWS total" value={result.awsTotal} bar={bar(result.awsTotal, "#0369a1")} strong />
          <BridgeRow label="Meta-owned remainder" value={Math.max(0, result.metaAllIn - result.awsTotal)} bar={bar(Math.max(0, result.metaAllIn - result.awsTotal), "#44403c")} />
        </div>
      </section>

      <section className="muse-two" style={styles.two}>
        <div>
          <div style={styles.sectionHeader}>
            <span style={styles.sectionNum}>08</span>
            <h2 style={styles.sectionTitle}>Coverage</h2>
          </div>
          <Coverage result={result} />
        </div>
        <div>
          <div style={styles.sectionHeader}>
            <span style={styles.sectionNum}>09</span>
            <h2 style={styles.sectionTitle}>Per active user / month</h2>
          </div>
          <div style={{ ...styles.card, ...(result.outsidePublishedBand ? styles.cardAmber : {}) }}>
            <Row k="Inference" v={money(result.inferenceMonth)} />
            <Row k="CPU" v={money(result.cpuMonth)} />
            <Row k="Memory" v={money(result.memoryMonth)} />
            <Row k="Power" v={money(result.powerMonth)} />
            <Row k="VM layer" v={money(result.vmMonth)} />
            <Row k="Residual" v={money(result.residualMonth)} />
            <Row k="Total" v={money(result.costPerActiveMonth)} strong />
            <p style={styles.hint}>
              alphaseeker84 published about $3.50–$4.50, with inference near $1.40 and VM near $1.60. This tile turns amber outside that band. Plans on the page are ${OBS.plans.power} and ${OBS.plans.maximum}. Wide sanity flag is under ${OBS.aa84WideLow.toFixed(2)} or over ${OBS.aa84WideHigh.toFixed(2)}{result.outsideWideBand ? " — flagged." : "."}
            </p>
          </div>
        </div>
      </section>

      <section style={styles.section}>
        <div style={styles.sectionHeader}>
          <span style={styles.sectionNum}>10</span>
          <h2 style={styles.sectionTitle}>Users × intensity</h2>
          <span style={styles.sectionMeta}>Meta $B · AWS $B</span>
        </div>
        <div style={styles.tableWrap}>
          <div className="muse-matrix" style={styles.matrix}>
            <span />
            {Object.values(INTENSITY).map((spec) => <span key={spec.label} style={styles.hmHead}>{spec.label}</span>)}
            {matrix.map((row) => (
              <span key={row.actives} style={{ display: "contents" }}>
                <span style={styles.hmRowHead}>{compactCount(row.actives)} actives</span>
                {Object.keys(INTENSITY).map((key) => (
                  <span key={key} style={styles.hmCell}>
                    {money(row.cells[key].metaAllIn, 1)}
                    <span style={styles.hmSub}>{money(row.cells[key].awsTotal, 1)} AWS</span>
                  </span>
                ))}
              </span>
            ))}
          </div>
        </div>
      </section>

      <section style={styles.section}>
        <div style={styles.sectionHeader}>
          <span style={styles.sectionNum}>11</span>
          <h2 style={styles.sectionTitle}>Agentic cores</h2>
        </div>
        <div className="muse-tiles" style={styles.tiles}>
          <Tile label="Implied cores (BEP math)" value={compactCount(result.impliedCores)} sub={`${compactCount(result.neededServers)} sockets · util ${pct(inputs.utilization, 0)}`} />
          <Tile label="Committed Graviton cores" value={compactCount(inputs.committedCores)} sub="Observation, not a Muse-only figure" />
          <Tile label="Gap" value={compactCount(result.coreGap)} sub={result.coreGap > 0 ? "Short of the duty-cycle need" : "Commitment covers the duty-cycle need"} />
          <Tile label="Share of 120M cores / GW" value={result.coresPerGw.toFixed(2)} sub="Haas rule of thumb, via BEP" />
        </div>
      </section>

      <section style={styles.section}>
        <div style={styles.sectionHeader}>
          <span style={styles.sectionNum}>12</span>
          <h2 style={styles.sectionTitle}>Sources</h2>
        </div>
        <ul style={styles.sources}>
          {SOURCES.map((line) => <li key={line}>{line}</li>)}
        </ul>
        <p style={styles.prose}>
          Figures above are adapted from those essays and disclosures. This is not their official calculator. The $20 Power plan is reported at {compactCount(OBS.powerTokensWeek)} Muse tokens/week and the $100 Maximum plan at {compactCount(OBS.maximumTokensWeek)} / week. Contributor API observations, unused as the default bill: $0.10 in / $0.002 cached / $0.20 out per 1M.
        </p>
        <p style={styles.disclaimer}>
          This is a simplified research model stitched from public essays and company disclosures. It is not Meta’s cost accounting and not Amazon’s revenue recognition. Contract pricing for Graviton and any Bedrock use is undisclosed. Do not treat outputs as forecasts. Not investment advice.
        </p>
      </section>
    </main>
  );
}

function Tile({ label, value, sub, pills, amber }) {
  return (
    <div style={{ ...styles.tile, ...(amber ? styles.tileAmber : {}) }}>
      <div style={styles.tileLabel}>{label}</div>
      <div style={styles.tileValue}>{value}</div>
      {sub ? <div style={styles.tileSub}>{sub}</div> : null}
      {pills ? (
        <div style={styles.pills}>
          {pills.map(([name, amount]) => (
            <span key={name} style={styles.pill}>{name} {money(amount)}</span>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function Group({ n, title, children }) {
  return (
    <section style={styles.section}>
      <div style={styles.sectionHeader}>
        <span style={styles.sectionNum}>{n}</span>
        <h2 style={styles.sectionTitle}>{title}</h2>
      </div>
      <div style={styles.card}>{children}</div>
    </section>
  );
}

function BridgeRow({ label, value, bar, strong, ghost }) {
  return (
    <div style={{ ...styles.bridgeRow, ...(strong ? styles.bridgeStrong : {}) }}>
      <div>
        <div style={{ color: ghost ? "#78716c" : "#1c1917" }}>{label}</div>
        {bar}
      </div>
      <div style={styles.bridgeValue}>{money(value)}</div>
    </div>
  );
}

function Row({ k, v, strong }) {
  return (
    <div style={{ ...styles.kv, ...(strong ? { fontWeight: 700 } : {}) }}>
      <span>{k}</span>
      <span style={{ fontFamily: mono }}>{v}</span>
    </div>
  );
}

function Coverage({ result }) {
  const parts = [
    ["Subscriptions", Math.max(0, result.subRevenue), "#d97706"],
    ["Commerce take", Math.max(0, result.commerceTake), "#0369a1"],
    ["Uncovered subsidy", Math.max(0, result.uncovered), "#e7e5e4"],
  ];
  const total = parts.reduce((s, [, v]) => s + v, 0) || 1;
  return (
    <div style={styles.card}>
      <div style={styles.stack} aria-hidden="true">
        {parts.map(([name, value, color]) => (
          <span key={name} style={{ width: `${(value / total) * 100}%`, background: color, minWidth: value > 0 ? 4 : 0 }} />
        ))}
      </div>
      {parts.map(([name, value]) => <Row key={name} k={name} v={money(value)} />)}
    </div>
  );
}

const styles = {
  wrap: { maxWidth: 1180, margin: "0 auto", padding: "48px 56px 0" },
  hero: { paddingBottom: 28, borderBottom: "1px solid #e7e5e4", marginBottom: 28 },
  eyebrow: { fontFamily: mono, fontSize: 11, letterSpacing: "0.18em", color: "#78716c", marginBottom: 12 },
  title: { fontSize: 52, lineHeight: 1.02, letterSpacing: "-0.03em", fontWeight: 650, margin: "0 0 12px" },
  subtitle: { fontSize: 18, lineHeight: 1.5, color: "#44403c", maxWidth: 680, margin: 0 },
  section: { marginTop: 28 },
  sectionHeader: { display: "flex", alignItems: "baseline", gap: 14, marginBottom: 12, paddingBottom: 8, borderBottom: "1px solid #d6d3d1" },
  sectionNum: { fontFamily: mono, fontSize: 12, color: "#d97706", fontWeight: 700 },
  sectionTitle: { fontSize: 22, fontWeight: 600, margin: 0, letterSpacing: "-0.01em" },
  sectionMeta: { marginLeft: "auto", fontFamily: mono, fontSize: 11, color: "#78716c" },
  steps: { margin: "0 0 12px 18px", padding: 0, color: "#44403c", lineHeight: 1.55 },
  prose: { fontSize: 15, lineHeight: 1.6, color: "#44403c", maxWidth: 760, margin: "0 0 10px" },
  results: { display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginTop: 8 },
  tile: { border: "1px solid #1c1917", background: "#fff", padding: "16px 16px 14px" },
  tileAmber: { background: "#fffbeb", border: "1px solid #d97706" },
  tileLabel: { fontFamily: mono, fontSize: 10, letterSpacing: "0.08em", textTransform: "uppercase", color: "#78716c" },
  tileValue: { fontSize: 32, fontWeight: 700, letterSpacing: "-0.03em", marginTop: 6 },
  tileSub: { fontSize: 12, color: "#57534e", marginTop: 6, lineHeight: 1.4 },
  pills: { display: "flex", flexWrap: "wrap", gap: 6, marginTop: 10 },
  pill: { fontFamily: mono, fontSize: 10, border: "1px solid #bae6fd", background: "#f0f9ff", color: "#0c4a6e", padding: "3px 6px" },
  who: { fontSize: 15, lineHeight: 1.55, margin: "14px 0 0", maxWidth: 820 },
  presets: { display: "flex", flexWrap: "wrap", gap: 8, marginTop: 18 },
  preset: { fontFamily: mono, fontSize: 11, letterSpacing: "0.04em", border: "1px solid #d6d3d1", background: "#fff", padding: "8px 10px", cursor: "pointer", color: "#1c1917" },
  presetOn: { background: "#1c1917", color: "#fef3c7", borderColor: "#1c1917" },
  action: { fontFamily: mono, fontSize: 11, letterSpacing: "0.04em", border: "1px solid #d97706", background: "#fffbeb", padding: "8px 10px", cursor: "pointer" },
  presetNote: { fontSize: 13, color: "#57534e", margin: "8px 0 0" },
  card: { border: "1px solid #e7e5e4", background: "#fff", padding: 16 },
  cardAmber: { background: "#fffbeb", border: "1px solid #f59e0b" },
  grid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px 22px" },
  slider: { display: "flex", flexDirection: "column", gap: 4 },
  sliderTop: { display: "flex", justifyContent: "space-between", gap: 12, alignItems: "baseline" },
  sliderLabel: { fontSize: 14, lineHeight: 1.35 },
  unit: { color: "#78716c", fontSize: 12 },
  sliderValue: { fontFamily: mono, fontSize: 13, fontWeight: 600, whiteSpace: "nowrap" },
  range: { width: "100%", accentColor: "#d97706" },
  hint: { fontSize: 12, color: "#78716c", lineHeight: 1.45 },
  derived: { fontSize: 13, color: "#44403c", margin: "12px 0 0", lineHeight: 1.5 },
  choice: { marginTop: 8 },
  choiceRow: { display: "flex", flexWrap: "wrap", gap: 8, marginTop: 8 },
  choiceBtn: { fontFamily: mono, fontSize: 11, border: "1px solid #d6d3d1", background: "#fff", padding: "7px 10px", cursor: "pointer" },
  choiceOn: { background: "#1c1917", color: "#fef3c7", borderColor: "#1c1917" },
  method: { fontSize: 14, lineHeight: 1.55, background: "#fafaf9", borderLeft: "3px solid #0369a1", padding: "10px 12px", margin: "0 0 14px" },
  subhead: { fontSize: 16, fontWeight: 600, margin: "16px 0 8px" },
  check: { display: "flex", gap: 8, alignItems: "flex-start", fontSize: 14, marginTop: 12, lineHeight: 1.4 },
  warn: { background: "#fffbeb", border: "1px solid #f59e0b", padding: "8px 10px", fontSize: 13, marginTop: 10 },
  bridge: { border: "1px solid #1c1917" },
  bridgeRow: { display: "grid", gridTemplateColumns: "1fr auto", gap: 16, padding: "10px 14px", borderBottom: "1px solid #e7e5e4", fontSize: 14 },
  bridgeStrong: { background: "#fef3c7", fontWeight: 700 },
  bridgeValue: { fontFamily: mono, fontVariantNumeric: "tabular-nums" },
  two: { display: "grid", gridTemplateColumns: "1.2fr 0.8fr", gap: 22, marginTop: 28 },
  stack: { display: "flex", height: 16, width: "100%", marginBottom: 12, border: "1px solid #1c1917" },
  kv: { display: "flex", justifyContent: "space-between", gap: 12, padding: "6px 0", borderBottom: "1px solid #f5f5f4", fontSize: 14 },
  tableWrap: { overflowX: "auto" },
  matrix: { display: "grid", gridTemplateColumns: "140px repeat(3, 1fr)", minWidth: 520 },
  hmHead: { fontFamily: mono, fontSize: 10, letterSpacing: "0.08em", textTransform: "uppercase", textAlign: "right", color: "#78716c", padding: "8px 6px" },
  hmRowHead: { fontFamily: mono, fontSize: 12, fontWeight: 700, padding: "10px 4px" },
  hmCell: { textAlign: "right", fontFamily: mono, fontSize: 13, padding: "8px 6px", borderTop: "1px solid #e7e5e4" },
  hmSub: { display: "block", color: "#0369a1", fontSize: 11, fontWeight: 500 },
  tiles: { display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 },
  sources: { margin: "0 0 12px 18px", padding: 0, fontSize: 14, lineHeight: 1.55, color: "#44403c" },
  disclaimer: { fontFamily: mono, fontSize: 11, lineHeight: 1.6, color: "#78716c", maxWidth: 760, marginTop: 16 },
};
