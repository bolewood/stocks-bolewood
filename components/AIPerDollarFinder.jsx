"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  DEFAULT_ANTH_VAL,
  DEFAULT_DILUTION,
  DEFAULT_OAI_VAL,
  FALLBACK_PRICES,
  LAST_PRIMARY_ROUNDS,
  LOG_SLIDER_STEPS,
  SLIDER_BOUNDS,
  SLIDER_T_MAX,
  SLIDER_T_MIN,
  WRAPPERS,
  billionsFromLogPos,
  billionsToVal,
  claimPct,
  fmtLastRoundMultiple,
  fmtSliderTrillions,
  lastRoundTickPct,
  logPosFromBillions,
  parseScenarioSearch,
  serializeScenarioSearch,
  stalenessLevel,
  trillionsToBillions,
  valToBillions,
} from "../lib/aiWrappers.mjs";
import {
  BASIS_ESTIMATED,
  BASIS_FILED,
  DEPLOY_CASH,
  DEPLOY_PRORATA,
  DEPLOY_RANGE,
  dxyzBridgeFromRows,
  fundRowMetrics,
  resolveFund,
} from "../lib/aiFundBasis.mjs";
import { FILED, completedTradingRows } from "../lib/dxyzAtm.mjs";
import historySnapshot from "../app/api/dxyz-history/snapshot.json";

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

const fmtPer100Cell = (lo, hi, ranged) => {
  if (ranged && hi > lo + 0.005) return `${fmtPer100(lo)}–${fmtPer100(hi)}`;
  return fmtPer100(lo);
};

const fmtPrem = (n) => {
  if (n == null || !Number.isFinite(n)) return "—";
  const pct = n * 100;
  const sign = pct > 0.05 ? "+" : "";
  return `${sign}${pct.toFixed(1)}%`;
};

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

const CONF_LABEL = {
  high: "HIGH",
  medium: "MED",
  low: "LOW",
};

const STALE_COLOR = {
  amber: "#b45309",
  red: "#b91c1c",
};

const COLUMNS = [
  { key: "ticker", label: "Ticker", sort: "ticker" },
  { key: "security", label: "Security", sort: "security" },
  { key: "price", label: "Price", sort: "price" },
  { key: "shares", label: "Shares", sort: "shares" },
  { key: "marketCap", label: "Mkt cap", sort: "marketCap" },
  { key: "anthPct", label: "Anth. stake", sort: "anthPct" },
  { key: "anthPer100", label: "Anth. / $100", sort: "anthPer100" },
  { key: "oaiPct", label: "OAI stake", sort: "oaiPct" },
  { key: "oaiPer100", label: "OAI / $100", sort: "oaiPer100" },
  { key: "combinedPer100", label: "Combined / $100", sort: "combinedPer100" },
  { key: "premium", label: "Prem/NAV", sort: "premium" },
  { key: "confidence", label: "Conf", sort: "confidence" },
];

const GRID =
  "1.45fr 1.05fr 0.7fr 0.85fr 0.9fr 0.75fr 0.95fr 0.75fr 0.95fr 1.15fr 0.85fr 0.7fr";

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
  const [copied, setCopied] = useState(false);
  const [basis, setBasis] = useState(BASIS_ESTIMATED);
  const [deploy, setDeploy] = useState(DEPLOY_RANGE);
  const [historyRows, setHistoryRows] = useState(historySnapshot.rows);
  const skipNextWrite = useRef(true);

  const anthVal = billionsToVal(anthB);
  const oaiVal = billionsToVal(oaiB);
  const dilution = dilutionPct / 100;
  const anthMultiple = fmtLastRoundMultiple(
    anthVal,
    LAST_PRIMARY_ROUNDS.anthropic.postMoney
  );
  const oaiMultiple = fmtLastRoundMultiple(
    oaiVal,
    LAST_PRIMARY_ROUNDS.openai.postMoney
  );
  const anthTickPct = lastRoundTickPct(LAST_PRIMARY_ROUNDS.anthropic.postMoney);
  const oaiTickPct = lastRoundTickPct(LAST_PRIMARY_ROUNDS.openai.postMoney);

  useEffect(() => {
    if (!window.location.search) return;
    const parsed = parseScenarioSearch(window.location.search);
    setAnthB(parsed.anthB);
    setOaiB(parsed.oaiB);
    setDilutionPct(parsed.dilutionPct);
    setSortKey(parsed.sortKey);
    setBasis(parsed.basis === "filed" ? BASIS_FILED : BASIS_ESTIMATED);
    setDeploy(
      parsed.deploy === "cash"
        ? DEPLOY_CASH
        : parsed.deploy === "prorata"
          ? DEPLOY_PRORATA
          : DEPLOY_RANGE
    );
  }, []);

  useEffect(() => {
    if (skipNextWrite.current) {
      skipNextWrite.current = false;
      return;
    }
    const timer = setTimeout(() => {
      const qs = serializeScenarioSearch({
        anthB,
        oaiB,
        dilutionPct,
        sortKey,
        basis,
        deploy,
      });
      const next = `${window.location.pathname}?${qs}`;
      const cur = `${window.location.pathname}${window.location.search}`;
      if (cur !== next) history.replaceState(null, "", next);
    }, 300);
    return () => clearTimeout(timer);
  }, [anthB, oaiB, dilutionPct, sortKey, basis, deploy]);

  useEffect(() => {
    fetch("/api/ai-prices")
      .then((res) => res.json())
      .then((data) => {
        if (data.prices) setPrices({ ...FALLBACK_PRICES, ...data.prices });
        setPriceSource(data.source || "fallback");
      })
      .catch(() => setPriceSource("fallback"));

    const nyParts = new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/New_York",
      hour12: false,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }).formatToParts(new Date());
    const nyGet = (type) => nyParts.find((p) => p.type === type)?.value;
    setHistoryRows(
      completedTradingRows(
        historySnapshot.rows,
        `${nyGet("year")}-${nyGet("month")}-${nyGet("day")}`,
        parseInt(nyGet("hour"), 10) * 60 + parseInt(nyGet("minute"), 10)
      )
    );
    fetch("/api/dxyz-history")
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data.rows) && data.rows.length > 0) {
          setHistoryRows(data.rows);
        }
      })
      .catch(() => {});
  }, []);

  const copyScenarioLink = async () => {
    const qs = serializeScenarioSearch({
      anthB,
      oaiB,
      dilutionPct,
      sortKey,
      basis,
      deploy,
    });
    const url = `${window.location.origin}${window.location.pathname}?${qs}`;
    history.replaceState(null, "", `${window.location.pathname}?${qs}`);
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  };

  const dxyzBridge = useMemo(
    () => dxyzBridgeFromRows(historyRows, { mode: basis }),
    [historyRows, basis]
  );

  const rows = useMemo(() => {
    return WRAPPERS.map((w) => {
      const price = prices[w.yahooSymbol] ?? FALLBACK_PRICES[w.yahooSymbol];
      const resolved = resolveFund(w, {
        basis,
        deploy,
        dxyzBridge,
      });
      const metrics = fundRowMetrics(w, price, {
        anthVal,
        oaiVal,
        dilution,
        resolved,
      });
      return { wrapper: w, ...metrics };
    });
  }, [prices, anthVal, oaiVal, dilution, basis, deploy, dxyzBridge]);

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
      if (sortKey === "security") {
        av = a.wrapper.security?.label || "";
        bv = b.wrapper.security?.label || "";
        return av.localeCompare(bv) * dir;
      }
      if (sortKey === "confidence") {
        av = confRank[a.confidence] || 0;
        bv = confRank[b.confidence] || 0;
        return (av - bv) * dir;
      }
      if (sortKey === "premium") {
        av = a.premium ?? -Infinity;
        bv = b.premium ?? -Infinity;
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
      setSortDir(key === "ticker" || key === "type" || key === "security" ? "asc" : "desc");
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
        Per $100
      </h1>
      <p style={styles.subtitle} className="vcx-subtitle">
        Dollars of underlying Anthropic and OpenAI per $100 of wrapper market
        cap. Live prices; curated share counts. Not per share.
      </p>

      <div style={styles.badgeRow}>
        <span style={styles.badge}>{sourceLabel} PRICES</span>
        <span style={styles.badgeMuted}>SHARES CURATED · SEE AS-OF</span>
      </div>

      <div style={styles.sliderToolbar}>
        <p style={styles.anchorNote}>
          Last primary: Anthropic Series H $965B (2026-05-28) / OpenAI $852B
          (2026-03-31), verified {LAST_PRIMARY_ROUNDS.asOf}. Tick marks the
          round. Sliders are log-scaled $0.5T–$5.0T.
        </p>
        <button
          type="button"
          onClick={copyScenarioLink}
          style={styles.copyBtn}
        >
          {copied ? "Copied" : "Copy link to this scenario"}
        </button>
      </div>

      <div style={styles.controls} className="vcx-controls ai-controls">
        <Slider
          label="Anthropic IPO valuation"
          unit="T"
          scale="log"
          min={SLIDER_BOUNDS.anth.min}
          max={SLIDER_BOUNDS.anth.max}
          value={anthB}
          onChange={setAnthB}
          hint={`${anthMultiple} last round`}
          tickPct={anthTickPct}
          tickLabel={`Series H $965B (${fmtSliderTrillions(valToBillions(LAST_PRIMARY_ROUNDS.anthropic.postMoney))}T)`}
          onTick={() =>
            setAnthB(valToBillions(LAST_PRIMARY_ROUNDS.anthropic.postMoney))
          }
        />
        <Slider
          label="OpenAI IPO valuation"
          unit="T"
          scale="log"
          min={SLIDER_BOUNDS.oai.min}
          max={SLIDER_BOUNDS.oai.max}
          value={oaiB}
          onChange={setOaiB}
          hint={`${oaiMultiple} last round`}
          tickPct={oaiTickPct}
          tickLabel={`Mar 2026 primary $852B (${fmtSliderTrillions(valToBillions(LAST_PRIMARY_ROUNDS.openai.postMoney))}T)`}
          onTick={() =>
            setOaiB(valToBillions(LAST_PRIMARY_ROUNDS.openai.postMoney))
          }
        />
        <Slider
          label="IPO dilution (%)"
          min={SLIDER_BOUNDS.dil.min}
          max={SLIDER_BOUNDS.dil.max}
          step={SLIDER_BOUNDS.dil.step}
          value={dilutionPct}
          onChange={setDilutionPct}
        />
      </div>
      <p style={styles.caption}>
        Defaults are unpaired (Anthropic $1.00T near Series H; OpenAI $1.25T).
        Dilution haircuts every wrapper&apos;s claim the same way (primary
        issuance at IPO). Default 0% is gross look-through.
      </p>

      <div style={styles.basisBlock}>
        <div style={styles.basisKicker}>Share counts, net assets & marks</div>
        <div style={styles.basisRow}>
          {[
            { key: BASIS_FILED, label: "Filed Only" },
            { key: BASIS_ESTIMATED, label: "Estimated" },
          ].map(({ key, label }) => (
            <button
              key={key}
              type="button"
              className="preset-btn vcx-preset-btn"
              onClick={() => setBasis(key)}
              style={{
                ...styles.chip,
                ...(basis === key ? styles.chipActive : {}),
              }}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      {basis === BASIS_ESTIMATED ? (
        <div style={styles.estBanner}>
          ⚠ Estimated, not company reported — fund share counts, net assets
          & marks are rolled forward together. Strategic rows do not move.
          DXYZ last filed NAV is ${FILED.navPerShare.toFixed(2)} as of{" "}
          {FILED.asOf}.
        </div>
      ) : (
        <p style={styles.caption}>
          Filed Only freezes every fund row at its last filing. Strategic
          rows are unchanged either way.
        </p>
      )}
      {basis === BASIS_ESTIMATED ? (
        <div style={styles.basisRow}>
          <span style={styles.deployLabel}>ATM / inflows</span>
          {[
            { key: DEPLOY_RANGE, label: "Unknown (range)" },
            { key: DEPLOY_CASH, label: "Held in cash" },
            { key: DEPLOY_PRORATA, label: "Into existing book" },
          ].map(({ key, label }) => (
            <button
              key={key}
              type="button"
              className="preset-btn vcx-preset-btn"
              onClick={() => setDeploy(key)}
              style={{
                ...styles.chip,
                ...(deploy === key ? styles.chipActive : {}),
              }}
            >
              {label}
            </button>
          ))}
        </div>
      ) : null}
      <p style={styles.caption}>
        DXYZ and ARKVX raised new capital after the filing. If that cash
        bought more of the same names, look-through is roughly unchanged; if
        it sits in cash, per-$100 falls. Default is the range until the next
        N-PORT pins it.
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
              <div style={styles.ticker}>
                {row.ticker}
                {row.affected && basis === BASIS_ESTIMATED ? (
                  <span style={styles.estPill}>EST</span>
                ) : null}
              </div>
              <div style={styles.name}>{row.wrapper.name}</div>
              {row.wrapper.navNote ? (
                <details style={styles.navDetails}>
                  <summary style={styles.navSummary}>
                    {row.wrapper.navNote.summary}
                  </summary>
                  <div style={styles.navBody}>{row.wrapper.navNote.body}</div>
                </details>
              ) : null}
            </div>
            <div
              style={styles.td}
              data-label="Security"
              title={row.wrapper.security?.footnote}
            >
              {row.wrapper.security?.label || "—"}
              {row.wrapper.security?.linear === false ? (
                <sup style={styles.sup}>†</sup>
              ) : null}
            </div>
            <div style={styles.td} data-label="Price">
              ${row.price.toFixed(2)}
            </div>
            <div style={styles.td} data-label="Shares">
              {fmtShares(row.shares)}
              <div style={styles.asOf}>
                <StaleDot asOf={row.sharesAsOf} />
                {row.sharesAsOf}
              </div>
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
              {fmtPer100Cell(row.anthPer100, row.anthPer100High, row.deployRange)}
            </div>
            <div style={styles.td} data-label="OAI stake">
              {fmtPct(row.oaiPct)}
            </div>
            <div
              style={{ ...styles.td, ...styles.tdOai }}
              data-label="OAI / $100"
            >
              {fmtPer100Cell(row.oaiPer100, row.oaiPer100High, row.deployRange)}
            </div>
            <div
              style={{ ...styles.td, ...styles.tdCombined }}
              data-label="Combined / $100"
            >
              {fmtPer100Cell(
                row.combinedPer100,
                row.combinedPer100High,
                row.deployRange
              )}
            </div>
            <div style={styles.td} data-label="Prem/NAV">
              {fmtPrem(row.premium)}
            </div>
            <div style={styles.td} data-label="Conf">
              <span
                style={{
                  ...styles.conf,
                  color: CONF_COLOR[row.confidence],
                }}
              >
                {CONF_LABEL[row.confidence] || row.confidence}
              </span>
            </div>
          </div>
        ))}
      </div>

      <p style={styles.legend}>
        As-of staleness (from today):{" "}
        <span style={{ color: STALE_COLOR.amber }}>●</span> amber &gt;90 days
        {" · "}
        <span style={{ color: STALE_COLOR.red }}>●</span> red &gt;180 days.
      </p>
      <p style={styles.caption}>
        <sup style={styles.sup}>†</sup> Convertibles and capped stakes do not
        scale linearly with IPO valuation, so those rows are an approximation.
      </p>

      <section style={styles.notes}>
        <h2 style={styles.notesTitle}>Sources & footnotes</h2>
        <p style={styles.caption}>
          Stake % for corporates is ownership of the private company. For funds
          it is implied = fair value ÷ the round used to mark that FV.
          DXYZ OpenAI PPUs are excluded (not equity).
        </p>
        {WRAPPERS.map((w) => (
          <div key={w.ticker} style={styles.noteBlock}>
            <div style={styles.noteHead}>
              {w.ticker} · {w.name}
            </div>
            <div style={styles.noteBody}>
              {w.security ? ` Security: ${w.security.label}. ${w.security.footnote}` : ""}
              {w.note ? ` ${w.note}` : ""}
              {w.sharesNote ? ` ${w.sharesNote}` : ""}
              {w.navNote ? ` ${w.navNote.body}` : ""}
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

function StaleDot({ asOf }) {
  const level = stalenessLevel(asOf);
  if (level !== "amber" && level !== "red") return null;
  return (
    <span
      aria-label={level === "red" ? "as-of older than 180 days" : "as-of older than 90 days"}
      style={{
        color: STALE_COLOR[level],
        marginRight: "4px",
        fontSize: "9px",
      }}
    >
      ●
    </span>
  );
}

function Slider({
  label,
  min,
  max,
  step,
  value,
  onChange,
  hint,
  scale = "linear",
  unit,
  tickPct,
  tickLabel,
  onTick,
}) {
  const isT = unit === "T";
  const isLog = scale === "log";
  const numberMin = isT ? SLIDER_T_MIN : min;
  const numberMax = isT ? SLIDER_T_MAX : max;
  const numberStep = isT ? 0.001 : step;
  const numberValue = isT ? Number(fmtSliderTrillions(value)) : value;
  const rangeMin = isLog ? 0 : min;
  const rangeMax = isLog ? LOG_SLIDER_STEPS : max;
  const rangeStep = isLog ? 1 : step;
  const rangeValue = isLog ? logPosFromBillions(value) : value;

  return (
    <div style={styles.controlGroup}>
      <label style={styles.label}>{label}</label>
      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
        <input
          type="number"
          min={numberMin}
          max={numberMax}
          step={numberStep}
          value={numberValue}
          onChange={(e) => {
            const n = Number(e.target.value);
            if (!Number.isFinite(n)) return;
            if (isT) {
              const b = trillionsToBillions(n);
              onChange(Math.min(max, Math.max(min, b)));
            } else {
              onChange(n);
            }
          }}
          style={styles.smallInput}
          className="vcx-input vcx-small-input"
        />
        {isT ? <span style={styles.unit}>T</span> : null}
      </div>
      {hint ? <div style={styles.hint}>{hint}</div> : null}
      <div style={styles.sliderTrack} className="ai-slider-track">
        <input
          type="range"
          min={rangeMin}
          max={rangeMax}
          step={rangeStep}
          value={rangeValue}
          onChange={(e) => {
            const n = Number(e.target.value);
            onChange(isLog ? billionsFromLogPos(n) : n);
          }}
          style={styles.rangeInput}
        />
        {tickPct != null && onTick ? (
          <button
            type="button"
            className="ai-slider-tick"
            style={{ ...styles.sliderTick, left: `${tickPct}%` }}
            title={tickLabel}
            aria-label={tickLabel}
            onClick={onTick}
          />
        ) : null}
      </div>
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
    color: "#44403c",
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
    color: "#44403c",
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
    color: "#78350f",
    padding: "4px 8px",
    fontWeight: 600,
  },
  badgeMuted: {
    fontFamily: "var(--font-mono), monospace",
    fontSize: "10px",
    letterSpacing: "0.12em",
    background: "#e7e5e4",
    color: "#44403c",
    padding: "4px 8px",
    fontWeight: 600,
  },
  sliderToolbar: {
    display: "flex",
    flexWrap: "wrap",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: "12px",
    marginBottom: "16px",
  },
  anchorNote: {
    fontFamily: "var(--font-mono), monospace",
    fontSize: "11px",
    color: "#44403c",
    lineHeight: 1.6,
    margin: 0,
    flex: "1 1 280px",
    maxWidth: "640px",
  },
  basisBlock: {
    marginBottom: "10px",
  },
  basisKicker: {
    fontFamily: "var(--font-mono), monospace",
    fontSize: "11px",
    color: "#44403c",
    letterSpacing: "0.06em",
    textTransform: "uppercase",
    marginBottom: "8px",
  },
  basisRow: {
    display: "flex",
    flexWrap: "wrap",
    gap: "8px",
    alignItems: "center",
    marginBottom: "10px",
  },
  deployLabel: {
    fontFamily: "var(--font-mono), monospace",
    fontSize: "11px",
    color: "#44403c",
    letterSpacing: "0.06em",
    textTransform: "uppercase",
  },
  estBanner: {
    fontFamily: "var(--font-mono), monospace",
    fontSize: "11px",
    fontWeight: 700,
    letterSpacing: "0.04em",
    textTransform: "uppercase",
    color: "#78350f",
    background: "#fef3c7",
    border: "1px solid #d97706",
    padding: "10px 14px",
    marginBottom: "12px",
  },
  estPill: {
    marginLeft: "6px",
    fontSize: "9px",
    letterSpacing: "0.08em",
    color: "#78350f",
    background: "#fef3c7",
    border: "1px solid #d97706",
    padding: "1px 4px",
    fontWeight: 700,
    verticalAlign: "middle",
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
  copyBtn: {
    alignSelf: "flex-start",
    fontFamily: "var(--font-mono), monospace",
    fontSize: "11px",
    letterSpacing: "0.04em",
    padding: "8px 12px",
    border: "1px solid #e7e5e4",
    background: "#fff",
    color: "#44403c",
    cursor: "pointer",
    whiteSpace: "nowrap",
  },
  caption: {
    fontFamily: "var(--font-mono), monospace",
    fontSize: "11px",
    color: "#44403c",
    lineHeight: 1.6,
    marginBottom: "20px",
  },
  legend: {
    fontFamily: "var(--font-mono), monospace",
    fontSize: "11px",
    color: "#44403c",
    lineHeight: 1.6,
    margin: "12px 0 8px",
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
    color: "#44403c",
    display: "block",
    marginBottom: "8px",
  },
  hint: {
    fontFamily: "var(--font-mono), monospace",
    fontSize: "11px",
    color: "#44403c",
    marginTop: "6px",
  },
  unit: {
    fontFamily: "var(--font-mono), monospace",
    fontSize: "12px",
    color: "#44403c",
    letterSpacing: "0.04em",
  },
  sliderTrack: {
    position: "relative",
    marginTop: "10px",
  },
  rangeInput: {
    width: "100%",
    margin: 0,
    accentColor: "#d97706",
  },
  sliderTick: {
    position: "absolute",
    top: "50%",
    width: "10px",
    height: "16px",
    marginTop: "-8px",
    padding: 0,
    border: "none",
    borderLeft: "2px solid #1c1917",
    background: "transparent",
    transform: "translateX(-50%)",
    cursor: "pointer",
    zIndex: 2,
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
    color: "#44403c",
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
    gridTemplateColumns: GRID,
    gap: "4px",
    padding: "10px 0",
    borderBottom: "1px solid #e7e5e4",
    minWidth: "1020px",
  },
  th: {
    fontFamily: "var(--font-mono), monospace",
    fontSize: "10px",
    letterSpacing: "0.06em",
    textTransform: "uppercase",
    color: "#44403c",
    background: "none",
    border: "none",
    padding: 0,
    textAlign: "left",
    cursor: "pointer",
  },
  thActive: {
    color: "#b45309",
  },
  tr: {
    display: "grid",
    gridTemplateColumns: GRID,
    gap: "4px",
    padding: "12px 0",
    borderBottom: "1px solid #f5f5f4",
    alignItems: "baseline",
    minWidth: "1020px",
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
    color: "#44403c",
    fontFamily: "var(--font-fraunces), Georgia, serif",
  },
  asOf: {
    fontSize: "10px",
    color: "#57534e",
    letterSpacing: "0.04em",
    display: "flex",
    alignItems: "center",
    marginTop: "2px",
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
    whiteSpace: "nowrap",
  },
  sup: {
    fontSize: "10px",
    color: "#b45309",
    marginLeft: "2px",
    fontWeight: 600,
  },
  navDetails: {
    marginTop: "6px",
  },
  navSummary: {
    fontFamily: "var(--font-mono), monospace",
    fontSize: "10px",
    color: "#44403c",
    cursor: "pointer",
    letterSpacing: "0.04em",
  },
  navBody: {
    fontFamily: "var(--font-mono), monospace",
    fontSize: "10px",
    color: "#44403c",
    lineHeight: 1.55,
    marginTop: "6px",
    maxWidth: "280px",
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
    color: "#44403c",
    lineHeight: 1.6,
  },
};
