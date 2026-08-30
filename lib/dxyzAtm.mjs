// DXYZ ATM issuance bridge — pure, deterministic math.
// Confidence tiers: FILED numbers come verbatim from EDGAR filings; INFERRED
// numbers are arithmetic on filed numbers; ESTIMATED numbers depend on market
// data and modeling assumptions. Never present ESTIMATED output as filed NAV.

import { DXYZ_FILED } from "./loadAiData.mjs";

// FILED — June 30, 2026 NAV / portfolio / share count from the N-CSRS
// (accession 0001213900-26-095201, filed Aug 29) reconciled to NPORT-P
// (accession 0000894189-26-024246). Printed NAV is $34.30; exact is
// net assets ÷ shares. Do not reconstruct net assets as shares × $34.30.
export const FILED = DXYZ_FILED;

// Frozen March 31 NPORT-P. Live FILED is June 30; this snapshot is only for
// the historical Apr–May 424B5 share inference and the Q2 share roll-forward.
export const MARCH_31_NPORT = {
  asOf: "2026-03-31",
  navPerShare: 24.56,
  netAssets: 748360972.3,
  portfolioValue: 742500000,
  filingType: "NPORT-P",
  accession: "0000894189-26-016628",
};

// Reconciliation: other assets less liabilities on the N-CSRS SOI
// (investments $1,640,039,144 − net assets $1,634,830,252 = −$5,208,892).
export const OTHER_NET_ASSETS = FILED.netAssets - FILED.portfolioValue;

// FILED — May 26, 2026 424B5 prospectus supplement.
// 57,591,678 is shares outstanding *after* the full $1B offering at the
// assumed $61.66 price (May 21 close) — not the number of new shares.
export const PROSPECTUS_424B5 = {
  filedDate: "2026-05-26",
  refDate: "2026-05-21",
  refPrice: 61.66,
  sharesAfterFullOffering: 57_591_678,
  capacityGross: 1_000_000_000, // capacity is aggregate GROSS offering price
  commissionCap: 0.03, // Jefferies: "up to 3.0% of the gross sales price"
};

// FILED — May 12, 2026 424B3. Q1 sales are ALREADY inside the March 31
// baseline above. Context + capacity accounting; never added to the bridge.
// Note: the 424B3's "approximately $244.1 million" net vs $244.15M implied
// gross would suggest near-zero commission, conflicting with the N-CSR's
// ~0.95%; the audited N-CSR figure is treated as authoritative and the
// 424B3's net is assumed loosely rounded.
export const Q1_ATM = {
  shares: 8_489_359,
  wavgPrice: 28.76,
  netProceeds: 244_100_000,
};

// FILED — Aug 28, 2026 424B3. Q2 sales are ALREADY inside the June 30
// baseline. Stated wavg $34.25 × shares ($588.8M) does not equal stated
// net proceeds $715,442,732; both are stored as printed.
export const Q2_ATM = {
  shares: 17_191_674,
  wavgPrice: 34.25,
  netProceeds: 715_442_732,
  from: "2026-04-01",
  to: "2026-06-30",
};

// FILED — N-CSRS six months ended June 30, 2026. Q1 + Q2 already inside
// the June 30 share count. Stated H1 wavg $37.57; proceeds $959,564,268
// after commissions.
export const H1_ATM = {
  shares: 25_681_033,
  wavgPrice: 37.57,
  netProceedsAfterCommissions: 959_564_268,
};

// FILED — May 26, 2026 new shelf (File 333-296212) authorizes an
// indeterminate amount. There is no filed remaining-capacity dollar figure.
// The May 26 424B5 $1B is an illustration used as the simulation cap only.
export const NEW_SHELF = {
  filedDate: "2026-05-26",
  fileNumber: "333-296212",
  amount: "indeterminate",
};

// FILED — N-CSRS subsequent event. Board approved in August 2026.
export const SHARE_REPURCHASE = {
  approved: "2026-08",
  belowNav: true,
  discretionary: true,
  filingType: "N-CSRS",
  accession: "0001213900-26-095201",
  url: "https://www.sec.gov/Archives/edgar/data/1843974/000121390026095201/ea0302101-01_ncsrs.htm",
};

// 12/31/2025 shares 21,976,305 + Q1 ATM 8,489,359. Reconciles to June 30:
// 30,465,664 + 17,191,674 = 47,657,338. Prefer this over rounding NPORT NA/NAV.
export const MARCH_31_SHARES_FILED = 21_976_305 + Q1_ATM.shares;
// FILED — the ORIGINAL $1B ATM program (File 333-278734): shelf effective
// July 15, 2025; Jefferies Sales Agreement dated August 8, 2025. Through
// December 31, 2025 the fund sold 11,096,400 shares at a $29.48 weighted
// average for $324,015,375 net of commissions (N-CSR filed March 10, 2026)
// — implying ~0.95% effective commission on gross of ~$327.1M.
export const PRIOR_ATM = {
  registered: 1_000_000_000,
  shelfEffective: "2025-07-15",
  salesFrom: "2025-08-08",
  sold2025: { shares: 11_096_400, wavgPrice: 29.48, netProceeds: 324_015_375 },
};

// INFERRED — gross capacity left on the original shelf entering April 1,
// 2026. Shelf capacity counts GROSS offering price: $1B − 2025 gross
// (11,096,400 × $29.48) − Q1 gross (8,489,359 × $28.76) ≈ $428.7M. The new
// $1B prospectus is dated May 26, 2026, so ALL Apr 1–May 21 issuance ran on
// this remainder — it is a hard ceiling on the inferred bridge's proceeds.
export function priorShelfRemainingApr1() {
  return (
    PRIOR_ATM.registered -
    PRIOR_ATM.sold2025.shares * PRIOR_ATM.sold2025.wavgPrice -
    Q1_ATM.shares * Q1_ATM.wavgPrice
  );
}

export const DEFAULTS = {
  // Contractual cap is 3.0%. The audited N-CSR implies ~0.95% effective on
  // 2025 sales (gross ~$327.1M vs $324.0M net) — the best filed calibration.
  commissionRate: 0.01,
  // 424B5: management fee of 2.50% of average gross assets, annualized.
  expenseDragAnnualRate: 0.025,
  minPremium: 0, // issue only when close > rolling NAV × (1 + minPremium)
  aprMayWindow: { start: "2026-04-01", end: "2026-05-21" },
  q2Window: { start: "2026-04-01", end: "2026-06-30" },
  postMayStart: "2026-05-26",
  postFilingStart: "2026-07-01",
};

// INFERRED — March 31 NPORT net assets ÷ NAV/share. Kept as a named
// historical helper so the 424B5 Apr–May back-out still has a stable base.
export function impliedMarch31Shares() {
  return Math.round(MARCH_31_NPORT.netAssets / MARCH_31_NPORT.navPerShare);
}

// FILED — June 30 N-CSRS share count. Falls back to 3/31 filed + Q2 ATM.
export function impliedFiledShares() {
  return FILED.sharesOutstanding || MARCH_31_SHARES_FILED + Q2_ATM.shares;
}

// INFERRED — back out pre-offering shares from the 424B5 "after offering"
// count: 57,591,678 − round($1B / $61.66) ≈ 41,373,708.
export function impliedPreOfferingShares() {
  const maxNewShares = Math.round(
    PROSPECTUS_424B5.capacityGross / PROSPECTUS_424B5.refPrice
  );
  return PROSPECTUS_424B5.sharesAfterFullOffering - maxNewShares;
}

// INFERRED — Apr 1–May 21 issuance under the prior ATM supplement ≈ 10.90M.
export function inferredAprMayShares() {
  return impliedPreOfferingShares() - impliedMarch31Shares();
}

// Keep only completed trading sessions: the in-progress day carries partial
// volume and a non-final close, which would skew calibration and simulation.
// After the 16:00 ET close (16:05 with settlement buffer) today's bar is
// complete and must be kept — dropping it until midnight would leave the
// bridge one session staler than the live market price shown beside it.
// todayNY: "YYYY-MM-DD" in America/New_York; minutesNY: minutes since
// midnight in New York (omit to treat today as in-progress).
export const NY_MARKET_CLOSE_MIN = 16 * 60 + 5;
export function completedTradingRows(rows, todayNY, minutesNY = 0) {
  return rows.filter(
    (r) => r.date < todayNY || (r.date === todayNY && minutesNY >= NY_MARKET_CLOSE_MIN)
  );
}

// rows: [{ date: "YYYY-MM-DD", close, volume }] sorted ascending.
export function windowStats(rows, start, end) {
  const w = rows.filter((r) => r.date >= start && r.date <= end);
  const volume = w.reduce((s, r) => s + r.volume, 0);
  const cvwap =
    volume > 0 ? w.reduce((s, r) => s + r.close * r.volume, 0) / volume : 0;
  return { days: w.length, volume, cvwap };
}

// ESTIMATED — historical Apr–May participation from the 424B5 back-out
// over observed Apr 1–May 21 volume (≈ 8.3%). Kept so prior-shelf tests and
// the 424B5 inference still have a stable calibration. Live forward
// simulation uses calibratePostFiling instead.
// A PARTIAL window (truncated history) would assign the full inferred 10.9M
// shares to a fraction of the volume, producing absurd participation rates —
// require near-complete coverage (the full window has 36 trading days) or
// treat calibration as unavailable, matching the empty-window degradation.
const MIN_CALIBRATION_DAYS = 30;
export function calibrate(rows) {
  const w = windowStats(rows, DEFAULTS.aprMayWindow.start, DEFAULTS.aprMayWindow.end);
  if (w.days < MIN_CALIBRATION_DAYS) {
    return { aprMayShares: inferredAprMayShares(), aprMayAvgPrice: 0, aprMayVolume: 0, participation: 0 };
  }
  const shares = inferredAprMayShares();
  return {
    aprMayShares: shares,
    aprMayAvgPrice: w.cvwap,
    aprMayVolume: w.volume,
    participation: w.volume > 0 ? shares / w.volume : 0,
  };
}

// ESTIMATED — forward participation from filed Q2 ATM shares (17,191,674)
// over Apr 1–Jun 30 observed volume. Full Q2 is ~62 trading days.
const MIN_Q2_CALIBRATION_DAYS = 50;
export function calibratePostFiling(rows) {
  const w = windowStats(rows, DEFAULTS.q2Window.start, DEFAULTS.q2Window.end);
  if (w.days < MIN_Q2_CALIBRATION_DAYS) {
    return { q2Shares: Q2_ATM.shares, q2AvgPrice: 0, q2Volume: 0, participation: 0 };
  }
  return {
    q2Shares: Q2_ATM.shares,
    q2AvgPrice: w.cvwap,
    q2Volume: w.volume,
    participation: w.volume > 0 ? Q2_ATM.shares / w.volume : 0,
  };
}

// ESTIMATED — simulate daily post-May-26 issuance under the new $1B program.
// Gate: no issuance on days when close ≤ rolling pro-forma NAV (1940 Act
// §23(b) constraint); rolling NAV excludes expense drag. Capacity is capped
// on cumulative GROSS proceeds.
export function simulatePostMay({
  rows,
  startDate = DEFAULTS.postMayStart,
  asOfDate,
  participation,
  commissionRate,
  capacityGross = PROSPECTUS_424B5.capacityGross,
  startingNetAssets,
  startingShares,
  minPremium = DEFAULTS.minPremium,
}) {
  // Rates outside their meaningful ranges (typed past UI limits, or NaN from
  // malformed data) would produce nonsense like negative proceeds with
  // positive dilution. (simulatePostMay is the generic engine and allows any
  // commission up to 100%; computeAtmBridge enforces the filed 3% cap.)
  commissionRate = Math.min(Math.max(Number.isFinite(commissionRate) ? commissionRate : 0, 0), 1);
  participation = Math.max(Number.isFinite(participation) ? participation : 0, 0);
  minPremium = Math.max(Number.isFinite(minPremium) ? minPremium : 0, 0);

  let shares = 0;
  let gross = 0;
  let net = 0;
  let daysIssued = 0;
  let daysSkipped = 0;
  let exhaustedOn = null;

  for (const r of rows) {
    if (r.date < startDate) continue;
    if (asOfDate && r.date > asOfDate) break;
    const remaining = capacityGross - gross;
    if (remaining <= 0) break;

    const rollingNav = (startingNetAssets + net) / (startingShares + shares);
    if (!(r.close > rollingNav * (1 + minPremium))) {
      daysSkipped++;
      continue;
    }

    let dayShares = r.volume * participation;
    let dayGross = dayShares * r.close;
    if (dayGross >= remaining) {
      dayGross = remaining;
      dayShares = dayGross / r.close;
      exhaustedOn = r.date;
    }
    shares += dayShares;
    gross += dayGross;
    net += dayGross * (1 - commissionRate);
    daysIssued++;
  }

  return {
    shares,
    gross,
    net,
    daysIssued,
    daysSkipped,
    capacityRemaining: Math.max(0, capacityGross - gross),
    exhaustedOn,
  };
}

const daysBetween = (a, b) =>
  Math.max(0, Math.round((Date.parse(b) - Date.parse(a)) / 86_400_000));

// The full bridge. Holdings re-marks stay in markedNetAssets (upstream);
// this function only layers ATM share issuance on top — no double counting.
export function computeAtmBridge({
  mode = "calibrated", // "filed" | "calibrated" | "custom"
  rows = [],
  markedNetAssets = FILED.netAssets,
  baselineShares = impliedFiledShares(),
  aprMayShares = null, // null → 0; Q2 ATM is already inside June 30 FILED
  aprMayAvgPrice = null, // null → Apr 1–May 21 close-volume-weighted price
  participation = null, // null → Q2-calibrated
  commissionRate = DEFAULTS.commissionRate,
  capacityGross = PROSPECTUS_424B5.capacityGross,
  minPremium = DEFAULTS.minPremium,
  expenseDragAnnualRate = DEFAULTS.expenseDragAnnualRate,
  asOfDate = null, // null → last available row
} = {}) {
  const filedNav = FILED.navPerShare;
  const markedNav = baselineShares > 0 ? markedNetAssets / baselineShares : 0;
  // The UI advertises the filed "up to 3.0%" Jefferies cap — enforce it here
  // so a typed out-of-range value can't silently model a 30% commission.
  commissionRate = Math.min(
    Math.max(Number.isFinite(commissionRate) ? commissionRate : 0, 0),
    PROSPECTUS_424B5.commissionCap
  );

  if (mode === "filed") {
    return {
      mode,
      filedNav,
      markedNav,
      asOfDate: FILED.asOf,
      days: 0,
      participation: 0,
      aprMay: { shares: 0, avgPrice: 0, gross: 0, net: 0, capped: false, priorRemaining: priorShelfRemainingApr1() },
      postMay: {
        shares: 0,
        gross: 0,
        net: 0,
        daysIssued: 0,
        daysSkipped: 0,
        capacityRemaining: capacityGross,
        exhaustedOn: null,
      },
      drag: 0,
      proFormaAssets: markedNetAssets,
      proFormaShares: baselineShares,
      proFormaNav: markedNav,
      accretionPerShare: 0,
    };
  }

  // Sanitize every knob that reaches the math: NaN or negative values (typed
  // past UI limits, or from malformed data) must not invert the issuance gate
  // or produce negative share counts.
  const nonNeg = (v, fallback = 0) =>
    Number.isFinite(v) ? Math.max(v, 0) : fallback;

  const calHist = calibrate(rows);
  const calPost = calibratePostFiling(rows);
  // Q2 sales are already in FILED. Extra Apr–May shares are a custom
  // counterfactual only — calibrated/default must not double-count them.
  let bridgeAprShares = nonNeg(aprMayShares ?? 0);
  let bridgeAprPrice = nonNeg(
    aprMayAvgPrice ?? (bridgeAprShares > 0 ? calHist.aprMayAvgPrice : 0)
  );
  const bridgeParticipation = nonNeg(participation ?? calPost.participation);
  capacityGross = nonNeg(capacityGross);
  minPremium = nonNeg(minPremium);
  expenseDragAnnualRate = nonNeg(expenseDragAnnualRate);

  // No observed Apr–May price (history rows missing the calibration window)
  // means an explicit extra-share layer cannot be valued. Adding shares with
  // $0 proceeds would silently crater NAV — degrade to no extra issuance.
  if (!(bridgeAprPrice > 0)) {
    bridgeAprShares = 0;
    bridgeAprPrice = 0;
  }

  // Hard filed constraint: Apr 1–May 21 sales ran on the original shelf's
  // ~$428.7M gross remainder (the new $1B prospectus is dated May 26).
  // Pricing extra shares at the observed close-VWAP would book more
  // proceeds than the shelf could legally supply, so cap the gross and let
  // the effective average price fall out of the division. An EXPLICIT
  // user-supplied price is their counterfactual and is honored uncapped.
  const priorRemaining = priorShelfRemainingApr1();
  let aprMayGross = bridgeAprShares * bridgeAprPrice;
  let aprMayCapped = false;
  const priceOverridden = aprMayAvgPrice !== null && aprMayAvgPrice !== undefined;
  if (!priceOverridden && aprMayGross > priorRemaining) {
    // Defensive: if the filed constants ever imply zero/negative remaining
    // capacity, fail closed (no issuance) rather than negative proceeds.
    aprMayGross = Math.max(priorRemaining, 0);
    if (aprMayGross === 0) {
      bridgeAprShares = 0;
      bridgeAprPrice = 0;
    } else {
      bridgeAprPrice = aprMayGross / bridgeAprShares;
    }
    aprMayCapped = true;
  }
  const aprMayNet = aprMayGross * (1 - commissionRate);

  const lastDate = rows.length ? rows[rows.length - 1].date : FILED.asOf;
  // Forward simulation starts July 1: Q2 ATM is already in the June 30
  // baseline. An earlier as-of would still be a post-filing estimate window
  // with no days. With no data and no explicit date the filed date stands.
  let effAsOf = asOfDate ?? lastDate;
  if ((asOfDate || rows.length > 0) && effAsOf < DEFAULTS.postFilingStart) {
    effAsOf = DEFAULTS.postFilingStart;
  }

  // Known gap: the May 26 shelf (333-296212) authorizes an indeterminate
  // amount, so there is no filed remaining-capacity dollar figure. The
  // simulation still uses the May 26 424B5 $1B illustration as a modeling
  // cap, labeled estimated, not leftover registered capacity.
  //
  // The below-NAV issuance gate runs on FILED-basis NAV rolled forward with
  // modeled proceeds: the fund issues against its own board-determined NAV,
  // so the viewer's hypothetical re-marks must never change how many shares
  // the model says were actually sold.
  const postMay = simulatePostMay({
    rows,
    startDate: DEFAULTS.postFilingStart,
    asOfDate: effAsOf,
    participation: bridgeParticipation,
    commissionRate,
    capacityGross,
    startingNetAssets: FILED.netAssets + aprMayNet,
    startingShares: impliedFiledShares() + bridgeAprShares,
    minPremium,
  });

  // Expense drag: annualized rate over days since the filed as-of on
  // approximate average net assets (baseline plus half the proceeds raised).
  const days = daysBetween(FILED.asOf, effAsOf);
  const avgAssets = markedNetAssets + (aprMayNet + postMay.net) / 2;
  const drag = expenseDragAnnualRate * (days / 365) * avgAssets;

  const proFormaAssets = markedNetAssets + aprMayNet + postMay.net - drag;
  const proFormaShares = baselineShares + bridgeAprShares + postMay.shares;
  const proFormaNav = proFormaShares > 0 ? proFormaAssets / proFormaShares : 0;

  return {
    mode,
    filedNav,
    markedNav,
    asOfDate: effAsOf,
    days,
    participation: bridgeParticipation,
    aprMay: {
      shares: bridgeAprShares,
      avgPrice: bridgeAprPrice,
      gross: aprMayGross,
      net: aprMayNet,
      capped: aprMayCapped,
      priorRemaining,
    },
    postMay,
    drag,
    proFormaAssets,
    proFormaShares,
    proFormaNav,
    accretionPerShare: proFormaNav - markedNav,
  };
}
