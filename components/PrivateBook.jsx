"use client";

import { Fragment, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import {
  basketLookThrough,
  bookCsv,
  companyName,
  diffBooks,
  fundPremium,
  fundSeries,
  navPer100OfPrice,
  orderedTickers,
  parseBookSearch,
  positionMetrics,
  positionsByCompany,
  priorInSeries,
  serializeBookSearch,
  sortBookRows,
} from "../lib/reportedBook.mjs";
import {
  chipQuoteAsOf,
  pagePriceState,
  priceChipLabel,
  priceChipTitle,
} from "../lib/priceState.mjs";
import { startJsonPoll } from "../lib/pollLivePrices.mjs";

const CALCULATORS = { DXYZ: "/dxyz", VCX: "/vcx" };
const ROLE_RANK = { holding: 0, other: 1, cash: 2, liability: 3, residual: 4 };
const ROLE_LABEL = {
  holding: "Companies",
  other: "Other assets",
  cash: "Cash",
  liability: "Liabilities",
  residual: "Residual",
};
const VIEWS = [
  { id: "nav", label: "% of NAV" },
  { id: "price", label: "% of price" },
  { id: "per100", label: "$ per $100" },
];

function quotedPrice(quote) {
  if (!quote || quote.isFallback || quote.state === "unavailable") return null;
  return quote.price > 0 ? quote.price : null;
}

function formatDate(iso) {
  if (!iso) return "";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${iso}T00:00:00Z`));
}

function formatWeight(weight) {
  if (weight == null || !Number.isFinite(weight)) return "—";
  const pct = weight * 100;
  const sign = pct < 0 ? "-" : "";
  const abs = Math.abs(pct);
  if (abs === 0) return "0.00%";
  if (abs < 0.005) return `${sign}<0.01%`;
  return `${sign}${abs.toFixed(2)}%`;
}

function formatPremium(premium) {
  if (premium == null || !Number.isFinite(premium)) return "—";
  const pct = premium * 100;
  const sign = pct > 0 ? "+" : "";
  return `${sign}${pct.toFixed(1)}%`;
}

function formatUsd(value, digits = 2) {
  if (value == null || !Number.isFinite(value)) return "—";
  return value.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

function formatCompact(value) {
  if (value == null || !Number.isFinite(value)) return "—";
  const sign = value < 0 ? "-" : "";
  const abs = Math.abs(value);
  if (abs >= 1e9) return `${sign}$${(abs / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `${sign}$${(abs / 1e6).toFixed(1)}M`;
  if (abs >= 1e3) return `${sign}$${(abs / 1e3).toFixed(1)}K`;
  return formatUsd(value, 0);
}

function formatPer100(value) {
  if (value == null || !Number.isFinite(value)) return "—";
  const sign = value < 0 ? "-" : "";
  const abs = Math.abs(value);
  if (abs === 0) return "$0.00";
  if (abs < 0.005) return `${sign}<$0.01`;
  return `${sign}$${abs.toFixed(2)}`;
}

function shownNavWeight(metrics) {
  return metrics.weightOfNav ?? metrics.reportedPortfolioWeight ?? null;
}

function cellText(view, metrics) {
  if (view === "nav") return formatWeight(shownNavWeight(metrics));
  if (view === "price") return formatWeight(metrics.weightOfPrice);
  return formatPer100(metrics.per100);
}

function subscribeToBookUrl(callback) {
  window.addEventListener("popstate", callback);
  window.addEventListener("book-url", callback);
  return () => {
    window.removeEventListener("popstate", callback);
    window.removeEventListener("book-url", callback);
  };
}

function writeBookUrl(search) {
  const next = `${window.location.pathname}${search}`;
  const current = `${window.location.pathname}${window.location.search}`;
  if (next === current) return;
  history.replaceState(null, "", next);
  window.dispatchEvent(new Event("book-url"));
}

function ariaSort(key, sort, dir) {
  if (sort !== key) return "none";
  return dir === "asc" ? "ascending" : "descending";
}

function SortMark({ active, dir }) {
  return (
    <span style={{ ...styles.sortMark, opacity: active ? 1 : 0.35 }} aria-hidden="true">
      {active && dir === "desc" ? "↓" : "↑"}
    </span>
  );
}

function roleFor(id, funds) {
  const roles = funds
    .map((fund) => fund.positions.get(id)?.role)
    .filter(Boolean)
    .sort((a, b) => ROLE_RANK[a] - ROLE_RANK[b]);
  return roles[0] || "holding";
}

export default function PrivateBook({ companyMap, snapshots, disclosure }) {
  const tickers = useMemo(() => orderedTickers(snapshots), [snapshots]);
  const search = useSyncExternalStore(subscribeToBookUrl, () => window.location.search, () => "");
  const parsed = useMemo(() => parseBookSearch(search, { tickers }), [search, tickers]);
  const { view, dates, focus, sort, dir } = parsed;
  const [basket, setBasket] = useState({});
  const [quotes, setQuotes] = useState({});
  const [copied, setCopied] = useState(false);

  const replaceBook = (patch) => {
    writeBookUrl(
      serializeBookSearch({
        view: patch.view ?? view,
        focus: patch.focus === undefined ? focus : patch.focus,
        dates: patch.dates ?? dates,
        sort: patch.sort ?? sort,
        dir: patch.dir ?? dir,
      })
    );
  };

  const toggleSort = (key) => {
    if (sort === key) {
      replaceBook({ sort: key, dir: dir === "asc" ? "desc" : "asc" });
      return;
    }
    replaceBook({ sort: key, dir: key === "name" ? "asc" : "desc" });
  };

  useEffect(
    () =>
      startJsonPoll("/api/book-prices", {
        onData: (data) => {
          if (data.quotes) setQuotes(data.quotes);
        },
      }),
    []
  );

  const funds = useMemo(() => {
    return tickers.map((ticker) => {
      const series = fundSeries(snapshots, ticker);
      const snapshot =
        series.find((item) => item.measurementDate === dates[ticker]) || series.at(-1);
      const quote = quotes[snapshot.yahooSymbol];
      const price = quotedPrice(quote);
      return {
        ticker,
        series,
        snapshot,
        quote,
        price,
        positions: positionsByCompany(snapshot, companyMap),
        prior: priorInSeries(series, snapshot),
      };
    });
  }, [tickers, snapshots, dates, quotes, companyMap]);

  const rows = useMemo(() => {
    const ids = new Set(funds.flatMap((fund) => [...fund.positions.keys()]));
    const built = [...ids].map((id) => ({
      id,
      name: companyName(id, companyMap),
      note: companyMap[id]?.note || "",
      role: roleFor(id, funds),
    }));
    const sorted = sortBookRows(built, { key: sort, dir, view, funds });
    return sorted.map((row, index) => ({
      ...row,
      divider: index === 0 || row.role !== sorted[index - 1].role,
    }));
  }, [funds, companyMap, sort, dir, view]);

  const quoteTickers = funds.map((fund) => fund.snapshot.yahooSymbol);
  const quoteState = pagePriceState(quotes, quoteTickers);
  const quoteAsOf = chipQuoteAsOf(quoteState, quotes, quoteTickers);
  const pricesLoaded = Object.keys(quotes).length > 0;

  const focused = focus && rows.some((row) => row.id === focus) ? focus : null;
  const focusRows = focused
    ? funds
        .map((fund) => {
          const position = fund.positions.get(focused);
          return {
            fund,
            position,
            metrics: positionMetrics(position, fund.snapshot, fund.price),
          };
        })
        .sort((a, b) => (b.metrics.per100 ?? -Infinity) - (a.metrics.per100 ?? -Infinity))
    : [];

  const basketResult = basketLookThrough(
    funds.map((fund) => ({
      snapshot: fund.snapshot,
      dollars: Number(basket[fund.ticker]) || 0,
      price: fund.price,
    })),
    companyMap
  );
  const dollarsSpent = funds.reduce((sum, fund) => sum + (Number(basket[fund.ticker]) || 0), 0);

  const copyLink = async () => {
    const url = `${window.location.origin}${window.location.pathname}${serializeBookSearch({ view, focus, dates, sort, dir })}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  };

  const downloadCsv = () => {
    const records = [];
    for (const row of rows) {
      for (const fund of funds) {
        const position = fund.positions.get(row.id);
        const metrics = positionMetrics(position, fund.snapshot, fund.price);
        records.push({
          company: row.name,
          companyId: row.id,
          ticker: fund.ticker,
          measurementDate: fund.snapshot.measurementDate,
          navAsOf: fund.snapshot.navAsOf || fund.snapshot.measurementDate,
          weightBasis: fund.snapshot.weightBasis,
          fairValue: position?.fairValue ?? "",
          weightOfNav: metrics.weightOfNav ?? "",
          price: fund.price ?? "",
          reportedNav: fund.snapshot.navPerShare,
          weightOfPrice: metrics.weightOfPrice ?? "",
          reportedFairValuePer100: metrics.per100 ?? "",
        });
      }
    }
    const blob = new Blob([bookCsv(records)], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "private-book.csv";
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <main style={styles.main} className="book-page">
      <div style={styles.eyebrow} className="book-eyebrow">
        BOLEWOOD GROUP · REPORTED BOOK
      </div>
      <h1 style={styles.title} className="book-title">
        Private Book
      </h1>
      <p style={styles.subtitle}>
        Reported fair value per $100 of market price. Each column is the last
        published holdings report and that report&apos;s NAV. The share price
        is the only number that moves between reports.
      </p>
      <p style={styles.disclosure}>{disclosure}</p>

      <div style={styles.toolbar}>
        <div style={styles.viewToggle} role="group" aria-label="Cell value">
          {VIEWS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => replaceBook({ view: item.id })}
              style={{ ...styles.viewBtn, ...(view === item.id ? styles.viewBtnOn : {}) }}
            >
              {item.label}
            </button>
          ))}
        </div>
        <div style={styles.toolbarActions}>
          {pricesLoaded ? (
            <span style={styles.chip} title={priceChipTitle(quoteState, quoteAsOf)}>
              {priceChipLabel(quoteState, quoteAsOf)}
            </span>
          ) : (
            <span style={styles.chip}>PRICES…</span>
          )}
          <button type="button" onClick={copyLink} style={styles.textBtn}>
            {copied ? "Copied" : "Copy link"}
          </button>
          <button type="button" onClick={downloadCsv} style={styles.textBtn}>
            Export CSV
          </button>
        </div>
      </div>
      <p style={styles.caption}>
        {view === "per100"
          ? "Dollars of that company's reported fair value in $100 of the fund's stock. Equal to the NAV weight times reported NAV, divided by the price."
          : view === "price"
            ? "Share of today's market price. Equal to the NAV weight times reported NAV, divided by the price."
            : "Reported fair value divided by that report's net assets. Cash, liabilities, and the residual stay in the column. Weights are not rescaled to 100."}
      </p>

      <div className="book-cards">
        {funds.map((fund) => (
          <FundCard
            key={fund.ticker}
            fund={fund}
            onSelectDate={(measurementDate) =>
              replaceBook({ dates: { ...dates, [fund.ticker]: measurementDate } })
            }
          />
        ))}
      </div>

      <div style={styles.scroll} className="book-scroll">
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.companyHead} aria-sort={ariaSort("name", sort, dir)}>
                <button
                  type="button"
                  onClick={() => toggleSort("name")}
                  style={styles.sortBtn}
                >
                  Company
                  <SortMark active={sort === "name"} dir={dir} />
                </button>
              </th>
              {funds.map((fund) => (
                <th key={fund.ticker} style={styles.viewHead} aria-sort={ariaSort(fund.ticker, sort, dir)}>
                  <button
                    type="button"
                    onClick={() => toggleSort(fund.ticker)}
                    style={{ ...styles.sortBtn, ...styles.sortBtnRight }}
                  >
                    <span>{fund.ticker}</span>
                    <span style={styles.sortView}>
                      {VIEWS.find((item) => item.id === view)?.label}
                      <SortMark active={sort === fund.ticker} dir={dir} />
                    </span>
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const selected = row.id === focused;
              return (
                <Fragment key={row.id}>
                  {row.divider ? (
                    <tr>
                      <td colSpan={1 + funds.length} style={styles.section}>
                        {ROLE_LABEL[row.role]}
                      </td>
                    </tr>
                  ) : null}
                  <tr style={selected ? styles.rowOn : undefined}>
                    <th scope="row" style={{ ...styles.companyCell, ...(selected ? styles.stickyOn : {}) }}>
                      <button
                        type="button"
                        onClick={() => replaceBook({ focus: selected ? null : row.id })}
                        style={styles.companyBtn}
                      >
                        {row.name}
                      </button>
                    </th>
                    {funds.map((fund) => {
                      const position = fund.positions.get(row.id);
                      const metrics = positionMetrics(position, fund.snapshot, fund.price);
                      const missing = !position;
                      return (
                        <td
                          key={fund.ticker}
                          style={{
                            ...styles.valueCell,
                            background: selected ? "#fffbeb" : missing ? "transparent" : "#fff",
                          }}
                          title={missing ? `${row.name} is not in the ${fund.ticker} report` : undefined}
                        >
                          <div style={missing ? styles.valueMainMissing : styles.valueMain}>
                            {missing ? "—" : cellText(view, metrics)}
                          </div>
                          {view === "per100" && position && shownNavWeight(metrics) != null ? (
                            <div style={styles.valueSub}>
                              {formatWeight(shownNavWeight(metrics))}{" "}
                              {metrics.weightOfNav != null ? "of NAV" : "of reported portfolio"}
                            </div>
                          ) : null}
                        </td>
                      );
                    })}
                  </tr>
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      <section style={styles.panel}>
        <h2 style={styles.panelTitle}>
          {focused ? companyName(focused, companyMap) : "Select a company"}
        </h2>
        {focused ? (
          <>
            {companyMap[focused]?.note ? (
              <p style={styles.caption}>{companyMap[focused].note}</p>
            ) : null}
            <div style={styles.rankList}>
              {focusRows.map(({ fund, position, metrics }) => (
                <div key={fund.ticker} style={styles.rankRow}>
                  <div style={styles.rankTicker}>{fund.ticker}</div>
                  {position ? (
                    <div>
                      <div style={styles.rankMain}>
                        {formatPer100(metrics.per100)} per $100
                        <span style={styles.rankMeta}> · {formatWeight(metrics.weightOfNav)} of NAV</span>
                      </div>
                      {metrics.per100 > 0 ? (
                        <div style={styles.rankMeta}>
                          ${ (100 / metrics.per100).toFixed(2) } of market price per $1 of this reported fair value
                        </div>
                      ) : null}
                      <ul style={styles.lots}>
                        {position.lines.map((line, index) => (
                          <li key={`${line.label || line.companyId}-${index}`}>
                            <span style={styles.lotValue}>{formatCompact(line.fairValue)}</span>
                            {line.label ? ` ${line.label}` : ""}
                            {line.valuation === "cost" ? " · at cost" : ""}
                            {line.valuation === "practical-expedient" ? " · practical expedient" : ""}
                            {line.note ? <span style={styles.lotNote}>{line.note}</span> : null}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : (
                    <div style={styles.rankMeta}>Not in this report</div>
                  )}
                </div>
              ))}
            </div>
          </>
        ) : (
          <p style={styles.caption}>
            Choose a row to rank the funds by reported fair value per $100 of market price and to read the underlying lines.
          </p>
        )}
      </section>

      {funds.map((fund) =>
        fund.prior ? (
          <DiffPanel key={fund.ticker} fund={fund} companies={companyMap} />
        ) : (
          <p key={fund.ticker} style={styles.caption}>
            {fund.series.length > 1
              ? `${fund.ticker} is showing its earliest report, ${formatDate(fund.snapshot.measurementDate)}. The current book is ${formatDate(fund.series.at(-1).measurementDate)}.`
              : `${fund.ticker} has one report in this book, ${formatDate(fund.snapshot.measurementDate)}.`}
          </p>
        )
      )}

      <section style={styles.panel}>
        <h2 style={styles.panelTitle}>Basket</h2>
        <p style={styles.caption}>
          Dollars invested at today&apos;s price. The result is reported fair value, summed with the same weights as the table.
        </p>
        <div style={styles.basketInputs}>
          {funds.map((fund) => (
            <label key={fund.ticker} style={styles.basketLabel}>
              {fund.ticker} dollars
              <input
                inputMode="decimal"
                value={basket[fund.ticker] ?? ""}
                onChange={(event) =>
                  setBasket((prev) => ({ ...prev, [fund.ticker]: event.target.value }))
                }
                style={styles.input}
              />
            </label>
          ))}
        </div>
        {dollarsSpent > 0 ? (
          <>
            <p style={styles.caption}>
              {formatUsd(dollarsSpent, 0)} spent
              {basketResult.skipped.length === 0
                ? ` buys ${formatUsd(basketResult.rows.reduce((sum, row) => sum + row.total, 0), 0)} of reported net assets.`
                : `. ${basketResult.skipped.join(", ")} is waiting on a live price, so that fund is left out of the sum.`}
            </p>
            <ul style={styles.lots}>
              {basketResult.rows
                .filter((row) => Math.abs(row.total) >= 0.5)
                .map((row) => (
                  <li key={row.companyId}>
                    <span style={styles.lotValue}>{formatCompact(row.total)}</span> {row.name}
                  </li>
                ))}
            </ul>
          </>
        ) : null}
      </section>
    </main>
  );
}

function FundCard({ fund, onSelectDate }) {
  const { snapshot, price, positions, series } = fund;
  const atNav = snapshot.premiumMode === "none" && snapshot.weightBasis === "net-assets";
  const portfolioMix = snapshot.weightBasis === "reported-portfolio";
  const premium = fundPremium(snapshot, price);
  const navSlice = atNav ? 100 : navPer100OfPrice(snapshot.navPerShare, price);
  const weightSum = [...positions.values()].reduce((sum, position) => sum + (position.weight || 0), 0);
  const navDate = snapshot.navAsOf || snapshot.measurementDate;
  const sumLabel = portfolioMix ? "the reported portfolio" : "net assets";
  return (
    <div style={styles.card}>
      <div style={styles.cardTop}>
        {CALCULATORS[fund.ticker] ? (
          <Link href={CALCULATORS[fund.ticker]} style={styles.cardTicker}>
            {fund.ticker}
          </Link>
        ) : (
          <span style={styles.cardTicker}>{fund.ticker}</span>
        )}
        <span style={styles.cardName}>{snapshot.name}</span>
      </div>
      {series.length > 1 ? (
        <div style={styles.dateToggle} role="group" aria-label={`${fund.ticker} report`}>
          {series.map((item) => (
            <button
              key={item.accession || item.sourceId}
              type="button"
              onClick={() => onSelectDate(item.measurementDate)}
              style={{
                ...styles.dateBtn,
                ...((item.accession || item.sourceId) === (snapshot.accession || snapshot.sourceId) ? styles.dateBtnOn : {}),
              }}
            >
              {formatDate(item.measurementDate)}
            </button>
          ))}
        </div>
      ) : null}
      <dl style={styles.facts}>
        <div style={styles.fact}>
          <dt style={styles.dt}>Holdings</dt>
          <dd style={styles.dd}>{formatDate(snapshot.measurementDate)}</dd>
        </div>
        <div style={styles.fact}>
          <dt style={styles.dt}>Reported NAV</dt>
          <dd style={styles.dd}>
            {atNav ? "At NAV" : portfolioMix ? "—" : formatUsd(snapshot.navPerShare)}
            {!atNav && !portfolioMix && navDate !== snapshot.measurementDate ? ` · ${formatDate(navDate)}` : ""}
          </dd>
        </div>
        <div style={styles.fact}>
          <dt style={styles.dt}>Price</dt>
          <dd style={styles.dd}>{formatUsd(price)}</dd>
        </div>
        <div style={styles.fact}>
          <dt style={styles.dt}>Premium</dt>
          <dd style={styles.dd}>{atNav || portfolioMix ? "n/a" : formatPremium(premium)}</dd>
        </div>
        <div style={styles.fact}>
          <dt style={styles.dt}>NAV / $100</dt>
          <dd style={styles.dd}>{portfolioMix ? "—" : formatPer100(navSlice)}</dd>
        </div>
      </dl>
      {snapshot.unknownDilution ? <p style={styles.warn}>{snapshot.dilutionNote}</p> : null}
      <details>
        <summary style={{ ...styles.cardSum, cursor: "pointer" }}>How this column was built</summary>
        <p style={styles.cardNote}>{snapshot.note}</p>
      </details>
      <p style={styles.cardSum}>Lines sum to {formatWeight(weightSum)} of {sumLabel}.</p>
    </div>
  );
}

function DiffPanel({ fund, companies }) {
  const diff = diffBooks(fund.prior, fund.snapshot, {
    price: fund.price,
    companies,
  });
  return (
    <section style={styles.panel}>
      <h2 style={styles.panelTitle}>
        {fund.ticker} from {formatDate(fund.prior.measurementDate)} to {formatDate(fund.snapshot.measurementDate)}
      </h2>
      {diff.comparable ? (
        <>
          <p style={styles.caption}>
            Reported NAV per share {formatUsd(diff.navPerShare.previous)} to {formatUsd(diff.navPerShare.next)}.
            {diff.premiumAtPrice
              ? ` At today's price the premium is ${formatPremium(diff.premiumAtPrice.previous)} on the earlier NAV and ${formatPremium(diff.premiumAtPrice.next)} on the later one.`
              : " Today's price is unavailable, so the premium bridge is blank."}
          </p>
          <DiffList title="Added" rows={diff.added} />
          <DiffList title="Removed" rows={diff.removed} />
          {diff.changed.length > 0 ? (
            <>
              <h3 style={styles.diffLabel}>Weight changes</h3>
              <ul style={styles.lots}>
                {diff.changed.slice(0, 8).map((row) => (
                  <li key={row.companyId}>
                    {row.name}: {formatWeight(row.previousWeight)} to {formatWeight(row.weight)}
                    {" · "}
                    {formatCompact(row.previousFairValue)} to {formatCompact(row.fairValue)}
                  </li>
                ))}
              </ul>
            </>
          ) : null}
        </>
      ) : (
        <p style={styles.caption}>
          These reports do not share a net-assets denominator, so the change in positions is not listed as buys and sells.
        </p>
      )}
    </section>
  );
}

function DiffList({ title, rows }) {
  if (!rows?.length) return null;
  return (
    <>
      <h3 style={styles.diffLabel}>{title}</h3>
      <ul style={styles.lots}>
        {rows.map((row) => (
          <li key={row.companyId}>
            {row.name}: {formatCompact(row.fairValue)} · {formatWeight(row.weight)}
            {row.lines?.find((line) => line.note)?.note ? (
              <span style={styles.lotNote}>{row.lines.find((line) => line.note).note}</span>
            ) : null}
          </li>
        ))}
      </ul>
    </>
  );
}

const styles = {
  main: { maxWidth: 1180, margin: "0 auto", padding: "48px 56px 80px" },
  eyebrow: {
    fontFamily: "var(--font-mono), monospace",
    fontSize: 11,
    letterSpacing: "0.18em",
    color: "#78716c",
    marginBottom: 16,
  },
  title: {
    fontSize: 56,
    lineHeight: 1.02,
    fontWeight: 800,
    letterSpacing: "-0.03em",
    margin: "0 0 16px",
  },
  subtitle: { fontSize: 18, lineHeight: 1.45, maxWidth: 720, margin: "0 0 12px" },
  disclosure: { fontSize: 13, color: "#78716c", maxWidth: 720, marginBottom: 28 },
  toolbar: {
    display: "flex",
    justifyContent: "space-between",
    gap: 16,
    alignItems: "center",
    flexWrap: "wrap",
    marginBottom: 8,
  },
  toolbarActions: { display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" },
  viewToggle: { display: "flex", gap: 8 },
  viewBtn: {
    fontFamily: "var(--font-mono), monospace",
    fontSize: 12,
    letterSpacing: "0.06em",
    textTransform: "uppercase",
    border: "1px solid #e7e5e4",
    background: "transparent",
    color: "#44403c",
    borderRadius: 999,
    padding: "8px 12px",
    cursor: "pointer",
  },
  viewBtnOn: { background: "#1c1917", color: "#fef3c7", border: "1px solid #1c1917" },
  textBtn: {
    fontFamily: "var(--font-mono), monospace",
    fontSize: 12,
    letterSpacing: "0.04em",
    background: "transparent",
    border: "none",
    color: "#d97706",
    cursor: "pointer",
    padding: "8px 0",
  },
  chip: {
    fontFamily: "var(--font-mono), monospace",
    fontSize: 11,
    letterSpacing: "0.06em",
    color: "#44403c",
    border: "1px solid #e7e5e4",
    borderRadius: 999,
    padding: "6px 10px",
  },
  caption: { fontSize: 13, lineHeight: 1.5, color: "#57534e", margin: "8px 0 16px", maxWidth: 760 },
  scroll: { overflowX: "auto", marginBottom: 28 },
  table: { width: "100%", minWidth: 1280, borderCollapse: "collapse" },
  corner: { width: 200 },
  cardHead: {
    textAlign: "left",
    verticalAlign: "top",
    fontWeight: 500,
    padding: "0 12px 16px 0",
  },
  companyHead: {
    textAlign: "left",
    fontFamily: "var(--font-mono), monospace",
    fontSize: 11,
    letterSpacing: "0.12em",
    textTransform: "uppercase",
    color: "#78716c",
    padding: "8px 12px 8px 0",
    borderBottom: "1px solid #e7e5e4",
    position: "sticky",
    left: 0,
    background: "#fefdf8",
  },
  viewHead: {
    textAlign: "right",
    fontFamily: "var(--font-mono), monospace",
    fontSize: 11,
    letterSpacing: "0.12em",
    textTransform: "uppercase",
    color: "#78716c",
    padding: "8px 0",
    borderBottom: "1px solid #e7e5e4",
  },
  sortBtn: {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    background: "transparent",
    border: "none",
    padding: 0,
    cursor: "pointer",
    font: "inherit",
    letterSpacing: "inherit",
    textTransform: "inherit",
    color: "inherit",
  },
  sortBtnRight: {
    width: "100%",
    flexDirection: "column",
    alignItems: "flex-end",
    gap: 2,
  },
  sortView: {
    display: "inline-flex",
    alignItems: "center",
    gap: 4,
    color: "#a8a29e",
  },
  sortMark: { fontSize: 10 },
  section: {
    padding: "18px 0 6px",
    fontFamily: "var(--font-mono), monospace",
    fontSize: 11,
    letterSpacing: "0.14em",
    textTransform: "uppercase",
    color: "#a8a29e",
  },
  rowOn: { background: "#fffbeb" },
  companyCell: {
    textAlign: "left",
    padding: "8px 12px 8px 0",
    borderBottom: "1px solid #f5f5f4",
    position: "sticky",
    left: 0,
    background: "#fefdf8",
  },
  stickyOn: { background: "#fffbeb" },
  companyBtn: {
    background: "transparent",
    border: "none",
    padding: 0,
    cursor: "pointer",
    font: "inherit",
    color: "#1c1917",
    textAlign: "left",
  },
  valueCell: {
    textAlign: "right",
    padding: "8px 8px",
    borderBottom: "1px solid #f5f5f4",
    fontFamily: "var(--font-mono), monospace",
    fontVariantNumeric: "tabular-nums",
  },
  valueHeld: { background: "#fff" },
  valueMissing: { background: "transparent" },
  valueMain: { fontSize: 14, fontWeight: 700, color: "#1c1917" },
  valueMainMissing: { fontSize: 14, fontWeight: 400, color: "#d6d3d1" },
  valueSub: { fontSize: 11, fontWeight: 500, color: "#78716c", marginTop: 2 },
  card: {
    border: "1px solid #e7e5e4",
    borderRadius: 12,
    padding: 14,
    background: "#fff",
    minWidth: 240,
  },
  cardTop: { display: "flex", justifyContent: "space-between", gap: 8, alignItems: "baseline" },
  cardTicker: {
    fontFamily: "var(--font-mono), monospace",
    fontSize: 18,
    fontWeight: 700,
    color: "#d97706",
    letterSpacing: "0.04em",
  },
  cardName: { fontSize: 13, color: "#57534e" },
  dateToggle: { display: "flex", gap: 6, marginTop: 10, flexWrap: "wrap" },
  dateBtn: {
    fontFamily: "var(--font-mono), monospace",
    fontSize: 11,
    border: "1px solid #e7e5e4",
    background: "transparent",
    borderRadius: 999,
    padding: "4px 8px",
    cursor: "pointer",
    color: "#44403c",
  },
  dateBtnOn: { background: "#1c1917", color: "#fef3c7", border: "1px solid #1c1917" },
  facts: { display: "grid", gap: 8, margin: "12px 0" },
  fact: { display: "flex", justifyContent: "space-between", gap: 12, alignItems: "baseline" },
  dt: {
    fontFamily: "var(--font-mono), monospace",
    fontSize: 10,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    color: "#a8a29e",
  },
  dd: {
    margin: 0,
    fontFamily: "var(--font-mono), monospace",
    fontSize: 12,
    textAlign: "right",
  },
  cardNote: { fontSize: 12, lineHeight: 1.45, color: "#57534e", margin: "8px 0 0" },
  cardSum: {
    display: "block",
    fontFamily: "var(--font-mono), monospace",
    fontSize: 11,
    color: "#78716c",
    margin: "10px 0 0",
  },
  warn: {
    fontSize: 12,
    lineHeight: 1.45,
    color: "#92400e",
    background: "#fffbeb",
    borderRadius: 8,
    padding: "8px 10px",
    margin: "8px 0",
  },
  panel: {
    borderTop: "1px solid #e7e5e4",
    paddingTop: 20,
    marginTop: 8,
  },
  panelTitle: { fontSize: 22, margin: "0 0 8px" },
  rankList: { display: "grid", gap: 14 },
  rankRow: { display: "grid", gridTemplateColumns: "72px 1fr", gap: 12 },
  rankTicker: {
    fontFamily: "var(--font-mono), monospace",
    fontWeight: 700,
    color: "#d97706",
  },
  rankMain: { fontFamily: "var(--font-mono), monospace", fontSize: 16 },
  rankMeta: { fontSize: 13, color: "#57534e", marginTop: 2 },
  lots: { listStyle: "none", padding: 0, margin: "8px 0 0" },
  lotValue: { fontFamily: "var(--font-mono), monospace" },
  lotNote: { display: "block", color: "#78716c", fontSize: 12, lineHeight: 1.4, marginTop: 2 },
  diffLabel: {
    fontFamily: "var(--font-mono), monospace",
    fontSize: 11,
    letterSpacing: "0.12em",
    textTransform: "uppercase",
    color: "#78716c",
    margin: "12px 0 0",
  },
  basketInputs: { display: "flex", gap: 16, flexWrap: "wrap" },
  basketLabel: {
    display: "grid",
    gap: 6,
    fontFamily: "var(--font-mono), monospace",
    fontSize: 11,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    color: "#78716c",
  },
  input: {
    font: "inherit",
    fontSize: 16,
    letterSpacing: 0,
    textTransform: "none",
    color: "#1c1917",
    border: "1px solid #e7e5e4",
    borderRadius: 8,
    padding: "8px 10px",
    width: 160,
    background: "#fff",
  },
};
