"use client";

import React, { useEffect, useState } from "react";
import { startJsonPoll } from "../lib/pollLivePrices.mjs";
import { INVESTOR_DAY_POLL_MS } from "../lib/investorDay.mjs";
import {
  disclosureAgeLabel,
  disclosureSentence,
  isHeldTicker,
} from "../lib/disclosure.mjs";
import disclosure from "../data/disclosure.json";

const MONO = "var(--font-mono), 'JetBrains Mono', monospace";
const UP = "#15803d";
const DOWN = "#be123c";
const FLAT = "#57534e";
const INK = "#1c1917";
const MUTED = "#78716c";
const RULE = "#e7e5e4";

const BANDS = {
  calm: { label: "Calm", color: "#15803d", bg: "#dcfce7" },
  moving: { label: "Moving", color: "#b45309", bg: "#fef3c7" },
  something: { label: "Something's up", color: "#be123c", bg: "#ffe4e6" },
};
const METER_MAX_SIGMA = 5;

function signColor(n) {
  if (!Number.isFinite(n) || Math.abs(n) < 1e-6) return FLAT;
  return n > 0 ? UP : DOWN;
}

function fmtPct(n, digits = 2) {
  if (!Number.isFinite(n)) return "—";
  const sign = n > 0 ? "+" : n < 0 ? "−" : "";
  return `${sign}${Math.abs(n * 100).toFixed(digits)}%`;
}

function fmtProb(p) {
  return Number.isFinite(p) ? `${(p * 100).toFixed(1)}%` : "—";
}

function fmtPp(d) {
  if (!Number.isFinite(d)) return "—";
  const sign = d > 0 ? "+" : d < 0 ? "−" : "±";
  return `${sign}${Math.abs(d * 100).toFixed(1)} pp`;
}

// io:ANTH markPx is quoted in $B of implied valuation.
function fmtTFromB(b) {
  return Number.isFinite(b) ? `$${(b / 1000).toFixed(2)}T` : "—";
}

function fmtT(t) {
  return Number.isFinite(t) ? `$${t.toFixed(2)}T` : "—";
}

function fmtDeltaB(t) {
  if (!Number.isFinite(t)) return "—";
  const b = t * 1000;
  const sign = b > 0 ? "+" : b < 0 ? "−" : "±";
  return `${sign}$${Math.abs(b).toFixed(0)}B`;
}

function fmtUsdCompact(n) {
  if (!Number.isFinite(n)) return "—";
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  return `$${n.toFixed(0)}`;
}

function fmtEt(ms, withDate = false) {
  if (!(ms > 0)) return "—";
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    ...(withDate ? { month: "short", day: "numeric" } : {}),
    hour: "numeric",
    minute: "2-digit",
    second: withDate ? undefined : "2-digit",
    hour12: true,
  }).format(new Date(ms));
}

function Sparkline({ points, baseline }) {
  if (!points || points.length < 2) {
    return <div style={styles.sparkEmpty}>Waiting for 5m candles since 00:00 ET</div>;
  }
  const w = 640;
  const h = 96;
  const pad = 4;
  const xs = points.map((p) => p.t);
  const ys = points.map((p) => p.p).concat(Number.isFinite(baseline) ? [baseline] : []);
  const x0 = Math.min(...xs);
  const x1 = Math.max(...xs);
  const y0 = Math.min(...ys);
  const y1 = Math.max(...ys);
  const sx = (t) => pad + ((t - x0) / Math.max(1, x1 - x0)) * (w - pad * 2);
  const sy = (p) => h - pad - ((p - y0) / Math.max(1e-9, y1 - y0)) * (h - pad * 2);
  const d = points.map((p, i) => `${i ? "L" : "M"}${sx(p.t).toFixed(1)},${sy(p.p).toFixed(1)}`).join("");
  const last = points[points.length - 1];
  const color = signColor(last.p - (baseline ?? points[0].p));
  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      preserveAspectRatio="none"
      style={styles.spark}
      role="img"
      aria-label="io:ANTH 5-minute closes since midnight ET"
    >
      {Number.isFinite(baseline) ? (
        <line x1={pad} x2={w - pad} y1={sy(baseline)} y2={sy(baseline)} stroke="#a8a29e" strokeDasharray="4 4" strokeWidth="1" vectorEffect="non-scaling-stroke" />
      ) : null}
      <path d={d} fill="none" stroke={color} strokeWidth="2" vectorEffect="non-scaling-stroke" />
      <circle cx={sx(last.t)} cy={sy(last.p)} r="3" fill={color} />
    </svg>
  );
}

function Tile({ eyebrow, value, change, changeLabel, sub }) {
  return (
    <div style={styles.tile}>
      <div style={styles.tileEyebrow}>{eyebrow}</div>
      <div style={styles.tileValue}>{value}</div>
      <div style={{ ...styles.tileChange, color: signColor(change?.n) }}>
        {change?.text ?? "—"} <span style={styles.tileChangeLabel}>{changeLabel}</span>
      </div>
      {sub ? <div style={styles.tileSub}>{sub}</div> : null}
    </div>
  );
}

function BracketChart({ brackets, noIpo }) {
  if (!brackets?.length) return <div style={styles.muted}>Bracket market unavailable.</div>;
  const max = Math.max(0.05, ...brackets.flatMap((b) => [b.price, b.baseline ?? 0]));
  return (
    <div>
      <div style={styles.legend}>
        <span><span style={styles.legendSolid} /> Now</span>
        <span><span style={styles.legendGhost} /> 00:00 ET (≈ prior-day close)</span>
      </div>
      {brackets.map((b) => (
        <div key={b.label} style={styles.barRow}>
          <div style={styles.barLabel}>{b.label}</div>
          <div style={styles.barTrack}>
            {Number.isFinite(b.baseline) ? (
              <div style={{ ...styles.barGhost, width: `${(b.baseline / max) * 100}%` }} />
            ) : null}
            <div style={{ ...styles.barFill, width: `${(b.price / max) * 100}%` }} />
          </div>
          <div style={styles.barValue}>{fmtProb(b.price)}</div>
          <div style={{ ...styles.barDelta, color: signColor(b.change) }}>{fmtPp(b.change)}</div>
        </div>
      ))}
      {noIpo ? (
        <div style={styles.footnote}>
          Excluded from the expected value: “{noIpo.label}” at {fmtProb(noIpo.price)}.
          Bracket prices are normalized to sum to 100%; open-ended tails use $1.125T and $3.125T.
        </div>
      ) : null}
    </div>
  );
}

function UnusualMeter({ unusual }) {
  const sigmas = unusual?.sigmas;
  const band = BANDS[unusual?.band] ?? null;
  const pos = Number.isFinite(sigmas) ? Math.min(sigmas, METER_MAX_SIGMA) / METER_MAX_SIGMA : null;
  return (
    <div>
      <div style={styles.meterHead}>
        <div style={{ ...styles.meterValue, color: band?.color ?? FLAT }}>
          {Number.isFinite(sigmas) ? `${sigmas.toFixed(1)}σ` : "—"}
        </div>
        {band ? (
          <span style={{ ...styles.bandPill, color: band.color, background: band.bg }}>{band.label}</span>
        ) : null}
      </div>
      <div style={styles.meterTrack}>
        <div style={{ ...styles.meterZone, left: 0, width: `${(1.5 / METER_MAX_SIGMA) * 100}%`, background: BANDS.calm.bg }} />
        <div style={{ ...styles.meterZone, left: `${(1.5 / METER_MAX_SIGMA) * 100}%`, width: `${(1.5 / METER_MAX_SIGMA) * 100}%`, background: BANDS.moving.bg }} />
        <div style={{ ...styles.meterZone, left: `${(3 / METER_MAX_SIGMA) * 100}%`, right: 0, background: BANDS.something.bg }} />
        {pos != null ? <div style={{ ...styles.meterMarker, left: `${pos * 100}%` }} /> : null}
      </div>
      <div style={styles.meterScale}>
        <span>0σ</span><span>1.5σ</span><span>3σ</span><span>{METER_MAX_SIGMA}σ+</span>
      </div>
      <div style={styles.footnote}>
        Volatility gauge, not a signal. |15-minute io:ANTH return| ({fmtPct(unusual?.current, 3)})
        ÷ the standard deviation of 15-minute returns over the trailing {unusual?.lookbackDays ?? 30} days
        ({fmtPct(unusual?.sigma15m, 3)}, n={unusual?.sigmaN ?? "—"}). Calm &lt;1.5σ · Moving 1.5–3σ · Something&apos;s up &gt;3σ.
      </div>
    </div>
  );
}

function ProxyTable({ rows, control, sessionOpen }) {
  const all = [...(rows || []), ...(control ? [{ ...control, isControl: true }] : [])];
  return (
    <div style={styles.table}>
      <div style={styles.tableHeader} className="vcx-table-header">
        <div style={styles.cTicker}>Ticker</div>
        <div style={styles.cNum}>Last</div>
        <div style={styles.cNum}>Day</div>
        <div style={styles.cNum}>Since 9:30</div>
        <div style={styles.cNum}>Day vs QQQ</div>
        <div style={styles.cNum}>9:30 vs QQQ</div>
      </div>
      {all.map((row) => {
        const heldTicker = row.heldAs ?? row.ticker;
        const held = isHeldTicker(heldTicker, disclosure);
        return (
          <div key={row.ticker} style={styles.tableRow} className="vcx-row">
            <div style={styles.cTicker}>
              <span style={styles.ticker}>{row.ticker}</span>
              {held ? (
                <>
                  <span style={styles.heldSep}>·</span>
                  <span style={styles.heldPill} title={disclosureSentence(disclosure)}>
                    {row.heldAs ? `HELD (${row.heldAs})` : "HELD"}
                  </span>
                </>
              ) : null}
              {row.isControl ? <span style={styles.controlPill}>CONTROL</span> : null}
              <div style={styles.tickerNote}>{row.note}</div>
            </div>
            <div style={styles.cNum} data-label="Last">
              {Number.isFinite(row.price) ? `$${row.price.toFixed(2)}` : "—"}
            </div>
            <div style={{ ...styles.cNum, color: signColor(row.dayPct) }} data-label="Day">
              {sessionOpen === false ? "pre-open" : fmtPct(row.dayPct)}
            </div>
            <div style={{ ...styles.cNum, color: signColor(row.sinceOpenPct) }} data-label="Since 9:30">
              {sessionOpen === false ? "pre-open" : fmtPct(row.sinceOpenPct)}
            </div>
            <div style={{ ...styles.cNum, color: signColor(row.excessDay) }} data-label="Day vs QQQ">
              {row.isControl ? "" : fmtPct(row.excessDay)}
            </div>
            <div style={{ ...styles.cNum, color: signColor(row.excessSinceOpen) }} data-label="9:30 vs QQQ">
              {row.isControl ? "" : fmtPct(row.excessSinceOpen)}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function InvestorDayTape() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [lastFetch, setLastFetch] = useState(null);

  useEffect(
    () =>
      startJsonPoll("/api/investor-day", {
        onData: (payload) => {
          setData(payload);
          setError(null);
          setLastFetch(Date.now());
        },
        onError: (err) => setError(err),
        intervalMs: INVESTOR_DAY_POLL_MS,
        pauseWhenHidden: true,
      }),
    []
  );

  const anth = data?.perps?.anthropic;
  const oai = data?.perps?.openai;
  const pm = data?.polymarket;
  const kalshi = data?.kalshi || [];
  const kalshi2027 = kalshi.find((k) => k.key === "ipoBefore2027");
  const nov30 = pm?.ipoBy?.find((l) => l.key === "November 30, 2026");
  const sessionOpen = data?.baselines?.sessionOpen;
  const ageLabel = disclosureAgeLabel(disclosure.asOf);

  return (
    <main style={styles.container} className="vcx-container">
      <div style={styles.eyebrow} className="vcx-eyebrow">
        LIVE TAPE · ANTHROPIC INVESTOR DAY · OCT 14, 2026
      </div>
      <h1 style={styles.title} className="vcx-title">Anthropic Investor Day tape</h1>
      <p style={styles.disclosure}>
        {disclosureSentence(disclosure)}
        {ageLabel ? <span style={styles.disclosureAge}> ({ageLabel})</span> : null}
      </p>

      <div style={styles.statusRow}>
        <span style={{ ...styles.statusChip, ...(data?.errors?.length ? styles.statusWarn : {}) }}>
          {data ? (data.source || "live").toUpperCase() : error ? "OFFLINE" : "LOADING"}
        </span>
        <span style={styles.statusText}>
          {data ? `as of ${fmtEt(Date.parse(data.asOf))} ET · refreshes every 15s` : "Fetching four venues…"}
          {error && lastFetch ? " · last refresh failed, showing previous data" : ""}
        </span>
      </div>

      <section style={styles.hero}>
        <div style={styles.heroTop}>
          <div>
            <div style={styles.sectionEyebrow}>IMPLIED ANTHROPIC VALUATION · HYPERLIQUID io:ANTH</div>
            <div style={styles.heroValue}>{fmtTFromB(anth?.markPx)}</div>
          </div>
          <div style={styles.heroChanges}>
            <div>
              <div style={styles.heroChangeLabel}>Since 00:00 ET</div>
              <div style={{ ...styles.heroChange, color: signColor(anth?.changeSinceMidnight) }}>
                {fmtPct(anth?.changeSinceMidnight)}
              </div>
            </div>
            <div>
              <div style={styles.heroChangeLabel}>Since 9:30 open</div>
              <div style={{ ...styles.heroChange, color: signColor(anth?.changeSinceOpen) }}>
                {sessionOpen === false ? "pre-open" : fmtPct(anth?.changeSinceOpen)}
              </div>
            </div>
          </div>
        </div>
        <Sparkline points={anth?.sparkline} baseline={anth?.midnightPx} />
        <div style={styles.heroMeta}>
          Mark {anth?.markPx?.toFixed(1) ?? "—"} ($B) · 24h {fmtPct(anth?.change24h)} · OI{" "}
          {fmtUsdCompact(anth?.openInterestUsd)} · 24h volume {fmtUsdCompact(anth?.dayNtlVlm)} · funding{" "}
          {Number.isFinite(anth?.funding) ? `${(anth.funding * 100).toFixed(4)}%/h` : "—"}
          {oai ? ` · io:OAI ${fmtTFromB(oai.markPx)} (${fmtPct(oai.change24h)} 24h)` : ""}
        </div>
      </section>

      <section style={styles.tiles}>
        <Tile
          eyebrow="POLYMARKET · EXPECTED FIRST-DAY CLOSE"
          value={fmtT(pm?.expectedClose?.valueT)}
          change={{ n: pm?.expectedClose?.changeT, text: fmtDeltaB(pm?.expectedClose?.changeT) }}
          changeLabel="since 00:00 ET"
          sub="Probability-weighted bracket midpoints"
        />
        <Tile
          eyebrow="POLYMARKET · IPO BY NOV 30"
          value={fmtProb(nov30?.price)}
          change={{ n: nov30?.change, text: fmtPp(nov30?.change) }}
          changeLabel="since 00:00 ET"
          sub={pm?.ipoBy?.filter((l) => l !== nov30).map((l) => `${l.key.replace(", 2026", "")} ${fmtProb(l.price)}`).join(" · ")}
        />
        <Tile
          eyebrow="KALSHI · IPO BEFORE 2027"
          value={fmtProb(kalshi2027?.mid)}
          change={{ n: kalshi2027?.change, text: fmtPp(kalshi2027?.change) }}
          changeLabel="since 00:00 ET"
          sub={kalshi2027 ? `Bid ${fmtProb(kalshi2027.bid)} / ask ${fmtProb(kalshi2027.ask)} · mid shown` : null}
        />
        <Tile
          eyebrow="POLYMARKET · BEST MODEL END OF OCT"
          value={fmtProb(pm?.bestModel?.price)}
          change={{ n: pm?.bestModel?.change, text: fmtPp(pm?.bestModel?.change) }}
          changeLabel="since 00:00 ET"
          sub={(() => {
            const k = kalshi.find((x) => x.key === "bestModelOct");
            return k ? `Kalshi “Claude” ${fmtProb(k.mid)} (${fmtPp(k.change)})` : null;
          })()}
        />
      </section>

      <div style={styles.twoCol} className="investor-day-two-col">
        <section style={styles.panel}>
          <h2 style={styles.h2}>First-day closing market cap</h2>
          <div style={styles.panelSub}>Polymarket · 9 brackets</div>
          <BracketChart brackets={pm?.brackets} noIpo={pm?.noIpo} />
        </section>
        <section style={styles.panel}>
          <h2 style={styles.h2}>Unusual move meter</h2>
          <div style={styles.panelSub}>io:ANTH 15-minute move vs its own 30-day volatility</div>
          <UnusualMeter unusual={anth?.unusual} />
          <div style={styles.extraLegs}>
            <div style={styles.extraRow}>
              <span>Polymarket: Anthropic &gt; OpenAI valuation on Dec 31</span>
              <strong style={styles.extraValue}>{fmtProb(pm?.vsOpenai?.price)}</strong>
            </div>
            {kalshi
              .filter((k) => k.key === "announceByDec1")
              .map((k) => (
                <div key={k.key} style={styles.extraRow}>
                  <span>Kalshi: {k.label}</span>
                  <strong style={styles.extraValue}>
                    {fmtProb(k.mid)} <span style={{ color: signColor(k.change), fontWeight: 500 }}>{fmtPp(k.change)}</span>
                  </strong>
                </div>
              ))}
          </div>
        </section>
      </div>

      <section style={styles.panel}>
        <h2 style={styles.h2}>Public proxies</h2>
        <div style={styles.panelSub}>
          Yahoo Finance · “vs QQQ” is the simple difference from QQQ over the same window.
          HELD marks a position disclosed above.
        </div>
        <ProxyTable rows={data?.proxies?.rows} control={data?.proxies?.control} sessionOpen={sessionOpen} />
      </section>

      {data?.errors?.length ? (
        <div style={styles.errors}>
          Some venues failed this refresh: {data.errors.join(" · ")}
        </div>
      ) : null}

      <section style={styles.sources}>
        <div>
          Sources: Hyperliquid io dex (io:ANTH, io:OAI marks, 5m/15m candles) · Polymarket Gamma and
          CLOB price history · Kalshi trade API (bid/ask mid) · Yahoo Finance v8 charts. “Since 00:00 ET”
          compares against the last print at or before midnight Eastern.
        </div>
        <div>As of {data ? `${fmtEt(Date.parse(data.asOf), true)} ET` : "—"}.</div>
        <div style={styles.sourcesStrong}>Public market data only. Not affiliated with Anthropic.</div>
      </section>
    </main>
  );
}

const styles = {
  container: { maxWidth: "1180px", margin: "0 auto", padding: "40px 56px 64px", color: INK },
  eyebrow: { fontFamily: MONO, fontSize: "11px", letterSpacing: "0.18em", color: "#44403c", marginBottom: "12px", fontWeight: 500 },
  title: { fontSize: "48px", lineHeight: 1.05, fontWeight: 500, color: INK, margin: "0 0 12px" },
  disclosure: { fontFamily: MONO, fontSize: "12px", lineHeight: 1.55, color: "#44403c", maxWidth: "720px", margin: "0 0 12px" },
  disclosureAge: { color: MUTED },
  statusRow: { display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap", marginBottom: "20px" },
  statusChip: { fontFamily: MONO, fontSize: "10px", letterSpacing: "0.12em", background: "#dcfce7", color: "#14532d", padding: "3px 8px", fontWeight: 600 },
  statusWarn: { background: "#fef3c7", color: "#78350f" },
  statusText: { fontFamily: MONO, fontSize: "11px", color: MUTED },
  hero: { border: `1px solid ${RULE}`, background: "#fff", padding: "20px", marginBottom: "16px" },
  heroTop: { display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: "16px", flexWrap: "wrap", marginBottom: "12px" },
  sectionEyebrow: { fontFamily: MONO, fontSize: "10px", letterSpacing: "0.12em", color: MUTED, marginBottom: "6px" },
  heroValue: { fontSize: "56px", lineHeight: 1, fontWeight: 500, fontVariantNumeric: "tabular-nums" },
  heroChanges: { display: "flex", gap: "24px" },
  heroChangeLabel: { fontFamily: MONO, fontSize: "10px", letterSpacing: "0.08em", color: MUTED, textTransform: "uppercase" },
  heroChange: { fontSize: "22px", fontWeight: 600, fontVariantNumeric: "tabular-nums" },
  spark: { width: "100%", height: "96px", display: "block" },
  sparkEmpty: { height: "96px", display: "flex", alignItems: "center", fontFamily: MONO, fontSize: "11px", color: MUTED },
  heroMeta: { fontFamily: MONO, fontSize: "11px", color: MUTED, marginTop: "10px", lineHeight: 1.6 },
  tiles: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "12px", marginBottom: "16px" },
  tile: { border: `1px solid ${RULE}`, background: "#fff", padding: "14px 16px" },
  tileEyebrow: { fontFamily: MONO, fontSize: "10px", letterSpacing: "0.1em", color: MUTED, marginBottom: "8px" },
  tileValue: { fontSize: "32px", fontWeight: 500, lineHeight: 1.1, fontVariantNumeric: "tabular-nums" },
  tileChange: { fontFamily: MONO, fontSize: "13px", fontWeight: 600, marginTop: "6px" },
  tileChangeLabel: { fontWeight: 400, color: MUTED, fontSize: "11px" },
  tileSub: { fontFamily: MONO, fontSize: "10.5px", color: MUTED, marginTop: "8px", lineHeight: 1.5 },
  twoCol: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "16px", marginBottom: "16px" },
  panel: { border: `1px solid ${RULE}`, background: "#fff", padding: "18px 20px", marginBottom: "16px", minWidth: 0 },
  h2: { fontSize: "20px", fontWeight: 500, margin: "0 0 2px" },
  panelSub: { fontFamily: MONO, fontSize: "11px", color: MUTED, marginBottom: "14px", lineHeight: 1.5 },
  muted: { color: MUTED, fontSize: "13px" },
  legend: { display: "flex", gap: "16px", fontFamily: MONO, fontSize: "10.5px", color: MUTED, marginBottom: "10px", flexWrap: "wrap" },
  legendSolid: { display: "inline-block", width: "12px", height: "8px", background: "#2563eb", marginRight: "4px" },
  legendGhost: { display: "inline-block", width: "12px", height: "8px", border: "1px dashed #78716c", marginRight: "4px", boxSizing: "border-box" },
  barRow: { display: "grid", gridTemplateColumns: "88px 1fr 48px 60px", alignItems: "center", gap: "8px", padding: "3px 0" },
  barLabel: { fontFamily: MONO, fontSize: "11px", color: "#44403c", whiteSpace: "nowrap" },
  barTrack: { position: "relative", height: "16px", background: "#f5f5f4" },
  barGhost: { position: "absolute", top: 0, bottom: 0, left: 0, border: "1px dashed #78716c", boxSizing: "border-box", zIndex: 2 },
  barFill: { position: "absolute", top: "3px", bottom: "3px", left: 0, background: "#2563eb", zIndex: 1 },
  barValue: { fontFamily: MONO, fontSize: "11px", textAlign: "right", fontVariantNumeric: "tabular-nums" },
  barDelta: { fontFamily: MONO, fontSize: "11px", textAlign: "right", fontVariantNumeric: "tabular-nums" },
  footnote: { fontFamily: MONO, fontSize: "10.5px", color: MUTED, marginTop: "12px", lineHeight: 1.55 },
  meterHead: { display: "flex", alignItems: "center", gap: "12px", marginBottom: "10px" },
  meterValue: { fontSize: "40px", fontWeight: 500, lineHeight: 1, fontVariantNumeric: "tabular-nums" },
  bandPill: { fontFamily: MONO, fontSize: "11px", fontWeight: 700, letterSpacing: "0.06em", padding: "3px 8px", textTransform: "uppercase" },
  meterTrack: { position: "relative", height: "14px" },
  meterZone: { position: "absolute", top: 0, bottom: 0 },
  meterMarker: { position: "absolute", top: "-4px", bottom: "-4px", width: "3px", marginLeft: "-1.5px", background: INK },
  meterScale: { display: "flex", justifyContent: "space-between", fontFamily: MONO, fontSize: "10px", color: MUTED, marginTop: "6px" },
  extraLegs: { borderTop: `1px solid ${RULE}`, marginTop: "16px", paddingTop: "12px" },
  extraRow: { display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: "12px", fontSize: "13px", padding: "4px 0" },
  extraValue: { whiteSpace: "nowrap" },
  table: { borderTop: `1px solid ${RULE}`, overflowX: "auto" },
  tableHeader: { display: "flex", fontFamily: MONO, fontSize: "10px", letterSpacing: "0.08em", textTransform: "uppercase", color: MUTED, padding: "8px 0", borderBottom: `1px solid ${RULE}`, minWidth: "640px" },
  tableRow: { display: "flex", alignItems: "center", padding: "8px 0", borderBottom: `1px solid ${RULE}`, minWidth: "640px" },
  cTicker: { flex: "2 1 0", minWidth: 0 },
  cNum: { flex: "1 1 0", textAlign: "right", fontFamily: MONO, fontSize: "13px", fontVariantNumeric: "tabular-nums" },
  ticker: { fontFamily: MONO, fontWeight: 700, fontSize: "13px" },
  tickerNote: { fontSize: "11px", color: MUTED, marginTop: "2px" },
  heldSep: { marginLeft: "6px", color: MUTED, fontWeight: 500 },
  heldPill: { marginLeft: "4px", fontFamily: MONO, fontSize: "9px", letterSpacing: "0.08em", color: INK, background: RULE, border: "1px solid #a8a29e", padding: "1px 4px", fontWeight: 700, cursor: "help" },
  controlPill: { marginLeft: "6px", fontFamily: MONO, fontSize: "9px", letterSpacing: "0.08em", color: "#1e3a8a", background: "#dbeafe", padding: "1px 4px", fontWeight: 700 },
  errors: { fontFamily: MONO, fontSize: "11px", background: "#fef3c7", color: "#78350f", padding: "10px 12px", marginBottom: "16px" },
  sources: { fontFamily: MONO, fontSize: "11px", color: MUTED, lineHeight: 1.6, display: "grid", gap: "6px", borderTop: `1px solid ${RULE}`, paddingTop: "16px" },
  sourcesStrong: { color: INK, fontWeight: 600 },
};
