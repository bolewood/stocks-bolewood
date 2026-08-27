"use client";

import React, { useEffect, useMemo, useState } from "react";
import { startJsonPoll } from "../lib/pollLivePrices.mjs";

const CHART = {
  private: "#0f766e",
  dxyz: "#d97706",
  anthropic: "#2563eb",
  spacex: "#be123c",
  qqq: "#57534e",
  faint: "#d6d3d1",
};

function fmtMoney(n) {
  if (!Number.isFinite(n)) return "n/a";
  if (Math.abs(n) >= 1e12) return `$${(n / 1e12).toFixed(2)}T`;
  if (Math.abs(n) >= 1e9) return `$${(n / 1e9).toFixed(1)}B`;
  if (Math.abs(n) >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  return `$${n.toFixed(2)}`;
}

function fmtPrice(n) {
  if (!Number.isFinite(n)) return "n/a";
  return `$${n.toFixed(2)}`;
}

function fmtPct(n, digits = 2) {
  if (!Number.isFinite(n)) return "n/a";
  const sign = n > 0 ? "+" : "";
  return `${sign}${(n * 100).toFixed(digits)}%`;
}

function fmtNumber(n, digits = 2) {
  if (!Number.isFinite(n)) return "n/a";
  return n.toFixed(digits);
}

function fmtEt(ms) {
  if (!(ms > 0)) return "n/a";
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(new Date(ms));
}

function pctColor(n) {
  if (!Number.isFinite(n) || Math.abs(n) < 0.00001) return "#57534e";
  return n > 0 ? "#15803d" : "#be123c";
}

function StatusChip({ source, asOf, marketStatus }) {
  const sourceLabel =
    source === "live" ? "LIVE DATA" : source === "cache" ? "CACHED DATA" : "PARTIAL DATA";
  return (
    <div style={styles.statusRow}>
      <span
        style={{
          ...styles.statusChip,
          borderColor: source === "partial" ? "#f59e0b" : "#bbf7d0",
          color: source === "partial" ? "#b45309" : "#15803d",
          background: source === "partial" ? "#fffbeb" : "#f0fdf4",
        }}
      >
        {sourceLabel}
      </span>
      <span style={styles.statusText}>
        NYSE {marketStatus?.nyseOpen ? "open" : "closed"} / refreshed {asOf ? fmtEt(Date.parse(asOf)) : "n/a"} ET
      </span>
    </div>
  );
}

function MetricCard({ eyebrow, value, sub, foot, tone }) {
  return (
    <div style={styles.metricCard}>
      <div style={styles.metricEyebrow}>{eyebrow}</div>
      <div style={{ ...styles.metricValue, color: tone || "#1c1917" }}>{value}</div>
      {sub ? <div style={styles.metricSub}>{sub}</div> : null}
      {foot ? <div style={styles.metricFoot}>{foot}</div> : null}
    </div>
  );
}

function EmptyState({ children }) {
  return <div style={styles.emptyState}>{children}</div>;
}

function linePath(points) {
  return points.map((p) => `${p.x},${p.y}`).join(" ");
}

function LineChart({ series, lines, domain, valueFormatter = fmtNumber }) {
  const width = 720;
  const height = 260;
  const pad = 28;
  const valid = (series || []).filter((row) =>
    lines.some((line) => Number.isFinite(row[line.key]))
  );
  if (valid.length < 2) return <EmptyState>Not enough aligned observations yet.</EmptyState>;

  const values = valid.flatMap((row) =>
    lines.map((line) => row[line.key]).filter(Number.isFinite)
  );
  let minY = domain?.[0] ?? Math.min(...values);
  let maxY = domain?.[1] ?? Math.max(...values);
  if (minY === maxY) {
    minY -= 1;
    maxY += 1;
  }
  const xFor = (idx) => pad + (idx / Math.max(1, valid.length - 1)) * (width - pad * 2);
  const yFor = (value) =>
    height - pad - ((value - minY) / (maxY - minY)) * (height - pad * 2);

  return (
    <div style={styles.chartWrap}>
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Line chart" style={styles.svg}>
        <line x1={pad} x2={width - pad} y1={yFor(0)} y2={yFor(0)} stroke={CHART.faint} strokeDasharray="4 5" />
        <line x1={pad} x2={pad} y1={pad} y2={height - pad} stroke="#e7e5e4" />
        <line x1={pad} x2={width - pad} y1={height - pad} y2={height - pad} stroke="#e7e5e4" />
        {lines.map((line) => {
          const pts = valid
            .map((row, idx) =>
              Number.isFinite(row[line.key])
                ? { x: xFor(idx), y: yFor(row[line.key]) }
                : null
            )
            .filter(Boolean);
          return (
            <polyline
              key={line.key}
              fill="none"
              stroke={line.color}
              strokeWidth="2.5"
              points={linePath(pts)}
            />
          );
        })}
        <text x={pad} y={18} style={styles.axisText}>{valueFormatter(maxY)}</text>
        <text x={pad} y={height - 7} style={styles.axisText}>{valueFormatter(minY)}</text>
      </svg>
      <div style={styles.legend}>
        {lines.map((line) => (
          <span key={line.key} style={styles.legendItem}>
            <span style={{ ...styles.legendSwatch, background: line.color }} />
            {line.label}
          </span>
        ))}
      </div>
    </div>
  );
}

function ScatterPlot({ samples, regression }) {
  const rows = (samples || []).filter(
    (row) => Number.isFinite(row.weightedReturn) && Number.isFinite(row.dxyzGap)
  );
  const width = 720;
  const height = 300;
  const pad = 34;
  if (!rows.length) return <EmptyState>No overnight windows yet.</EmptyState>;

  const xs = rows.map((r) => r.weightedReturn);
  const ys = rows.map((r) => r.dxyzGap);
  const xMax = Math.max(0.01, Math.max(...xs.map(Math.abs)) * 1.15);
  const yMax = Math.max(0.01, Math.max(...ys.map(Math.abs)) * 1.15);
  const xFor = (x) => pad + ((x + xMax) / (2 * xMax)) * (width - pad * 2);
  const yFor = (y) => height - pad - ((y + yMax) / (2 * yMax)) * (height - pad * 2);
  const hasRegression = regression?.n > 1 && Number.isFinite(regression.slope);
  const x1 = -xMax;
  const x2 = xMax;
  const y1 = hasRegression ? regression.intercept + regression.slope * x1 : 0;
  const y2 = hasRegression ? regression.intercept + regression.slope * x2 : 0;

  return (
    <div style={styles.chartWrap}>
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Overnight scatter plot" style={styles.svg}>
        <line x1={xFor(0)} x2={xFor(0)} y1={pad} y2={height - pad} stroke="#d6d3d1" />
        <line x1={pad} x2={width - pad} y1={yFor(0)} y2={yFor(0)} stroke="#d6d3d1" />
        {hasRegression ? (
          <line
            x1={xFor(x1)}
            y1={yFor(y1)}
            x2={xFor(x2)}
            y2={yFor(y2)}
            stroke={CHART.private}
            strokeWidth="2.5"
          />
        ) : null}
        {rows.map((row) => (
          <circle
            key={`${row.date}-${row.priorDate}`}
            cx={xFor(row.weightedReturn)}
            cy={yFor(row.dxyzGap)}
            r="4.5"
            fill={row.weightedReturn >= 0 ? "#0f766e" : "#be123c"}
            opacity="0.72"
          >
            <title>
              {row.date}: private {fmtPct(row.weightedReturn)} / DXYZ gap {fmtPct(row.dxyzGap)}
            </title>
          </circle>
        ))}
        <text x={width - pad - 102} y={height - 8} style={styles.axisText}>Private overnight</text>
        <text x={8} y={pad - 10} style={styles.axisText}>DXYZ gap</text>
      </svg>
    </div>
  );
}

function Section({ kicker, title, meta, children }) {
  return (
    <section style={styles.section}>
      <div style={styles.sectionHeader}>
        <div>
          {kicker ? <div style={styles.kicker}>{kicker}</div> : null}
          <h2 style={styles.sectionTitle}>{title}</h2>
        </div>
        {meta ? <div style={styles.sectionMeta}>{meta}</div> : null}
      </div>
      {children}
    </section>
  );
}

function CorrelationTable({ rows }) {
  return (
    <div style={styles.corrGrid}>
      {(rows || []).map((row) => (
        <div key={row.key} style={styles.corrCard}>
          <div style={styles.corrTop}>
            <span style={styles.corrLabel}>{row.label}</span>
            <span style={styles.corrN}>N={row.n}</span>
          </div>
          <div style={styles.corrValue}>
            {row.enough ? fmtNumber(row.pearson, 2) : `Need ${row.minN}`}
          </div>
          <div style={styles.corrSub}>
            Pearson r / Spearman {row.enough ? fmtNumber(row.spearman, 2) : "n/a"} / {row.scope}
          </div>
        </div>
      ))}
    </div>
  );
}

function BucketTable({ buckets }) {
  const maxAbs = Math.max(
    0.005,
    ...((buckets || []).map((b) => Math.abs(b.avgDxyzGap || 0)))
  );
  return (
    <div style={styles.bucketTable}>
      {(buckets || []).map((bucket) => {
        const value = bucket.avgDxyzGap || 0;
        const width = `${Math.min(100, (Math.abs(value) / maxAbs) * 100)}%`;
        return (
          <div key={bucket.key} style={styles.bucketRow}>
            <div style={styles.bucketLabel}>{bucket.label}</div>
            <div style={styles.bucketBarTrack}>
              <div
                style={{
                  ...styles.bucketBar,
                  width,
                  marginLeft: value >= 0 ? "50%" : `calc(50% - ${width})`,
                  background: value >= 0 ? "#0f766e" : "#be123c",
                }}
              />
              <div style={styles.bucketZero} />
            </div>
            <div style={styles.bucketValue}>
              {bucket.n ? fmtPct(bucket.avgDxyzGap) : "n/a"} <span style={styles.bucketN}>N={bucket.n}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function Sources({ sources }) {
  const items = [
    ["Hyperliquid candles", sources?.hyperliquidInfoApi],
    ["HIP-3", sources?.hyperliquidHip3],
    ["Robust price indices", sources?.hyperliquidRobustPrices],
    ["Entropy ANTH oracle note", sources?.entropyAnthropicOracleNote],
    ["Entropy context", sources?.kucoinEntropyContext],
    ["DXYZ NPORT-P", sources?.dxyzNport],
    ["DXYZ 424B3", sources?.dxyz424b3],
  ].filter(([, href]) => href);
  return (
    <div style={styles.sourceLinks}>
      {items.map(([label, href]) => (
        <a key={label} href={href} target="_blank" rel="noopener noreferrer" style={styles.sourceLink}>
          {label}
        </a>
      ))}
    </div>
  );
}

export default function PrivateTapeDashboard() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    return startJsonPoll("/api/private-tape", {
      onData: (payload) => {
        setData(payload);
        setError(null);
      },
      onError: (err) => setError(err),
      intervalMs: 60_000,
    });
  }, []);

  const cardModel = useMemo(() => {
    const cards = data?.cards || {};
    return [
      {
        eyebrow: "ANTHROPIC",
        value: fmtMoney(cards.anthropic?.valueUsd),
        sub: cards.anthropic
          ? `${fmtNumber(cards.anthropic.price, 1)} USD billions on io:ANTH`
          : "Awaiting Hyperliquid",
        foot: cards.anthropic ? `as of ${fmtEt(cards.anthropic.asOfMs)} ET` : null,
      },
      {
        eyebrow: "SPACEX",
        value: fmtMoney(cards.spacex?.valueUsd),
        sub: cards.spacex
          ? `${fmtPrice(cards.spacex.price)} on xyz:SPCX / approx FD cap`
          : "Awaiting Hyperliquid",
        foot: cards.spacex ? `as of ${fmtEt(cards.spacex.asOfMs)} ET` : null,
      },
      {
        eyebrow: "24H PRIVATE MOVE",
        value: fmtPct(cards.move24h?.weighted),
        sub: `ANTH ${fmtPct(cards.move24h?.anthropic)} / SPCX ${fmtPct(cards.move24h?.spacex)}`,
        foot: "56/44 modeled sleeve",
        tone: pctColor(cards.move24h?.weighted),
      },
      {
        eyebrow: data?.marketStatus?.nyseOpen ? "SINCE PRIOR CLOSE" : "OVERNIGHT PRIVATE MOVE",
        value: fmtPct(cards.overnight?.weighted),
        sub: `ANTH ${fmtPct(cards.overnight?.anthropic)} / SPCX ${fmtPct(cards.overnight?.spacex)}`,
        foot: cards.overnight?.nyseOpen ? "NYSE is open" : `next open ${fmtEt(cards.overnight?.nextOpenMs)} ET`,
        tone: pctColor(cards.overnight?.weighted),
      },
      {
        eyebrow: "PRIVATE INDEX",
        value: fmtNumber(cards.privateIndex?.value, 1),
        sub: cards.privateIndex ? `normalized to 100 on ${cards.privateIndex.baseDate}` : "Awaiting common base",
        foot: "two modeled assets only",
      },
      {
        eyebrow: "DXYZ",
        value: fmtPrice(cards.dxyz?.price),
        sub: `prev close ${fmtPrice(cards.dxyz?.previousClose)} (${cards.dxyz?.previousCloseDate || "n/a"})`,
        foot: cards.dxyz?.quoteAsOfMs ? `quote ${fmtEt(cards.dxyz.quoteAsOfMs)} ET` : "Yahoo daily fallback if quote unavailable",
      },
      {
        eyebrow: "OPEN GAP SIGNAL",
        value: Number.isFinite(cards.overnightGapSignal?.predictedGap)
          ? fmtPct(cards.overnightGapSignal.predictedGap)
          : "N too small",
        sub: `private move ${fmtPct(cards.overnightGapSignal?.weightedPrivateMove)}`,
        foot: cards.overnightGapSignal?.nyseOpen
          ? "NYSE open: pre-open signal already passed"
          : "historical regression fit, not a forecast",
        tone: pctColor(cards.overnightGapSignal?.predictedGap),
      },
    ];
  }, [data]);

  const copyJson = async () => {
    if (!data) return;
    await navigator.clipboard?.writeText(
      JSON.stringify(
        {
          asOf: data.asOf,
          config: data.config,
          analyses: data.analyses,
          datasets: data.datasets,
        },
        null,
        2
      )
    );
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };

  return (
    <main style={styles.container} className="private-tape-container">
      <section style={styles.hero}>
        <div style={styles.eyebrow}>DXYZ SHADOW NAV LAB / 24-7 PRIVATE COMPANY MARKETS</div>
        <h1 style={styles.title}>
          Private <span style={styles.titleAccent}>Tape</span>
        </h1>
        <p style={styles.subtitle}>
          Private Tape: what the 24/7 markets for Anthropic and SpaceX imply for DXYZ before the NYSE opens.
        </p>
        {data ? (
          <StatusChip source={data.source} asOf={data.asOf} marketStatus={data.marketStatus} />
        ) : (
          <div style={styles.statusText}>Loading Hyperliquid and DXYZ market data...</div>
        )}
        {error ? <div style={styles.warning}>Live refresh failed. Showing the last loaded view if available.</div> : null}
      </section>

      <section style={styles.metricGrid} className="private-tape-metric-grid">
        {cardModel.map((card) => (
          <MetricCard key={card.eyebrow} {...card} />
        ))}
      </section>

      <Section kicker="00" title="What This Tests">
        <div style={styles.explainGrid} className="private-tape-two-col">
          <p style={styles.bodyCopy}>
            The hypothesis is simple: if private-company perps trade all night while DXYZ sleeps, their returns may contain information that shows up in DXYZ&apos;s next opening gap.
          </p>
          <p style={styles.bodyCopy}>
            The page uses simple returns throughout. It compares only overlapping NYSE-hours returns for DXYZ tests, and the overnight test uses private-market prices available no later than the DXYZ open.
          </p>
        </div>
        <div style={styles.contextPanel}>
          <div style={styles.contextEyebrow}>Market Structure Context</div>
          <div style={styles.contextGrid} className="private-tape-two-col">
            <p style={styles.bodyCopy}>
              Entropy is a third-party builder using Hyperliquid&apos;s HIP-3 infrastructure to list pre-IPO and real-world-asset perpetual markets. The KuCoin/TechFlow piece frames it as competing for private-market price discovery after Ventuals shut down, with the debate centered on liquidity, funding rates, and whether the market can avoid predecessor design problems.
            </p>
            <p style={styles.bodyCopy}>
              We use these markets only as an observable tape: what traders are willing to mark Anthropic and SpaceX at while DXYZ is closed. This is not a recommendation to trade on Entropy, use Hyperliquid, hold perps, or treat the marks as DXYZ&apos;s fair value.
            </p>
          </div>
        </div>
      </Section>

      <Section
        kicker="01"
        title="Plain Return Correlation"
        meta={data ? `minimum N=${data.config.minimums.correlationN}` : null}
      >
        {data ? <CorrelationTable rows={data.analyses.plainCorrelation} /> : <EmptyState>Loading correlations...</EmptyState>}
      </Section>

      <div style={styles.twoCol} className="private-tape-two-col">
        <Section kicker="02" title="DXYZ Private Index" meta="normalized to 100">
          <LineChart
            series={data?.analyses.privateIndex || []}
            lines={[
              { key: "privateIndex", label: "56/44 Private Index", color: CHART.private },
              { key: "dxyzIndex", label: "DXYZ", color: CHART.dxyz },
            ]}
            valueFormatter={(n) => fmtNumber(n, 0)}
          />
          <p style={styles.note}>
            The weight file currently normalizes DXYZ&apos;s March 31, 2026 Anthropic exposure (18.1%) and SpaceX exposure (12.4% known SpaceX SPVs plus 2.0% Snowpoint SpaceX SPV) to a two-asset sleeve: about 56% Anthropic and 44% SpaceX.
          </p>
        </Section>

        <Section kicker="03" title="Rolling 30-Day Correlations" meta="shows N in the API">
          <LineChart
            series={data?.analyses.rollingCorrelations?.dxyzAnthropic || []}
            lines={[
              { key: "r", label: "DXYZ vs ANTH", color: CHART.anthropic },
            ]}
            domain={[-1, 1]}
            valueFormatter={(n) => fmtNumber(n, 1)}
          />
          <LineChart
            series={data?.analyses.rollingCorrelations?.dxyzSpacex || []}
            lines={[
              { key: "r", label: "DXYZ vs SPCX", color: CHART.spacex },
            ]}
            domain={[-1, 1]}
            valueFormatter={(n) => fmtNumber(n, 1)}
          />
        </Section>
      </div>

      <div style={styles.twoCol} className="private-tape-two-col">
        <Section
          kicker="04"
          title="Overnight Lead/Lag"
          meta={data ? `N=${data.analyses.overnight.samples.length}` : null}
        >
          <ScatterPlot
            samples={data?.analyses.overnight.samples || []}
            regression={data?.analyses.overnight.regression}
          />
          <div style={styles.statsStrip}>
            <span>r {fmtNumber(data?.analyses.overnight.correlation.pearson, 2)}</span>
            <span>R2 {fmtNumber(data?.analyses.overnight.regression?.r2, 2)}</span>
            <span>slope {fmtNumber(data?.analyses.overnight.regression?.slope, 2)}</span>
          </div>
        </Section>

        <Section kicker="05" title="Opening Gap Buckets" meta="weighted private move">
          {data ? <BucketTable buckets={data.analyses.overnight.buckets} /> : <EmptyState>Loading buckets...</EmptyState>}
        </Section>
      </div>

      <Section
        kicker="06"
        title="DXYZ Residual"
        meta={
          <span title="Playful label only: this is a regression residual, not a NAV premium.">
            Hype Premium label is optional
          </span>
        }
      >
        {data?.analyses.residual.regression ? (
          <>
            <div style={styles.statsStrip}>
              <span>N={data.analyses.residual.regression.n}</span>
              <span>R2 {fmtNumber(data.analyses.residual.regression.r2, 2)}</span>
              <span>ANTH beta {fmtNumber(data.analyses.residual.regression.slopes.anthropic, 2)}</span>
              <span>SPCX beta {fmtNumber(data.analyses.residual.regression.slopes.spacex, 2)}</span>
              <span>QQQ beta {fmtNumber(data.analyses.residual.regression.slopes.qqq, 2)}</span>
            </div>
            <LineChart
              series={data.analyses.residual.series}
              lines={[
                { key: "cumulativeResidual", label: "Cumulative residual", color: CHART.dxyz },
              ]}
              valueFormatter={(n) => fmtPct(n, 1)}
            />
          </>
        ) : (
          <EmptyState>
            Need {data?.analyses.residual.minN || 20} complete NYSE-hours samples with DXYZ, ANTH, SPCX, and QQQ before showing a residual.
          </EmptyState>
        )}
        <p style={styles.note}>
          Residual means the part of DXYZ&apos;s short-window return not explained by ANTH, SPCX, and QQQ in this regression. It is a sentiment or factor residual, not a NAV premium.
        </p>
      </Section>

      <Section kicker="07" title="Open Data And Methodology">
        <div style={styles.methodGrid} className="private-tape-two-col">
          <div style={styles.methodCard}>
            <h3 style={styles.methodTitle}>Open Data</h3>
            <p style={styles.bodyCopy}>
              The reusable assumptions live in data/private-tape.json under the repo&apos;s data license. Live aligned observations are published by the API as JSON and CSV, while raw Hyperliquid and Yahoo market prints stay as runtime inputs.
            </p>
            <p style={styles.bodyCopy}>
              The manifest endpoint lists the current datasets, columns, source links, license notes, and minimum sample thresholds.
            </p>
          </div>
          <div style={styles.methodCard}>
            <h3 style={styles.methodTitle}>Method</h3>
            <p style={styles.bodyCopy}>
              Hyperliquid candles use the public info API&apos;s candleSnapshot endpoint for io:ANTH and xyz:SPCX. DXYZ and QQQ use the same Yahoo chart pattern as the existing Bolewood quote layer. All timestamps are normalized to America/New_York.
            </p>
            <p style={styles.bodyCopy}>
              Overnight samples run from the prior DXYZ 4:00pm ET close to the next DXYZ 9:30am ET open. The construction uses the latest private candle closed at or before each boundary, so the test does not look past the open.
            </p>
          </div>
          <div style={styles.methodCard}>
            <h3 style={styles.methodTitle}>Caveats</h3>
            <p style={styles.bodyCopy}>
              ANTH is very new, so sample sizes can be tiny. HIP-3 oracle design can incorporate external references and local market-price smoothing, so this is not fully independent price discovery. Perpetual volume is not cash equity turnover. Correlation is not causation.
            </p>
            <p style={styles.bodyCopy}>
              Entropy and Hyperliquid are market-data venues for this page, not recommendations. The Private Index covers only the two modeled assets, not all of DXYZ NAV, and should not be read as fair value or true NAV.
            </p>
          </div>
        </div>

        {data?.errors?.length ? (
          <div style={styles.warning}>
            Partial data: {data.errors.join(" / ")}
          </div>
        ) : null}

        <div style={styles.downloadRow}>
          <a href={data?.downloads?.overnightCsv || "/api/private-tape?format=csv&dataset=overnight"} style={styles.button}>
            Overnight CSV
          </a>
          <a href={data?.downloads?.rthCsv || "/api/private-tape?format=csv&dataset=rth"} style={styles.button}>
            NYSE-Hours CSV
          </a>
          <a href={data?.downloads?.json || "/api/private-tape"} style={styles.button}>
            JSON API
          </a>
          <a href={data?.downloads?.manifest || "/api/private-tape/manifest"} style={styles.button}>
            Data Manifest
          </a>
          <button type="button" onClick={copyJson} style={styles.button}>
            {copied ? "Copied" : "Copy JSON"}
          </button>
        </div>

        <Sources sources={data?.config?.sources} />
      </Section>
    </main>
  );
}

const styles = {
  container: {
    maxWidth: "1180px",
    margin: "0 auto",
    padding: "0 56px",
  },
  hero: {
    paddingTop: "72px",
    paddingBottom: "34px",
    borderBottom: "1px solid #e7e5e4",
  },
  eyebrow: {
    fontFamily: "var(--font-mono), 'JetBrains Mono', monospace",
    fontSize: "11px",
    letterSpacing: "0.16em",
    color: "#78716c",
    marginBottom: "18px",
    fontWeight: 600,
  },
  title: {
    fontSize: "56px",
    lineHeight: 1,
    fontWeight: 800,
    letterSpacing: "-0.03em",
    color: "#1c1917",
    margin: "0 0 18px 0",
  },
  titleAccent: {
    color: "#d97706",
    fontStyle: "italic",
    fontWeight: 600,
  },
  subtitle: {
    maxWidth: "740px",
    color: "#44403c",
    fontSize: "18px",
    lineHeight: 1.58,
    margin: "0 0 20px 0",
  },
  statusRow: {
    display: "flex",
    flexWrap: "wrap",
    alignItems: "center",
    gap: "10px",
  },
  statusChip: {
    fontFamily: "var(--font-mono), 'JetBrains Mono', monospace",
    fontSize: "10px",
    letterSpacing: "0.1em",
    border: "1px solid",
    padding: "4px 8px",
    fontWeight: 700,
  },
  statusText: {
    fontFamily: "var(--font-mono), 'JetBrains Mono', monospace",
    fontSize: "11px",
    color: "#78716c",
    letterSpacing: "0.04em",
  },
  metricGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",
    gap: "14px",
    paddingTop: "24px",
  },
  metricCard: {
    border: "1px solid #e7e5e4",
    background: "#fffaf0",
    padding: "18px 18px 16px",
    minHeight: "150px",
  },
  metricEyebrow: {
    fontFamily: "var(--font-mono), 'JetBrains Mono', monospace",
    fontSize: "10px",
    letterSpacing: "0.12em",
    color: "#78716c",
    fontWeight: 700,
    marginBottom: "12px",
  },
  metricValue: {
    fontSize: "31px",
    lineHeight: 1,
    fontWeight: 800,
    letterSpacing: "-0.02em",
    color: "#1c1917",
    marginBottom: "10px",
    fontVariantNumeric: "tabular-nums",
  },
  metricSub: {
    fontFamily: "var(--font-mono), 'JetBrains Mono', monospace",
    fontSize: "11px",
    lineHeight: 1.5,
    color: "#44403c",
  },
  metricFoot: {
    fontFamily: "var(--font-mono), 'JetBrains Mono', monospace",
    fontSize: "10px",
    lineHeight: 1.5,
    color: "#a8a29e",
    marginTop: "8px",
  },
  section: {
    paddingTop: "38px",
  },
  sectionHeader: {
    display: "flex",
    justifyContent: "space-between",
    gap: "18px",
    alignItems: "flex-end",
    paddingBottom: "10px",
    borderBottom: "1px solid #d6d3d1",
    marginBottom: "18px",
  },
  kicker: {
    fontFamily: "var(--font-mono), 'JetBrains Mono', monospace",
    fontSize: "11px",
    color: "#d97706",
    fontWeight: 800,
    letterSpacing: "0.08em",
    marginBottom: "4px",
  },
  sectionTitle: {
    fontSize: "24px",
    lineHeight: 1.15,
    letterSpacing: "-0.01em",
    margin: 0,
  },
  sectionMeta: {
    fontFamily: "var(--font-mono), 'JetBrains Mono', monospace",
    fontSize: "11px",
    color: "#78716c",
    textAlign: "right",
  },
  explainGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "22px",
  },
  bodyCopy: {
    fontSize: "14px",
    lineHeight: 1.65,
    color: "#57534e",
    margin: 0,
  },
  corrGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
    gap: "14px",
  },
  contextPanel: {
    marginTop: "18px",
    border: "1px solid #d6d3d1",
    background: "#fefdf8",
    padding: "18px",
  },
  contextEyebrow: {
    fontFamily: "var(--font-mono), 'JetBrains Mono', monospace",
    fontSize: "10px",
    letterSpacing: "0.12em",
    color: "#92400e",
    fontWeight: 800,
    marginBottom: "10px",
  },
  contextGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "22px",
  },
  corrCard: {
    border: "1px solid #e7e5e4",
    background: "#fefdf8",
    padding: "18px",
  },
  corrTop: {
    display: "flex",
    justifyContent: "space-between",
    gap: "12px",
    marginBottom: "14px",
  },
  corrLabel: {
    fontWeight: 800,
    color: "#1c1917",
  },
  corrN: {
    fontFamily: "var(--font-mono), 'JetBrains Mono', monospace",
    fontSize: "11px",
    color: "#78716c",
  },
  corrValue: {
    fontFamily: "var(--font-mono), 'JetBrains Mono', monospace",
    fontSize: "34px",
    lineHeight: 1,
    color: "#d97706",
    fontWeight: 800,
    marginBottom: "10px",
  },
  corrSub: {
    fontFamily: "var(--font-mono), 'JetBrains Mono', monospace",
    fontSize: "10px",
    color: "#78716c",
    lineHeight: 1.6,
  },
  twoCol: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "28px",
  },
  chartWrap: {
    width: "100%",
    overflow: "hidden",
  },
  svg: {
    width: "100%",
    height: "auto",
    display: "block",
    background: "#fefdf8",
    border: "1px solid #e7e5e4",
  },
  axisText: {
    fontFamily: "var(--font-mono), 'JetBrains Mono', monospace",
    fontSize: "11px",
    fill: "#78716c",
  },
  legend: {
    display: "flex",
    flexWrap: "wrap",
    gap: "12px",
    marginTop: "10px",
  },
  legendItem: {
    display: "inline-flex",
    alignItems: "center",
    gap: "6px",
    fontFamily: "var(--font-mono), 'JetBrains Mono', monospace",
    fontSize: "11px",
    color: "#57534e",
  },
  legendSwatch: {
    width: "11px",
    height: "11px",
  },
  note: {
    fontFamily: "var(--font-mono), 'JetBrains Mono', monospace",
    fontSize: "11px",
    color: "#78716c",
    lineHeight: 1.65,
    marginTop: "12px",
  },
  statsStrip: {
    display: "flex",
    flexWrap: "wrap",
    gap: "10px",
    marginTop: "12px",
  },
  bucketTable: {
    display: "grid",
    gap: "14px",
  },
  bucketRow: {
    display: "grid",
    gridTemplateColumns: "110px 1fr 116px",
    gap: "12px",
    alignItems: "center",
  },
  bucketLabel: {
    fontFamily: "var(--font-mono), 'JetBrains Mono', monospace",
    fontSize: "11px",
    color: "#44403c",
  },
  bucketBarTrack: {
    position: "relative",
    height: "14px",
    background: "#f5f5f4",
    border: "1px solid #e7e5e4",
  },
  bucketBar: {
    height: "100%",
  },
  bucketZero: {
    position: "absolute",
    left: "50%",
    top: "-3px",
    width: "1px",
    height: "20px",
    background: "#a8a29e",
  },
  bucketValue: {
    fontFamily: "var(--font-mono), 'JetBrains Mono', monospace",
    fontSize: "11px",
    color: "#1c1917",
    textAlign: "right",
    fontVariantNumeric: "tabular-nums",
  },
  bucketN: {
    color: "#a8a29e",
  },
  methodGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
    gap: "18px",
  },
  methodCard: {
    border: "1px solid #e7e5e4",
    background: "#fafaf9",
    padding: "18px",
  },
  methodTitle: {
    fontSize: "18px",
    margin: "0 0 10px 0",
  },
  warning: {
    marginTop: "14px",
    border: "1px solid #f59e0b",
    background: "#fffbeb",
    color: "#92400e",
    padding: "10px 12px",
    fontFamily: "var(--font-mono), 'JetBrains Mono', monospace",
    fontSize: "11px",
    lineHeight: 1.5,
  },
  emptyState: {
    border: "1px dashed #d6d3d1",
    background: "#fafaf9",
    color: "#78716c",
    padding: "24px",
    fontFamily: "var(--font-mono), 'JetBrains Mono', monospace",
    fontSize: "12px",
    lineHeight: 1.5,
  },
  downloadRow: {
    display: "flex",
    flexWrap: "wrap",
    gap: "10px",
    marginTop: "20px",
  },
  button: {
    border: "1px solid #d97706",
    background: "#fef3c7",
    color: "#92400e",
    fontFamily: "var(--font-mono), 'JetBrains Mono', monospace",
    fontSize: "11px",
    letterSpacing: "0.06em",
    fontWeight: 800,
    padding: "9px 11px",
    cursor: "pointer",
  },
  sourceLinks: {
    display: "flex",
    flexWrap: "wrap",
    gap: "8px 14px",
    marginTop: "18px",
    paddingTop: "16px",
    borderTop: "1px solid #e7e5e4",
  },
  sourceLink: {
    fontFamily: "var(--font-mono), 'JetBrains Mono', monospace",
    fontSize: "11px",
    color: "#d97706",
    textDecoration: "underline",
  },
};
