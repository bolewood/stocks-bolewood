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
  { id: "per100", label: "$ per $100" },
  { id: "nav", label: "% of NAV" },
  { id: "price", label: "% of price" },
];

const VIEW_CAPTIONS = {
  per100:
    "Dollars of that company's reported fair value per $100 of the fund's market price (NAV weight × NAV ÷ Price). Each cell also displays the underlying % of NAV.",
  nav: "Reported fair value divided by that report's net assets. Reflects underlying book weights without adjusting for market premium or discount. Weights are not rescaled.",
  price:
    "Share of today's market price. Mathematically identical to $ per $100 expressed as a percentage (NAV weight × NAV ÷ Price).",
};

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
    <span
      style={{
        ...styles.sortMark,
        opacity: active ? 1 : 0.35,
        color: active ? "#d97706" : "inherit",
        fontWeight: active ? 700 : 400,
      }}
      aria-hidden="true"
    >
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
  const { view, dates, focus, sort, dir, q, overlap, basket: initialBasket } = parsed;

  const [searchQuery, setSearchQuery] = useState(q || "");
  const [overlappingOnly, setOverlappingOnly] = useState(overlap || false);
  const [basket, setBasket] = useState(() => initialBasket || {});
  const [showCards, setShowCards] = useState(false);
  const [quotes, setQuotes] = useState({});
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setSearchQuery(q || "");
  }, [q]);

  useEffect(() => {
    setOverlappingOnly(overlap || false);
  }, [overlap]);

  useEffect(() => {
    if (initialBasket && Object.keys(initialBasket).length > 0) {
      setBasket(initialBasket);
    }
  }, [initialBasket]);

  const replaceBook = (patch) => {
    writeBookUrl(
      serializeBookSearch({
        view: patch.view ?? view,
        focus: patch.focus === undefined ? focus : patch.focus,
        dates: patch.dates ?? dates,
        sort: patch.sort ?? sort,
        dir: patch.dir ?? dir,
        q: patch.q !== undefined ? patch.q : searchQuery,
        overlap: patch.overlap !== undefined ? patch.overlap : overlappingOnly,
        basket: patch.basket ?? basket,
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
    return sortBookRows(built, { key: sort, dir, view, funds });
  }, [funds, companyMap, sort, dir, view]);

  const overlappingCount = useMemo(() => {
    let count = 0;
    for (const row of rows) {
      const heldCount = funds.filter((fund) => fund.positions.has(row.id)).length;
      if (heldCount >= 2) count++;
    }
    return count;
  }, [rows, funds]);

  const filteredRows = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return rows.filter((row) => {
      if (overlappingOnly) {
        const heldCount = funds.filter((fund) => fund.positions.has(row.id)).length;
        if (heldCount < 2) return false;
      }
      if (query) {
        const matchName = row.name.toLowerCase().includes(query);
        const matchId = row.id.toLowerCase().includes(query);
        const matchNote = (row.note || "").toLowerCase().includes(query);
        if (!matchName && !matchId && !matchNote) return false;
      }
      return true;
    });
  }, [rows, funds, overlappingOnly, searchQuery]);

  const displayRows = useMemo(() => {
    return filteredRows.map((row, index) => ({
      ...row,
      divider: index === 0 || row.role !== filteredRows[index - 1].role,
    }));
  }, [filteredRows]);

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
    const url = `${window.location.origin}${window.location.pathname}${serializeBookSearch({
      view,
      focus,
      dates,
      sort,
      dir,
      q: searchQuery,
      overlap: overlappingOnly,
      basket,
    })}`;
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
    for (const row of filteredRows) {
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

  const handleSearchChange = (event) => {
    const nextQ = event.target.value;
    setSearchQuery(nextQ);
    replaceBook({ q: nextQ });
  };

  const handleOverlapToggle = () => {
    const nextOverlap = !overlappingOnly;
    setOverlappingOnly(nextOverlap);
    replaceBook({ overlap: nextOverlap });
  };

  const clearAllFilters = () => {
    setSearchQuery("");
    setOverlappingOnly(false);
    replaceBook({ q: "", overlap: false });
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

      {/* Fund Overview Deck with Quick Strip */}
      <div style={styles.fundOverviewContainer}>
        <div style={styles.quickFundStatsBar}>
          <button
            type="button"
            onClick={() => setShowCards((prev) => !prev)}
            style={styles.deckToggleBtn}
            aria-expanded={showCards}
          >
            <span style={styles.deckToggleIcon}>{showCards ? "▾" : "▸"}</span>
            <span style={styles.deckToggleTitle}>Fund Overview & Methodologies ({funds.length} funds)</span>
          </button>
          <div style={styles.pillsScroll}>
            {funds.map((f) => {
              const isMarket = f.snapshot.premiumMode === "market";
              const prem = fundPremium(f.snapshot, f.price);
              const isSorted = sort === f.ticker;
              return (
                <button
                  key={f.ticker}
                  type="button"
                  onClick={() => toggleSort(f.ticker)}
                  style={{
                    ...styles.quickPill,
                    ...(isSorted ? styles.quickPillActive : {}),
                  }}
                  title={`Sort table by ${f.ticker}`}
                >
                  <span style={styles.quickPillTicker}>{f.ticker}</span>
                  <span style={styles.quickPillPrice}>{formatUsd(f.price)}</span>
                  {isMarket && f.price ? (
                    <span
                      style={{
                        ...styles.quickPillPrem,
                        color: prem > 0 ? "#b45309" : "#15803d",
                      }}
                    >
                      {formatPremium(prem)}
                    </span>
                  ) : (
                    <span style={styles.quickPillNav}>At NAV</span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {showCards ? (
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
        ) : null}
      </div>

      {/* Main Toolbar & Search Controls */}
      <div style={styles.controlsSection}>
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

        {/* Search & Overlap Filter Bar */}
        <div style={styles.filterBar}>
          <div style={styles.searchWrapper}>
            <span style={styles.searchIcon}>🔍</span>
            <input
              type="text"
              placeholder="Search companies (e.g. SpaceX, Anthropic)..."
              value={searchQuery}
              onChange={handleSearchChange}
              style={styles.searchInput}
            />
            {searchQuery ? (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery("");
                  replaceBook({ q: "" });
                }}
                style={styles.clearSearchBtn}
                aria-label="Clear search"
              >
                ✕
              </button>
            ) : null}
          </div>

          <div style={styles.filterActions}>
            <button
              type="button"
              onClick={handleOverlapToggle}
              style={{
                ...styles.overlapBtn,
                ...(overlappingOnly ? styles.overlapBtnActive : {}),
              }}
              title="Show only companies held by 2 or more funds"
            >
              Overlapping only (2+ funds)
              <span
                style={{
                  ...styles.overlapBadge,
                  ...(overlappingOnly ? styles.overlapBadgeActive : {}),
                }}
              >
                {overlappingCount}
              </span>
            </button>

            {searchQuery || overlappingOnly ? (
              <div style={styles.filterFeedback}>
                <span>
                  Showing {filteredRows.length} of {rows.length}
                </span>
                <button type="button" onClick={clearAllFilters} style={styles.clearAllFiltersBtn}>
                  Reset filters
                </button>
              </div>
            ) : null}
          </div>
        </div>

        <p style={styles.caption}>{VIEW_CAPTIONS[view]}</p>
      </div>

      {/* Main Table Matrix */}
      <div style={styles.scroll} className="book-scroll">
        <table style={styles.table} className="book-table">
          <thead>
            <tr>
              <th style={styles.companyHead} aria-sort={ariaSort("name", sort, dir)}>
                <button
                  type="button"
                  onClick={() => toggleSort("name")}
                  style={styles.sortBtn}
                  title={`Sort alphabetically by company name (${dir === "asc" ? "Z–A" : "A–Z"})`}
                >
                  <span>Company</span>
                  <SortMark active={sort === "name"} dir={dir} />
                </button>
              </th>
              {funds.map((fund) => {
                const isSorted = sort === fund.ticker;
                const isMarket = fund.snapshot.premiumMode === "market";
                const prem = fundPremium(fund.snapshot, fund.price);
                return (
                  <th
                    key={fund.ticker}
                    style={{
                      ...styles.viewHead,
                      ...(isSorted ? styles.viewHeadSorted : {}),
                    }}
                    aria-sort={ariaSort(fund.ticker, sort, dir)}
                  >
                    <button
                      type="button"
                      onClick={() => toggleSort(fund.ticker)}
                      style={{ ...styles.sortBtn, ...styles.sortBtnRight }}
                      title={`Sort by ${fund.ticker} (${dir === "asc" ? "highest first" : "lowest first"})`}
                    >
                      <div style={styles.headerTickerRow}>
                        <span
                          style={{
                            fontWeight: isSorted ? 700 : 600,
                            color: isSorted ? "#d97706" : "inherit",
                          }}
                        >
                          {fund.ticker}
                        </span>
                        <SortMark active={isSorted} dir={dir} />
                      </div>
                      <div style={styles.headerPriceRow}>
                        <span>{formatUsd(fund.price)}</span>
                        {isMarket && fund.price ? (
                          <span
                            style={{
                              ...styles.headerPrem,
                              color: prem > 0 ? "#b45309" : "#15803d",
                            }}
                          >
                            {formatPremium(prem)}
                          </span>
                        ) : (
                          <span style={styles.headerNavPill}>At NAV</span>
                        )}
                      </div>
                    </button>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {displayRows.length === 0 ? (
              <tr>
                <td colSpan={1 + funds.length} style={styles.emptyCell}>
                  No companies match your search.{" "}
                  <button type="button" onClick={clearAllFilters} style={styles.textBtn}>
                    Clear filters
                  </button>
                </td>
              </tr>
            ) : null}

            {displayRows.map((row) => {
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
                  <tr
                    className={selected ? "book-selected-row" : ""}
                    style={{
                      ...(selected ? styles.rowOn : {}),
                      cursor: "pointer",
                    }}
                    onClick={() => replaceBook({ focus: selected ? null : row.id })}
                    title={selected ? "Click to collapse details" : "Click to view company lot details and fund ranking"}
                  >
                    <th
                      scope="row"
                      style={{
                        ...styles.companyCell,
                        ...(selected ? styles.stickyOn : {}),
                      }}
                    >
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          replaceBook({ focus: selected ? null : row.id });
                        }}
                        style={styles.companyBtn}
                        aria-expanded={selected}
                      >
                        <span style={styles.companyExpandIcon}>{selected ? "▾" : "▸"}</span>
                        <span style={styles.companyNameText}>{row.name}</span>
                      </button>
                    </th>
                    {funds.map((fund) => {
                      const position = fund.positions.get(row.id);
                      const metrics = positionMetrics(position, fund.snapshot, fund.price);
                      const missing = !position;
                      const isSortedCol = sort === fund.ticker;
                      return (
                        <td
                          key={fund.ticker}
                          style={{
                            ...styles.valueCell,
                            background: selected
                              ? "#fffbeb"
                              : isSortedCol
                              ? "#faf8f5"
                              : missing
                              ? "transparent"
                              : "#fff",
                          }}
                          title={missing ? `${row.name} is not in the ${fund.ticker} report` : undefined}
                        >
                          <div style={missing ? styles.valueMainMissing : styles.valueMain}>
                            {missing ? "—" : cellText(view, metrics)}
                          </div>
                          {view === "per100" && position && shownNavWeight(metrics) != null ? (
                            <div style={styles.valueSub}>
                              {formatWeight(shownNavWeight(metrics))}{" "}
                              {metrics.weightOfNav != null ? "NAV" : "port."}
                            </div>
                          ) : null}
                        </td>
                      );
                    })}
                  </tr>

                  {/* Inline Lot Inspector / Detail Panel */}
                  {selected ? (
                    <tr style={styles.expandedRow}>
                      <td colSpan={1 + funds.length} style={styles.expandedCell}>
                        <div style={styles.inlineDetailCard}>
                          <div style={styles.inlineHeader}>
                            <div style={styles.inlineTitleBlock}>
                              <div style={styles.inlineTitleRow}>
                                <span style={styles.inlineCompanyName}>{row.name}</span>
                                <span style={styles.inlineFundCountBadge}>
                                  Held by {funds.filter((f) => f.positions.has(row.id)).length} of {funds.length} funds
                                </span>
                              </div>
                              {companyMap[row.id]?.note ? (
                                <p style={styles.inlineCompanyNote}>{companyMap[row.id].note}</p>
                              ) : null}
                            </div>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                replaceBook({ focus: null });
                              }}
                              style={styles.inlineCloseBtn}
                              aria-label="Close details"
                            >
                              ✕ Close details
                            </button>
                          </div>

                          <div style={styles.inlineRankGrid}>
                            {focusRows
                              .filter(({ position }) => Boolean(position))
                              .map(({ fund, position, metrics }) => (
                                <div key={fund.ticker} style={styles.inlineFundCard}>
                                  <div style={styles.inlineFundCardTop}>
                                    <div style={styles.inlineTickerGroup}>
                                      {CALCULATORS[fund.ticker] ? (
                                        <Link
                                          href={CALCULATORS[fund.ticker]}
                                          style={styles.inlineCalcLink}
                                          onClick={(e) => e.stopPropagation()}
                                        >
                                          {fund.ticker} ↗
                                        </Link>
                                      ) : (
                                        <span style={styles.inlineFundTicker}>{fund.ticker}</span>
                                      )}
                                      <span style={styles.inlineFundName}>{fund.snapshot.name}</span>
                                    </div>
                                    <div style={styles.inlinePer100Value}>
                                      {formatPer100(metrics.per100)}{" "}
                                      <span style={styles.inlinePer100Unit}>/ $100</span>
                                    </div>
                                  </div>

                                  <div style={styles.inlineMetricsBar}>
                                    <div>
                                      <span style={styles.inlineMetaLabel}>Weight: </span>
                                      <strong>{formatWeight(metrics.weightOfNav ?? position.weight)}</strong>
                                      <span style={styles.inlineMetaSub}>
                                        {" "}
                                        {metrics.weightOfNav != null ? "of NAV" : "of portfolio"}
                                      </span>
                                    </div>
                                    {metrics.per100 > 0 ? (
                                      <div style={styles.inlinePriceRatio}>
                                        ${(100 / metrics.per100).toFixed(2)} price per $1 fair value
                                      </div>
                                    ) : null}
                                  </div>

                                  <ul style={styles.inlineLotsList}>
                                    {position.lines.map((line, index) => (
                                      <li key={`${line.label || line.companyId}-${index}`} style={styles.inlineLotItem}>
                                        <div>
                                          <span style={styles.lotValBold}>{formatCompact(line.fairValue)}</span>
                                          {line.label ? <span style={styles.lotLabelText}> {line.label}</span> : ""}
                                          {line.valuation === "cost" ? (
                                            <span style={styles.valMethodBadge}>at cost</span>
                                          ) : null}
                                          {line.valuation === "practical-expedient" ? (
                                            <span style={styles.valMethodBadge}>practical expedient</span>
                                          ) : null}
                                        </div>
                                        {line.note ? <div style={styles.lotNoteText}>{line.note}</div> : null}
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              ))}
                          </div>

                          {focusRows.some(({ position }) => !position) ? (
                            <div style={styles.notHeldFooter}>
                              <span style={styles.notHeldLabel}>Not held by:</span>{" "}
                              {focusRows
                                .filter(({ position }) => !position)
                                .map(({ fund }) => fund.ticker)
                                .join(", ")}
                            </div>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ) : null}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Diffs (only rendered for funds with prior reports to compare) */}
      {funds
        .filter((fund) => Boolean(fund.prior))
        .map((fund) => (
          <DiffPanel key={fund.ticker} fund={fund} companies={companyMap} />
        ))}

      {/* Basket Calculator Section */}
      <section style={styles.panel}>
        <div style={styles.basketHeader}>
          <div>
            <h2 style={styles.panelTitle}>Look-Through Basket</h2>
            <p style={styles.caption}>
              Enter dollars invested in each fund at today&apos;s price. Calculates aggregate look-through dollar exposure across all underlying private companies.
            </p>
          </div>
          <div style={styles.basketPresets}>
            <span style={styles.presetLabel}>Quick Presets:</span>
            <button
              type="button"
              onClick={() => {
                const next = {};
                funds.forEach((f) => {
                  next[f.ticker] = 1000;
                });
                setBasket(next);
                replaceBook({ basket: next });
              }}
              style={styles.presetBtn}
            >
              +$1K All Funds
            </button>
            <button
              type="button"
              onClick={() => {
                const next = { ...basket };
                ["DXYZ", "RVI", "BOT", "NSLR", "VCX", "PWRL"].forEach((t) => {
                  if (tickers.includes(t)) {
                    next[t] = (Number(next[t]) || 0) + 5000;
                  }
                });
                setBasket(next);
                replaceBook({ basket: next });
              }}
              style={styles.presetBtn}
            >
              +$5K CEFs
            </button>
            {dollarsSpent > 0 ? (
              <button
                type="button"
                onClick={() => {
                  setBasket({});
                  replaceBook({ basket: {} });
                }}
                style={styles.clearBtn}
              >
                Clear All
              </button>
            ) : null}
          </div>
        </div>

        <div style={styles.basketInputsGrid}>
          {funds.map((fund) => (
            <label key={fund.ticker} style={styles.basketInputCard}>
              <div style={styles.basketCardLabelRow}>
                <span style={styles.basketCardTicker}>{fund.ticker}</span>
                <span style={styles.basketCardPrice}>{formatUsd(fund.price)}</span>
              </div>
              <div style={styles.inputWrapper}>
                <span style={styles.inputPrefix}>$</span>
                <input
                  inputMode="decimal"
                  placeholder="0"
                  value={basket[fund.ticker] ?? ""}
                  onChange={(event) => {
                    const val = event.target.value.replace(/[^0-9.]/g, "");
                    const next = { ...basket, [fund.ticker]: val };
                    if (!val) delete next[fund.ticker];
                    setBasket(next);
                    replaceBook({ basket: next });
                  }}
                  style={styles.basketInput}
                />
              </div>
            </label>
          ))}
        </div>

        {dollarsSpent > 0 ? (
          <div style={styles.basketResultsContainer}>
            <div style={styles.basketSummaryBanner}>
              <div style={styles.basketSummaryMetric}>
                <span style={styles.metricLabel}>Total Invested</span>
                <span style={styles.metricValue}>{formatUsd(dollarsSpent, 0)}</span>
              </div>
              <div style={styles.summaryDivider} />
              <div style={styles.basketSummaryMetric}>
                <span style={styles.metricLabel}>Look-Through Net Assets</span>
                <span style={styles.metricValue}>
                  {formatUsd(basketResult.rows.reduce((sum, row) => sum + row.total, 0), 0)}
                </span>
              </div>
              <div style={styles.summaryDivider} />
              <div style={styles.basketSummaryMetric}>
                <span style={styles.metricLabel}>Effective Price ÷ NAV</span>
                <span style={styles.metricValue}>
                  {basketResult.rows.reduce((sum, row) => sum + row.total, 0) > 0
                    ? (
                        dollarsSpent /
                        basketResult.rows.reduce((sum, row) => sum + row.total, 0)
                      ).toFixed(2) + "x"
                    : "—"}
                </span>
              </div>
            </div>

            {basketResult.skipped.length > 0 ? (
              <p style={styles.warn}>
                {basketResult.skipped.join(", ")} is waiting on a live price, so that fund is omitted from the look-through total.
              </p>
            ) : null}

            <div style={styles.basketTableWrapper}>
              <table style={styles.basketTable}>
                <thead>
                  <tr>
                    <th style={styles.basketThRank}>#</th>
                    <th style={styles.basketThCompany}>Company</th>
                    <th style={styles.basketThValue}>Look-Through Value</th>
                    <th style={styles.basketThPct}>% of Basket</th>
                    <th style={styles.basketThFunds}>Contributing Funds</th>
                  </tr>
                </thead>
                <tbody>
                  {basketResult.rows
                    .filter((row) => Math.abs(row.total) >= 0.5)
                    .map((row, index) => {
                      const totalAssets = basketResult.rows.reduce((sum, r) => sum + r.total, 0);
                      const pctOfTotal = totalAssets > 0 ? (row.total / totalAssets) * 100 : 0;
                      return (
                        <tr key={row.companyId} style={styles.basketRow}>
                          <td style={styles.basketTdRank}>{index + 1}</td>
                          <td style={styles.basketTdCompany}>
                            <strong>{row.name}</strong>
                          </td>
                          <td style={styles.basketTdValue}>{formatCompact(row.total)}</td>
                          <td style={styles.basketTdPct}>{pctOfTotal.toFixed(1)}%</td>
                          <td style={styles.basketTdFunds}>
                            <div style={styles.contribPills}>
                              {Object.entries(row.byTicker || {})
                                .filter(([, val]) => val >= 0.5)
                                .map(([t, val]) => (
                                  <span key={t} style={styles.contribPill}>
                                    <strong>{t}</strong> {formatCompact(val)}
                                  </span>
                                ))}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </div>
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
        <div style={styles.cardTickerRow}>
          {CALCULATORS[fund.ticker] ? (
            <Link href={CALCULATORS[fund.ticker]} style={styles.cardTicker}>
              {fund.ticker} ↗
            </Link>
          ) : (
            <span style={styles.cardTicker}>{fund.ticker}</span>
          )}
          {atNav ? (
            <span style={styles.intervalBadge}>Interval Fund</span>
          ) : null}
        </div>
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
                ...((item.accession || item.sourceId) === (snapshot.accession || snapshot.sourceId)
                  ? styles.dateBtnOn
                  : {}),
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
  disclosure: { fontSize: 13, color: "#78716c", maxWidth: 720, marginBottom: 24 },

  /* Fund Overview Deck & Quick Pills */
  fundOverviewContainer: {
    marginBottom: 24,
  },
  quickFundStatsBar: {
    display: "flex",
    flexDirection: "column",
    gap: 10,
    background: "#fff",
    border: "1px solid #e7e5e4",
    borderRadius: 10,
    padding: "10px 14px",
    boxShadow: "0 1px 2px rgba(0,0,0,0.02)",
  },
  deckToggleBtn: {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    background: "transparent",
    border: "none",
    padding: 0,
    cursor: "pointer",
    fontFamily: "var(--font-mono), monospace",
    fontSize: 12,
    fontWeight: 600,
    letterSpacing: "0.05em",
    color: "#44403c",
    textAlign: "left",
  },
  deckToggleIcon: { fontSize: 13, color: "#d97706" },
  deckToggleTitle: { textTransform: "uppercase" },
  pillsScroll: {
    display: "flex",
    gap: 8,
    overflowX: "auto",
    paddingBottom: 2,
  },
  quickPill: {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    padding: "4px 10px",
    borderRadius: 999,
    border: "1px solid #e7e5e4",
    background: "#fbfbfa",
    fontFamily: "var(--font-mono), monospace",
    fontSize: 12,
    cursor: "pointer",
    whiteSpace: "nowrap",
    transition: "border-color 0.15s ease",
  },
  quickPillActive: {
    background: "#1c1917",
    color: "#fef3c7",
    borderColor: "#1c1917",
  },
  quickPillTicker: { fontWeight: 700 },
  quickPillPrice: { color: "inherit", opacity: 0.9 },
  quickPillPrem: { fontWeight: 600 },
  quickPillNav: { fontSize: 11, color: "#78716c" },

  /* Controls Section */
  controlsSection: {
    marginBottom: 16,
  },
  toolbar: {
    display: "flex",
    justifyContent: "space-between",
    gap: 16,
    alignItems: "center",
    flexWrap: "wrap",
    marginBottom: 12,
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

  /* Search & Filter Bar */
  filterBar: {
    display: "flex",
    gap: 12,
    alignItems: "center",
    flexWrap: "wrap",
    marginBottom: 10,
  },
  searchWrapper: {
    display: "flex",
    alignItems: "center",
    position: "relative",
    flex: "1 1 260px",
    maxWidth: 420,
  },
  searchIcon: {
    position: "absolute",
    left: 10,
    fontSize: 13,
    pointerEvents: "none",
    opacity: 0.6,
  },
  searchInput: {
    width: "100%",
    padding: "8px 28px 8px 30px",
    borderRadius: 8,
    border: "1px solid #e7e5e4",
    background: "#fff",
    fontFamily: "inherit",
    fontSize: 13,
    color: "#1c1917",
    outline: "none",
  },
  clearSearchBtn: {
    position: "absolute",
    right: 8,
    background: "transparent",
    border: "none",
    cursor: "pointer",
    fontSize: 12,
    color: "#78716c",
  },
  filterActions: {
    display: "flex",
    gap: 10,
    alignItems: "center",
    flexWrap: "wrap",
  },
  overlapBtn: {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    fontFamily: "var(--font-mono), monospace",
    fontSize: 12,
    border: "1px solid #e7e5e4",
    background: "transparent",
    color: "#57534e",
    borderRadius: 999,
    padding: "6px 12px",
    cursor: "pointer",
  },
  overlapBtnActive: {
    background: "#fef3c7",
    color: "#92400e",
    borderColor: "#f59e0b",
  },
  overlapBadge: {
    display: "inline-block",
    padding: "1px 6px",
    borderRadius: 999,
    background: "#e7e5e4",
    fontSize: 10,
    fontWeight: 700,
    color: "#44403c",
  },
  overlapBadgeActive: {
    background: "#d97706",
    color: "#fff",
  },
  filterFeedback: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    fontFamily: "var(--font-mono), monospace",
    fontSize: 12,
    color: "#78716c",
  },
  clearAllFiltersBtn: {
    background: "transparent",
    border: "none",
    color: "#d97706",
    cursor: "pointer",
    padding: 0,
    textDecoration: "underline",
    font: "inherit",
  },
  caption: { fontSize: 13, lineHeight: 1.5, color: "#57534e", margin: "6px 0 12px", maxWidth: 780 },

  /* Table styling */
  scroll: { marginBottom: 32 },
  table: { width: "100%", minWidth: 1160, borderCollapse: "collapse", tableLayout: "fixed" },
  companyHead: {
    textAlign: "left",
    fontFamily: "var(--font-mono), monospace",
    fontSize: 11,
    letterSpacing: "0.12em",
    textTransform: "uppercase",
    color: "#78716c",
    width: 280,
    padding: "10px 16px",
    borderBottom: "1px solid #e7e5e4",
    background: "#fefdf8",
  },
  viewHead: {
    textAlign: "right",
    fontFamily: "var(--font-mono), monospace",
    fontSize: 11,
    letterSpacing: "0.08em",
    color: "#78716c",
    padding: "8px 10px",
    borderBottom: "1px solid #e7e5e4",
    background: "#fefdf8",
  },
  viewHeadSorted: {
    background: "#fef9ee",
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
    color: "inherit",
  },
  sortBtnRight: {
    width: "100%",
    flexDirection: "column",
    alignItems: "flex-end",
    gap: 3,
  },
  headerTickerRow: {
    display: "inline-flex",
    alignItems: "center",
    gap: 4,
    fontSize: 13,
  },
  headerPriceRow: {
    display: "inline-flex",
    alignItems: "baseline",
    gap: 4,
    fontSize: 10,
    color: "#78716c",
  },
  headerPrem: {
    fontWeight: 600,
  },
  headerNavPill: {
    color: "#a8a29e",
  },
  sortMark: { fontSize: 11 },
  section: {
    padding: "16px 12px 6px",
    fontFamily: "var(--font-mono), monospace",
    fontSize: 11,
    letterSpacing: "0.14em",
    textTransform: "uppercase",
    color: "#a8a29e",
    background: "#fcfbf7",
    borderTop: "1px solid #f0ede6",
    borderBottom: "1px solid #f0ede6",
  },
  rowOn: { background: "#fffbeb" },
  companyCell: {
    textAlign: "left",
    padding: "9px 14px",
    borderBottom: "1px solid #f5f5f4",
    position: "sticky",
    left: 0,
    background: "#fefdf8",
  },
  stickyOn: { background: "#fffbeb" },
  companyBtn: {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    background: "transparent",
    border: "none",
    padding: 0,
    cursor: "pointer",
    font: "inherit",
    color: "#1c1917",
    textAlign: "left",
    width: "100%",
  },
  companyExpandIcon: {
    fontSize: 10,
    color: "#d97706",
    width: 10,
    flexShrink: 0,
  },
  companyNameText: {
    fontWeight: 500,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  valueCell: {
    textAlign: "right",
    padding: "8px 10px",
    borderBottom: "1px solid #f5f5f4",
    fontFamily: "var(--font-mono), monospace",
    fontVariantNumeric: "tabular-nums",
  },
  valueMain: { fontSize: 14, fontWeight: 700, color: "#1c1917" },
  valueMainMissing: { fontSize: 14, fontWeight: 400, color: "#d6d3d1" },
  valueSub: { fontSize: 11, fontWeight: 500, color: "#78716c", marginTop: 2 },
  emptyCell: {
    textAlign: "center",
    padding: "36px 16px",
    fontFamily: "var(--font-mono), monospace",
    fontSize: 13,
    color: "#78716c",
  },

  /* Inline Expandable Detail Card */
  expandedRow: {
    background: "#fffef9",
  },
  expandedCell: {
    padding: 0,
    borderBottom: "2px solid #e7e5e4",
  },
  inlineDetailCard: {
    padding: "16px 20px 20px",
    background: "#fffef7",
    borderTop: "1px solid #fef3c7",
  },
  inlineHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 16,
    marginBottom: 16,
    borderBottom: "1px solid #f0ede6",
    paddingBottom: 12,
  },
  inlineTitleBlock: { display: "flex", flexDirection: "column", gap: 4 },
  inlineTitleRow: { display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" },
  inlineCompanyName: { fontSize: 20, fontWeight: 800, color: "#1c1917" },
  inlineFundCountBadge: {
    fontFamily: "var(--font-mono), monospace",
    fontSize: 11,
    padding: "2px 8px",
    borderRadius: 999,
    background: "#fef3c7",
    color: "#92400e",
    fontWeight: 600,
  },
  inlineCompanyNote: { fontSize: 12, color: "#78716c", margin: "2px 0 0" },
  inlineCloseBtn: {
    fontFamily: "var(--font-mono), monospace",
    fontSize: 11,
    padding: "4px 8px",
    borderRadius: 6,
    background: "transparent",
    border: "1px solid #e7e5e4",
    color: "#78716c",
    cursor: "pointer",
  },
  inlineRankGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
    gap: 12,
    marginBottom: 12,
  },
  inlineFundCard: {
    background: "#fff",
    border: "1px solid #e7e5e4",
    borderRadius: 8,
    padding: 12,
    boxShadow: "0 1px 2px rgba(0,0,0,0.02)",
  },
  inlineFundCardTop: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "baseline",
    gap: 8,
    marginBottom: 6,
    borderBottom: "1px solid #f5f5f4",
    paddingBottom: 6,
  },
  inlineTickerGroup: { display: "flex", alignItems: "baseline", gap: 6 },
  inlineFundTicker: {
    fontFamily: "var(--font-mono), monospace",
    fontSize: 15,
    fontWeight: 700,
    color: "#d97706",
  },
  inlineCalcLink: {
    fontFamily: "var(--font-mono), monospace",
    fontSize: 15,
    fontWeight: 700,
    color: "#d97706",
    textDecoration: "none",
  },
  inlineFundName: { fontSize: 11, color: "#78716c", maxWidth: 120, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  inlinePer100Value: {
    fontFamily: "var(--font-mono), monospace",
    fontSize: 15,
    fontWeight: 800,
    color: "#1c1917",
  },
  inlinePer100Unit: { fontSize: 10, fontWeight: 400, color: "#78716c" },
  inlineMetricsBar: {
    fontFamily: "var(--font-mono), monospace",
    fontSize: 11,
    color: "#44403c",
    marginBottom: 8,
  },
  inlineMetaLabel: { color: "#78716c" },
  inlineMetaSub: { fontSize: 10, color: "#a8a29e" },
  inlinePriceRatio: { fontSize: 10, color: "#78716c", marginTop: 2 },
  inlineLotsList: { listStyle: "none", padding: 0, margin: 0 },
  inlineLotItem: {
    fontFamily: "var(--font-mono), monospace",
    fontSize: 11,
    color: "#44403c",
    borderTop: "1px solid #f9f9f8",
    paddingTop: 4,
    marginTop: 4,
  },
  lotValBold: { fontWeight: 700, color: "#1c1917" },
  lotLabelText: { color: "#57534e" },
  valMethodBadge: {
    fontSize: 9,
    padding: "1px 5px",
    borderRadius: 4,
    background: "#f5f5f4",
    color: "#78716c",
    marginLeft: 4,
  },
  lotNoteText: { fontSize: 10, color: "#78716c", marginTop: 2, fontStyle: "italic" },
  notHeldFooter: {
    fontFamily: "var(--font-mono), monospace",
    fontSize: 11,
    color: "#78716c",
    paddingTop: 8,
    borderTop: "1px solid #f0ede6",
  },
  notHeldLabel: { fontWeight: 600, color: "#a8a29e" },

  /* Fund Card Deck */
  card: {
    border: "1px solid #e7e5e4",
    borderRadius: 12,
    padding: 14,
    background: "#fff",
    minWidth: 240,
  },
  cardTop: { display: "flex", justifyContent: "space-between", gap: 8, alignItems: "baseline" },
  cardTickerRow: { display: "flex", alignItems: "center", gap: 8 },
  cardTicker: {
    fontFamily: "var(--font-mono), monospace",
    fontSize: 18,
    fontWeight: 700,
    color: "#d97706",
    letterSpacing: "0.04em",
    textDecoration: "none",
  },
  intervalBadge: {
    fontSize: 9,
    fontFamily: "var(--font-mono), monospace",
    textTransform: "uppercase",
    letterSpacing: "0.04em",
    padding: "2px 6px",
    borderRadius: 4,
    background: "#f0fdf4",
    color: "#166534",
    fontWeight: 600,
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

  /* Panels */
  panel: {
    borderTop: "1px solid #e7e5e4",
    paddingTop: 24,
    marginTop: 16,
  },
  panelTitle: { fontSize: 24, fontWeight: 700, margin: "0 0 8px" },

  /* Diff styling */
  diffLabel: {
    fontFamily: "var(--font-mono), monospace",
    fontSize: 11,
    letterSpacing: "0.12em",
    textTransform: "uppercase",
    color: "#78716c",
    margin: "12px 0 0",
  },
  lots: { listStyle: "none", padding: 0, margin: "8px 0 0" },
  lotValue: { fontFamily: "var(--font-mono), monospace" },
  lotNote: { display: "block", color: "#78716c", fontSize: 12, lineHeight: 1.4, marginTop: 2 },

  /* Basket Calculator */
  basketHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 16,
    flexWrap: "wrap",
    marginBottom: 16,
  },
  basketPresets: {
    display: "flex",
    gap: 8,
    alignItems: "center",
    flexWrap: "wrap",
  },
  presetLabel: {
    fontFamily: "var(--font-mono), monospace",
    fontSize: 11,
    color: "#78716c",
    textTransform: "uppercase",
  },
  presetBtn: {
    fontFamily: "var(--font-mono), monospace",
    fontSize: 11,
    padding: "4px 8px",
    borderRadius: 6,
    border: "1px solid #e7e5e4",
    background: "#fff",
    color: "#44403c",
    cursor: "pointer",
  },
  clearBtn: {
    fontFamily: "var(--font-mono), monospace",
    fontSize: 11,
    padding: "4px 8px",
    borderRadius: 6,
    border: "1px solid #fecaca",
    background: "#fff",
    color: "#b91c1c",
    cursor: "pointer",
  },
  basketInputsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))",
    gap: 10,
    marginBottom: 20,
  },
  basketInputCard: {
    display: "flex",
    flexDirection: "column",
    gap: 6,
    background: "#fff",
    border: "1px solid #e7e5e4",
    borderRadius: 8,
    padding: "8px 10px",
  },
  basketCardLabelRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "baseline",
    fontFamily: "var(--font-mono), monospace",
  },
  basketCardTicker: { fontSize: 13, fontWeight: 700, color: "#d97706" },
  basketCardPrice: { fontSize: 11, color: "#78716c" },
  inputWrapper: {
    display: "flex",
    alignItems: "center",
    border: "1px solid #e7e5e4",
    borderRadius: 6,
    padding: "0 8px",
    background: "#fafaf9",
  },
  inputPrefix: {
    fontFamily: "var(--font-mono), monospace",
    fontSize: 13,
    color: "#78716c",
  },
  basketInput: {
    width: "100%",
    border: "none",
    background: "transparent",
    padding: "6px 4px",
    fontFamily: "var(--font-mono), monospace",
    fontSize: 13,
    outline: "none",
    color: "#1c1917",
  },
  basketResultsContainer: {
    marginTop: 20,
    background: "#fff",
    border: "1px solid #e7e5e4",
    borderRadius: 12,
    padding: 16,
    boxShadow: "0 1px 3px rgba(0,0,0,0.02)",
  },
  basketSummaryBanner: {
    display: "flex",
    justifyContent: "space-around",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 16,
    padding: "12px 16px",
    background: "#faf8f5",
    borderRadius: 8,
    marginBottom: 16,
  },
  basketSummaryMetric: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 4,
  },
  metricLabel: {
    fontFamily: "var(--font-mono), monospace",
    fontSize: 10,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    color: "#78716c",
  },
  metricValue: {
    fontFamily: "var(--font-mono), monospace",
    fontSize: 20,
    fontWeight: 800,
    color: "#1c1917",
  },
  summaryDivider: {
    width: 1,
    height: 32,
    background: "#e7e5e4",
  },
  basketTableWrapper: {
    overflowX: "auto",
  },
  basketTable: {
    width: "100%",
    borderCollapse: "collapse",
    fontFamily: "var(--font-mono), monospace",
    fontSize: 12,
  },
  basketThRank: { textAlign: "left", width: 36, padding: "8px", borderBottom: "1px solid #e7e5e4", color: "#a8a29e" },
  basketThCompany: { textAlign: "left", padding: "8px", borderBottom: "1px solid #e7e5e4", color: "#78716c" },
  basketThValue: { textAlign: "right", padding: "8px", borderBottom: "1px solid #e7e5e4", color: "#78716c" },
  basketThPct: { textAlign: "right", padding: "8px", borderBottom: "1px solid #e7e5e4", color: "#78716c" },
  basketThFunds: { textAlign: "left", padding: "8px 12px", borderBottom: "1px solid #e7e5e4", color: "#78716c" },
  basketRow: {
    borderBottom: "1px solid #f5f5f4",
  },
  basketTdRank: { padding: "8px", color: "#a8a29e" },
  basketTdCompany: { padding: "8px", color: "#1c1917" },
  basketTdValue: { padding: "8px", textAlign: "right", fontWeight: 700, color: "#1c1917" },
  basketTdPct: { padding: "8px", textAlign: "right", color: "#57534e" },
  basketTdFunds: { padding: "8px 12px" },
  contribPills: { display: "flex", gap: 6, flexWrap: "wrap" },
  contribPill: {
    padding: "2px 6px",
    borderRadius: 4,
    background: "#f5f5f4",
    fontSize: 10,
    color: "#44403c",
  },
};
