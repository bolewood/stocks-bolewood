"use client";

import { useEffect, useRef, useState } from "react";

// Snapshot of default DXYZ marks plus Notice.co 2Y charts captured Oct 1, 2026.
// Position dollars do not follow the calculator sliders.

const POSITIONS = [
  { k: "anthropic", n: "Anthropic", v: 235.7, c: 2035.82, s: "AI lab" },
  { k: "openai", n: "OpenAI", v: 192.7, c: 249.98, s: "AI lab", note: "Incl. $150M Aug lot at cost + PPUs" },
  { k: "spacex", n: "SpaceX", v: 152.9, c: 522.89, s: "Space · public since June" },
  { k: "openevidence", n: "OpenEvidence", v: 34.9, c: 1693.54, s: "AI app" },
  { k: "shieldai", n: "Shield AI", v: 30.1, c: 287.35, s: "Defense" },
  { k: "databricks", n: "Databricks", v: 19.6, c: 193.75, s: "AI infra" },
  { k: "revolut", n: "Revolut", v: 16.6, c: 196.06, s: "Fintech" },
  { k: "chaos", n: "CHAOS Industries", v: 15.7, c: 49.14, s: "Defense", note: "History starts mid-2025" },
  { k: "hermeus", n: "Hermeus", v: 15.0, c: 124.47, s: "Aerospace" },
  { k: "beast", n: "Beast Industries", v: 15.0, c: null, s: "Consumer" },
  { k: "mercury", n: "Mercury", v: 15.0, c: 127.59, s: "Fintech" },
  { k: "fluidstack", n: "Fluidstack", v: 15.0, c: 807.72, s: "AI infra", note: "History starts early 2025" },
  { k: "tenstorrent", n: "Tenstorrent", v: 12.5, c: 43.05, s: "AI chips" },
  { k: "ferox", n: "Ferox Games", v: 11.3, c: null, s: "Gaming" },
  { k: "skild", n: "Skild AI", v: 11.1, c: 799.86, s: "Robotics" },
  { k: "boom", n: "Boom", v: 4.0, c: -97.55, s: "Aerospace", note: "Likely share-basis break, not a real −97%" },
  { k: "chime", n: "Chime", v: 1.2, c: 3.37, s: "Fintech · public" },
  { k: "discord", n: "Discord", v: 0.79, c: 16.54, s: "Consumer" },
  { k: "klarna", n: "Klarna", v: 0.75, c: -60.16, s: "Fintech · public" },
  { k: "flexport", n: "Flexport", v: 0.086, c: -8.71, s: "Logistics" },
];

const EXTRA = [
  { k: "cash", n: "Cash", v: 770.7, c: null, s: "Money market", cash: true },
  { k: "tail", n: "Long-tail privates", v: 49.1, c: null, s: "Unnamed lots", cash: true },
];

const fmtM = (v) => (v >= 10 ? `$${v.toFixed(0)}M` : v >= 1 ? `$${v.toFixed(1)}M` : `$${(v * 1000).toFixed(0)}K`);
const fmtC = (c) => (c == null ? "no chart" : `${c >= 0 ? "+" : "−"}${Math.abs(c).toLocaleString(undefined, { maximumFractionDigits: 0 })}%`);

function band(c) {
  if (c == null) return ["--na", "dark"];
  if (c < -50) return ["--dn-3", "light"];
  if (c < 0) return ["--dn-2", "light"];
  if (c < 50) return ["--up-1", "dark"];
  if (c < 200) return ["--up-2", "dark"];
  if (c < 700) return ["--up-3", "light"];
  return ["--up-4", "light"];
}

function squarify(items, x, y, w, h) {
  const out = [];
  const total = items.reduce((a, i) => a + i.v, 0);
  const scale = (w * h) / total;
  let rest = items.map((i) => ({ ...i, a: i.v * scale }));
  while (rest.length) {
    const short = Math.min(w, h);
    let row = [];
    let best = Infinity;
    for (let i = 0; i < rest.length; i++) {
      const r = rest.slice(0, i + 1);
      const s = r.reduce((a, b) => a + b.a, 0);
      const worst = Math.max(...r.map((b) => Math.max((short * short * b.a) / (s * s), (s * s) / (short * short * b.a))));
      if (worst <= best) {
        best = worst;
        row = r;
      } else break;
    }
    const s = row.reduce((a, b) => a + b.a, 0);
    if (w >= h) {
      const rw = s / h;
      let yy = y;
      row.forEach((b) => {
        const bh = b.a / rw;
        out.push({ ...b, x, y: yy, w: rw, h: bh });
        yy += bh;
      });
      x += rw;
      w -= rw;
    } else {
      const rh = s / w;
      let xx = x;
      row.forEach((b) => {
        const bw = b.a / rh;
        out.push({ ...b, x: xx, y, w: bw, h: rh });
        xx += bw;
      });
      y += rh;
      h -= rh;
    }
    rest = rest.slice(row.length);
  }
  return out;
}

export default function DXYZChartWall() {
  const [open, setOpen] = useState(false);
  const [includeCash, setIncludeCash] = useState(false);
  const treeRef = useRef(null);

  const namedTotal = POSITIONS.reduce((a, p) => a + p.v, 0);
  const charted = POSITIONS.filter((p) => p.c != null);
  const up = charted.filter((p) => p.c > 0);
  const upVal = up.reduce((a, p) => a + p.v, 0) / charted.reduce((a, p) => a + p.v, 0);
  const top3 = POSITIONS.slice(0, 3).reduce((a, p) => a + p.v, 0);

  useEffect(() => {
    const tree = treeRef.current;
    if (!open || !tree) return undefined;
    const draw = () => {
      const items = [...POSITIONS, ...(includeCash ? EXTRA : [])].sort((a, b) => b.v - a.v);
      const width = tree.clientWidth;
      const height = tree.clientHeight;
      if (width < 10 || height < 10) return;
      const total = items.reduce((a, i) => a + i.v, 0);
      tree.replaceChildren();
      squarify(items, 0, 0, width, height).forEach((tile) => {
        const link = document.createElement("a");
        link.className = "dxyz-wall-tile";
        link.href = `#c-${tile.k}`;
        const [token, ink] = band(tile.c);
        link.style.left = `${tile.x}px`;
        link.style.top = `${tile.y}px`;
        link.style.width = `${tile.w}px`;
        link.style.height = `${tile.h}px`;
        link.style.background = tile.cash ? "var(--line)" : `var(${token})`;
        link.style.color = tile.cash ? "var(--muted)" : `var(${ink === "light" ? "--tile-ink-light" : "--tile-ink-dark"})`;
        const area = tile.w * tile.h;
        if (area < 9000) link.classList.add("small");
        if (area < 1800 || tile.w < 38 || tile.h < 22) link.classList.add("tiny");
        const name = document.createElement("span");
        name.className = "n";
        name.style.fontSize = `${Math.max(11, Math.min(30, Math.sqrt(area) / 8))}px`;
        name.textContent = tile.n;
        const value = document.createElement("span");
        value.className = "v";
        value.textContent = `${fmtM(tile.v)} · ${((tile.v / total) * 100).toFixed(1)}%`;
        link.append(name, value);
        if (!tile.cash) {
          const change = document.createElement("span");
          change.className = "c";
          change.textContent = `2Y ${fmtC(tile.c)}`;
          link.append(change);
        }
        link.title = `${tile.n} — ${fmtM(tile.v)} (${((tile.v / total) * 100).toFixed(1)}%)${tile.cash ? "" : ` · 2Y ${fmtC(tile.c)}`}`;
        tree.append(link);
      });
    };
    draw();
    const observer = new ResizeObserver(draw);
    observer.observe(tree);
    return () => observer.disconnect();
  }, [open, includeCash]);

  return (
    <details
      className="dxyz-chart-acc"
      onToggle={(event) => setOpen(event.currentTarget.open)}
    >
      <summary>
        <span className="dxyz-chart-acc-kicker">Snapshot</span>
        <span className="dxyz-chart-acc-title">Holdings chart wall</span>
        <span className="dxyz-chart-acc-meta">Oct 1, 2026 · default marks, not the sliders</span>
      </summary>
      {open && (
        <div className="dxyz-wall">
          <header>
            <div className="eyebrow">Destiny Tech100 · NYSE: DXYZ · charts captured Oct 1, 2026</div>
            <h2>Holdings, two years of price action</h2>
            <p className="lede">
              Every named private position, sized by its mark on this calculator&apos;s default settings, with Notice.co&apos;s two-year price chart. The point is the overall shape, not the axis labels. Moving the PPS and MOIC sliders above does not resize these tiles.
            </p>
            <div className="stats">
              <span><b>{fmtM(namedTotal)}</b> in named positions</span>
              <span><b>{up.length} of {charted.length}</b> charted names up over 2Y</span>
              <span><b>{Math.round(upVal * 100)}%</b> of charted value sits in names that rose</span>
              <span><b>3</b> names = {Math.round((top3 / namedTotal) * 100)}% of positions</span>
            </div>
          </header>

          <section className="panel" aria-labelledby="dxyz-tree-h">
            <div className="panel-head">
              <h3 id="dxyz-tree-h">Portfolio map</h3>
              <label className="toggle" htmlFor="dxyz-wall-cash">
                <input
                  id="dxyz-wall-cash"
                  type="checkbox"
                  checked={includeCash}
                  onChange={(event) => setIncludeCash(event.target.checked)}
                />
                Include cash &amp; long tail
              </label>
            </div>
            <div
              id="dxyz-wall-tree"
              ref={treeRef}
              role="img"
              aria-label="Treemap of DXYZ positions sized by value and colored by two-year price change"
            />
            <div className="legend">
              <span>Tile size = position value · color = 2Y move on Notice</span>
              <span><i className="sw dn3" />down &gt;50%</span>
              <span><i className="sw dn2" />down</span>
              <span><i className="sw up1" />0–50%</span>
              <span><i className="sw up2" />50–200%</span>
              <span><i className="sw up3" />200–700%</span>
              <span><i className="sw up4" />&gt;700%</span>
              <span><i className="sw na" />no chart</span>
            </div>
          </section>

          <section aria-labelledby="dxyz-grid-h">
            <h3 id="dxyz-grid-h">Two-year charts, largest position first</h3>
            <div className="grid">
              {POSITIONS.map((position) => {
                const cls = position.c == null ? "na" : position.c >= 0 ? "up" : "dn";
                return (
                  <article className="card" id={`c-${position.k}`} key={position.k}>
                    <div className="card-top">
                      <h4>{position.n}</h4>
                      <span className={`chip ${cls}`}>{fmtC(position.c)}</span>
                    </div>
                    <div className="meta">
                      {fmtM(position.v)} · {((position.v / namedTotal) * 100).toFixed(1)}% of positions · {position.s}
                    </div>
                    {position.c == null ? (
                      <div className="chart empty">No Notice.co page. Beast and Ferox have none; Clarity blocked the browser.</div>
                    ) : (
                      <div className="chart">
                        <img
                          src={`/dxyz-charts/${position.k}.jpg`}
                          alt={`${position.n} two-year price chart from Notice.co, captured Oct 1, 2026`}
                          loading="lazy"
                        />
                      </div>
                    )}
                    {position.note ? <p className="note">{position.note}</p> : null}
                  </article>
                );
              })}
            </div>
          </section>

          <footer>
            <p>Position values are this page&apos;s default marks (June 30, 2026 N-CSRS baseline, live SPCX for SpaceX at the time of the snapshot). OpenAI combines the June equity lot ($35.0M), the Aug 13 purchase at cost ($150.0M) and PPUs ($7.7M). Fluidstack and the Boom SAFE are held at cost.</p>
            <p>Charts are Notice.co&apos;s 2Y view, screenshotted Oct 1, 2026. Notice prices are algorithmic estimates from secondary and reference data. The percent on each card is the change Notice shows over the visible window. Fluidstack and CHAOS histories start partway through the two years. Beast Industries and Ferox Games have no Notice page.</p>
            <p>Boom&apos;s cliff in early 2026 is probably a share-basis change (recap or new share class) in Notice&apos;s series rather than a 97% loss. Treat that chart with caution.</p>
          </footer>
        </div>
      )}
      <style>{WALL_CSS}</style>
    </details>
  );
}

const WALL_CSS = `
.dxyz-chart-acc {
  border: 1px solid #1c1917;
  background: #fff;
  margin: 28px 0 8px;
}
.dxyz-chart-acc summary {
  cursor: pointer;
  list-style: none;
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 10px 16px;
  padding: 16px 18px;
}
.dxyz-chart-acc summary::-webkit-details-marker { display: none; }
.dxyz-chart-acc summary::before {
  content: "+";
  font-family: var(--font-mono), "JetBrains Mono", monospace;
  color: #d97706;
  font-weight: 700;
  width: 1ch;
}
.dxyz-chart-acc[open] summary::before { content: "–"; }
.dxyz-chart-acc-kicker {
  font-family: var(--font-mono), "JetBrains Mono", monospace;
  font-size: 12px;
  color: #d97706;
  font-weight: 700;
  letter-spacing: 0.05em;
}
.dxyz-chart-acc-title {
  font-size: 22px;
  font-weight: 600;
  letter-spacing: -0.01em;
}
.dxyz-chart-acc-meta {
  margin-left: auto;
  font-family: var(--font-mono), "JetBrains Mono", monospace;
  font-size: 11px;
  color: #78716c;
}
.dxyz-wall {
  --bg: #f6f5f1;
  --surface: #ffffff;
  --ink: #1c1917;
  --muted: #57534e;
  --line: #e7e5e4;
  --accent: #d97706;
  --up-1: #d6efdf;
  --up-2: #8fd1a8;
  --up-3: #3fa56b;
  --up-4: #1c7546;
  --dn-1: #f7dcd8;
  --dn-2: #e58f84;
  --dn-3: #c0453a;
  --na: #d8dce3;
  --tile-ink-dark: #10241a;
  --tile-ink-light: #ffffff;
  background: var(--bg);
  color: var(--ink);
  padding: 8px 18px 22px;
  display: grid;
  gap: 22px;
  font-size: 15px;
  line-height: 1.5;
}
.dxyz-wall .eyebrow {
  font-family: var(--font-mono), "JetBrains Mono", monospace;
  font-size: 11px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--muted);
}
.dxyz-wall h2, .dxyz-wall h3, .dxyz-wall h4 { margin: 0; font-weight: 600; letter-spacing: -0.01em; }
.dxyz-wall h2 { font-size: 28px; }
.dxyz-wall h3 { font-size: 20px; }
.dxyz-wall h4 { font-size: 17px; }
.dxyz-wall .lede { color: var(--muted); max-width: 72ch; margin: 6px 0 0; }
.dxyz-wall .stats {
  display: flex;
  flex-wrap: wrap;
  gap: 10px 28px;
  margin-top: 12px;
  font-family: var(--font-mono), "JetBrains Mono", monospace;
  font-size: 13px;
  color: var(--muted);
}
.dxyz-wall .stats b { color: var(--ink); font-weight: 600; font-size: 15px; }
.dxyz-wall .panel {
  background: var(--surface);
  border: 1px solid var(--line);
  padding: 16px;
  display: grid;
  gap: 12px;
}
.dxyz-wall .panel-head { display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; gap: 10px; }
.dxyz-wall .toggle { display: inline-flex; align-items: center; gap: 8px; font-size: 13px; color: var(--muted); cursor: pointer; }
.dxyz-wall .toggle input { accent-color: var(--accent); width: 16px; height: 16px; }
.dxyz-wall .legend {
  display: flex;
  flex-wrap: wrap;
  gap: 6px 14px;
  font-family: var(--font-mono), "JetBrains Mono", monospace;
  font-size: 12px;
  color: var(--muted);
  align-items: center;
}
.dxyz-wall .sw { display: inline-block; width: 14px; height: 14px; border-radius: 3px; vertical-align: -2px; margin-right: 5px; }
.dxyz-wall .sw.dn3 { background: var(--dn-3); }
.dxyz-wall .sw.dn2 { background: var(--dn-2); }
.dxyz-wall .sw.up1 { background: var(--up-1); }
.dxyz-wall .sw.up2 { background: var(--up-2); }
.dxyz-wall .sw.up3 { background: var(--up-3); }
.dxyz-wall .sw.up4 { background: var(--up-4); }
.dxyz-wall .sw.na { background: var(--na); }
#dxyz-wall-tree { position: relative; width: 100%; height: clamp(360px, 52vw, 560px); }
.dxyz-wall-tile {
  position: absolute;
  box-sizing: border-box;
  border: 2px solid var(--surface);
  border-radius: 6px;
  padding: 8px 10px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  gap: 2px;
  text-decoration: none;
}
.dxyz-wall-tile:hover { filter: brightness(1.06); }
.dxyz-wall-tile .n { font-weight: 650; line-height: 1.1; }
.dxyz-wall-tile .v, .dxyz-wall-tile .c {
  font-family: var(--font-mono), "JetBrains Mono", monospace;
  font-size: 12px;
}
.dxyz-wall-tile .v { opacity: 0.85; }
.dxyz-wall-tile .c { font-weight: 500; }
.dxyz-wall-tile.small .v, .dxyz-wall-tile.small .c { display: none; }
.dxyz-wall-tile.tiny .n { display: none; }
.dxyz-wall .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 14px; margin-top: 12px; }
.dxyz-wall .card {
  background: var(--surface);
  border: 1px solid var(--line);
  padding: 12px;
  display: grid;
  gap: 8px;
  min-width: 0;
}
.dxyz-wall .card-top { display: flex; justify-content: space-between; align-items: baseline; gap: 8px; }
.dxyz-wall .meta {
  font-family: var(--font-mono), "JetBrains Mono", monospace;
  font-size: 12px;
  color: var(--muted);
  font-variant-numeric: tabular-nums;
}
.dxyz-wall .chip {
  font-family: var(--font-mono), "JetBrains Mono", monospace;
  font-size: 12px;
  font-weight: 500;
  padding: 2px 7px;
  border-radius: 999px;
  white-space: nowrap;
}
.dxyz-wall .chip.up { background: var(--up-1); color: var(--up-4); }
.dxyz-wall .chip.dn { background: var(--dn-1); color: var(--dn-3); }
.dxyz-wall .chip.na { background: var(--na); color: var(--muted); }
.dxyz-wall .chart { overflow: hidden; background: #fff; aspect-ratio: 763 / 308; max-width: 100%; }
.dxyz-wall .chart img { display: block; width: 100%; height: 100%; object-fit: cover; }
.dxyz-wall .chart.empty {
  display: grid;
  place-items: center;
  background: var(--bg);
  border: 1px dashed var(--line);
  color: var(--muted);
  font-size: 13px;
  text-align: center;
  padding: 12px;
}
.dxyz-wall .note, .dxyz-wall footer { font-size: 12px; color: var(--muted); margin: 0; }
.dxyz-wall footer { display: grid; gap: 6px; max-width: 90ch; }
@media (max-width: 720px) {
  .dxyz-chart-acc-meta { margin-left: 0; }
  .dxyz-chart-acc-title { font-size: 18px; }
}
`;
