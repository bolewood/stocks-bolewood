import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";

// Static share card. No live numbers: X and others cache card images for
// days, so a printed valuation would be stale on most shares.

export const alt =
  "Anthropic IPO tape: investor day Oct 14, then S-1, roadshow and pricing. Live implied valuation, IPO odds and public proxies vs QQQ";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const INK = "#1c1917";
const MUTED = "#78716c";
const BLUE = "#2563eb";

// Shape of the Polymarket first-day closing-cap brackets (Oct 13 snapshot),
// drawn as a motif: solid = now, dashed = earlier, echoing the page's ghost bars.
const BARS = [
  [0.024, 0.021], [0.046, 0.033], [0.1015, 0.096], [0.255, 0.24], [0.268, 0.27],
  [0.17, 0.21], [0.0805, 0.0985], [0.037, 0.0175], [0.0475, 0.028],
];
const BAR_MAX_H = 230;

function fontFile(name) {
  return readFile(join(process.cwd(), "assets/og", name));
}

export default async function Image() {
  const [fraunces, mono500, mono700] = await Promise.all([
    fontFile("fraunces-500.woff"),
    fontFile("jetbrains-mono-500.woff"),
    fontFile("jetbrains-mono-700.woff"),
  ]);
  const peak = Math.max(...BARS.flat());

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          background: "#fefdf8",
          padding: "56px 64px 48px",
          color: INK,
          fontFamily: "JetBrains Mono",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontSize: 22, letterSpacing: 2, color: "#44403c" }}>stocks.bolewood.com</div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              fontSize: 20,
              fontWeight: 700,
              letterSpacing: 3,
              color: "#14532d",
              background: "#dcfce7",
              padding: "8px 16px",
            }}
          >
            <div style={{ width: 12, height: 12, borderRadius: 6, background: "#16a34a" }} />
            LIVE TAPE · ANTHROPIC IPO
          </div>
        </div>

        <div style={{ display: "flex", flex: 1, marginTop: 36, gap: 48 }}>
          <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                fontFamily: "Fraunces",
                fontSize: 76,
                lineHeight: 1.05,
                letterSpacing: -1,
              }}
            >
              <div>Anthropic</div>
              <div>IPO tape</div>
            </div>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 10,
                marginTop: 30,
                fontSize: 23,
                color: "#44403c",
              }}
            >
              <div style={{ color: INK }}>Investor day Oct 14 · S-1, roadshow and pricing next</div>
              <div>Implied valuation · Hyperliquid io:ANTH</div>
              <div>IPO odds · Polymarket + Kalshi</div>
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", justifyContent: "flex-end", width: 380 }}>
            <div style={{ fontSize: 16, color: MUTED, letterSpacing: 1.5, marginBottom: 14 }}>
              FIRST-DAY CLOSING CAP · BRACKETS
            </div>
            <div
              style={{
                display: "flex",
                alignItems: "flex-end",
                gap: 10,
                height: BAR_MAX_H,
                borderBottom: `2px solid ${INK}`,
              }}
            >
              {BARS.map(([now, then], i) => (
                <div
                  key={i}
                  style={{ display: "flex", alignItems: "flex-end", flex: 1, height: "100%", position: "relative" }}
                >
                  <div
                    style={{
                      position: "absolute",
                      left: 0,
                      right: 0,
                      bottom: 0,
                      height: Math.max(4, (then / peak) * BAR_MAX_H),
                      border: `2px dashed ${MUTED}`,
                    }}
                  />
                  <div
                    style={{
                      width: "100%",
                      margin: "0 5px",
                      height: Math.max(4, (now / peak) * BAR_MAX_H),
                      background: BLUE,
                    }}
                  />
                </div>
              ))}
            </div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                fontSize: 16,
                color: MUTED,
                marginTop: 10,
              }}
            >
              <div>&lt;$1.25T</div>
              <div>$2T</div>
              <div>$3T+</div>
            </div>
          </div>
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            borderTop: "1px solid #e7e5e4",
            paddingTop: 18,
            marginTop: 28,
            fontSize: 18,
            color: MUTED,
          }}
        >
          <div>stocks.bolewood.com/anthropic-ipo-tape</div>
          <div>Public market data only. Not affiliated with Anthropic.</div>
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        { name: "Fraunces", data: fraunces, weight: 500, style: "normal" },
        { name: "JetBrains Mono", data: mono500, weight: 500, style: "normal" },
        { name: "JetBrains Mono", data: mono700, weight: 700, style: "normal" },
      ],
    }
  );
}
