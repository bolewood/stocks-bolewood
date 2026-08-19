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
  WRAPPER_TICKERS,
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
  DENOM_KIND,
  basisMeta,
  fmtExposurePct,
  fmtUsdPrecise,
  weakestEvidence,
} from "../lib/aiExposure.mjs";
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
import {
  disclosureBannerText,
  isHeldTicker,
} from "../lib/disclosure.mjs";
import {
  formatQuoteEt,
  oldestQuoteAsOf,
  pagePriceState,
  priceChipLabel,
  priceChipTitle,
} from "../lib/priceState.mjs";
import disclosure from "../data/disclosure.json";
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

const STALE_COLOR = {
  amber: "#b45309",
  red: "#b91c1c",
};

const COLUMNS = [
  { key: "ticker", label: "Ticker", sort: "ticker" },
  { key: "basis", label: "Basis", sort: "basis" },
  { key: "wrapperValue", label: "Wrapper value", sort: "wrapperValue" },
  { key: "anthPer100", label: "Anth. / $100", sort: "anthPer100" },
  { key: "oaiPer100", label: "OAI / $100", sort: "oaiPer100" },
  { key: "combinedPer100", label: "Combined / $100", sort: "combinedPer100" },
  { key: "evidence", label: "Evidence", sort: "evidence" },
  { key: "asOf", label: "As of", sort: "asOf" },
];

const GRID = "1.5fr 1.35fr 1.05fr 1fr 1fr 1.15fr 0.9fr 1.1fr";

export default function AIPerDollarFinder() {
  const [anthB, setAnthB] = useState(valToBillions(DEFAULT_ANTH_VAL));
  const [oaiB, setOaiB] = useState(valToBillions(DEFAULT_OAI_VAL));
  const [dilutionPct, setDilutionPct] = useState(DEFAULT_DILUTION * 100);
  const [prices, setPrices] = useState(FALLBACK_PRICES);
  const [sortKey, setSortKey] = useState("combinedPer100");
  const [sortDir, setSortDir] = useState("desc");
  const [minCombined, setMinCombined] = useState(0);
  const [hideThin, setHideThin] = useState(false);
  const [copied, setCopied] = useState(false);
  const [basis, setBasis] = useState(BASIS_ESTIMATED);
  const [deploy, setDeploy] = useState(DEPLOY_RANGE);
  const [historyRows, setHistoryRows] = useState(historySnapshot.rows);
  const [expanded, setExpanded] = useState({});
  const [quotes, setQuotes] = useState({});
  const [priceFeed, setPriceFeed] = useState({
    source: "unavailable",
    fetchedAt: null,
    cacheWrittenAt: null,
  });
  const [priceLoaded, setPriceLoaded] = useState(false);
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
        if (data.quotes) setQuotes(data.quotes);
        setPriceFeed({
          source: data.source || "unavailable",
          fetchedAt: data.fetchedAt || null,
          cacheWrittenAt: data.cacheWrittenAt || null,
        });
        setPriceLoaded(true);
      })
      .catch(() => {
        setPriceFeed({
          source: "unavailable",
          fetchedAt: null,
          cacheWrittenAt: null,
        });
        setPriceLoaded(true);
      });

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
      if (sortKey === "ticker" || sortKey === "basis" || sortKey === "evidence") {
        av = a.wrapper.ticker;
        bv = b.wrapper.ticker;
        if (sortKey === "evidence") {
          av = weakestEvidence(a.wrapper) || "";
          bv = weakestEvidence(b.wrapper) || "";
        }
        return String(av).localeCompare(String(bv)) * dir;
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
      if (sortKey === "wrapperValue") {
        av = a.wrapperValue ?? a.marketCap ?? 0;
        bv = b.wrapperValue ?? b.marketCap ?? 0;
        return (av - bv) * dir;
      }
      if (sortKey === "asOf") {
        av = a.sharesAsOf || "";
        bv = b.sharesAsOf || "";
        return av.localeCompare(bv) * dir;
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

  const quoteState = pagePriceState(quotes, WRAPPER_TICKERS);
  const quoteAsOf = oldestQuoteAsOf(quotes, WRAPPER_TICKERS);
  const chipLabel = priceChipLabel(quoteState, quoteAsOf);
  const chipTitle = [
    priceChipTitle(quoteState, quoteAsOf),
    priceFeed.fetchedAt
      ? `fetched ${formatQuoteEt(priceFeed.fetchedAt)}`
      : null,
    priceFeed.cacheWrittenAt
      ? `cached ${formatQuoteEt(priceFeed.cacheWrittenAt)}`
      : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <main style={styles.main} className="vcx-container">
      <div style={styles.eyebrow} className="vcx-eyebrow">
        BOLEWOOD GROUP · LOOK-THROUGH
      </div>
      <h1 style={styles.title} className="vcx-title">
        Pre-IPO Anthropic and OpenAI per $100
      </h1>
      <p style={styles.subtitle} className="vcx-subtitle">
        Estimated Anthropic and OpenAI exposure per $100 of wrapper value.
        Market value for listed securities; total net assets for unlisted
        funds. Live prices; curated denominator inputs. Not per share.
      </p>
      <p style={styles.disclosure}>{disclosureBannerText(disclosure)}</p>

      <div style={styles.badgeRow}>
        {priceLoaded ? (
          <span
            style={{
              ...styles.badge,
              ...(quoteState === "live"
                ? styles.badgeLive
                : quoteState === "close"
                  ? styles.badgeClose
                  : quoteState === "stale"
                    ? styles.badgeStale
                    : quoteState === "unavailable"
                      ? styles.badgeUnavailable
                      : null),
            }}
            title={chipTitle}
          >
            {chipLabel}
          </span>
        ) : (
          <span style={styles.badgeMuted}>PRICES…</span>
        )}
        <span style={styles.badgeMuted}>SEE AS-OF · EXPAND A ROW</span>
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
        Defaults are 1.0× last primary round (Anthropic Series H $0.965T,
        OpenAI $0.852T). Assumes pro rata dilution of existing holders. Does
        not model participation rights, anti-dilution provisions, ownership
        caps, or security-specific conversion terms. Default 0% is gross
        look-through.
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
        {sorted.map((row) => {
          const isOpen = !!expanded[row.ticker];
          const anthBasis = basisMeta(row.wrapper.anthropic);
          const oaiBasis = basisMeta(row.wrapper.openai);
          const evidence = weakestEvidence(row.wrapper);
          const denom = DENOM_KIND[row.denomKind] || DENOM_KIND.marketCap;
          const holdingsAsOf = [
            row.wrapper.anthropic?.asOf,
            row.wrapper.openai?.asOf,
          ]
            .filter(Boolean)
            .sort()
            .slice(-1)[0];
          const markAsOf = [
            row.wrapper.anthropic?.markAsOf,
            row.wrapper.openai?.markAsOf,
          ]
            .filter(Boolean)
            .sort()
            .slice(-1)[0];
          const staleDenom =
            row.denomKind !== "netAssets" &&
            (stalenessLevel(row.sharesAsOf) === "amber" ||
              stalenessLevel(row.sharesAsOf) === "red");
          return (
            <div key={row.ticker}>
              <div
                style={{ ...styles.tr, cursor: "pointer" }}
                className="vcx-row"
                onClick={() =>
                  setExpanded((prev) => ({
                    ...prev,
                    [row.ticker]: !prev[row.ticker],
                  }))
                }
              >
                <div style={styles.tdTicker} data-label="Ticker">
                  <div style={styles.ticker}>
                    <span style={styles.chevron}>{isOpen ? "▾" : "▸"}</span>
                    {row.ticker}
                    {isHeldTicker(row.ticker, disclosure) ? (
                      <>
                        <span style={styles.heldSep}>·</span>
                        <span
                          style={styles.heldPill}
                          title={disclosureBannerText(disclosure)}
                        >
                          HELD
                        </span>
                      </>
                    ) : null}
                    {row.affected && basis === BASIS_ESTIMATED ? (
                      <span style={styles.estPill}>EST</span>
                    ) : null}
                    {row.snapshot ? (
                      <span style={styles.snapPill}>APR 30 SNAPSHOT</span>
                    ) : null}
                  </div>
                  <div style={styles.name}>{row.wrapper.name}</div>
                </div>
                <div style={styles.td} data-label="Basis">
                  <BasisPills
                    anth={anthBasis}
                    oai={oaiBasis}
                    anthLeg={row.wrapper.anthropic}
                    oaiLeg={row.wrapper.openai}
                  />
                </div>
                <div
                  style={styles.td}
                  data-label="Wrapper value"
                  title={denom.label}
                >
                  {fmt$(row.wrapperValue || row.marketCap)}
                  <div style={styles.asOf}>{denom.short}</div>
                  {staleDenom ? (
                    <div style={styles.staleDenom}>Stale denominator</div>
                  ) : null}
                </div>
                <div
                  style={{ ...styles.td, ...styles.tdAccent }}
                  data-label="Anth. / $100"
                >
                  {row.wrapper.anthropic?.kind === "commitment"
                    ? "—"
                    : `${row.wrapper.anthropic?.displayAsMax ? "≤" : ""}${fmtPer100Cell(
                        row.anthPer100,
                        row.anthPer100High,
                        row.deployRange
                      )}`}
                </div>
                <div
                  style={{ ...styles.td, ...styles.tdOai }}
                  data-label="OAI / $100"
                >
                  {row.wrapper.openai?.kind === "commitment"
                    ? "—"
                    : fmtPer100Cell(
                        row.oaiPer100,
                        row.oaiPer100High,
                        row.deployRange
                      )}
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
                <div style={styles.td} data-label="Evidence">
                  <span style={styles.evidence}>{evidence || "—"}</span>
                </div>
                <div style={styles.td} data-label="As of">
                  <div style={styles.asOf}>
                    <StaleDot asOf={row.sharesAsOf} />
                    {row.sharesAsOf}
                  </div>
                </div>
              </div>
              {isOpen ? (
                <RowDetail
                  row={row}
                  anthVal={anthVal}
                  oaiVal={oaiVal}
                  dilution={dilution}
                  quoteAsOf={quotes[row.wrapper.yahooSymbol]?.quoteAsOf}
                  quoteState={quotes[row.wrapper.yahooSymbol]?.state}
                  holdingsAsOf={holdingsAsOf}
                  markAsOf={markAsOf}
                  denom={denom}
                />
              ) : null}
            </div>
          );
        })}
      </div>

      <p style={styles.legend}>
        Click a row for the source arithmetic. As-of staleness:{" "}
        <span style={{ color: STALE_COLOR.amber }}>●</span> amber &gt;90 days
        {" · "}
        <span style={{ color: STALE_COLOR.red }}>●</span> red &gt;180 days.
        Evidence is per-leg in the expanded panel.
      </p>
      <p style={styles.disclaimer}>
        Gross scenario estimates assembled from public filings and issuer
        disclosures. Figures may combine different source dates, security
        classes and valuation methodologies. They are not NAV, liquidation
        value, expected proceeds or price targets, and they exclude taxes,
        fees, carry, liabilities, preferences, transfer restrictions, lockups
        and future financing. Review each row&apos;s source and calculation
        before relying on it.
      </p>
      <p style={styles.caption}>
        <sup style={styles.sup}>†</sup> Convertibles, preferred, capped
        stakes and commitments do not scale linearly with IPO valuation.
      </p>

      <section style={styles.notes}>
        <h2 style={styles.notesTitle}>Sources & footnotes</h2>
        <p style={styles.caption}>
          Implied exposure is not always ownership. Disclosed means an issuer
          or investor stated a percentage. Filed FV-equiv is fair value ÷ the
          round that marked it. Round-implied is dollars invested ÷
          post-money. Commitment has no percentage. DXYZ OpenAI PPUs are
          excluded (not equity).
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
              {` Implied exposure ${fmtExposurePct(claimPct(w.anthropic), { max: !!w.anthropic?.displayAsMax })} Anthropic / ${fmtExposurePct(claimPct(w.openai))} OpenAI.`}
            </div>
          </div>
        ))}
      </section>
    </main>
  );
}

function BasisPills({ anth, oai, anthLeg, oaiLeg }) {
  return (
    <div>
      {anth ? (
        <div style={styles.basisLine}>
          <span style={styles.basisTag}>Anth</span> {anth.label}
          {anthLeg?.secondaryOnly ? (
            <span style={styles.secondaryPill} title="Derived from secondary sources only">
              SECONDARY
            </span>
          ) : null}
        </div>
      ) : null}
      {oai ? (
        <div style={styles.basisLine}>
          <span style={styles.basisTag}>OAI</span> {oai.label}
          {oaiLeg?.secondaryOnly ? (
            <span style={styles.secondaryPill} title="Derived from secondary sources only">
              SECONDARY
            </span>
          ) : null}
        </div>
      ) : null}
      {!anth && !oai ? "—" : null}
    </div>
  );
}

function LegDetail({ name, leg, pct, per100, ipoVal, wrapperValue, dilution }) {
  if (!leg) {
    return (
      <div style={styles.legBlock}>
        <div style={styles.legTitle}>{name}</div>
        <div>None disclosed.</div>
      </div>
    );
  }
  const meta = basisMeta(leg);
  const fv = leg.fairValue || leg.investmentUsd;
  const round = leg.roundVal;
  const showPct = leg.kind !== "commitment" && pct > 0;
  const result =
    showPct && wrapperValue > 0
      ? (pct * (1 - dilution) * ipoVal * 100) / wrapperValue
      : 0;
  return (
    <div style={styles.legBlock}>
      <div style={styles.legTitle}>{name}</div>
      <div>Basis: {meta?.label || "—"}</div>
      {leg.kind === "commitment" ? (
        <div>
          Commitment only — no ownership percentage, no per-$100.
          {leg.investmentUsd
            ? ` Amount referenced: ${fmtUsdPrecise(leg.investmentUsd)}.`
            : ""}
        </div>
      ) : null}
      {fv > 0 && round > 0 ? (
        <div>
          {leg.kind === "round-implied" ? "Investment" : "Filed / carrying value"}:{" "}
          {fmtUsdPrecise(fv)} as of {leg.asOf || "—"}. Source mark:{" "}
          {fmtUsdPrecise(round)}
          {leg.markAsOf ? ` (${leg.markAsOf})` : ""}. Implied exposure:{" "}
          {fmtExposurePct(pct, { max: !!leg.displayAsMax })}.
        </div>
      ) : showPct ? (
        <div>
          Implied exposure: {fmtExposurePct(pct, { max: !!leg.displayAsMax })}
          {leg.capPct ? ` (hard cap ${fmtExposurePct(leg.capPct)})` : ""}.
        </div>
      ) : null}
      {showPct ? (
        <div>
          Scenario value: {fmtUsdPrecise(ipoVal)}. Denominator:{" "}
          {fmtUsdPrecise(wrapperValue)}. Calculation:{" "}
          {fmtExposurePct(pct, { max: !!leg.displayAsMax })} × {fmtUsdPrecise(ipoVal)}{" "}
          ÷ {fmtUsdPrecise(wrapperValue)} × $100
          {dilution > 0 ? ` × (1 − ${Math.round(dilution * 100)}%)` : ""}. Result:{" "}
          {fmtPer100(result)}.
        </div>
      ) : null}
      {leg.source ? <div>Source: {leg.source}</div> : null}
      {leg.secondaryOnly ? (
        <div>Source class: secondary. Not an issuer or filing disclosure.</div>
      ) : null}
      {Array.isArray(leg.exclusions) && leg.exclusions.length
        ? leg.exclusions.map((ex) => (
            <div key={ex.holding}>
              Excluded: {ex.holding}. {ex.reason}
            </div>
          ))
        : null}
    </div>
  );
}

function RowDetail({
  row,
  anthVal,
  oaiVal,
  dilution,
  quoteAsOf,
  quoteState,
  holdingsAsOf,
  markAsOf,
  denom,
}) {
  const priceStruck = formatQuoteEt(quoteAsOf);
  return (
    <div style={styles.detail} onClick={(e) => e.stopPropagation()}>
      <div style={styles.asOfGrid}>
        <div>
          <StaleDot asOf={null} />
          Price: {priceStruck || "unavailable"}
          {quoteState ? ` · ${String(quoteState).toUpperCase()}` : ""} · $
          {row.price.toFixed(2)}
        </div>
        <div>
          <StaleDot asOf={row.sharesAsOf} />
          Share count: {row.denomKind === "netAssets" ? "n/a (TNA)" : fmtShares(row.shares)}{" "}
          ({row.sharesAsOf || "—"})
        </div>
        <div>
          <StaleDot asOf={holdingsAsOf} />
          Holdings: {holdingsAsOf || "—"}
        </div>
        <div>
          <StaleDot asOf={markAsOf} />
          Source mark: {markAsOf || "—"}
        </div>
      </div>
      <div style={styles.asOf}>
        Denominator: {denom.label} {fmtUsdPrecise(row.wrapperValue || row.marketCap)}
        {row.premium != null ? ` · Prem/NAV ${fmtPrem(row.premium)}` : ""}
        {row.wrapper.snapshotNote ? ` · ${row.wrapper.snapshotNote}` : ""}
      </div>
      <LegDetail
        name="Anthropic"
        leg={row.wrapper.anthropic}
        pct={row.anthPct}
        per100={row.anthPer100}
        ipoVal={anthVal}
        wrapperValue={row.wrapperValue || row.marketCap}
        dilution={dilution}
      />
      <LegDetail
        name="OpenAI"
        leg={row.wrapper.openai}
        pct={row.oaiPct}
        per100={row.oaiPer100}
        ipoVal={oaiVal}
        wrapperValue={row.wrapperValue || row.marketCap}
        dilution={dilution}
      />
      {row.wrapper.security ? (
        <div style={styles.asOf}>
          Security: {row.wrapper.security.label}. {row.wrapper.security.footnote}
        </div>
      ) : null}
      {row.wrapper.navNote ? (
        <div style={styles.asOf}>{row.wrapper.navNote.body}</div>
      ) : null}
    </div>
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
    marginBottom: "12px",
  },
  disclosure: {
    fontFamily: "var(--font-mono), 'JetBrains Mono', monospace",
    fontSize: "12px",
    lineHeight: 1.55,
    color: "#44403c",
    maxWidth: "720px",
    margin: "0 0 16px",
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
  badgeLive: {
    background: "#dcfce7",
    color: "#166534",
  },
  badgeClose: {
    background: "#e7e5e4",
    color: "#1c1917",
  },
  badgeStale: {
    background: "#ffedd5",
    color: "#9a3412",
  },
  badgeUnavailable: {
    background: "#e7e5e4",
    color: "#44403c",
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
  heldSep: {
    marginLeft: "6px",
    color: "#78716c",
    fontWeight: 500,
  },
  heldPill: {
    marginLeft: "4px",
    fontSize: "9px",
    letterSpacing: "0.08em",
    color: "#1c1917",
    background: "#e7e5e4",
    border: "1px solid #a8a29e",
    padding: "1px 4px",
    fontWeight: 700,
    verticalAlign: "middle",
  },
  secondaryPill: {
    marginLeft: "6px",
    fontSize: "8px",
    letterSpacing: "0.06em",
    color: "#9a3412",
    background: "#ffedd5",
    padding: "1px 4px",
    fontWeight: 700,
    verticalAlign: "middle",
  },
  snapPill: {
    marginLeft: "6px",
    fontSize: "8px",
    letterSpacing: "0.06em",
    color: "#44403c",
    background: "#e7e5e4",
    padding: "1px 4px",
    fontWeight: 700,
    verticalAlign: "middle",
  },
  chevron: {
    display: "inline-block",
    width: "12px",
    color: "#78716c",
    fontSize: "11px",
  },
  basisLine: {
    fontSize: "10px",
    lineHeight: 1.45,
  },
  basisTag: {
    fontSize: "8px",
    letterSpacing: "0.08em",
    color: "#78716c",
    marginRight: "4px",
  },
  evidence: {
    textTransform: "uppercase",
    fontSize: "10px",
    letterSpacing: "0.06em",
    fontWeight: 600,
    whiteSpace: "nowrap",
  },
  staleDenom: {
    fontSize: "9px",
    color: "#b45309",
    letterSpacing: "0.04em",
    marginTop: "2px",
  },
  disclaimer: {
    fontFamily: "var(--font-mono), monospace",
    fontSize: "11px",
    color: "#44403c",
    lineHeight: 1.65,
    margin: "12px 0 16px",
    maxWidth: "820px",
  },
  detail: {
    fontFamily: "var(--font-mono), monospace",
    fontSize: "11px",
    color: "#44403c",
    lineHeight: 1.6,
    padding: "12px 8px 16px 20px",
    borderBottom: "1px solid #e7e5e4",
    background: "#fafaf9",
  },
  asOfGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: "6px 16px",
    marginBottom: "10px",
  },
  legBlock: {
    margin: "10px 0",
  },
  legTitle: {
    fontWeight: 700,
    letterSpacing: "0.04em",
    textTransform: "uppercase",
    fontSize: "10px",
    color: "#1c1917",
    marginBottom: "4px",
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
