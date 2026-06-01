"use client";

import React, { useState, useMemo, useEffect } from "react";

// VCX NAV Finder
// Source: Fundrise Innovation Fund (f.k.a. Growth Tech Fund) Schedule of Investments, 12/31/2025
// Share counts aggregated across tranches per position. Values in thousands where indicated.

const VCX_SHARES_OUTSTANDING_M = 35.797138; // audited

// Positions where we have a clean underlying share count.
// share_count is in THOUSANDS (matching the filing's "Par/Shares" column).
const SHARE_DENOMINATED = [
  { name: "Databricks", shares_k: 122, mark_pps_0331: 23256 / 122, note: "Common stock only. (SPV separate)" },
  { name: "Ramp Business", shares_k: 308, mark_pps_0331: 27741 / 308, note: "Series A-2 + C-1 + Common" },
  { name: "Flock Group", shares_k: 1547, mark_pps_0331: 23416 / 1547, note: "Class B + A + A-1st-SAFE + C" },
  { name: "Epic Games", shares_k: 43, mark_pps_0331: 19180 / 43, note: "Common" },
  { name: "dbt Labs", shares_k: 441, mark_pps_0331: 15000 / 441, note: "Series D Preferred" },
  { name: "Vanta", shares_k: 555, mark_pps_0331: 10116 / 555, note: "Series B-1 Preferred" },
  { name: "Canva", shares_k: 6, mark_pps_0331: 9599 / 6, note: "Common" },
  { name: "Loyal Animal Health", shares_k: 780, mark_pps_0331: 9560 / 780, note: "Series C Preferred" },
  { name: "Anduril", shares_k: 76, mark_pps_0331: 7350 / 76, note: "Series Seed Preferred only. (CIV separate)" },
  { name: "Erebor Bank", shares_k: 19, mark_pps_0331: 5000 / 19, note: "Preferred (Acq. 2/20/26)" },
  { name: "Handshake", shares_k: 46, mark_pps_0331: 3415 / 46, note: "Series C + D Preferred" },
  { name: "Intercom", shares_k: 53, mark_pps_0331: 2802 / 53, note: "Common + Series A Preferred" },
  { name: "Anyscale", shares_k: 511, mark_pps_0331: 2494 / 511, note: "Common" },
  { name: "Hightouch", shares_k: 14, mark_pps_0331: 683 / 14, note: "Common + Series C Preferred" },
  { name: "Stripe", shares_k: 10, mark_pps_0331: 618 / 10, note: "Common" },
];

// Held at mark — no clean underlying share count disclosed (SPVs, convertible rights, partnership interests).
// Values in thousands.
const DOLLAR_DENOMINATED = [
  { name: "Anthropic (co-investment vehicles)", value_k: 112418, note: "Three CIV lots (12/23, 08/25, 02/26) — blended 2.2x on $50.8M cost" },
  { name: "OpenAI (co-investment vehicles)", value_k: 84163, note: "Two CIV lots (12/23, 09/24)" },
  { name: "Databricks SPV", value_k: 72480, note: "Valued via NAV practical expedient" },
  { name: "Anduril Industries CIV", value_k: 30231, note: "Acq. 10/23 (Series F markup)" },
  { name: "SpaceX SPV", value_k: 26856, note: "Acq. 7/25" },
  { name: "Visual Layer (SAFE)", value_k: 5000, note: "Converts on next round" },
  { name: "AI-LLM, LLC (CIV)", value_k: 3105, note: "Top-10 LLM provider" },
];

// Long tail / non-private-equity holdings + net-other assets.
const OTHER_HOLDINGS = [
  { name: "CMBS / Data Center Fixed Income", value_k: 65751, note: "SOFR-floating, short duration" },
  { name: "Other assets in excess of liabilities", value_k: 64732, note: "Net positive: cash, receivables less liabilities" },
  { name: "JPM Treasury MMF", value_k: 38310, note: "Cash equivalent (~3.62% 7-day yield)" },
  { name: "Inspectify (PE + SAFE)", value_k: 6000, note: "Series A-5 Preferred + SAFE" },
  { name: "Promissory Note — Theory Ventures", value_k: 4732, note: "10.0% coupon, matures 4/28/33" },
  { name: "Rhino Labs", value_k: 1414, note: "Series P + D-1A + D-1" },
  { name: "Immuta", value_k: 1022, note: "Common" },
  { name: "DittoLive", value_k: 1000, note: "Series B" },
  { name: "Omni Analytics", value_k: 588, note: "Series B-1" },
  { name: "Risotto", value_k: 500, note: "Seed 2 + Seed 1" },
  { name: "Luminos", value_k: 364, note: "Seed 2 + Seed 1" },
  { name: "Gumloop", value_k: 22, note: "Series A-2" },
];

const fmt$ = (n) =>
  n >= 1e9
    ? `$${(n / 1e9).toFixed(2)}B`
    : n >= 1e6
    ? `$${(n / 1e6).toFixed(1)}M`
    : n >= 1e3
    ? `$${(n / 1e3).toFixed(1)}K`
    : `$${n.toFixed(0)}`;

const fmt$exact = (n) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);

const fmtNum = (n) => new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(n);

export default function VCXNAVFinder() {
  // Viewport detection for mobile layout
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 720);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  // Viewport meta is handled by Next.js layout viewport export

  // Track which preset scenario is active (null = custom/manual edits)
  const [activeScenario, setActiveScenario] = useState("mark");

  // Initialize PPS at the 3/31/26 marks
  const [ppsOverrides, setPpsOverrides] = useState(
    SHARE_DENOMINATED.reduce((acc, p) => ({ ...acc, [p.name]: p.mark_pps_0331 }), {})
  );
  const [vcxShares, setVcxShares] = useState(VCX_SHARES_OUTSTANDING_M);
  const [vcxPrice, setVcxPrice] = useState(211);

  // MOIC overrides for SPV/SAFE positions (Box 2) and other holdings (Box 3).
  // 1.0x = held at 12/31 mark.
  const [dollarMOICs, setDollarMOICs] = useState(
    DOLLAR_DENOMINATED.reduce((acc, p) => ({ ...acc, [p.name]: 1.0 }), {})
  );
  const [otherMOICs, setOtherMOICs] = useState(
    OTHER_HOLDINGS.reduce((acc, p) => ({ ...acc, [p.name]: 1.0 }), {})
  );

  const updatePPS = (name, val) => {
    setPpsOverrides((prev) => ({ ...prev, [name]: val }));
    setActiveScenario(null); // manual edit clears active scenario
  };

  const updateDollarMOIC = (name, val) => {
    setDollarMOICs((prev) => ({ ...prev, [name]: val }));
    setActiveScenario(null);
  };

  const updateOtherMOIC = (name, val) => {
    setOtherMOICs((prev) => ({ ...prev, [name]: val }));
    setActiveScenario(null);
  };

  // Update URL when scenario changes (without triggering navigation)
  const updateURL = (scenarioKey) => {
    const url = new URL(window.location);
    if (scenarioKey && scenarioKey !== "mark") {
      url.searchParams.set("scenario", scenarioKey);
    } else {
      url.searchParams.delete("scenario");
    }
    window.history.replaceState({}, "", url);
  };

  const resetToMark = () => {
    setPpsOverrides(
      SHARE_DENOMINATED.reduce((acc, p) => ({ ...acc, [p.name]: p.mark_pps_0331 }), {})
    );
    setDollarMOICs(DOLLAR_DENOMINATED.reduce((acc, p) => ({ ...acc, [p.name]: 1.0 }), {}));
    setOtherMOICs(OTHER_HOLDINGS.reduce((acc, p) => ({ ...acc, [p.name]: 1.0 }), {}));
    setActiveScenario("mark");
    updateURL("mark");
  };

  const applyDream = () => {
    // Everything 2x from base assumptions
    setPpsOverrides({
      "Databricks": 440,
      "Ramp Business": 240,
      "Flock Group": 36,
      "Epic Games": 1132,
      "dbt Labs": 84,
      "Vanta": 40,
      "Canva": 3600,
      "Loyal Animal Health": 30,
      "Anduril": 200,
      "Erebor Bank": 600,
      "Handshake": 160,
      "Intercom": 120,
      "Anyscale": 12,
      "Hightouch": 120,
      "Stripe": 140,
    });
    setDollarMOICs({
      "Anthropic (co-investment vehicles)": 3.0,
      "OpenAI (co-investment vehicles)": 3.6,
      "Databricks SPV": 2.4,
      "Anduril Industries CIV": 2.4,
      "SpaceX SPV": 2.2,
      "Visual Layer (SAFE)": 2.0,
      "AI-LLM, LLC (CIV)": 4.0,
    });
    setOtherMOICs(OTHER_HOLDINGS.reduce((acc, p) => ({ ...acc, [p.name]: 1.0 }), {}));
    setActiveScenario("dream");
    updateURL("dream");
  };

  const applyNotice = () => {
    resetToMark();
    setDollarMOICs((prev) => ({
      ...prev,
      "Anthropic (co-investment vehicles)": 2.9,
      "OpenAI (co-investment vehicles)": 1.9,
    }));
    setActiveScenario("notice");
    updateURL("notice");
  };

  const applyVentuals = () => {
    resetToMark();
    setDollarMOICs((prev) => ({
      ...prev,
      "Anthropic (co-investment vehicles)": 4.0,
      "OpenAI (co-investment vehicles)": 2.5,
    }));
    setActiveScenario("ventuals");
    updateURL("ventuals");
  };

  // Read scenario from URL on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const scenario = params.get("scenario");
    if (scenario === "dream") {
      applyDream();
    } else if (scenario === "notice") {
      applyNotice();
    } else if (scenario === "ventuals") {
      applyVentuals();
    }
    // "mark" is the default, no action needed
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const calc = useMemo(() => {
    const shareRows = SHARE_DENOMINATED.map((p) => {
      const pps = parseFloat(ppsOverrides[p.name]) || 0;
      const positionValue = pps * p.shares_k * 1000; // shares_k in thousands
      const navPerVcxShare = positionValue / (vcxShares * 1_000_000);
      return { ...p, pps, positionValue, navPerVcxShare };
    });

    const dollarRows = DOLLAR_DENOMINATED.map((p) => {
      const moic = parseFloat(dollarMOICs[p.name]) || 0;
      const positionValue = p.value_k * 1000 * moic;
      return {
        ...p,
        moic,
        markValue: p.value_k * 1000,
        positionValue,
        navPerVcxShare: positionValue / (vcxShares * 1_000_000),
      };
    });

    const otherRows = OTHER_HOLDINGS.map((p) => {
      const moic = parseFloat(otherMOICs[p.name]) || 0;
      const positionValue = p.value_k * 1000 * moic;
      return {
        ...p,
        moic,
        markValue: p.value_k * 1000,
        positionValue,
        navPerVcxShare: positionValue / (vcxShares * 1_000_000),
      };
    });

    const shareTotal = shareRows.reduce((s, r) => s + r.positionValue, 0);
    const dollarTotal = dollarRows.reduce((s, r) => s + r.positionValue, 0);
    const otherTotal = otherRows.reduce((s, r) => s + r.positionValue, 0);
    const totalNAV = shareTotal + dollarTotal + otherTotal;
    const navPerShare = totalNAV / (vcxShares * 1_000_000);

    // Anthropic exposure per VCX share specifically
    const anthropicRow = shareRows.find((r) => r.name === "Anthropic");
    const anthropicPerVCX = anthropicRow ? anthropicRow.navPerVcxShare : 0;

    return { shareRows, dollarRows, otherRows, shareTotal, dollarTotal, otherTotal, totalNAV, navPerShare, anthropicPerVCX };
  }, [ppsOverrides, vcxShares, dollarMOICs, otherMOICs]);

  return (
    <div style={styles.container} className="vcx-container">

      <div style={styles.header}>
        <div style={styles.eyebrow} className="vcx-eyebrow">FUNDRISE INNOVATION FUND · NYSE: VCX · ESTIMATED NAV CALCULATOR</div>
        <h1 style={styles.title} className="vcx-title">
          VCX <span style={styles.titleAccent}>NAV Finder</span>
        </h1>
        <p style={styles.subtitle} className="vcx-subtitle">
          VCX is a closed-end fund holding stakes in private companies (Anthropic, Databricks, OpenAI, SpaceX, etc.). It listed on the NYSE on March 19, 2026 and currently trades at a steep premium to its underlying net asset value. This tool lets you mark each holding to a current secondary-market price so you can estimate what VCX is actually worth per share. Inputs default to Fundrise's audited March 31, 2026 marks; override using current data from Hiive, Caplight, Notice, Forge, or your own estimates.
        </p>
      </div>

      <div style={styles.howToBox}>
        <div style={styles.howToTitle}>How this works in 30 seconds</div>
        <ol style={styles.howToList}>
          <li style={{ marginBottom: 6 }}>The fund holds three buckets of assets: private-company shares (Box 1), SPV/SAFE/convertible positions (Box 2), and a mix of public stock, fixed income, cash and liabilities (Box 3).</li>
          <li style={{ marginBottom: 6 }}>Update price-per-share for Box 1 holdings and MOIC multipliers for Box 2/3. Defaults are Fundrise's audited March 31, 2026 marks.</li>
          <li style={{ marginBottom: 6 }}>Try the preset buttons to see plausible "current market" and "everything-doubles" scenarios.</li>
          <li>The grand total at the bottom shows estimated NAV per share and the implied premium vs. the current VCX market price.</li>
        </ol>
      </div>
      <div style={styles.controls} className="vcx-controls">
        <div style={styles.controlGroup}>
          <label style={styles.label}>VCX Shares Outstanding (M)</label>
          <input
            type="number"
            step="0.01"
            value={vcxShares}
            onChange={(e) => setVcxShares(parseFloat(e.target.value) || 0)}
            style={styles.smallInput}
            className="vcx-input vcx-small-input"
          />
        </div>
        <div style={styles.controlGroup}>
          <label style={styles.label}>VCX Market Price ($)</label>
          <input
            type="number"
            step="0.01"
            value={vcxPrice}
            onChange={(e) => setVcxPrice(parseFloat(e.target.value) || 0)}
            style={styles.smallInput}
            className="vcx-input vcx-small-input"
          />
        </div>
        <div style={styles.controlGroup}>
          {[
            { key: "mark", label: "3/31/26 Audited Marks (base case)", handler: resetToMark },
            { key: "notice", label: "Mark-to-Secondary (Notice)", handler: applyNotice, title: "Adjusts Anthropic & OpenAI only; other holdings stay at the 3/31 audited mark (no dated secondary source on file)." },
            { key: "ventuals", label: "Derivative Ceiling (Ventuals)", handler: applyVentuals, title: "Adjusts Anthropic & OpenAI only; other holdings stay at the 3/31 audited mark (no dated secondary source on file)." },
            { key: "dream", label: "Dream Scenario (2×)", handler: applyDream },
          ].map(({ key, label, handler, title }) => {
            const isActive = activeScenario === key;
            return (
              <button
                key={key}
                onClick={handler}
                title={title || ""}
                style={{
                  ...styles.presetBtn,
                  ...(isActive ? styles.presetBtnActive : {}),
                  ...(key === "dream" && !isActive ? { borderColor: "#d97706", color: "#d97706" } : {}),
                  ...((key === "notice" || key === "ventuals") && !isActive ? { borderColor: "#3b82f6", color: "#3b82f6" } : {}),
                }}
                className="preset-btn vcx-preset-btn"
              >
                {isActive && <span style={styles.activeDot} />}
                {label}
              </button>
            );
          })}
          {activeScenario === null && (
            <span style={styles.customLabel}>Custom</span>
          )}
        </div>
      </div>

      {/* SHARE COUNT NOTE */}
      <div style={styles.issuanceBox}>
        <div style={styles.issuanceHeader}>
          <span style={styles.sectionNum}>ⓘ</span>
          <h3 style={{ ...styles.sectionTitle, fontSize: "16px", margin: 0 }}>About the share count</h3>
        </div>
        <div style={styles.issuanceMeta}>
          The default share count of <strong>35,797,138</strong> is the audited figure from the March 31, 2026 Annual Report. This supersedes the prior cap-table reconstruction (~35.9M) by Reddit user Fit_Equal6932, which proved highly accurate (within 0.3%). The April 24 Form 144 figure of 28.3M was indeed the stale Schedule TO baseline and did not capture late retail subscriptions or the REIT block.
        </div>
      </div>

      {/* SHARE-DENOMINATED TABLE */}
      <div style={styles.section}>
        <div style={styles.sectionHeader} className="vcx-section-header">
          <span style={styles.sectionNum}>01</span>
          <h2 style={styles.sectionTitle}>Positions held as common/preferred shares</h2>
          <span style={styles.sectionMeta} className="vcx-section-meta">Edit PPS to mark each position to current market</span>
        </div>

        <div style={styles.tableWrap}>
          <div style={styles.tableHeaderRow} className="vcx-table-header">
            <div style={{ ...styles.th, flex: "2.2" }}>Company</div>
            <div style={{ ...styles.th, flex: "1.2", textAlign: "right" }}>Shares (K)</div>
            <div style={{ ...styles.th, flex: "1.4", textAlign: "right" }}>Your PPS ($)</div>
            <div style={{ ...styles.th, flex: "1.4", textAlign: "right" }}>Position Value</div>
            <div style={{ ...styles.th, flex: "1.2", textAlign: "right" }}>$/VCX share</div>
            <div style={{ ...styles.th, flex: "1.0", textAlign: "right" }}>¢ per $1</div>
          </div>

          {calc.shareRows.map((r) => {
            const delta = ((r.pps - r.mark_pps_0331) / r.mark_pps_0331) * 100;
            return (
              <div key={r.name} style={styles.tr} className="vcx-row">
                <div style={{ ...styles.td, flex: "2.2" }}>
                  <div style={styles.companyName}>{r.name}</div>
                  <div style={styles.companyNote}>{r.note}</div>
                </div>
                <div style={{ ...styles.td, flex: "1.2", textAlign: "right", fontVariantNumeric: "tabular-nums" }} data-label="Shares (K)">
                  {fmtNum(r.shares_k)}
                </div>
                <div style={{ ...styles.td, flex: "1.4", textAlign: "right" }} className="vcx-pps-cell" data-label="Your PPS ($)">
                  <input
                    type="number"
                    step="any"
                    value={ppsOverrides[r.name]}
                    onChange={(e) => updatePPS(r.name, e.target.value)}
                    style={styles.ppsInput}
                    className="vcx-input"
                  />
                  {Math.abs(delta) > 0.5 && (
                    <div style={{ ...styles.delta, color: delta > 0 ? "#15803d" : "#b91c1c" }}>
                      {delta > 0 ? "▲" : "▼"} {Math.abs(delta).toFixed(0)}% vs mark
                    </div>
                  )}
                </div>
                <div style={{ ...styles.td, flex: "1.4", textAlign: "right", fontVariantNumeric: "tabular-nums", fontWeight: 500 }} data-label="Position Value">
                  {fmt$(r.positionValue)}
                </div>
                <div style={{ ...styles.td, flex: "1.2", textAlign: "right", fontVariantNumeric: "tabular-nums", color: "#d97706", fontWeight: 600 }} data-label="$/VCX share">
                  ${r.navPerVcxShare.toFixed(2)}
                </div>
                <div style={{ ...styles.td, flex: "1.0", textAlign: "right", fontVariantNumeric: "tabular-nums", color: "#1c1917", fontWeight: 600, fontFamily: "'JetBrains Mono', monospace", fontSize: "12px" }} data-label="¢ per $1">
                  {vcxPrice > 0 ? (r.navPerVcxShare / vcxPrice * 100).toFixed(1) + "¢" : "—"}
                </div>
              </div>
            );
          })}

          <div style={styles.subtotalRow} className="vcx-subtotal">
            <div style={{ flex: "2.2" }}>Subtotal — share-marked</div>
            <div style={{ flex: "1.2" }} />
            <div style={{ flex: "1.4" }} />
            <div style={{ flex: "1.4", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{fmt$(calc.shareTotal)}</div>
            <div style={{ flex: "1.2", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
              ${(calc.shareTotal / (vcxShares * 1_000_000)).toFixed(2)}
            </div>
            <div style={{ flex: "1.0", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
              {vcxPrice > 0 ? ((calc.shareTotal / (vcxShares * 1_000_000)) / vcxPrice * 100).toFixed(1) + "¢" : "—"}
            </div>
          </div>
        </div>
      </div>

      {/* DOLLAR-DENOMINATED TABLE */}
      <div style={styles.section}>
        <div style={styles.sectionHeader} className="vcx-section-header">
          <span style={styles.sectionNum}>02</span>
          <h2 style={styles.sectionTitle}>SPV / Convertible / SAFE — flex with MOIC</h2>
          <span style={styles.sectionMeta} className="vcx-section-meta">1.0x = held at 3/31/26 mark</span>
        </div>

        <div style={styles.tableWrap}>
          <div style={styles.tableHeaderRow} className="vcx-table-header">
            <div style={{ ...styles.th, flex: "2.6" }}>Position</div>
            <div style={{ ...styles.th, flex: "1.2", textAlign: "right" }}>3/31 Mark</div>
            <div style={{ ...styles.th, flex: "1.0", textAlign: "right" }}>MOIC</div>
            <div style={{ ...styles.th, flex: "1.4", textAlign: "right" }}>Position Value</div>
            <div style={{ ...styles.th, flex: "1.2", textAlign: "right" }}>$/VCX share</div>
            <div style={{ ...styles.th, flex: "1.0", textAlign: "right" }}>¢ per $1</div>
          </div>
          {calc.dollarRows.map((r) => (
            <div key={r.name} style={styles.tr} className="vcx-row">
              <div style={{ ...styles.td, flex: "2.6" }}>
                <div style={styles.companyName}>{r.name}</div>
                <div style={styles.companyNote}>{r.note}</div>
              </div>
              <div style={{ ...styles.td, flex: "1.2", textAlign: "right", fontVariantNumeric: "tabular-nums", color: "#78716c" }} data-label="3/31 Mark">
                {fmt$(r.markValue)}
              </div>
              <div style={{ ...styles.td, flex: "1.0", textAlign: "right" }} className="vcx-moic-cell" data-label="MOIC">
                <input
                  type="number"
                  step="0.1"
                  value={dollarMOICs[r.name]}
                  onChange={(e) => updateDollarMOIC(r.name, e.target.value)}
                  style={styles.moicInput}
                  className="vcx-input"
                />
              </div>
              <div style={{ ...styles.td, flex: "1.4", textAlign: "right", fontVariantNumeric: "tabular-nums", fontWeight: 500 }} data-label="Position Value">
                {fmt$(r.positionValue)}
              </div>
              <div style={{ ...styles.td, flex: "1.2", textAlign: "right", fontVariantNumeric: "tabular-nums", color: "#d97706", fontWeight: 600 }} data-label="$/VCX share">
                ${r.navPerVcxShare.toFixed(2)}
              </div>
              <div style={{ ...styles.td, flex: "1.0", textAlign: "right", fontVariantNumeric: "tabular-nums", color: "#1c1917", fontWeight: 600, fontFamily: "'JetBrains Mono', monospace", fontSize: "12px" }} data-label="¢ per $1">
                {vcxPrice > 0 ? (r.navPerVcxShare / vcxPrice * 100).toFixed(1) + "¢" : "—"}
              </div>
            </div>
          ))}
          <div style={styles.subtotalRow} className="vcx-subtotal">
            <div style={{ flex: "2.6" }}>Subtotal — SPV/SAFE</div>
            <div style={{ flex: "1.2" }} />
            <div style={{ flex: "1.0" }} />
            <div style={{ flex: "1.4", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{fmt$(calc.dollarTotal)}</div>
            <div style={{ flex: "1.2", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
              ${(calc.dollarTotal / (vcxShares * 1_000_000)).toFixed(2)}
            </div>
            <div style={{ flex: "1.0", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
              {vcxPrice > 0 ? ((calc.dollarTotal / (vcxShares * 1_000_000)) / vcxPrice * 100).toFixed(1) + "¢" : "—"}
            </div>
          </div>
        </div>
        <div style={styles.callout}>
          <p style={{ marginTop: 0 }}><strong>How Fundrise set these 3/31 marks.</strong> These are Level 3 fair values determined by Fundrise Advisors (the Valuation Designee, under SEC Rule 2a-5) using the <strong>market approach</strong>, adjusted to each position's latest funding round. The audited report groups the $432.9M Level 3 book into two techniques: <strong>"Market Transaction"</strong> ($327.1M — marked to private transaction prices / non-public third-party pricing) and <strong>"Recent Transaction"</strong> ($105.8M — held at the original round or secondary entry price). Every CIV/SPV line shows <strong>N/A shares</strong>, so an exact implied company valuation cannot be computed from the filing. The figures below are our inference, triangulating the dated cost/value lots in the restricted-securities schedule against each company's last known primary round:</p>
          <ul style={{ paddingLeft: "1.5rem", marginBottom: "1rem" }}>
            <li><strong>Anthropic ≈ $350B.</strong> The freshest lot (acquired 2/10/26, cost $20.8M held at $20.0M — essentially flat) lines up with Anthropic's ~$350B round in Jan 2026; the older 12/23 and 8/25 lots carry the markup to that level (blended <strong>2.2× on $50.8M cost</strong>).</li>
            <li><strong>OpenAI ≈ $450–500B.</strong> Reflects OpenAI's ~$500B primary round (Oct 2025). The 9/24 lot is up ~2.5× and the 12/23 lot ~3.7× on cost. <em>(This corrects a prior ~$300B figure — Fundrise's mark embeds the Oct-2025 round, not a 2024 valuation.)</em></li>
            <li><strong>Databricks ≈ SPV NAV.</strong> Marked via the SPV's own reported NAV (practical expedient), not a look-through to Databricks shares.</li>
            <li><strong>Anduril ≈ Series F (2025),</strong> ~5× on the 2023 cost basis.</li>
          </ul>
          <p><strong>Where secondary venues currently price the two megacaps</strong> (used by the Mark-to-Secondary and Derivative-Ceiling scenarios — see presets):</p>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px", marginTop: "8px", marginBottom: "8px" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid #d6d3d1", textAlign: "left" }}>
                <th style={{ padding: "4px 8px" }}></th>
                <th style={{ padding: "4px 8px" }}>Fundrise 3/31 implied*</th>
                <th style={{ padding: "4px 8px" }}>Notice consensus</th>
                <th style={{ padding: "4px 8px" }}>Ventuals oracle / mark</th>
              </tr>
            </thead>
            <tbody>
              <tr style={{ borderBottom: "1px solid #e7e5e4" }}>
                <td style={{ padding: "4px 8px", fontWeight: "600" }}>Anthropic</td>
                <td style={{ padding: "4px 8px" }}>~$350B</td>
                <td style={{ padding: "4px 8px" }}>$1.03T (Jun 1)</td>
                <td style={{ padding: "4px 8px" }}>$1.40T / $1.59T (Jun 1)</td>
              </tr>
              <tr style={{ borderBottom: "1px solid #e7e5e4" }}>
                <td style={{ padding: "4px 8px", fontWeight: "600" }}>OpenAI</td>
                <td style={{ padding: "4px 8px" }}>~$450–500B</td>
                <td style={{ padding: "4px 8px" }}>$887B (May 30)</td>
                <td style={{ padding: "4px 8px" }}>$1.18T / $1.37T (Jun 1)</td>
              </tr>
              <tr style={{ color: "#78716c", fontStyle: "italic" }}>
                <td style={{ padding: "4px 8px" }}>implied MOIC →</td>
                <td style={{ padding: "4px 8px" }}>1.0× (base)</td>
                <td style={{ padding: "4px 8px" }}>Anthropic ~2.9× · OpenAI ~1.8–2.0×</td>
                <td style={{ padding: "4px 8px" }}>Anthropic ~4.0× (oracle) · OpenAI ~2.5×</td>
              </tr>
            </tbody>
          </table>
          <p style={{ marginBottom: 0, fontSize: "12px", color: "#57534e" }}>
            <em>*Inferred from Fundrise's marks; not disclosed in the filing.</em> <strong>Notice</strong> is an algorithmic secondary-market consensus (transaction + reference data, dated/timestamped). <strong>Ventuals</strong> is a perpetual-futures venue — its <strong>"mark" carries a funding premium over its "oracle" index</strong> (e.g., Anthropic mark 1,594 vs oracle 1,402 on Jun 1), so treat the oracle as the reference and the mark as a sentiment ceiling, not a transaction tape. Both are accessed from a restricted jurisdiction and are not executable here.
          </p>
        </div>
      </div>

      {/* OTHER HOLDINGS */}
      <div style={styles.section}>
        <div style={styles.sectionHeader} className="vcx-section-header">
          <span style={styles.sectionNum}>03</span>
          <h2 style={styles.sectionTitle}>Long tail · public · fixed income · cash · liabilities</h2>
          <span style={styles.sectionMeta} className="vcx-section-meta">1.0x = held at 3/31/26 mark · Issuance lines locked</span>
        </div>
        <div style={styles.tableWrap}>
          <div style={styles.tableHeaderRow} className="vcx-table-header">
            <div style={{ ...styles.th, flex: "2.6" }}>Position</div>
            <div style={{ ...styles.th, flex: "1.2", textAlign: "right" }}>3/31 Mark</div>
            <div style={{ ...styles.th, flex: "1.0", textAlign: "right" }}>MOIC</div>
            <div style={{ ...styles.th, flex: "1.4", textAlign: "right" }}>Position Value</div>
            <div style={{ ...styles.th, flex: "1.2", textAlign: "right" }}>$/VCX share</div>
            <div style={{ ...styles.th, flex: "1.0", textAlign: "right" }}>¢ per $1</div>
          </div>
          {calc.otherRows.map((r) => {
            const isIssuance = r.moic === undefined;
            return (
              <div key={r.name} style={styles.tr} className="vcx-row">
                <div style={{ ...styles.td, flex: "2.6" }}>
                  <div style={styles.companyName}>{r.name}</div>
                  <div style={styles.companyNote}>{r.note}</div>
                </div>
                <div style={{ ...styles.td, flex: "1.2", textAlign: "right", fontVariantNumeric: "tabular-nums", color: "#78716c" }} data-label="3/31 Mark">
                  {isIssuance ? "—" : (r.markValue < 0 ? `(${fmt$(Math.abs(r.markValue))})` : fmt$(r.markValue))}
                </div>
                <div style={{ ...styles.td, flex: "1.0", textAlign: "right" }} className="vcx-moic-cell" data-label="MOIC">
                  {isIssuance ? (
                    <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "11px", color: "#a8a29e" }}>locked</span>
                  ) : (
                    <input
                      type="number"
                      step="0.1"
                      value={otherMOICs[r.name]}
                      onChange={(e) => updateOtherMOIC(r.name, e.target.value)}
                      style={styles.moicInput}
                      className="vcx-input"
                    />
                  )}
                </div>
                <div style={{ ...styles.td, flex: "1.4", textAlign: "right", fontVariantNumeric: "tabular-nums", fontWeight: 500, color: r.positionValue < 0 ? "#b91c1c" : "inherit" }} data-label="Position Value">
                  {r.positionValue < 0 ? `(${fmt$(Math.abs(r.positionValue))})` : fmt$(r.positionValue)}
                </div>
                <div style={{ ...styles.td, flex: "1.2", textAlign: "right", fontVariantNumeric: "tabular-nums", color: r.positionValue < 0 ? "#b91c1c" : "#d97706", fontWeight: 600 }} data-label="$/VCX share">
                  ${r.navPerVcxShare.toFixed(2)}
                </div>
                <div style={{ ...styles.td, flex: "1.0", textAlign: "right", fontVariantNumeric: "tabular-nums", color: r.positionValue < 0 ? "#b91c1c" : "#1c1917", fontWeight: 600, fontFamily: "'JetBrains Mono', monospace", fontSize: "12px" }} data-label="¢ per $1">
                  {vcxPrice > 0 ? (r.navPerVcxShare / vcxPrice * 100).toFixed(1) + "¢" : "—"}
                </div>
              </div>
            );
          })}
          <div style={styles.subtotalRow} className="vcx-subtotal">
            <div style={{ flex: "2.6" }}>Subtotal — other</div>
            <div style={{ flex: "1.2" }} />
            <div style={{ flex: "1.0" }} />
            <div style={{ flex: "1.4", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{fmt$(calc.otherTotal)}</div>
            <div style={{ flex: "1.2", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
              ${(calc.otherTotal / (vcxShares * 1_000_000)).toFixed(2)}
            </div>
            <div style={{ flex: "1.0", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
              {vcxPrice > 0 ? ((calc.otherTotal / (vcxShares * 1_000_000)) / vcxPrice * 100).toFixed(1) + "¢" : "—"}
            </div>
          </div>
        </div>
      </div>

      {/* GRAND TOTAL */}
      <div style={styles.grandTotal} className="vcx-grand-total">
        <div style={styles.gtLabel}>TOTAL ESTIMATED NAV</div>
        <div style={styles.gtValue} className="vcx-gt-value-large">{fmt$exact(calc.totalNAV)}</div>
        <div style={styles.gtDivider} />
        <div style={styles.gtLabel}>NAV PER VCX SHARE</div>
        <div style={styles.gtValueAccent} className="vcx-gt-value-accent">${calc.navPerShare.toFixed(2)}</div>
        <div style={styles.gtDivider} />
        <div style={{ display: "flex", gap: "48px", flexWrap: "wrap", marginTop: "8px" }} className="vcx-gt-metrics">
          <div className="vcx-gt-metric">
            <div style={styles.gtLabel}>VCX Trading at</div>
            <div style={{ ...styles.gtValue, fontSize: "32px", marginBottom: "4px" }} className="vcx-gt-value-small">${vcxPrice.toFixed(2)}</div>
          </div>
          <div className="vcx-gt-metric">
            <div style={styles.gtLabel}>Premium to NAV</div>
            <div style={{ ...styles.gtValue, fontSize: "32px", marginBottom: "4px", color: vcxPrice > calc.navPerShare ? "#fbbf24" : "#86efac" }} className="vcx-gt-value-small">
              {((vcxPrice / calc.navPerShare - 1) * 100).toFixed(0)}%
            </div>
          </div>
          <div className="vcx-gt-metric">
            <div style={styles.gtLabel}>Price ÷ NAV</div>
            <div style={{ ...styles.gtValue, fontSize: "32px", marginBottom: "4px" }} className="vcx-gt-value-small">{(vcxPrice / calc.navPerShare).toFixed(2)}x</div>
          </div>
          <div className="vcx-gt-metric">
            <div style={styles.gtLabel}>Implied VCX Mkt Cap</div>
            <div style={{ ...styles.gtValue, fontSize: "32px", marginBottom: "4px" }} className="vcx-gt-value-small">{fmt$(vcxPrice * vcxShares * 1_000_000)}</div>
          </div>
        </div>
        <div style={styles.gtMeta}>
          Estimated NAV based on user-supplied marks · {vcxShares.toFixed(2)}M shares outstanding · Compare to VCX market price to see premium or discount
        </div>
      </div>


      <div style={styles.footer}>
        <div><strong>Changelog:</strong></div>
        <div>• <strong>June 1, 2026</strong> — Rebased to 3/31/26 audited annual report. Base case changed from unaudited 12/31/25 marks to the audited 3/31/26 annual report (KPMG opinion 5/30/26). The 12/31 scenario has been retired. Share count set to the audited 35,797,138 (was a ~35.9M Reddit reconstruction, which proved accurate within 0.3%). Default NAV now $678.9M / $18.97 per share (was $533.8M / $14.87). The ~$145M increase is almost entirely the Q1 2026 AI markup, concentrated in five names: Anthropic +$62M, OpenAI +$31M, Anduril +$25M, SpaceX +$20M, Flock +$7M. Anthropic and SpaceX were moved from the PPS-marked box to the MOIC box, as both are held via CIV/SPV with no look-through share count, so the prior per-share lines were structurally wrong. OpenAI was relabeled from "Convertible Rights + Partnership" to two co-investment-vehicle lots ($84.2M total). ServiceTitan (TTAN, $12.7M) was removed — no longer in the schedule; sold during the year. Theory Ventures was reclassified from a sold LP interest to an in-kind promissory note ($4.73M, 10% coupon, matures 2033). Removed the $100M synthetic "pre-listing issuance" plug and flipped the net-other line from –$27.3M to +$64.7M — the audited balance sheet already reflects post-issuance cash ($75.7M), so the bridge and the negative-liabilities assumption were double-counting / sign-wrong. New/trued-up positions include Erebor Bank ($5.0M, new), Flock Class A + Class A First SAFE (new 3/2/26 tranches), Loyal share count 680→780, Stripe marked up, MMF $26.6M→$38.3M, CMBS $66.4M→$65.8M. Premium at the default price recomputed to ~15.4x / ~1,445% (was 19.7x / 1,870%). Added two scenario presets — "Mark-to-Secondary" (Notice consensus) and "Derivative Ceiling" (Ventuals oracle) — that mark Anthropic and OpenAI to current secondary/derivative prices. Even at the Ventuals ceiling, the implied premium stays ~9x; at the Notice consensus, ~11x. Expanded the Section 02 footnote to explain how Fundrise derived the 3/31 marks (Level 3 market approach; "Market Transaction" vs "Recent Transaction") and our inferred implied valuations (Anthropic ~$350B, OpenAI ~$450–500B), and corrected the prior stale ~$300B OpenAI figure. Default price updated to $211 (premium ~11.1x / ~1,012%).</div>
        <div>• <strong>May 12, 2026</strong> — Added "¢ per $1" column to all three tables, showing how many cents of each underlying holding you get for every dollar invested in VCX at the current market price. Updated default VCX market price from $240 to $293.</div>
        <div>• <strong>May 11, 2026 (evening update)</strong> — Updated default share count from 28.3M to 35.9M based on a forensic cap-table reconciliation by Reddit user Fit_Equal6932 (<a href="https://www.reddit.com/r/VCX_Fundrise/s/bit09tvNnO" target="_blank" rel="noopener noreferrer" style={{ color: "#d97706", textDecoration: "underline" }}>full analysis here</a>). His walk anchors on a Fundrise platform screenshot from February 20, 2026 ($563M AUM at $18.27 NAV, implying 30.82M shares) and walks forward through documented Q1 2026 events to reconcile against Fundrise's reported $679M pre-listing AUM, arriving at ~35.9M total shares outstanding. The prior 28.3M figure from the April 24 Form 144 appears to be the January 29 Schedule TO baseline that didn't get updated for late retail subscriptions or the Tech Infrastructure REIT block. At 35.9M shares the bear case math is sharper, not softer — the per-share NAV in every scenario is lower than the prior version showed. Bloomberg's reported ~4.7M free float at listing ties closely to the ~5.1M implied by his analysis.</div>
        <div>• <strong>May 11, 2026 (afternoon update)</strong> — Added a $100M "Pre-listing primary issuance (Jan–Mar 2026)" line to the other-holdings section. The prior version was dividing the 12/31/25 NAV by the late-April share count without accounting for the real primary issuance that occurred to platform investors between year-end and the March 19 NYSE listing. That issuance brought roughly $100M of cash into VCX at the then-published NAV of ~$19/share, and is what reconciles the year-end $437M total net assets to the ~$540M+ AUM at listing time. With this line included, the default "12/31/25 marks" scenario now produces a NAV/share close to Fundrise's own reported $19, matching the figure most outside observers reference.</div>
        <div>• <strong>May 11, 2026 (morning update)</strong> — Updated default share count from 30.57M (estimate based on assumed post-listing ATM issuance) to 28.3M, per the Form 144 filed April 24, 2026 by Fundrise Real Estate Interval Fund. Removed the "Forward Dilution" section and the dynamic issuance-cash inputs entirely. The previous model incorrectly assumed Fundrise was conducting an at-the-market offering (ATM) that was adding cash to VCX's balance sheet and diluting per-share exposure to the underlying companies. EDGAR filings show no such primary issuance is occurring; the ~60,000 shares/day of public-market supply is instead coming from a Fundrise-affiliated entity liquidating shares it acquired in a pre-listing registered offering. This means per-share claims on Anthropic and other holdings are static, not decaying. The bear case rests on premium-to-NAV math and the September 2026 platform-investor lockup expiry rather than ongoing dilution. Default VCX market price updated from $158.98 to $240 to reflect more recent trading. Thanks to /u/CapAggravating784 on Reddit for the correction.</div>
        <div>• <strong>May 10, 2026</strong> — Initial publication.</div>
        <div style={{ marginTop: 16 }}><strong>Sources:</strong></div>
        <div>• Position data: Fundrise Innovation Fund, LLC — audited Annual Report for the fiscal year ended March 31, 2026 (Report of Independent Registered Public Accounting Firm, KPMG LLP, dated May 30, 2026), Schedule of Investments and Statement of Assets & Liabilities.</div>
        <div>• Share count: 35,797,138 shares outstanding, audited, per the Statement of Assets and Liabilities (3/31/26). Supersedes the prior cap-table reconstruction.</div>
        <div>• Supply mechanics: Daily public-market sales since the NYSE listing are largely attributable to Fundrise Real Estate Interval Fund's wholly-owned subsidiary (Tech Infrastructure REIT) liquidating shares it acquired in a February 24, 2026 registered offering. This is affiliate redistribution under Rule 144, not primary issuance by VCX.</div>
        <div>• Secondary-market price-per-share inputs: User-supplied, with defaults from Fundrise's 3/31/26 marks. Recommended sources for current pricing include Hiive, Caplight, Notice, and Forge Global.</div>
        <div>• NYSE listing: VCX began trading on the New York Stock Exchange on March 19, 2026.</div>
      </div>

      {/* STICKY SUMMARY BAR */}
      <div style={styles.stickyBar} className="vcx-sticky-bar">
        <div style={styles.stickyInner}>
          <div style={styles.stickyMetric}>
            <div style={styles.stickyLabel}>NAV / Share</div>
            <div style={styles.stickyValueAccent}>${calc.navPerShare.toFixed(2)}</div>
          </div>
          <div style={styles.stickyDivider} />
          <div style={styles.stickyMetric}>
            <div style={styles.stickyLabel}>Premium</div>
            <div style={{ ...styles.stickyValue, color: vcxPrice > calc.navPerShare ? "#fbbf24" : "#86efac" }}>
              {((vcxPrice / calc.navPerShare - 1) * 100).toFixed(0)}%
            </div>
          </div>
          <div style={styles.stickyDivider} />
          <div style={styles.stickyMetric}>
            <div style={styles.stickyLabel}>Price ÷ NAV</div>
            <div style={styles.stickyValue}>{(vcxPrice / calc.navPerShare).toFixed(2)}x</div>
          </div>
          <div style={styles.stickyDivider} />
          <div style={styles.stickyMetric}>
            <div style={styles.stickyLabel}>Total NAV</div>
            <div style={styles.stickyValue}>{fmt$(calc.totalNAV)}</div>
          </div>
          <div style={styles.stickyDivider} />
          <div style={styles.stickyMetric}>
            <div style={styles.stickyLabel}>VCX Price</div>
            <div style={styles.stickyValue}>${vcxPrice.toFixed(0)}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

const styles = {
  container: {
    fontFamily: "'Fraunces', Georgia, serif",
    background: "#fefdf8",
    color: "#1c1917",
    minHeight: "100vh",
    padding: "48px 56px 80px 56px",
    maxWidth: "1180px",
    margin: "0 auto",
    boxSizing: "border-box",
    overflowX: "hidden",
  },
  header: {
    borderBottom: "1px solid #1c1917",
    paddingBottom: "32px",
    marginBottom: "40px",
  },
  eyebrow: {
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: "11px",
    letterSpacing: "0.18em",
    color: "#78716c",
    marginBottom: "16px",
    fontWeight: 500,
  },
  title: {
    fontSize: "72px",
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
    fontSize: "16px",
    lineHeight: 1.55,
    color: "#44403c",
    maxWidth: "720px",
    margin: 0,
  },
  howToBox: {
    background: "#f5f5f4",
    border: "1px solid #d6d3d1",
    padding: "20px 24px",
    marginBottom: "32px",
  },
  howToTitle: {
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: "11px",
    letterSpacing: "0.15em",
    color: "#1c1917",
    textTransform: "uppercase",
    fontWeight: 600,
    marginBottom: "12px",
  },
  howToList: {
    margin: 0,
    paddingLeft: "20px",
    fontSize: "14px",
    lineHeight: 1.65,
    color: "#44403c",
    fontFamily: "'Fraunces', serif",
  },
  controls: {
    display: "flex",
    gap: "32px",
    alignItems: "flex-end",
    marginBottom: "20px",
    flexWrap: "wrap",
  },
  issuanceBox: {
    background: "#fef3c7",
    border: "1px solid #d97706",
    padding: "20px 24px",
    marginBottom: "40px",
  },
  issuanceHeader: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    marginBottom: "16px",
    color: "#92400e",
  },
  issuanceControls: {
    display: "flex",
    gap: "32px",
    flexWrap: "wrap",
    marginBottom: "12px",
  },
  issuanceMeta: {
    fontSize: "13px",
    fontFamily: "'Fraunces', serif",
    color: "#78350f",
    lineHeight: 1.55,
    paddingTop: "10px",
    borderTop: "1px solid rgba(217, 119, 6, 0.3)",
  },
  controlGroup: {
    display: "flex",
    gap: "10px",
    alignItems: "center",
  },
  label: {
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: "11px",
    letterSpacing: "0.1em",
    color: "#57534e",
    textTransform: "uppercase",
    fontWeight: 500,
  },
  smallInput: {
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: "16px",
    fontWeight: 600,
    border: "1px solid #1c1917",
    background: "#fefdf8",
    padding: "8px 12px",
    width: "100px",
    borderRadius: 0,
  },
  presetBtn: {
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: "11px",
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    background: "#fefdf8",
    color: "#78716c",
    border: "1px solid #d6d3d1",
    padding: "10px 16px",
    cursor: "pointer",
    fontWeight: 500,
    borderRadius: 0,
    display: "flex",
    alignItems: "center",
    gap: "6px",
    transition: "all 0.15s ease",
  },
  presetBtnActive: {
    background: "#1c1917",
    color: "#fef3c7",
    border: "1px solid #1c1917",
    fontWeight: 700,
  },
  activeDot: {
    width: "6px",
    height: "6px",
    borderRadius: "50%",
    background: "#d97706",
    flexShrink: 0,
  },
  customLabel: {
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: "10px",
    letterSpacing: "0.1em",
    textTransform: "uppercase",
    color: "#d97706",
    fontWeight: 600,
    fontStyle: "italic",
    padding: "10px 0",
  },
  section: {
    marginBottom: "40px",
  },
  sectionHeader: {
    display: "flex",
    alignItems: "baseline",
    gap: "16px",
    marginBottom: "16px",
    paddingBottom: "8px",
    borderBottom: "1px solid #d6d3d1",
  },
  sectionNum: {
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: "12px",
    color: "#d97706",
    fontWeight: 700,
    letterSpacing: "0.05em",
  },
  sectionTitle: {
    fontSize: "22px",
    fontWeight: 600,
    margin: 0,
    letterSpacing: "-0.01em",
  },
  sectionMeta: {
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: "11px",
    color: "#78716c",
    marginLeft: "auto",
    letterSpacing: "0.05em",
  },
  tableWrap: {
    border: "1px solid #1c1917",
  },
  tableHeaderRow: {
    display: "flex",
    background: "#1c1917",
    color: "#fef3c7",
    padding: "10px 16px",
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: "10px",
    letterSpacing: "0.1em",
    textTransform: "uppercase",
    fontWeight: 500,
  },
  th: {
    flex: 1,
  },
  tr: {
    display: "flex",
    padding: "14px 16px",
    borderBottom: "1px solid #e7e5e4",
    alignItems: "center",
    transition: "background 0.1s",
  },
  td: {
    fontSize: "14px",
  },
  companyName: {
    fontSize: "16px",
    fontWeight: 600,
    fontFamily: "'Fraunces', serif",
  },
  companyNote: {
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: "11px",
    color: "#78716c",
    marginTop: "2px",
  },
  ppsInput: {
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: "15px",
    fontWeight: 600,
    border: "1px solid #d6d3d1",
    background: "#fefdf8",
    padding: "6px 10px",
    width: "100px",
    textAlign: "right",
    borderRadius: 0,
  },
  moicInput: {
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: "14px",
    fontWeight: 600,
    border: "1px solid #d6d3d1",
    background: "#fefdf8",
    padding: "6px 8px",
    width: "60px",
    textAlign: "right",
    borderRadius: 0,
    color: "#d97706",
  },
  delta: {
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: "10px",
    marginTop: "3px",
    fontWeight: 500,
  },
  subtotalRow: {
    display: "flex",
    padding: "14px 16px",
    background: "#f5f5f4",
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: "12px",
    fontWeight: 600,
    letterSpacing: "0.05em",
    textTransform: "uppercase",
    alignItems: "center",
    color: "#1c1917",
  },
  callout: {
    marginTop: "12px",
    padding: "14px 18px",
    background: "#fef3c7",
    borderLeft: "3px solid #d97706",
    fontSize: "14px",
    lineHeight: 1.5,
    fontFamily: "'Fraunces', serif",
    color: "#451a03",
  },
  dilutionBox: {
    marginTop: "48px",
    paddingTop: "32px",
    borderTop: "1px solid #d6d3d1",
  },
  dilutionTable: {
    border: "1px solid #1c1917",
    background: "#fefdf8",
  },
  dilutionRow: {
    display: "flex",
    padding: "12px 16px",
    borderBottom: "1px solid #e7e5e4",
    alignItems: "center",
    fontSize: "14px",
    fontFamily: "'Fraunces', serif",
  },
  dilutionHeader: {
    background: "#1c1917",
    color: "#fef3c7",
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: "10px",
    letterSpacing: "0.1em",
    textTransform: "uppercase",
    fontWeight: 500,
  },
  grandTotal: {
    background: "#1c1917",
    color: "#fef3c7",
    padding: "40px 48px",
    marginTop: "48px",
    position: "relative",
  },
  gtLabel: {
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: "11px",
    letterSpacing: "0.18em",
    color: "#a8a29e",
    fontWeight: 500,
    marginBottom: "8px",
  },
  gtValue: {
    fontSize: "48px",
    fontWeight: 700,
    fontFamily: "'Fraunces', serif",
    letterSpacing: "-0.02em",
    fontVariantNumeric: "tabular-nums",
    marginBottom: "24px",
  },
  gtValueAccent: {
    fontSize: "72px",
    fontWeight: 800,
    fontFamily: "'Fraunces', serif",
    letterSpacing: "-0.03em",
    color: "#fbbf24",
    fontStyle: "italic",
    fontVariantNumeric: "tabular-nums",
    lineHeight: 1,
    marginBottom: "16px",
  },
  gtDivider: {
    height: "1px",
    background: "#44403c",
    margin: "24px 0",
  },
  gtMeta: {
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: "11px",
    color: "#a8a29e",
    letterSpacing: "0.03em",
    lineHeight: 1.6,
  },
  footer: {
    marginTop: "32px",
    paddingTop: "24px",
    borderTop: "1px solid #d6d3d1",
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: "10px",
    color: "#78716c",
    letterSpacing: "0.03em",
    lineHeight: 1.7,
  },
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
    maxWidth: "1180px",
    margin: "0 auto",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "0",
    padding: "10px 0",
  },
  stickyMetric: {
    padding: "0 24px",
    textAlign: "center",
    flexShrink: 0,
  },
  stickyLabel: {
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: "9px",
    letterSpacing: "0.15em",
    textTransform: "uppercase",
    color: "#78716c",
    fontWeight: 500,
    marginBottom: "2px",
  },
  stickyValue: {
    fontFamily: "'Fraunces', serif",
    fontSize: "18px",
    fontWeight: 700,
    color: "#fef3c7",
    fontVariantNumeric: "tabular-nums",
    letterSpacing: "-0.01em",
  },
  stickyValueAccent: {
    fontFamily: "'Fraunces', serif",
    fontSize: "20px",
    fontWeight: 800,
    color: "#fbbf24",
    fontStyle: "italic",
    fontVariantNumeric: "tabular-nums",
    letterSpacing: "-0.02em",
  },
  stickyDivider: {
    width: "1px",
    height: "28px",
    background: "#44403c",
    flexShrink: 0,
  },
};
