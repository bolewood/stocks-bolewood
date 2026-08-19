// Quote-feed state for /ai. Three clocks, five states, explicit thresholds.
//
// quoteAsOf      — when the market price was struck (Yahoo regularMarketTime)
// fetchedAt      — when we requested Yahoo
// cacheWrittenAt — when we stored the successful fetch
//
// LIVE        cash session open, quote age < 15m, fresh Yahoo fetch
// CACHED      cash session open, quote age < 15m, served from our cache
// CLOSE       cash session closed; quote is the last completed session's print
// STALE       cash session open and quote age ≥ 15m (feed lagging an open market)
// UNAVAILABLE no quoteAsOf, hardcoded fallback, or a print from before the
//             last completed session
//
// No NYSE holiday calendar: weekdays 9:30–16:00 ET are treated as RTH.

export const PRICE_STATES = ["live", "cached", "close", "stale", "unavailable"];

export const PRICE_THRESHOLDS = {
  liveMaxQuoteAgeMs: 15 * 60 * 1000,
  staleMaxQuoteAgeMs: 18 * 60 * 60 * 1000,
  rthOpenMinutes: 9 * 60 + 30,
  rthCloseMinutes: 16 * 60,
};

const RANK = { live: 0, cached: 1, close: 2, stale: 3, unavailable: 4 };

const WEEKEND = new Set(["Sat", "Sun"]);

export function etClock(ms) {
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
  const get = (t) => parts.find((p) => p.type === t)?.value;
  const hour = Number(get("hour"));
  const minute = Number(get("minute"));
  return {
    weekday: get("weekday"),
    year: Number(get("year")),
    month: Number(get("month")),
    day: Number(get("day")),
    hour,
    minute,
    second: Number(get("second")),
    minutes: hour * 60 + minute,
  };
}

export function etCivilToUtc(year, month, day, hour, minute, second = 0) {
  let guess = Date.UTC(year, month - 1, day, hour + 4, minute, second);
  for (let i = 0; i < 4; i++) {
    const c = etClock(guess);
    const got = Date.UTC(c.year, c.month - 1, c.day, c.hour, c.minute, c.second);
    const want = Date.UTC(year, month - 1, day, hour, minute, second);
    const delta = want - got;
    if (delta === 0) break;
    guess += delta;
  }
  return guess;
}

function addEtDays(year, month, day, deltaDays) {
  const noon = etCivilToUtc(year, month, day, 12, 0);
  return etClock(noon + deltaDays * 86_400_000);
}

function previousWeekday(year, month, day) {
  let y = year;
  let m = month;
  let d = day;
  for (let i = 0; i < 8; i++) {
    const prev = addEtDays(y, m, d, -1);
    y = prev.year;
    m = prev.month;
    d = prev.day;
    if (!WEEKEND.has(prev.weekday)) {
      return { year: y, month: m, day: d, weekday: prev.weekday };
    }
  }
  throw new Error("no previous weekday");
}

export function isCashSessionOpen(now = Date.now()) {
  const c = etClock(now);
  if (WEEKEND.has(c.weekday)) return false;
  return (
    c.minutes >= PRICE_THRESHOLDS.rthOpenMinutes &&
    c.minutes < PRICE_THRESHOLDS.rthCloseMinutes
  );
}

export function lastCompletedSession(now = Date.now()) {
  const c = etClock(now);
  const beforeOpen = c.minutes < PRICE_THRESHOLDS.rthOpenMinutes;
  let y = c.year;
  let m = c.month;
  let d = c.day;
  if (WEEKEND.has(c.weekday) || beforeOpen || isCashSessionOpen(now)) {
    const prev = previousWeekday(y, m, d);
    y = prev.year;
    m = prev.month;
    d = prev.day;
  }
  return {
    openMs: etCivilToUtc(y, m, d, 9, 30),
    closeMs: etCivilToUtc(y, m, d, 16, 0),
  };
}

export function nextCashOpen(now = Date.now()) {
  const c = etClock(now);
  if (!WEEKEND.has(c.weekday) && c.minutes < PRICE_THRESHOLDS.rthOpenMinutes) {
    return etCivilToUtc(c.year, c.month, c.day, 9, 30);
  }
  let y = c.year;
  let m = c.month;
  let d = c.day;
  for (let i = 0; i < 8; i++) {
    const n = addEtDays(y, m, d, 1);
    y = n.year;
    m = n.month;
    d = n.day;
    if (!WEEKEND.has(n.weekday)) {
      return etCivilToUtc(y, m, d, 9, 30);
    }
  }
  throw new Error("no next cash open");
}

export function classifyQuote(
  {
    quoteAsOf,
    servedFromCache = false,
    isFallback = false,
  },
  now = Date.now()
) {
  if (isFallback || !(quoteAsOf > 0)) return "unavailable";
  if (isCashSessionOpen(now)) {
    const age = now - quoteAsOf;
    if (age >= PRICE_THRESHOLDS.liveMaxQuoteAgeMs) return "stale";
    if (servedFromCache) return "cached";
    return "live";
  }
  const session = lastCompletedSession(now);
  const nextOpen = nextCashOpen(now);
  if (quoteAsOf >= session.openMs && quoteAsOf < nextOpen) return "close";
  return "unavailable";
}

export function worstPriceState(states) {
  let worst = "live";
  for (const s of states) {
    if ((RANK[s] ?? 0) > RANK[worst]) worst = s;
  }
  return worst;
}

export function formatQuoteEt(ms) {
  if (!(ms > 0)) return null;
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).formatToParts(new Date(ms));
  const get = (t) => parts.find((p) => p.type === t)?.value;
  return `${get("month")} ${get("day")}, ${get("year")}, ${get("hour")}:${get("minute")} ${get("dayPeriod")} ET`;
}

export function formatQuoteAge(ms, now = Date.now()) {
  if (!(ms > 0)) return null;
  const sec = Math.max(0, Math.round((now - ms) / 1000));
  if (sec < 60) return `${sec}s old`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m old`;
  const hr = Math.floor(min / 60);
  const rem = min % 60;
  if (hr < 48) return rem ? `${hr}h ${rem}m old` : `${hr}h old`;
  const days = Math.floor(hr / 24);
  return `${days}d old`;
}

export function priceChipLabel(state, quoteAsOf) {
  const abs = formatQuoteEt(quoteAsOf);
  if (state === "close") {
    return abs ? `CLOSE · ${abs}` : "CLOSE";
  }
  const head =
    state === "live"
      ? "LIVE"
      : state === "cached"
        ? "CACHED"
        : state === "stale"
          ? "STALE"
          : "UNAVAILABLE";
  if (!abs) return `${head} PRICES`;
  return `${head} · quote ${abs}`;
}

export function priceChipTitle(state, quoteAsOf, now = Date.now()) {
  const age = formatQuoteAge(quoteAsOf, now);
  const abs = formatQuoteEt(quoteAsOf);
  const bits = [`state ${state}`];
  if (abs) bits.push(`struck ${abs}`);
  if (age) bits.push(age);
  return bits.join(" · ");
}

export function pagePriceState(quotes, tickers, now = Date.now()) {
  return worstPriceState(
    tickers.map((ticker) => {
      const q = quotes?.[ticker];
      if (!q) return "unavailable";
      return classifyQuote(
        {
          quoteAsOf: q.quoteAsOf,
          servedFromCache: q.state === "cached",
          isFallback: q.isFallback,
        },
        now
      );
    })
  );
}

export function oldestQuoteAsOf(quotes, tickers) {
  let oldest = null;
  for (const ticker of tickers) {
    const t = quotes?.[ticker]?.quoteAsOf;
    if (t > 0 && (oldest == null || t < oldest)) oldest = t;
  }
  return oldest;
}
