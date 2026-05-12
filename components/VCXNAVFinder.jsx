"use client";

import React, { useState, useMemo, useEffect } from "react";

// VCX NAV Finder
// Source: Fundrise Innovation Fund (f.k.a. Growth Tech Fund) Schedule of Investments, 12/31/2025
// Share counts aggregated across tranches per position. Values in thousands where indicated.

const VCX_SHARES_OUTSTANDING_M = 35.9; // millions — per Fit_Equal6932's cap-table reconciliation on r/VCX_Fundrise, anchored on Feb 20 Fundrise platform snapshot ($563M AUM at $18.27 NAV → 30.82M shares) and walked forward through documented Q1 events.

// Positions where we have a clean underlying share count.
// share_count is in THOUSANDS (matching the filing's "Par/Shares" column).
const SHARE_DENOMINATED = [
  {
    name: "Anthropic",
    shares_k: 357, // 218 Series C + 139 Series F
    mark_pps_1231: 141, // implied: $50.275M / 357K shares ≈ $141
    note: "Series C (218K) + Series F Convertible (139K)",
  },
  {
    name: "Databricks",
    shares_k: 504, // 382 SPV + 122 direct, both Common
    mark_pps_1231: 190, // implied: $95.825M / 504K
    note: "Common (SPV 382K + direct 122K)",
  },
  {
    name: "Ramp Business",
    shares_k: 308, // 149 A-2 + 133 C-1 + 26 Common
    mark_pps_1231: 90, // implied: $27.741M / 308K
    note: "Series A-2 + C-1 + Common",
  },
  {
    name: "Flock Group",
    shares_k: 734, // 631 Class B + 103 Class C
    mark_pps_1231: 22, // $16.239M / 734K
    note: "Class B + Class C Preferred",
  },
  {
    name: "Epic Games",
    shares_k: 43,
    mark_pps_1231: 446, // $19.18M / 43K
    note: "Common",
  },
  {
    name: "dbt Labs",
    shares_k: 441,
    mark_pps_1231: 34, // $15M / 441K
    note: "Series D Pref. (Fivetran merger pending)",
  },
  {
    name: "Loyal Animal Health",
    shares_k: 680,
    mark_pps_1231: 12.3,
    note: "Series C Preferred",
  },
  {
    name: "Vanta",
    shares_k: 555,
    mark_pps_1231: 18.2,
    note: "Series B-1 Preferred",
  },
  {
    name: "SpaceX",
    shares_k: 30,
    mark_pps_1231: 238,
    note: "Common",
  },
  {
    name: "Anyscale",
    shares_k: 511,
    mark_pps_1231: 4.88,
    note: "Common",
  },
  {
    name: "Canva",
    shares_k: 6,
    mark_pps_1231: 1600,
    note: "Common",
  },
  {
    name: "Handshake",
    shares_k: 46, // 38 C + 8 D
    mark_pps_1231: 74,
    note: "Series C + Series D Preferred",
  },
  {
    name: "Intercom",
    shares_k: 53, // 45 Common + 8 Series A
    mark_pps_1231: 53,
    note: "Common + Series A Preferred",
  },
  {
    name: "Hightouch",
    shares_k: 14, // 12 Common + 2 Series C
    mark_pps_1231: 49,
    note: "Common + Series C Preferred",
  },
  {
    name: "Stripe",
    shares_k: 10,
    mark_pps_1231: 35,
    note: "Common",
  },
];

// Held at mark — no clean underlying share count disclosed (SPVs, convertible rights, partnership interests).
// Values in thousands.
const DOLLAR_DENOMINATED = [
  { name: "OpenAI (Convertible Rights + Partnership)", value_k: 53506, note: "$40,999 Conv. Rights + $12,507 Partnership" },
  { name: "Anduril Industries SPV", value_k: 12793, note: "Series E Preferred via 8VC ANSE SPV" },
  { name: "AI-LLM, LLC", value_k: 3105, note: "Top-10 LLM provider (undisclosed)" },
  { name: "Visual Layer (SAFE)", value_k: 5000, note: "SAFE — converts on next round" },
];

// Long tail / non-private-equity holdings + pre-listing primary issuance cash.
// Note: Between 12/31/25 and the March 19, 2026 NYSE listing, Fundrise continued primary
// issuance to platform investors at the then-published NAV of ~$19/share. This brought
// ~$100M of real new cash into VCX, which is reflected in the larger 28.3M share count
// vs. the implied ~23M shares at year-end 2025. This is distinct from post-listing
// affiliate redistribution (Tech Infrastructure REIT) which doesn't add cash to VCX.
const OTHER_HOLDINGS = [
  { name: "Inspectify (PE + SAFE)", value_k: 6000, note: "Series A-5 Preferred + SAFE" },
  { name: "Long tail PE (<$1M each)", value_k: 1414, note: "DittoLive, Omni, Rhino, Risotto, Luminos, Gumloop, Immuta" },
  { name: "Theory Ventures LP", value_k: 4497, note: "Sold March 2026 (held at 12/31)" },
  { name: "ServiceTitan (public)", value_k: 12694, note: "TTAN — already mark-to-market" },
  { name: "CMBS / Data Center Fixed Income", value_k: 66440, note: "SOFR-floating, short duration" },
  { name: "JPM Treasury MMF (12/31/25)", value_k: 26584, note: "Cash equivalent on 12/31 balance sheet" },
  { name: "Pre-listing primary issuance (Jan–Mar 2026)", value_k: 100000, note: "~5.3M new shares × ~$19/share to platform investors before NYSE listing" },
  { name: "Liabilities in excess of other assets", value_k: -27281, note: "Reverse repo + other net liabs (per filing)" },
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

  // Initialize PPS at the 12/31/25 marks
  const [ppsOverrides, setPpsOverrides] = useState(
    SHARE_DENOMINATED.reduce((acc, p) => ({ ...acc, [p.name]: p.mark_pps_1231 }), {})
  );
  const [vcxShares, setVcxShares] = useState(VCX_SHARES_OUTSTANDING_M);
  const [vcxPrice, setVcxPrice] = useState(240);

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
  };

  const updateDollarMOIC = (name, val) => {
    setDollarMOICs((prev) => ({ ...prev, [name]: val }));
  };

  const updateOtherMOIC = (name, val) => {
    setOtherMOICs((prev) => ({ ...prev, [name]: val }));
  };

  const resetToMark = () => {
    setPpsOverrides(
      SHARE_DENOMINATED.reduce((acc, p) => ({ ...acc, [p.name]: p.mark_pps_1231 }), {})
    );
    setDollarMOICs(DOLLAR_DENOMINATED.reduce((acc, p) => ({ ...acc, [p.name]: 1.0 }), {}));
    setOtherMOICs(OTHER_HOLDINGS.reduce((acc, p) => ({ ...acc, [p.name]: 1.0 }), {}));
  };

  const setAggressiveMay2026 = () => {
    setPpsOverrides({
      "Anthropic": 1400,
      "Databricks": 220,
      "Ramp Business": 120,
      "Flock Group": 10,
      "Epic Games": 283,
      "dbt Labs": 21,
      "Loyal Animal Health": 10,
      "Vanta": 9,
      "SpaceX": 710,
      "Anyscale": 3,
      "Canva": 1800,
      "Handshake": 74, // not in user list; held at 12/31 mark
      "Intercom": 30,
      "Hightouch": 50,
      "Stripe": 70,
    });
    setDollarMOICs({
      "OpenAI (Convertible Rights + Partnership)": 3.0,
      "Anduril Industries SPV": 2.0,
      "AI-LLM, LLC": 2.0,
      "Visual Layer (SAFE)": 2.0,
    });
    // Other holdings stay at 1.0x — these are mostly cash, fixed income, and small PE
    setOtherMOICs(OTHER_HOLDINGS.reduce((acc, p) => ({ ...acc, [p.name]: 1.0 }), {}));
  };

  const setDreamScenario = () => {
    // Everything 2x from Aggressive scenario
    setPpsOverrides({
      "Anthropic": 2800,
      "Databricks": 440,
      "Ramp Business": 240,
      "Flock Group": 20,
      "Epic Games": 566,
      "dbt Labs": 42,
      "Loyal Animal Health": 20,
      "Vanta": 18,
      "SpaceX": 1420,
      "Anyscale": 6,
      "Canva": 3600,
      "Handshake": 148,
      "Intercom": 60,
      "Hightouch": 100,
      "Stripe": 140,
    });
    setDollarMOICs({
      "OpenAI (Convertible Rights + Partnership)": 6.0,
      "Anduril Industries SPV": 4.0,
      "AI-LLM, LLC": 4.0,
      "Visual Layer (SAFE)": 4.0,
    });
    setOtherMOICs(OTHER_HOLDINGS.reduce((acc, p) => ({ ...acc, [p.name]: 1.0 }), {}));
  };

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
          VCX is a closed-end fund holding stakes in private companies (Anthropic, Databricks, OpenAI, SpaceX, etc.). It listed on the NYSE on March 19, 2026 and currently trades at a steep premium to its underlying net asset value. This tool lets you mark each holding to a current secondary-market price so you can estimate what VCX is actually worth per share. Inputs default to Fundrise's December 31, 2025 marks; override using current data from Hiive, Caplight, Notice, Forge, or your own estimates.
        </p>
      </div>

      <div style={styles.howToBox}>
        <div style={styles.howToTitle}>How this works in 30 seconds</div>
        <ol style={styles.howToList}>
          <li style={{ marginBottom: 6 }}>The fund holds three buckets of assets: private-company shares (Box 1), SPV/SAFE/convertible positions (Box 2), and a mix of public stock, fixed income, cash and liabilities (Box 3).</li>
          <li style={{ marginBottom: 6 }}>Update price-per-share for Box 1 holdings and MOIC multipliers for Box 2/3. Defaults are Fundrise's December 31, 2025 marks.</li>
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
          <button onClick={resetToMark} style={styles.presetBtn} className="preset-btn vcx-preset-btn">
            Reset to 12/31/25 mark
          </button>
          <button onClick={setAggressiveMay2026} style={styles.presetBtn} className="preset-btn vcx-preset-btn">
            Aggressive Markup — May 2026
          </button>
          <button onClick={setDreamScenario} style={{ ...styles.presetBtn, borderColor: "#d97706", color: "#d97706" }} className="preset-btn vcx-preset-btn">
            Dream Scenario (2x Aggressive)
          </button>
        </div>
      </div>

      {/* SHARE COUNT NOTE */}
      <div style={styles.issuanceBox}>
        <div style={styles.issuanceHeader}>
          <span style={styles.sectionNum}>ⓘ</span>
          <h3 style={{ ...styles.sectionTitle, fontSize: "16px", margin: 0 }}>About the share count</h3>
        </div>
        <div style={styles.issuanceMeta}>
          The default share count of <strong>35.9M</strong> reflects a forensic cap-table reconciliation by Reddit user Fit_Equal6932, anchored on a Fundrise platform screenshot from February 20, 2026 ($563M AUM at $18.27 NAV implying 30.82M shares) and walked forward through documented Q1 2026 events (Tech Infrastructure REIT $50M subscription, retail subscription windows, OpenAI/Anthropic/SpaceX markups). This reconciles to within a few percent of Fundrise's reported $679M pre-listing AUM. The April 24 Form 144 figure of 28.3M is the Jan 29 Schedule TO baseline and doesn't capture late retail subscriptions or the REIT block. The next authoritative disclosure will be VCX's Q1 2026 N-PORT filing (covering the March 31 snapshot), due to be filed with the SEC by late May 2026.
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
                <div style={{ ...styles.td, flex: "1.2", textAlign: "right", fontVariantNumeric: "tabular-nums", color: "#d97706", fontWeight: 600 }} data-label="$/VCX share">
                  ${r.navPerVcxShare.toFixed(2)}
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
          </div>
        </div>
      </div>

      {/* DOLLAR-DENOMINATED TABLE */}
      <div style={styles.section}>
        <div style={styles.sectionHeader} className="vcx-section-header">
          <span style={styles.sectionNum}>02</span>
          <h2 style={styles.sectionTitle}>SPV / Convertible / SAFE — flex with MOIC</h2>
          <span style={styles.sectionMeta} className="vcx-section-meta">1.0x = held at 12/31/25 mark</span>
        </div>

        <div style={styles.tableWrap}>
          <div style={styles.tableHeaderRow} className="vcx-table-header">
            <div style={{ ...styles.th, flex: "2.6" }}>Position</div>
            <div style={{ ...styles.th, flex: "1.2", textAlign: "right" }}>12/31 Mark</div>
            <div style={{ ...styles.th, flex: "1.0", textAlign: "right" }}>MOIC</div>
            <div style={{ ...styles.th, flex: "1.4", textAlign: "right" }}>Position Value</div>
            <div style={{ ...styles.th, flex: "1.2", textAlign: "right" }}>$/VCX share</div>
          </div>
          {calc.dollarRows.map((r) => (
            <div key={r.name} style={styles.tr} className="vcx-row">
              <div style={{ ...styles.td, flex: "2.6" }}>
                <div style={styles.companyName}>{r.name}</div>
                <div style={styles.companyNote}>{r.note}</div>
              </div>
              <div style={{ ...styles.td, flex: "1.2", textAlign: "right", fontVariantNumeric: "tabular-nums", color: "#78716c" }} data-label="12/31 Mark">
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
          </div>
        </div>
        <div style={styles.callout}>
          These positions are held through SPVs, convertible rights, or SAFEs without a clean underlying share count disclosed in the filing, so you can't mark them with a price-per-share. Instead, apply a MOIC (multiple of invested capital) — 1.0x means the position is unchanged from the 12/31 mark; 2.0x means it has doubled in value. <strong>OpenAI:</strong> The 12/31 mark implied roughly $300B valuation; today's secondary market is around $500-700B, suggesting 1.7x-2.3x. <strong>Anduril:</strong> Marked at the Series E (2023); the recent Series F was a 2-3x markup.
        </div>
      </div>

      {/* OTHER HOLDINGS */}
      <div style={styles.section}>
        <div style={styles.sectionHeader} className="vcx-section-header">
          <span style={styles.sectionNum}>03</span>
          <h2 style={styles.sectionTitle}>Long tail · public · fixed income · cash · liabilities</h2>
          <span style={styles.sectionMeta} className="vcx-section-meta">1.0x = held at 12/31/25 mark · Issuance lines locked</span>
        </div>
        <div style={styles.tableWrap}>
          <div style={styles.tableHeaderRow} className="vcx-table-header">
            <div style={{ ...styles.th, flex: "2.6" }}>Position</div>
            <div style={{ ...styles.th, flex: "1.2", textAlign: "right" }}>12/31 Mark</div>
            <div style={{ ...styles.th, flex: "1.0", textAlign: "right" }}>MOIC</div>
            <div style={{ ...styles.th, flex: "1.4", textAlign: "right" }}>Position Value</div>
            <div style={{ ...styles.th, flex: "1.2", textAlign: "right" }}>$/VCX share</div>
          </div>
          {calc.otherRows.map((r) => {
            const isIssuance = r.moic === undefined;
            return (
              <div key={r.name} style={styles.tr} className="vcx-row">
                <div style={{ ...styles.td, flex: "2.6" }}>
                  <div style={styles.companyName}>{r.name}</div>
                  <div style={styles.companyNote}>{r.note}</div>
                </div>
                <div style={{ ...styles.td, flex: "1.2", textAlign: "right", fontVariantNumeric: "tabular-nums", color: "#78716c" }} data-label="12/31 Mark">
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
        <div>• <strong>May 11, 2026 (evening update)</strong> — Updated default share count from 28.3M to 35.9M based on a forensic cap-table reconciliation by Reddit user Fit_Equal6932 (<a href="https://www.reddit.com/r/VCX_Fundrise/s/bit09tvNnO" target="_blank" rel="noopener noreferrer" style={{ color: "#d97706", textDecoration: "underline" }}>full analysis here</a>). His walk anchors on a Fundrise platform screenshot from February 20, 2026 ($563M AUM at $18.27 NAV, implying 30.82M shares) and walks forward through documented Q1 2026 events to reconcile against Fundrise's reported $679M pre-listing AUM, arriving at ~35.9M total shares outstanding. The prior 28.3M figure from the April 24 Form 144 appears to be the January 29 Schedule TO baseline that didn't get updated for late retail subscriptions or the Tech Infrastructure REIT block. At 35.9M shares the bear case math is sharper, not softer — the per-share NAV in every scenario is lower than the prior version showed. Bloomberg's reported ~4.7M free float at listing ties closely to the ~5.1M implied by his analysis.</div>
        <div>• <strong>May 11, 2026 (afternoon update)</strong> — Added a $100M "Pre-listing primary issuance (Jan–Mar 2026)" line to the other-holdings section. The prior version was dividing the 12/31/25 NAV by the late-April share count without accounting for the real primary issuance that occurred to platform investors between year-end and the March 19 NYSE listing. That issuance brought roughly $100M of cash into VCX at the then-published NAV of ~$19/share, and is what reconciles the year-end $437M total net assets to the ~$540M+ AUM at listing time. With this line included, the default "12/31/25 marks" scenario now produces a NAV/share close to Fundrise's own reported $19, matching the figure most outside observers reference.</div>
        <div>• <strong>May 11, 2026 (morning update)</strong> — Updated default share count from 30.57M (estimate based on assumed post-listing ATM issuance) to 28.3M, per the Form 144 filed April 24, 2026 by Fundrise Real Estate Interval Fund. Removed the "Forward Dilution" section and the dynamic issuance-cash inputs entirely. The previous model incorrectly assumed Fundrise was conducting an at-the-market offering (ATM) that was adding cash to VCX's balance sheet and diluting per-share exposure to the underlying companies. EDGAR filings show no such primary issuance is occurring; the ~60,000 shares/day of public-market supply is instead coming from a Fundrise-affiliated entity liquidating shares it acquired in a pre-listing registered offering. This means per-share claims on Anthropic and other holdings are static, not decaying. The bear case rests on premium-to-NAV math and the September 2026 platform-investor lockup expiry rather than ongoing dilution. Default VCX market price updated from $158.98 to $240 to reflect more recent trading. Thanks to /u/CapAggravating784 on Reddit for the correction.</div>
        <div>• <strong>May 10, 2026</strong> — Initial publication.</div>
        <div style={{ marginTop: 16 }}><strong>Sources:</strong></div>
        <div>• Position data: Fundrise Innovation Fund LLC, Schedule of Investments as of December 31, 2025 (unaudited), filed with the SEC. Fund formerly known as Fundrise Growth Tech Fund LLC; renamed January 20, 2026.</div>
        <div>• Share count: ~35.9M shares outstanding per cap-table reconciliation by Reddit user Fit_Equal6932 (<a href="https://www.reddit.com/r/VCX_Fundrise/s/bit09tvNnO" target="_blank" rel="noopener noreferrer" style={{ color: "#d97706", textDecoration: "underline" }}>r/VCX_Fundrise post</a>), anchored on a February 20, 2026 Fundrise platform snapshot ($563M AUM at $18.27 NAV) and walked forward through Q1 2026 events. The next authoritative disclosure will be VCX's Q1 2026 N-PORT filing, due to be filed with the SEC by late May 2026.</div>
        <div>• Supply mechanics: Daily public-market sales since the NYSE listing are largely attributable to Fundrise Real Estate Interval Fund's wholly-owned subsidiary (Tech Infrastructure REIT) liquidating shares it acquired in a February 24, 2026 registered offering. This is affiliate redistribution under Rule 144, not primary issuance by VCX.</div>
        <div>• Secondary-market price-per-share inputs: User-supplied, with defaults from Fundrise's 12/31/25 marks. Recommended sources for current pricing include Hiive, Caplight, Notice, and Forge Global.</div>
        <div>• NYSE listing: VCX began trading on the New York Stock Exchange on March 19, 2026.</div>
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
    padding: "48px 56px",
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
    color: "#1c1917",
    border: "1px solid #1c1917",
    padding: "10px 16px",
    cursor: "pointer",
    fontWeight: 500,
    borderRadius: 0,
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
};
