#!/usr/bin/env node
// Lists EDGAR filings that are newer than each /book fund's current report,
// so the next /book update picks them up. Read-only; never edits data/.
//
//   node scripts/check-book-filings.mjs
//
// CIKs come from each book's `pendingFiling.cik` or its SEC source URLs.
// EDGAR asks scripted clients for a descriptive User-Agent; set
// EDGAR_USER_AGENT to override the generic default.
import { loadBookSnapshots } from "../lib/loadBooks.mjs";
import { defaultSnapshot, fundSeries, orderedTickers } from "../lib/reportedBook.mjs";

const UA = process.env.EDGAR_USER_AGENT || "stocks-bolewood-research admin@example.org";
const FORMS = new Set(["NPORT-P", "N-CSR", "N-CSRS", "10-Q", "10-K", "N-CSR/A", "NPORT-P/A"]);

function cikOf(snapshot) {
  if (snapshot.pendingFiling?.cik) return snapshot.pendingFiling.cik;
  for (const src of snapshot.sources || []) {
    const match = /sec\.gov\/Archives\/edgar\/data\/(\d+)\//.exec(src.url || "");
    if (match) return match[1];
  }
  return null;
}

async function submissions(cik) {
  const url = `https://data.sec.gov/submissions/CIK${cik.padStart(10, "0")}.json`;
  const res = await fetch(url, { headers: { "User-Agent": UA, Accept: "application/json" } });
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  return res.json();
}

const snapshots = loadBookSnapshots();
let pending = 0;
for (const ticker of orderedTickers(snapshots)) {
  const current = defaultSnapshot(fundSeries(snapshots, ticker));
  const cik = cikOf(current);
  const asOf = current.navAsOf || current.measurementDate;
  if (!cik) {
    console.log(`${ticker.padEnd(6)} ${asOf}  no SEC CIK on file (${current.sourceLabel || "non-SEC source"}); check by hand`);
    continue;
  }
  try {
    const data = await submissions(cik);
    const recent = data.filings?.recent || {};
    const newer = [];
    for (let i = 0; i < (recent.form || []).length; i++) {
      const form = recent.form[i];
      const period = recent.reportDate[i];
      if (FORMS.has(form) && period && period > current.measurementDate) {
        newer.push(`${form} for ${period} (filed ${recent.filingDate[i]}, ${recent.accessionNumber[i]})`);
      }
    }
    const due = current.pendingFiling ? ` · expected ${current.pendingFiling.form} for ${current.pendingFiling.periodEnd} by ${current.pendingFiling.dueBy}` : "";
    if (newer.length) {
      pending += 1;
      console.log(`${ticker.padEnd(6)} ${asOf}  NEW: ${newer.join("; ")}`);
    } else {
      console.log(`${ticker.padEnd(6)} ${asOf}  up to date with EDGAR (CIK ${cik})${due}`);
    }
  } catch (error) {
    console.log(`${ticker.padEnd(6)} ${asOf}  EDGAR lookup failed: ${error.message}`);
  }
  await new Promise((resolve) => setTimeout(resolve, 150));
}
if (pending) console.log(`\n${pending} fund(s) have a newer filing than /book shows.`);
