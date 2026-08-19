"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  DEFAULT_ANTH_VAL,
  DEFAULT_DILUTION,
  DEFAULT_OAI_VAL,
  FALLBACK_PRICES,
  SCENARIO_CHIPS,
  WRAPPERS,
  chipMatching,
  claimPct,
  rowMetrics,
} from "../lib/aiWrappers.mjs";

const fmt$ = (n) =>
  n >= 1e12
    ? `$${(n / 1e12).toFixed(2)}T`
    : n >= 1e9
      ? `$${(n / 1e9).toFixed(2)}B`
      : n >= 1e6
        ? `$${(n / 1e6).toFixed(1)}M`
        : n >= 1e3
          ? `$${(n / 1e3).toFixed(1)}K`
          : `$${n.toFixed(0)}`;

const fmtPer100 = (n) =>
  n <= 0
    ? "—"
    : `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const fmtPct = (n) => {
  if (!(n > 0)) return "—";
  const pct = n * 100;
  if (pct >= 1) return `${pct.toFixed(1)}%`;
  if (pct >= 0.01) return `${pct.toFixed(2)}%`;
  return `${pct.toFixed(3)}%`;
};

const fmtShares = (n) =>
  n >= 1e9
    ? `${(n / 1e9).toFixed(2)}B`
    : n >= 1e6
      ? `${(n / 1e6).toFixed(2)}M`
      : n.toLocaleString("en-US");

const CONF_COLOR = {
  high: "#15803d",
  medium: "#b45309",
  low: "#b91c1c",
};

function valToBillions(v) {
  return Math.round(v / 1e9);
}

function billionsToVal(b) {
  return b * 1e9;
}

const COLUMNS = [
  { key: "ticker", label: "Ticker", sort: "ticker" },
  { key: "type", label: "Type", sort: "type" },
  { key: "price", label: "Price", sort: "price" },
  { key: "shares", label: "Shares", sort: "shares" },
  { key: "marketCap", label: "Mkt cap", sort: "marketCap" },
  { key: "anthPct", label: "Anth. stake", sort: "anthPct" },
  { key: "anthPer100", label: "Anth. / $100", sort: "anthPer100" },
  { key: "oaiPct", label: "OAI stake", sort: "oaiPct" },
  { key: "oaiPer100", label: "OAI / $100", sort: "oaiPer100" },
  { key: "combinedPer100", label: "Combined / $100", sort: "combinedPer100" },
  { key: "confidence", label: "Conf.", sort: "confidence" },
];

export default function AIPerDollarFinder() {
  const [anthB, setAnthB] = useState(valToBillions(DEFAULT_ANTH_VAL));
  const [oaiB, setOaiB] = useState(valToBillions(DEFAULT_OAI_VAL));
  const [dilutionPct, setDilutionPct] = useState(DEFAULT_DILUTION * 100);
  const [prices, setPrices] = useState(FALLBACK_PRICES);
  const [priceSource, setPriceSource] = useState("default");
  const [sortKey, setSortKey] = useState("combinedPer100");
  const [sortDir, setSortDir] = useState("desc");
  const [minCombined, setMinCombined] = useState(0);
  const [hideThin, setHideThin] = useState(false);

  const anthVal = billionsToVal(anthB);
  const oaiVal = billionsToVal(oaiB);
  const dilution = dilutionPct / 100;
  const activeChip = chipMatching(anthVal, oaiVal);

  useEffect(() => {
    fetch("/api/ai-prices")
      .then((res) => res.json())
      .then((data) => {
        if (data.prices) setPrices({ ...FALLBACK_PRICES, ...data.prices });
        setPriceSource(data.source || "fallback");
      })
      .catch(() => setPriceSource("fallback"));
  }, []);

  const applyChip = (key) => {
    const chip = SCENARIO_CHIPS[key];
    setAnthB(valToBillions(chip.anthVal));
    setOaiB(valToBillions(chip.oaiVal));
  };

  const rows = useMemo(() => {
    return WRAPPERS.map((w) => {
      const price = prices[w.yahooSymbol] ?? FALLBACK_PRICES[w.yahooSymbol];
      const metrics = rowMetrics(w, price, { anthVal, oaiVal, dilution });
      return { wrapper: w, ...metrics };
    });
  }, [prices, anthVal, oaiVal, dilution]);

  const sorted = useMemo(() => {
    const filtered = hideThin
      ? rows.filter((r) => r.combinedPer100 >= minCombined)
      : rows;
    const dir = sortDir === "asc" ? 1 : -1;
    const confRank = { high: 3, medium: 2, low: 1 };
    return [...filtered].sort((a, b) => {
      let av;
      let bv;
      if (sortKey === "ticker" || sortKey === "type") {
        av = a.wrapper[sortKey];
        bv = b.wrapper[sortKey];
        return av.localeCompare(bv) * dir;
      }
      if (sortKey === "confidence") {
        av = confRank[a.wrapper.confidence] || 0;
        bv = confRank[b.wrapper.confidence] || 0;
        return (av - bv) * dir;
      }
      av = a[sortKey] ?? 0;
      bv = b[sortKey] ?? 0;
      return (av - bv) * dir;
    });
  }, [rows, sortKey, sortDir, hideThin, minCombined]);

  const toggleSort = (key) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "desc" ? "asc" : "desc"));
    } else {
      setSortKey(key);
      setSortDir(key === "ticker" || key === "type" ? "asc" : "desc");
    }
  };

  const sourceLabel =
    priceSource === "live"
      ? "LIVE"
      : priceSource === "cache"
        ? "CACHE"
        : priceSource === "partial"
          ? "PARTIAL"
          : priceSource === "fallback"
            ? "FALLBACK"
            : "DEFAULT";

  return (
    <main style={styles.main} className="vcx-container">
      <div style={styles.eyebrow} className="vcx-eyebrow">
        BOLEWOOD GROUP · LOOK-THROUGH
      </div>
      <h1 style={styles.title} className="vcx-title">
        Anthropic & OpenAI Per $
      </h1>
      <p style={styles.subtitle} className="vcx-subtitle">
        Dollars of underlying Anthropic and OpenAI per $100 of wrapper market
        cap. Live prices; curated share counts. Not per share.
      </p>

      <div style={styles.badgeRow}>
        <span style={styles.badge}>{sourceLabel} PRICES</span>
        <span style={styles.badgeMuted}>SHARES CURATED · SEE AS-OF</span>
      </div>

      <div style={styles.chipRow} className="ai-chip-row">
        {Object.entries(SCENARIO_CHIPS).map(([key, chip]) => (
          <button
            key={key}
            type="button"
            className="preset-btn vcx-preset-btn"
            onClick={() => applyChip(key)}
            style={{
              ...styles.chip,
              ...(activeChip === key ? styles.chipActive : {}),
            }}
          >
            {chip.label}
            <span style={styles.chipMeta}>
              ${(chip.anthVal / 1e12).toFixed(2)}T / $
              {(chip.oaiVal / 1e12).toFixed(2)}T
            </span>
          </button>
        ))}
      </div>
      <p style={styles.caption}>
        Defaults are unpaired (Anthropic $1.0T near Series H; OpenAI $1.25T
        sheet Base). Chips apply both names together.
      </p>

      <div style={styles.controls} className="vcx-controls ai-controls">
        <Slider
          label="Anthropic IPO valuation ($B)"
          min={400}
          max={2500}
          step={25}
          value={anthB}
          onChange={setAnthB}
        />
        <Slider
          label="OpenAI IPO valuation ($B)"
          min={500}
          max={4000}
          step={25}
          value={oaiB}
          onChange={setOaiB}
        />
        <Slider
          label="IPO dilution (%)"
          min={0}
          max={30}
          step={1}
          value={dilutionPct}
          onChange={setDilutionPct}
        />
      </div>
      <p style={styles.caption}>
        Dilution haircuts every wrapper&apos;s claim the same way (primary
        issuance at IPO). Default 0% is gross look-through.
      </p>

      <label style={styles.filter}>
        <input
          type="checkbox"
          checked={hideThin}
          onChange={(e) => setHideThin(e.target.checked)}
        />
        Hide combined under
        <input
          type="number"
          min={0}
          step={1}
          value={minCombined}
          onChange={(e) => setMinCombined(Number(e.target.value) || 0)}
          style={styles.filterInput}
          className="vcx-input"
        />
        / $100
      </label>

      <div style={styles.tableWrap} className="echo-table-scroll">
        <div style={styles.headerRow} className="vcx-table-header">
          {COLUMNS.map((col) => (
            <button
              key={col.key}
              type="button"
              onClick={() => toggleSort(col.sort)}
              style={{
                ...styles.th,
                ...(sortKey === col.sort ? styles.thActive : {}),
              }}
            >
              {col.label}
              {sortKey === col.sort ? (sortDir === "desc" ? " ↓" : " ↑") : ""}
            </button>
          ))}
        </div>
        {sorted.map((row) => (
          <div key={row.ticker} style={styles.tr} className="vcx-row">
            <div style={styles.tdTicker} data-label="Ticker">
              <div style={styles.ticker}>{row.ticker}</div>
              <div style={styles.name}>{row.wrapper.name}</div>
            </div>
            <div style={styles.td} data-label="Type">
              {row.wrapper.type}
            </div>
            <div style={styles.td} data-label="Price">
              ${row.price.toFixed(2)}
            </div>
            <div style={styles.td} data-label="Shares">
              {fmtShares(row.shares)}
              <div style={styles.asOf}>{row.wrapper.sharesAsOf}</div>
            </div>
            <div style={styles.td} data-label="Mkt cap">
              {fmt$(row.marketCap)}
            </div>
            <div style={styles.td} data-label="Anth. stake">
              {fmtPct(row.anthPct)}
            </div>
            <div
              style={{ ...styles.td, ...styles.tdAccent }}
              data-label="Anth. / $100"
            >
              {fmtPer100(row.anthPer100)}
            </div>
            <div style={styles.td} data-label="OAI stake">
              {fmtPct(row.oaiPct)}
            </div>
            <div
              style={{ ...styles.td, ...styles.tdOai }}
              data-label="OAI / $100"
            >
              {fmtPer100(row.oaiPer100)}
            </div>
            <div
              style={{ ...styles.td, ...styles.tdCombined }}
              data-label="Combined / $100"
            >
              {fmtPer100(row.combinedPer100)}
            </div>
            <div style={styles.td} data-label="Conf.">
              <span
                style={{
                  ...styles.conf,
                  color: CONF_COLOR[row.wrapper.confidence],
                }}
              >
                {row.wrapper.confidence}
              </span>
            </div>
          </div>
        ))}
      </div>

      <section style={styles.notes}>
        <h2 style={styles.notesTitle}>Sources & footnotes</h2>
        <p style={styles.caption}>
          Stake % for corporates is ownership of the private company. For funds
          it is implied = filed fair value ÷ the round used to mark that FV.
          DXYZ OpenAI PPUs are excluded (not equity).
        </p>
        {WRAPPERS.map((w) => (
          <div key={w.ticker} style={styles.noteBlock}>
            <div style={styles.noteHead}>
              {w.ticker} · {w.name}
            </div>
            <div style={styles.noteBody}>
              {w.note}
              {w.sharesNote ? ` ${w.sharesNote}` : ""}
              {w.anthropic ? ` Anthropic: ${w.anthropic.source}` : ""}
              {w.openai ? ` OpenAI: ${w.openai.source}` : ""}
              {w.anthropic?.kind === "fund"
                ? ` Anth. FV ${fmt$(w.anthropic.fairValue)} at ${fmt$(w.anthropic.roundVal)} (${w.anthropic.asOf}).`
                : ""}
              {w.openai?.kind === "fund"
                ? ` OAI FV ${fmt$(w.openai.fairValue)} at ${fmt$(w.openai.roundVal)} (${w.openai.asOf}).`
                : ""}
              {` Claim ${fmtPct(claimPct(w.anthropic))} Anthropic / ${fmtPct(claimPct(w.openai))} OpenAI.`}
            </div>
          </div>
        ))}
      </section>
    </main>
  );
}

function Slider({ label, min, max, step, value, onChange }) {
  return (
    <div style={styles.controlGroup}>
      <label style={styles.label}>{label}</label>
      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
        <input
          type="number"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(Number(e.target.value) || 0)}
          style={styles.smallInput}
          className="vcx-input vcx-small-input"
        />
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{ width: "100%", marginTop: "8px", accentColor: "#d97706" }}
      />
    </div>
  );
}

const styles = {
  main: {
    maxWidth: "1180px",
    margin: "0 auto",
    padding: "48px 56px 80px",
  },
  eyebrow: {
    fontFamily: "var(--font-mono), 'JetBrains Mono', monospace",
    fontSize: "11px",
    letterSpacing: "0.18em",
    color: "#78716c",
    marginBottom: "16px",
    fontWeight: 500,
  },
  title: {
    fontSize: "48px",
    lineHeight: 1.05,
    fontWeight: 500,
    color: "#1c1917",
    marginBottom: "12px",
  },
  subtitle: {
    fontSize: "16px",
    lineHeight: 1.5,
    color: "#57534e",
    maxWidth: "640px",
    marginBottom: "20px",
  },
  badgeRow: {
    display: "flex",
    gap: "8px",
    marginBottom: "24px",
    flexWrap: "wrap",
  },
  badge: {
    fontFamily: "var(--font-mono), monospace",
    fontSize: "10px",
    letterSpacing: "0.12em",
    background: "#fef3c7",
    color: "#92400e",
    padding: "4px 8px",
    fontWeight: 600,
  },
  badgeMuted: {
    fontFamily: "var(--font-mono), monospace",
    fontSize: "10px",
    letterSpacing: "0.12em",
    background: "#f5f5f4",
    color: "#78716c",
    padding: "4px 8px",
    fontWeight: 600,
  },
  chipRow: {
    display: "grid",
    gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
    gap: "8px",
    marginBottom: "8px",
  },
  chip: {
    fontFamily: "var(--font-mono), monospace",
    fontSize: "12px",
    padding: "10px 12px",
    border: "1px solid #e7e5e4",
    background: "#fff",
    cursor: "pointer",
    textAlign: "left",
    color: "#1c1917",
  },
  chipActive: {
    background: "#1c1917",
    color: "#fef3c7",
    borderColor: "#1c1917",
  },
  chipMeta: {
    display: "block",
    fontSize: "10px",
    opacity: 0.7,
    marginTop: "4px",
  },
  caption: {
    fontFamily: "var(--font-mono), monospace",
    fontSize: "11px",
    color: "#78716c",
    lineHeight: 1.6,
    marginBottom: "20px",
  },
  controls: {
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    gap: "20px",
    marginBottom: "8px",
  },
  controlGroup: {
    minWidth: 0,
  },
  label: {
    fontFamily: "var(--font-mono), monospace",
    fontSize: "11px",
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    color: "#78716c",
    display: "block",
    marginBottom: "8px",
  },
  smallInput: {
    width: "100%",
    maxWidth: "140px",
    fontFamily: "var(--font-mono), monospace",
    fontSize: "14px",
    padding: "6px 8px",
    border: "1px solid #e7e5e4",
    background: "#fff",
    color: "#1c1917",
  },
  filter: {
    fontFamily: "var(--font-mono), monospace",
    fontSize: "12px",
    color: "#57534e",
    display: "flex",
    alignItems: "center",
    gap: "8px",
    margin: "12px 0 20px",
  },
  filterInput: {
    width: "64px",
    fontFamily: "var(--font-mono), monospace",
    fontSize: "12px",
    padding: "4px 6px",
    border: "1px solid #e7e5e4",
  },
  tableWrap: {
    overflowX: "auto",
    borderTop: "1px solid #e7e5e4",
  },
  headerRow: {
    display: "grid",
    gridTemplateColumns: "1.4fr 0.7fr 0.7fr 0.8fr 0.8fr 0.8fr 0.9fr 0.8fr 0.9fr 1fr 0.6fr",
    gap: "4px",
    padding: "10px 0",
    borderBottom: "1px solid #e7e5e4",
    minWidth: "1080px",
  },
  th: {
    fontFamily: "var(--font-mono), monospace",
    fontSize: "10px",
    letterSpacing: "0.06em",
    textTransform: "uppercase",
    color: "#78716c",
    background: "none",
    border: "none",
    padding: 0,
    textAlign: "left",
    cursor: "pointer",
  },
  thActive: {
    color: "#d97706",
  },
  tr: {
    display: "grid",
    gridTemplateColumns: "1.4fr 0.7fr 0.7fr 0.8fr 0.8fr 0.8fr 0.9fr 0.8fr 0.9fr 1fr 0.6fr",
    gap: "4px",
    padding: "12px 0",
    borderBottom: "1px solid #f5f5f4",
    alignItems: "baseline",
    minWidth: "1080px",
  },
  td: {
    fontFamily: "var(--font-mono), monospace",
    fontSize: "12px",
    color: "#1c1917",
    fontVariantNumeric: "tabular-nums",
  },
  tdTicker: {
    minWidth: 0,
  },
  ticker: {
    fontFamily: "var(--font-mono), monospace",
    fontSize: "13px",
    fontWeight: 600,
  },
  name: {
    fontSize: "11px",
    color: "#78716c",
    fontFamily: "var(--font-fraunces), Georgia, serif",
  },
  asOf: {
    fontSize: "9px",
    color: "#a8a29e",
    letterSpacing: "0.04em",
  },
  tdAccent: {
    color: "#1d4ed8",
    fontWeight: 600,
  },
  tdOai: {
    color: "#047857",
    fontWeight: 600,
  },
  tdCombined: {
    fontWeight: 700,
  },
  conf: {
    textTransform: "uppercase",
    fontSize: "10px",
    letterSpacing: "0.08em",
    fontWeight: 600,
  },
  notes: {
    marginTop: "48px",
    paddingTop: "24px",
    borderTop: "1px solid #e7e5e4",
  },
  notesTitle: {
    fontSize: "20px",
    marginBottom: "12px",
  },
  noteBlock: {
    marginBottom: "14px",
  },
  noteHead: {
    fontFamily: "var(--font-mono), monospace",
    fontSize: "11px",
    fontWeight: 600,
    letterSpacing: "0.04em",
    marginBottom: "4px",
  },
  noteBody: {
    fontFamily: "var(--font-mono), monospace",
    fontSize: "11px",
    color: "#57534e",
    lineHeight: 1.6,
  },
};
