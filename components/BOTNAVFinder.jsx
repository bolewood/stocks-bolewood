"use client";

import React, { useState, useMemo, useEffect } from "react";
import PriceBadge from "./PriceBadge";

// BOT NAV Finder
// Source: RoboStrategy, Inc. N-CSRS (Semi-Annual Report for period ending Feb 28, 2026)
// Filed: May 8, 2026

const BOT_SHARES_OUTSTANDING_M = 19.91; // 19,908,968 exact from Feb 28, 2026

const SHARE_DENOMINATED = [
  {
    name: "Dyna Robotics",
    shares_k: 1491.163,
    mark_pps_0228: 24.98, // $37,249,997 / 1,491,163
    note: "Series A Preferred",
  },
  {
    name: "Apptronik",
    shares_k: 513.046,
    mark_pps_0228: 34.59, // $17,746,859 / 513,046
    note: "Series 1 Seed Preferred",
  },
  {
    name: "Dexmate",
    shares_k: 1740.280,
    mark_pps_0228: 5.75, // $9,999,997 / 1,740,280
    note: "Series 1 Seed Preferred",
  },
  {
    name: "Path Robotics",
    shares_k: 773.660,
    mark_pps_0228: 7.76, // $5,999,996 / 773,660
    note: "Series D Preferred",
  },
  {
    name: "REK, Inc.",
    shares_k: 1875.891,
    mark_pps_0228: 1.33, // $2,500,000 / 1,875,891
    note: "Series 1 Seed Preferred",
  },
  {
    name: "Endiatx",
    shares_k: 285.322,
    mark_pps_0228: 1.75, // $499,998 / 285,322
    note: "Series A Preferred",
  },
  {
    name: "Allonic",
    shares_k: 154.798,
    mark_pps_0228: 1.92, // $297,349 / 154,798
    note: "Pre-seed Preferred",
  },
];

const DOLLAR_DENOMINATED = [
  { name: "Figure AI (NV Series B QP)", value_k: 37250, note: "SPV holding Figure AI Series B" },
  { name: "Apptronik (AP-1125 Fund V)", value_k: 19503, note: "SPV holding Apptronik Series A-1, A-2, Seed 1" },
  { name: "GMI Cloud", value_k: 2000, note: "SAFE Note" },
  { name: "Cyan Robotics", value_k: 1500, note: "SAFE Note via RoboStrategy DDGT LLC SPV" },
  { name: "Purple Rhombus", value_k: 250, note: "SAFE Note via PU-1003 Fund I SPV" },
];

const OTHER_HOLDINGS = [
  { name: "Cash & Other Assets/Liabilities", value_k: 11416, note: "Net cash and equivalents" },
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

export default function BOTNAVFinder() {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 720);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  const [activeScenario, setActiveScenario] = useState("mark");

  const [ppsOverrides, setPpsOverrides] = useState(
    SHARE_DENOMINATED.reduce((acc, p) => ({ ...acc, [p.name]: p.mark_pps_0228 }), {})
  );
  const [botShares, setBotShares] = useState(BOT_SHARES_OUTSTANDING_M);
  const [botPrice, setBotPrice] = useState(28.04); // 2026-08-19; live-fetched on load
  const [priceSource, setPriceSource] = useState("default");

  const [cefSharesIssued, setCefSharesIssued] = useState(0);
  const [cefIssuePrice, setCefIssuePrice] = useState(15);

  const [dollarMOICs, setDollarMOICs] = useState(
    DOLLAR_DENOMINATED.reduce((acc, p) => ({ ...acc, [p.name]: 1.0 }), {})
  );
  const [otherMOICs, setOtherMOICs] = useState(
    OTHER_HOLDINGS.reduce((acc, p) => ({ ...acc, [p.name]: 1.0 }), {})
  );

  useEffect(() => {
    fetch("/api/prices")
      .then((res) => res.json())
      .then((data) => {
        if (data.prices?.BOT) setBotPrice(data.prices.BOT);
        setPriceSource(data.source || "fallback");
      })
      .catch(() => setPriceSource("fallback"));
  }, []);

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
      SHARE_DENOMINATED.reduce((acc, p) => ({ ...acc, [p.name]: p.mark_pps_0228 }), {})
    );
    setDollarMOICs(DOLLAR_DENOMINATED.reduce((acc, p) => ({ ...acc, [p.name]: 1.0 }), {}));
    setOtherMOICs(OTHER_HOLDINGS.reduce((acc, p) => ({ ...acc, [p.name]: 1.0 }), {}));
    setCefSharesIssued(0);
    setActiveScenario("mark");
    updateURL("mark");
  };

  const applyAggressive = () => {
    setPpsOverrides({
      "Dyna Robotics": 50,
      "Apptronik": 70,
      "Dexmate": 12,
      "Path Robotics": 15,
      "REK, Inc.": 3,
      "Endiatx": 4,
      "Allonic": 4,
    });
    setDollarMOICs({
      "Figure AI (NV Series B QP)": 2.0,
      "Apptronik (AP-1125 Fund V)": 2.0,
      "GMI Cloud": 1.5,
      "Cyan Robotics": 1.5,
      "Purple Rhombus": 1.5,
    });
    setOtherMOICs(OTHER_HOLDINGS.reduce((acc, p) => ({ ...acc, [p.name]: 1.0 }), {}));
    setActiveScenario("aggressive");
    updateURL("aggressive");
  };

  const applyDream = () => {
    setPpsOverrides({
      "Dyna Robotics": 100,
      "Apptronik": 150,
      "Dexmate": 25,
      "Path Robotics": 30,
      "REK, Inc.": 8,
      "Endiatx": 10,
      "Allonic": 10,
    });
    setDollarMOICs({
      "Figure AI (NV Series B QP)": 4.0,
      "Apptronik (AP-1125 Fund V)": 4.0,
      "GMI Cloud": 3.0,
      "Cyan Robotics": 3.0,
      "Purple Rhombus": 3.0,
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
  }, []);

  const calc = useMemo(() => {
    const totalShares = botShares + cefSharesIssued;

    const shareRows = SHARE_DENOMINATED.map((p) => {
      const pps = parseFloat(ppsOverrides[p.name]) || 0;
      const positionValue = pps * p.shares_k * 1000;
      const navPerShare = positionValue / (totalShares * 1_000_000);
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
        navPerShare: positionValue / (totalShares * 1_000_000),
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
        navPerShare: positionValue / (totalShares * 1_000_000),
      };
    });

    if (cefSharesIssued > 0) {
      const cashRaised = cefSharesIssued * cefIssuePrice * 1_000_000;
      otherRows.push({
        name: "CEF Capital Raised",
        note: `Proceeds from issuing ${cefSharesIssued.toFixed(2)}M shares at $${cefIssuePrice.toFixed(2)}`,
        markValue: 0,
        moic: 1.0,
        positionValue: cashRaised,
        navPerShare: cashRaised / (totalShares * 1_000_000),
        isVirtual: true,
      });
    }

    const shareTotal = shareRows.reduce((s, r) => s + r.positionValue, 0);
    const dollarTotal = dollarRows.reduce((s, r) => s + r.positionValue, 0);
    const otherTotal = otherRows.reduce((s, r) => s + r.positionValue, 0);
    const totalNAV = shareTotal + dollarTotal + otherTotal;
    const navPerShare = totalNAV / (totalShares * 1_000_000);

    return { shareRows, dollarRows, otherRows, shareTotal, dollarTotal, otherTotal, totalNAV, navPerShare, totalShares };
  }, [ppsOverrides, botShares, cefSharesIssued, cefIssuePrice, dollarMOICs, otherMOICs]);

  return (
    <div style={styles.container} className="vcx-container">
      <div style={styles.header}>
        <div style={styles.eyebrow} className="vcx-eyebrow">ROBOSTRATEGY, INC. · NASDAQ: BOT · ESTIMATED NAV CALCULATOR</div>
        <h1 style={styles.title} className="vcx-title">
          BOT <span style={styles.titleAccent}>NAV Finder</span>
        </h1>
        <p style={styles.subtitle} className="vcx-subtitle">
          BOT is a non-diversified, closed-end fund targeting private robotics and AI companies (Figure AI, Apptronik, Dexmate). Mark the underlying shares to current secondary market prices and apply multipliers to its SPV-held stakes to estimate its true Net Asset Value per share.
        </p>
      </div>

      <div style={styles.howToBox}>
        <div style={styles.howToTitle}>How this works</div>
        <ol style={styles.howToList}>
          <li style={{ marginBottom: 6 }}>The fund holds private shares directly (Box 1) and through SPVs/SAFEs (Box 2). </li>
          <li style={{ marginBottom: 6 }}>Update price-per-share for Box 1 and MOIC (Multiple on Invested Capital) for Box 2.</li>
          <li style={{ marginBottom: 6 }}>Defaults are explicitly mapped from the February 28, 2026 N-CSRS SEC filing.</li>
          <li>The bottom bar tracks the implied premium based on your inputs and the current BOT market price.</li>
        </ol>
      </div>

      <div style={styles.controls} className="vcx-controls">
        <div style={styles.controlGroup}>
          <label style={styles.label}>BOT Shares Outstanding (M)</label>
          <input
            type="number"
            step="0.01"
            value={botShares}
            onChange={(e) => setBotShares(parseFloat(e.target.value) || 0)}
            style={styles.smallInput}
            className="vcx-input vcx-small-input"
          />
        </div>
        <div style={styles.controlGroup}>
          <label style={styles.label}>BOT Market Price ($)</label>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <input
              type="number"
              step="0.01"
              value={botPrice}
              onChange={(e) => {
                setBotPrice(parseFloat(e.target.value) || 0);
                setPriceSource("manual");
              }}
              style={styles.smallInput}
              className="vcx-input vcx-small-input"
            />
            <PriceBadge source={priceSource} />
          </div>
        </div>
        <div style={styles.controlGroup}>
          <label style={{...styles.label, color: "#15803d"}}>CEF Shares Issued (M)</label>
          <input
            type="number"
            step="0.01"
            value={cefSharesIssued}
            onChange={(e) => setCefSharesIssued(parseFloat(e.target.value) || 0)}
            style={{ ...styles.smallInput, border: cefSharesIssued > 0 ? "1px solid #15803d" : "1px solid #d6d3d1" }}
            className="vcx-input vcx-small-input"
          />
        </div>
        <div style={styles.controlGroup}>
          <label style={{...styles.label, color: "#15803d"}}>CEF Issue Price ($)</label>
          <input
            type="number"
            step="0.01"
            value={cefIssuePrice}
            onChange={(e) => setCefIssuePrice(parseFloat(e.target.value) || 0)}
            style={{ ...styles.smallInput, border: cefSharesIssued > 0 ? "1px solid #15803d" : "1px solid #d6d3d1" }}
            className="vcx-input vcx-small-input"
          />
        </div>
        <div style={styles.controlGroup}>
          {[
            { key: "mark", label: "Baseline / 02/28/26 Mark", handler: resetToMark },
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
            <div style={{ ...styles.th, flex: "1.2", textAlign: "right" }}>$/BOT share</div>
            <div style={{ ...styles.th, flex: "1.0", textAlign: "right" }}>¢ per $1</div>
          </div>

          {calc.shareRows.map((r) => {
            const delta = ((r.pps - r.mark_pps_0228) / r.mark_pps_0228) * 100;
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
                <div style={{ ...styles.td, flex: "1.2", textAlign: "right", fontVariantNumeric: "tabular-nums", color: "#d97706", fontWeight: 600 }} data-label="$/BOT share">
                  ${r.navPerShare.toFixed(2)}
                </div>
                <div style={{ ...styles.td, flex: "1.0", textAlign: "right", fontVariantNumeric: "tabular-nums", color: "#1c1917", fontWeight: 600, fontFamily: "'JetBrains Mono', monospace", fontSize: "12px" }} data-label="¢ per $1">
                  {botPrice > 0 ? (r.navPerShare / botPrice * 100).toFixed(1) + "¢" : "—"}
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
              ${(calc.shareTotal / (calc.totalShares * 1_000_000)).toFixed(2)}
            </div>
            <div style={{ flex: "1.0", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
              {botPrice > 0 ? ((calc.shareTotal / (calc.totalShares * 1_000_000)) / botPrice * 100).toFixed(1) + "¢" : "—"}
            </div>
          </div>
        </div>
      </div>

      <div style={styles.section}>
        <div style={styles.sectionHeader} className="vcx-section-header">
          <span style={styles.sectionNum}>02</span>
          <h2 style={styles.sectionTitle}>SPVs & SAFEs</h2>
          <span style={styles.sectionMeta} className="vcx-section-meta">1.0x = Baseline carrying value</span>
        </div>

        <div style={styles.tableWrap}>
          <div style={styles.tableHeaderRow} className="vcx-table-header">
            <div style={{ ...styles.th, flex: "2.6" }}>Position</div>
            <div style={{ ...styles.th, flex: "1.2", textAlign: "right" }}>Baseline Value</div>
            <div style={{ ...styles.th, flex: "1.0", textAlign: "right" }}>MOIC</div>
            <div style={{ ...styles.th, flex: "1.4", textAlign: "right" }}>Position Value</div>
            <div style={{ ...styles.th, flex: "1.2", textAlign: "right" }}>$/BOT share</div>
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
              <div style={{ ...styles.td, flex: "1.2", textAlign: "right", fontVariantNumeric: "tabular-nums", color: "#d97706", fontWeight: 600 }} data-label="$/BOT share">
                ${r.navPerShare.toFixed(2)}
              </div>
              <div style={{ ...styles.td, flex: "1.0", textAlign: "right", fontVariantNumeric: "tabular-nums", color: "#1c1917", fontWeight: 600, fontFamily: "'JetBrains Mono', monospace", fontSize: "12px" }} data-label="¢ per $1">
                {botPrice > 0 ? (r.navPerShare / botPrice * 100).toFixed(1) + "¢" : "—"}
              </div>
            </div>
          ))}
          <div style={styles.subtotalRow} className="vcx-subtotal">
            <div style={{ flex: "2.6" }}>Subtotal — SPVs/SAFEs</div>
            <div style={{ flex: "1.2" }} />
            <div style={{ flex: "1.0" }} />
            <div style={{ flex: "1.4", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{fmt$(calc.dollarTotal)}</div>
            <div style={{ flex: "1.2", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
              ${(calc.dollarTotal / (calc.totalShares * 1_000_000)).toFixed(2)}
            </div>
            <div style={{ flex: "1.0", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
              {botPrice > 0 ? ((calc.dollarTotal / (calc.totalShares * 1_000_000)) / botPrice * 100).toFixed(1) + "¢" : "—"}
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
            <div style={{ ...styles.th, flex: "1.2", textAlign: "right" }}>$/BOT share</div>
            <div style={{ ...styles.th, flex: "1.0", textAlign: "right" }}>¢ per $1</div>
          </div>
          {calc.otherRows.map((r) => {
            const isCash = r.name.includes("Cash");
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
                  {isCash ? (
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
                <div style={{ ...styles.td, flex: "1.2", textAlign: "right", fontVariantNumeric: "tabular-nums", color: "#d97706", fontWeight: 600 }} data-label="$/BOT share">
                  ${r.navPerShare.toFixed(2)}
                </div>
                <div style={{ ...styles.td, flex: "1.0", textAlign: "right", fontVariantNumeric: "tabular-nums", color: "#1c1917", fontWeight: 600, fontFamily: "'JetBrains Mono', monospace", fontSize: "12px" }} data-label="¢ per $1">
                  {botPrice > 0 ? (r.navPerShare / botPrice * 100).toFixed(1) + "¢" : "—"}
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
              ${(calc.otherTotal / (calc.totalShares * 1_000_000)).toFixed(2)}
            </div>
            <div style={{ flex: "1.0", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
              {botPrice > 0 ? ((calc.otherTotal / (calc.totalShares * 1_000_000)) / botPrice * 100).toFixed(1) + "¢" : "—"}
            </div>
          </div>
        </div>
      </div>

      <div style={styles.grandTotal} className="vcx-grand-total">
        <div style={styles.gtLabel}>TOTAL ESTIMATED NAV</div>
        <div style={styles.gtValue} className="vcx-gt-value-large">{fmt$exact(calc.totalNAV)}</div>
        <div style={styles.gtDivider} />
        <div style={styles.gtLabel}>NAV PER BOT SHARE</div>
        <div style={styles.gtValueAccent} className="vcx-gt-value-accent">${calc.navPerShare.toFixed(2)}</div>
        <div style={styles.gtDivider} />
        <div style={{ display: "flex", gap: "48px", flexWrap: "wrap", marginTop: "8px" }} className="vcx-gt-metrics">
          <div className="vcx-gt-metric">
            <div style={styles.gtLabel}>BOT Trading at</div>
            <div style={{ ...styles.gtValue, fontSize: "32px", marginBottom: "4px" }} className="vcx-gt-value-small">${botPrice.toFixed(2)}</div>
          </div>
          <div className="vcx-gt-metric">
            <div style={styles.gtLabel}>Premium to NAV</div>
            <div style={{ ...styles.gtValue, fontSize: "32px", marginBottom: "4px", color: botPrice > calc.navPerShare ? "#fbbf24" : "#86efac" }} className="vcx-gt-value-small">
              {((botPrice / calc.navPerShare - 1) * 100).toFixed(0)}%
            </div>
          </div>
          <div className="vcx-gt-metric">
            <div style={styles.gtLabel}>Price ÷ NAV</div>
            <div style={{ ...styles.gtValue, fontSize: "32px", marginBottom: "4px" }} className="vcx-gt-value-small">{(botPrice / calc.navPerShare).toFixed(2)}x</div>
          </div>
          <div className="vcx-gt-metric">
            <div style={styles.gtLabel}>Implied BOT Mkt Cap</div>
            <div style={{ ...styles.gtValue, fontSize: "32px", marginBottom: "4px" }} className="vcx-gt-value-small">{fmt$(botPrice * calc.totalShares * 1_000_000)}</div>
          </div>
        </div>
        <div style={styles.gtMeta}>
          Estimated NAV based on user-supplied marks · {calc.totalShares.toFixed(2)}M total shares outstanding · Compare to BOT market price to see premium or discount
        </div>
      </div>

      <div style={styles.footer}>
        <div><strong>Sources & Methodology:</strong></div>
        <div>• <strong>Baseline Net Assets:</strong> $146.21M (as of Feb 28, 2026) per the <a href="https://www.sec.gov/Archives/edgar/data/2081119/000121390026053808/ea0288089-01_ncsrs.htm" target="_blank" rel="noopener noreferrer" style={{ color: "#d97706", textDecoration: "underline" }}>N-CSRS filed May 8, 2026</a>.</div>
        <div>• <strong>Share Counts:</strong> Extracted directly from the February 28, 2026 Schedule of Investments within the N-CSRS.</div>
        <div>• <strong>Outstanding Shares:</strong> 19,908,968 (as of Feb 28, 2026 per the N-CSRS).</div>
      </div>

      <div style={styles.stickyBar} className="vcx-sticky-bar">
        <div style={styles.stickyInner}>
          <div style={styles.stickyMetric}>
            <div style={styles.stickyLabel}>NAV / Share</div>
            <div style={styles.stickyValueAccent}>${calc.navPerShare.toFixed(2)}</div>
          </div>
          <div style={styles.stickyDivider} />
          <div style={styles.stickyMetric}>
            <div style={styles.stickyLabel}>Premium</div>
            <div style={{ ...styles.stickyValue, color: botPrice > calc.navPerShare ? "#fbbf24" : "#86efac" }}>
              {((botPrice / calc.navPerShare - 1) * 100).toFixed(0)}%
            </div>
          </div>
          <div style={styles.stickyDivider} />
          <div style={styles.stickyMetric}>
            <div style={styles.stickyLabel}>Price ÷ NAV</div>
            <div style={styles.stickyValue}>{(botPrice / calc.navPerShare).toFixed(2)}x</div>
          </div>
          <div style={styles.stickyDivider} />
          <div style={styles.stickyMetric}>
            <div style={styles.stickyLabel}>Total NAV</div>
            <div style={styles.stickyValue}>{fmt$(calc.totalNAV)}</div>
          </div>
          <div style={styles.stickyDivider} />
          <div style={styles.stickyMetric}>
            <div style={styles.stickyLabel}>BOT Price</div>
            <div style={styles.stickyValue}>${botPrice.toFixed(2)}</div>
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
