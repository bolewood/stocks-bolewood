"use client";

import React, { useEffect, useMemo, useState } from "react";

// SoftBank Group holdco SOTP (SFTBY / 9984)
// One economic perimeter: IR-adjusted SBG net debt + live Arm + OpenAI stripped from SVF2.

const ADR_PER_TOKYO = 2; // 1 TSE:9984 ordinary = 2 OTCPK:SFTBY ADRs
const TOKYO_SHARES = 5.699e9;
const ADR_SHARES = TOKYO_SHARES * ADR_PER_TOKYO;
const ARM_SHARES = 922_733_999; // ~86.7%; "90%" is 2023 IPO stale

const IR_AS_OF = "30 Jun 2026";
const IR_USDJPY = 162.39;

const IR_JPY_T = {
  armGross: 53.13,
  armAbf: 3.22,
  armAdj: 49.91,
  svf1: 3.6,
  svf2: 19.29,
  latam: 1.0,
  sbkkAdj: 2.79,
  tmobileAdj: 0.0,
  others: 6.51,
  nav: 72.3,
  sbgAdjNd: 10.81,
  consolNibd: 22.29,
  selfFin: 6.03,
  otherDebtAdj: 5.45,
};

const OPENAI_CARRY_JUN30_USD_B = 89.6;
const OPENAI_COST_CUMULATIVE_USD_B = 64.6;
const OPENAI_COST_FUNDED_TODAY_USD_B = 54.6;
const OPENAI_OWNERSHIP_AT_COMPLETION = 0.13;
const OPENAI_DEFAULT_EQUITY_B = 840;
const OPENAI_LIQ_DEFAULT = 15;

const JULY_DRAW_USD_B = 10;
const OCT_DRAW_USD_B = 10;

const FISCAL_EV_USD_B = 356.87;
const FISCAL_CONSOL_ND_USD_B = 146.78;
const FISCAL_CASH_USD_B = 24.15;
const ARM_COST_BASIS_USD_B = 40;

const FALLBACK = { ARM: 238, SFTBY: 16.53, TOKYO: 5255, USDJPY: 159 };

const jpyTToUsdB = (t, usdJpy) => (t * 1e12) / usdJpy / 1e9;

const fmtUsdB = (n) => {
  if (!Number.isFinite(n)) return "—";
  const abs = Math.abs(n);
  const sign = n < 0 ? "−" : "";
  if (abs >= 100) return `${sign}$${abs.toFixed(0)}B`;
  if (abs >= 10) return `${sign}$${abs.toFixed(1)}B`;
  return `${sign}$${abs.toFixed(2)}B`;
};

const fmtUsd = (n, d = 2) =>
  Number.isFinite(n)
    ? n.toLocaleString("en-US", {
        style: "currency",
        currency: "USD",
        minimumFractionDigits: d,
        maximumFractionDigits: d,
      })
    : "—";

const fmtYenT = (t) => `¥${Number(t).toFixed(2)}T`;

const fmtPct = (n, d = 1) => (Number.isFinite(n) ? `${n.toFixed(d)}%` : "—");

const fmtNum = (n, d = 2) =>
  Number.isFinite(n)
    ? n.toLocaleString("en-US", { maximumFractionDigits: d, minimumFractionDigits: d })
    : "—";

function currentOwnership() {
  return (
    OPENAI_OWNERSHIP_AT_COMPLETION *
    (OPENAI_COST_FUNDED_TODAY_USD_B / OPENAI_COST_CUMULATIVE_USD_B)
  );
}

function frozenStubUsdB() {
  const svf2Ex =
    jpyTToUsdB(IR_JPY_T.svf2, IR_USDJPY) - OPENAI_CARRY_JUN30_USD_B;
  return (
    jpyTToUsdB(IR_JPY_T.svf1, IR_USDJPY) +
    svf2Ex +
    jpyTToUsdB(IR_JPY_T.latam, IR_USDJPY) +
    jpyTToUsdB(IR_JPY_T.sbkkAdj, IR_USDJPY) +
    jpyTToUsdB(IR_JPY_T.tmobileAdj, IR_USDJPY) +
    jpyTToUsdB(IR_JPY_T.others, IR_USDJPY)
  );
}

function computeSotp({
  armPrice,
  openaiEquityB,
  openaiCase,
  usdJpy,
  taxPct,
  liqHaircutPct,
  stubMult,
  sftbyPrice,
}) {
  const ownership =
    openaiCase === "funded13"
      ? OPENAI_OWNERSHIP_AT_COMPLETION
      : currentOwnership();
  const openaiCostB =
    openaiCase === "funded13"
      ? OPENAI_COST_CUMULATIVE_USD_B
      : OPENAI_COST_FUNDED_TODAY_USD_B;

  const armGrossB = (ARM_SHARES * armPrice) / 1e9;
  const armAbfB = jpyTToUsdB(IR_JPY_T.armAbf, usdJpy);
  const armNetB = armGrossB - armAbfB;

  const openaiGrossB = ownership * openaiEquityB;
  const openaiNetB = openaiGrossB * (1 - liqHaircutPct / 100);
  const stubB = frozenStubUsdB() * stubMult;
  const holdingsB = armNetB + openaiNetB + stubB;

  const ndJun30B = jpyTToUsdB(IR_JPY_T.sbgAdjNd, usdJpy);
  const julyB = JULY_DRAW_USD_B;
  const octB = openaiCase === "funded13" ? OCT_DRAW_USD_B : 0;
  const sbgNdB = ndJun30B + julyB + octB;

  const taxB =
    (taxPct / 100) *
    (Math.max(0, armGrossB - ARM_COST_BASIS_USD_B) +
      Math.max(0, openaiNetB - openaiCostB));

  const navB = holdingsB - sbgNdB - taxB;
  const navPerTokyo = (navB * 1e9) / TOKYO_SHARES;
  const navPerAdr = navPerTokyo / ADR_PER_TOKYO;
  const mcapB = (sftbyPrice * ADR_SHARES) / 1e9;
  const discountPct = navB !== 0 ? (1 - mcapB / navB) * 100 : null;
  const ltvPct = holdingsB > 0 ? (sbgNdB / holdingsB) * 100 : null;
  const centsArmGross = mcapB > 0 ? (armGrossB / mcapB) * 100 : null;
  const centsOpenaiGross = mcapB > 0 ? (openaiGrossB / mcapB) * 100 : null;
  const residualIfMcapIsNavB = mcapB - (armNetB + stubB - sbgNdB - taxB);
  const haircutFactor = 1 - liqHaircutPct / 100;
  const impliedOpenaiEquityB =
    ownership * haircutFactor > 0
      ? residualIfMcapIsNavB / (ownership * haircutFactor)
      : null;

  return {
    ownership,
    armGrossB,
    armAbfB,
    armNetB,
    openaiGrossB,
    openaiNetB,
    stubB,
    holdingsB,
    ndJun30B,
    julyB,
    octB,
    sbgNdB,
    taxB,
    navB,
    navPerTokyo,
    navPerAdr,
    mcapB,
    discountPct,
    ltvPct,
    centsArmGross,
    centsOpenaiGross,
    impliedOpenaiEquityB,
    consolNdB: jpyTToUsdB(IR_JPY_T.consolNibd, usdJpy),
  };
}

export default function SFTBYSOTPFinder() {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 720);
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const [activeScenario, setActiveScenario] = useState("base");
  const [armPrice, setArmPrice] = useState(FALLBACK.ARM);
  const [sftbyPrice, setSftbyPrice] = useState(FALLBACK.SFTBY);
  const [tokyoPrice, setTokyoPrice] = useState(FALLBACK.TOKYO);
  const [usdJpy, setUsdJpy] = useState(FALLBACK.USDJPY);
  const [openaiEquityB, setOpenaiEquityB] = useState(OPENAI_DEFAULT_EQUITY_B);
  const [openaiCase, setOpenaiCase] = useState("current");
  const [taxPct, setTaxPct] = useState(10);
  const [liqHaircutPct, setLiqHaircutPct] = useState(OPENAI_LIQ_DEFAULT);
  const [stubMult, setStubMult] = useState(1);
  const [priceSource, setPriceSource] = useState("default");

  const markCustom = () => setActiveScenario(null);

  const writeScenarioUrl = (key) => {
    const url = new URL(window.location.href);
    if (key && key !== "base") url.searchParams.set("scenario", key);
    else url.searchParams.delete("scenario");
    window.history.replaceState({}, "", url);
  };

  const applyInputs = (partial, key) => {
    if (partial.armPrice != null) setArmPrice(partial.armPrice);
    if (partial.openaiEquityB != null) setOpenaiEquityB(partial.openaiEquityB);
    if (partial.openaiCase != null) setOpenaiCase(partial.openaiCase);
    if (partial.taxPct != null) setTaxPct(partial.taxPct);
    if (partial.liqHaircutPct != null) setLiqHaircutPct(partial.liqHaircutPct);
    if (partial.stubMult != null) setStubMult(partial.stubMult);
    setActiveScenario(key);
    if (typeof window !== "undefined") writeScenarioUrl(key);
  };

  const applyBase = (liveArm) =>
    applyInputs(
      {
        armPrice: liveArm ?? armPrice,
        openaiEquityB: OPENAI_DEFAULT_EQUITY_B,
        openaiCase: "current",
        taxPct: 10,
        liqHaircutPct: OPENAI_LIQ_DEFAULT,
        stubMult: 1,
      },
      "base"
    );
  const applyFunded = () =>
    applyInputs(
      {
        openaiEquityB: OPENAI_DEFAULT_EQUITY_B,
        openaiCase: "funded13",
        taxPct: 10,
        liqHaircutPct: OPENAI_LIQ_DEFAULT,
        stubMult: 1,
      },
      "funded13"
    );
  const applyBull = () =>
    applyInputs(
      {
        armPrice: 300,
        openaiEquityB: 1200,
        openaiCase: "funded13",
        taxPct: 0,
        liqHaircutPct: 0,
        stubMult: 1.1,
      },
      "bull"
    );
  const applyBear = () =>
    applyInputs(
      {
        armPrice: 150,
        openaiEquityB: 500,
        openaiCase: "current",
        taxPct: 25,
        liqHaircutPct: 30,
        stubMult: 0.7,
      },
      "bear"
    );
  const applyCore = () =>
    applyInputs(
      {
        openaiEquityB: OPENAI_DEFAULT_EQUITY_B,
        openaiCase: "current",
        taxPct: 10,
        liqHaircutPct: OPENAI_LIQ_DEFAULT,
        stubMult: 0,
      },
      "core"
    );

  useEffect(() => {
    const scenario = new URLSearchParams(window.location.search).get("scenario");
    fetch("/api/prices")
      .then((r) => r.json())
      .then((data) => {
        const p = data.prices || {};
        if (p.SFTBY) setSftbyPrice(p.SFTBY);
        if (p.TOKYO9984) setTokyoPrice(p.TOKYO9984);
        if (p.USDJPY) setUsdJpy(p.USDJPY);
        const liveArm = p.ARM;
        if (liveArm) setArmPrice(liveArm);
        setPriceSource(data.source || "fallback");
        if (scenario === "funded13") applyFunded();
        else if (scenario === "bull") applyBull();
        else if (scenario === "bear") applyBear();
        else if (scenario === "core") applyCore();
        else applyBase(liveArm);
      })
      .catch(() => {
        setPriceSource("fallback");
        if (scenario === "funded13") applyFunded();
        else if (scenario === "bull") applyBull();
        else if (scenario === "bear") applyBear();
        else if (scenario === "core") applyCore();
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const calc = useMemo(
    () =>
      computeSotp({
        armPrice,
        openaiEquityB,
        openaiCase,
        usdJpy,
        taxPct,
        liqHaircutPct,
        stubMult,
        sftbyPrice,
      }),
    [armPrice, openaiEquityB, openaiCase, usdJpy, taxPct, liqHaircutPct, stubMult, sftbyPrice]
  );

  const jun30ArmImplied =
    (jpyTToUsdB(IR_JPY_T.armGross, IR_USDJPY) * 1e9) / ARM_SHARES;
  const armMovePct = ((armPrice - jun30ArmImplied) / jun30ArmImplied) * 100;
  const stale = Math.abs(armMovePct) >= 10;

  const heatmapArm = [150, 180, 210, 238, 270, 300, 350];
  const heatmapOai = [400, 500, 640, 730, 840, 1000, 1200];

  const sourceBadge =
    priceSource === "live"
      ? { text: "● LIVE", color: "#15803d", bg: "#f0fdf4", border: "#86efac" }
      : priceSource === "partial"
      ? { text: "◐ PARTIAL", color: "#d97706", bg: "#fffbeb", border: "#fcd34d" }
      : {
          text: priceSource === "fallback" ? "○ FALLBACK" : "○ DEFAULT",
          color: "#78716c",
          bg: "transparent",
          border: "#a8a29e",
        };

  const scenarios = [
    {
      key: "base",
      label: "Base — current OpenAI",
      desc: "Live Arm, $840B last-round, cost-ratio ownership, July $10B in ND, 15% private haircut, 10% tax leakage.",
      handler: () => applyBase(),
    },
    {
      key: "funded13",
      label: "Fully funded 13%",
      desc: "Press-case ~13% upon completion. Oct $10B is both more OpenAI equity and more SBG debt.",
      handler: applyFunded,
    },
    {
      key: "bull",
      label: "Bull — ARM $300 / OAI $1.2T",
      desc: "Funded 13%, 0% tax, 0% private haircut, stub +10%.",
      handler: applyBull,
    },
    {
      key: "bear",
      label: "Bear — ARM $150 / OAI $500B",
      desc: "Current case, 30% private haircut, 25% tax, stub 0.7×.",
      handler: applyBear,
    },
    {
      key: "core",
      label: "Arm + OpenAI only",
      desc: "Stub = 0. Still subtracts Arm-backed loans and SBG adjusted ND.",
      handler: applyCore,
    },
  ];

  const waterfall = [
    { label: "Arm gross (live)", val: calc.armGrossB, end: false },
    { label: "Arm-backed loans (once)", val: -calc.armAbfB, end: false },
    { label: "OpenAI (net of haircut)", val: calc.openaiNetB, end: false },
    { label: "Stub (SVF2 ex-OpenAI + other IR lines)", val: calc.stubB, end: false },
    { label: "SBG adjusted ND + post-June draws", val: -calc.sbgNdB, end: false },
    { label: "Illustrative tax leakage", val: -calc.taxB, end: false },
    { label: "Holdco NAV", val: calc.navB, end: true },
  ];

  return (
    <div style={styles.container} className="vcx-container sats-container">
      <div style={styles.header}>
        <div style={styles.eyebrow} className="vcx-eyebrow">
          SOFTBANK GROUP · OTCPK: SFTBY · TSE: 9984 · HOLDCO SOTP
        </div>
        <h1 style={styles.title} className="vcx-title">
          SFTBY <span style={styles.titleAccent}>SOTP Finder</span>
        </h1>
        <p style={styles.subtitle} className="vcx-subtitle">
          A single-perimeter holding-company SOTP. Arm is marked live. OpenAI is
          pulled out of SVF2 so it is not counted twice. Debt is SoftBank&apos;s
          own adjusted SBG net debt, not consolidated net debt. ADR math is 1
          Tokyo ordinary = 2 SFTBY ADRs. Research model, not SoftBank IR, not a
          recommendation.
        </p>
      </div>

      <div style={styles.howToBox}>
        <div style={styles.howToTitle}>How this works in 30 seconds</div>
        <ol style={styles.howToList}>
          <li style={{ marginBottom: 6 }}>
            <strong>Arm</strong> = {fmtNum(ARM_SHARES / 1e6, 1)}M shares × live
            ARM, minus Arm-backed loans once (IR already excludes those loans
            from adjusted ND).
          </li>
          <li style={{ marginBottom: 6 }}>
            <strong>OpenAI</strong> replaces the Jun 30 carrying value inside
            SVF2. Current case uses a cost-ratio estimate of ownership because
            SoftBank has only disclosed ~13% upon completion of the $30B
            follow-on. Funded-13% adds the last $10B as asset and as debt.
          </li>
          <li style={{ marginBottom: 6 }}>
            <strong>Stub</strong> is SVF1 + SVF2 ex-OpenAI + LatAm + SoftBank
            Corp. (already net of SBKK asset-backed finance) + other IR lines,
            frozen in USD at IR FX {IR_USDJPY}.
          </li>
          <li>
            <strong>NAV</strong> = those assets − SBG-adjusted ND (plus
            post-June OpenAI draws) − an illustrative tax slider. Holdco
            discount vs the SFTBY price is an output, never an input.
          </li>
        </ol>
      </div>

      <div style={stale ? styles.banner : styles.asOfBox}>
        {stale ? (
          <>
            <strong>Stale composition.</strong> Holdings mix, SBKK, SVF marks, and
            adjusted ND are as of {IR_AS_OF}. Live ARM {fmtUsd(armPrice)} is{" "}
            {fmtPct(armMovePct, 0)} vs the IR-implied Arm price of{" "}
            {fmtUsd(jun30ArmImplied, 0)} at {IR_AS_OF}. OpenAI, SVF, and ND have
            not been re-cut by SoftBank for that move.
          </>
        ) : (
          <>
            <strong>IR as of {IR_AS_OF}.</strong> Holdings mix, SBKK, SVF marks,
            and adjusted ND are quarter-end IR (USDJPY {IR_USDJPY}). Arm, SFTBY,
            9984, and USDJPY overlay live prices on that book. 5 Aug pro forma
            NAV ¥58.3T re-marks the June composition; it is not a live balance
            sheet.
          </>
        )}
      </div>

      <div style={styles.disclaimerBox}>
        General information only — not investment advice, not an offer, not a
        SoftBank product. Official NAV is pre-tax and not a realizable cash
        value. SFTBY is an unsponsored OTC ADR (wider spreads, 2-for-1). Private
        marks (OpenAI, SVF) are estimates. Author may hold related securities.
      </div>

      <div style={styles.controls} className="vcx-controls">
        <div style={styles.controlGroup}>
          <label style={styles.label}>ARM price ($)</label>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <input
              type="number"
              step="1"
              value={armPrice}
              onChange={(e) => {
                setArmPrice(parseFloat(e.target.value) || 0);
                markCustom();
              }}
              style={styles.smallInput}
              className="vcx-input vcx-small-input"
            />
            <span
              style={{
                fontSize: 10,
                fontFamily: "monospace",
                padding: "2px 6px",
                border: `1px solid ${sourceBadge.border}`,
                color: sourceBadge.color,
                background: sourceBadge.bg,
              }}
            >
              {sourceBadge.text}
            </span>
          </div>
          <input
            type="range"
            min="80"
            max="450"
            step="1"
            value={armPrice}
            onChange={(e) => {
              setArmPrice(parseFloat(e.target.value));
              markCustom();
            }}
            style={{ width: "100%", marginTop: 8, accentColor: "#d97706" }}
          />
        </div>
        <div style={styles.controlGroup}>
          <label style={styles.label}>SFTBY ADR price ($)</label>
          <input
            type="number"
            step="0.01"
            value={sftbyPrice}
            onChange={(e) => {
              setSftbyPrice(parseFloat(e.target.value) || 0);
              markCustom();
            }}
            style={styles.smallInput}
            className="vcx-input vcx-small-input"
          />
          <div style={styles.note}>
            9984 ¥{fmtNum(tokyoPrice, 0)} · USDJPY {fmtNum(usdJpy, 2)} · 1 Tokyo
            = 2 ADR
          </div>
        </div>
        <div style={styles.controlGroup}>
          <label style={styles.label}>USDJPY</label>
          <input
            type="number"
            step="0.1"
            value={usdJpy}
            onChange={(e) => {
              setUsdJpy(parseFloat(e.target.value) || IR_USDJPY);
              markCustom();
            }}
            style={styles.smallInput}
            className="vcx-input vcx-small-input"
          />
          <div style={styles.note}>
            Re-marks yen debt and Arm loans. Stub stays at IR FX {IR_USDJPY}.
          </div>
        </div>
        <div style={styles.controlGroup}>
          <label style={styles.label}>OpenAI equity value ($B post)</label>
          <input
            type="number"
            step="10"
            value={openaiEquityB}
            onChange={(e) => {
              setOpenaiEquityB(parseFloat(e.target.value) || 0);
              markCustom();
            }}
            style={styles.smallInput}
            className="vcx-input vcx-small-input"
          />
          <input
            type="range"
            min="300"
            max="1500"
            step="10"
            value={openaiEquityB}
            onChange={(e) => {
              setOpenaiEquityB(parseFloat(e.target.value));
              markCustom();
            }}
            style={{ width: "100%", marginTop: 8, accentColor: "#d97706" }}
          />
        </div>
      </div>

      <div style={styles.controls} className="vcx-controls">
        <div style={styles.controlGroup}>
          <label style={styles.label}>OpenAI case</label>
          <div style={{ display: "flex", gap: 16, marginTop: 6, flexWrap: "wrap" }}>
            <label style={styles.radioLabel}>
              <input
                type="radio"
                name="oaiCase"
                checked={openaiCase === "current"}
                onChange={() => {
                  setOpenaiCase("current");
                  markCustom();
                }}
                style={{ accentColor: "#d97706" }}
              />
              Current (cost-ratio ~{fmtPct(currentOwnership() * 100, 1)})
            </label>
            <label style={styles.radioLabel}>
              <input
                type="radio"
                name="oaiCase"
                checked={openaiCase === "funded13"}
                onChange={() => {
                  setOpenaiCase("funded13");
                  markCustom();
                }}
                style={{ accentColor: "#d97706" }}
              />
              Fully funded 13%
            </label>
          </div>
          <div style={styles.note}>
            SoftBank has not disclosed a current %. 13% is the press figure upon
            completing the $30B follow-on. Preferred, not common-equivalent.
          </div>
        </div>
        <div style={styles.controlGroup}>
          <label style={styles.label}>
            OpenAI liquidity haircut ({liqHaircutPct}%)
          </label>
          <input
            type="range"
            min="0"
            max="40"
            step="1"
            value={liqHaircutPct}
            onChange={(e) => {
              setLiqHaircutPct(parseFloat(e.target.value));
              markCustom();
            }}
            style={{ width: "100%", accentColor: "#d97706" }}
          />
        </div>
        <div style={styles.controlGroup}>
          <label style={styles.label}>Illustrative tax leakage ({taxPct}%)</label>
          <input
            type="range"
            min="0"
            max="30"
            step="1"
            value={taxPct}
            onChange={(e) => {
              setTaxPct(parseFloat(e.target.value));
              markCustom();
            }}
            style={{ width: "100%", accentColor: "#d97706" }}
          />
          <div style={styles.note}>
            Applied only to modeled unrealized gains (Arm vs $
            {ARM_COST_BASIS_USD_B}B basis, OpenAI vs funded cost). Not a tax on
            gross assets.
          </div>
        </div>
        <div style={styles.controlGroup}>
          <label style={styles.label}>Stub multiplier ({stubMult.toFixed(2)}×)</label>
          <input
            type="range"
            min="0"
            max="1.5"
            step="0.05"
            value={stubMult}
            onChange={(e) => {
              setStubMult(parseFloat(e.target.value));
              markCustom();
            }}
            style={{ width: "100%", accentColor: "#d97706" }}
          />
        </div>
      </div>

      <div style={{ marginBottom: 32 }}>
        <div style={styles.howToTitle}>Preset scenarios</div>
        <div style={styles.scenarioGrid} className="sats-scenario-grid">
          {scenarios.map(({ key, label, desc, handler }) => {
            const on = activeScenario === key;
            return (
              <button
                key={key}
                onClick={handler}
                style={{
                  ...styles.scenarioCard,
                  ...(on ? styles.scenarioCardActive : {}),
                }}
              >
                {on && <span style={styles.activeDot} />}
                <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>{label}</div>
                <div
                  style={{
                    fontSize: 12,
                    color: on ? "#fbbf24" : "#78716c",
                    lineHeight: 1.3,
                  }}
                >
                  {desc}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <div style={styles.heroGrid} className="sats-explainer-row">
        <div style={styles.heroCard} className="sats-summary-card">
          <div style={styles.heroLabel}>Holdco NAV / ADR</div>
          <div style={styles.heroValueAccent} className="vcx-gt-value-accent">
            {fmtUsd(calc.navPerAdr)}
          </div>
          <div style={styles.heroSub}>
            Tokyo NAV {fmtUsd(calc.navPerTokyo)} · SFTBY {fmtUsd(sftbyPrice)}
          </div>
        </div>
        <div style={styles.heroCard} className="sats-summary-card">
          <div style={styles.heroLabel}>Discount to NAV</div>
          <div
            style={{
              ...styles.heroValue,
              color: calc.discountPct > 0 ? "#15803d" : "#b91c1c",
            }}
            className="vcx-gt-value-large"
          >
            {fmtPct(calc.discountPct, 1)}
          </div>
          <div style={styles.heroSub}>
            Mkt cap {fmtUsdB(calc.mcapB)} vs NAV {fmtUsdB(calc.navB)}
          </div>
        </div>
        <div style={styles.heroCard} className="sats-summary-card">
          <div style={styles.heroLabel}>IR-style LTV</div>
          <div style={styles.heroValue} className="vcx-gt-value-large">
            {fmtPct(calc.ltvPct, 1)}
          </div>
          <div style={styles.heroSub}>
            SBG adj. ND {fmtUsdB(calc.sbgNdB)} / holdings {fmtUsdB(calc.holdingsB)}
          </div>
        </div>
        <div style={styles.heroCard} className="sats-summary-card">
          <div style={styles.heroLabel}>Gross look-through / $1 cap</div>
          <div style={styles.heroValue} className="vcx-gt-value-large">
            {fmtNum(calc.centsArmGross, 0)}¢ Arm
          </div>
          <div style={styles.heroSub}>
            {fmtNum(calc.centsOpenaiGross, 0)}¢ OpenAI gross — not unencumbered
            ownership
          </div>
        </div>
        <div style={styles.heroCard} className="sats-summary-card">
          <div style={styles.heroLabel}>Residual implied OpenAI</div>
          <div style={styles.heroValue} className="vcx-gt-value-large">
            {fmtUsdB(calc.impliedOpenaiEquityB)}
          </div>
          <div style={styles.heroSub}>
            Equity value if market cap were holdco NAV — a residual, not a mark
          </div>
        </div>
      </div>

      <div style={styles.section}>
        <div style={styles.sectionHeader} className="vcx-section-header">
          <span style={styles.sectionNum}>01</span>
          <h2 style={styles.sectionTitle}>Holdco waterfall</h2>
          <span style={styles.sectionMeta} className="vcx-section-meta">
            $ billions
          </span>
        </div>
        <div style={styles.tableWrap}>
          {waterfall.map((row) => (
            <div
              key={row.label}
              style={{ ...styles.wfRow, ...(row.end ? styles.wfEnd : {}) }}
            >
              <div style={{ flex: 2.4 }}>{row.label}</div>
              <div
                style={{
                  flex: 1,
                  textAlign: "right",
                  fontVariantNumeric: "tabular-nums",
                  color: row.end ? "#1c1917" : row.val >= 0 ? "#15803d" : "#b91c1c",
                  fontWeight: row.end ? 700 : 500,
                }}
              >
                {row.end ? fmtUsdB(row.val) : `${row.val >= 0 ? "+" : ""}${fmtUsdB(row.val)}`}
              </div>
            </div>
          ))}
        </div>
        <div style={styles.note}>
          Arm gross {fmtUsdB(calc.armGrossB)} at {fmtUsd(armPrice)} ×{" "}
          {fmtNum(ARM_SHARES / 1e6, 2)}M shares. OpenAI{" "}
          {fmtPct(calc.ownership * 100, 1)} of ${fmtNum(openaiEquityB, 0)}B, then{" "}
          {liqHaircutPct}% private haircut. Residual OpenAI equity if market cap
          were NAV: {fmtUsdB(calc.impliedOpenaiEquityB)} (a residual, not a
          valuation).
        </div>
      </div>

      <div style={styles.section}>
        <div style={styles.sectionHeader} className="vcx-section-header">
          <span style={styles.sectionNum}>02</span>
          <h2 style={styles.sectionTitle}>Gross look-through vs the cap</h2>
        </div>
        <div style={styles.tableWrap}>
          <div style={styles.thRow}>
            <div style={{ flex: 2 }}>Claim</div>
            <div style={{ flex: 1, textAlign: "right" }}>$B</div>
            <div style={{ flex: 1, textAlign: "right" }}>per $1 of cap</div>
          </div>
          {[
            ["Arm gross (no loan net)", calc.armGrossB, calc.centsArmGross],
            ["OpenAI gross (no haircut)", calc.openaiGrossB, calc.centsOpenaiGross],
            [
              "Arm + OpenAI gross",
              calc.armGrossB + calc.openaiGrossB,
              calc.centsArmGross + calc.centsOpenaiGross,
            ],
          ].map(([label, usdB, cents]) => (
            <div key={label} style={styles.tdRow}>
              <div style={{ flex: 2 }}>{label}</div>
              <div style={{ flex: 1, textAlign: "right" }}>{fmtUsdB(usdB)}</div>
              <div style={{ flex: 1, textAlign: "right" }}>
                ${fmtNum(cents / 100, 2)}
              </div>
            </div>
          ))}
          <div style={{ ...styles.tdRow, background: "#f5f5f4" }}>
            <div style={{ flex: 2 }}>Gross two-asset exposure minus market cap</div>
            <div style={{ flex: 1, textAlign: "right" }}>
              {fmtUsdB(calc.armGrossB + calc.openaiGrossB - calc.mcapB)}
            </div>
            <div style={{ flex: 1, textAlign: "right" }}>bridge, not cash</div>
          </div>
        </div>
        <div style={styles.note}>
          Figures above $1.00 per $1 of market cap do not mean the stub, debt,
          tax, and private-asset haircut are free. They mean gross asset
          exposure exceeds the equity cap — which is exactly what leverage does.
        </div>
      </div>

      <div style={styles.section}>
        <div style={styles.sectionHeader} className="vcx-section-header">
          <span style={styles.sectionNum}>03</span>
          <h2 style={styles.sectionTitle}>NAV / ADR sensitivity</h2>
          <span style={styles.sectionMeta} className="vcx-section-meta">
            vs SFTBY {fmtUsd(sftbyPrice)}
          </span>
        </div>
        <div style={{ overflowX: "auto" }} className="sats-table-scroll">
          <div
            style={{
              display: "grid",
              gridTemplateColumns: `120px repeat(${heatmapOai.length}, 1fr)`,
              gap: 4,
              minWidth: 560,
            }}
          >
            <div style={styles.hmHead}>ARM \ OAI $B</div>
            {heatmapOai.map((o) => (
              <div key={o} style={styles.hmHead}>
                {o}
              </div>
            ))}
            {heatmapArm.map((a) => (
              <React.Fragment key={a}>
                <div
                  style={{
                    ...styles.hmRowHead,
                    color: Math.abs(a - armPrice) < 5 ? "#d97706" : "#1c1917",
                  }}
                >
                  ${a}
                </div>
                {heatmapOai.map((o) => {
                  const cell = computeSotp({
                    armPrice: a,
                    openaiEquityB: o,
                    openaiCase,
                    usdJpy,
                    taxPct,
                    liqHaircutPct,
                    stubMult,
                    sftbyPrice,
                  });
                  const upside = cell.navPerAdr / sftbyPrice - 1;
                  const bg =
                    upside > 0.4
                      ? "#bbf7d0"
                      : upside > 0.15
                      ? "#dcfce7"
                      : upside > 0
                      ? "#fef9c3"
                      : upside > -0.15
                      ? "#fed7aa"
                      : "#fecaca";
                  const active =
                    Math.abs(a - armPrice) < 5 && Math.abs(o - openaiEquityB) < 30;
                  return (
                    <div
                      key={`${a}-${o}`}
                      title={`ARM $${a}, OpenAI $${o}B → NAV/ADR ${fmtUsd(cell.navPerAdr)}`}
                      style={{
                        ...styles.hmCell,
                        background: bg,
                        outline: active ? "2px solid #d97706" : "none",
                      }}
                    >
                      {fmtUsd(cell.navPerAdr, 0)}
                    </div>
                  );
                })}
              </React.Fragment>
            ))}
          </div>
        </div>
      </div>

      <div style={styles.section} id="debt-reconciliation">
        <div style={styles.sectionHeader} className="vcx-section-header">
          <span style={styles.sectionNum}>04</span>
          <h2 style={styles.sectionTitle}>Debt reconciliation (not a second NAV)</h2>
        </div>
        <div style={styles.warnPanel}>
          Consolidated net debt is <strong>not comparable</strong> to this equity
          SOTP. Pairing it with listed-equity marks double-counts SoftBank Corp.
          operating debt, SVF fund leverage, and can double-count Arm-backed
          loans. It belongs here as a bridge, not as a co-equal cheap / not-cheap
          mode.
        </div>
        <div style={styles.tableWrap}>
          <div style={styles.thRow}>
            <div style={{ flex: 2.4 }}>Line</div>
            <div style={{ flex: 1, textAlign: "right" }}>Yen (IR)</div>
            <div style={{ flex: 1, textAlign: "right" }}>USD @ {fmtNum(usdJpy, 1)}</div>
          </div>
          {[
            ["Consolidated NIBD (IR 30 Jun)", IR_JPY_T.consolNibd, calc.consolNdB],
            [
              "− Self-financing entities",
              -IR_JPY_T.selfFin,
              -jpyTToUsdB(IR_JPY_T.selfFin, usdJpy),
            ],
            [
              "− Other IR adjustments (hybrids, collars, etc.)",
              -IR_JPY_T.otherDebtAdj,
              -jpyTToUsdB(IR_JPY_T.otherDebtAdj, usdJpy),
            ],
            ["= SBG adjusted ND (30 Jun)", IR_JPY_T.sbgAdjNd, calc.ndJun30B],
            ["+ July OpenAI draw (roll-forward)", null, calc.julyB],
            ["+ Oct OpenAI draw (if funded-13%)", null, calc.octB],
            ["= SBG ND used in this SOTP", null, calc.sbgNdB],
          ].map(([label, yenT, usdB]) => (
            <div key={label} style={styles.tdRow}>
              <div style={{ flex: 2.4 }}>{label}</div>
              <div style={{ flex: 1, textAlign: "right" }}>
                {yenT == null ? "—" : fmtYenT(yenT)}
              </div>
              <div style={{ flex: 1, textAlign: "right" }}>{fmtUsdB(usdB)}</div>
            </div>
          ))}
          <div style={{ ...styles.tdRow, background: "#f5f5f4" }}>
            <div style={{ flex: 2.4 }}>
              Fiscal.ai consolidated ND (different date/definition)
            </div>
            <div style={{ flex: 1, textAlign: "right" }}>—</div>
            <div style={{ flex: 1, textAlign: "right" }}>
              {fmtUsdB(FISCAL_CONSOL_ND_USD_B)}
            </div>
          </div>
        </div>
        <div style={styles.note}>
          $40B bridge is a commitment (matures 25 Mar 2027). Only the drawn
          amount is in ND; this model adds the post-June OpenAI checks
          explicitly rather than assuming the full $40B. IR LTV policy bands
          (25% / 35%) use this adjusted ND, not Fiscal.ai $147B. Hybrids may be
          50% equity in IR LTV — shown in “other adjustments,” not haircut 50%
          again here. Arm-backed loans {fmtYenT(IR_JPY_T.armAbf)} are subtracted
          from Arm above and are not in SBG adjusted ND.
        </div>
        <div style={styles.evBox}>
          <strong>Equity cap vs EV is a different question.</strong> Fiscal.ai EV{" "}
          {fmtUsdB(FISCAL_EV_USD_B)} uses consolidated ND{" "}
          {fmtUsdB(FISCAL_CONSOL_ND_USD_B)} and cash {fmtUsdB(FISCAL_CASH_USD_B)}.
          Arm+OpenAI gross {fmtUsdB(calc.armGrossB + calc.openaiGrossB)} vs that
          EV is not the holdco SOTP. Do not mix the two.
        </div>
      </div>

      <div style={styles.section}>
        <div style={styles.sectionHeader} className="vcx-section-header">
          <span style={styles.sectionNum}>05</span>
          <h2 style={styles.sectionTitle}>Methodology</h2>
        </div>
        <ul style={styles.methList}>
          <li>
            Official NAV {IR_AS_OF}: {fmtYenT(IR_JPY_T.nav)} vs Fiscal.ai cap
            ¥29.95T ≈ {fmtPct((1 - 29.95 / IR_JPY_T.nav) * 100, 1)} listed
            discount. 5 Aug IR pro forma ¥58.3T re-marks the June book; it is not
            a live balance sheet.
          </li>
          <li>
            Arm ownership is the share count {fmtNum(ARM_SHARES, 0)} (~86.7%),
            not the 2023 IPO “~90%” blurb.
          </li>
          <li>
            OpenAI lives in SVF2 ({fmtYenT(IR_JPY_T.svf2)} at {IR_AS_OF}). Jun 30
            carrying value used to strip the stub: ${OPENAI_CARRY_JUN30_USD_B}B.
            Adding OpenAI on top of full SVF2 would double-count ~$90–110B.
          </li>
          <li>
            Current ownership = 13% × (${OPENAI_COST_FUNDED_TODAY_USD_B}B / $
            {OPENAI_COST_CUMULATIVE_USD_B}B) = {fmtPct(currentOwnership() * 100, 1)}.
            That is a cost-ratio estimate, not a filing.
          </li>
          <li>
            Holdco discount is output = 1 − market cap / model NAV. It is never
            fed back into NAV.
          </li>
        </ul>
      </div>

      <div style={styles.footer}>
        <div>
          <strong>Sources</strong>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 8 }}>
          <div>
            • Fiscal.ai ADR:{" "}
            <a
              href="https://fiscal.ai/company/OTCPK-SFTB.Y"
              target="_blank"
              rel="noopener noreferrer"
              style={styles.sourceLink}
            >
              OTCPK-SFTB.Y
            </a>
            {" · "}
            Tokyo:{" "}
            <a
              href="https://fiscal.ai/company/TSE-9984"
              target="_blank"
              rel="noopener noreferrer"
              style={styles.sourceLink}
            >
              TSE-9984
            </a>
          </div>
          <div>
            • SoftBank NAV / SOTP:{" "}
            <a
              href="https://group.softbank/en/ir/stock/sotp"
              target="_blank"
              rel="noopener noreferrer"
              style={styles.sourceLink}
            >
              group.softbank IR SOTP
            </a>{" "}
            ({IR_AS_OF}; USDJPY {IR_USDJPY})
          </div>
          <div>
            • OpenAI follow-on (~13% upon completion of $30B):{" "}
            <a
              href="https://group.softbank/en/news/press/20260227"
              target="_blank"
              rel="noopener noreferrer"
              style={styles.sourceLink}
            >
              27 Feb 2026 press
            </a>
          </div>
          <div>
            • Citi depositary: 1 ordinary share = 2 ADRs (SFTBY). Unsponsored OTC
            program.
          </div>
          <div>
            • Morningstar equity / investment-detail PDFs (Aug 2026) for the
            accounting-quality warning — not used as the SOTP.
          </div>
        </div>
        <div
          style={{
            marginTop: 24,
            fontStyle: "italic",
            borderTop: "1px dashed #d6d3d1",
            paddingTop: 12,
          }}
        >
          Informational and educational only. Not investment advice, not an
          offer to buy or sell securities, not affiliated with or endorsed by
          SoftBank Group. NAV is not realizable or distributable. Private-company
          values are estimates. Figures can be wrong. The author may hold SFTBY,
          9984, ARM, or related securities. Do your own work.
        </div>
      </div>

      {!isMobile && (
        <div style={styles.stickyBar} className="vcx-sticky-bar">
          <div style={styles.stickyInner}>
            <div style={styles.stickyMetric}>
              <div style={styles.stickyLabel}>NAV / ADR</div>
              <div style={styles.stickyValueAccent}>{fmtUsd(calc.navPerAdr)}</div>
            </div>
            <div style={styles.stickyDivider} />
            <div style={styles.stickyMetric}>
              <div style={styles.stickyLabel}>Discount</div>
              <div style={styles.stickyValue}>{fmtPct(calc.discountPct, 0)}</div>
            </div>
            <div style={styles.stickyDivider} />
            <div style={styles.stickyMetric}>
              <div style={styles.stickyLabel}>LTV</div>
              <div style={styles.stickyValue}>{fmtPct(calc.ltvPct, 0)}</div>
            </div>
            <div style={styles.stickyDivider} />
            <div style={styles.stickyMetric}>
              <div style={styles.stickyLabel}>Gross ¢ Arm</div>
              <div style={styles.stickyValue}>{fmtNum(calc.centsArmGross, 0)}¢</div>
            </div>
            <div style={styles.stickyDivider} />
            <div style={styles.stickyMetric}>
              <div style={styles.stickyLabel}>SFTBY</div>
              <div style={styles.stickyValue}>{fmtUsd(sftbyPrice)}</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
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
