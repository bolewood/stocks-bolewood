"use client";

import React, { useState, useMemo, useEffect } from "react";
import {
  FILED,
  PROSPECTUS_424B5,
  calibrate,
  computeAtmBridge,
} from "../lib/dxyzAtm.mjs";
import historySnapshot from "../app/api/dxyz-history/snapshot.json";

// DXYZ NAV Finder
// Source: Destiny Tech100 SEC filings (N-CSR 12/31/2025, NPORT-P 3/31/2026,
// 424B3 05/12/2026, 424B5 05/26/2026)
// Share counts from 12/31/2025 where available. March 31, 2026 defaults are tied
// to the filed $742.5M portfolio value plus $5.9M other net assets, reconciling
// to $748.36M filed net assets (NPORT-P).

const DXYZ_PORTFOLIO_VALUE_K = 742_500; // March 31, 2026 portfolio value from 424B3
const DXYZ_OTHER_NET_ASSETS_K = 5_861; // filed net assets $748.361M − $742.5M portfolio
const DXYZ_SHARES_OUTSTANDING_M = 30.47; // implied by $748.361M filed net assets / $24.56 NAV per share
const pctValueK = (pct) => Math.round(DXYZ_PORTFOLIO_VALUE_K * pct / 100);

// Positions where we have a clean underlying share count from the 12/31/2025 N-CSR.
// share_count is in THOUSANDS.
const SHARE_DENOMINATED = [
  {
    name: "SpaceX",
    shares_k: 177.992, // DXYZ SpaceX I (135,135) + MWAM VC SpaceX-II (42,857)
    mark_pps_1231: 517.27, // 12.4% of March 31, 2026 portfolio value / known shares
    note: "DXYZ SpaceX I + MWAM VC SpaceX-II SPVs",
  },
  {
    name: "Revolut",
    shares_k: 8.200,
    mark_pps_1231: 1448.78,
    note: "Common Stock (1.6% March 31 weighting)",
  },
  {
    name: "Discord",
    shares_k: 2.380, // 1,311 Series G + 1,069 Common
    mark_pps_1231: 277.66,
    note: "Series G + Common (<0.1% March 31 weighting)",
  },
  {
    name: "Klarna",
    shares_k: 36.924,
    mark_pps_1231: 20.11,
    note: "Common Stock (0.1% March 31 weighting)",
  },
  {
    name: "Chime",
    shares_k: 60.250,
    mark_pps_1231: 24.65,
    note: "Common Stock (0.2% March 31 weighting)",
  },
  {
    name: "Flexport",
    shares_k: 26.000,
    mark_pps_1231: 3.14,
    note: "Common Stock (<0.1% March 31 weighting)",
  },
];

// Implied values based on March 31, 2026 percentages of $742.5M filed portfolio value.
// Value is in thousands.
const DOLLAR_DENOMINATED = [
  { name: "Anthropic", value_k: pctValueK(18.1), note: "18.1% weighting (Magnitude ANC III SPV)" },
  { name: "OpenAI", value_k: pctValueK(5.7), note: "5.7% weighting (DXYZ OAI I + Goanna Capital SPVs)" },
  { name: "OpenEvidence", value_k: pctValueK(4.6), note: "4.6% weighting (SP21Z Opportunities SPV)" },
  { name: "Shield AI", value_k: pctValueK(4.2), note: "4.2% weighting (Snowpoint Growth 2.5 SPV)" },
  { name: "Databricks", value_k: pctValueK(2.5), note: "2.5% weighting (DA-1125 + MCTC SPVs)" },
  { name: "CHAOS Industries", value_k: pctValueK(2.1), note: "2.1% weighting" },
  { name: "Hermeus", value_k: pctValueK(2.0), note: "2.0% weighting" },
  { name: "Beast Industries", value_k: pctValueK(2.0), note: "2.0% weighting" },
  { name: "SpaceX (Snowpoint SPV)", value_k: pctValueK(2.0), note: "2.0% weighting; no disclosed share count" },
  { name: "Tenstorrent", value_k: pctValueK(1.7), note: "1.7% weighting" },
  { name: "General Intuition", value_k: pctValueK(1.5), note: "1.5% weighting" },
  { name: "Skild AI", value_k: pctValueK(1.4), note: "1.4% weighting" },
];

const OTHER_HOLDINGS = [
  { name: "Cash & Cash Equivalents", value_k: pctValueK(31.4), locked: true, note: "31.4% First American Treasury Obligations weighting" },
  { name: "Long Tail Private Holdings", value_k: 47520, note: "~6.4% residual to reconcile filed $742.5M portfolio value" },
  { name: "Other Net Assets", value_k: DXYZ_OTHER_NET_ASSETS_K, locked: true, note: "Receivables less liabilities — reconciles $742.5M portfolio to $748.36M filed net assets (3/31/26 NPORT-P)" },
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

const fmtM = (n) => `${(n / 1_000_000).toFixed(2)}M`;

const CONF_COLORS = {
  FILED: { color: "#15803d", background: "#f0fdf4", border: "#15803d" },
  INFERRED: { color: "#b45309", background: "#fffbeb", border: "#d97706" },
  ESTIMATED: { color: "#57534e", background: "#f5f5f4", border: "#78716c" },
};

function ConfBadge({ level }) {
  const c = CONF_COLORS[level] || CONF_COLORS.ESTIMATED;
  return (
    <span style={{
      fontSize: "9px",
      fontFamily: "'JetBrains Mono', monospace",
      letterSpacing: "0.08em",
      padding: "2px 6px",
      borderRadius: "3px",
      border: `1px solid ${c.border}`,
      color: c.color,
      background: c.background,
      fontWeight: 600,
      whiteSpace: "nowrap",
    }}>
      {level}
    </span>
  );
}

export default function DXYZNAVFinder() {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 720);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  const [activeScenario, setActiveScenario] = useState("mark");

  const [ppsOverrides, setPpsOverrides] = useState(
    SHARE_DENOMINATED.reduce((acc, p) => ({ ...acc, [p.name]: p.mark_pps_1231 }), {})
  );
  const [dxyzShares, setDxyzShares] = useState(DXYZ_SHARES_OUTSTANDING_M);
  const [dxyzPrice, setDxyzPrice] = useState(27.6);
  const [priceSource, setPriceSource] = useState("default");

  // ── ATM Issuance Bridge state ──────────────────────────────────────────
  // Ships with the checked-in snapshot so first paint is deterministic;
  // replaced by the live Yahoo feed once /api/dxyz-history responds.
  const [historyRows, setHistoryRows] = useState(historySnapshot.rows);
  const [historySource, setHistorySource] = useState("snapshot");
  const [atmMode, setAtmMode] = useState("calibrated"); // "filed" | "calibrated" | "custom"
  const [commissionPct, setCommissionPct] = useState("0.5");
  // Custom-mode overrides; empty string = use the calibrated default.
  const [atmCustom, setAtmCustom] = useState({
    aprSharesM: "",
    aprPrice: "",
    partPct: "",
    capacityM: "",
    premPct: "",
    dragPct: "",
    asOf: "",
  });

  const [dollarMOICs, setDollarMOICs] = useState(
    DOLLAR_DENOMINATED.reduce((acc, p) => ({ ...acc, [p.name]: 1.0 }), {})
  );
  const [otherMOICs, setOtherMOICs] = useState(
    OTHER_HOLDINGS.reduce((acc, p) => ({ ...acc, [p.name]: 1.0 }), {})
  );

  const updatePPS = (name, val) => {
    setPpsOverrides((prev) => ({ ...prev, [name]: val }));
    setActiveScenario(null);
  };

  const updateDollarMOIC = (name, val) => {
    setDollarMOICs((prev) => ({ ...prev, [name]: val }));
    setActiveScenario(null);
  };

  const updateOtherMOIC = (name, val) => {
    setOtherMOICs((prev) => ({ ...prev, [name]: val }));
    setActiveScenario(null);
  };

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
      SHARE_DENOMINATED.reduce((acc, p) => ({ ...acc, [p.name]: p.mark_pps_1231 }), {})
    );
    setDollarMOICs(DOLLAR_DENOMINATED.reduce((acc, p) => ({ ...acc, [p.name]: 1.0 }), {}));
    setOtherMOICs(OTHER_HOLDINGS.reduce((acc, p) => ({ ...acc, [p.name]: 1.0 }), {}));
    setActiveScenario("mark");
    updateURL("mark");
  };

  const applyAggressive = () => {
    setPpsOverrides({
      "SpaceX": 710,
      "Revolut": 2000,
      "Discord": 400,
      "Klarna": 45,
      "Chime": 35,
      "Flexport": 5,
    });
    setDollarMOICs({
      "Anthropic": 2.0,
      "OpenAI": 2.0,
      "OpenEvidence": 2.0,
      "Shield AI": 1.5,
      "Databricks": 1.5,
      "CHAOS Industries": 1.5,
      "Hermeus": 1.5,
      "Beast Industries": 1.5,
      "Tenstorrent": 1.5,
      "General Intuition": 1.5,
    });
    setOtherMOICs(OTHER_HOLDINGS.reduce((acc, p) => ({ ...acc, [p.name]: 1.0 }), {}));
    setActiveScenario("aggressive");
    updateURL("aggressive");
  };

  const applyDream = () => {
    setPpsOverrides({
      "SpaceX": 1420,
      "Revolut": 3000,
      "Discord": 800,
      "Klarna": 90,
      "Chime": 70,
      "Flexport": 10,
    });
    setDollarMOICs({
      "Anthropic": 4.0,
      "OpenAI": 4.0,
      "OpenEvidence": 4.0,
      "Shield AI": 3.0,
      "Databricks": 3.0,
      "CHAOS Industries": 3.0,
      "Hermeus": 3.0,
      "Beast Industries": 3.0,
      "Tenstorrent": 3.0,
      "General Intuition": 3.0,
    });
    setOtherMOICs(OTHER_HOLDINGS.reduce((acc, p) => ({ ...acc, [p.name]: 1.0 }), {}));
    setActiveScenario("dream");
    updateURL("dream");
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const scenario = params.get("scenario");
    if (scenario === "aggressive") {
      applyAggressive();
    } else if (scenario === "dream") {
      applyDream();
    }

    fetch("/api/prices")
      .then((res) => res.json())
      .then((data) => {
        if (data.prices?.DXYZ) setDxyzPrice(data.prices.DXYZ);
        setPriceSource(data.source || "fallback");
      })
      .catch(() => setPriceSource("fallback"));

    fetch("/api/dxyz-history")
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data.rows) && data.rows.length > 0) {
          setHistoryRows(data.rows);
          setHistorySource(data.source || "snapshot");
        }
      })
      .catch(() => setHistorySource("snapshot"));
  }, []);

  const calc = useMemo(() => {
    const shareRows = SHARE_DENOMINATED.map((p) => {
      const pps = parseFloat(ppsOverrides[p.name]) || 0;
      const positionValue = pps * p.shares_k * 1000;
      const navPerShare = positionValue / (dxyzShares * 1_000_000);
      return { ...p, pps, positionValue, navPerShare };
    });

    const dollarRows = DOLLAR_DENOMINATED.map((p) => {
      const moic = parseFloat(dollarMOICs[p.name]) || 0;
      const positionValue = p.value_k * 1000 * moic;
      return {
        ...p,
        moic,
        markValue: p.value_k * 1000,
        positionValue,
        navPerShare: positionValue / (dxyzShares * 1_000_000),
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
        navPerShare: positionValue / (dxyzShares * 1_000_000),
      };
    });

    const shareTotal = shareRows.reduce((s, r) => s + r.positionValue, 0);
    const dollarTotal = dollarRows.reduce((s, r) => s + r.positionValue, 0);
    const otherTotal = otherRows.reduce((s, r) => s + r.positionValue, 0);
    const totalNAV = shareTotal + dollarTotal + otherTotal;
    const navPerShare = totalNAV / (dxyzShares * 1_000_000);

    return { shareRows, dollarRows, otherRows, shareTotal, dollarTotal, otherTotal, totalNAV, navPerShare };
  }, [ppsOverrides, dxyzShares, dollarMOICs, otherMOICs]);

  // ── ATM Issuance Bridge math ───────────────────────────────────────────
  const atmCal = useMemo(() => calibrate(historyRows), [historyRows]);

  const num = (s) => {
    const v = parseFloat(s);
    return Number.isFinite(v) ? v : null;
  };

  const atmBridge = useMemo(() => {
    const commission = num(commissionPct);
    const opts = {
      mode: atmMode,
      rows: historyRows,
      markedNetAssets: calc.totalNAV,
      baselineShares: dxyzShares * 1_000_000,
      commissionRate: (commission ?? 0.5) / 100,
    };
    if (atmMode === "custom") {
      const s = num(atmCustom.aprSharesM);
      if (s !== null) opts.aprMayShares = s * 1_000_000;
      const p = num(atmCustom.aprPrice);
      if (p !== null) opts.aprMayAvgPrice = p;
      const part = num(atmCustom.partPct);
      if (part !== null) opts.participation = part / 100;
      const cap = num(atmCustom.capacityM);
      if (cap !== null) opts.capacityGross = cap * 1_000_000;
      const prem = num(atmCustom.premPct);
      if (prem !== null) opts.minPremium = prem / 100;
      const drag = num(atmCustom.dragPct);
      if (drag !== null) opts.expenseDragAnnualRate = drag / 100;
      if (atmCustom.asOf) opts.asOfDate = atmCustom.asOf;
    }
    return computeAtmBridge(opts);
  }, [atmMode, historyRows, calc.totalNAV, dxyzShares, commissionPct, atmCustom]);

  // Low / base / high participation sensitivity (post-May-26 program)
  const atmSensitivity = useMemo(() => {
    if (atmMode === "filed") return [];
    const commission = ((num(commissionPct) ?? 0.5)) / 100;
    return [
      { label: "Low", participation: 0.05 },
      { label: "Calibrated", participation: atmCal.participation },
      { label: "High", participation: 0.10 },
    ].map(({ label, participation }) => ({
      label,
      participation,
      bridge: computeAtmBridge({
        mode: "calibrated",
        rows: historyRows,
        markedNetAssets: calc.totalNAV,
        baselineShares: dxyzShares * 1_000_000,
        commissionRate: commission,
        participation,
      }),
    }));
  }, [atmMode, historyRows, calc.totalNAV, dxyzShares, commissionPct, atmCal]);

  // Headline NAV: pro forma when the bridge is active, marked baseline otherwise.
  const effectiveNav = atmBridge.proFormaNav;
  const effectiveShares = atmBridge.proFormaShares;
  const bridgeActive = atmMode !== "filed";

  return (
    <div style={styles.container} className="vcx-container">
      <div style={styles.header}>
        <div style={styles.eyebrow} className="vcx-eyebrow">DESTINY TECH100 · NYSE: DXYZ · ESTIMATED NAV CALCULATOR</div>
        <h1 style={styles.title} className="vcx-title">
          DXYZ <span style={styles.titleAccent}>NAV Finder</span>
        </h1>
        <p style={styles.subtitle} className="vcx-subtitle">
          DXYZ is a closed-end fund providing access to top private technology companies (Anthropic, SpaceX, OpenAI, etc.). This tool lets you estimate its true Net Asset Value per share by marking its underlying holdings to current secondary market prices or applying multipliers to its SPV-held stakes.
        </p>
      </div>

      <div style={styles.howToBox}>
        <div style={styles.howToTitle}>How this works</div>
        <ol style={styles.howToList}>
          <li style={{ marginBottom: 6 }}>The fund holds shares directly (Box 1) and through SPVs (Box 2). </li>
          <li style={{ marginBottom: 6 }}>Update price-per-share for Box 1 and MOIC (Multiple on Invested Capital) for Box 2.</li>
          <li style={{ marginBottom: 6 }}>Defaults are tied to the March 31, 2026 NAV filing and use December 31, 2025 share counts where the newer filing only discloses portfolio weights.</li>
          <li>The bottom bar shows the implied premium vs. the current DXYZ market price.</li>
        </ol>
      </div>

      <div style={styles.controls} className="vcx-controls">
        <div style={styles.controlGroup}>
          <label style={styles.label}>DXYZ Shares Outstanding (M)</label>
          <input
            type="number"
            step="0.01"
            value={dxyzShares}
            onChange={(e) => setDxyzShares(parseFloat(e.target.value) || 0)}
            style={styles.smallInput}
            className="vcx-input vcx-small-input"
          />
        </div>
        <div style={styles.controlGroup}>
          <label style={styles.label}>DXYZ Market Price ($)</label>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <input
              type="number"
              step="0.01"
              value={dxyzPrice}
              onChange={(e) => { setDxyzPrice(parseFloat(e.target.value) || 0); setPriceSource("manual"); }}
              style={styles.smallInput}
              className="vcx-input vcx-small-input"
            />
            <span style={{
              fontSize: "10px",
              fontFamily: "monospace",
              padding: "2px 6px",
              borderRadius: "3px",
              border: `1px solid ${priceSource === "live" || priceSource === "cache" ? "#15803d" : priceSource === "partial" ? "#d97706" : "#78716c"}`,
              color: priceSource === "live" || priceSource === "cache" ? "#15803d" : priceSource === "partial" ? "#d97706" : "#78716c",
              background: priceSource === "live" || priceSource === "cache" ? "#f0fdf4" : priceSource === "partial" ? "#fffbeb" : "transparent"
            }}>
              {priceSource === "live" || priceSource === "cache" ? "● LIVE" : priceSource === "partial" ? "◐ PARTIAL" : priceSource === "manual" ? "● MANUAL" : priceSource === "fallback" ? "○ FALLBACK" : "○ DEFAULT"}
            </span>
          </div>
        </div>
        <div style={styles.controlGroup}>
          {[
            { key: "mark", label: "Baseline / 3/31/26 NAV", handler: resetToMark },
            { key: "aggressive", label: "Aggressive", handler: applyAggressive },
            { key: "dream", label: "Dream Scenario", handler: applyDream },
          ].map(({ key, label, handler }) => {
            const isActive = activeScenario === key;
            return (
              <button
                key={key}
                onClick={handler}
                style={{
                  ...styles.presetBtn,
                  ...(isActive ? styles.presetBtnActive : {}),
                  ...(key === "dream" && !isActive ? { border: "1px solid #d97706", color: "#d97706" } : {}),
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

      <div style={styles.section}>
        <div style={styles.sectionHeader} className="vcx-section-header">
          <span style={styles.sectionNum}>⇄</span>
          <h2 style={{ ...styles.sectionTitle, fontSize: "20px" }}>ATM Issuance Bridge</h2>
          <span style={styles.sectionMeta} className="vcx-section-meta">Estimated share issuance since the March 31 filing</span>
        </div>

        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginBottom: "12px" }} className="vcx-controls">
          {[
            { key: "filed", label: "Filed Only" },
            { key: "calibrated", label: "Calibrated Estimate" },
            { key: "custom", label: "Custom" },
          ].map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setAtmMode(key)}
              style={{ ...styles.presetBtn, ...(atmMode === key ? styles.presetBtnActive : {}) }}
              className="preset-btn vcx-preset-btn"
            >
              {atmMode === key && <span style={styles.activeDot} />}
              {label}
            </button>
          ))}
        </div>

        {bridgeActive && (
          <div style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: "11px",
            fontWeight: 700,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: "#92400e",
            background: "#fef3c7",
            border: "1px solid #d97706",
            padding: "10px 14px",
            marginBottom: "12px",
          }}>
            ⚠ Estimated, not company reported — DXYZ&apos;s last filed NAV is ${FILED.navPerShare.toFixed(2)} as of March 31, 2026
          </div>
        )}

        <div style={styles.tableWrap}>
          <div style={styles.tr} className="vcx-row">
            <div style={{ ...styles.td, flex: "2.4" }}>
              <div style={styles.companyName}>Filed NAV — March 31, 2026 <ConfBadge level="FILED" /></div>
              <div style={styles.companyNote}>NPORT-P: $748.36M net assets; ~30.47M shares implied by the filed $24.56 NAV</div>
            </div>
            <div style={{ ...styles.td, flex: "1.3", textAlign: "right", fontVariantNumeric: "tabular-nums" }} data-label="Shares">{fmtM(FILED.netAssets / FILED.navPerShare)}</div>
            <div style={{ ...styles.td, flex: "1.5", textAlign: "right", fontVariantNumeric: "tabular-nums" }} data-label="Net Assets">{fmt$(FILED.netAssets)}</div>
            <div style={{ ...styles.td, flex: "1.2", textAlign: "right", fontVariantNumeric: "tabular-nums", fontWeight: 600 }} data-label="NAV/Share">${FILED.navPerShare.toFixed(2)}</div>
          </div>

          {(Math.abs(atmBridge.markedNav - FILED.navPerShare) > 0.005 || Math.abs(dxyzShares - DXYZ_SHARES_OUTSTANDING_M) > 0.005) && (
            <div style={styles.tr} className="vcx-row">
              <div style={{ ...styles.td, flex: "2.4" }}>
                <div style={styles.companyName}>Your re-marked baseline <ConfBadge level="ESTIMATED" /></div>
                <div style={styles.companyNote}>Your holding marks and share count from the tables below — replaces the filed baseline in this bridge</div>
              </div>
              <div style={{ ...styles.td, flex: "1.3", textAlign: "right", fontVariantNumeric: "tabular-nums" }} data-label="Shares">{fmtM(1_000_000 * dxyzShares)}</div>
              <div style={{ ...styles.td, flex: "1.5", textAlign: "right", fontVariantNumeric: "tabular-nums" }} data-label="Net Assets">{fmt$(calc.totalNAV)}</div>
              <div style={{ ...styles.td, flex: "1.2", textAlign: "right", fontVariantNumeric: "tabular-nums", fontWeight: 600 }} data-label="NAV/Share">${atmBridge.markedNav.toFixed(2)}</div>
            </div>
          )}

          {bridgeActive && (
            <>
              <div style={styles.tr} className="vcx-row">
                <div style={{ ...styles.td, flex: "2.4" }}>
                  <div style={styles.companyName}>+ Apr 1 – May 21 ATM (prior program) <ConfBadge level="INFERRED" /></div>
                  <div style={styles.companyNote}>
                    Backed out of the 424B5 share count: {fmtM(atmBridge.aprMay.shares)} shares @ ~${atmBridge.aprMay.avgPrice.toFixed(2)} close-volume-weighted
                  </div>
                </div>
                <div style={{ ...styles.td, flex: "1.3", textAlign: "right", fontVariantNumeric: "tabular-nums" }} data-label="Shares">+{fmtM(atmBridge.aprMay.shares)}</div>
                <div style={{ ...styles.td, flex: "1.5", textAlign: "right", fontVariantNumeric: "tabular-nums" }} data-label="Net Proceeds">+{fmt$(atmBridge.aprMay.net)}</div>
                <div style={{ ...styles.td, flex: "1.2", textAlign: "right" }} data-label="NAV/Share" />
              </div>

              <div style={styles.tr} className="vcx-row">
                <div style={{ ...styles.td, flex: "2.4" }}>
                  <div style={styles.companyName}>+ May 26 – {atmBridge.asOfDate} ATM (new $1B program) <ConfBadge level="ESTIMATED" /></div>
                  <div style={styles.companyNote}>
                    {(atmBridge.participation * 100).toFixed(1)}% of daily volume; issued {atmBridge.postMay.daysIssued} of {atmBridge.postMay.daysIssued + atmBridge.postMay.daysSkipped} days (none when price ≤ rolling NAV{atmBridge.postMay.exhaustedOn ? `; capacity exhausted ${atmBridge.postMay.exhaustedOn}` : ""})
                  </div>
                </div>
                <div style={{ ...styles.td, flex: "1.3", textAlign: "right", fontVariantNumeric: "tabular-nums" }} data-label="Shares">+{fmtM(atmBridge.postMay.shares)}</div>
                <div style={{ ...styles.td, flex: "1.5", textAlign: "right", fontVariantNumeric: "tabular-nums" }} data-label="Net Proceeds">+{fmt$(atmBridge.postMay.net)}</div>
                <div style={{ ...styles.td, flex: "1.2", textAlign: "right" }} data-label="NAV/Share" />
              </div>

              <div style={styles.tr} className="vcx-row">
                <div style={{ ...styles.td, flex: "2.4" }}>
                  <div style={styles.companyName}>− Expense accrual <ConfBadge level="ESTIMATED" /></div>
                  <div style={styles.companyNote}>2.50% management fee (424B5) annualized over {atmBridge.days} days since March 31</div>
                </div>
                <div style={{ ...styles.td, flex: "1.3", textAlign: "right" }} data-label="Shares">—</div>
                <div style={{ ...styles.td, flex: "1.5", textAlign: "right", fontVariantNumeric: "tabular-nums" }} data-label="Net Proceeds">−{fmt$(atmBridge.drag)}</div>
                <div style={{ ...styles.td, flex: "1.2", textAlign: "right" }} data-label="NAV/Share" />
              </div>
            </>
          )}

          <div style={{ ...styles.subtotalRow, background: "#1c1917", color: "#fef3c7" }} className="vcx-subtotal">
            <div style={{ flex: "2.4" }}>
              {bridgeActive ? `= Pro forma (est. ${atmBridge.asOfDate})` : "= Filed baseline (no estimated issuance)"}
            </div>
            <div style={{ flex: "1.3", textAlign: "right", fontVariantNumeric: "tabular-nums" }} data-label="Shares">{fmtM(atmBridge.proFormaShares)}</div>
            <div style={{ flex: "1.5", textAlign: "right", fontVariantNumeric: "tabular-nums" }} data-label="Net Assets">{fmt$(atmBridge.proFormaAssets)}</div>
            <div style={{ flex: "1.2", textAlign: "right", fontVariantNumeric: "tabular-nums", color: "#fbbf24", fontWeight: 700 }} data-label="NAV/Share">${atmBridge.proFormaNav.toFixed(2)}</div>
          </div>
        </div>

        {bridgeActive && (
          <div style={{
            display: "flex",
            gap: "24px",
            flexWrap: "wrap",
            marginTop: "10px",
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: "11px",
            color: "#57534e",
          }}>
            <span>ATM accretion: <strong style={{ color: atmBridge.accretionPerShare >= 0 ? "#15803d" : "#b91c1c" }}>{atmBridge.accretionPerShare >= 0 ? "+" : ""}${atmBridge.accretionPerShare.toFixed(2)}/sh</strong></span>
            <span>Remaining new-ATM capacity: <strong>{fmt$(atmBridge.postMay.capacityRemaining)}</strong> of {fmt$(PROSPECTUS_424B5.capacityGross)} gross</span>
            <span>History: {historyRows.length} trading days ·{" "}
              <span style={{ color: historySource === "live" || historySource === "cache" ? "#15803d" : "#78716c" }}>
                {historySource === "live" || historySource === "cache" ? "● LIVE (Yahoo)" : "○ SNAPSHOT (7/9/26)"}
              </span>
            </span>
          </div>
        )}

        {bridgeActive && (
          <div style={{ display: "flex", gap: "20px", alignItems: "flex-end", flexWrap: "wrap", marginTop: "16px" }} className="vcx-controls">
            <div style={styles.controlGroup}>
              <label style={styles.label}>Commission (%)</label>
              <input
                type="number" step="0.1" min="0" max="3"
                value={commissionPct}
                onChange={(e) => setCommissionPct(e.target.value)}
                style={{ ...styles.smallInput, width: "90px", fontSize: "14px" }}
                className="vcx-input vcx-small-input"
              />
              <div style={{ fontSize: "10px", color: "#78716c", fontFamily: "'JetBrains Mono', monospace", marginTop: "4px" }}>
                Cap 3.0%; filed Q1 implies ~0.02% effective
              </div>
            </div>
            {atmMode === "custom" && (
              <>
                {[
                  { key: "aprSharesM", label: "Apr–May Shares (M)", ph: fmtM(atmCal.aprMayShares).replace("M", "") },
                  { key: "aprPrice", label: "Apr–May Avg Price ($)", ph: atmCal.aprMayAvgPrice.toFixed(2) },
                  { key: "partPct", label: "Participation (%)", ph: (atmCal.participation * 100).toFixed(1) },
                  { key: "capacityM", label: "ATM Capacity ($M)", ph: "1000" },
                  { key: "premPct", label: "Min Premium (%)", ph: "0" },
                  { key: "dragPct", label: "Expense Drag (%/yr)", ph: "2.5" },
                ].map(({ key, label, ph }) => (
                  <div style={styles.controlGroup} key={key}>
                    <label style={styles.label}>{label}</label>
                    <input
                      type="number" step="any"
                      value={atmCustom[key]}
                      placeholder={ph}
                      onChange={(e) => setAtmCustom((prev) => ({ ...prev, [key]: e.target.value }))}
                      style={{ ...styles.smallInput, width: "110px", fontSize: "14px" }}
                      className="vcx-input vcx-small-input"
                    />
                  </div>
                ))}
                <div style={styles.controlGroup}>
                  <label style={styles.label}>As-of Date</label>
                  <input
                    type="date"
                    min="2026-05-26"
                    value={atmCustom.asOf}
                    onChange={(e) => setAtmCustom((prev) => ({ ...prev, asOf: e.target.value }))}
                    style={{ ...styles.smallInput, width: "160px", fontSize: "13px" }}
                    className="vcx-input vcx-small-input"
                  />
                </div>
              </>
            )}
          </div>
        )}

        {bridgeActive && atmSensitivity.length > 0 && (
          <div style={{ ...styles.tableWrap, marginTop: "16px" }}>
            <div style={styles.tableHeaderRow} className="vcx-table-header">
              <div style={{ ...styles.th, flex: "1.6" }}>Participation Scenario</div>
              <div style={{ ...styles.th, flex: "1.2", textAlign: "right" }}>Post-5/26 Shares</div>
              <div style={{ ...styles.th, flex: "1.2", textAlign: "right" }}>Gross Raised</div>
              <div style={{ ...styles.th, flex: "1.2", textAlign: "right" }}>Pro Forma NAV</div>
            </div>
            {atmSensitivity.map(({ label, participation, bridge }) => (
              <div key={label} style={{ ...styles.tr, ...(label === "Calibrated" ? { background: "#fffbeb" } : {}) }} className="vcx-row">
                <div style={{ ...styles.td, flex: "1.6" }}>
                  <div style={styles.companyName}>{label} — {(participation * 100).toFixed(1)}%</div>
                </div>
                <div style={{ ...styles.td, flex: "1.2", textAlign: "right", fontVariantNumeric: "tabular-nums" }} data-label="Post-5/26 Shares">{fmtM(bridge.postMay.shares)}</div>
                <div style={{ ...styles.td, flex: "1.2", textAlign: "right", fontVariantNumeric: "tabular-nums" }} data-label="Gross Raised">{fmt$(bridge.postMay.gross)}</div>
                <div style={{ ...styles.td, flex: "1.2", textAlign: "right", fontVariantNumeric: "tabular-nums", fontWeight: 600, color: "#d97706" }} data-label="Pro Forma NAV">${bridge.proFormaNav.toFixed(2)}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={styles.issuanceBox}>
        <div style={styles.issuanceHeader}>
          <span style={styles.sectionNum}>ⓘ</span>
          <h3 style={{ ...styles.sectionTitle, fontSize: "16px", margin: 0 }}>Note on Holding Data</h3>
        </div>
        <div style={styles.issuanceMeta}>
          Because Destiny Tech100 acquires many of its largest stakes (e.g. Anthropic, OpenAI) through Special Purpose Vehicles (SPVs), exact per-share counts are not fully available in public EDGAR filings. The baseline reconciles to DXYZ&apos;s March 31, 2026 NPORT-P: $742.5M portfolio value plus $5.9M other net assets equals $748.36M filed net assets, which at the filed $24.56 NAV per share implies ~30.47M shares outstanding. Share-denominated holdings use December 31, 2025 counts where available and March 31, 2026 portfolio weights for the baseline marks. Issuance after March 31 is modeled separately in the ATM Issuance Bridge above and never restates these filed figures.
        </div>
      </div>

      <div style={styles.section}>
        <div style={styles.sectionHeader} className="vcx-section-header">
          <span style={styles.sectionNum}>01</span>
          <h2 style={styles.sectionTitle}>Positions with known share counts</h2>
          <span style={styles.sectionMeta} className="vcx-section-meta">Edit PPS to mark each position to current market</span>
        </div>

        <div style={styles.tableWrap}>
          <div style={styles.tableHeaderRow} className="vcx-table-header">
            <div style={{ ...styles.th, flex: "2.2" }}>Company</div>
            <div style={{ ...styles.th, flex: "1.2", textAlign: "right" }}>Shares (K)</div>
            <div style={{ ...styles.th, flex: "1.4", textAlign: "right" }}>Your PPS ($)</div>
            <div style={{ ...styles.th, flex: "1.4", textAlign: "right" }}>Position Value</div>
            <div style={{ ...styles.th, flex: "1.2", textAlign: "right" }}>$/DXYZ share</div>
            <div style={{ ...styles.th, flex: "1.0", textAlign: "right" }}>¢ per $1</div>
          </div>

          {calc.shareRows.map((r) => {
            const delta = ((r.pps - r.mark_pps_1231) / r.mark_pps_1231) * 100;
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
                <div style={{ ...styles.td, flex: "1.2", textAlign: "right", fontVariantNumeric: "tabular-nums", color: "#d97706", fontWeight: 600 }} data-label="$/DXYZ share">
                  ${r.navPerShare.toFixed(2)}
                </div>
                <div style={{ ...styles.td, flex: "1.0", textAlign: "right", fontVariantNumeric: "tabular-nums", color: "#1c1917", fontWeight: 600, fontFamily: "'JetBrains Mono', monospace", fontSize: "12px" }} data-label="¢ per $1">
                  {dxyzPrice > 0 ? (r.navPerShare / dxyzPrice * 100).toFixed(1) + "¢" : "—"}
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
              ${(calc.shareTotal / (dxyzShares * 1_000_000)).toFixed(2)}
            </div>
            <div style={{ flex: "1.0", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
              {dxyzPrice > 0 ? ((calc.shareTotal / (dxyzShares * 1_000_000)) / dxyzPrice * 100).toFixed(1) + "¢" : "—"}
            </div>
          </div>
        </div>
      </div>

      <div style={styles.section}>
        <div style={styles.sectionHeader} className="vcx-section-header">
          <span style={styles.sectionNum}>02</span>
          <h2 style={styles.sectionTitle}>SPVs & Percentage-Weighted Holdings</h2>
          <span style={styles.sectionMeta} className="vcx-section-meta">1.0x = March 31, 2026 filed NAV baseline</span>
        </div>

        <div style={styles.tableWrap}>
          <div style={styles.tableHeaderRow} className="vcx-table-header">
            <div style={{ ...styles.th, flex: "2.6" }}>Position</div>
            <div style={{ ...styles.th, flex: "1.2", textAlign: "right" }}>Baseline Value</div>
            <div style={{ ...styles.th, flex: "1.0", textAlign: "right" }}>MOIC</div>
            <div style={{ ...styles.th, flex: "1.4", textAlign: "right" }}>Position Value</div>
            <div style={{ ...styles.th, flex: "1.2", textAlign: "right" }}>$/DXYZ share</div>
            <div style={{ ...styles.th, flex: "1.0", textAlign: "right" }}>¢ per $1</div>
          </div>
          {calc.dollarRows.map((r) => (
            <div key={r.name} style={styles.tr} className="vcx-row">
              <div style={{ ...styles.td, flex: "2.6" }}>
                <div style={styles.companyName}>{r.name}</div>
                <div style={styles.companyNote}>{r.note}</div>
              </div>
              <div style={{ ...styles.td, flex: "1.2", textAlign: "right", fontVariantNumeric: "tabular-nums", color: "#78716c" }} data-label="Baseline Value">
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
              <div style={{ ...styles.td, flex: "1.2", textAlign: "right", fontVariantNumeric: "tabular-nums", color: "#d97706", fontWeight: 600 }} data-label="$/DXYZ share">
                ${r.navPerShare.toFixed(2)}
              </div>
              <div style={{ ...styles.td, flex: "1.0", textAlign: "right", fontVariantNumeric: "tabular-nums", color: "#1c1917", fontWeight: 600, fontFamily: "'JetBrains Mono', monospace", fontSize: "12px" }} data-label="¢ per $1">
                {dxyzPrice > 0 ? (r.navPerShare / dxyzPrice * 100).toFixed(1) + "¢" : "—"}
              </div>
            </div>
          ))}
          <div style={styles.subtotalRow} className="vcx-subtotal">
            <div style={{ flex: "2.6" }}>Subtotal — SPV/MOIC</div>
            <div style={{ flex: "1.2" }} />
            <div style={{ flex: "1.0" }} />
            <div style={{ flex: "1.4", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{fmt$(calc.dollarTotal)}</div>
            <div style={{ flex: "1.2", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
              ${(calc.dollarTotal / (dxyzShares * 1_000_000)).toFixed(2)}
            </div>
            <div style={{ flex: "1.0", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
              {dxyzPrice > 0 ? ((calc.dollarTotal / (dxyzShares * 1_000_000)) / dxyzPrice * 100).toFixed(1) + "¢" : "—"}
            </div>
          </div>
        </div>
      </div>

      <div style={styles.section}>
        <div style={styles.sectionHeader} className="vcx-section-header">
          <span style={styles.sectionNum}>03</span>
          <h2 style={styles.sectionTitle}>Cash & Other</h2>
          <span style={styles.sectionMeta} className="vcx-section-meta">1.0x = Baseline values</span>
        </div>
        <div style={styles.tableWrap}>
          <div style={styles.tableHeaderRow} className="vcx-table-header">
            <div style={{ ...styles.th, flex: "2.6" }}>Position</div>
            <div style={{ ...styles.th, flex: "1.2", textAlign: "right" }}>Baseline Value</div>
            <div style={{ ...styles.th, flex: "1.0", textAlign: "right" }}>MOIC</div>
            <div style={{ ...styles.th, flex: "1.4", textAlign: "right" }}>Position Value</div>
            <div style={{ ...styles.th, flex: "1.2", textAlign: "right" }}>$/DXYZ share</div>
            <div style={{ ...styles.th, flex: "1.0", textAlign: "right" }}>¢ per $1</div>
          </div>
          {calc.otherRows.map((r) => {
            const isLocked = r.locked;
            return (
              <div key={r.name} style={styles.tr} className="vcx-row">
                <div style={{ ...styles.td, flex: "2.6" }}>
                  <div style={styles.companyName}>{r.name}</div>
                  <div style={styles.companyNote}>{r.note}</div>
                </div>
                <div style={{ ...styles.td, flex: "1.2", textAlign: "right", fontVariantNumeric: "tabular-nums", color: "#78716c" }} data-label="Baseline Value">
                  {fmt$(r.markValue)}
                </div>
                <div style={{ ...styles.td, flex: "1.0", textAlign: "right" }} className="vcx-moic-cell" data-label="MOIC">
                  {isLocked ? (
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
                <div style={{ ...styles.td, flex: "1.4", textAlign: "right", fontVariantNumeric: "tabular-nums", fontWeight: 500 }} data-label="Position Value">
                  {fmt$(r.positionValue)}
                </div>
                <div style={{ ...styles.td, flex: "1.2", textAlign: "right", fontVariantNumeric: "tabular-nums", color: "#d97706", fontWeight: 600 }} data-label="$/DXYZ share">
                  ${r.navPerShare.toFixed(2)}
                </div>
                <div style={{ ...styles.td, flex: "1.0", textAlign: "right", fontVariantNumeric: "tabular-nums", color: "#1c1917", fontWeight: 600, fontFamily: "'JetBrains Mono', monospace", fontSize: "12px" }} data-label="¢ per $1">
                  {dxyzPrice > 0 ? (r.navPerShare / dxyzPrice * 100).toFixed(1) + "¢" : "—"}
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
              ${(calc.otherTotal / (dxyzShares * 1_000_000)).toFixed(2)}
            </div>
            <div style={{ flex: "1.0", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
              {dxyzPrice > 0 ? ((calc.otherTotal / (dxyzShares * 1_000_000)) / dxyzPrice * 100).toFixed(1) + "¢" : "—"}
            </div>
          </div>
        </div>
      </div>

      <div style={styles.grandTotal} className="vcx-grand-total">
        <div style={styles.gtLabel}>TOTAL MARKED NET ASSETS (3/31 BASIS)</div>
        <div style={styles.gtValue} className="vcx-gt-value-large">{fmt$exact(calc.totalNAV)}</div>
        <div style={styles.gtDivider} />
        <div style={{ display: "flex", gap: "64px", flexWrap: "wrap" }} className="vcx-gt-metrics">
          <div className="vcx-gt-metric">
            <div style={styles.gtLabel}>NAV / SHARE (3/31 SHARES)</div>
            <div style={{ ...styles.gtValueAccent, ...(bridgeActive ? { fontSize: "40px", color: "#fff" } : {}) }} className="vcx-gt-value-accent">${calc.navPerShare.toFixed(2)}</div>
          </div>
          {bridgeActive && (
            <div className="vcx-gt-metric">
              <div style={styles.gtLabel}>EST. PRO FORMA NAV / SHARE — INCL. ATM, NOT COMPANY REPORTED</div>
              <div style={styles.gtValueAccent} className="vcx-gt-value-accent">${effectiveNav.toFixed(2)}</div>
            </div>
          )}
        </div>
        <div style={styles.gtDivider} />
        <div style={{ display: "flex", gap: "48px", flexWrap: "wrap", marginTop: "8px" }} className="vcx-gt-metrics">
          <div className="vcx-gt-metric">
            <div style={styles.gtLabel}>DXYZ Trading at</div>
            <div style={{ ...styles.gtValue, fontSize: "32px", marginBottom: "4px" }} className="vcx-gt-value-small">${dxyzPrice.toFixed(2)}</div>
          </div>
          <div className="vcx-gt-metric">
            <div style={styles.gtLabel}>{bridgeActive ? "Premium to PF NAV" : "Premium to NAV"}</div>
            <div style={{ ...styles.gtValue, fontSize: "32px", marginBottom: "4px", color: dxyzPrice > effectiveNav ? "#fbbf24" : "#86efac" }} className="vcx-gt-value-small">
              {((dxyzPrice / effectiveNav - 1) * 100).toFixed(0)}%
            </div>
          </div>
          <div className="vcx-gt-metric">
            <div style={styles.gtLabel}>{bridgeActive ? "Price ÷ PF NAV" : "Price ÷ NAV"}</div>
            <div style={{ ...styles.gtValue, fontSize: "32px", marginBottom: "4px" }} className="vcx-gt-value-small">{(dxyzPrice / effectiveNav).toFixed(2)}x</div>
          </div>
          <div className="vcx-gt-metric">
            <div style={styles.gtLabel}>Implied DXYZ Mkt Cap</div>
            <div style={{ ...styles.gtValue, fontSize: "32px", marginBottom: "4px" }} className="vcx-gt-value-small">{fmt$(dxyzPrice * effectiveShares)}</div>
          </div>
        </div>
        <div style={styles.gtMeta}>
          {bridgeActive
            ? `Estimated NAV from user-supplied marks + modeled ATM issuance (${atmMode} mode) · ${fmtM(effectiveShares)} est. pro forma shares · Estimated, not company reported`
            : `Filed-basis NAV from user-supplied marks · ${dxyzShares.toFixed(2)}M shares outstanding (3/31/26) · No post-March issuance modeled`}
        </div>
      </div>

      <div style={styles.footer}>
        <div><strong>Changelog:</strong></div>
        <div style={{ marginBottom: "16px" }}>
          • <strong>July 9, 2026</strong> — Added the ATM Issuance Bridge. Reconciled the March 31 baseline to filed net assets ($742.5M portfolio + $5.9M other net assets = $748.36M per the NPORT-P), correcting implied shares outstanding from 30.23M to ~30.47M. Added Filed Only / Calibrated Estimate / Custom modes that estimate post-March ATM share issuance: Apr 1–May 21 shares (~10.90M) inferred from the May 26 424B5 share count, post-May-26 issuance modeled daily from Yahoo price/volume history at a calibrated ~8.3% volume-participation rate, capped at $1B gross capacity, with no issuance on days at or below rolling NAV. Commission, participation, capacity, premium threshold, expense drag, and as-of date are adjustable. Every figure is labeled Filed, Inferred, or Estimated.<br />
          • <strong>June 15, 2026</strong> — Updated the baseline NAV math to reconcile with DXYZ&apos;s March 31, 2026 SEC disclosures: $24.56 NAV per share, approximately $742.5M of portfolio value, March 31 portfolio weights, and an implied 30.23M share count. Added real-time DXYZ market price fetching from Yahoo Finance via the shared price API.<br />
        </div>

        <div><strong>Sources & Methodology:</strong></div>
        <div>• <strong>Baseline NAV & Net Assets:</strong> $24.56 per share; $753.29M total assets, $4.93M liabilities, $748.36M net assets as of March 31, 2026, per the <a href="https://www.sec.gov/Archives/edgar/data/1843974/000089418926016628/xslFormNPORT-P_X01/primary_doc.xml" target="_blank" rel="noopener noreferrer" style={{ color: "#d97706", textDecoration: "underline" }}>March 31, 2026 NPORT-P</a> and <a href="https://www.sec.gov/Archives/edgar/data/1843974/000157587226000359/dxyz102_424b5.htm" target="_blank" rel="noopener noreferrer" style={{ color: "#d97706", textDecoration: "underline" }}>May 26, 2026 424B5</a>.</div>
        <div>• <strong>Portfolio Value:</strong> Approximately $742.5M as of March 31, 2026, per the <a href="https://www.sec.gov/Archives/edgar/data/1843974/000157587226000288/dxyz100_424b3.htm" target="_blank" rel="noopener noreferrer" style={{ color: "#d97706", textDecoration: "underline" }}>May 12, 2026 424B3 portfolio supplement</a>.</div>
        <div>• <strong>Share Counts:</strong> Extracted from the December 31, 2025 Schedule of Investments within the <a href="https://www.sec.gov/Archives/edgar/data/1843974/000121390026025304/ea0276106-01_ncsr.htm" target="_blank" rel="noopener noreferrer" style={{ color: "#d97706", textDecoration: "underline" }}>N-CSR filed March 10, 2026</a> where available. For holdings where March 31 only discloses portfolio percentages, baseline value is inferred from the filed $742.5M portfolio value.</div>
        <div>• <strong>Outstanding Shares:</strong> Defaults to ~30.47M, implied by $748.36M filed net assets divided by the filed $24.56 NAV per share (inferred — the NPORT-P does not state a share count directly).</div>
        <div>• <strong>ATM Program:</strong> Q1 2026 sales of 8,489,359 shares at $28.76 weighted average (~$244.1M net; already reflected in the March 31 baseline) per the 424B3. New $1B gross-capacity program through Jefferies (commission up to 3.0% of gross sales price) per the 424B5, which discloses up to 57,591,678 shares outstanding <em>after</em> a full offering at the assumed $61.66 price — implying ~41.37M pre-offering shares and thus ~10.90M shares issued April 1–May 21 under the prior program (inferred).</div>
        <div>• <strong>Post-May-26 Issuance (estimated):</strong> Modeled daily as a fixed share of Yahoo Finance trading volume (calibrated ~8.3%), issuing only on days above rolling pro forma NAV, until gross capacity is exhausted. Estimated, not company reported.</div>
      </div>

      <div style={styles.stickyBar} className="vcx-sticky-bar">
        <div style={styles.stickyInner}>
          <div style={styles.stickyMetric}>
            <div style={styles.stickyLabel}>{bridgeActive ? "Est. PF NAV / Share" : "NAV / Share"}</div>
            <div style={styles.stickyValueAccent}>${effectiveNav.toFixed(2)}</div>
          </div>
          <div style={styles.stickyDivider} />
          <div style={styles.stickyMetric}>
            <div style={styles.stickyLabel}>Premium</div>
            <div style={{ ...styles.stickyValue, color: dxyzPrice > effectiveNav ? "#fbbf24" : "#86efac" }}>
              {((dxyzPrice / effectiveNav - 1) * 100).toFixed(0)}%
            </div>
          </div>
          <div style={styles.stickyDivider} />
          <div style={styles.stickyMetric}>
            <div style={styles.stickyLabel}>Price ÷ NAV</div>
            <div style={styles.stickyValue}>{(dxyzPrice / effectiveNav).toFixed(2)}x</div>
          </div>
          <div style={styles.stickyDivider} />
          <div style={styles.stickyMetric}>
            <div style={styles.stickyLabel}>{bridgeActive ? "Est. Net Assets" : "Total NAV"}</div>
            <div style={styles.stickyValue}>{fmt$(atmBridge.proFormaAssets)}</div>
          </div>
          <div style={styles.stickyDivider} />
          <div style={styles.stickyMetric}>
            <div style={styles.stickyLabel}>DXYZ Price</div>
            <div style={styles.stickyValue}>${dxyzPrice.toFixed(0)}</div>
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
  label: {
    display: "block",
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: "11px",
    letterSpacing: "0.05em",
    textTransform: "uppercase",
    marginBottom: "8px",
    color: "#78716c",
  },
  smallInput: {
    padding: "8px 12px",
    fontSize: "18px",
    fontFamily: "'JetBrains Mono', monospace",
    border: "1px solid #d6d3d1",
    background: "#fff",
    color: "#1c1917",
    width: "120px",
    outline: "none",
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
  issuanceMeta: {
    fontSize: "13px",
    fontFamily: "'Fraunces', serif",
    lineHeight: 1.6,
    color: "#92400e",
  },
  section: {
    marginBottom: "64px",
  },
  sectionHeader: {
    display: "flex",
    alignItems: "baseline",
    gap: "16px",
    marginBottom: "24px",
    borderBottom: "1px solid #e7e5e4",
    paddingBottom: "12px",
  },
  sectionNum: {
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: "14px",
    color: "#d97706",
    fontWeight: 600,
  },
  sectionTitle: {
    fontSize: "24px",
    margin: 0,
    fontWeight: 600,
  },
  sectionMeta: {
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: "12px",
    color: "#78716c",
  },
  tableWrap: {
    background: "#fff",
    border: "1px solid #e7e5e4",
  },
  tableHeaderRow: {
    display: "flex",
    padding: "12px 16px",
    borderBottom: "1px solid #e7e5e4",
    background: "#fafaf9",
  },
  th: {
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: "11px",
    textTransform: "uppercase",
    letterSpacing: "0.05em",
    color: "#78716c",
    fontWeight: 600,
  },
  tr: {
    display: "flex",
    padding: "16px",
    borderBottom: "1px solid #f5f5f4",
    alignItems: "center",
  },
  td: {
    fontSize: "14px",
  },
  companyName: {
    fontWeight: 600,
    fontSize: "15px",
    marginBottom: "4px",
  },
  companyNote: {
    fontSize: "12px",
    color: "#78716c",
    fontFamily: "system-ui, -apple-system, sans-serif",
  },
  ppsInput: {
    width: "80px",
    padding: "6px 8px",
    fontSize: "14px",
    fontFamily: "'JetBrains Mono', monospace",
    textAlign: "right",
    border: "1px solid #d6d3d1",
    background: "#fefdf8",
    color: "#1c1917",
    outline: "none",
  },
  moicInput: {
    width: "60px",
    padding: "6px 8px",
    fontSize: "14px",
    fontFamily: "'JetBrains Mono', monospace",
    textAlign: "right",
    border: "1px solid #d6d3d1",
    background: "#fefdf8",
    color: "#1c1917",
    outline: "none",
  },
  delta: {
    fontSize: "11px",
    fontFamily: "'JetBrains Mono', monospace",
    marginTop: "4px",
  },
  subtotalRow: {
    display: "flex",
    padding: "16px",
    background: "#fafaf9",
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: "13px",
    fontWeight: 600,
    color: "#44403c",
    borderTop: "1px solid #e7e5e4",
  },
  grandTotal: {
    background: "#1c1917",
    color: "#fff",
    padding: "48px",
    marginTop: "64px",
  },
  gtLabel: {
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: "13px",
    textTransform: "uppercase",
    letterSpacing: "0.1em",
    color: "#a8a29e",
    marginBottom: "12px",
  },
  gtValue: {
    fontSize: "64px",
    lineHeight: 1,
    fontWeight: 700,
  },
  gtValueAccent: {
    fontSize: "64px",
    lineHeight: 1,
    fontWeight: 700,
    color: "#fbbf24",
  },
  gtDivider: {
    height: "1px",
    background: "#44403c",
    margin: "32px 0",
  },
  gtMeta: {
    marginTop: "32px",
    fontSize: "12px",
    fontFamily: "'JetBrains Mono', monospace",
    color: "#78716c",
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
    background: "rgba(28, 25, 23, 0.9)",
    backdropFilter: "blur(12px)",
    WebkitBackdropFilter: "blur(12px)",
    borderTop: "1px solid #44403c",
    padding: "16px 24px",
    zIndex: 100,
    boxShadow: "0 -4px 20px rgba(0,0,0,0.1)",
  },
  stickyInner: {
    maxWidth: "1180px",
    margin: "0 auto",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "32px",
  },
  stickyMetric: {
    display: "flex",
    flexDirection: "column",
    gap: "4px",
  },
  stickyLabel: {
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: "11px",
    textTransform: "uppercase",
    letterSpacing: "0.05em",
    color: "#a8a29e",
  },
  stickyValue: {
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: "16px",
    fontWeight: 600,
    color: "#fff",
  },
  stickyValueAccent: {
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: "16px",
    fontWeight: 700,
    color: "#fbbf24",
  },
  stickyDivider: {
    width: "1px",
    height: "24px",
    background: "#44403c",
  },
};
