"use client";

import React, { useEffect, useRef, useState } from "react";
import { startJsonPoll } from "../lib/pollLivePrices.mjs";
import {
  HYPERLIQUID_URLS,
  INVESTOR_DAY_POLL_MS,
  KALSHI_CONFIRMED_RULE,
  KALSHI_MARKETS,
  POLYMARKET_SLUGS,
  polymarketUrl,
  volumeBand as volumeBandOf,
  yahooQuoteUrl,
} from "../lib/investorDay.mjs";
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

const VOLUME_STYLE = {
  quiet: { label: "Quiet", color: "#57534e", bg: "#f5f5f4" },
  normal: { label: "Normal", color: "#15803d", bg: "#dcfce7" },
  busy: { label: "Busy", color: "#b45309", bg: "#fef3c7" },
  heavy: { label: "Heavy", color: "#be123c", bg: "#ffe4e6" },
};
const VOLUME_MAX_RATIO = 5;

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

function Ext({ href, children, style, label }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      style={{ ...styles.extLink, ...style }}
      aria-label={label}
      title={label}
    >
      {children}
    </a>
  );
}

// The author's direct Anthropic stake is disclosed in prose, not as a ticker.
const HOLDS_ANTHROPIC_SPV = /Anthropic through an SPV/.test(disclosure.notes);

const KALSHI_URL = Object.fromEntries(KALSHI_MARKETS.map((m) => [m.key, m.url]));
const PM_URL = Object.fromEntries(
  Object.entries(POLYMARKET_SLUGS).map(([k, slug]) => [k, polymarketUrl(slug)])
);

const SOURCE_LINKS = [
  { venue: "Hyperliquid", links: [["io:ANTH", HYPERLIQUID_URLS.anthropic], ["io:OAI", HYPERLIQUID_URLS.openai]] },
  {
    venue: "Polymarket",
    links: [
      ["Closing cap", PM_URL.closingCap],
      ["IPO by", PM_URL.ipoBy],
      ["Best model Oct", PM_URL.bestModel],
      ["vs OpenAI", PM_URL.vsOpenai],
    ],
  },
  {
    venue: "Kalshi",
    links: [
      ["IPO 2026", KALSHI_URL.ipoBefore2027],
      ["IPO date", KALSHI_URL.confirmedByDec1],
      ["Best AI Oct", KALSHI_URL.bestModelOct],
    ],
  },
];

function SourceStrip() {
  return (
    <nav style={styles.sourceStrip} aria-label="Source markets">
      {SOURCE_LINKS.map((group) => (
        <span key={group.venue} style={styles.sourceGroup}>
          <span style={styles.sourceVenue}>{group.venue}</span>
          {group.links.map(([text, href]) => (
            <Ext key={href} href={href} style={styles.sourceLink} label={`${group.venue}: ${text} (opens in a new tab)`}>
              {text} ↗
            </Ext>
          ))}
        </span>
      ))}
    </nav>
  );
}

function Tile({ eyebrow, value, change, changeLabel, sub, href }) {
  const body = (
    <>
      <div style={styles.tileEyebrow}>
        {eyebrow}
        {href ? " ↗" : ""}
      </div>
      <div style={styles.tileValue}>{value}</div>
      <div style={{ ...styles.tileChange, color: signColor(change?.n) }}>
        {change?.text ?? "—"} <span style={styles.tileChangeLabel}>{changeLabel}</span>
      </div>
      {sub ? <div style={styles.tileSub}>{sub}</div> : null}
    </>
  );
  if (!href) return <div style={styles.tile}>{body}</div>;
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      style={{ ...styles.tile, ...styles.tileLink }}
      className="investor-day-link-card"
    >
      {body}
    </a>
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

function fmtSigma(z) {
  if (!Number.isFinite(z)) return "—";
  const sign = z > 0 ? "+" : z < 0 ? "−" : "";
  return `${sign}${Math.abs(z).toFixed(1)}σ`;
}

function UnusualMeter({ unusual }) {
  const sigmas = unusual?.sigmas;
  const band = BANDS[unusual?.band] ?? null;
  const pos = Number.isFinite(sigmas) ? Math.min(Math.abs(sigmas), METER_MAX_SIGMA) / METER_MAX_SIGMA : null;
  const peak = unusual?.peak;
  const peakBand = BANDS[peak?.band] ?? null;
  return (
    <div>
      <div style={styles.meterHead}>
        <div style={{ ...styles.meterValue, color: band?.color ?? FLAT }}>
          {fmtSigma(sigmas)}
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
      <div style={styles.peakLine}>
        Peak today:{" "}
        {peak ? (
          <strong style={{ color: peakBand?.color ?? FLAT }}>
            {fmtSigma(peak.sigmas)} at {fmtEt(peak.atMs).replace(/:\d\d (?=[AP]M)/, " ")} ET
          </strong>
        ) : (
          "—"
        )}{" "}
        <span style={{ color: MUTED }}>(largest rolling 15-minute move since 00:00 ET)</span>
      </div>
      <div style={styles.footnote}>
        Volatility gauge, not a signal. io:ANTH mark vs its price 15 minutes ago ({fmtPct(unusual?.current, 3)}),
        rolling, ÷ the standard deviation of 15-minute returns over the trailing {unusual?.lookbackDays ?? 30} days
        ({fmtPct(unusual?.sigma15m, 3)}, n={unusual?.sigmaN ?? "—"}). Calm &lt;1.5σ · Moving 1.5–3σ · Something&apos;s up &gt;3σ.
      </div>
    </div>
  );
}

function fmtVolume(n, unit) {
  if (!Number.isFinite(n)) return "—";
  const abs = Math.abs(n);
  const text =
    abs >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : abs >= 1e3 ? `${(n / 1e3).toFixed(1)}k` : n.toFixed(0);
  return unit === "usd" ? `$${text}` : `${text} contracts`;
}

function VolumePanel({ rows }) {
  if (!rows?.length) return <div style={styles.muted}>Volume unavailable.</div>;
  return (
    <div>
      {rows.map((r) => {
        const band = VOLUME_STYLE[r.band] ?? null;
        const pos = Number.isFinite(r.ratio) ? Math.min(r.ratio, VOLUME_MAX_RATIO) / VOLUME_MAX_RATIO : null;
        return (
          <div key={r.key} style={styles.volRow}>
            <div style={styles.volHead}>
              <div style={{ minWidth: 0 }}>
                <span style={styles.volVenue}>{r.venue}</span>{" "}
                {r.url ? (
                  <Ext href={r.url} label={`${r.label} on ${r.venue} (opens in a new tab)`}>
                    {r.label} ↗
                  </Ext>
                ) : (
                  r.label
                )}
              </div>
              <div style={styles.volRatioWrap}>
                <strong style={{ ...styles.volRatio, color: band?.color ?? FLAT }}>
                  {Number.isFinite(r.ratio) ? `${r.ratio.toFixed(1)}×` : "—"}
                </strong>
                {band ? (
                  <span style={{ ...styles.bandPill, fontSize: "10px", color: band.color, background: band.bg }}>
                    {band.label}
                  </span>
                ) : null}
              </div>
            </div>
            <div style={styles.volTrack}>
              <div style={{ ...styles.volNormalMark, left: `${(1 / VOLUME_MAX_RATIO) * 100}%` }} />
              {pos != null ? (
                <div style={{ ...styles.volFill, width: `${pos * 100}%`, background: band?.color ?? FLAT }} />
              ) : null}
            </div>
            <div style={styles.volMeta}>
              {fmtVolume(r.current, r.unit)} vs normal {fmtVolume(r.normal, r.unit)} · {r.window}
            </div>
          </div>
        );
      })}
      <div style={styles.footnote}>
        Each row compares a venue against its own history, so the windows differ and the rows are not
        blended. Tick at 1× = normal. Quiet &lt;0.75× · Normal 0.75–1.5× · Busy 1.5–3× · Heavy &gt;3×.
        24h norms use the six days before the trailing 24h so today is not in its own baseline.
      </div>
    </div>
  );
}

// ---- Sigma through the day -------------------------------------------------

const SIGMA_Y_MAX = 5;
const SIGMA_BREACH = 3;

function useWidth(fallback = 320) {
  const ref = useRef(null);
  const [width, setWidth] = useState(fallback);
  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const apply = () => setWidth(Math.max(240, Math.round(el.clientWidth)));
    apply();
    const observer = new ResizeObserver(apply);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return [ref, width];
}

function fmtHourEt(ms) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  })
    .format(new Date(ms))
    .replace(":00", "")
    .replace(" ", "");
}

function SigmaSummaryLine({ summary }) {
  if (!summary) return null;
  const l = summary.largest;
  return (
    <div style={styles.sigmaSummary}>
      <span>
        <strong>{summary.minutes}</strong> min at ≥{summary.threshold}σ
      </span>
      <span>
        <strong>{summary.breaches}</strong> {summary.breaches === 1 ? "breach" : "breaches"}
      </span>
      <span>
        Largest{" "}
        {l ? (
          <strong style={{ color: BANDS[unusualBandOf(Math.abs(l.sigma))]?.color ?? FLAT }}>
            {fmtSigma(l.sigma)} ({fmtPct(l.ret)}) at {fmtHourEt(l.t)} ET
          </strong>
        ) : (
          "—"
        )}
      </span>
    </div>
  );
}

function unusualBandOf(abs) {
  if (!Number.isFinite(abs)) return null;
  if (abs < 1.5) return "calm";
  if (abs <= 3) return "moving";
  return "something";
}

function SigmaCharts({ series, summary, x0, openMs }) {
  const [wrapRef, width] = useWidth();
  const [active, setActive] = useState(null);
  // The measured wrapper always renders, so the width observer attaches on
  // mount even while data is still loading.
  if (!series?.length) {
    return (
      <div ref={wrapRef} style={styles.sigmaWrap}>
        <div style={styles.sparkEmpty}>Waiting for 1m candles since 00:00 ET</div>
      </div>
    );
  }
  const pad = { l: 34, r: 8, t: 8, b: 4 };
  const h = 180;
  const markH = 72;
  const axisH = 18;
  const x1 = series[series.length - 1].t;
  const start = Math.min(x0 ?? series[0].t, series[0].t);
  const sx = (t) => pad.l + ((t - start) / Math.max(1, x1 - start)) * (width - pad.l - pad.r);
  const sy = (z) => {
    const c = Math.max(-SIGMA_Y_MAX, Math.min(SIGMA_Y_MAX, z));
    return pad.t + ((SIGMA_Y_MAX - c) / (2 * SIGMA_Y_MAX)) * (h - pad.t - pad.b);
  };
  const line = series.map((p, i) => `${i ? "L" : "M"}${sx(p.t).toFixed(1)},${sy(p.sigma).toFixed(1)}`).join("");
  const marks = series.map((p) => p.mark).filter(Number.isFinite);
  const m0 = Math.min(...marks);
  const m1 = Math.max(...marks);
  const my = (v) => 6 + ((m1 - v) / Math.max(1e-9, m1 - m0)) * (markH - 12);
  const markLine = series
    .filter((p) => Number.isFinite(p.mark))
    .map((p, i) => `${i ? "L" : "M"}${sx(p.t).toFixed(1)},${my(p.mark).toFixed(1)}`)
    .join("");
  const breaches = series.filter((p) => Math.abs(p.sigma) >= SIGMA_BREACH);
  const showOpen = openMs != null && openMs >= start && openMs <= x1;

  // x0 is 00:00 ET, so stepping whole hours from it lands on ET hours.
  const hour = 60 * 60 * 1000;
  const step = width < 420 ? 6 * hour : 3 * hour;
  const etTicks = [];
  for (let t = (x0 ?? start) + step; t <= x1; t += step) etTicks.push(t);

  const band = (lo, hi, fill) => (
    <rect x={pad.l} width={width - pad.l - pad.r} y={sy(hi)} height={Math.max(0, sy(lo) - sy(hi))} fill={fill} />
  );
  // Taps fire a synthetic mouseenter before click, so click must open (not
  // toggle); mouseleave / blur close it.
  const pick = (p) => setActive(p);

  return (
    <div ref={wrapRef} style={styles.sigmaWrap}>
      <SigmaSummaryLine summary={summary} />
      <div style={{ position: "relative" }}>
        <svg width={width} height={h} role="img" aria-label="io:ANTH rolling 15-minute move in sigma since midnight ET" style={styles.sigmaSvg}>
          {band(-SIGMA_Y_MAX, -SIGMA_BREACH, BANDS.something.bg)}
          {band(-SIGMA_BREACH, -1.5, BANDS.moving.bg)}
          {band(-1.5, 1.5, BANDS.calm.bg)}
          {band(1.5, SIGMA_BREACH, BANDS.moving.bg)}
          {band(SIGMA_BREACH, SIGMA_Y_MAX, BANDS.something.bg)}
          {[-5, -3, -1.5, 0, 1.5, 3, 5].map((z) => (
            <g key={z}>
              <line x1={pad.l} x2={width - pad.r} y1={sy(z)} y2={sy(z)} stroke={z === 0 ? "#a8a29e" : "#e7e5e4"} strokeWidth="1" />
              <text x={pad.l - 4} y={sy(z) + 3} textAnchor="end" style={styles.axisText}>
                {z > 0 ? `+${z}` : z}σ
              </text>
            </g>
          ))}
          {showOpen ? (
            <g>
              <line x1={sx(openMs)} x2={sx(openMs)} y1={pad.t} y2={h - pad.b} stroke={INK} strokeDasharray="3 3" strokeWidth="1" />
              {/* Flip the label left of the marker when it sits near the right edge. */}
              <text
                x={sx(openMs) + (sx(openMs) > width - 70 ? -4 : 4)}
                y={pad.t + 10}
                textAnchor={sx(openMs) > width - 70 ? "end" : "start"}
                style={styles.axisText}
              >
                9:30 open
              </text>
            </g>
          ) : null}
          <path d={line} fill="none" stroke={INK} strokeWidth="1.5" />
          {breaches.map((p) => (
            <g
              key={p.t}
              tabIndex={0}
              role="button"
              aria-label={`${fmtHourEt(p.t)} ET, ${fmtSigma(p.sigma)}, ${fmtPct(p.ret)}, close ${p.mark}`}
              onMouseEnter={() => setActive(p)}
              onMouseLeave={() => setActive(null)}
              onFocus={() => setActive(p)}
              onBlur={() => setActive(null)}
              onClick={() => pick(p)}
              style={{ cursor: "pointer", outline: "none" }}
            >
              <circle cx={sx(p.t)} cy={sy(p.sigma)} r="9" fill="transparent" />
              <circle cx={sx(p.t)} cy={sy(p.sigma)} r={active?.t === p.t ? 4.5 : 3} fill={BANDS.something.color} stroke="#fff" strokeWidth="1" />
            </g>
          ))}
        </svg>
        {active ? (
          <div
            style={{
              ...styles.sigmaTip,
              left: Math.min(Math.max(sx(active.t) - 80, 0), width - 160),
              top: active.sigma >= 0 ? sy(active.sigma) + 12 : Math.max(0, sy(active.sigma) - 74),
            }}
            role="status"
          >
            <div style={styles.sigmaTipTime}>{fmtEt(active.t)} ET</div>
            <div>
              <strong style={{ color: BANDS.something.color }}>{fmtSigma(active.sigma)}</strong> · {fmtPct(active.ret)} in 15m
            </div>
            <div>1m close {active.mark?.toFixed(1)} ($B)</div>
          </div>
        ) : null}
      </div>
      <div style={styles.markLabel}>
        io:ANTH 1m close ($B) · {m1.toFixed(0)} high · {m0.toFixed(0)} low
      </div>
      <svg width={width} height={markH + axisH} role="img" aria-label="io:ANTH 1-minute close since midnight ET" style={styles.sigmaSvg}>
        <rect x={pad.l} width={width - pad.l - pad.r} y={0} height={markH} fill="#fafaf9" />
        {showOpen ? (
          <line x1={sx(openMs)} x2={sx(openMs)} y1={0} y2={markH} stroke={INK} strokeDasharray="3 3" strokeWidth="1" />
        ) : null}
        <path d={markLine} fill="none" stroke="#2563eb" strokeWidth="1.5" />
        {etTicks
          .filter((t) => t >= start && t <= x1)
          .map((t) => (
            <text key={t} x={sx(t)} y={markH + 13} textAnchor="middle" style={styles.axisText}>
              {fmtHourEt(t)}
            </text>
          ))}
      </svg>
    </div>
  );
}

function ProxyTable({ rows, control, sessionOpen }) {
  const all = [...(rows || []), ...(control ? [{ ...control, isControl: true }] : [])];
  return (
    <div style={styles.table}>
      {sessionOpen === false ? (
        <div style={styles.preOpenBanner}>
          NYSE opens at 9:30 ET. Day, since-open and volume columns fill in at the open; last
          prices are the prior session&apos;s close.
        </div>
      ) : null}
      <div style={styles.tableHeader} className="vcx-table-header">
        <div style={styles.cTicker}>Ticker</div>
        <div style={styles.cNum}>Last</div>
        <div style={styles.cNum}>Day</div>
        <div style={styles.cNum}>Since 9:30</div>
        <div style={styles.cNum}>Day vs QQQ</div>
        <div style={styles.cNum}>9:30 vs QQQ</div>
        <div style={styles.cNum}>Vol / 20d avg day</div>
      </div>
      {all.map((row) => {
        const heldTicker = row.heldAs ?? row.ticker;
        const held = isHeldTicker(heldTicker, disclosure);
        return (
          <div key={row.ticker} style={styles.tableRow} className="vcx-row">
            <div style={styles.cTicker}>
              <Ext href={yahooQuoteUrl(row.ticker)} style={styles.ticker} label={`${row.ticker} on Yahoo Finance (opens in a new tab)`}>
                {row.ticker}
              </Ext>
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
              {row.role ? (
                <div style={styles.tickerRole}>
                  {row.onAi ? (
                    <a href="/ai" style={styles.extLink} title="Look-through exposure per $100 on /ai">
                      {row.role} →
                    </a>
                  ) : (
                    row.role
                  )}
                </div>
              ) : null}
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
            <div
              style={{ ...styles.cNum, color: VOLUME_STYLE[volumeBandOf(row.volumeOfAvgDay)]?.color ?? FLAT }}
              data-label="Vol / 20d avg day"
              title={Number.isFinite(row.volume) ? `${row.volume.toLocaleString()} shares vs ${Math.round(row.avgDailyVolume ?? 0).toLocaleString()} avg` : undefined}
            >
              {sessionOpen === false
                ? "pre-open"
                : Number.isFinite(row.volumeOfAvgDay)
                  ? `${Math.round(row.volumeOfAvgDay * 100)}%`
                  : "—"}
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
        <span
          style={{
            ...styles.statusChip,
            ...(data?.errors?.length || data?.source === "stale" ? styles.statusWarn : {}),
          }}
        >
          {data ? (data.source || "live").toUpperCase() : error ? "OFFLINE" : "LOADING"}
        </span>
        <span style={styles.statusText}>
          {data ? `as of ${fmtEt(Date.parse(data.asOf))} ET · refreshes every 15s` : "Fetching four venues…"}
          {error && lastFetch ? " · last refresh failed, showing previous data" : ""}
          {data?.source === "stale" ? " · Hyperliquid unavailable, showing last good data" : ""}
          {data?.source !== "stale" && data?.reused?.length
            ? ` · last good data for ${data.reused.join(", ")}`
            : ""}
        </span>
      </div>
      <SourceStrip />

      <section style={styles.hero}>
        <div style={styles.heroTop}>
          <div>
            <div style={styles.sectionEyebrow}>
              IMPLIED ANTHROPIC VALUATION ·{" "}
              <Ext href={HYPERLIQUID_URLS.anthropic} label="io:ANTH on Hyperliquid (opens in a new tab)">
                HYPERLIQUID io:ANTH ↗
              </Ext>
              {HOLDS_ANTHROPIC_SPV ? (
                <span style={styles.heldPill} title={disclosureSentence(disclosure)}>
                  HELD (SPV)
                </span>
              ) : null}
            </div>
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
        <a
          href={HYPERLIQUID_URLS.anthropic}
          target="_blank"
          rel="noopener noreferrer"
          style={styles.chartLink}
          className="investor-day-link-card"
          title="Open io:ANTH on Hyperliquid"
        >
          <Sparkline points={anth?.sparkline} baseline={anth?.midnightPx} />
        </a>
        <div style={styles.heroMeta}>
          Mark {anth?.markPx?.toFixed(1) ?? "—"} ($B) · 24h {fmtPct(anth?.change24h)} · OI{" "}
          {fmtUsdCompact(anth?.openInterestUsd)} · 24h volume {fmtUsdCompact(anth?.dayNtlVlm)} · funding{" "}
          {Number.isFinite(anth?.funding) ? `${(anth.funding * 100).toFixed(4)}%/h` : "—"}
          {oai ? ` · io:OAI ${fmtTFromB(oai.markPx)} (${fmtPct(oai.change24h)} 24h)` : ""}
        </div>
        <div style={styles.heroCaveat}>
          A perpetual-futures mark, not a priced round or a tender. With{" "}
          {fmtUsdCompact(anth?.openInterestUsd)} of open interest and{" "}
          {fmtUsdCompact(anth?.dayNtlVlm)} of daily volume, a few million dollars of flow can move this
          number and the meter below.
        </div>
      </section>

      <section style={styles.tiles}>
        <Tile
          eyebrow="POLYMARKET · EXPECTED FIRST-DAY CLOSE"
          value={fmtT(pm?.expectedClose?.valueT)}
          change={{ n: pm?.expectedClose?.changeT, text: fmtDeltaB(pm?.expectedClose?.changeT) }}
          changeLabel="since 00:00 ET"
          sub="Conditional on IPO by 2027 · normalized brackets, “No IPO” excluded"
          href={PM_URL.closingCap}
        />
        <Tile
          eyebrow="POLYMARKET · IPO BY NOV 30"
          value={fmtProb(nov30?.price)}
          change={{ n: nov30?.change, text: fmtPp(nov30?.change) }}
          changeLabel="since 00:00 ET"
          sub={[
            "Listed and open for trading by the date",
            ...(pm?.ipoBy || [])
              .filter((l) => l !== nov30)
              .map((l) => `${l.key.replace(", 2026", "")} ${fmtProb(l.price)}`),
          ].join(" · ")}
          href={PM_URL.ipoBy}
        />
        <Tile
          eyebrow="KALSHI · IPO CONFIRMED BEFORE 2027"
          value={fmtProb(kalshi2027?.mid)}
          change={{ n: kalshi2027?.change, text: fmtPp(kalshi2027?.change) }}
          changeLabel="since 00:00 ET"
          sub={`${KALSHI_CONFIRMED_RULE}, not first trade${kalshi2027 ? ` · bid ${fmtProb(kalshi2027.bid)} / ask ${fmtProb(kalshi2027.ask)}, mid shown` : ""}`}
          href={KALSHI_URL.ipoBefore2027}
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
          href={PM_URL.bestModel}
        />
      </section>

      <div style={styles.twoCol} className="investor-day-two-col">
        <section style={styles.panel}>
          <h2 style={styles.h2}>First-day closing market cap</h2>
          <div style={styles.panelSub}>
            <Ext href={PM_URL.closingCap} label="Closing-cap brackets on Polymarket (opens in a new tab)">
              Polymarket · 9 brackets ↗
            </Ext>
          </div>
          <a
            href={PM_URL.closingCap}
            target="_blank"
            rel="noopener noreferrer"
            style={styles.chartLink}
            className="investor-day-link-card"
            title="Open the closing-cap brackets on Polymarket"
          >
            <BracketChart brackets={pm?.brackets} noIpo={pm?.noIpo} />
          </a>
        </section>
        <section style={styles.panel}>
          <h2 style={styles.h2}>Unusual move meter</h2>
          <div style={styles.panelSub}>io:ANTH 15-minute move vs its own 30-day volatility</div>
          <UnusualMeter unusual={anth?.unusual} />
          <h3 style={styles.h3}>Sigma through the day</h3>
          <div style={styles.panelSub}>
            Rolling 15-minute io:ANTH move at every minute since 00:00 ET, in units of the 30-day
            15-minute σ. Dots mark ≥3σ; hover or tap for details.
          </div>
          <SigmaCharts
            series={data?.sigmaSeries}
            summary={data?.sigmaSummary}
            x0={data?.baselines?.midnightMs}
            openMs={data?.baselines?.sessionOpen ? data?.baselines?.openMs : null}
          />
          <div style={styles.extraLegs}>
            <div style={styles.extraRow}>
              <Ext href={PM_URL.vsOpenai} label="Anthropic vs OpenAI on Polymarket (opens in a new tab)">
                Polymarket: Anthropic &gt; OpenAI valuation on Dec 31 ↗
              </Ext>
              <strong style={styles.extraValue}>{fmtProb(pm?.vsOpenai?.price)}</strong>
            </div>
            {kalshi
              .filter((k) => k.key === "confirmedByDec1")
              .map((k) => (
                <div key={k.key} style={styles.extraRow}>
                  <Ext href={k.url} label={`${k.label} on Kalshi (opens in a new tab)`}>
                    Kalshi: {k.label} ↗
                  </Ext>
                  <strong style={styles.extraValue}>
                    {fmtProb(k.mid)} <span style={{ color: signColor(k.change), fontWeight: 500 }}>{fmtPp(k.change)}</span>
                  </strong>
                </div>
              ))}
          </div>
        </section>
      </div>

      <section style={styles.panel}>
        <h2 style={styles.h2}>Volume vs normal</h2>
        <div style={styles.panelSub}>Per venue, each against its own recent history</div>
        <VolumePanel rows={data?.volume?.rows} />
      </section>

      <section style={styles.panel}>
        <h2 style={styles.h2}>Public proxies</h2>
        <div style={styles.panelSub}>
          Yahoo Finance (tickers link to quotes) · “vs QQQ” is the simple difference from QQQ over the same window.
          HELD marks a position disclosed above. Volume is today&apos;s shares as a share of a
          20-day average full day, not projected, so it climbs through the session.
        </div>
        <a href="/ai" style={styles.aiCta}>
          Model Anthropic and OpenAI exposure per $100 at any IPO valuation on the AI Per $100 look-through →
        </a>
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
  extLink: { color: "inherit", textDecoration: "underline", textDecorationColor: "#d6d3d1", textUnderlineOffset: "3px" },
  tileLink: { display: "block", color: "inherit", textDecoration: "none" },
  chartLink: { display: "block", color: "inherit", textDecoration: "none", cursor: "pointer" },
  sourceStrip: { display: "flex", flexWrap: "wrap", gap: "6px 18px", fontFamily: MONO, fontSize: "11px", color: MUTED, marginBottom: "20px" },
  sourceGroup: { display: "inline-flex", flexWrap: "wrap", gap: "4px 10px", alignItems: "baseline" },
  sourceVenue: { fontSize: "10px", letterSpacing: "0.1em", textTransform: "uppercase", color: "#44403c", fontWeight: 600 },
  sourceLink: { color: "#1d4ed8" },
  heroCaveat: { fontSize: "12.5px", lineHeight: 1.5, color: "#44403c", marginTop: "8px", maxWidth: "760px" },
  h3: { fontSize: "16px", fontWeight: 500, margin: "20px 0 2px", borderTop: `1px solid ${RULE}`, paddingTop: "16px" },
  sigmaWrap: { width: "100%", minWidth: 0 },
  sigmaSvg: { display: "block", overflow: "visible" },
  sigmaSummary: { display: "flex", flexWrap: "wrap", gap: "4px 16px", fontFamily: MONO, fontSize: "12px", marginBottom: "8px" },
  axisText: { fontFamily: MONO, fontSize: "9.5px", fill: MUTED },
  sigmaTip: { position: "absolute", width: "160px", background: INK, color: "#fafaf9", fontFamily: MONO, fontSize: "11px", lineHeight: 1.5, padding: "6px 8px", pointerEvents: "none", zIndex: 5 },
  sigmaTipTime: { color: "#d6d3d1" },
  markLabel: { fontFamily: MONO, fontSize: "10.5px", color: MUTED, margin: "10px 0 4px" },
  peakLine: { fontFamily: MONO, fontSize: "12px", marginTop: "12px" },
  preOpenBanner: { fontFamily: MONO, fontSize: "11.5px", background: "#fef3c7", color: "#78350f", padding: "8px 10px", margin: "10px 0" },
  tickerRole: { fontSize: "11.5px", color: "#44403c", marginTop: "2px" },
  aiCta: { display: "inline-block", fontFamily: MONO, fontSize: "12px", color: "#1d4ed8", margin: "0 0 12px", textDecoration: "underline", textUnderlineOffset: "3px" },
  volRow: { padding: "10px 0", borderBottom: `1px solid ${RULE}` },
  volHead: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px", fontSize: "14px" },
  volVenue: { fontFamily: MONO, fontSize: "10px", letterSpacing: "0.08em", color: MUTED, textTransform: "uppercase", marginRight: "6px" },
  volRatioWrap: { display: "flex", alignItems: "center", gap: "8px", flexShrink: 0 },
  volRatio: { fontFamily: MONO, fontSize: "15px", fontVariantNumeric: "tabular-nums" },
  volTrack: { position: "relative", height: "8px", background: "#f5f5f4", marginTop: "8px" },
  volFill: { position: "absolute", top: 0, bottom: 0, left: 0 },
  volNormalMark: { position: "absolute", top: "-3px", bottom: "-3px", width: "2px", marginLeft: "-1px", background: INK, zIndex: 1 },
  volMeta: { fontFamily: MONO, fontSize: "10.5px", color: MUTED, marginTop: "6px" },
  table: { borderTop: `1px solid ${RULE}`, overflowX: "auto" },
  tableHeader: { display: "flex", fontFamily: MONO, fontSize: "10px", letterSpacing: "0.08em", textTransform: "uppercase", color: MUTED, padding: "8px 0", borderBottom: `1px solid ${RULE}`, minWidth: "720px" },
  tableRow: { display: "flex", alignItems: "center", padding: "8px 0", borderBottom: `1px solid ${RULE}`, minWidth: "720px" },
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
