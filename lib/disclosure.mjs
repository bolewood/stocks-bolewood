export const DISCLOSURE_MARKERS = {
  begin: "<!-- BEGIN GENERATED: disclosure -->",
  end: "<!-- END GENERATED: disclosure -->",
};

export const WORKED_EXAMPLE_MARKERS = {
  begin: "<!-- BEGIN GENERATED: worked-example -->",
  end: "<!-- END GENERATED: worked-example -->",
};

export const DISCLOSURE_MAX_AGE_DAYS = 30;

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

export function formatLongDate(iso) {
  const [y, m, d] = String(iso).split("-").map(Number);
  return `${MONTHS[m - 1]} ${d}, ${y}`;
}

export function listTickers(tickers) {
  if (!tickers.length) return "";
  if (tickers.length === 1) return tickers[0];
  if (tickers.length === 2) return `${tickers[0]} and ${tickers[1]}`;
  return `${tickers.slice(0, -1).join(", ")} and ${tickers[tickers.length - 1]}`;
}

export function disclosureSentence(data) {
  return `As of ${formatLongDate(data.asOf)}, the author holds long positions in ${listTickers(data.tickers)}. ${data.notes}`;
}

export function parseIsoDate(iso) {
  const m = String(iso).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  return { year: Number(m[1]), month: Number(m[2]), day: Number(m[3]) };
}

export function disclosureAgeDays(asOf, now = new Date()) {
  const p = parseIsoDate(asOf);
  if (!p) return null;
  const then = Date.UTC(p.year, p.month - 1, p.day);
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((today - then) / 86_400_000);
}

export function disclosureAgeLabel(asOf, now = new Date()) {
  const days = disclosureAgeDays(asOf, now);
  if (days == null) return null;
  if (days < 0) return "dated in the future";
  if (days === 0) return "today";
  if (days === 1) return "1d ago";
  return `${days}d ago`;
}

export function assertDisclosureFresh(
  asOf,
  now = new Date(),
  maxAgeDays = DISCLOSURE_MAX_AGE_DAYS
) {
  const days = disclosureAgeDays(asOf, now);
  if (days == null) {
    throw new Error(`disclosure.asOf is not a valid ISO date: ${asOf}`);
  }
  if (days > maxAgeDays) {
    throw new Error(
      `disclosure.asOf ${asOf} is ${days}d old (max ${maxAgeDays}d)`
    );
  }
}

export function renderReadmeDisclosureSection(data) {
  return `${DISCLOSURE_MARKERS.begin}
${disclosureSentence(data)}
${DISCLOSURE_MARKERS.end}`;
}

export function isHeldTicker(ticker, data) {
  return data.tickers.includes(ticker);
}

export function extractMarkedSection(readme, markers) {
  const start = readme.indexOf(markers.begin);
  const stop = readme.indexOf(markers.end);
  if (start < 0 || stop < 0 || stop < start) return null;
  return readme.slice(start, stop + markers.end.length);
}

export function replaceMarkedSection(readme, markers, nextSection) {
  const existing = extractMarkedSection(readme, markers);
  if (!existing) {
    throw new Error(`README.md is missing ${markers.begin} … ${markers.end}`);
  }
  return readme.replace(existing, nextSection);
}
