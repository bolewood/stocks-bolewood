export const DISCLOSURE_MARKERS = {
  begin: "<!-- BEGIN GENERATED DISCLOSURE -->",
  end: "<!-- END GENERATED DISCLOSURE -->",
};

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

export function disclosureBannerText(data) {
  return `Disclosure: ${disclosureSentence(data)}`;
}

export function renderReadmeDisclosureSection(data) {
  return `${DISCLOSURE_MARKERS.begin}
## Author positions

**Disclosure:** ${disclosureSentence(data)}
${DISCLOSURE_MARKERS.end}`;
}

export function isHeldTicker(ticker, data) {
  return data.tickers.includes(ticker);
}

export function extractReadmeDisclosureSection(readme) {
  const { begin, end } = DISCLOSURE_MARKERS;
  const start = readme.indexOf(begin);
  const stop = readme.indexOf(end);
  if (start < 0 || stop < 0 || stop < start) return null;
  return readme.slice(start, stop + end.length);
}
