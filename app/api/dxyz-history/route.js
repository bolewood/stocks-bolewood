import { NextResponse } from "next/server";
import snapshot from "./snapshot.json";

// Daily DXYZ close/volume history for the ATM issuance bridge.
// Mirrors app/api/prices/route.js conventions: in-memory cache, per-request
// timeout, and a source label the client renders as a badge. Falls back to
// the checked-in snapshot (see snapshot.json "asOf") when Yahoo is down.

// 2026-03-31 00:00 ET — history starts at the filed NAV baseline date.
const PERIOD1 = 1774929600;
const CACHE_TTL_MS = 60 * 60 * 1000; // historical bars change once a day

let cachedRows = null;
let cacheTimestamp = 0;

export async function GET() {
  const now = Date.now();

  if (cachedRows && now - cacheTimestamp < CACHE_TTL_MS) {
    return NextResponse.json({
      rows: cachedRows,
      source: "cache",
      asOf: new Date(cacheTimestamp).toISOString(),
    });
  }

  try {
    const response = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/DXYZ?interval=1d&period1=${PERIOD1}&period2=9999999999`,
      {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
        },
        signal: AbortSignal.timeout(8000),
      }
    );
    if (!response.ok) throw new Error(`Yahoo responded ${response.status}`);

    const data = await response.json();
    const result = data?.chart?.result?.[0];
    const timestamps = result?.timestamp || [];
    const quote = result?.indicators?.quote?.[0] || {};

    const rows = [];
    for (let i = 0; i < timestamps.length; i++) {
      const close = quote.close?.[i];
      const volume = quote.volume?.[i];
      if (typeof close !== "number" || typeof volume !== "number") continue;
      // Trading-day date in exchange (New York) time
      const date = new Date(timestamps[i] * 1000).toLocaleDateString("en-CA", {
        timeZone: "America/New_York",
      });
      rows.push({ date, close: Math.round(close * 100) / 100, volume });
    }

    if (rows.length === 0) throw new Error("Yahoo returned no usable rows");

    cachedRows = rows;
    cacheTimestamp = now;
    return NextResponse.json({
      rows,
      source: "live",
      asOf: new Date(now).toISOString(),
    });
  } catch (err) {
    console.warn(`DXYZ history fetch failed: ${err.message}`);
    return NextResponse.json({
      rows: snapshot.rows,
      source: "snapshot",
      asOf: snapshot.asOf,
    });
  }
}
