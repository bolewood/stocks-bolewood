// EchoStar (NASDAQ: ECHO) SOTP constants and math.
// Numbers are from EchoStar 10-Q (period ended 2026-06-30, filed 2026-08-03),
// the AT&T close 8-K (2026-07-28), the Hughes Ch. 11 8-K (2026-08-03),
// SpaceX S-1 note F-26, and Ergen's Q2 2026 call (3 Aug 2026) for the post-AT&T cash stack.

export const SPECTRUM_CLOSE_ISO = "2027-11-30";
export const MS_PER_YEAR = 365.25 * 24 * 60 * 60 * 1000;

export const ECHO_SHARES_BASIC_M = 290.490708; // 159,142,240 A + 131,348,468 B as of 2026-07-21
export const ECHO_SHARES_DILUTED_M = 304.4; // Barron's convertibles overlay; 3.875% notes are ITM

export const SPACEX_FIXED_SHARES_M = 261.8; // post 5-for-1; contractual, not yet delivered
export const SPACEX_CONTRACT_PPS = 42.4;

export const SPACEX_PROCEEDS_B = 19.6;
export const ATT_PROCEEDS_B = 22.65;
export const SPECTRUM_PROCEEDS_B = SPACEX_PROCEEDS_B + ATT_PROCEEDS_B; // 42.25

export const POST_ATT_GROSS_CASH_B = 14.5; // Ergen: ~$14–15B after 7/28 close
export const FCC_TRUST_RESTRICTED_B = 2.4; // AT&T remitted to Wireless Creditor Trust
export const RESIDUAL_HOLDCO_DEBT_B = 5.0; // Ergen: non-Hughes debt SpaceX does not take out
export const SELLER_NOTES_B = 9.821; // 10-Q; repaid from SpaceX consideration — do not also subtract
export const PRE_DEAL_NET_DEBT_B = 27.7;

export const DEFAULT_NET_CASH_B =
  POST_ATT_GROSS_CASH_B - FCC_TRUST_RESTRICTED_B - RESIDUAL_HOLDCO_DEBT_B; // 7.1

export const DEFAULT_REMAINING_SPECTRUM_B = 11.0; // 700 MHz, CBRS, other — not AWS-3 (in SpaceX LPA)
export const DEFAULT_BOOST_B = 4.0;
export const DEFAULT_DBS_B = 0.3; // stalking-horse ~$300M
export const DEFAULT_HUGHES_B = 0; // free-fall Ch. 11; parent equity option-ish
export const DEFAULT_STUB_B = DEFAULT_BOOST_B + DEFAULT_DBS_B + DEFAULT_HUGHES_B;

export const DEFAULT_TAX_BASIS_B = 5.0;
export const DEFAULT_NOLS_B = 1.0;
export const DEFAULT_TAX_RATE = 25;
export const DEFAULT_TOWER_LEASE_B = 2.4;
export const DEFAULT_LIQUIDITY_DISCOUNT = 10; // delivery/lockup, not private-block
export const DEFAULT_CLOSE_PROBABILITY = 90; // FCC approved SpaceX 2026-05-12
export const DEFAULT_ANNUAL_DISCOUNT_RATE = 8;
export const DEFAULT_DISH_CURED = "yes"; // RSA; confirmation hearing 2026-10-13
export const DEFAULT_DISTRESS_HAIRCUT = 0;

export function yearsToClose(asOf = new Date(), closeIso = SPECTRUM_CLOSE_ISO) {
  const close = Date.parse(`${closeIso}T00:00:00Z`);
  const now = asOf instanceof Date ? asOf.getTime() : Date.parse(asOf);
  return Math.max(0, (close - now) / MS_PER_YEAR);
}

export function echoShareCountM(basis) {
  return basis === "diluted" ? ECHO_SHARES_DILUTED_M : ECHO_SHARES_BASIC_M;
}

export function allocateSpectrumTax({
  taxBasisB = DEFAULT_TAX_BASIS_B,
  nolsB = DEFAULT_NOLS_B,
  taxRate = DEFAULT_TAX_RATE,
  closeProbability = DEFAULT_CLOSE_PROBABILITY,
  pvFactor = 1,
} = {}) {
  const attW = ATT_PROCEEDS_B / SPECTRUM_PROCEEDS_B;
  const sxW = SPACEX_PROCEEDS_B / SPECTRUM_PROCEEDS_B;
  const attTaxableB = Math.max(0, ATT_PROCEEDS_B - taxBasisB * attW - nolsB * attW);
  const sxTaxableB = Math.max(0, SPACEX_PROCEEDS_B - taxBasisB * sxW - nolsB * sxW);
  const attTaxB = attTaxableB * (taxRate / 100);
  const sxTaxGrossB = sxTaxableB * (taxRate / 100);
  const sxTaxB = sxTaxGrossB * (closeProbability / 100) * pvFactor;
  return {
    attTaxableB,
    sxTaxableB,
    attTaxB,
    sxTaxGrossB,
    sxTaxB,
    corporateTaxB: attTaxB + sxTaxB,
  };
}

export function calculateEchoSotp({
  spcxPrice,
  echoPrice,
  shareCountBasis = "basic",
  liquidityDiscount = DEFAULT_LIQUIDITY_DISCOUNT,
  closeProbability = DEFAULT_CLOSE_PROBABILITY,
  annualDiscountRate = DEFAULT_ANNUAL_DISCOUNT_RATE,
  spectrumB = DEFAULT_REMAINING_SPECTRUM_B,
  netCashB = DEFAULT_NET_CASH_B,
  boostB = DEFAULT_BOOST_B,
  dbsB = DEFAULT_DBS_B,
  hughesB = DEFAULT_HUGHES_B,
  taxBasisB = DEFAULT_TAX_BASIS_B,
  nolsB = DEFAULT_NOLS_B,
  taxRate = DEFAULT_TAX_RATE,
  towerLeaseB = DEFAULT_TOWER_LEASE_B,
  cured = DEFAULT_DISH_CURED,
  distressHaircut = DEFAULT_DISTRESS_HAIRCUT,
  preDealDistress = false,
  asOf = new Date(),
} = {}) {
  const sharesM = echoShareCountM(shareCountBasis);
  const shares = sharesM * 1_000_000;
  const timeToClose = yearsToClose(asOf);
  const pvFactor = 1 / Math.pow(1 + annualDiscountRate / 100, timeToClose);
  const closeProbFactor = closeProbability / 100;

  const grossSpaceXVal = SPACEX_FIXED_SHARES_M * spcxPrice * 1_000_000;
  const liquidityDiscountVal = grossSpaceXVal * (liquidityDiscount / 100);
  const grossSpaceXAfterLiquidity = grossSpaceXVal - liquidityDiscountVal;
  const netSpaceXVal = grossSpaceXAfterLiquidity * closeProbFactor * pvFactor;
  const closingTimingDiscountVal = grossSpaceXAfterLiquidity - netSpaceXVal;

  const spectrumValM = spectrumB * 1_000_000_000;
  const activeCashB = preDealDistress ? -PRE_DEAL_NET_DEBT_B : netCashB;
  const netCashValM = activeCashB * 1_000_000_000;
  const boostValM = boostB * 1_000_000_000;
  const dbsValM = dbsB * 1_000_000_000;
  const hughesValM = hughesB * 1_000_000_000;
  const stubValM = boostValM + dbsValM + hughesValM;

  const perShare = (n) => n / shares;

  const tax = allocateSpectrumTax({
    taxBasisB,
    nolsB,
    taxRate,
    closeProbability,
    pvFactor,
  });
  const corporateTaxVal = tax.corporateTaxB * 1_000_000_000;
  const attTaxVal = tax.attTaxB * 1_000_000_000;
  const spacexTaxVal = tax.sxTaxB * 1_000_000_000;

  const towerLeaseCostsM = towerLeaseB * 1_000_000_000;

  const preTaxGrossTotalM = grossSpaceXVal + spectrumValM + netCashValM + stubValM;
  const preTaxDiscountedTotalM = netSpaceXVal + spectrumValM + netCashValM + stubValM;
  const preDistressNavM = preTaxDiscountedTotalM - corporateTaxVal - towerLeaseCostsM;
  const distressHaircutAmt =
    cured === "no" ? preDistressNavM * (distressHaircut / 100) : 0;
  const riskAdjustedTotalM = preDistressNavM - distressHaircutAmt;

  const marketCap = echoPrice * shares;
  const preDealDebt = PRE_DEAL_NET_DEBT_B * 1_000_000_000;
  const ev = preDealDistress
    ? marketCap + preDealDebt - spectrumValM - stubValM
    : marketCap - netCashValM - spectrumValM - stubValM + corporateTaxVal + towerLeaseCostsM;
  const effectiveSpcxCostPerShare = ev / (SPACEX_FIXED_SHARES_M * 1_000_000);

  return {
    sharesOutstanding: sharesM,
    timeToClose,
    pvFactor,
    grossSpaceXVal,
    grossSpaceXPerEchoShare: perShare(grossSpaceXVal),
    liquidityDiscountVal,
    liquidityDiscountPerEchoShare: perShare(liquidityDiscountVal),
    netSpaceXVal,
    netSpaceXPerEchoShare: perShare(netSpaceXVal),
    closingTimingDiscountVal,
    closingTimingDiscountPerEchoShare: perShare(closingTimingDiscountVal),
    spectrumValM,
    spectrumPerEchoShare: perShare(spectrumValM),
    netCashValM,
    netCashPerEchoShare: perShare(netCashValM),
    boostValM,
    dbsValM,
    hughesValM,
    stubValM,
    stubPerEchoShare: perShare(stubValM),
    preTaxGrossTotalM,
    preTaxGrossPerEchoShare: perShare(preTaxGrossTotalM),
    preTaxDiscountedTotalM,
    preTaxDiscountedPerEchoShare: perShare(preTaxDiscountedTotalM),
    attTaxVal,
    spacexTaxVal,
    corporateTaxVal,
    corporateTaxPerEchoShare: perShare(corporateTaxVal),
    towerLeaseCostsM,
    towerLeaseCostsPerEchoShare: perShare(towerLeaseCostsM),
    distressHaircutAmt,
    distressHaircutPerEchoShare: perShare(distressHaircutAmt),
    riskAdjustedTotalM,
    riskAdjustedPerEchoShare: perShare(riskAdjustedTotalM),
    marketCap,
    ev,
    effectiveSpcxCostPerShare,
  };
}
