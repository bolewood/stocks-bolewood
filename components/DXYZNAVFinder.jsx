"use client";

import React, { useState, useMemo, useEffect, useRef, useSyncExternalStore } from "react";
import {
  FILED,
  PROSPECTUS_424B5,
  Q1_ATM,
  Q2_ATM,
  H1_ATM,
  NEW_SHELF,
  SHARE_REPURCHASE,
  DEFAULTS as ATM_DEFAULTS,
  impliedFiledShares,
  completedTradingRows,
  calibratePostFiling,
  computeAtmBridge,
} from "../lib/dxyzAtm.mjs";
import historySnapshot from "../app/api/dxyz-history/snapshot.json";
import {
  SPCX_JUNE30_MARK_PPS,
  SPCX_YAHOO_SYMBOL,
} from "../lib/dxyzSpcx.mjs";
import {
  ANTHROPIC_SPV,
  OPENAI_EQUITY_SPV,
  markPerUnit,
  anthropicNavPerDollarPps,
  NCSRS_JUNE_30,
  NPORT_JUNE_30,
  AUGUST_OPENAI_PURCHASE,
  AUGUST_OPENAI_SOURCE,
} from "../lib/dxyzHoldings.mjs";
import { SHARE_DENOMINATED, DOLLAR_DENOMINATED, OTHER_HOLDINGS, calculateDxyzNav } from "../lib/dxyzNav.mjs";
import { CAPITALIZATION, DEFAULT_DXYZ_OAI_ENTRY_PRICE, unitPrice } from "../reference/unitExposure.mjs";
import { startJsonPoll } from "../lib/pollLivePrices.mjs";

// DXYZ NAV Finder
// Source: Destiny Tech100 N-CSRS and NPORT-P as of June 30, 2026 (filed
// Aug 28). Unit counts are NPORT balance fields. Share count is the
// N-CSRS 47,657,338. ATM after June 30 is estimated from July 1.

const DXYZ_SHARES_OUTSTANDING_M = impliedFiledShares() / 1_000_000;
const COMMISSION_DEFAULT_PCT = ATM_DEFAULTS.commissionRate * 100;
const ANTHROPIC_NAV_SENS = anthropicNavPerDollarPps();

const ENTRY = CAPITALIZATION.dxyzOpenaiEntry;
const subscribeHydration = () => () => {};
const clientReady = () => true;
const serverReady = () => false;

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

const formatEvT = (dollars) => {
  const t = dollars / 1e12;
  if (!Number.isFinite(t)) return "";
  return String(Number(t.toFixed(3)));
};

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
  const ready = useSyncExternalStore(subscribeHydration, clientReady, serverReady);
  const [includeAugust, setIncludeAugust] = useState(true);
  const [entryPrice, setEntryPrice] = useState(DEFAULT_DXYZ_OAI_ENTRY_PRICE);
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
  const [dxyzPrice, setDxyzPrice] = useState(32.97);
  const [liveSpcx, setLiveSpcx] = useState(null);
  const [priceSource, setPriceSource] = useState("default");
  const spcxFollowLive = useRef(true);

  // ── ATM Issuance Bridge state ──────────────────────────────────────────
  // Ships with the checked-in snapshot so first paint is deterministic AND
  // build-stable (a date-dependent initializer would bake the build day's
  // filtering into the prerendered HTML and mismatch on hydration). The
  // completed-sessions filter is applied client-side in the effect below,
  // then the live Yahoo feed replaces the rows entirely.
  const [historyRows, setHistoryRows] = useState(historySnapshot.rows);
  const [historySource, setHistorySource] = useState("snapshot");
  const [atmMode, setAtmMode] = useState("calibrated"); // "filed" | "calibrated" | "custom"
  const [commissionPct, setCommissionPct] = useState(String(COMMISSION_DEFAULT_PCT));
  // Custom-mode overrides; empty string = use the calibrated default.
  const [atmCustom, setAtmCustom] = useState({
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
  const [evDrafts, setEvDrafts] = useState({});

  const updatePPS = (name, val) => {
    if (name === "SpaceX") spcxFollowLive.current = false;
    setEvDrafts((prev) => {
      if (!(name in prev)) return prev;
      const next = { ...prev };
      delete next[name];
      return next;
    });
    setPpsOverrides((prev) => ({ ...prev, [name]: val }));
    setActiveScenario(null);
  };

  const updateImpliedEV = (name, trillionStr) => {
    const row = SHARE_DENOMINATED.find((p) => p.name === name);
    if (!row?.fdShares) return;
    setEvDrafts((prev) => ({ ...prev, [name]: trillionStr }));
    const t = parseFloat(trillionStr);
    if (!Number.isFinite(t) || t < 0) return;
    setPpsOverrides((prev) => ({
      ...prev,
      [name]: unitPrice({ valuation: t * 1e12, fdShares: row.fdShares }),
    }));
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

  const spaceXMarkPps = () => liveSpcx ?? Number(SPCX_JUNE30_MARK_PPS.toFixed(2));

  const resetToMark = () => {
    spcxFollowLive.current = true;
    setEvDrafts({});
    setPpsOverrides(
      SHARE_DENOMINATED.reduce((acc, p) => ({
        ...acc,
        [p.name]: p.yahooSymbol === SPCX_YAHOO_SYMBOL ? spaceXMarkPps() : p.mark_pps_1231,
      }), {})
    );
    setDollarMOICs(DOLLAR_DENOMINATED.reduce((acc, p) => ({ ...acc, [p.name]: 1.0 }), {}));
    setOtherMOICs(OTHER_HOLDINGS.reduce((acc, p) => ({ ...acc, [p.name]: 1.0 }), {}));
    setActiveScenario("mark");
    updateURL("mark");
  };

  const restoreJuneSnapshot = () => {
    resetToMark();
    spcxFollowLive.current = false;
    setEvDrafts({});
    setPpsOverrides(Object.fromEntries(SHARE_DENOMINATED.map(p => [p.name, p.mark_pps_1231])));
    setDxyzShares(DXYZ_SHARES_OUTSTANDING_M);
    setIncludeAugust(false);
    setAtmMode("filed");
    setEntryPrice(DEFAULT_DXYZ_OAI_ENTRY_PRICE);
  };

  const applyAggressive = () => {
    spcxFollowLive.current = false;
    setEvDrafts({});
    setPpsOverrides({
      "SpaceX": 142,
      "Anthropic": Number((2 * markPerUnit(ANTHROPIC_SPV)).toFixed(2)),
      "OpenAI": Number((2 * markPerUnit(OPENAI_EQUITY_SPV)).toFixed(2)),
      "Revolut": 2000,
      "Discord": 400,
      "Klarna": 45,
      "Chime": 35,
      "Flexport": 5,
    });
    setDollarMOICs({
      ...DOLLAR_DENOMINATED.reduce((acc, p) => ({ ...acc, [p.name]: 1.0 }), {}),
      "OpenEvidence": 2.0,
      "Shield AI": 1.5,
      "Databricks": 1.5,
      "CHAOS Industries": 1.5,
      "Hermeus": 1.5,
      "Beast Industries": 1.5,
      "Tenstorrent": 1.5,
      "Skild AI": 1.5,
      "Mercury": 1.5,
      "Ferox Games": 1.5,
    });
    setOtherMOICs(OTHER_HOLDINGS.reduce((acc, p) => ({ ...acc, [p.name]: 1.0 }), {}));
    setActiveScenario("aggressive");
    updateURL("aggressive");
  };

  const applyDream = () => {
    spcxFollowLive.current = false;
    setEvDrafts({});
    setPpsOverrides({
      "SpaceX": 284,
      "Anthropic": Number((4 * markPerUnit(ANTHROPIC_SPV)).toFixed(2)),
      "OpenAI": Number((4 * markPerUnit(OPENAI_EQUITY_SPV)).toFixed(2)),
      "Revolut": 3000,
      "Discord": 800,
      "Klarna": 90,
      "Chime": 70,
      "Flexport": 10,
    });
    setDollarMOICs({
      ...DOLLAR_DENOMINATED.reduce((acc, p) => ({ ...acc, [p.name]: 1.0 }), {}),
      "OpenEvidence": 4.0,
      "Shield AI": 3.0,
      "Databricks": 3.0,
      "CHAOS Industries": 3.0,
      "Hermeus": 3.0,
      "Beast Industries": 3.0,
      "Tenstorrent": 3.0,
      "Skild AI": 3.0,
      "Mercury": 3.0,
      "Ferox Games": 3.0,
    });
    setOtherMOICs(OTHER_HOLDINGS.reduce((acc, p) => ({ ...acc, [p.name]: 1.0 }), {}));
    setActiveScenario("dream");
    updateURL("dream");
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const scenario = params.get("scenario");
    if (scenario === "aggressive") {
      // Initial URL seed after hydration; intentionally runs once.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      applyAggressive();
    } else if (scenario === "dream") {
      applyDream();
    }
    // Presets are only URL defaults on mount, not reactive dependencies.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    return startJsonPoll("/api/prices", {
      onData: (data) => {
        if (data.prices?.DXYZ) setDxyzPrice(data.prices.DXYZ);
        if (data.prices?.SPCX) {
          setLiveSpcx(data.prices.SPCX);
          if (spcxFollowLive.current) {
            setPpsOverrides((prev) => ({ ...prev, SpaceX: data.prices.SPCX }));
          }
        }
        setPriceSource(data.source || "fallback");
      },
      onError: () => setPriceSource("fallback"),
    });
  }, []);

  useEffect(() => {
    // Client-side only: drop the in-progress session from the baked-in
    // snapshot (the route applies the same filter to what it serves).
    // Post-close, today's completed bar is kept.
    const nyParts = new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/New_York",
      hour12: false,
      year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit",
    }).formatToParts(new Date());
    const nyGet = (type) => nyParts.find((p) => p.type === type)?.value;
    // Date filtering is deferred until hydration to keep SSR deterministic.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setHistoryRows(
      completedTradingRows(
        historySnapshot.rows,
        `${nyGet("year")}-${nyGet("month")}-${nyGet("day")}`,
        parseInt(nyGet("hour"), 10) * 60 + parseInt(nyGet("minute"), 10)
      )
    );

    fetch("/api/dxyz-history", { cache: "no-store" })
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data.rows) && data.rows.length > 0) {
          setHistoryRows(data.rows);
          setHistorySource(data.source || "snapshot");
        }
      })
      .catch(() => setHistorySource("snapshot"));
  }, []);

  const calc = useMemo(() => calculateDxyzNav({
    ppsOverrides, dxyzShares, dollarMOICs, otherMOICs, includeAugust, entryPrice,
  }), [ppsOverrides, dxyzShares, dollarMOICs, otherMOICs, includeAugust, entryPrice]);


  // ── ATM Issuance Bridge math ───────────────────────────────────────────
  const atmCal = useMemo(() => calibratePostFiling(historyRows), [historyRows]);

  const num = (s) => {
    const v = parseFloat(s);
    return Number.isFinite(v) ? v : null;
  };

  // One options object feeds both the bridge and the sensitivity table so
  // custom overrides (capacity, premium, drag, as-of date) apply to both.
  const atmOpts = useMemo(() => {
    const commission = num(commissionPct);
    const opts = {
      mode: atmMode,
      rows: historyRows,
      markedNetAssets: calc.totalNAV,
      baselineShares: dxyzShares * 1_000_000,
      commissionRate: (commission ?? COMMISSION_DEFAULT_PCT) / 100,
    };
    if (atmMode === "custom") {
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
    return opts;
  }, [atmMode, historyRows, calc.totalNAV, dxyzShares, commissionPct, atmCustom]);

  const atmBridge = useMemo(() => computeAtmBridge(atmOpts), [atmOpts]);

  // Low / base / high participation sensitivity (post–June 30).
  // Same options as the bridge above, varying participation only.
  const atmSensitivity = useMemo(() => {
    if (atmMode === "filed") return [];
    return [
      { label: "Low", participation: 0.05 },
      { label: "Calibrated", participation: atmCal.participation },
      // 16.4% = the Aug–Sep 2025 pace: ~2.97M filed shares (N-CSR total less
      // the Oct–Dec 8,121,853 disclosed in the shareholder letter) into
      // ~18.1M observed traded volume — inferred, the historical high-water mark.
      { label: "High", participation: 0.164 },
    ].map(({ label, participation }) => ({
      label,
      participation,
      bridge: computeAtmBridge({ ...atmOpts, mode: atmMode, participation }),
    }));
  }, [atmMode, atmOpts, atmCal]);

  // Headline NAV: pro forma when the bridge is active, marked baseline otherwise.
  const effectiveNav = atmBridge.proFormaNav;
  const effectiveShares = atmBridge.proFormaShares;
  const bridgeActive = atmMode !== "filed";

  return (
    <fieldset disabled={!ready} aria-busy={!ready} style={{ ...styles.container, border: 0, minWidth: 0 }} className="vcx-container">
      <div style={styles.header}>
        <div style={styles.eyebrow} className="vcx-eyebrow">DESTINY TECH100 · NYSE: DXYZ · ESTIMATED NAV CALCULATOR</div>
        <h1 style={styles.title} className="vcx-title">
          DXYZ <span style={styles.titleAccent}>NAV Finder</span>
        </h1>
        <p style={styles.subtitle} className="vcx-subtitle">
          DXYZ is a closed-end fund. Box 1 marks June filed units and the estimated August OpenAI units to a price per share (Anthropic, OpenAI equity, SpaceX with per-SPV carry). Box 2 applies MOICs to remaining SPV lots. DXYZ does not mark private names to the last announced primary round.
        </p>
      </div>

      <div style={styles.howToBox}>
        <div style={styles.howToTitle}>How this works</div>
        <ol style={styles.howToList}>
          <li style={{ marginBottom: 6 }}>The fund holds share-equivalent units (Box 1) and other SPVs (Box 2). Anthropic is a $/share input: {ANTHROPIC_SPV.units.toLocaleString("en-US")} units, so ΔNAV/share = ${ANTHROPIC_NAV_SENS.toFixed(6)} per $1 of Anthropic price.</li>
          <li style={{ marginBottom: 6 }}>Update price-per-share for Box 1 (or implied EV ($T) for Anthropic and OpenAI) and MOIC for Box 2. Private-price defaults are the June 30, 2026 marks. Subsequent purchases through August 13 are included by default; their cash cost is deducted once.</li>
          <li style={{ marginBottom: 6 }}>SpaceX uses the live Yahoo SPCX quote with per-SPV carried interest (MWAM 10%; others 0%). June 30 units are already post 5-for-1 Unit Parity.</li>
          <li style={{ marginBottom: 6 }}>The ATM Issuance Bridge estimates share issuance since June 30 (default: Calibrated Estimate). April 1–June 30 sales of 17,191,674 shares are already in the filed baseline — the ATM toggle only controls issuance. Use Restore June 30 snapshot for the original filed holdings and marks.</li>
          <li>The bottom bar shows the implied premium vs. the current DXYZ market price.</li>
        </ol>
      </div>

      <div style={styles.controls} className="vcx-controls">
        <div style={styles.controlGroup}>
          <label style={styles.label}>DXYZ Shares Outstanding (M)</label>
          <input
            type="number"
            step="0.01" min="0.000001" aria-label="DXYZ shares outstanding (millions)"
            value={dxyzShares}
            onChange={(e) => setDxyzShares(Number.isFinite(Number(e.target.value)) && Number(e.target.value) > 0 ? Number(e.target.value) : DXYZ_SHARES_OUTSTANDING_M)}
            style={styles.smallInput}
            className="vcx-input vcx-small-input"
          />
        </div>
        <div style={styles.controlGroup}>
          <label style={styles.label}>DXYZ Market Price ($)</label>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <input
              type="number"
              step="0.01" min="0" aria-label="DXYZ market price"
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
            { key: "mark", label: "Baseline marks / live SPCX" },
            { key: "aggressive", label: "Aggressive" },
            { key: "dream", label: "Dream Scenario" },
          ].map(({ key, label }) => {
            const isActive = activeScenario === key;
            return (
              <button
                key={key}
                onClick={() => { if (key === "mark") resetToMark(); else if (key === "aggressive") applyAggressive(); else applyDream(); }}
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

      <div style={styles.issuanceBox}>
        <h2 style={{ ...styles.sectionTitle, fontSize: "20px" }}>August OpenAI purchase</h2>
        {!ready && <p role="status">Preparing calculator controls…</p>}
        <p style={styles.issuanceMeta}>
          <a href={AUGUST_OPENAI_SOURCE.url} target="_blank" rel="noopener noreferrer" style={{ color: "#92400e", textDecoration: "underline" }}>The August 28 filing</a> reports
          a {fmt$(AUGUST_OPENAI_PURCHASE.costUsd)} purchase on {AUGUST_OPENAI_PURCHASE.date}, paid from existing cash.
          The purchase price and units were not disclosed. This page now uses the same holding records, entry-price assumptions and unit calculation as <a href="/ai?holdings=estimated" style={{ color: "#92400e", textDecoration: "underline" }}>AI Per $</a>.
        </p>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center", margin: "16px 0" }}>
          <label><input type="checkbox" checked={includeAugust} onChange={e => setIncludeAugust(e.target.checked)} /> Include subsequent purchases through August 13</label>
          <ConfBadge level={includeAugust ? "ESTIMATED" : "FILED"} />
          <button type="button" onClick={restoreJuneSnapshot} style={styles.presetBtn}>Restore June 30 snapshot</button>
        </div>
        {includeAugust && <>
          <label htmlFor="dxyz-entry" style={styles.label}>Assumed August OpenAI entry price / share</label>
          <div style={{ display: "flex", alignItems: "center", gap: 18, flexWrap: "wrap", margin: "10px 0" }}>
            <input id="dxyz-entry" type="range" min={ENTRY.minPrice} max={ENTRY.maxPrice} step="any" value={entryPrice}
              onChange={e => setEntryPrice(Number(e.target.value))} style={{ flex: "1 1 220px", accentColor: "#d97706" }} />
            <input aria-label="August OpenAI entry price in dollars" type="number" min={ENTRY.minPrice} max={ENTRY.maxPrice} step="any" value={entryPrice}
              onChange={e => { const v = Number(e.target.value); if (v > 0) setEntryPrice(Math.min(ENTRY.maxPrice, Math.max(ENTRY.minPrice, v))); }}
              style={{ ...styles.smallInput, width: 180, fontSize: 14 }} className="vcx-input" />
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
            {[["Lower entry", ENTRY.lowPrice], ["Default proxy", ENTRY.defaultPrice], ["Higher entry", ENTRY.highPrice]].map(([label, value]) =>
              <button key={label} type="button" onClick={() => setEntryPrice(value)} style={styles.presetBtn}>{label} ${value.toFixed(2)}</button>)}
          </div>
          <p style={styles.issuanceMeta}>The default is the June preferred mark, used as a proxy for August common shares. The ±25% choices are sensitivity assumptions, not observed transaction quotes. Common/preferred parity is assumed. Change OpenAI PPS in the table to value both equity lots; changing that mark leaves the estimated purchase units fixed.</p>
          <p style={styles.issuanceMeta} data-testid="august-summary">
            Estimated August units: <strong>{fmtNum(calc.acquisitionLot.units)}</strong> · June filed units: <strong>{fmtNum(OPENAI_EQUITY_SPV.units)}</strong><br />
            August position: <strong>{fmt$exact(calc.augustValue)}</strong> · Gain / loss versus cost: <strong>{fmt$exact(calc.augustGain)}</strong> (${(calc.augustGain / (dxyzShares * 1e6)).toFixed(2)} per DXYZ share, before ATM).<br />
            Cash moved into investments: <strong>{fmt$(calc.cashSpent)}</strong>, including $15M Fluidstack and $4M Boom held at cost. June cash less these purchases is shown below; other cash movements and later valuation changes are unknown.
          </p>
          {bridgeActive && atmBridge.asOfDate < AUGUST_OPENAI_PURCHASE.date && <p style={{ ...styles.issuanceMeta, color: "#92400e" }}>Mixed dates: holdings include the August 13 purchase, but the ATM history ends {atmBridge.asOfDate}. Later issuance and expenses are not covered by that history.</p>}
        </>}
      </div>

      <div style={styles.section}>
        <div style={styles.sectionHeader} className="vcx-section-header">
          <span style={styles.sectionNum}>⇄</span>
          <h2 style={{ ...styles.sectionTitle, fontSize: "20px" }}>ATM Issuance Bridge</h2>
          <span style={styles.sectionMeta} className="vcx-section-meta">Estimated share issuance since the June 30 filing</span>
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
            ⚠ Estimated, not company reported — DXYZ&apos;s last filed NAV is ${FILED.navPerShare.toFixed(2)} as of June 30, 2026
          </div>
        )}

        {bridgeActive && (
          <div style={{ display: "flex", gap: "20px", alignItems: "flex-end", flexWrap: "wrap", marginBottom: "16px" }} className="vcx-controls">
            <div style={styles.controlGroup}>
              <label style={styles.label}>Commission (%)</label>
              <input
                type="number" step="0.1" min="0" max={PROSPECTUS_424B5.commissionCap * 100}
                value={commissionPct}
                onChange={(e) => setCommissionPct(e.target.value)}
                style={{ ...styles.smallInput, width: "90px", fontSize: "14px" }}
                className="vcx-input vcx-small-input"
              />
              <div style={{ fontSize: "10px", color: "#78716c", fontFamily: "'JetBrains Mono', monospace", marginTop: "4px" }}>
                Cap {(PROSPECTUS_424B5.commissionCap * 100).toFixed(1)}%; filed 2025 effective ~0.95% (N-CSR)
              </div>
            </div>
            {atmMode === "custom" && (
              <>
                {[
                  { key: "partPct", label: "Participation (%)", ph: (atmCal.participation * 100).toFixed(1) },
                  { key: "capacityM", label: "ATM Capacity ($M)", ph: String(PROSPECTUS_424B5.capacityGross / 1_000_000) },
                  { key: "premPct", label: "Min Premium (%)", ph: "0" },
                  { key: "dragPct", label: "Expense Drag (%/yr)", ph: (ATM_DEFAULTS.expenseDragAnnualRate * 100).toFixed(1) },
                ].map(({ key, label, ph }) => (
                  <div style={styles.controlGroup} key={key}>
                    <label style={styles.label}>{label}</label>
                    <input
                      type="number" step="any" min="0"
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
                    min={ATM_DEFAULTS.postFilingStart}
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

        <div style={styles.tableWrap}>
          <div style={styles.tableHeaderRow} className="vcx-table-header">
            <div style={{ ...styles.th, flex: "2.4" }}>Bridge Step</div>
            <div style={{ ...styles.th, flex: "1.3", textAlign: "right" }}>Shares</div>
            <div style={{ ...styles.th, flex: "1.5", textAlign: "right" }}>Net Assets / Proceeds</div>
            <div style={{ ...styles.th, flex: "1.2", textAlign: "right" }}>NAV / Share</div>
          </div>
          <div style={styles.tr} className="vcx-row">
            <div style={{ ...styles.td, flex: "2.4" }}>
              <div style={styles.companyName}>Filed NAV — June 30, 2026 <ConfBadge level="FILED" /></div>
              <div style={styles.companyNote}>
                N-CSRS: printed ${FILED.navPerShare.toFixed(2)} NAV; {impliedFiledShares().toLocaleString("en-US")} shares filed; exact NAV ${ (FILED.netAssets / impliedFiledShares()).toFixed(5) }
              </div>
            </div>
            <div style={{ ...styles.td, flex: "1.3", textAlign: "right", fontVariantNumeric: "tabular-nums" }} data-label="Shares">{fmtM(impliedFiledShares())}</div>
            <div style={{ ...styles.td, flex: "1.5", textAlign: "right", fontVariantNumeric: "tabular-nums" }} data-label="Net Assets">{fmt$(FILED.netAssets)}</div>
            <div style={{ ...styles.td, flex: "1.2", textAlign: "right", fontVariantNumeric: "tabular-nums", fontWeight: 600 }} data-label="NAV/Share">${FILED.navPerShare.toFixed(2)}</div>
          </div>

          {(Math.abs(atmBridge.markedNav - FILED.navPerShare) > 0.005 || Math.abs(dxyzShares - DXYZ_SHARES_OUTSTANDING_M) > 0.005) && (
            <div style={styles.tr} className="vcx-row">
              <div style={{ ...styles.td, flex: "2.4" }}>
                <div style={styles.companyName}>Your re-marked baseline <ConfBadge level="ESTIMATED" /></div>
                <div style={styles.companyNote}>Your holding marks, selected purchases and share count — replaces the filed baseline in this bridge</div>
              </div>
              <div style={{ ...styles.td, flex: "1.3", textAlign: "right", fontVariantNumeric: "tabular-nums" }} data-label="Shares">{fmtM(1_000_000 * dxyzShares)}</div>
              <div style={{ ...styles.td, flex: "1.5", textAlign: "right", fontVariantNumeric: "tabular-nums" }} data-label="Net Assets">{fmt$(calc.totalNAV)}</div>
              <div style={{ ...styles.td, flex: "1.2", textAlign: "right", fontVariantNumeric: "tabular-nums", fontWeight: 600 }} data-label="NAV/Share">${atmBridge.markedNav.toFixed(2)}</div>
            </div>
          )}

          {bridgeActive && (
            <>
              {atmBridge.aprMay.shares > 0 && (
              <div style={styles.tr} className="vcx-row">
                <div style={{ ...styles.td, flex: "2.4" }}>
                  <div style={styles.companyName}>+ Extra Apr–May ATM (counterfactual) <ConfBadge level="INFERRED" /></div>
                  <div style={styles.companyNote}>
                    {fmtM(atmBridge.aprMay.shares)} shares on top of filed Q2 sales — not in the default calibrated path
                  </div>
                </div>
                <div style={{ ...styles.td, flex: "1.3", textAlign: "right", fontVariantNumeric: "tabular-nums" }} data-label="Shares">+{fmtM(atmBridge.aprMay.shares)}</div>
                <div style={{ ...styles.td, flex: "1.5", textAlign: "right", fontVariantNumeric: "tabular-nums" }} data-label="Net Proceeds">+{fmt$(atmBridge.aprMay.net)}</div>
                <div style={{ ...styles.td, flex: "1.2", textAlign: "right" }} data-label="NAV/Share" />
              </div>
              )}

              <div style={styles.tr} className="vcx-row">
                <div style={{ ...styles.td, flex: "2.4" }}>
                  <div style={styles.companyName}>+ July 1 – {atmBridge.asOfDate} ATM (new $1B program) <ConfBadge level="ESTIMATED" /></div>
                  <div style={styles.companyNote}>
                    {(atmBridge.participation * 100).toFixed(1)}% of daily volume, calibrated from filed Q2 sales ÷ Apr–Jun volume; issued {atmBridge.postMay.daysIssued} of {atmBridge.postMay.daysIssued + atmBridge.postMay.daysSkipped} days (none when price ≤ rolling NAV{atmBridge.postMay.exhaustedOn ? `; capacity exhausted ${atmBridge.postMay.exhaustedOn}` : ""}). Apr 1–Jun 30 sales of {Q2_ATM.shares.toLocaleString("en-US")} shares are already in the June 30 baseline.
                  </div>
                </div>
                <div style={{ ...styles.td, flex: "1.3", textAlign: "right", fontVariantNumeric: "tabular-nums" }} data-label="Shares">+{fmtM(atmBridge.postMay.shares)}</div>
                <div style={{ ...styles.td, flex: "1.5", textAlign: "right", fontVariantNumeric: "tabular-nums" }} data-label="Net Proceeds">+{fmt$(atmBridge.postMay.net)}</div>
                <div style={{ ...styles.td, flex: "1.2", textAlign: "right" }} data-label="NAV/Share" />
              </div>

              <div style={styles.tr} className="vcx-row">
                <div style={{ ...styles.td, flex: "2.4" }}>
                  <div style={styles.companyName}>− Expense accrual <ConfBadge level="ESTIMATED" /></div>
                  <div style={styles.companyNote}>2.50% management fee (424B5) annualized over {atmBridge.days} days since June 30</div>
                </div>
                <div style={{ ...styles.td, flex: "1.3", textAlign: "right" }} data-label="Shares">—</div>
                <div style={{ ...styles.td, flex: "1.5", textAlign: "right", fontVariantNumeric: "tabular-nums" }} data-label="Net Proceeds">−{fmt$(atmBridge.drag)}</div>
                <div style={{ ...styles.td, flex: "1.2", textAlign: "right" }} data-label="NAV/Share" />
              </div>
            </>
          )}

          <div style={{ ...styles.subtotalRow, background: "#1c1917", color: "#fef3c7" }} className="vcx-subtotal">
            <div style={{ flex: "2.4" }}>
              {bridgeActive
                ? `= Pro forma (est. ${atmBridge.asOfDate})`
                : Math.abs(atmBridge.markedNav - FILED.navPerShare) > 0.005 || Math.abs(dxyzShares - DXYZ_SHARES_OUTSTANDING_M) > 0.005
                ? "= Your re-marked baseline (not filed; no estimated issuance)"
                : "= Filed baseline (no estimated issuance)"}
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
            <span>Modeled ATM cap: <strong>{fmt$(atmBridge.postMay.capacityRemaining)}</strong> remaining of the May 26 424B5 $1B illustration — not a filed leftover. New shelf {NEW_SHELF.fileNumber} authorizes an indeterminate amount.</span>
            <span>Share repurchase (Aug 2026): Board may buy back shares <strong>below then-current NAV</strong>, discretionary as to size and timing. Symmetric to the open ATM.</span>
            <span>History: {historyRows.length} trading days ·{" "}
              <span style={{ color: historySource === "live" || historySource === "cache" ? "#15803d" : historySource === "stale" ? "#d97706" : "#78716c" }}>
                {historySource === "live" || historySource === "cache"
                  ? "● LIVE (Yahoo)"
                  : historySource === "stale"
                  ? "◐ CACHED (Yahoo unreachable)"
                  : `○ SNAPSHOT (${historySnapshot.asOf})`}
              </span>
            </span>
          </div>
        )}

        {bridgeActive && atmSensitivity.length > 0 && (
          <div style={{ ...styles.tableWrap, marginTop: "16px" }}>
            <div style={styles.tableHeaderRow} className="vcx-table-header">
              <div style={{ ...styles.th, flex: "1.6" }}>Participation Scenario</div>
              <div style={{ ...styles.th, flex: "1.2", textAlign: "right" }}>Post-6/30 Shares</div>
              <div style={{ ...styles.th, flex: "1.2", textAlign: "right" }}>Gross Raised</div>
              <div style={{ ...styles.th, flex: "1.2", textAlign: "right" }}>Pro Forma NAV</div>
            </div>
            {atmSensitivity.map(({ label, participation, bridge }) => (
              <div key={label} style={{ ...styles.tr, ...(label === "Calibrated" ? { background: "#fffbeb" } : {}) }} className="vcx-row">
                <div style={{ ...styles.td, flex: "1.6" }}>
                  <div style={styles.companyName}>{label} — {(participation * 100).toFixed(1)}%</div>
                  {label === "High" && (
                    <div style={styles.companyNote}>Aug–Sep 2025 pace (filed shares ÷ observed volume) — the program&apos;s high-water mark</div>
                  )}
                </div>
                <div style={{ ...styles.td, flex: "1.2", textAlign: "right", fontVariantNumeric: "tabular-nums" }} data-label="Post-6/30 Shares">{fmtM(bridge.postMay.shares)}</div>
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
          The June 30, 2026 NPORT-P reports share-equivalent units (N-CSRS footnotes (f)/(g)/(h)/(i)). Anthropic is 386,088 Magnitude ANC III units at a filed $610.41/unit; OpenAI equity is 50,895 Goanna units at $688.49; the three SpaceX SPVs are post 5-for-1 Unit Parity and mark to quoted SPCX with per-SPV carry (MWAM 10%). Level 3 inputs are volume-weighted secondary prices, index prices, and recent transactions — not announced primary rounds. Baseline NAV is the N-CSRS print: $34.30 on 47,657,338 shares, net assets $1,634,830,252, investments $1,640,039,144. Issuance after June 30 is modeled in the ATM bridge and never restates these filed figures. The August OpenAI lot is now valued separately, with an equal cost deduction from cash; only its gain or loss changes NAV.
        </div>
      </div>

      <div style={styles.section}>
        <div style={styles.sectionHeader} className="vcx-section-header">
          <span style={styles.sectionNum}>01</span>
          <h2 style={styles.sectionTitle}>Positions valued by share price</h2>
          <span style={styles.sectionMeta} className="vcx-section-meta">Edit PPS or implied EV ($T) — Anthropic/OpenAI EV uses estimated FD from /ai</span>
        </div>

        <div style={styles.tableWrap}>
          <div style={styles.tableHeaderRow} className="vcx-table-header">
            <div style={{ ...styles.th, flex: "2.0" }}>Company</div>
            <div style={{ ...styles.th, flex: "1.1", textAlign: "right" }}>Shares (K)</div>
            <div style={{ ...styles.th, flex: "1.3", textAlign: "right" }}>Your PPS ($)</div>
            <div style={{ ...styles.th, flex: "1.3", textAlign: "right" }}>Implied EV ($T)</div>
            <div style={{ ...styles.th, flex: "1.3", textAlign: "right" }}>Position Value</div>
            <div style={{ ...styles.th, flex: "1.1", textAlign: "right" }}>$/DXYZ share</div>
            <div style={{ ...styles.th, flex: "0.9", textAlign: "right" }}>¢ per $1</div>
          </div>

          {calc.shareRows.map((r) => {
            const delta = ((r.pps - r.mark_pps_1231) / r.mark_pps_1231) * 100;
            const evName = r.inputName || r.name;
            return (
              <div key={r.name} data-position={r.name} style={styles.tr} className="vcx-row">
                <div style={{ ...styles.td, flex: "2.0" }}>
                  <div style={styles.companyName}>
                    {r.name} {r.estimated && <ConfBadge level="ESTIMATED" />}
                    {r.yahooSymbol ? (
                      <span style={styles.tickerTag}> {r.yahooSymbol}</span>
                    ) : null}
                  </div>
                  <div style={styles.companyNote}>{r.note}</div>
                </div>
                <div style={{ ...styles.td, flex: "1.1", textAlign: "right", fontVariantNumeric: "tabular-nums" }} data-label="Shares (K)">
                  {fmtNum(r.shares_k)}
                </div>
                <div style={{ ...styles.td, flex: "1.3", textAlign: "right" }} className="vcx-pps-cell" data-label="Your PPS ($)">
                  <input
                    type="number"
                    step="any"
                    min="0" aria-label={`${r.name} price per share`}
                    value={ppsOverrides[evName]}
                    onChange={(e) => updatePPS(evName, e.target.value)}
                    style={styles.ppsInput}
                    className="vcx-input"
                  />
                  {Math.abs(delta) > 0.5 && (
                    <div style={{ ...styles.delta, color: delta > 0 ? "#15803d" : "#b91c1c" }}>
                      {delta > 0 ? "▲" : "▼"} {Math.abs(delta).toFixed(0)}% vs mark
                    </div>
                  )}
                  {r.yahooSymbol === SPCX_YAHOO_SYMBOL &&
                  liveSpcx != null &&
                  Math.abs(Number(ppsOverrides[evName]) - liveSpcx) < 0.005 ? (
                    <div style={{ ...styles.delta, color: "#15803d" }}>● LIVE {r.yahooSymbol}</div>
                  ) : null}
                </div>
                <div style={{ ...styles.td, flex: "1.3", textAlign: "right" }} className="vcx-pps-cell" data-label="Implied EV ($T)">
                  {r.fdShares > 0 ? (
                    <>
                      <input
                        type="number"
                        step="0.001"
                        min="0"
                        aria-label={`${r.name} implied enterprise value in trillions`}
                        value={evDrafts[r.name] ?? formatEvT(r.companyValue)}
                        onChange={(e) => updateImpliedEV(r.name, e.target.value)}
                        onBlur={() => setEvDrafts((prev) => {
                          if (!(r.name in prev)) return prev;
                          const next = { ...prev };
                          delete next[r.name];
                          return next;
                        })}
                        style={styles.ppsInput}
                        className="vcx-input"
                      />
                      <div style={styles.delta}>est. FD</div>
                    </>
                  ) : null}
                </div>
                <div style={{ ...styles.td, flex: "1.3", textAlign: "right", fontVariantNumeric: "tabular-nums", fontWeight: 500 }} data-label="Position Value">
                  {fmt$(r.positionValue)}
                </div>
                <div style={{ ...styles.td, flex: "1.1", textAlign: "right", fontVariantNumeric: "tabular-nums", color: "#d97706", fontWeight: 600 }} data-label="$/DXYZ share">
                  ${r.navPerShare.toFixed(2)}
                </div>
                <div style={{ ...styles.td, flex: "0.9", textAlign: "right", fontVariantNumeric: "tabular-nums", color: "#1c1917", fontWeight: 600, fontFamily: "'JetBrains Mono', monospace", fontSize: "12px" }} data-label="¢ per $1">
                  {dxyzPrice > 0 ? (r.navPerShare / dxyzPrice * 100).toFixed(1) + "¢" : "—"}
                </div>
              </div>
            );
          })}
          <div style={styles.subtotalRow} className="vcx-subtotal">
            <div style={{ flex: "2.0" }}>Subtotal — share-marked</div>
            <div style={{ flex: "1.1" }} />
            <div style={{ flex: "1.3" }} />
            <div style={{ flex: "1.3" }} />
            <div style={{ flex: "1.3", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{fmt$(calc.shareTotal)}</div>
            <div style={{ flex: "1.1", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
              ${(calc.shareTotal / (dxyzShares * 1_000_000)).toFixed(2)}
            </div>
            <div style={{ flex: "0.9", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
              {dxyzPrice > 0 ? ((calc.shareTotal / (dxyzShares * 1_000_000)) / dxyzPrice * 100).toFixed(1) + "¢" : "—"}
            </div>
          </div>
        </div>
      </div>

      <div style={styles.section}>
        <div style={styles.sectionHeader} className="vcx-section-header">
          <span style={styles.sectionNum}>02</span>
          <h2 style={styles.sectionTitle}>Other SPVs (MOIC)</h2>
          <span style={styles.sectionMeta} className="vcx-section-meta">1.0x = June 30, 2026 filed NAV baseline</span>
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
            <div key={r.name} data-position={r.name} style={styles.tr} className="vcx-row">
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
                  aria-label={`${r.name} value multiple`}
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
              <div key={r.name} data-position={r.name} style={styles.tr} className="vcx-row">
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
                      aria-label={`${r.name} value multiple`}
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
        <div style={styles.gtLabel}>TOTAL MARKED NET ASSETS {includeAugust ? "(INCLUDING SUBSEQUENT PURCHASES)" : "(JUNE HOLDINGS)"}</div>
        <div data-testid="dxyz-net-assets" style={styles.gtValue} className="vcx-gt-value-large">{fmt$exact(calc.totalNAV)}</div>
        <div style={styles.gtDivider} />
        <div style={{ display: "flex", gap: "64px", flexWrap: "wrap" }} className="vcx-gt-metrics">
          <div className="vcx-gt-metric">
            <div style={styles.gtLabel}>NAV / SHARE (6/30 SHARES)</div>
            <div style={{ ...styles.gtValueAccent, ...(bridgeActive ? { fontSize: "40px", color: "#fff" } : {}) }} data-testid="dxyz-nav-per-share" className="vcx-gt-value-accent">${calc.navPerShare.toFixed(2)}</div>
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
              {effectiveNav > 0 ? `${((dxyzPrice / effectiveNav - 1) * 100).toFixed(0)}%` : "—"}
            </div>
          </div>
          <div className="vcx-gt-metric">
            <div style={styles.gtLabel}>{bridgeActive ? "Price ÷ PF NAV" : "Price ÷ NAV"}</div>
            <div style={{ ...styles.gtValue, fontSize: "32px", marginBottom: "4px" }} className="vcx-gt-value-small">{effectiveNav > 0 ? `${(dxyzPrice / effectiveNav).toFixed(2)}x` : "—"}</div>
          </div>
          <div className="vcx-gt-metric">
            <div style={styles.gtLabel}>Implied DXYZ Mkt Cap</div>
            <div style={{ ...styles.gtValue, fontSize: "32px", marginBottom: "4px" }} className="vcx-gt-value-small">{fmt$(dxyzPrice * effectiveShares)}</div>
          </div>
        </div>
        <div style={styles.gtMeta}>
          {bridgeActive
            ? `Estimated NAV from user-supplied marks + modeled ATM issuance (${atmMode} mode) · ${fmtM(effectiveShares)} est. pro forma shares · Estimated, not company reported`
            : `Estimated NAV from user marks${includeAugust ? " and subsequent purchases" : " on June holdings"} · ${dxyzShares.toFixed(2)}M shares outstanding (6/30/26) · No post-June issuance modeled`}
        </div>
      </div>

      <div style={styles.footer}>
        <div><strong>Changelog:</strong></div>
        <div style={{ marginBottom: "16px" }}>
          • <strong>September 16, 2026</strong> — Anthropic and OpenAI Box 1 rows now show implied enterprise value ($T) from PPS × the same estimated FD denominator as /ai. Type 1.2 to mark OpenAI at $1.2T; a new primary may issue shares this identity does not model.<br />
          • <strong>September 5, 2026</strong> — August OpenAI units now use the shared AI Per $ model with adjustable entry price. Both OpenAI equity lots respond to PPS; purchase costs reduce cash once. Fluidstack and Boom subsequent purchases are held at cost. June snapshot remains reproducible.<br />
          • <strong>August 30, 2026</strong> — Baseline rolled to the June 30, 2026 N-CSRS (filed Aug 28) and NPORT-P. Filed shares 47,657,338, net assets $1,634,830,252, printed NAV $34.30. Anthropic, OpenAI equity, and SpaceX move to filed unit counts with per-SPV carry. ATM remaining capacity is no longer shown as a leftover $1B. August 2026 below-NAV repurchase program noted beside the ATM.<br />
          • <strong>August 28, 2026</strong> — Baseline rolled to the Aug 28 424B3 (Supplement No. 1): NAV $34.30 and ~$1.64B portfolio as of June 30, 2026. Anthropic 14.4% ($236.2M), OpenAI equity 2.1% ($34.4M), SpaceX 10.5%. Filed Q2 ATM of 17,191,674 shares is inside the baseline; the issuance bridge now estimates only from July 1. Stated ATM wavg $34.25 does not reconcile to stated net proceeds $715.4M — both stored as printed. Subsequent $150M OpenAI purchase (Aug 13) is a mix shift from cash already in June 30 NAV.<br />
          • <strong>August 20, 2026</strong> — SpaceX Box 1 now uses post-split shares (177,992 N-CSR × 5-for-1 = 889,960) and the live Yahoo SPCX quote from the shared <code>/api/prices</code> cache. Split effective May 4, 2026 per SpaceX 424B4, after the March 31 N-PORT and before the June IPO.<br />
          • <strong>July 9, 2026 (calibration refinement)</strong> — Capped the inferred Apr 1–May 21 issuance proceeds at the original $1B ATM program&apos;s filed remainder (~$429M gross: $1B less $327.1M of 2025 sales per the N-CSR and $244.2M of Q1 sales per the 424B3), deriving a ~$39 effective average price instead of the $46.23 close-VWAP — the new $1B prospectus is dated May 26, so the old shelf was the only capacity available. Commission default recalibrated to 1.0% from the audited 2025 gross-vs-net (~0.95% effective). Sensitivity high bound raised to 16.4%, the filed Aug–Sep 2025 issuance pace. Added the next filed NAV checkpoint (June 30 N-PORT, due ~Aug 29).<br />
          • <strong>July 9, 2026</strong> — Added the ATM Issuance Bridge. Reconciled the March 31 baseline to filed net assets ($742.5M portfolio + $5.9M other net assets = $748.36M per the NPORT-P), correcting implied shares outstanding from 30.23M to ~30.47M. Added Filed Only / Calibrated Estimate / Custom modes that estimate post-March ATM share issuance: Apr 1–May 21 shares (~10.90M) inferred from the May 26 424B5 share count, post-May-26 issuance modeled daily from Yahoo price/volume history at a calibrated ~8.3% volume-participation rate, capped at $1B gross capacity, with no issuance on days at or below rolling NAV. Commission, participation, capacity, premium threshold, expense drag, and as-of date are adjustable. Every figure is labeled Filed, Inferred, or Estimated.<br />
          • <strong>June 15, 2026</strong> — Updated the baseline NAV math to reconcile with DXYZ&apos;s March 31, 2026 SEC disclosures: $24.56 NAV per share, approximately $742.5M of portfolio value, March 31 portfolio weights, and an implied 30.23M share count. Added real-time DXYZ market price fetching from Yahoo Finance via the shared price API.<br />
        </div>

        <div><strong>Sources & Methodology:</strong></div>
        <div>• <strong>Baseline NAV:</strong> Printed $34.30 per share as of June 30, 2026, per the <a href={NCSRS_JUNE_30.url} target="_blank" rel="noopener noreferrer" style={{ color: "#d97706", textDecoration: "underline" }}>N-CSRS filed Aug 28, 2026</a>. Net assets $1,634,830,252 on 47,657,338 shares (exact NAV ${(FILED.netAssets / impliedFiledShares()).toFixed(5)}). NPORT-P TNA is $1,634,830,251.28.</div>
        <div>• <strong>Portfolio:</strong> Investments at fair value $1,640,039,144 (cost $1,347,802,540). Money market $939,712,701 (57.48% of net assets). Other assets less liabilities −$5,208,892.</div>
        <div>• <strong>Valuation method:</strong> N-CSRS Level 3 table. Anthropic + OpenAI equity + PPUs ($278,448,755) use volume-weighted average transaction prices, index prices, and recent transaction price ($589.00–$766.76, avg $651.51). The three SpaceX SPVs ($173,061,170) use quoted underlying share price adjusted for SPV carried interest and Unit Parity. Announced primary rounds are not an input. At March 31 Anthropic was marked $347.35/unit on the same 386,088 units — above Series G and below the later Series H announcement.</div>
        <div>• <strong>Unit counts:</strong> NPORT-P <code>balance</code> / N-CSRS units are share-equivalents of the underlying company (footnotes (f)–(i)). <a href={NPORT_JUNE_30.url} target="_blank" rel="noopener noreferrer" style={{ color: "#d97706", textDecoration: "underline" }}>June 30 NPORT-P XML</a>.</div>
        <div>• <strong>SpaceX (SPCX):</strong> 675,675 + 214,285 + 142,425 units (already post 5-for-1 Unit Parity; do not multiply by 5 again). MWAM VC SpaceX-II carries 10% incentive; SpaceX I and Snowpoint 2.6 carry 0%. Live Yahoo SPCX via <code>/api/prices</code>. 3/31 balances 135,135 / 42,857 / 28,486 must be split-adjusted for any historical series.</div>
        <div>• <strong>Outstanding Shares:</strong> Filed 47,657,338 = 30,465,664 (12/31/2025 21,976,305 + Q1 ATM {Q1_ATM.shares.toLocaleString("en-US")}) + Q2 ATM {Q2_ATM.shares.toLocaleString("en-US")}.</div>
        <div>• <strong>Q2 ATM (filed, already in baseline):</strong> {Q2_ATM.shares.toLocaleString("en-US")} shares at a stated weighted average of ${Q2_ATM.wavgPrice} for stated net proceeds of {fmt$(Q2_ATM.netProceeds)}, April 1–June 30, per the <a href="https://www.sec.gov/Archives/edgar/data/1843974/000157587226000624/dxyx104_424b3.htm" target="_blank" rel="noopener noreferrer" style={{ color: "#d97706", textDecoration: "underline" }}>Aug 28 424B3</a>. Stated wavg × shares does not equal stated net proceeds; both figures are stored as printed.</div>
        <div>• <strong>H1 ATM:</strong> {H1_ATM.shares.toLocaleString("en-US")} shares at a ${H1_ATM.wavgPrice} weighted average; proceeds {fmt$(H1_ATM.netProceedsAfterCommissions)} after commissions (N-CSRS Note 4).</div>
        <div>• <strong>ATM capacity:</strong> Original $1B shelf (File 333-278734) through 2025 and Q1. New shelf {NEW_SHELF.fileNumber} (effective {NEW_SHELF.filedDate}) authorizes an <strong>indeterminate</strong> amount — there is no filed remaining-capacity dollar figure. Post–June 30 simulation uses the May 26 424B5 $1B illustration as a modeling cap only. Jefferies commission up to 3.0%.</div>
        <div>• <strong>Share repurchase:</strong> In {SHARE_REPURCHASE.approved} the Board approved repurchases of common stock at prices below then-current NAV, discretionary as to size and timing (<a href={SHARE_REPURCHASE.url} target="_blank" rel="noopener noreferrer" style={{ color: "#d97706", textDecoration: "underline" }}>N-CSRS subsequent events</a>). Presented next to the open ATM; neither is treated as dominant.</div>
        <div>• <strong>Post-June 30 Issuance (estimated):</strong> Modeled daily from July 1 as a fixed share of Yahoo Finance trading volume (calibrated from filed Q2 shares ÷ Apr–Jun volume), issuing only on days above rolling pro forma NAV. Estimated, not company reported.</div>
        <div>• <strong>Implied EV:</strong> Anthropic and OpenAI PPS × estimated fully diluted shares from <code>data/capitalization.json</code> (same defaults as /ai: $965B and $852B last primaries ÷ June DXYZ unit marks). Dilution is 0 on this page. This is not a filed cap table. A new primary may issue shares the identity does not model.</div>
        <div>• <strong>Subsequent events (mix shift, not new ATM):</strong> Aug 13 $150.0M additional Goanna Capital 26E (OpenAI Class A Common); Jul 16 $15.0M Magnitude FSTK / Fluidstack Series B; Aug 4 $4.0M Boom SAFE. When subsequent purchases are enabled, all $169M of costs are deducted from cash. August OpenAI uses estimated units and the same scenario PPS as June equity; Fluidstack and the new Boom SAFE are held at cost. Boom Series B-2 ($1.74M FV) is already on the June 30 schedule.</div>
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
              {effectiveNav > 0 ? `${((dxyzPrice / effectiveNav - 1) * 100).toFixed(0)}%` : "—"}
            </div>
          </div>
          <div style={styles.stickyDivider} />
          <div style={styles.stickyMetric}>
            <div style={styles.stickyLabel}>Price ÷ NAV</div>
            <div style={styles.stickyValue}>{effectiveNav > 0 ? `${(dxyzPrice / effectiveNav).toFixed(2)}x` : "—"}</div>
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
    </fieldset>
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
  tickerTag: {
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: "11px",
    fontWeight: 600,
    letterSpacing: "0.06em",
    color: "#78716c",
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
