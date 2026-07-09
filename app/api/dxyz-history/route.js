import { NextResponse } from "next/server";
import snapshot from "./snapshot.json";
import { completedTradingRows } from "../../../lib/dxyzAtm.mjs";

// Daily DXYZ close/volume history for the ATM issuance bridge.
// Mirrors app/api/prices/route.js conventions: in-memory cache, per-request
// timeout, and a source label the client renders as a badge. Falls back to
// the checked-in snapshot (see snapshot.json "asOf") when Yahoo is down.

// 2026-03-31 00:00 ET — history starts at the filed NAV baseline date.
const PERIOD1 = 1774929600;
const CACHE_TTL_MS = 60 * 60 * 1000; // historical bars change once a day
// After a Yahoo failure, serve the fallback without re-hitting the upstream
// (and its 8s timeout) on every request for a short window.
const FAILURE_TTL_MS = 60 * 1000;

let cachedRows = null;
let cacheTimestamp = 0;
let failureTimestamp = 0;
// Coalesce concurrent cold-cache requests behind one upstream fetch so a
// burst can't fan out into parallel 8s Yahoo calls.
let inFlight = null;

// Current New York calendar date and minutes since NY midnight, so the
// completed-sessions filter can keep today's bar once the market has closed.
function nyClock() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(new Date());
  const get = (type) => parts.find((p) => p.type === type)?.value;
  return {
    date: `${get("year")}-${get("month")}-${get("day")}`,
    minutes: parseInt(get("hour"), 10) * 60 + parseInt(get("minute"), 10),
  };
}

// When Yahoo is unreachable, an expired in-memory cache from the last good
// fetch is still fresher than the checked-in snapshot, which only ages.
function fallbackResponse() {
  if (cachedRows) {
    return NextResponse.json({
      rows: cachedRows,
      source: "stale",
      asOf: new Date(cacheTimestamp).toISOString(),
    });
  }
  const ny = nyClock();
  return NextResponse.json({
    rows: completedTradingRows(snapshot.rows, ny.date, ny.minutes),
    source: "snapshot",
    asOf: new Date(snapshot.asOf).toISOString(),
  });
}

async function fetchYahooRows() {
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

  let rows = [];
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

  // Consumers (lib/dxyzAtm.mjs) require ascending dates and completed
  // sessions only — the in-progress bar carries partial volume.
  rows.sort((a, b) => a.date.localeCompare(b.date));
  const ny = nyClock();
  rows = completedTradingRows(rows, ny.date, ny.minutes);

  if (rows.length === 0) throw new Error("Yahoo returned no usable rows");
  return rows;
}

export async function GET() {
  const now = Date.now();

  if (cachedRows && now - cacheTimestamp < CACHE_TTL_MS) {
    return NextResponse.json({
      rows: cachedRows,
      source: "cache",
      asOf: new Date(cacheTimestamp).toISOString(),
    });
  }

  if (now - failureTimestamp < FAILURE_TTL_MS) {
    return fallbackResponse();
  }

  try {
    if (!inFlight) {
      inFlight = fetchYahooRows().finally(() => {
        inFlight = null;
      });
    }
    const rows = await inFlight;
    cachedRows = rows;
    cacheTimestamp = Date.now();
    return NextResponse.json({
      rows,
      source: "live",
      asOf: new Date(cacheTimestamp).toISOString(),
    });
  } catch (err) {
    console.warn(`DXYZ history fetch failed: ${err.message}`);
    failureTimestamp = Date.now();
    return fallbackResponse();
  }
}
