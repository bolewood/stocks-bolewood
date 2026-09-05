"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  SFTBY_SOTP_DATA as data, DEFAULT_INPUTS, computeSotp, ARM_SHARES,
  TOKYO_SHARES, ADR_SHARES, IR_JPY_T, IR_USDJPY, jpyTToUsdB,
  OPENAI_DEFAULT_EQUITY_B, OPENAI_OWNERSHIP_AT_COMPLETION,
} from "../lib/sftbySotp.mjs";
import { INPUT_LIMITS, PRESETS, writeSotpScenario } from "../lib/sftbyScenario.mjs";
import wrapper from "../data/wrappers/SFTBY.json";
import marks from "../data/marks.json";

const fmtUsd = (n, d = 2) => Number.isFinite(n) ? n.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: d, maximumFractionDigits: d }) : "—";
const fmtUsdB = n => Number.isFinite(n) ? `${n < 0 ? "−" : ""}$${Math.abs(n).toFixed(Math.abs(n) >= 100 ? 1 : 2)}B` : "—";
const fmtNum = (n, d = 0) => Number.isFinite(n) ? n.toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d }) : "—";
const fmtPct = (n, d = 1) => Number.isFinite(n) ? `${n.toFixed(d)}%` : "—";
const fmtYenT = n => `¥${n.toFixed(2)}T`;

function Source({ href, children }) {
  return <a href={href} target="_blank" rel="noopener noreferrer" style={styles.sourceLink}>{children}</a>;
}

function Input({ field, label, inputs, setInput, step = 1, range, note }) {
  const [min, max] = INPUT_LIMITS[field];
  const update = e => {
    if (e.target.value.trim() === "") return;
    const n = Number(e.target.value);
    if (Number.isFinite(n)) setInput(field, Math.max(min, Math.min(max, n)));
  };
  return <div style={styles.controlGroup}>
    <label htmlFor={`sftby-${field}`} style={styles.label}>{label}</label>
    <input id={`sftby-${field}`} type="number" min={min} max={max} step={step}
      value={inputs[field]} onChange={update} style={styles.smallInput} className="vcx-input vcx-small-input" />
    {range && <input aria-label={`${label} slider`} type="range" min={range[0]} max={range[1]} step={step}
      value={Math.max(range[0], Math.min(range[1], inputs[field]))} onChange={update}
      style={{ width: "100%", marginTop: 8, accentColor: "#d97706" }} />}
    {note && <div style={styles.note}>{note}</div>}
  </div>;
}

export default function SFTBYSOTPFinder({ initialInputs = DEFAULT_INPUTS, initialScenario = "base", pinnedFields = [], reference = false }) {
  const [inputs, setInputs] = useState(initialInputs);
  const [activeScenario, setActiveScenario] = useState(initialScenario);
  const [quoteState, setQuoteState] = useState(reference ? "Frozen September 4 reference quotes" : "September 4 fallback quotes");
  const [tokyoPrice, setTokyoPrice] = useState(data.quoteSnapshot.TOKYO);
  const [exportMessage, setExportMessage] = useState("");
  const edited = useRef(new Set(pinnedFields));
  const marketInputs = useRef({ armPrice: DEFAULT_INPUTS.armPrice, sftbyPrice: DEFAULT_INPUTS.sftbyPrice, usdJpy: DEFAULT_INPUTS.usdJpy });

  useEffect(() => {
    if (reference) return;
    const controller = new AbortController();
    fetch("/api/prices", { cache: "no-store", signal: controller.signal })
      .then(r => { if (!r.ok) throw new Error("Quote fetch failed"); return r.json(); })
      .then(result => {
        if (result.source === "fallback") {
          setQuoteState("Quote fetch unavailable · September 4 fallbacks or supplied inputs");
          return;
        }
        const p = result.prices || {};
        const updates = {};
        for (const [field, ticker] of [["armPrice", "ARM"], ["sftbyPrice", "SFTBY"], ["usdJpy", "USDJPY"]]) {
          if (Number.isFinite(p[ticker]) && p[ticker] > 0) {
            marketInputs.current[field] = p[ticker];
            if (!edited.current.has(field)) updates[field] = p[ticker];
          }
        }
        setInputs(previous => ({ ...previous, ...updates }));
        if (Number.isFinite(p.TOKYO9984) && p.TOKYO9984 > 0) setTokyoPrice(p.TOKYO9984);
        const source = ({ live: "Market quotes", cache: "Cached market quotes", partial: "Mixed market / fallback quotes", fallback: "Fallback quotes" })[result.source] || "Quote status unavailable";
        const fetched = new Date(result.asOf);
        setQuoteState(`${source}${Number.isFinite(fetched.getTime()) ? ` · retrieved ${fetched.toISOString().slice(0, 16).replace("T", " ")} UTC` : ""}. May reflect the last close.`);
      })
      .catch(() => { if (!controller.signal.aborted) setQuoteState("Quote fetch unavailable · September 4 fallbacks or supplied inputs"); });
    return () => controller.abort();
  }, [reference]);

  const setInput = (field, value) => {
    edited.current.add(field);
    setInputs(previous => ({ ...previous, [field]: value }));
    setActiveScenario(null);
    setExportMessage("");
  };
  const applyPreset = key => {
    Object.keys(INPUT_LIMITS).forEach(field => edited.current.add(field));
    setInputs({ ...DEFAULT_INPUTS, ...marketInputs.current, ...PRESETS[key].inputs });
    setActiveScenario(key);
    setExportMessage("");
  };
  const calc = useMemo(() => computeSotp(inputs), [inputs]);
  const inputProps = { inputs, setInput };
  const copyScenario = async () => {
    const url = `${window.location.origin}/sftby?${writeSotpScenario(inputs)}`;
    window.history.replaceState({}, "", url);
    try { await navigator.clipboard.writeText(url); setExportMessage("Scenario link copied; all inputs are fixed in the link."); }
    catch { setExportMessage("Scenario saved in the address bar. Copy its URL to share these exact inputs."); }
  };
  const exportScenario = () => {
    const artifact = { calculator: "sftby-sotp", version: data.version, reviewedAt: data.reviewedAt,
      exportedAt: new Date().toISOString(), inputs, result: calc,
      assumptions: data, sharedWrapper: wrapper, companyMarks: marks };
    const url = URL.createObjectURL(new Blob([JSON.stringify(artifact, null, 2)], { type: "application/json" }));
    const link = document.createElement("a");
    link.href = url; link.download = "sftby-scenario.json"; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const waterfall = [
    ["Arm gross at selected quote", calc.armGrossB],
    ["Arm-backed financing (deducted once)", -calc.armAbfB],
    ["SVF2 · SBG's June NAV share, including OpenAI", calc.svf2BaseB],
    ["Other June holdings × selected multiplier", calc.stubB],
    ["OpenAI change from June gross FV, after liquidity discount", calc.openaiChangeB],
    ["Estimated management allocation on positive new revaluation", -calc.managementB],
    ["SBG adjusted net debt + funding + other adjustment", -calc.sbgNdB],
    ["Illustrative tax leakage", -calc.taxB],
    ["Modeled holdco NAV", calc.navB],
  ];

  return <div style={styles.container} className="vcx-container sats-container">
    <div style={styles.header}>
      <div style={styles.eyebrow} className="vcx-eyebrow">SOFTBANK GROUP · SFTBY / 9984 · HOLDCO SOTP</div>
      <h1 style={styles.title} className="vcx-title">SFTBY <span style={styles.titleAccent}>SOTP Finder</span></h1>
      <p style={styles.subtitle} className="vcx-subtitle">Start with SoftBank&apos;s reported holdings, revalue Arm and OpenAI, then account for funding, debt and optional discounts. The gross OpenAI exposure uses the same valuation anchor, pro forma stake and ADR share count as the <a href="/ai" style={styles.sourceLink}>AI exposure calculator</a>.</p>
    </div>

    <div style={styles.asOfBox}>
      <strong>Research checked September 5, 2026.</strong> Holdings and debt: June 30. OpenAI funded fair value: July 31. This is a mixture of dated disclosures, selected quotes and estimates, not a current reported balance sheet.
      <div style={{ marginTop: 8 }}>{quoteState} Controls can override quotes.</div>
    </div>
    <div style={styles.howToBox}>
      <div style={styles.howToTitle}>What the model assumes</div>
      <ol style={styles.howToList}>
        <li><strong>Arm:</strong> {fmtNum(ARM_SHARES)} disclosed shares × the selected price, less June financing.</li>
        <li><strong>OpenAI:</strong> default {fmtPct(OPENAI_OWNERSHIP_AT_COMPLETION * 100, 0)} is SVF2&apos;s pro forma stake, including the planned October $10B. The July alternative scales the rounded $100B fund fair value; it does not invent a current ownership percentage.</li>
        <li><strong>Shareholder NAV:</strong> preserve SBG&apos;s June SVF2 NAV and add only OpenAI&apos;s modeled change. Management co-investment is a separate sensitivity, not a flat deduction from the entire stake.</li>
        <li><strong>Funding:</strong> add July&apos;s $10B and, in the pro forma case, October&apos;s $10B to net debt. Other cash flows need an explicit adjustment.</li>
      </ol>
    </div>

    <div style={styles.controls} className="vcx-controls">
      <Input {...inputProps} field="armPrice" label="ARM price ($)" step={0.01} range={[80, 450]} />
      <Input {...inputProps} field="sftbyPrice" label="SFTBY ADR price ($)" step={0.01} note={`Tokyo quote ¥${fmtNum(tokyoPrice)}. One ordinary share = two ADRs.`} />
      <Input {...inputProps} field="usdJpy" label="USDJPY" step={0.001} note="Converts modeled NAV to yen. June asset and debt balances stay at June FX; their current currency mix is unknown." />
      <Input {...inputProps} field="openaiEquityB" label="OpenAI equity value ($B)" range={[0, 3000]} note={`Latest primary anchor: $${OPENAI_DEFAULT_EQUITY_B}B, March 31. $1,600B is an IPO scenario.`} />
    </div>
    <div style={styles.controls} className="vcx-controls">
      <div style={styles.controlGroup}>
        <label htmlFor="sftby-case" style={styles.label}>OpenAI holdings basis</label>
        <select id="sftby-case" value={inputs.openaiCase} onChange={e => setInput("openaiCase", e.target.value)} className="vcx-input" style={{ ...styles.smallInput, width: "100%", fontSize: 14 }}>
          <option value="funded13">Pro forma 13% · October included</option>
          <option value="current">July funded fair-value proxy</option>
        </select>
        <div style={styles.note}>Preferred and common holdings. New preferred shares automatically convert on an IPO. Security rights and future dilution can change proceeds.</div>
      </div>
      <Input {...inputProps} field="dilutionPct" label="OpenAI dilution (%)" range={[0, 50]} note="Same retained-ownership convention as /ai: multiply exposure by (1 − dilution)." />
      <Input {...inputProps} field="liqHaircutPct" label="OpenAI liquidity discount (%)" range={[0, 50]} note="Author-selected discount, not a reported fair-value adjustment." />
      <Input {...inputProps} field="stubMult" label="Other holdings multiplier" step={0.05} range={[0, 2]} note="SVF1, LatAm, SoftBank Corp., T-Mobile and other holdings. SVF2's June base stays intact." />
    </div>

    <div style={{ marginBottom: 32 }}>
      <div style={styles.howToTitle}>Scenarios</div>
      <div style={styles.scenarioGrid} className="sats-scenario-grid">
        {Object.entries(PRESETS).map(([key, preset]) => <button key={key} onClick={() => applyPreset(key)} aria-pressed={activeScenario === key}
          style={{ ...styles.scenarioCard, ...(activeScenario === key ? styles.scenarioCardActive : {}) }}>
          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>{preset.label}</div>
          <div style={{ fontSize: 12, lineHeight: 1.4 }}>{preset.note}</div>
        </button>)}
      </div>
    </div>

    <div style={styles.heroGrid} className="sats-explainer-row" data-testid="sftby-results">
      <div style={styles.heroCard} className="sats-summary-card">
        <div style={styles.heroLabel}>Modeled NAV / ADR</div>
        <div style={styles.heroValueAccent} className="vcx-gt-value-accent" data-metric="navPerAdr">{fmtUsd(calc.navPerAdr)}</div>
        <div style={styles.heroSub}>¥{fmtNum(calc.navPerTokyoYen)} per Tokyo ordinary</div>
      </div>
      <div style={styles.heroCard} className="sats-summary-card">
        <div style={styles.heroLabel}>Management sensitivity / ADR</div>
        <div style={styles.heroValue} className="vcx-gt-value-large">{fmtUsd(calc.allocationLowPerAdr)}–{fmtUsd(calc.allocationHighPerAdr)}</div>
        <div style={styles.heroSub}>17.25% to 0% of positive post-June revaluation. Only this assumption varies; this is not a complete valuation range.</div>
      </div>
      <div style={styles.heroCard} className="sats-summary-card">
        <div style={styles.heroLabel}>Discount to modeled NAV</div>
        <div style={styles.heroValue} className="vcx-gt-value-large" data-metric="discountPct">{fmtPct(calc.discountPct)}</div>
        <div style={styles.heroSub}>Market cap {fmtUsdB(calc.mcapB)} / NAV {fmtUsdB(calc.navB)}</div>
      </div>
      <div style={styles.heroCard} className="sats-summary-card">
        <div style={styles.heroLabel}>Modeled adjusted LTV</div>
        <div style={styles.heroValue} className="vcx-gt-value-large">{fmtPct(calc.ltvPct)}</div>
        <div style={styles.heroSub}>{fmtUsdB(calc.sbgNdB)} net debt / {fmtUsdB(calc.holdingsB)} holdings. This is not today&apos;s reported LTV.</div>
      </div>
      <div style={styles.heroCard} className="sats-summary-card">
        <div style={styles.heroLabel}>Gross OpenAI per $100 SFTBY</div>
        <div style={styles.heroValue} className="vcx-gt-value-large" data-metric="openaiPer100">{fmtUsd(calc.centsOpenaiGross)}</div>
        <div style={styles.heroSub}>Before management allocation, debt, tax and liquidity discounts. Pro forma mode matches /ai at identical price, valuation and dilution.</div>
      </div>
      <div style={styles.heroCard} className="sats-summary-card">
        <div style={styles.heroLabel}>OpenAI value at NAV = market cap</div>
        <div style={styles.heroValue} className="vcx-gt-value-large">{calc.impliedOpenaiEquityB == null ? "No positive solution" : fmtUsdB(calc.impliedOpenaiEquityB)}</div>
        <div style={styles.heroSub}>{calc.impliedOpenaiEquityB == null ? calc.residualReason : "Solves this complete model, including tax and management sensitivity. It is not a market forecast."}</div>
      </div>
    </div>

    <details style={{ ...styles.howToBox, marginBottom: 32 }}>
      <summary style={{ cursor: "pointer", fontWeight: 700 }}>Uncertain assumptions: management allocation, tax and other net debt</summary>
      <p style={{ lineHeight: 1.5 }}>The exact SBG shareholder allocation of OpenAI cannot be reproduced from aggregate fund disclosures. MgmtCo has 17.25% of SVF2 LLC Equity, with preferred capital, fund-wide distribution hurdles and receivable offsets. This sensitivity deducts a selected share of positive revaluation after new funding. It is an approximation; it neither removes 17.25% of gross assets nor predicts the full fund waterfall.</p>
      <div style={styles.controls} className="vcx-controls">
        <Input {...inputProps} field="managementPct" label="Management revaluation sensitivity (%)" step={0.25} range={[0, 17.25]} note="0–17.25% stress choices; default uses the larger deduction. No deduction for new capital or modeled losses." />
        <Input {...inputProps} field="otherNetDebtB" label="Other net-debt change ($B)" range={[-30, 50]} note="Beyond the July/October checks. Positive subtracts NAV; negative adds NAV. Include net cash used, interest, disposals and repayments here without double counting." />
        <Input {...inputProps} field="taxPct" label="Illustrative tax rate (%)" range={[0, 40]} note="Applied to positive modeled Arm/OpenAI gains only. Not a forecast effective tax rate or a tax on gross assets." />
        <Input {...inputProps} field="armTaxBasisB" label="Arm tax-basis proxy ($B)" step={0.1} range={[0, 100]} note="The inherited $40B is an unverified proxy, not a disclosed tax basis. Tax defaults to zero." />
      </div>
      <Source href={data.management.source}>June fund terms</Source>{" · "}<Source href={data.management.scopeSource}>OpenAI program disclosure</Source>
    </details>

    <section style={styles.section}>
      <div style={styles.sectionHeader} className="vcx-section-header"><span style={styles.sectionNum}>01</span><h2 style={styles.sectionTitle}>Holdco NAV waterfall</h2><span style={styles.sectionMeta}>$ billions</span></div>
      <div style={styles.tableWrap}>{waterfall.map(([label, value], i) => <div key={label} style={{ ...styles.wfRow, ...(i === waterfall.length - 1 ? styles.wfEnd : {}) }}>
        <div style={{ flex: 3 }}>{label}</div><div style={{ flex: 1, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{fmtUsdB(value)}</div>
      </div>)}</div>
      <p style={styles.note}>June SVF2 already contains OpenAI. The bridge adds {fmtUsdB(calc.openaiNetB)} modeled value − ${data.openaiJune.fairValueUsdB}B June gross value = {fmtUsdB(calc.openaiChangeB)}. Incremental funding of {fmtUsdB(calc.newFundingB)} is also charged to net debt. An investment at cost does not manufacture NAV.</p>
    </section>

    <section style={styles.section}>
      <div style={styles.sectionHeader} className="vcx-section-header"><span style={styles.sectionNum}>02</span><h2 style={styles.sectionTitle}>Why density can exceed 100%</h2></div>
      <div style={styles.tableWrap}>
        <div style={styles.thRow}><div style={{ flex: 2 }}>Gross fund / asset exposure</div><div style={{ flex: 1, textAlign: "right" }}>Value</div><div style={{ flex: 1, textAlign: "right" }}>Per $100 SFTBY</div></div>
        {[["Arm, before financing", calc.armGrossB, calc.centsArmGross], ["OpenAI, before allocation and discounts", calc.openaiGrossB, calc.centsOpenaiGross]].map(([label, value, per100]) => <div key={label} style={styles.tdRow}><div style={{ flex: 2 }}>{label}</div><div style={{ flex: 1, textAlign: "right" }}>{fmtUsdB(value)}</div><div style={{ flex: 1, textAlign: "right" }}>{fmtUsd(per100)}</div></div>)}
      </div>
      <p style={{ fontSize: 14, lineHeight: 1.6 }}>Gross asset exposure is divided by the market value of SoftBank&apos;s equity. Borrowing and a holding-company discount can make this ratio exceed 100%. It is not cash available to shareholders. An OpenAI IPO can improve liquidity, but does not require SoftBank to sell or distribute proceeds. Arm, OpenAI and the other investments also have their own valuation risks.</p>
    </section>

    <section style={styles.section}>
      <div style={styles.sectionHeader} className="vcx-section-header"><span style={styles.sectionNum}>03</span><h2 style={styles.sectionTitle}>NAV / ADR sensitivity</h2></div>
      <div style={{ overflowX: "auto" }} className="sats-table-scroll">
        <div style={{ display: "grid", gridTemplateColumns: "100px repeat(7, 1fr)", gap: 4, minWidth: 620 }}>
          <div style={styles.hmHead}>ARM / OAI $B</div>
          {[500, 730, 852, 1000, 1200, 1600, 2000].map(v => <div key={v} style={styles.hmHead}>{v}</div>)}
          {[150, 200, 250, 300, 350].map(arm => <React.Fragment key={arm}>
            <div style={styles.hmRowHead}>${arm}</div>
            {[500, 730, 852, 1000, 1200, 1600, 2000].map(oai => {
              const value = computeSotp({ ...inputs, armPrice: arm, openaiEquityB: oai }).navPerAdr;
              return <div key={oai} style={{ ...styles.hmCell, background: value > inputs.sftbyPrice ? "#dcfce7" : "#fed7aa" }} title={`Arm $${arm}, OpenAI $${oai}B, other selected assumptions unchanged`}>{fmtUsd(value)}</div>;
            })}
          </React.Fragment>)}
        </div>
      </div>
    </section>

    <section style={styles.section} id="debt-reconciliation">
      <div style={styles.sectionHeader} className="vcx-section-header"><span style={styles.sectionNum}>04</span><h2 style={styles.sectionTitle}>Debt and reporting dates</h2></div>
      <div style={styles.tableWrap}>
        {[
          ["June consolidated net interest-bearing debt", jpyTToUsdB(IR_JPY_T.consolNibd)],
          ["Less self-financing entities", -jpyTToUsdB(IR_JPY_T.selfFin)],
          ["Less other issuer adjustments", -jpyTToUsdB(IR_JPY_T.otherDebtAdj)],
          ["Issuer bridge rounding", jpyTToUsdB(IR_JPY_T.sbgAdjNd - (IR_JPY_T.consolNibd - IR_JPY_T.selfFin - IR_JPY_T.otherDebtAdj))],
          ["June SBG adjusted net debt", calc.ndJun30B],
          ["July OpenAI investment funded", calc.julyB],
          ["October OpenAI investment (pro forma only)", calc.octB],
          ["Other net-debt adjustment (estimate)", calc.otherNetDebtB],
          ["Modeled adjusted net debt", calc.sbgNdB],
        ].map(([label, value]) => <div key={label} style={styles.tdRow}><div style={{ flex: 3 }}>{label}</div><div style={{ flex: 1, textAlign: "right" }}>{fmtUsdB(value)}</div></div>)}
      </div>
      <p style={styles.note}>June balances use reporting USDJPY {IR_USDJPY}. The $40B bridge is a facility limit; July borrowing is included, October is planned. Arm financing is netted from Arm once. Subsidiary debt already reflected in equity values is not subtracted again. Loan proceeds retained as cash do not automatically increase net debt. Current balances, accrued financing costs and refinancing uses are not fully reconciled by the available quarter-end data.</p>
    </section>

    <section style={styles.section}>
      <div style={styles.sectionHeader} className="vcx-section-header"><span style={styles.sectionNum}>05</span><h2 style={styles.sectionTitle}>Latest evidence and source changes</h2></div>
      <div style={styles.tableWrap}>{data.events.map(event => <div key={event.source} style={{ ...styles.tdRow, alignItems: "start", gap: 16 }}>
        <div style={{ flex: 1 }}><div style={{ fontSize: 11, marginBottom: 5 }}>{event.asOf}</div><Source href={event.source}>{event.title}</Source></div>
        <div style={{ flex: 2, fontSize: 13, lineHeight: 1.5 }}>{event.note}</div>
      </div>)}</div>
      <p style={styles.note}>ABB robotics and DigitalBridge are planned acquisitions, not separately added June assets. Financing and acquisition announcements require both sides of the balance-sheet bridge before changing NAV. The other-net-debt control can stress unresolved funding uses; it does not replace a complete transaction model.</p>
    </section>

    <section style={styles.section}>
      <div style={styles.sectionHeader} className="vcx-section-header"><span style={styles.sectionNum}>06</span><h2 style={styles.sectionTitle}>Sources and reproducibility</h2></div>
      <ul style={styles.methList}>
        <li><Source href={data.ir.source}>June 30 issuer NAV</Source>: {fmtYenT(IR_JPY_T.holdings)} holdings − {fmtYenT(IR_JPY_T.sbgAdjNd)} debt = {fmtYenT(IR_JPY_T.nav)} pre-tax. The calculator reproduces that anchor before subsequent changes. Other holdings retain June marks; their multiplier is an estimate.</li>
        <li><Source href={data.arm.source}>Arm FY2026 20-F, May 21 ownership</Source>: {fmtNum(ARM_SHARES)} shares, approximately 86.4% at that date. The share count remains the input as Arm&apos;s share count changes.</li>
        <li><Source href={wrapper.sources[0].url}>SBG June share count</Source>: {fmtNum(TOKYO_SHARES)} ordinary excluding treasury. <Source href={wrapper.sources[1].url}>Citi 1:2 ADR ratio</Source>: {fmtNum(ADR_SHARES)} equivalent ADRs. This is outstanding stock, not a forecast fully diluted denominator.</li>
        <li><Source href={wrapper.openai.sources[0].url}>July 31 OpenAI fund disclosure, slide 10</Source>: rounded $55B cost / $100B fair value; approximately 13% includes the planned October tranche. <Source href="https://group.softbank/en/news/press/20260701">July $10B completion</Source>. No current ownership percentage is derived from invested dollars.</li>
        <li><Source href="https://openai.com/index/accelerating-the-next-phase-ai/">March 31 OpenAI primary round</Source>: $852B post-money. July proxy = $100B × selected valuation / $852B; this cross-date, cross-security calibration is an estimate. Pro forma = 13% × selected valuation. Both multiply by (1 − dilution).</li>
        <li><Source href={data.management.source}>Management program</Source>: the exact future allocation is not published as a simple per-asset percentage. The displayed range varies only the stated approximation.</li>
        <li><Source href="https://group.softbank/en/ir/financials/annual_reports/2026/message/goto">CFO capital and acquisition plans</Source>. Investment commitments can use cash or borrowing; changes to asset ownership and financing belong together.</li>
      </ul>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        <button onClick={copyScenario} style={styles.scenarioCard}>Copy exact scenario link</button>
        <button onClick={exportScenario} style={styles.scenarioCard}>Download inputs, results and sources</button>
      </div>
      {exportMessage && <p role="status" style={styles.note}>{exportMessage}</p>}
      <p style={styles.note}><Source href="https://github.com/bolewood/stocks-bolewood/blob/main/data/SFTBY_METHODOLOGY.md">Full methodology and unresolved assumptions</Source>{" · "}<Source href="https://github.com/bolewood/stocks-bolewood/blob/main/data/sftby-sotp.json">Dated source data</Source>{" · "}<a href="/sftby?reference=sftby" style={styles.sourceLink}>Frozen reference scenario</a></p>
    </section>
    <div style={styles.footer}>Informational research model. NAV is an estimate of asset value, not realizable or distributable cash. Debt, private security rights, fund allocation, taxes, future dilution and investment decisions can change shareholder outcomes. The author may hold SFTBY, 9984, ARM or related securities.</div>
  </div>;
}

const styles = {
  container: {
    fontFamily: "'Fraunces', Georgia, serif",
    background: "#fefdf8",
    color: "#1c1917",
    minHeight: "100vh",
    padding: "48px 56px 96px 56px",
    maxWidth: "1180px",
    margin: "0 auto",
    boxSizing: "border-box",
    overflowX: "hidden",
  },
  header: {
    borderBottom: "1px solid #1c1917",
    paddingBottom: 32,
    marginBottom: 40,
  },
  eyebrow: {
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: 11,
    letterSpacing: "0.18em",
    color: "#78716c",
    marginBottom: 16,
    fontWeight: 500,
  },
  title: {
    fontSize: 72,
    lineHeight: 0.95,
    fontWeight: 800,
    margin: "0 0 20px 0",
    letterSpacing: "-0.03em",
  },
  titleAccent: {
    color: "#d97706",
    fontStyle: "italic",
    fontWeight: 600,
  },
  subtitle: {
    fontSize: 16,
    lineHeight: 1.55,
    color: "#44403c",
    maxWidth: 760,
    margin: 0,
  },
  howToBox: {
    background: "#f5f5f4",
    border: "1px solid #d6d3d1",
    padding: "20px 24px",
    marginBottom: 24,
  },
  howToTitle: {
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: 11,
    letterSpacing: "0.15em",
    color: "#1c1917",
    textTransform: "uppercase",
    fontWeight: 600,
    marginBottom: 12,
  },
  howToList: {
    margin: 0,
    paddingLeft: 20,
    fontSize: 14,
    lineHeight: 1.65,
    color: "#44403c",
  },
  asOfBox: {
    background: "#f5f5f4",
    border: "1px solid #d6d3d1",
    padding: "12px 16px",
    fontSize: 13,
    lineHeight: 1.5,
    color: "#44403c",
    marginBottom: 16,
  },
  banner: {
    background: "#fff7ed",
    border: "1px solid #fdba74",
    padding: "12px 16px",
    fontSize: 13,
    lineHeight: 1.5,
    color: "#9a3412",
    marginBottom: 16,
  },
  disclaimerBox: {
    background: "#1c1917",
    color: "#e7e5e4",
    padding: "12px 16px",
    fontSize: 12,
    lineHeight: 1.5,
    marginBottom: 28,
    fontFamily: "'JetBrains Mono', monospace",
  },
  controls: {
    display: "flex",
    gap: 32,
    alignItems: "flex-end",
    marginBottom: 24,
    flexWrap: "wrap",
  },
  controlGroup: {
    flex: 1,
    minWidth: 220,
    display: "flex",
    flexDirection: "column",
  },
  label: {
    display: "block",
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: 11,
    letterSpacing: "0.05em",
    textTransform: "uppercase",
    marginBottom: 8,
    color: "#78716c",
  },
  smallInput: {
    padding: "8px 12px",
    fontSize: 18,
    fontFamily: "'JetBrains Mono', monospace",
    border: "1px solid #d6d3d1",
    background: "#fff",
    color: "#1c1917",
    width: 140,
    outline: "none",
  },
  note: {
    fontSize: 11,
    color: "#78716c",
    marginTop: 6,
    lineHeight: 1.4,
  },
  radioLabel: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    cursor: "pointer",
    fontSize: 14,
  },
  scenarioGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
    gap: 12,
  },
  scenarioCard: {
    textAlign: "left",
    background: "#fefdf8",
    border: "1px solid #d6d3d1",
    padding: "12px 16px",
    cursor: "pointer",
    position: "relative",
    fontFamily: "'Fraunces', serif",
    color: "#1c1917",
  },
  scenarioCardActive: {
    background: "#1c1917",
    color: "#fef3c7",
    border: "1px solid #1c1917",
  },
  activeDot: {
    position: "absolute",
    top: 12,
    right: 12,
    width: 6,
    height: 6,
    borderRadius: "50%",
    background: "#d97706",
  },
  heroGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
    gap: 12,
    marginBottom: 40,
  },
  heroCard: {
    border: "1px solid #1c1917",
    padding: "20px 18px",
    background: "#fff",
  },
  heroLabel: {
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: 10,
    letterSpacing: "0.12em",
    textTransform: "uppercase",
    color: "#78716c",
    marginBottom: 8,
  },
  heroValue: {
    fontSize: 32,
    fontWeight: 800,
    letterSpacing: "-0.03em",
    lineHeight: 1.1,
  },
  heroValueAccent: {
    fontSize: 36,
    fontWeight: 800,
    letterSpacing: "-0.03em",
    color: "#d97706",
    fontStyle: "italic",
    lineHeight: 1.1,
  },
  heroSub: {
    fontSize: 12,
    color: "#57534e",
    marginTop: 8,
    lineHeight: 1.4,
  },
  section: { marginBottom: 40 },
  sectionHeader: {
    display: "flex",
    alignItems: "baseline",
    gap: 16,
    marginBottom: 16,
    paddingBottom: 8,
    borderBottom: "1px solid #d6d3d1",
  },
  sectionNum: {
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: 12,
    color: "#d97706",
    fontWeight: 700,
    letterSpacing: "0.05em",
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: 600,
    margin: 0,
    letterSpacing: "-0.01em",
  },
  sectionMeta: {
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: 11,
    color: "#78716c",
    marginLeft: "auto",
  },
  tableWrap: { border: "1px solid #1c1917" },
  wfRow: {
    display: "flex",
    padding: "10px 14px",
    borderBottom: "1px solid #e7e5e4",
    fontSize: 14,
  },
  wfEnd: {
    background: "#fef3c7",
    fontWeight: 700,
    borderBottom: "none",
  },
  thRow: {
    display: "flex",
    padding: "8px 14px",
    background: "#f5f5f4",
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: 10,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    color: "#78716c",
    borderBottom: "1px solid #1c1917",
  },
  tdRow: {
    display: "flex",
    padding: "10px 14px",
    borderBottom: "1px solid #e7e5e4",
    fontSize: 14,
  },
  hmHead: {
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: 10,
    textTransform: "uppercase",
    textAlign: "right",
    padding: "6px 4px",
    color: "#78716c",
    fontWeight: 600,
  },
  hmRowHead: {
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: 11,
    fontWeight: 700,
    padding: "8px 4px",
    alignSelf: "center",
  },
  hmCell: {
    textAlign: "right",
    padding: "8px 6px",
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: 12,
    fontVariantNumeric: "tabular-nums",
  },
  warnPanel: {
    background: "#fef2f2",
    border: "1px solid #fecaca",
    padding: "12px 16px",
    fontSize: 13,
    lineHeight: 1.5,
    marginBottom: 12,
    color: "#7f1d1d",
  },
  evBox: {
    marginTop: 12,
    border: "1px solid #d6d3d1",
    padding: "12px 16px",
    fontSize: 13,
    lineHeight: 1.5,
    color: "#44403c",
  },
  methList: {
    margin: 0,
    paddingLeft: 20,
    fontSize: 14,
    lineHeight: 1.65,
    color: "#44403c",
  },
  footer: {
    fontSize: 13,
    color: "#44403c",
    lineHeight: 1.6,
    paddingBottom: 24,
  },
  sourceLink: { color: "#d97706", textDecoration: "underline" },
  stickyBar: {
    position: "fixed",
    bottom: 0,
    left: 0,
    right: 0,
    background: "#1c1917",
    borderTop: "2px solid #d97706",
    zIndex: 1000,
    padding: "0 24px",
  },
  stickyInner: {
    maxWidth: 1180,
    margin: "0 auto",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "10px 0",
  },
  stickyMetric: { padding: "0 24px", textAlign: "center" },
  stickyLabel: {
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: 9,
    letterSpacing: "0.15em",
    textTransform: "uppercase",
    color: "#a8a29e",
    marginBottom: 2,
  },
  stickyValue: {
    fontFamily: "'Fraunces', serif",
    fontSize: 18,
    fontWeight: 700,
    color: "#fef3c7",
  },
  stickyValueAccent: {
    fontFamily: "'Fraunces', serif",
    fontSize: 20,
    fontWeight: 800,
    color: "#fbbf24",
    fontStyle: "italic",
  },
  stickyDivider: {
    width: 1,
    height: 28,
    background: "#44403c",
  },
};
