// Private Tape math and market-window helpers. Keep financial assumptions in
// data/private-tape.json; this module should stay deterministic and testable.

import privateTapeConfig from "../data/private-tape.json" with { type: "json" };
import { etCivilToUtc, etClock } from "./priceState.mjs";

export const PRIVATE_TAPE_CONFIG = privateTapeConfig;

export const RETURN_INTERVAL_MS = 30 * 60 * 1000;
export const RTH_OPEN_MIN = 9 * 60 + 30;
export const RTH_CLOSE_MIN = 16 * 60;
export const MIN_CORRELATION_N = 6;
export const MIN_REGRESSION_N = 8;
export const MIN_MULTI_REGRESSION_N = 20;

const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_CANDLE_STALENESS_MS = 2 * 60 * 60 * 1000;
const WEEKEND = new Set(["Sat", "Sun"]);
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function pad2(n) {
  return String(n).padStart(2, "0");
}

export function etDateParts(ms) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    weekday: "short",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(ms));
  const get = (type) => parts.find((p) => p.type === type)?.value;
  return {
    weekday: get("weekday"),
    year: Number(get("year")),
    month: Number(get("month")),
    day: Number(get("day")),
    hour: Number(get("hour")),
    minute: Number(get("minute")),
    second: Number(get("second")),
  };
}

export function etDateKey(ms) {
  const p = etDateParts(ms);
  return `${p.year}-${pad2(p.month)}-${pad2(p.day)}`;
}

export function etMinuteKey(ms) {
  const p = etDateParts(ms);
  return `${p.year}-${pad2(p.month)}-${pad2(p.day)}T${pad2(p.hour)}:${pad2(
    p.minute
  )}`;
}

export function etMinutesOfDay(ms) {
  const p = etDateParts(ms);
  return p.hour * 60 + p.minute;
}

function parseDateKey(dateKey) {
  const [year, month, day] = dateKey.split("-").map(Number);
  return { year, month, day };
}

function utcDateKey(year, month, day) {
  return new Date(Date.UTC(year, month - 1, day)).toISOString().slice(0, 10);
}

function addDateDays(dateKey, deltaDays) {
  const { year, month, day } = parseDateKey(dateKey);
  return new Date(Date.UTC(year, month - 1, day + deltaDays))
    .toISOString()
    .slice(0, 10);
}

function weekdayOfDateKey(dateKey) {
  const { year, month, day } = parseDateKey(dateKey);
  return WEEKDAYS[new Date(Date.UTC(year, month - 1, day)).getUTCDay()];
}

function nthWeekdayOfMonth(year, month, weekday, n) {
  let seen = 0;
  for (let day = 1; day <= 31; day++) {
    const d = new Date(Date.UTC(year, month - 1, day));
    if (d.getUTCMonth() !== month - 1) break;
    if (d.getUTCDay() === weekday) {
      seen++;
      if (seen === n) return utcDateKey(year, month, day);
    }
  }
  throw new Error(`no weekday ${weekday} #${n} in ${year}-${month}`);
}

function lastWeekdayOfMonth(year, month, weekday) {
  for (let day = 31; day >= 1; day--) {
    const d = new Date(Date.UTC(year, month - 1, day));
    if (d.getUTCMonth() !== month - 1) continue;
    if (d.getUTCDay() === weekday) return utcDateKey(year, month, day);
  }
  throw new Error(`no weekday ${weekday} in ${year}-${month}`);
}

function observedFixedHoliday(year, month, day) {
  const dateKey = utcDateKey(year, month, day);
  const dow = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  if (dow === 6) return addDateDays(dateKey, -1);
  if (dow === 0) return addDateDays(dateKey, 1);
  return dateKey;
}

function easterDateKey(year) {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return utcDateKey(year, month, day);
}

export function nyseHolidayDates(year) {
  return new Set([
    observedFixedHoliday(year, 1, 1),
    nthWeekdayOfMonth(year, 1, 1, 3), // Martin Luther King Jr. Day
    nthWeekdayOfMonth(year, 2, 1, 3), // Presidents Day
    addDateDays(easterDateKey(year), -2), // Good Friday
    lastWeekdayOfMonth(year, 5, 1), // Memorial Day
    observedFixedHoliday(year, 6, 19),
    observedFixedHoliday(year, 7, 4),
    nthWeekdayOfMonth(year, 9, 1, 1), // Labor Day
    nthWeekdayOfMonth(year, 11, 4, 4), // Thanksgiving
    observedFixedHoliday(year, 12, 25),
  ]);
}

export function isNyseHolidayDate(dateKey) {
  const { year } = parseDateKey(dateKey);
  const holidays = new Set([
    ...nyseHolidayDates(year - 1),
    ...nyseHolidayDates(year),
    ...nyseHolidayDates(year + 1),
  ]);
  return holidays.has(dateKey);
}

export function isNyseSessionDate(dateKey) {
  if (WEEKEND.has(weekdayOfDateKey(dateKey))) return false;
  return !isNyseHolidayDate(dateKey);
}

export function isNyseCashSessionOpen(now = Date.now()) {
  const date = etDateKey(now);
  if (!isNyseSessionDate(date)) return false;
  const minutes = etMinutesOfDay(now);
  return minutes >= RTH_OPEN_MIN && minutes < RTH_CLOSE_MIN;
}

export function previousNyseSessionDate(dateKey) {
  let d = dateKey;
  for (let i = 0; i < 12; i++) {
    d = addDateDays(d, -1);
    if (isNyseSessionDate(d)) return d;
  }
  throw new Error(`no previous NYSE session before ${dateKey}`);
}

export function nextNyseSessionDate(dateKey) {
  let d = dateKey;
  for (let i = 0; i < 12; i++) {
    d = addDateDays(d, 1);
    if (isNyseSessionDate(d)) return d;
  }
  throw new Error(`no next NYSE session after ${dateKey}`);
}

export function marketOpenMs(dateKey) {
  const { year, month, day } = parseDateKey(dateKey);
  return etCivilToUtc(year, month, day, 9, 30);
}

export function marketCloseMs(dateKey) {
  const { year, month, day } = parseDateKey(dateKey);
  return etCivilToUtc(year, month, day, 16, 0);
}

export function latestCompletedNyseDate(now = Date.now()) {
  const c = etClock(now);
  const today = `${c.year}-${pad2(c.month)}-${pad2(c.day)}`;
  if (isNyseSessionDate(today) && c.minutes >= RTH_CLOSE_MIN) return today;
  return previousNyseSessionDate(today);
}

export function nextNyseOpenMs(now = Date.now()) {
  const c = etClock(now);
  const today = `${c.year}-${pad2(c.month)}-${pad2(c.day)}`;
  if (isNyseSessionDate(today) && c.minutes < RTH_OPEN_MIN) {
    return marketOpenMs(today);
  }
  return marketOpenMs(nextNyseSessionDate(today));
}

export function modeledAssetWeights(config = PRIVATE_TAPE_CONFIG) {
  const anthropic =
    Number(config.assets.anthropic.filedPortfolioWeight) || 0;
  const spacex = Number(config.assets.spacex.filedPortfolioWeight) || 0;
  const total = anthropic + spacex;
  if (!(total > 0)) return { anthropic: 0, spacex: 0, totalFiledWeight: 0 };
  return {
    anthropic: anthropic / total,
    spacex: spacex / total,
    totalFiledWeight: total,
  };
}

export function simpleReturn(startPrice, endPrice) {
  if (!(startPrice > 0) || !(endPrice > 0)) return null;
  return endPrice / startPrice - 1;
}

export function weightedTapeReturn(
  { anthropic, spacex },
  weights = modeledAssetWeights()
) {
  if (!Number.isFinite(anthropic) || !Number.isFinite(spacex)) return null;
  return weights.anthropic * anthropic + weights.spacex * spacex;
}

export const weightedPrivateReturn = weightedTapeReturn;

function isFiniteNumber(n) {
  return Number.isFinite(n);
}

function pointPrice(point) {
  return point?.close ?? point?.price;
}

function pointEndMs(point) {
  return point?.endMs ?? point?.atMs ?? point?.T ?? point?.t;
}

function sortedPoints(points) {
  return [...(points || [])]
    .map((p) => ({
      ...p,
      price: Number(pointPrice(p)),
      endMs: Number(pointEndMs(p)),
    }))
    .filter((p) => p.endMs > 0 && p.price > 0)
    .sort((a, b) => a.endMs - b.endMs);
}

export function priceAtOrBefore(
  points,
  boundaryMs,
  { maxAgeMs = MAX_CANDLE_STALENESS_MS } = {}
) {
  const sorted = sortedPoints(points);
  let lo = 0;
  let hi = sorted.length - 1;
  let best = null;
  while (lo <= hi) {
    const mid = Math.floor((lo + hi) / 2);
    if (sorted[mid].endMs <= boundaryMs) {
      best = sorted[mid];
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  if (!best) return null;
  if (maxAgeMs != null && boundaryMs - best.endMs > maxAgeMs) return null;
  return { price: best.price, atMs: best.endMs };
}

function rthPointMap(points) {
  const map = new Map();
  for (const point of sortedPoints(points)) {
    const date = etDateKey(point.endMs);
    const minutes = etMinutesOfDay(point.endMs);
    if (!isNyseSessionDate(date)) continue;
    if (!(minutes > RTH_OPEN_MIN && minutes <= RTH_CLOSE_MIN)) continue;
    map.set(etMinuteKey(point.endMs), {
      price: point.price,
      endMs: point.endMs,
      date,
      timeEt: etMinuteKey(point.endMs).slice(11),
    });
  }
  return map;
}

function allPointMap(points) {
  const map = new Map();
  for (const point of sortedPoints(points)) {
    map.set(etMinuteKey(point.endMs), {
      price: point.price,
      endMs: point.endMs,
      date: etDateKey(point.endMs),
      timeEt: etMinuteKey(point.endMs).slice(11),
    });
  }
  return map;
}

function commonSortedKeys(maps, requiredKeys) {
  const base = maps[requiredKeys[0]];
  return [...base.keys()]
    .filter((key) => requiredKeys.every((name) => maps[name].has(key)))
    .sort((a, b) => maps[requiredKeys[0]].get(a).endMs - maps[requiredKeys[0]].get(b).endMs);
}

export function buildRthReturnSamples(
  { dxyz = [], anthropic = [], spacex = [], qqq = [] },
  { intervalMs = RETURN_INTERVAL_MS } = {}
) {
  const maps = {
    dxyz: rthPointMap(dxyz),
    anthropic: rthPointMap(anthropic),
    spacex: rthPointMap(spacex),
    qqq: rthPointMap(qqq),
  };
  const keys = commonSortedKeys(maps, ["dxyz", "anthropic", "spacex"]);
  const samples = [];

  for (let i = 1; i < keys.length; i++) {
    const prevKey = keys[i - 1];
    const key = keys[i];
    const prev = maps.dxyz.get(prevKey);
    const current = maps.dxyz.get(key);
    if (prev.date !== current.date) continue;
    if (current.endMs - prev.endMs > intervalMs * 1.6) continue;

    const sample = {
      date: current.date,
      timeEt: current.timeEt,
      endMs: current.endMs,
      dxyz: simpleReturn(maps.dxyz.get(prevKey).price, maps.dxyz.get(key).price),
      anthropic: simpleReturn(
        maps.anthropic.get(prevKey).price,
        maps.anthropic.get(key).price
      ),
      spacex: simpleReturn(
        maps.spacex.get(prevKey).price,
        maps.spacex.get(key).price
      ),
    };

    if (maps.qqq.has(prevKey) && maps.qqq.has(key)) {
      sample.qqq = simpleReturn(maps.qqq.get(prevKey).price, maps.qqq.get(key).price);
    }
    samples.push(sample);
  }

  return samples.filter((s) =>
    ["dxyz", "anthropic", "spacex"].every((key) => isFiniteNumber(s[key]))
  );
}

export function buildPrivateReturnSamples(
  { anthropic = [], spacex = [] },
  { intervalMs = RETURN_INTERVAL_MS } = {}
) {
  const maps = {
    anthropic: allPointMap(anthropic),
    spacex: allPointMap(spacex),
  };
  const keys = commonSortedKeys(maps, ["anthropic", "spacex"]);
  const samples = [];

  for (let i = 1; i < keys.length; i++) {
    const prevKey = keys[i - 1];
    const key = keys[i];
    const prev = maps.anthropic.get(prevKey);
    const current = maps.anthropic.get(key);
    if (current.endMs - prev.endMs > intervalMs * 1.6) continue;
    samples.push({
      date: current.date,
      timeEt: current.timeEt,
      endMs: current.endMs,
      anthropic: simpleReturn(
        maps.anthropic.get(prevKey).price,
        maps.anthropic.get(key).price
      ),
      spacex: simpleReturn(
        maps.spacex.get(prevKey).price,
        maps.spacex.get(key).price
      ),
    });
  }

  return samples.filter((s) =>
    ["anthropic", "spacex"].every((key) => isFiniteNumber(s[key]))
  );
}

function valuesFor(samples, xKey, yKey) {
  return samples
    .map((s) => ({ x: s[xKey], y: s[yKey], sample: s }))
    .filter((p) => isFiniteNumber(p.x) && isFiniteNumber(p.y));
}

export function pearsonCorrelation(samples, xKey, yKey) {
  const pairs = valuesFor(samples, xKey, yKey);
  const n = pairs.length;
  if (n < 2) return null;
  const meanX = pairs.reduce((sum, p) => sum + p.x, 0) / n;
  const meanY = pairs.reduce((sum, p) => sum + p.y, 0) / n;
  let sxx = 0;
  let syy = 0;
  let sxy = 0;
  for (const p of pairs) {
    const dx = p.x - meanX;
    const dy = p.y - meanY;
    sxx += dx * dx;
    syy += dy * dy;
    sxy += dx * dy;
  }
  const denom = Math.sqrt(sxx * syy);
  return denom > 0 ? sxy / denom : null;
}

function ranks(values) {
  return values
    .map((value, idx) => ({ value, idx }))
    .sort((a, b) => a.value - b.value)
    .reduce((acc, item, idx, arr) => {
      if (acc[item.idx] != null) return acc;
      let end = idx;
      while (end + 1 < arr.length && arr[end + 1].value === item.value) end++;
      const rank = (idx + end + 2) / 2;
      for (let i = idx; i <= end; i++) acc[arr[i].idx] = rank;
      return acc;
    }, new Array(values.length));
}

export function spearmanCorrelation(samples, xKey, yKey) {
  const pairs = valuesFor(samples, xKey, yKey);
  if (pairs.length < 2) return null;
  const xRanks = ranks(pairs.map((p) => p.x));
  const yRanks = ranks(pairs.map((p) => p.y));
  return pearsonCorrelation(
    pairs.map((p, i) => ({ x: xRanks[i], y: yRanks[i] })),
    "x",
    "y"
  );
}

function solveLinearSystem(matrix, vector) {
  const n = vector.length;
  const a = matrix.map((row, i) => [...row, vector[i]]);
  for (let col = 0; col < n; col++) {
    let pivot = col;
    for (let row = col + 1; row < n; row++) {
      if (Math.abs(a[row][col]) > Math.abs(a[pivot][col])) pivot = row;
    }
    if (Math.abs(a[pivot][col]) < 1e-12) return null;
    if (pivot !== col) [a[pivot], a[col]] = [a[col], a[pivot]];

    const div = a[col][col];
    for (let j = col; j <= n; j++) a[col][j] /= div;

    for (let row = 0; row < n; row++) {
      if (row === col) continue;
      const factor = a[row][col];
      for (let j = col; j <= n; j++) a[row][j] -= factor * a[col][j];
    }
  }
  return a.map((row) => row[n]);
}

export function linearRegression(samples, yKey, xKeys, { minN = null } = {}) {
  const rows = samples
    .map((sample) => ({
      sample,
      y: sample[yKey],
      x: xKeys.map((key) => sample[key]),
    }))
    .filter((row) => isFiniteNumber(row.y) && row.x.every(isFiniteNumber));

  const p = xKeys.length + 1;
  if (rows.length < (minN ?? p + 2)) return null;

  const xtx = Array.from({ length: p }, () => Array(p).fill(0));
  const xty = Array(p).fill(0);
  for (const row of rows) {
    const x = [1, ...row.x];
    for (let i = 0; i < p; i++) {
      xty[i] += x[i] * row.y;
      for (let j = 0; j < p; j++) xtx[i][j] += x[i] * x[j];
    }
  }

  const beta = solveLinearSystem(xtx, xty);
  if (!beta) return null;

  const meanY = rows.reduce((sum, row) => sum + row.y, 0) / rows.length;
  let sse = 0;
  let sst = 0;
  const residuals = rows.map((row) => {
    const fitted = beta[0] + row.x.reduce((sum, x, i) => sum + beta[i + 1] * x, 0);
    const residual = row.y - fitted;
    sse += residual * residual;
    sst += (row.y - meanY) ** 2;
    return { ...row.sample, fitted, residual };
  });

  return {
    n: rows.length,
    intercept: beta[0],
    slopes: Object.fromEntries(xKeys.map((key, i) => [key, beta[i + 1]])),
    r2: sst > 0 ? 1 - sse / sst : null,
    residuals,
  };
}

export function correlationSummary(samples, xKey, yKey, { minN = MIN_CORRELATION_N } = {}) {
  const pairs = valuesFor(samples, xKey, yKey);
  const n = pairs.length;
  const enough = n >= minN;
  const regression = enough
    ? linearRegression(
        pairs.map((p) => ({ x: p.x, y: p.y, endMs: p.sample.endMs })),
        "y",
        ["x"],
        { minN }
      )
    : null;

  return {
    n,
    minN,
    enough,
    pearson: enough ? pearsonCorrelation(samples, xKey, yKey) : null,
    spearman: enough ? spearmanCorrelation(samples, xKey, yKey) : null,
    slope: regression?.slopes?.x ?? null,
    r2: regression?.r2 ?? null,
  };
}

export function rollingCorrelationSeries(
  samples,
  xKey,
  yKey,
  { windowMs = 30 * DAY_MS, minN = MIN_CORRELATION_N } = {}
) {
  const valid = samples
    .filter((s) => s.endMs > 0 && isFiniteNumber(s[xKey]) && isFiniteNumber(s[yKey]))
    .sort((a, b) => a.endMs - b.endMs);

  return valid.map((sample) => {
    const start = sample.endMs - windowMs;
    const window = valid.filter((s) => s.endMs > start && s.endMs <= sample.endMs);
    return {
      endMs: sample.endMs,
      date: sample.date,
      timeEt: sample.timeEt,
      n: window.length,
      r: window.length >= minN ? pearsonCorrelation(window, xKey, yKey) : null,
    };
  });
}

export function buildOvernightSamples(
  { dxyzDaily = [], qqqDaily = [], anthropic = [], spacex = [] },
  { maxAgeMs = MAX_CANDLE_STALENESS_MS } = {}
) {
  const dxyzRows = [...dxyzDaily]
    .filter((r) => r.date && r.open > 0 && r.close > 0)
    .sort((a, b) => a.date.localeCompare(b.date));
  const qqqByDate = new Map(
    qqqDaily
      .filter((r) => r.date && r.open > 0 && r.close > 0)
      .map((r) => [r.date, r])
  );
  const samples = [];

  for (let i = 1; i < dxyzRows.length; i++) {
    const prior = dxyzRows[i - 1];
    const current = dxyzRows[i];
    if (!isNyseSessionDate(current.date)) continue;

    const startMs = marketCloseMs(prior.date);
    const endMs = marketOpenMs(current.date);
    const anthStart = priceAtOrBefore(anthropic, startMs, { maxAgeMs });
    const anthEnd = priceAtOrBefore(anthropic, endMs, { maxAgeMs });
    const spcxStart = priceAtOrBefore(spacex, startMs, { maxAgeMs });
    const spcxEnd = priceAtOrBefore(spacex, endMs, { maxAgeMs });
    if (!anthStart || !anthEnd || !spcxStart || !spcxEnd) continue;

    const anthropicReturn = simpleReturn(anthStart.price, anthEnd.price);
    const spacexReturn = simpleReturn(spcxStart.price, spcxEnd.price);
    const weightedReturn = weightedTapeReturn({
      anthropic: anthropicReturn,
      spacex: spacexReturn,
    });
    const qqqPrior = qqqByDate.get(prior.date);
    const qqqCurrent = qqqByDate.get(current.date);

    samples.push({
      date: current.date,
      priorDate: prior.date,
      startMs,
      endMs,
      dxyzGap: simpleReturn(prior.close, current.open),
      qqqGap: qqqPrior && qqqCurrent ? simpleReturn(qqqPrior.close, qqqCurrent.open) : null,
      anthropic: anthropicReturn,
      spacex: spacexReturn,
      weightedReturn,
      anthropicStartAtMs: anthStart.atMs,
      anthropicEndAtMs: anthEnd.atMs,
      spacexStartAtMs: spcxStart.atMs,
      spacexEndAtMs: spcxEnd.atMs,
    });
  }

  return samples.filter((s) =>
    ["dxyzGap", "anthropic", "spacex", "weightedReturn"].every((key) =>
      isFiniteNumber(s[key])
    )
  );
}

export const OVERNIGHT_BUCKETS = [
  { key: "gt3", label: "> +3%", min: 0.03, max: Infinity },
  { key: "plus1to3", label: "+1% to +3%", min: 0.01, max: 0.03 },
  { key: "flat", label: "-1% to +1%", min: -0.01, max: 0.01 },
  { key: "minus3to1", label: "-3% to -1%", min: -0.03, max: -0.01 },
  { key: "ltMinus3", label: "< -3%", min: -Infinity, max: -0.03 },
];

export function bucketOvernightSamples(samples) {
  return OVERNIGHT_BUCKETS.map((bucket) => {
    const rows = samples.filter(
      (s) => s.weightedReturn >= bucket.min && s.weightedReturn < bucket.max
    );
    const avgDxyzGap =
      rows.length > 0
        ? rows.reduce((sum, row) => sum + row.dxyzGap, 0) / rows.length
        : null;
    const avgPrivateMove =
      rows.length > 0
        ? rows.reduce((sum, row) => sum + row.weightedReturn, 0) / rows.length
        : null;
    return { ...bucket, n: rows.length, avgDxyzGap, avgPrivateMove };
  });
}

export function buildIndexSeries(
  { dxyzDaily = [], anthropic = [], spacex = [] },
  { maxAgeMs = MAX_CANDLE_STALENESS_MS } = {}
) {
  const rows = [...dxyzDaily]
    .filter((r) => r.date && r.close > 0)
    .sort((a, b) => a.date.localeCompare(b.date));
  const weights = modeledAssetWeights();
  let base = null;
  const series = [];

  for (const row of rows) {
    if (!isNyseSessionDate(row.date)) continue;
    const boundaryMs = marketCloseMs(row.date);
    const anth = priceAtOrBefore(anthropic, boundaryMs, { maxAgeMs });
    const spcx = priceAtOrBefore(spacex, boundaryMs, { maxAgeMs });
    if (!anth || !spcx) continue;
    if (!base) {
      base = { dxyz: row.close, anthropic: anth.price, spacex: spcx.price };
    }
    const tapeSleeveIndex =
      100 *
      (weights.anthropic * (anth.price / base.anthropic) +
        weights.spacex * (spcx.price / base.spacex));
    series.push({
      date: row.date,
      endMs: boundaryMs,
      dxyzIndex: 100 * (row.close / base.dxyz),
      privateIndex: tapeSleeveIndex,
      tapeSleeveIndex,
      anthropicIndex: 100 * (anth.price / base.anthropic),
      spacexIndex: 100 * (spcx.price / base.spacex),
      dxyzClose: row.close,
      anthropicPrice: anth.price,
      spacexPrice: spcx.price,
    });
  }
  return series;
}

export function currentPrivateIndex({ indexSeries = [], anthropic = [], spacex = [] }, now = Date.now()) {
  if (!indexSeries.length) return null;
  const base = indexSeries[0];
  const latestAnthropic = priceAtOrBefore(anthropic, now, { maxAgeMs: MAX_CANDLE_STALENESS_MS });
  const latestSpacex = priceAtOrBefore(spacex, now, { maxAgeMs: MAX_CANDLE_STALENESS_MS });
  if (!latestAnthropic || !latestSpacex) return null;
  const weights = modeledAssetWeights();
  return {
    value:
      100 *
      (weights.anthropic * (latestAnthropic.price / base.anthropicPrice) +
        weights.spacex * (latestSpacex.price / base.spacexPrice)),
    anthropicAtMs: latestAnthropic.atMs,
    spacexAtMs: latestSpacex.atMs,
  };
}

export function latestWindowReturn(points, windowMs = DAY_MS) {
  const sorted = sortedPoints(points);
  const latest = sorted.at(-1);
  if (!latest) return null;
  const prior = priceAtOrBefore(sorted, latest.endMs - windowMs, {
    maxAgeMs: MAX_CANDLE_STALENESS_MS,
  });
  if (!prior) return null;
  return {
    latestPrice: latest.price,
    latestAtMs: latest.endMs,
    priorPrice: prior.price,
    priorAtMs: prior.atMs,
    return: simpleReturn(prior.price, latest.price),
  };
}

export function buildCurrentOvernightSignal(
  { dxyzDaily = [], anthropic = [], spacex = [], regression = null },
  now = Date.now()
) {
  const completedDate = latestCompletedNyseDate(now);
  const prior = [...dxyzDaily]
    .filter((row) => row.date <= completedDate && row.close > 0)
    .sort((a, b) => a.date.localeCompare(b.date))
    .at(-1);
  if (!prior) return null;

  const startMs = marketCloseMs(prior.date);
  const anthStart = priceAtOrBefore(anthropic, startMs);
  const anthNow = priceAtOrBefore(anthropic, now);
  const spcxStart = priceAtOrBefore(spacex, startMs);
  const spcxNow = priceAtOrBefore(spacex, now);
  if (!anthStart || !anthNow || !spcxStart || !spcxNow) return null;

  const anthropicReturn = simpleReturn(anthStart.price, anthNow.price);
  const spacexReturn = simpleReturn(spcxStart.price, spcxNow.price);
  const weightedReturn = weightedTapeReturn({
    anthropic: anthropicReturn,
    spacex: spacexReturn,
  });
  const nyseOpen = isNyseCashSessionOpen(now);
  const predictedGap =
    !nyseOpen && regression?.n >= MIN_REGRESSION_N
      ? regression.intercept + regression.slopes.weightedReturn * weightedReturn
      : null;

  return {
    nyseOpen,
    completedDate,
    startMs,
    nowMs: now,
    nextOpenMs: nextNyseOpenMs(now),
    dxyzPreviousClose: prior.close,
    dxyzPreviousCloseDate: prior.date,
    anthropic: anthropicReturn,
    spacex: spacexReturn,
    weightedReturn,
    predictedGap,
    anthropicAtMs: anthNow.atMs,
    spacexAtMs: spcxNow.atMs,
  };
}

export function cumulativeResidualSeries(regression) {
  if (!regression?.residuals?.length) return [];
  let cumulative = 0;
  return regression.residuals.map((row) => {
    cumulative += row.residual;
    return {
      date: row.date,
      timeEt: row.timeEt,
      endMs: row.endMs,
      residual: row.residual,
      cumulativeResidual: cumulative,
      fitted: row.fitted,
      dxyz: row.dxyz,
    };
  });
}

export function csvEscape(value) {
  if (value == null) return "";
  const s = String(value);
  return /[",\n]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s;
}

export function samplesToCsv(rows, columns) {
  return [
    columns.map((c) => csvEscape(c.header)).join(","),
    ...rows.map((row) =>
      columns.map((c) => csvEscape(typeof c.value === "function" ? c.value(row) : row[c.value])).join(",")
    ),
  ].join("\n");
}
