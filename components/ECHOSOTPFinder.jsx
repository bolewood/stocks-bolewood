"use client";

import React, { useState, useMemo, useEffect } from "react";
import { startJsonPoll } from "../lib/pollLivePrices.mjs";

// ECHO SOTP / SpaceX Proxy Calculator (ticker changed from SATS on 6/24/26)
// Sources: SpaceX Form S-1 F-26, EchoStar SEC filings (10-K, 10-Q), Barron's (6/12/26, 7/8/26)

const DEFAULT_ECHO_PRICE = 88.58; // 2026-08-19; live-fetched on load
const DEFAULT_SPCX_PRICE = 138.62; // 2026-08-19; live-fetched on base
const ECHO_SHARES_BASIC = 289.8; // million shares (Class A + B estimate)
const ECHO_SHARES_DILUTED = 304.4; // million shares (assuming convertible bond conversion per Barron's)
const SPACEX_FIXED_SHARES_M = 261.8; // million shares post-split (F-26 note)
const SPECTRUM_PROCEEDS_B = 42.25; // billion (SpaceX $19.6B + AT&T $22.65B)

const fmt$ = (n) =>
  n >= 1e9
    ? `$${(n / 1e9).toFixed(2)}B`
    : n >= 1e6
    ? `$${(n / 1e6).toFixed(1)}M`
    : n >= 1e3
    ? `$${(n / 1e3).toFixed(1)}K`
    : `$${n.toFixed(0)}`;

const fmt$exact = (n) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);

const fmtNum = (n) => new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(n);

export default function ECHOSOTPFinder() {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 720);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  // Track which preset scenario is active (null = custom/manual edits)
  const [activeScenario, setActiveScenario] = useState("base");

  // Global inputs
  const [spcxPrice, setSpcxPrice] = useState(DEFAULT_SPCX_PRICE); // master driver (post-split SPCX price; live-fetched on base)
  const [echoPrice, setEchoPrice] = useState(DEFAULT_ECHO_PRICE); // current ECHO market price (live-fetched)
  const [shareCountBasis, setShareCountBasis] = useState("basic"); // "basic" or "diluted"

  // Section 01: SpaceX Stake discounts
  const [liquidityDiscount, setLiquidityDiscount] = useState(20); // 0-30%
  const [closeProbability, setCloseProbability] = useState(85); // 50-100%
  const [annualDiscountRate, setAnnualDiscountRate] = useState(8); // 0-15%

  // Section 02: Other Parts
  const [spectrumVal, setSpectrumVal] = useState(11.0); // $B (Remaining spectrum)
  const [netCashVal, setNetCashVal] = useState(4.7); // $B (Pro-forma net cash)
  const [stubVal, setStubVal] = useState(6.0); // $B (Operating stub DISH/Hughes/Boost)

  // Section 03: Risk Deductions
  const [taxBasis, setTaxBasis] = useState(5.0); // $B (Spectrum tax basis)
  const [nols, setNols] = useState(1.0); // $B (Available NOLs)
  const [taxRate, setTaxRate] = useState(25); // 0-28% (Effective corporate tax rate)

  // Tower lease termination costs
  const [towerLeaseCosts, setTowerLeaseCosts] = useState(2.40); // $B (Tower lease termination liability)

  // Credit default risk
  const [cured, setCured] = useState("no"); // "yes" = DBS prepack exits on plan (no haircut), "no" = contested/prolonged (haircut applied)
  const [distressHaircut, setDistressHaircut] = useState(20); // 0-50%
  const [preDealDistress, setPreDealDistress] = useState(false); // Simulate pre-deal Net Debt of $27.7B

  // Real-time price state
  const [priceSource, setPriceSource] = useState("default"); // "live", "partial", "fallback", "default"
  const [liveSpcx, setLiveSpcx] = useState(null); // last live SPCX quote, so re-clicking Base stays live
  const [liveEcho, setLiveEcho] = useState(null); // last live ECHO quote — presets must not revert the market price to a dated constant

  // Chart settings
  const [heatmapColMode, setHeatmapColMode] = useState("tax"); // "tax" or "liquidity"
  const [barChartMode, setBarChartMode] = useState("pre-after"); // "pre-after" toggle
  const [activeModalChart, setActiveModalChart] = useState(null); // 'waterfall' or 'heatmap' or null

  const updateURL = (scenarioKey) => {
    const url = new URL(window.location);
    if (scenarioKey && scenarioKey !== "base") {
      url.searchParams.set("scenario", scenarioKey);
    } else {
      url.searchParams.delete("scenario");
    }
    window.history.replaceState({}, "", url);
  };

  const applyBase = () => {
    setSpcxPrice(liveSpcx ?? DEFAULT_SPCX_PRICE);
    setEchoPrice(liveEcho ?? DEFAULT_ECHO_PRICE);
    setShareCountBasis("basic");
    setLiquidityDiscount(20);
    setCloseProbability(85);
    setAnnualDiscountRate(8);
    setSpectrumVal(11.0);
    setNetCashVal(4.7);
    setStubVal(6.0);
    setTaxBasis(5.0);
    setNols(1.0);
    setTaxRate(25);
    setTowerLeaseCosts(2.40);
    setCured("no");
    setDistressHaircut(20);
    setPreDealDistress(false);
    setActiveScenario("base");
    updateURL("base");
  };

  const applyBull = () => {
    setSpcxPrice(175);
    setEchoPrice(liveEcho ?? DEFAULT_ECHO_PRICE);
    setShareCountBasis("basic");
    setLiquidityDiscount(20);
    setCloseProbability(90);
    setAnnualDiscountRate(5);
    setSpectrumVal(11.0);
    setNetCashVal(4.7);
    setStubVal(6.0);
    setTaxBasis(5.0);
    setNols(1.0);
    setTaxRate(15);
    setTowerLeaseCosts(2.40);
    setCured("yes");
    setDistressHaircut(0);
    setPreDealDistress(false);
    setActiveScenario("bull");
    updateURL("bull");
  };

  const applyMoon = () => {
    setSpcxPrice(200);
    setEchoPrice(liveEcho ?? DEFAULT_ECHO_PRICE);
    setShareCountBasis("basic");
    setLiquidityDiscount(10);
    setCloseProbability(95);
    setAnnualDiscountRate(3);
    setSpectrumVal(11.0);
    setNetCashVal(4.7);
    setStubVal(6.0);
    setTaxBasis(5.0);
    setNols(1.0);
    setTaxRate(0); // tax-deferred structure fully realized
    setTowerLeaseCosts(2.40);
    setCured("yes");
    setDistressHaircut(0);
    setPreDealDistress(false);
    setActiveScenario("moon");
    updateURL("moon");
  };

  const applyBear = () => {
    setSpcxPrice(135);
    setEchoPrice(liveEcho ?? DEFAULT_ECHO_PRICE);
    setShareCountBasis("diluted"); // include bond conversion dilution
    setLiquidityDiscount(30);
    setCloseProbability(70);
    setAnnualDiscountRate(12);
    setSpectrumVal(10.0); // analyst lower spectrum mark
    setNetCashVal(2.0); // lower cash build
    setStubVal(0.0); // zero value operating business bear case
    setTaxBasis(3.0); // lower basis = higher tax
    setNols(1.0);
    setTaxRate(28);
    setTowerLeaseCosts(2.40);
    setCured("no");
    setDistressHaircut(25);
    setPreDealDistress(true); // deal stress / pre-deal net debt
    setActiveScenario("bear");
    updateURL("bear");
  };

  const applyTakeout = () => {
    setSpcxPrice(175);
    setEchoPrice(liveEcho ?? DEFAULT_ECHO_PRICE);
    setShareCountBasis("diluted");
    setLiquidityDiscount(0); // acquired direct; zero illiquidity
    setCloseProbability(100);
    setAnnualDiscountRate(0);
    setSpectrumVal(11.0);
    setNetCashVal(4.7);
    setStubVal(8.0); // premium for Boost buyout
    setTaxBasis(5.0);
    setNols(1.0);
    setTaxRate(0); // structured as tax-free stock-for-stock swap
    setTowerLeaseCosts(0); // assumed absorbed by acquirer
    setCured("yes");
    setDistressHaircut(0);
    setPreDealDistress(false);
    setActiveScenario("takeout");
    updateURL("takeout");
  };

  // Read scenario from URL on mount + fetch real-time ECHO market price
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const scenario = params.get("scenario");
    if (scenario === "bull") {
      applyBull();
    } else if (scenario === "moon") {
      applyMoon();
    } else if (scenario === "bear") {
      applyBear();
    } else if (scenario === "takeout") {
      applyTakeout();
    } else {
      applyBase();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    return startJsonPoll("/api/prices", {
      onData: (data) => {
        if (data.prices?.ECHO) {
          setEchoPrice(data.prices.ECHO);
          setLiveEcho(data.prices.ECHO);
        }
        if (data.prices?.SPCX) setLiveSpcx(data.prices.SPCX);
        const scenario = new URLSearchParams(window.location.search).get(
          "scenario"
        );
        const isBaseScenario = !scenario || scenario === "base";
        if (isBaseScenario && data.prices?.SPCX) setSpcxPrice(data.prices.SPCX);
        setPriceSource(data.source || "fallback");
      },
      onError: () => setPriceSource("fallback"),
    });
  }, []);

  const handleManualEdit = () => {
    setActiveScenario(null);
  };

  const calc = useMemo(() => {
    const sharesOutstanding = shareCountBasis === "basic" ? ECHO_SHARES_BASIC : ECHO_SHARES_DILUTED;

    // Gross SpaceX Stake
    const grossSpaceXVal = SPACEX_FIXED_SHARES_M * spcxPrice * 1_000_000; // $ value
    const grossSpaceXPerEchoShare = grossSpaceXVal / (sharesOutstanding * 1_000_000);

    // Liquidity Discount
    const liquidityDiscountVal = grossSpaceXVal * (liquidityDiscount / 100);
    const liquidityDiscountPerEchoShare = liquidityDiscountVal / (sharesOutstanding * 1_000_000);

    // Timing/Closing Discount (1.46 years to Nov 30, 2027 closing date)
    const timeToClose = 1.4658; // years
    const pvFactor = 1 / Math.pow(1 + annualDiscountRate / 100, timeToClose);
    const closeProbFactor = closeProbability / 100;
    const combinedCloseDiscountFactor = closeProbFactor * pvFactor;
    
    const grossSpaceXAfterLiquidity = grossSpaceXVal - liquidityDiscountVal;
    const netSpaceXVal = grossSpaceXAfterLiquidity * combinedCloseDiscountFactor;
    const netSpaceXPerEchoShare = netSpaceXVal / (sharesOutstanding * 1_000_000);
    const closingTimingDiscountVal = grossSpaceXAfterLiquidity - netSpaceXVal;
    const closingTimingDiscountPerEchoShare = closingTimingDiscountVal / (sharesOutstanding * 1_000_000);

    // Other Parts
    const spectrumValM = spectrumVal * 1_000_000_000;
    const spectrumPerEchoShare = spectrumValM / (sharesOutstanding * 1_000_000);

    const activeCashVal = preDealDistress ? -27.7 : netCashVal; // swap cash with pre-deal net debt if toggled
    const netCashValM = activeCashVal * 1_000_000_000;
    const netCashPerEchoShare = netCashValM / (sharesOutstanding * 1_000_000);

    const stubValM = stubVal * 1_000_000_000;
    const stubPerEchoShare = stubValM / (sharesOutstanding * 1_000_000);

    // Pre-Tax SOTP Total (Gross vs Discounted)
    const preTaxGrossTotalM = grossSpaceXVal + spectrumValM + netCashValM + stubValM;
    const preTaxGrossPerEchoShare = preTaxGrossTotalM / (sharesOutstanding * 1_000_000);

    const preTaxDiscountedTotalM = netSpaceXVal + spectrumValM + netCashValM + stubValM;
    const preTaxDiscountedPerEchoShare = preTaxDiscountedTotalM / (sharesOutstanding * 1_000_000);

    // Risk Deductions
    // Spectrum corporate tax on gain
    const proceedsM = SPECTRUM_PROCEEDS_B * 1_000_000_000;
    const taxBasisM = taxBasis * 1_000_000_000;
    const nolsM = nols * 1_000_000_000;
    const taxableGain = Math.max(0, proceedsM - taxBasisM - nolsM);
    const corporateTaxVal = taxableGain * (taxRate / 100);
    const corporateTaxPerEchoShare = corporateTaxVal / (sharesOutstanding * 1_000_000);

    // Tower lease termination costs
    const towerLeaseCostsM = towerLeaseCosts * 1_000_000_000;
    const towerLeaseCostsPerEchoShare = towerLeaseCostsM / (sharesOutstanding * 1_000_000);

    // Credit overlay / distress haircut
    const preDistressNavM = preTaxDiscountedTotalM - corporateTaxVal - towerLeaseCostsM;
    const distressHaircutAmt = cured === "no" ? preDistressNavM * (distressHaircut / 100) : 0;
    const distressHaircutPerEchoShare = distressHaircutAmt / (sharesOutstanding * 1_000_000);

    // Risk-Adjusted SOTP Total (After tax + tower leases + credit)
    const riskAdjustedTotalM = preDistressNavM - distressHaircutAmt;
    const riskAdjustedPerEchoShare = riskAdjustedTotalM / (sharesOutstanding * 1_000_000);

    // Market Metrics
    const marketCap = echoPrice * sharesOutstanding * 1_000_000;
    
    // Implied cost per SPCX share (EV / 261.8M)
    // ECHO EV = Market Cap + Net Debt (or - Net Cash) - Spectrum - Stub [+ Tax]
    const preDealDebt = 27.7 * 1_000_000_000;
    const ev = preDealDistress
      ? (marketCap + preDealDebt - spectrumValM - stubValM)
      : (marketCap - netCashValM - spectrumValM - stubValM + corporateTaxVal + towerLeaseCostsM);
    const effectiveSpcxCostPerShare = ev / (SPACEX_FIXED_SHARES_M * 1_000_000);

    return {
      sharesOutstanding,
      grossSpaceXVal,
      grossSpaceXPerEchoShare,
      liquidityDiscountVal,
      liquidityDiscountPerEchoShare,
      netSpaceXVal,
      netSpaceXPerEchoShare,
      closingTimingDiscountVal,
      closingTimingDiscountPerEchoShare,
      spectrumValM,
      spectrumPerEchoShare,
      netCashValM,
      netCashPerEchoShare,
      stubValM,
      stubPerEchoShare,
      preTaxGrossTotalM,
      preTaxGrossPerEchoShare,
      preTaxDiscountedTotalM,
      preTaxDiscountedPerEchoShare,
      corporateTaxVal,
      corporateTaxPerEchoShare,
      towerLeaseCostsM,
      towerLeaseCostsPerEchoShare,
      distressHaircutAmt,
      distressHaircutPerEchoShare,
      riskAdjustedTotalM,
      riskAdjustedPerEchoShare,
      marketCap,
      ev,
      effectiveSpcxCostPerShare
    };
  }, [
    spcxPrice,
    echoPrice,
    shareCountBasis,
    liquidityDiscount,
    closeProbability,
    annualDiscountRate,
    spectrumVal,
    netCashVal,
    stubVal,
    taxBasis,
    nols,
    taxRate,
    towerLeaseCosts,
    cured,
    distressHaircut,
    preDealDistress
  ]);

  // Helper to calculate cell value dynamically for the sensitivity heatmap
  const calculateCellNAV = (rowSPCX, colVal) => {
    const cellShares = shareCountBasis === "basic" ? ECHO_SHARES_BASIC : ECHO_SHARES_DILUTED;
    const cellGrossSpaceX = SPACEX_FIXED_SHARES_M * rowSPCX * 1_000_000;
    
    let cellLiquidityDiscount = liquidityDiscount;
    let cellTaxRate = taxRate;
    
    if (heatmapColMode === "tax") {
      cellTaxRate = colVal;
    } else {
      cellLiquidityDiscount = colVal;
    }
    
    const cellLiquidityDiscountAmt = cellGrossSpaceX * (cellLiquidityDiscount / 100);
    const cellPvFactor = 1 / Math.pow(1 + annualDiscountRate / 100, 1.4658);
    const cellCloseProbFactor = closeProbability / 100;
    const cellNetSpaceX = (cellGrossSpaceX - cellLiquidityDiscountAmt) * cellCloseProbFactor * cellPvFactor;
    
    const cellSpectrumValM = spectrumVal * 1_000_000_000;
    const cellActiveCash = preDealDistress ? -27.7 : netCashVal;
    const cellNetCashValM = cellActiveCash * 1_000_000_000;
    const cellStubValM = stubVal * 1_000_000_000;
    
    const cellPreTaxDiscountedTotalM = cellNetSpaceX + cellSpectrumValM + cellNetCashValM + cellStubValM;
    
    // Tax
    const cellProceedsM = SPECTRUM_PROCEEDS_B * 1_000_000_000;
    const cellTaxBasisM = taxBasis * 1_000_000_000;
    const cellNolsM = nols * 1_000_000_000;
    const cellTaxableGain = Math.max(0, cellProceedsM - cellTaxBasisM - cellNolsM);
    const cellCorporateTaxVal = cellTaxableGain * (cellTaxRate / 100);

    // Tower lease costs
    const cellTowerLeaseCostsM = towerLeaseCosts * 1_000_000_000;
    
    // Credit overlay
    const cellPreDistressNav = cellPreTaxDiscountedTotalM - cellCorporateTaxVal - cellTowerLeaseCostsM;
    const cellDistressHaircutAmt = cured === "no" ? cellPreDistressNav * (distressHaircut / 100) : 0;
    
    const cellRiskAdjustedTotalM = cellPreDistressNav - cellDistressHaircutAmt;
    return cellRiskAdjustedTotalM / (cellShares * 1_000_000);
  };

  // Heatmap configuration
  const spcxPriceRows = [135, 155, 175, 195, 215, 235, 255];
  const colValsTax = [0, 10, 15, 20, 25, 28]; // tax rates
  const colValsLiquidity = [0, 5, 10, 15, 20, 30]; // liquidity discounts
  const activeCols = heatmapColMode === "tax" ? colValsTax : colValsLiquidity;

  // Waterfall Chart Math
  const postTaxStart = calc.preTaxDiscountedPerEchoShare - calc.corporateTaxPerEchoShare;
  const postTowerStart = postTaxStart - calc.towerLeaseCostsPerEchoShare;
  const waterfallSteps = [
    { label: "SpaceX Gross", val: calc.grossSpaceXPerEchoShare, start: 0, end: calc.grossSpaceXPerEchoShare, type: "start" },
    { label: "Liquidity Disc.", val: -calc.liquidityDiscountPerEchoShare, start: calc.grossSpaceXPerEchoShare, end: calc.grossSpaceXPerEchoShare - calc.liquidityDiscountPerEchoShare, type: "subtract" },
    { label: "Timing Disc.", val: -calc.closingTimingDiscountPerEchoShare, start: calc.grossSpaceXPerEchoShare - calc.liquidityDiscountPerEchoShare, end: calc.netSpaceXPerEchoShare, type: "subtract" },
    { label: "Spectrum", val: calc.spectrumPerEchoShare, start: calc.netSpaceXPerEchoShare, end: calc.netSpaceXPerEchoShare + calc.spectrumPerEchoShare, type: "add" },
    { label: "Net Cash/Debt", val: calc.netCashPerEchoShare, start: calc.netSpaceXPerEchoShare + calc.spectrumPerEchoShare, end: calc.netSpaceXPerEchoShare + calc.spectrumPerEchoShare + calc.netCashPerEchoShare, type: calc.netCashPerEchoShare >= 0 ? "add" : "subtract" },
    { label: "Operating Stub", val: calc.stubPerEchoShare, start: calc.netSpaceXPerEchoShare + calc.spectrumPerEchoShare + calc.netCashPerEchoShare, end: calc.preTaxDiscountedPerEchoShare, type: "add" },
    { label: "Spectrum Tax", val: -calc.corporateTaxPerEchoShare, start: calc.preTaxDiscountedPerEchoShare, end: postTaxStart, type: "subtract" },
    { label: "Tower Leases", val: -calc.towerLeaseCostsPerEchoShare, start: postTaxStart, end: postTowerStart, type: "subtract" },
    { label: "Credit default", val: -calc.distressHaircutPerEchoShare, start: postTowerStart, end: calc.riskAdjustedPerEchoShare, type: "subtract" },
    { label: "Risk-Adj NAV", val: calc.riskAdjustedPerEchoShare, start: 0, end: calc.riskAdjustedPerEchoShare, type: "end" }
  ];

  const waterfallMax = Math.max(...waterfallSteps.flatMap(s => [s.start, s.end]), echoPrice) * 1.12;

  const renderWaterfallSVG = (isModal) => {
    const priceLineY = 260 - (echoPrice / waterfallMax) * 230;
    const showPriceLine = priceLineY >= 20 && priceLineY <= 290;
    const priceCalloutTextY = 20;

    return (
      <svg viewBox="0 0 800 340" width="100%" height="100%" preserveAspectRatio="xMidYMid meet">
        {/* Grid Lines */}
        {[0, 0.25, 0.5, 0.75, 1.0].map((ratio) => {
          const val = waterfallMax * ratio;
          const y = 260 - ratio * 230;
          return (
            <g key={ratio}>
              <line x1="60" y1={y} x2="760" y2={y} stroke="#e7e5e4" strokeWidth="1" strokeDasharray="2 2" />
              <text x="50" y={y + 4} fill="#78716c" fontSize="10" fontFamily="monospace" textAnchor="end">
                ${val.toFixed(0)}
              </text>
            </g>
          );
        })}

        {/* ECHO Price Line */}
        {(() => {
          if (!showPriceLine) return null;
          return (
            <g>
              <line x1="60" y1={priceLineY} x2="760" y2={priceLineY} stroke="#d97706" strokeWidth="2" strokeDasharray="4 4" />
              <rect x="620" y={priceCalloutTextY - 12} width="130" height="16" fill="#fef3c7" stroke="#d97706" strokeWidth="1" />
              <text x="685" y={priceCalloutTextY} fill="#78350f" fontSize="10" fontFamily="monospace" fontWeight="bold" textAnchor="middle">
                ECHO Price: ${echoPrice.toFixed(2)}
              </text>
            </g>
          );
        })()}

        {/* Render Bars */}
        {waterfallSteps.map((b, idx) => {
          const x = 65 + idx * 68;
          const barWidth = 38;
          const yStart = 260 - (b.start / waterfallMax) * 230;
          const yEnd = 260 - (b.end / waterfallMax) * 230;
          
          const y = Math.min(yStart, yEnd);
          const h = Math.max(2, Math.abs(yStart - yEnd));
          
          let fill = "#1c1917"; // starting/ending neutral
          if (b.type === "add") fill = "#15803d"; // positive green
          if (b.type === "subtract") fill = "#b91c1c"; // negative red
          if (b.type === "end") fill = "#fbbf24"; // NAV yellow

          const displayVal = (b.val >= 0 ? "+" : "") + b.val.toFixed(2);
          const valueLabelY = b.type === "end" && showPriceLine && y - 6 > priceLineY - 34 && y - 6 < priceLineY + 20
            ? Math.max(14, priceLineY - 34)
            : y - 6;

          return (
            <g key={b.label} className="waterfall-bar">
              {/* Bar Rect */}
              <rect
                x={x}
                y={y}
                width={barWidth}
                height={h}
                fill={fill}
                stroke={b.type === "end" ? "#1c1917" : "none"}
                strokeWidth="1.5"
              />
              {/* Value label */}
              <text
                x={x + barWidth / 2}
                y={valueLabelY}
                fill="#1c1917"
                fontSize="9"
                fontFamily="monospace"
                fontWeight="bold"
                textAnchor="middle"
              >
                {b.val !== 0 ? displayVal : "—"}
              </text>
              {/* X-axis Label */}
              <text
                x={x + barWidth / 2}
                y="280"
                fill="#78716c"
                fontSize="8.5"
                fontFamily="'JetBrains Mono', monospace"
                fontWeight="500"
                textAnchor="end"
                transform={`rotate(-35, ${x + barWidth / 2}, 280)`}
              >
                {b.label}
              </text>
            </g>
          );
        })}
        {/* Baseline axis */}
        <line x1="60" y1="260" x2="760" y2="260" stroke="#1c1917" strokeWidth="1.5" />
      </svg>
    );
  };

  const renderHeatmapGrid = (isModal) => {
    return (
      <div style={{ ...styles.heatmapGrid, ...(isModal ? { gridTemplateColumns: "160px repeat(6, 1fr)" } : {}) }}>
        {/* Header Row */}
        <div style={styles.heatmapHeaderCell}>SPCX / {heatmapColMode === "tax" ? "Tax" : "Liq. Disc"}</div>
        {activeCols.map((colVal) => (
          <div key={colVal} style={styles.heatmapHeaderCell}>
            {colVal}%
          </div>
        ))}

        {/* Rows */}
        {spcxPriceRows.map((rowSPCX) => {
          // Nearest row wins — a fixed ±5 threshold left no active row when the
          // live SPCX price (or the $200 Moon preset) fell between grid rows.
          const nearestRow = spcxPriceRows.reduce((a, b) => (Math.abs(b - spcxPrice) < Math.abs(a - spcxPrice) ? b : a));
          const isSelectedRow = rowSPCX === nearestRow;
          return (
            <React.Fragment key={rowSPCX}>
              {/* Row SPCX Price */}
              <div style={{
                ...styles.heatmapRowHeaderCell,
                ...(isSelectedRow ? styles.heatmapSelectedRowLabel : {}),
                ...(isModal ? { fontSize: "12px", padding: "10px 4px" } : {})
              }}>
                {isSelectedRow ? "👉 " : ""}${rowSPCX} {rowSPCX === 135 ? "(IPO)" : ""}
              </div>
              {/* Cells */}
              {activeCols.map((colVal) => {
                const cellVal = calculateCellNAV(rowSPCX, colVal);
                const premiumPercent = ((cellVal / echoPrice) - 1) * 100;
                const isUpside = cellVal > echoPrice;
                
                // Calculate opacity based on premium/discount size
                const diffRatio = Math.min(1.0, Math.abs(premiumPercent) / 100);
                const bgOpacity = 0.05 + diffRatio * 0.8;
                const backgroundColor = isUpside
                  ? `rgba(21, 128, 61, ${bgOpacity})`  // Green
                  : `rgba(185, 28, 28, ${bgOpacity})`; // Red

                const isCurrentInputCell = 
                  (rowSPCX === spcxPriceRows.reduce((a, b) => (Math.abs(b - spcxPrice) < Math.abs(a - spcxPrice) ? b : a))) && 
                  (heatmapColMode === "tax" 
                    ? Math.abs(colVal - taxRate) < 1 
                    : Math.abs(colVal - liquidityDiscount) < 1);

                return (
                  <div
                    key={colVal}
                    style={{
                      ...styles.heatmapCell,
                      backgroundColor,
                      color: bgOpacity > 0.5 ? "#fff" : "#1c1917",
                      border: isCurrentInputCell ? "3px solid #d97706" : "1px solid #e7e5e4",
                      ...(isModal ? { padding: "12px 8px" } : {})
                    }}
                    title={`SPCX: $${rowSPCX}, ${heatmapColMode === "tax" ? "Tax" : "Liq"}: ${colVal}%. SOTP NAV: $${cellVal.toFixed(2)} (${premiumPercent.toFixed(0)}% vs market)`}
                  >
                    <div style={{ fontWeight: "bold", fontSize: isModal ? "14px" : "12px" }}>${cellVal.toFixed(0)}</div>
                    <div style={{ fontSize: isModal ? "10px" : "9px", opacity: 0.85, fontVariantNumeric: "tabular-nums" }}>
                      {premiumPercent >= 0 ? "+" : ""}{premiumPercent.toFixed(0)}%
                    </div>
                  </div>
                );
              })}
            </React.Fragment>
          );
        })}
      </div>
    );
  };

  const renderChartModal = () => {
    if (!activeModalChart) return null;

    return (
      <div style={styles.modalOverlay} onClick={() => setActiveModalChart(null)}>
        <div style={styles.modalContent} className="echo-modal-content" onClick={(e) => e.stopPropagation()}>
          <button style={styles.modalCloseBtn} onClick={() => setActiveModalChart(null)}>
            ✕ Close
          </button>
          
          {activeModalChart === "waterfall" ? (
            <div>
              <div style={styles.modalChartHeader} className="echo-chart-header">
                <span style={styles.sectionNum}>VISUAL 01 (ENLARGED)</span>
                <h3 style={{ ...styles.chartTitle, fontSize: "20px" }}>ECHO SOTP Bridge ($ / Share)</h3>
              </div>
              <div style={{ position: "relative", width: "100%", height: "480px", background: "#fefdf8", border: "1px solid #e7e5e4", padding: "24px", marginTop: "16px" }}>
                {renderWaterfallSVG(true)}
              </div>
            </div>
          ) : (
            <div>
              <div style={styles.modalChartHeader} className="echo-chart-header">
                <span style={styles.sectionNum}>VISUAL 02 (ENLARGED)</span>
                <h3 style={{ ...styles.chartTitle, fontSize: "20px" }}>NAV Sensitivity Matrix</h3>
                <div style={{ marginLeft: "auto", display: "flex", gap: "6px" }}>
                  <button
                    onClick={(e) => { e.stopPropagation(); setHeatmapColMode("tax"); }}
                    style={{
                      ...styles.toggleBtn,
                      ...(heatmapColMode === "tax" ? styles.toggleBtnActive : {})
                    }}
                  >
                    vs Spectrum Tax
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); setHeatmapColMode("liquidity"); }}
                    style={{
                      ...styles.toggleBtn,
                      ...(heatmapColMode === "liquidity" ? styles.toggleBtnActive : {})
                    }}
                  >
                    vs Liq. Discount
                  </button>
                </div>
              </div>
              <div style={{ ...styles.heatmapTableContainer, padding: "24px 0", marginTop: "16px" }}>
                {renderHeatmapGrid(true)}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div style={styles.container} className="vcx-container echo-container">
      
      {/* HEADER */}
      <div style={styles.header}>
        <div style={styles.eyebrow} className="vcx-eyebrow">
          ECHOSTAR CORP · NASDAQ: ECHO (FORMERLY SATS, CHANGED 6/24/26) · SUM-OF-THE-PARTS / SpaceX-PROXY CALCULATOR
        </div>
        <h1 style={styles.title} className="vcx-title">
          ECHO <span style={styles.titleAccent}>SOTP Finder</span>
        </h1>
        <p style={styles.subtitle} className="vcx-subtitle">
          EchoStar Corp (ECHO, formerly SATS — ticker changed June 24, 2026) is a satellite, pay-TV, and wireless spectrum company. ECHO has agreed to sell its key spectrum assets to AT&T (cash) and SpaceX (primarily SpaceX stock), making ECHO shares trade as a highly liquid proxy for SpaceX. On June 30, 2026 its DISH DBS pay-TV subsidiary and certain wireless units filed a prepackaged Chapter 11 (88% bondholder support, expected to exit by end of Q3) after the delayed AT&T closing left $2B of notes unpaid — the parent and its SpaceX stake sit outside the filing. This sum-of-the-parts (SOTP) model details the SpaceX re-rate upside against the hidden drags: corporate cash taxes on the spectrum transfer, closing timelines, and restructuring overlays. Inputs default to filed deal terms; modify them below to test your own thesis.
        </p>
      </div>

      {/* HOW IT WORKS */}
      <div style={styles.howToBox}>
        <div style={styles.howToTitle}>How this works in 30 seconds</div>
        <ol style={styles.howToList}>
          <li style={{ marginBottom: 6 }}>
            <strong>The core asset</strong> is the contractual 261.8M shares of SpaceX (post-split) delivered upon closing the spectrum sale (estimated November 30, 2027).
          </li>
          <li style={{ marginBottom: 6 }}>
            <strong>We apply haircuts</strong>: a liquidity discount for private stock block size, and a closing probability × time-value-of-money haircut for the 2027 lockup.
          </li>
          <li style={{ marginBottom: 6 }}>
            <strong>We add other parts</strong>: the value of remaining spectrum, operating assets (Dish, Boost, Hughes), and pro-forma cash.
          </li>
          <li style={{ marginBottom: 6 }}>
            <strong>We subtract liabilities</strong>: the heavy corporate C-corp tax on the $42.25B spectrum sale gain, and restructuring haircuts while the DISH DBS Chapter 11 and delayed AT&T closing play out.
          </li>
          <li>
            <strong>We compare the final NAV</strong> against ECHO's current stock price to find the implied proxy discount and effective price paid for SpaceX.
          </li>
        </ol>
      </div>

      {/* QUALITATIVE RISKS BLOCK */}
      <div style={styles.qualitativeContainer} className="echo-qualitative-container">
        <div style={styles.qualitativeCard}>
          <div style={styles.qualitativeHeader}>
            <span style={styles.qualitativeIcon}>⚠️</span>
            <strong> Charlie Ergen Key-Man & Governance Risk</strong>
          </div>
          <p style={styles.qualitativeText}>
            Charlie Ergen (73, controlling shareholder) holds super-voting shares, giving him total control of ECHO. He recently skipped the Q1 earnings call, sparking retail governance concerns. All deals, restructuring steps, and cash distributions are dependent on Ergen.
          </p>
        </div>
        <div style={styles.qualitativeCard}>
          <div style={styles.qualitativeHeader}>
            <span style={styles.qualitativeIcon}>🕒</span>
            <strong> Multi-Year Closing Delay (Nov 2027)</strong>
          </div>
          <p style={styles.qualitativeText}>
            The SpaceX equity block is not delivered until closing, expected ~November 30, 2027. ECHO is highly exposed to macro downturns, restructuring surprises, or SpaceX re-rates in the intervening 1.5+ years before ECHO actually holds the liquid stock.
          </p>
        </div>
        <div style={styles.qualitativeCard}>
          <div style={styles.qualitativeHeader}>
            <span style={styles.qualitativeIcon}>📉</span>
            <strong> Proxy-Unwind Demand Drop</strong>
          </div>
          <p style={styles.qualitativeText}>
            ECHO trades at a proxy discount because SpaceX is private. If SpaceX's direct stock (SPCX) starts trading actively in liquid public markets or list lockups expire, investors will buy SPCX directly, leading to an unwind of ECHO's proxy premium.
          </p>
        </div>
      </div>

      {/* GLOBAL INPUTS & CONTROLS */}
      <div style={styles.controls} className="vcx-controls">
        <div style={styles.controlGroup}>
          <label style={styles.label}>SPCX Price</label>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <input
              type="number"
              step="1"
              value={spcxPrice}
              onChange={(e) => { setSpcxPrice(parseFloat(e.target.value) || 0); handleManualEdit(); }}
              style={styles.smallInput}
              className="vcx-input vcx-small-input"
            />
          </div>
          <input
            type="range"
            min="50"
            max="300"
            step="5"
            value={spcxPrice}
            onChange={(e) => { setSpcxPrice(parseInt(e.target.value)); handleManualEdit(); }}
            style={{ width: "100%", marginTop: "8px", accentColor: "#d97706" }}
          />
        </div>

        <div style={styles.controlGroup}>
          <label style={styles.label}>ECHO Market Price ($)</label>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <input
              type="number"
              step="0.01"
              value={echoPrice}
              onChange={(e) => { setEchoPrice(parseFloat(e.target.value) || 0); handleManualEdit(); }}
              style={styles.smallInput}
              className="vcx-input vcx-small-input"
            />
            <span style={{
              fontSize: "10px",
              fontFamily: "monospace",
              padding: "2px 6px",
              borderRadius: "3px",
              border: `1px solid ${priceSource === "live" || priceSource === "cache" ? "#15803d" : priceSource === "partial" ? "#d97706" : "#78716c"}`,
              color: priceSource === "live" || priceSource === "cache" ? "#15803d" : priceSource === "partial" ? "#d97706" : "#78716c",
              background: priceSource === "live" || priceSource === "cache" ? "#f0fdf4" : priceSource === "partial" ? "#fffbeb" : "transparent"
            }}>
              {priceSource === "live" || priceSource === "cache" ? "● LIVE" : priceSource === "partial" ? "◐ PARTIAL" : priceSource === "fallback" ? "○ FALLBACK" : "○ DEFAULT"}
            </span>
          </div>
        </div>

        <div style={styles.controlGroup}>
          <label style={styles.label}>ECHO Share count base</label>
          <div style={{ display: "flex", gap: "12px", marginTop: "6px" }}>
            <label style={{ display: "flex", alignItems: "center", gap: "6px", cursor: "pointer", fontSize: "14px" }}>
              <input
                type="radio"
                name="shareBasis"
                checked={shareCountBasis === "basic"}
                onChange={() => { setShareCountBasis("basic"); handleManualEdit(); }}
                style={{ accentColor: "#d97706" }}
              />
              Basic (289.8M)
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: "6px", cursor: "pointer", fontSize: "14px" }}>
              <input
                type="radio"
                name="shareBasis"
                checked={shareCountBasis === "diluted"}
                onChange={() => { setShareCountBasis("diluted"); handleManualEdit(); }}
                style={{ accentColor: "#d97706" }}
              />
              Diluted (304.4M)
            </label>
          </div>
          <span style={{ ...styles.companyNote, fontSize: "11px", color: "#78716c", marginTop: "4px", display: "block" }}>
            Diluted includes bond conversion dilution risk noted by Barron's.
          </span>
        </div>
      </div>

      {/* SCENARIO CARD PRESETS */}
      <div style={{ marginBottom: "32px" }}>
        <div style={styles.howToTitle}>Preset Scenarios</div>
        <div style={styles.scenarioGrid} className="echo-scenario-grid">
          {[
            { key: "base", label: liveSpcx ? `Base — SPCX $${Math.round(liveSpcx)} (live)` : "Base — SPCX ~$150", desc: "Standard 20% liquidity disc., 25% tax rate, contested-restructuring haircut applied.", handler: applyBase },
            { key: "bull", label: "Bull — SPCX $175", desc: "SpaceX post-IPO re-rate to $175. Lower 15% tax (partial trust deferral), prepack exits on plan.", handler: applyBull },
            { key: "moon", label: "Moon — SPCX $200", desc: "SpaceX valuation hits $200 (~$3T) — the Citi case. 0% tax (trust restructure), prepack exits on plan.", handler: applyMoon },
            { key: "bear", label: "Bear — Restructuring Stress", desc: "Contested / prolonged prepack: 25% restructuring haircut. $2B cash, $0 stub.", handler: applyBear },
            { key: "takeout", label: "Takeout (buyout)", desc: "SpaceX acquires Boost/ECHO in tax-free stock swap (0% tax, 0% disc, $8B stub).", handler: applyTakeout }
          ].map(({ key, label, desc, handler }) => {
            const isActive = activeScenario === key;
            return (
              <button
                key={key}
                onClick={handler}
                style={{
                  ...styles.scenarioCard,
                  ...(isActive ? styles.scenarioCardActive : {})
                }}
              >
                {isActive && <span style={styles.activeDot} />}
                <div style={{ fontWeight: 700, fontSize: "14px", marginBottom: "4px" }}>{label}</div>
                <div style={{ fontSize: "12px", color: isActive ? "#fbbf24" : "#78716c", lineHeight: 1.3 }}>{desc}</div>
              </button>
            );
          })}
        </div>
      </div>

      {/* THREE INTERACTIVE CHARTS CARD */}
      <div style={styles.visualsBlock} className="echo-visuals-block">
        {/* SVG WATERFALL CHART */}
        <div 
          style={{ ...styles.chartCard, cursor: "zoom-in" }} 
          onClick={() => setActiveModalChart("waterfall")}
          title="Click to enlarge"
        >
          <div style={styles.chartHeader} className="echo-chart-header">
            <span style={styles.sectionNum}>VISUAL 01</span>
            <h3 style={styles.chartTitle}>ECHO SOTP Bridge ($ / Share)</h3>
            <span style={styles.zoomHint}>🔍 Click to enlarge</span>
          </div>
          <div style={{ position: "relative", width: "100%", height: "360px", background: "#fefdf8", border: "1px solid #e7e5e4", padding: "16px" }} className="echo-chart-container">
            {renderWaterfallSVG(false)}
          </div>
        </div>

        {/* HEATMAP */}
        <div 
          style={{ ...styles.chartCard, cursor: "zoom-in" }} 
          onClick={() => setActiveModalChart("heatmap")}
          title="Click to enlarge"
        >
          <div style={styles.chartHeader} className="echo-chart-header">
            <span style={styles.sectionNum}>VISUAL 02</span>
            <h3 style={styles.chartTitle}>NAV Sensitivity Matrix</h3>
            <span style={{ ...styles.zoomHint, marginRight: "12px" }}>🔍 Click to enlarge</span>
            <div style={{ marginLeft: "auto", display: "flex", gap: "6px" }}>
              <button
                onClick={(e) => { e.stopPropagation(); setHeatmapColMode("tax"); }}
                style={{
                  ...styles.toggleBtn,
                  ...(heatmapColMode === "tax" ? styles.toggleBtnActive : {})
                }}
              >
                vs Spectrum Tax
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); setHeatmapColMode("liquidity"); }}
                style={{
                  ...styles.toggleBtn,
                  ...(heatmapColMode === "liquidity" ? styles.toggleBtnActive : {})
                }}
              >
                vs Liq. Discount
              </button>
            </div>
          </div>
          <div style={styles.heatmapTableContainer}>
            {renderHeatmapGrid(false)}
            <div style={{ fontSize: "11px", color: "#78716c", marginTop: "10px", fontStyle: "italic" }}>
              *Shaded by upside (green) or downside (red) vs. today's ECHO price of ${echoPrice.toFixed(2)}. Selected active model cell highlighted with <span style={{ color: "#d97706", fontWeight: "bold" }}>orange border</span>.
            </div>
          </div>
        </div>
      </div>

      {renderChartModal()}

      {/* VISUAL 3: PARTS CONTRIBUTION STACKED BAR */}
      <div style={{ ...styles.chartCard, marginBottom: "40px" }}>
        <div style={styles.chartHeader} className="echo-chart-header">
          <span style={styles.sectionNum}>VISUAL 03</span>
          <h3 style={styles.chartTitle}>SOTP Asset Contribution vs Deductions</h3>
          <div style={{ marginLeft: "auto", display: "flex", gap: "6px" }}>
            <button
              onClick={() => setBarChartMode("pre-after")}
              style={{
                ...styles.toggleBtn,
                ...(barChartMode === "pre-after" ? styles.toggleBtnActive : {})
              }}
            >
              Pre-tax vs Risk-Adjusted Allocation
            </button>
          </div>
        </div>

        <div style={{ padding: "16px" }}>
          {/* Legend */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: "16px", marginBottom: "16px", fontSize: "11px", fontFamily: "monospace" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <div style={{ width: "12px", height: "12px", background: "#2563eb" }} /> SpaceX Stake (Net)
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <div style={{ width: "12px", height: "12px", background: "#7c3aed" }} /> Remaining Spectrum
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <div style={{ width: "12px", height: "12px", background: "#059669" }} /> Net Cash (if positive)
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <div style={{ width: "12px", height: "12px", background: "#db2777" }} /> Operating Stub
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <div style={{ width: "12px", height: "12px", background: "#ea580c" }} /> Spectrum Tax
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <div style={{ width: "12px", height: "12px", background: "#991b1b" }} /> Credit distress
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <div style={{ width: "12px", height: "12px", background: "#78350f" }} /> Tower Leases
            </div>
            {calc.netCashValM < 0 && (
              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <div style={{ width: "12px", height: "12px", background: "#44403c" }} /> Net Debt (pre-deal)
              </div>
            )}
          </div>

          {/* Asset bars */}
          {(() => {
            const spacexVal = Math.max(0, calc.netSpaceXVal);
            const spectrumVal = calc.spectrumValM;
            const stubVal = calc.stubValM;
            const cashVal = calc.netCashValM > 0 ? calc.netCashValM : 0;
            const totalAssets = spacexVal + spectrumVal + stubVal + cashVal;

            const spacexPct = (spacexVal / totalAssets) * 100;
            const spectrumPct = (spectrumVal / totalAssets) * 100;
            const cashPct = (cashVal / totalAssets) * 100;
            const stubPct = (stubVal / totalAssets) * 100;

            const taxVal = calc.corporateTaxVal;
            const towerLeaseVal = calc.towerLeaseCostsM;
            const creditVal = calc.distressHaircutAmt;
            const debtVal = calc.netCashValM < 0 ? -calc.netCashValM : 0;
            const netAdjusted = Math.max(0, totalAssets - taxVal - towerLeaseVal - creditVal - debtVal);

            const taxPct = (taxVal / totalAssets) * 100;
            const towerLeasePct = (towerLeaseVal / totalAssets) * 100;
            const creditPct = (creditVal / totalAssets) * 100;
            const debtPct = (debtVal / totalAssets) * 100;
            const netPct = (netAdjusted / totalAssets) * 100;

            return (
              <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", fontWeight: "bold", marginBottom: "6px" }}>
                    <span>Pre-Tax SOTP Assets Allocation</span>
                    <span>{fmt$(totalAssets)} (100%)</span>
                  </div>
                  <div style={{ display: "flex", height: "32px", border: "1px solid #1c1917" }}>
                    <div style={{ width: `${spacexPct}%`, background: "#2563eb", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: "10px", fontWeight: "bold" }} title={`SpaceX: ${spacexPct.toFixed(0)}%`}>
                      {spacexPct > 10 ? `SpaceX (${spacexPct.toFixed(0)}%)` : ""}
                    </div>
                    <div style={{ width: `${spectrumPct}%`, background: "#7c3aed", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: "10px", fontWeight: "bold" }} title={`Spectrum: ${spectrumPct.toFixed(0)}%`}>
                      {spectrumPct > 10 ? `Spectrum (${spectrumPct.toFixed(0)}%)` : ""}
                    </div>
                    {cashPct > 0 && (
                      <div style={{ width: `${cashPct}%`, background: "#059669", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: "10px", fontWeight: "bold" }} title={`Cash: ${cashPct.toFixed(0)}%`}>
                        {cashPct > 10 ? `Cash (${cashPct.toFixed(0)}%)` : ""}
                      </div>
                    )}
                    <div style={{ width: `${stubPct}%`, background: "#db2777", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: "10px", fontWeight: "bold" }} title={`Stub: ${stubPct.toFixed(0)}%`}>
                      {stubPct > 10 ? `Stub (${stubPct.toFixed(0)}%)` : ""}
                    </div>
                  </div>
                </div>

                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", fontWeight: "bold", marginBottom: "6px" }}>
                    <span>Risk-Adjusted SOTP Claims & Liabilities</span>
                    <span>Net Risk-Adjusted SOTP: {fmt$(calc.riskAdjustedTotalM)}</span>
                  </div>
                  <div style={{ display: "flex", height: "32px", border: "1px solid #1c1917" }}>
                    <div style={{ width: `${netPct}%`, background: "#fbbf24", borderRight: "1px solid #1c1917", display: "flex", alignItems: "center", justifyContent: "center", color: "#1c1917", fontSize: "10px", fontWeight: "bold" }} title={`Net SOTP Claim: ${netPct.toFixed(0)}%`}>
                      {netPct > 10 ? `Net NAV Claim (${netPct.toFixed(0)}%)` : ""}
                    </div>
                    {taxPct > 0 && (
                      <div style={{ width: `${taxPct}%`, background: "#ea580c", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: "10px", fontWeight: "bold" }} title={`Spectrum Tax: ${taxPct.toFixed(0)}%`}>
                        {taxPct > 8 ? `Tax (${taxPct.toFixed(0)}%)` : ""}
                      </div>
                    )}
                    {towerLeasePct > 0 && (
                      <div style={{ width: `${towerLeasePct}%`, background: "#78350f", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: "10px", fontWeight: "bold" }} title={`Tower Leases: ${towerLeasePct.toFixed(0)}%`}>
                        {towerLeasePct > 8 ? `Leases (${towerLeasePct.toFixed(0)}%)` : ""}
                      </div>
                    )}
                    {creditPct > 0 && (
                      <div style={{ width: `${creditPct}%`, background: "#991b1b", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: "10px", fontWeight: "bold" }} title={`Credit Haircut: ${creditPct.toFixed(0)}%`}>
                        {creditPct > 8 ? `Credit (${creditPct.toFixed(0)}%)` : ""}
                      </div>
                    )}
                    {debtPct > 0 && (
                      <div style={{ width: `${debtPct}%`, background: "#44403c", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: "10px", fontWeight: "bold" }} title={`Net Debt: ${debtPct.toFixed(0)}%`}>
                        {debtPct > 8 ? `Debt (${debtPct.toFixed(0)}%)` : ""}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })()}
        </div>
      </div>

      {/* WALL STREET / EXTERNAL ANCHORS CARD */}
      <div style={{ ...styles.howToBox, background: "#f5f5f4", border: "1px solid #d6d3d1", marginBottom: "40px" }}>
        <div style={styles.howToTitle}>Wall Street Target Reconciliation</div>
        <p style={{ fontSize: "13px", color: "#44403c", lineHeight: 1.5, marginBottom: "12px" }}>
          Reconcile your model's outputs against reported Wall Street targets. Cowen and Barron's apply a tax haircut to the spectrum gain; Citi (7/8/26) applies a discount to the SpaceX stake. Across 7 covering analysts the average target is ~$146 (57% rate Buy):
        </p>
        <div className="echo-table-scroll" style={{ overflowX: "auto", WebkitOverflowScrolling: "touch" }}>
        <table style={{ width: "100%", minWidth: "600px", borderCollapse: "collapse", fontSize: "13px", fontFamily: "monospace" }}>
          <thead>
            <tr style={{ borderBottom: "1px solid #d6d3d1", textAlign: "left" }}>
              <th style={{ padding: "6px 8px" }}>Anchor Target Source</th>
              <th style={{ padding: "6px 8px" }}>SPCX Price</th>
              <th style={{ padding: "6px 8px", textAlign: "right" }}>SpaceX Stake</th>
              <th style={{ padding: "6px 8px", textAlign: "right" }}>ECHO Target NAV</th>
              <th style={{ padding: "6px 8px", textAlign: "right" }}>Model Variance</th>
            </tr>
          </thead>
          <tbody>
            <tr style={{ borderBottom: "1px solid #e7e5e4" }}>
              <td style={{ padding: "6px 8px", fontWeight: "bold" }}>TD Cowen (Greg Williams, May 2026)</td>
              <td style={{ padding: "6px 8px" }}>~$118 (implied)</td>
              <td style={{ padding: "6px 8px", textAlign: "right" }}>$31.0B</td>
              <td style={{ padding: "6px 8px", textAlign: "right", fontWeight: "bold" }}>$155.00</td>
              <td style={{ padding: "6px 8px", textAlign: "right", color: calc.riskAdjustedPerEchoShare > 155 ? "#15803d" : "#b91c1c" }}>
                {(calc.riskAdjustedPerEchoShare - 155.0).toFixed(2) >= 0 ? "+" : ""}{(calc.riskAdjustedPerEchoShare - 155.0).toFixed(2)}
              </td>
            </tr>
            <tr style={{ borderBottom: "1px solid #e7e5e4" }}>
              <td style={{ padding: "6px 8px", fontWeight: "bold" }}>Barron's Sanity Case (6/12/26 Article)</td>
              <td style={{ padding: "6px 8px" }}>~$175</td>
              <td style={{ padding: "6px 8px", textAlign: "right" }}>$45.8B</td>
              <td style={{ padding: "6px 8px", textAlign: "right", fontWeight: "bold" }}>$185.00 - $190.00</td>
              <td style={{ padding: "6px 8px", textAlign: "right" }}>
                {(() => {
                  const targetMid = 187.5;
                  const variance = calc.riskAdjustedPerEchoShare - targetMid;
                  return (
                    <span style={{ color: variance >= 0 ? "#15803d" : "#b91c1c" }}>
                      {variance >= 0 ? "+" : ""}{variance.toFixed(2)} vs mid
                    </span>
                  );
                })()}
              </td>
            </tr>
            <tr style={{ borderBottom: "1px solid #e7e5e4" }}>
              <td style={{ padding: "6px 8px", fontWeight: "bold" }}>Citi (Michael Rollins, 7/8/26)</td>
              <td style={{ padding: "6px 8px" }}>$200 (Citi SpaceX value)</td>
              <td style={{ padding: "6px 8px", textAlign: "right" }}>$52.4B (pre-discount)</td>
              <td style={{ padding: "6px 8px", textAlign: "right", fontWeight: "bold" }}>$126.00</td>
              <td style={{ padding: "6px 8px", textAlign: "right", color: calc.riskAdjustedPerEchoShare > 126 ? "#15803d" : "#b91c1c" }}>
                {(calc.riskAdjustedPerEchoShare - 126.0) >= 0 ? "+" : ""}{(calc.riskAdjustedPerEchoShare - 126.0).toFixed(2)}
              </td>
            </tr>
            <tr style={{ borderBottom: "1px solid #e7e5e4", background: "#fef3c7" }}>
              <td style={{ padding: "6px 8px", fontWeight: "bold" }}>Your Risk-Adjusted Model (Active)</td>
              <td style={{ padding: "6px 8px" }}>${spcxPrice}</td>
              <td style={{ padding: "6px 8px", textAlign: "right" }}>{fmt$(calc.netSpaceXVal)}</td>
              <td style={{ padding: "6px 8px", textAlign: "right", fontWeight: "bold", color: "#d97706" }}>
                ${calc.riskAdjustedPerEchoShare.toFixed(2)}
              </td>
              <td style={{ padding: "6px 8px", textAlign: "right" }}>—</td>
            </tr>
          </tbody>
        </table>
        </div>
        <div style={{ fontSize: "11px", color: "#78716c", marginTop: "10px", fontStyle: "italic" }}>
          *Note: To align with Barron's target of ~$185-190/sh, check the **Diluted** share count toggle (modeling convertibles), set SPCX price to **$175**, and select the **Bull Preset** (which sets a conservative 15% effective tax rate and 20% liquidity discount).
        </div>
      </div>

      {/* SECTION 01: SPACEX STAKE */}
      <div style={styles.section}>
        <div style={styles.sectionHeader} className="vcx-section-header">
          <span style={styles.sectionNum}>01</span>
          <h2 style={styles.sectionTitle}>SpaceX Equity Stake (The Swing Factor)</h2>
          <span style={styles.sectionMeta} className="vcx-section-meta">Edit discount sliders to haircut the private block</span>
        </div>

        <div style={styles.tableWrap}>
          {/* Headers */}
          <div style={styles.tableHeaderRow} className="vcx-table-header">
            <div style={{ ...styles.th, flex: "2.4" }}>Asset component</div>
            <div style={{ ...styles.th, flex: "1.4", textAlign: "right" }}>Shares / Price</div>
            <div style={{ ...styles.th, flex: "1.4", textAlign: "right" }}>Value ($B)</div>
            <div style={{ ...styles.th, flex: "1.2", textAlign: "right" }}>$/ECHO Share</div>
            <div style={{ ...styles.th, flex: "1.0", textAlign: "right" }}>Tag</div>
          </div>

          {/* Row 1: Gross SpaceX */}
          <div style={styles.tr} className="vcx-row">
            <div style={{ ...styles.td, flex: "2.4" }}>
              <div style={styles.companyName}>Gross SpaceX Consideration</div>
              <div style={styles.companyNote}>Fixed block of post-split Class A SpaceX shares. (S-1 Note F-26)</div>
            </div>
            <div style={{ ...styles.td, flex: "1.4", textAlign: "right", fontFamily: "monospace" }}>
              261.8M @ ${spcxPrice.toFixed(0)}
            </div>
            <div style={{ ...styles.td, flex: "1.4", textAlign: "right", fontFamily: "monospace", fontWeight: 600 }}>
              {fmt$(calc.grossSpaceXVal)}
            </div>
            <div style={{ ...styles.td, flex: "1.2", textAlign: "right", fontFamily: "monospace", color: "#d97706", fontWeight: 600 }}>
              ${calc.grossSpaceXPerEchoShare.toFixed(2)}
            </div>
            <div style={{ ...styles.td, flex: "1.0", textAlign: "right" }}>
              <span style={styles.verifiedBadge} title="Contractual fixed equity consideration detailed in S-1 Note F-26">[VERIFIED]</span>
            </div>
          </div>

          {/* Row 2: Liquidity discount */}
          <div style={styles.tr} className="vcx-row">
            <div style={{ ...styles.td, flex: "2.4" }}>
              <div style={styles.companyName}>Block Size & Illiquidity Discount</div>
              <div style={styles.companyNote}>Haircut for private stock block size relative to public float.</div>
              <div style={{ marginTop: "8px", display: "flex", alignItems: "center", gap: "12px" }}>
                <input
                  type="range"
                  min="0"
                  max="30"
                  value={liquidityDiscount}
                  onChange={(e) => { setLiquidityDiscount(parseInt(e.target.value)); handleManualEdit(); }}
                  style={{ width: "120px", accentColor: "#d97706" }}
                />
                <span style={{ fontSize: "12px", fontFamily: "monospace", fontWeight: "bold" }}>{liquidityDiscount}%</span>
              </div>
            </div>
            <div style={{ ...styles.td, flex: "1.4", textAlign: "right", fontFamily: "monospace" }}>
              —
            </div>
            <div style={{ ...styles.td, flex: "1.4", textAlign: "right", fontFamily: "monospace", color: "#b91c1c" }}>
              -{fmt$(calc.liquidityDiscountVal)}
            </div>
            <div style={{ ...styles.td, flex: "1.2", textAlign: "right", fontFamily: "monospace", color: "#b91c1c" }}>
              -${calc.liquidityDiscountPerEchoShare.toFixed(2)}
            </div>
            <div style={{ ...styles.td, flex: "1.0", textAlign: "right" }}>
              <span style={styles.estimateBadge} title="User modeled estimate">[ESTIMATE]</span>
            </div>
          </div>

          {/* Row 3: Closing & Timing discount */}
          <div style={styles.tr} className="vcx-row">
            <div style={{ ...styles.td, flex: "2.4" }}>
              <div style={styles.companyName}>Closing Probability & Timing Haircut</div>
              <div style={styles.companyNote}>
                Stake delivers ~Nov 30, 2027. Discount for close probability (FCC approved, DOJ pending) + time-value-of-money.
              </div>
              <div style={{ marginTop: "8px", display: "flex", flexWrap: "wrap", gap: "16px" }}>
                <div>
                  <span style={{ fontSize: "10px", color: "#78716c", display: "block" }}>Close Prob</span>
                  <input
                    type="range"
                    min="50"
                    max="100"
                    value={closeProbability}
                    onChange={(e) => { setCloseProbability(parseInt(e.target.value)); handleManualEdit(); }}
                    style={{ width: "100px", accentColor: "#d97706" }}
                  />
                  <span style={{ fontSize: "11px", fontFamily: "monospace", fontWeight: "bold", marginLeft: "6px" }}>{closeProbability}%</span>
                </div>
                <div>
                  <span style={{ fontSize: "10px", color: "#78716c", display: "block" }}>Discount Rate</span>
                  <input
                    type="range"
                    min="0"
                    max="15"
                    value={annualDiscountRate}
                    onChange={(e) => { setAnnualDiscountRate(parseInt(e.target.value)); handleManualEdit(); }}
                    style={{ width: "100px", accentColor: "#d97706" }}
                  />
                  <span style={{ fontSize: "11px", fontFamily: "monospace", fontWeight: "bold", marginLeft: "6px" }}>{annualDiscountRate}%</span>
                </div>
              </div>
            </div>
            <div style={{ ...styles.td, flex: "1.4", textAlign: "right", fontFamily: "monospace", fontSize: "11px" }}>
              {(closeProbability / 100).toFixed(2)}x prob · {1.46} yr PV
            </div>
            <div style={{ ...styles.td, flex: "1.4", textAlign: "right", fontFamily: "monospace", color: "#b91c1c" }}>
              -{fmt$(calc.closingTimingDiscountVal)}
            </div>
            <div style={{ ...styles.td, flex: "1.2", textAlign: "right", fontFamily: "monospace", color: "#b91c1c" }}>
              -${calc.closingTimingDiscountPerEchoShare.toFixed(2)}
            </div>
            <div style={{ ...styles.td, flex: "1.0", textAlign: "right" }}>
              <span style={styles.estimateBadge} title="User modeled estimate">[ESTIMATE]</span>
            </div>
          </div>

          {/* Subtotal SpaceX net */}
          <div style={styles.subtotalRow} className="vcx-subtotal">
            <div style={{ flex: "2.4" }}>Net Risk-Adjusted SpaceX Stake</div>
            <div style={{ flex: "1.4" }} />
            <div style={{ flex: "1.4", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{fmt$(calc.netSpaceXVal)}</div>
            <div style={{ flex: "1.2", textAlign: "right", fontVariantNumeric: "tabular-nums", color: "#d97706" }}>
              ${calc.netSpaceXPerEchoShare.toFixed(2)}
            </div>
            <div style={{ flex: "1.0" }} />
          </div>
        </div>
      </div>

      {/* SECTION 02: OTHER PARTS */}
      <div style={styles.section}>
        <div style={styles.sectionHeader} className="vcx-section-header">
          <span style={styles.sectionNum}>02</span>
          <h2 style={styles.sectionTitle}>Other SOTP Parts (Spectrum & Operations)</h2>
          <span style={styles.sectionMeta} className="vcx-section-meta">Adjust assets that back ECHO operating stub</span>
        </div>

        <div style={styles.tableWrap}>
          {/* Headers */}
          <div style={styles.tableHeaderRow} className="vcx-table-header">
            <div style={{ ...styles.th, flex: "2.4" }}>Asset component</div>
            <div style={{ ...styles.th, flex: "1.4", textAlign: "right" }}>Filing baseline</div>
            <div style={{ ...styles.th, flex: "1.4", textAlign: "right" }}>Model Value ($B)</div>
            <div style={{ ...styles.th, flex: "1.2", textAlign: "right" }}>$/ECHO Share</div>
            <div style={{ ...styles.th, flex: "1.0", textAlign: "right" }}>Tag</div>
          </div>

          {/* Row 1: Remaining Spectrum */}
          <div style={styles.tr} className="vcx-row">
            <div style={{ ...styles.td, flex: "2.4" }}>
              <div style={styles.companyName}>Remaining Spectrum Holdings</div>
              <div style={styles.companyNote}>Spectrum licenses not included in SpaceX/AT&T transaction (AWS-3, etc.)</div>
              <div style={{ marginTop: "8px" }}>
                <input
                  type="range"
                  min="5"
                  max="15"
                  step="0.5"
                  value={spectrumVal}
                  onChange={(e) => { setSpectrumVal(parseFloat(e.target.value)); handleManualEdit(); }}
                  style={{ width: "120px", accentColor: "#d97706" }}
                />
                <span style={{ fontSize: "12px", fontFamily: "monospace", fontWeight: "bold", marginLeft: "12px" }}>${spectrumVal.toFixed(1)}B</span>
              </div>
            </div>
            <div style={{ ...styles.td, flex: "1.4", textAlign: "right", fontFamily: "monospace", color: "#78716c" }}>
              $11.0B
            </div>
            <div style={{ ...styles.td, flex: "1.4", textAlign: "right", fontFamily: "monospace", fontWeight: 600 }}>
              {fmt$(calc.spectrumValM)}
            </div>
            <div style={{ ...styles.td, flex: "1.2", textAlign: "right", fontFamily: "monospace", color: "#d97706", fontWeight: 600 }}>
              ${calc.spectrumPerEchoShare.toFixed(2)}
            </div>
            <div style={{ ...styles.td, flex: "1.0", textAlign: "right" }}>
              <span style={styles.estimateBadge} title="Analyst valuation baseline">[ESTIMATE]</span>
            </div>
          </div>

          {/* Row 2: Net Cash */}
          <div style={styles.tr} className="vcx-row">
            <div style={{ ...styles.td, flex: "2.4" }}>
              <div style={styles.companyName}>Pro-Forma Net Cash</div>
              <div style={styles.companyNote}>Contested baseline net cash position after AT&T and SpaceX transaction cash.</div>
              <div style={{ marginTop: "8px", display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
                <input
                  type="range"
                  min="2.0"
                  max="10.7"
                  step="0.1"
                  disabled={preDealDistress}
                  value={netCashVal}
                  onChange={(e) => { setNetCashVal(parseFloat(e.target.value)); handleManualEdit(); }}
                  style={{ width: "120px", accentColor: "#d97706" }}
                />
                <span style={{ fontSize: "12px", fontFamily: "monospace", fontWeight: "bold" }}>
                  {preDealDistress ? "-$27.7B (Pre-deal Net Debt)" : `$${netCashVal.toFixed(1)}B`}
                </span>
                
                {/* Quick set cash buttons */}
                {!preDealDistress && (
                  <div style={{ display: "flex", gap: "6px" }}>
                    <button onClick={() => { setNetCashVal(2.0); handleManualEdit(); }} style={styles.quickSetBtn}>$2.0B Decks</button>
                    <button onClick={() => { setNetCashVal(4.7); handleManualEdit(); }} style={styles.quickSetBtn}>$4.7B Cern</button>
                    <button onClick={() => { setNetCashVal(10.7); handleManualEdit(); }} style={styles.quickSetBtn}>$10.7B Press</button>
                  </div>
                )}
              </div>
            </div>
            <div style={{ ...styles.td, flex: "1.4", textAlign: "right", fontFamily: "monospace", color: "#78716c" }}>
              $4.7B / $2.0B / $10.7B
            </div>
            <div style={{ ...styles.td, flex: "1.4", textAlign: "right", fontFamily: "monospace", fontWeight: 600, color: calc.netCashValM < 0 ? "#b91c1c" : "inherit" }}>
              {calc.netCashValM < 0 ? `(${fmt$(Math.abs(calc.netCashValM))})` : fmt$(calc.netCashValM)}
            </div>
            <div style={{ ...styles.td, flex: "1.2", textAlign: "right", fontFamily: "monospace", color: calc.netCashValM < 0 ? "#b91c1c" : "#d97706", fontWeight: 600 }}>
              ${calc.netCashPerEchoShare.toFixed(2)}
            </div>
            <div style={{ ...styles.td, flex: "1.0", textAlign: "right" }}>
              <span style={styles.estimateBadge} title="Highly contested pro-forma cash builds">[ESTIMATE]</span>
            </div>
          </div>

          {/* Row 3: Operating Stub */}
          <div style={styles.tr} className="vcx-row">
            <div style={{ ...styles.td, flex: "2.4" }}>
              <div style={styles.companyName}>Operating Stub (DISH, Hughes, Boost)</div>
              <div style={styles.companyNote}>Aggregate valuation of underlying satellite TV, retail wireless, and broadband units.</div>
              <div style={{ marginTop: "8px", display: "flex", alignItems: "center", gap: "12px" }}>
                <input
                  type="range"
                  min="0"
                  max="10"
                  step="0.5"
                  value={stubVal}
                  onChange={(e) => { setStubVal(parseFloat(e.target.value)); handleManualEdit(); }}
                  style={{ width: "120px", accentColor: "#d97706" }}
                />
                <span style={{ fontSize: "12px", fontFamily: "monospace", fontWeight: "bold" }}>${stubVal.toFixed(1)}B</span>
                <button onClick={() => { setStubVal(0); handleManualEdit(); }} style={styles.quickSetBtn}>$0 Bear Case</button>
              </div>
            </div>
            <div style={{ ...styles.td, flex: "1.4", textAlign: "right", fontFamily: "monospace", color: "#78716c" }}>
              $6.0B
            </div>
            <div style={{ ...styles.td, flex: "1.4", textAlign: "right", fontFamily: "monospace", fontWeight: 600 }}>
              {fmt$(calc.stubValM)}
            </div>
            <div style={{ ...styles.td, flex: "1.2", textAlign: "right", fontFamily: "monospace", color: "#d97706", fontWeight: 600 }}>
              ${calc.stubPerEchoShare.toFixed(2)}
            </div>
            <div style={{ ...styles.td, flex: "1.0", textAlign: "right" }}>
              <span style={styles.estimateBadge} title="User modeled estimate">[ESTIMATE]</span>
            </div>
          </div>

          {/* Subtotal Pre-tax */}
          <div style={styles.subtotalRow} className="vcx-subtotal">
            <div style={{ flex: "2.4" }}>Pre-Tax NAV (Discounted SpaceX + Others)</div>
            <div style={{ flex: "1.4" }} />
            <div style={{ flex: "1.4", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{fmt$(calc.preTaxDiscountedTotalM)}</div>
            <div style={{ flex: "1.2", textAlign: "right", fontVariantNumeric: "tabular-nums", color: "#d97706" }}>
              ${calc.preTaxDiscountedPerEchoShare.toFixed(2)}
            </div>
            <div style={{ flex: "1.0" }} />
          </div>
        </div>
      </div>

      {/* SECTION 03: RISK DEDUCTIONS */}
      <div style={styles.section}>
        <div style={styles.sectionHeader} className="vcx-section-header">
          <span style={styles.sectionNum}>03</span>
          <h2 style={styles.sectionTitle}>Risk Deductions (Tax & Credit Default Overlay)</h2>
          <span style={styles.sectionMeta} className="vcx-section-meta">Model the heavy drags Wall Street ignores</span>
        </div>

        {/* CHAPTER 11 STATUS BANNER */}
        <div style={styles.creditWarning}>
          <strong>⚠️ CHAPTER 11 — DIVISIONS ONLY:</strong> On June 30, 2026, DISH DBS (pay-TV) and certain wireless subsidiaries filed a prepackaged Chapter 11 in Houston, backed by 88% of DBS bondholders, after the delayed ~$23B AT&T spectrum sale left $2B of notes maturing July 1 unpaid. The parent (ECHO) and its SpaceX stake are OUTSIDE the filing; Dish TV/Sling operations continue. Management expects the units to exit before the end of Q3 2026.{" "}
          {cured === "no"
            ? <>Your toggle below is set to <strong>contested / prolonged</strong>, so we apply the Distress Haircut.</>
            : <>Your toggle below assumes the prepack <strong>exits on plan</strong> — no haircut applied.</>}
        </div>

        <div style={styles.tableWrap}>
          {/* Headers */}
          <div style={styles.tableHeaderRow} className="vcx-table-header">
            <div style={{ ...styles.th, flex: "2.4" }}>Deduction component</div>
            <div style={{ ...styles.th, flex: "1.4", textAlign: "right" }}>Inputs</div>
            <div style={{ ...styles.th, flex: "1.4", textAlign: "right" }}>Deduction ($B)</div>
            <div style={{ ...styles.th, flex: "1.2", textAlign: "right" }}>$/ECHO Share</div>
            <div style={{ ...styles.th, flex: "1.0", textAlign: "right" }}>Tag</div>
          </div>

          {/* Corporate Tax Row */}
          <div style={styles.tr} className="vcx-row">
            <div style={{ ...styles.td, flex: "2.4" }}>
              <div style={styles.companyName}>Corporate C-Corp Tax on Spectrum Gain</div>
              <div style={styles.companyNote}>
                ECHO will realize a massive taxable gain on the $42.25B transfer of spectrum licenses to SpaceX + AT&T.
              </div>
              <div style={{ marginTop: "8px", display: "flex", flexWrap: "wrap", gap: "16px" }}>
                <div>
                  <span style={{ fontSize: "10px", color: "#78716c", display: "block" }}>Spectrum Tax Basis</span>
                  <input
                    type="number"
                    step="0.5"
                    value={taxBasis}
                    onChange={(e) => { setTaxBasis(parseFloat(e.target.value) || 0); handleManualEdit(); }}
                    style={{ ...styles.ppsInput, width: "70px", padding: "4px" }}
                  />
                  <span style={{ fontSize: "11px", fontWeight: "bold", marginLeft: "4px" }}>$B</span>
                </div>
                <div>
                  <span style={{ fontSize: "10px", color: "#78716c", display: "block" }}>Available NOLs</span>
                  <input
                    type="number"
                    step="0.1"
                    value={nols}
                    onChange={(e) => { setNols(parseFloat(e.target.value) || 0); handleManualEdit(); }}
                    style={{ ...styles.ppsInput, width: "60px", padding: "4px" }}
                  />
                  <span style={{ fontSize: "11px", fontWeight: "bold", marginLeft: "4px" }}>$B</span>
                </div>
                <div>
                  <span style={{ fontSize: "10px", color: "#78716c", display: "block" }}>Effective Tax Rate</span>
                  <input
                    type="range"
                    min="0"
                    max="28"
                    value={taxRate}
                    onChange={(e) => { setTaxRate(parseInt(e.target.value)); handleManualEdit(); }}
                    style={{ width: "90px", accentColor: "#d97706" }}
                  />
                  <span style={{ fontSize: "11px", fontFamily: "monospace", fontWeight: "bold", marginLeft: "6px" }}>{taxRate}%</span>
                </div>
              </div>
            </div>
            <div style={{ ...styles.td, flex: "1.4", textAlign: "right", fontFamily: "monospace", fontSize: "11px" }}>
              Taxable Gain: ${(42.25 - taxBasis - nols).toFixed(2)}B
            </div>
            <div style={{ ...styles.td, flex: "1.4", textAlign: "right", fontFamily: "monospace", color: "#b91c1c", fontWeight: 600 }}>
              -{fmt$(calc.corporateTaxVal)}
            </div>
            <div style={{ ...styles.td, flex: "1.2", textAlign: "right", fontFamily: "monospace", color: "#b91c1c", fontWeight: 600 }}>
              -${calc.corporateTaxPerEchoShare.toFixed(2)}
            </div>
            <div style={{ ...styles.td, flex: "1.0", textAlign: "right" }}>
              <span style={styles.estimateBadge} title="Modeled tax liability. Deferral via trust is an open question">[ESTIMATE]</span>
            </div>
          </div>

          {/* Tower Lease Termination Costs Row */}
          <div style={styles.tr} className="vcx-row">
            <div style={{ ...styles.td, flex: "2.4" }}>
              <div style={styles.companyName}>Tower Lease Termination Costs</div>
              <div style={styles.companyNote}>
                EchoStar must terminate or reassign long-term tower site leases as part of the spectrum transaction wind-down. Estimated liability per Barron's.
              </div>
              <div style={{ marginTop: "8px", display: "flex", alignItems: "center", gap: "12px" }}>
                <span style={{ fontSize: "10px", color: "#78716c" }}>Tower Lease Liability</span>
                <input
                  type="range"
                  min="0"
                  max="5"
                  step="0.1"
                  value={towerLeaseCosts}
                  onChange={(e) => { setTowerLeaseCosts(parseFloat(e.target.value)); handleManualEdit(); }}
                  style={{ width: "120px", accentColor: "#d97706" }}
                />
                <span style={{ fontSize: "11px", fontFamily: "monospace", fontWeight: "bold" }}>${towerLeaseCosts.toFixed(2)}B</span>
              </div>
            </div>
            <div style={{ ...styles.td, flex: "1.4", textAlign: "right", fontFamily: "monospace", fontSize: "11px" }}>
              Lease breakage costs
            </div>
            <div style={{ ...styles.td, flex: "1.4", textAlign: "right", fontFamily: "monospace", color: "#b91c1c", fontWeight: 600 }}>
              -{fmt$(calc.towerLeaseCostsM)}
            </div>
            <div style={{ ...styles.td, flex: "1.2", textAlign: "right", fontFamily: "monospace", color: "#b91c1c", fontWeight: 600 }}>
              -${calc.towerLeaseCostsPerEchoShare.toFixed(2)}
            </div>
            <div style={{ ...styles.td, flex: "1.0", textAlign: "right" }}>
              <span style={styles.estimateBadge} title="Estimated tower lease termination liability">[ ESTIMATE]</span>
            </div>
          </div>

          {/* Credit Default Haircut Row */}
          <div style={styles.tr} className="vcx-row">
            <div style={{ ...styles.td, flex: "2.4" }}>
              <div style={styles.companyName}>Restructuring Haircut / Chapter 11 overlay</div>
              <div style={styles.companyNote}>
                Haircut applied if the DBS prepack gets contested/prolonged or the delayed AT&T closing slips further.
              </div>
              <div style={{ marginTop: "8px", display: "flex", alignItems: "center", gap: "16px", flexWrap: "wrap" }}>
                <div style={{ display: "flex", gap: "6px" }}>
                  <label style={{ display: "flex", alignItems: "center", gap: "4px", fontSize: "12px", cursor: "pointer" }}>
                    <input
                      type="radio"
                      name="curedToggle"
                      checked={cured === "yes"}
                      onChange={() => { setCured("yes"); handleManualEdit(); }}
                      style={{ accentColor: "#d97706" }}
                    />
                    Exits on plan (Q3 &apos;26)
                  </label>
                  <label style={{ display: "flex", alignItems: "center", gap: "4px", fontSize: "12px", cursor: "pointer" }}>
                    <input
                      type="radio"
                      name="curedToggle"
                      checked={cured === "no"}
                      onChange={() => { setCured("no"); handleManualEdit(); }}
                      style={{ accentColor: "#d97706" }}
                    />
                    Contested / prolonged
                  </label>
                </div>
                
                {cured === "no" && (
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <input
                      type="range"
                      min="0"
                      max="50"
                      value={distressHaircut}
                      onChange={(e) => { setDistressHaircut(parseInt(e.target.value)); handleManualEdit(); }}
                      style={{ width: "100px", accentColor: "#d97706" }}
                    />
                    <span style={{ fontSize: "11px", fontFamily: "monospace", fontWeight: "bold" }}>{distressHaircut}%</span>
                  </div>
                )}
              </div>
            </div>
            <div style={{ ...styles.td, flex: "1.4", textAlign: "right", fontFamily: "monospace", color: cured === "yes" ? "#78716c" : "#b91c1c" }}>
              {cured === "yes" ? "On-plan prepack exit" : `Contested restructuring`}
            </div>
            <div style={{ ...styles.td, flex: "1.4", textAlign: "right", fontFamily: "monospace", color: "#b91c1c", fontWeight: 600 }}>
              {cured === "yes" ? "$0" : `-${fmt$(calc.distressHaircutAmt)}`}
            </div>
            <div style={{ ...styles.td, flex: "1.2", textAlign: "right", fontFamily: "monospace", color: "#b91c1c", fontWeight: 600 }}>
              {cured === "yes" ? "$0.00" : `-${calc.distressHaircutPerEchoShare.toFixed(2)}`}
            </div>
            <div style={{ ...styles.td, flex: "1.0", textAlign: "right" }}>
              <span style={styles.reportedBadge} title="DISH DBS + certain wireless subsidiaries filed prepackaged Chapter 11 on June 30, 2026 (S.D. Tex.)">[REPORTED]</span>
            </div>
          </div>

          {/* Distress Pre-Deal net debt scenario checkbox */}
          <div style={styles.tr} className="vcx-row" style={{ ...styles.tr, background: "#fef2f2" }}>
            <div style={{ ...styles.td, flex: "2.4" }}>
              <div style={{ ...styles.companyName, color: "#991b1b" }}>Simulate Deal Break (Pre-deal Distress Net Debt)</div>
              <div style={styles.companyNote}>
                Check this box to simulate the scenario where the transaction breaks, ECHO receives no SpaceX equity, and remains saddled with its pre-deal Net Debt of <strong>-$27.7B</strong>.
              </div>
            </div>
            <div style={{ ...styles.td, flex: "1.4", textAlign: "right" }}>
              <input
                type="checkbox"
                checked={preDealDistress}
                onChange={(e) => { setPreDealDistress(e.target.checked); handleManualEdit(); }}
                style={{ width: "20px", height: "20px", accentColor: "#b91c1c", cursor: "pointer" }}
              />
            </div>
            <div style={{ ...styles.td, flex: "1.4", textAlign: "right", fontFamily: "monospace", color: "#b91c1c" }}>
              {preDealDistress ? "Deal broken" : "Pro-forma deal active"}
            </div>
            <div style={{ ...styles.td, flex: "1.2", textAlign: "right", fontFamily: "monospace", color: "#b91c1c" }}>
              {preDealDistress ? "-$95.58/sh" : "—"}
            </div>
            <div style={{ ...styles.td, flex: "1.0", textAlign: "right" }}>
              <span style={{ ...styles.estimateBadge, color: "#991b1b", border: "1px solid #991b1b" }}>[DISTRESS]</span>
            </div>
          </div>
        </div>
      </div>

      {/* SECTION 04: OUTPUT SUMMARY (SIDE BY SIDE COLUMNS) */}
      <div style={styles.section}>
        <div style={styles.sectionHeader} className="vcx-section-header">
          <span style={styles.sectionNum}>04</span>
          <h2 style={styles.sectionTitle}>ECHO SOTP Outputs & Implied SpaceX Price</h2>
          <span style={styles.sectionMeta} className="vcx-section-meta">Compare Pre-tax vs. Risk-Adjusted values</span>
        </div>

        <div style={styles.summaryBlockContainer} className="echo-summary-row">
          {/* Pre-tax Card */}
          <div style={styles.summaryCard} className="echo-summary-card">
            <div style={styles.summaryCardTitle}>PRE-TAX SOTP VALUE</div>
            <div style={{ ...styles.gtValue, fontSize: "40px", marginBottom: "8px" }} className="vcx-gt-value-large">
              {fmt$exact(calc.preTaxDiscountedTotalM)}
            </div>
            <div style={{ ...styles.gtValueAccent, fontSize: "56px", marginBottom: "16px" }} className="vcx-gt-value-accent">
              ${calc.preTaxDiscountedPerEchoShare.toFixed(2)}
              <span style={{ fontSize: "14px", fontStyle: "normal", color: "#a8a29e", marginLeft: "6px" }}>/ ECHO share</span>
            </div>
            <div style={styles.gtDivider} />
            
            <div style={styles.metricRow}>
              <span style={styles.metricLabel}>Upside vs ECHO Price:</span>
              <span style={{ ...styles.metricValue, color: calc.preTaxDiscountedPerEchoShare > echoPrice ? "#15803d" : "#b91c1c" }}>
                {((calc.preTaxDiscountedPerEchoShare / echoPrice - 1) * 100).toFixed(0)}%
              </span>
            </div>
            <div style={styles.metricRow}>
              <span style={styles.metricLabel}>Premium/Discount to NAV:</span>
              <span style={styles.metricValue}>
                {((echoPrice / calc.preTaxDiscountedPerEchoShare - 1) * 100).toFixed(0)}%
              </span>
            </div>
            <div style={styles.metricRow}>
              <span style={styles.metricLabel}>Effective SPCX Price Paid:</span>
              <span style={{ ...styles.metricValue, color: "#d97706" }}>
                ${( (calc.ev - calc.corporateTaxVal) / (SPACEX_FIXED_SHARES_M * 1_000_000) ).toFixed(2)}
              </span>
            </div>
            <p style={{ fontSize: "11px", color: "#78716c", marginTop: "12px", fontStyle: "italic" }}>
              *Pre-tax SOTP NAV ignores corporate taxes on the spectrum transfer gain, tower lease termination costs, and DBS default distress overlays.
            </p>
          </div>

          {/* Risk-adjusted Card */}
          <div style={{ ...styles.summaryCard, border: "2px solid #fbbf24", background: "#1c1917" }} className="echo-summary-card">
            <div style={{ ...styles.summaryCardTitle, color: "#fbbf24" }}>RISK-ADJUSTED SOTP VALUE</div>
            <div style={{ ...styles.gtValue, fontSize: "40px", marginBottom: "8px", color: "#fff" }} className="vcx-gt-value-large">
              {fmt$exact(calc.riskAdjustedTotalM)}
            </div>
            <div style={{ ...styles.gtValueAccent, fontSize: "56px", marginBottom: "16px" }} className="vcx-gt-value-accent">
              ${calc.riskAdjustedPerEchoShare.toFixed(2)}
              <span style={{ fontSize: "14px", fontStyle: "normal", color: "#a8a29e", marginLeft: "6px" }}>/ ECHO share</span>
            </div>
            <div style={{ ...styles.gtDivider, background: "#fbbf24", opacity: 0.3 }} />
            
            <div style={styles.metricRow}>
              <span style={{ ...styles.metricLabel, color: "#a8a29e" }}>Upside vs ECHO Price:</span>
              <span style={{ ...styles.metricValue, color: calc.riskAdjustedPerEchoShare > echoPrice ? "#86efac" : "#fca5a5" }}>
                {((calc.riskAdjustedPerEchoShare / echoPrice - 1) * 100).toFixed(0)}%
              </span>
            </div>
            <div style={styles.metricRow}>
              <span style={{ ...styles.metricLabel, color: "#a8a29e" }}>Premium/Discount to NAV:</span>
              <span style={{ ...styles.metricValue, color: "#fff" }}>
                {((echoPrice / calc.riskAdjustedPerEchoShare - 1) * 100).toFixed(0)}%
              </span>
            </div>
            <div style={styles.metricRow}>
              <span style={{ ...styles.metricLabel, color: "#a8a29e" }}>Effective SPCX Price Paid:</span>
              <span style={{ ...styles.metricValue, color: "#fbbf24" }}>
                ${calc.effectiveSpcxCostPerShare.toFixed(2)}
              </span>
            </div>
            <p style={{ fontSize: "11px", color: "#a8a29e", marginTop: "12px", fontStyle: "italic" }}>
              *Risk-adjusted SOTP NAV includes C-corp tax drag on gain, tower lease termination costs, and credit distress default adjustments.
            </p>
          </div>
        </div>
      </div>

      {/* EXPLAINER BOXES */}
      <div style={{ display: "flex", gap: "24px", flexWrap: "wrap", marginBottom: "48px" }} className="echo-explainer-row">
        {/* Share Count explainer */}
        <div style={{ ...styles.issuanceBox, flex: 1, minWidth: "300px" }} className="echo-explainer-box">
          <div style={styles.issuanceHeader}>
            <span style={styles.sectionNum}>ⓘ</span>
            <h3 style={{ ...styles.sectionTitle, fontSize: "16px", margin: 0 }}>About ECHO share count</h3>
          </div>
          <div style={styles.issuanceMeta}>
            The default ECHO basic share count of <strong>289.8M</strong> is an estimate of Class A + B outstanding. The authoritative share count changes quarterly and can be verified against EchoStar's latest Form 10-Q / 10-K. To evaluate convertible bond dilution risk noted by Barron's and Cowen, toggle on the **Diluted** share count button (which models conversion to **304.4M** shares).
          </div>
        </div>

        {/* Tax Assumption explainer */}
        <div style={{ ...styles.issuanceBox, flex: 1, minWidth: "300px" }} className="echo-explainer-box">
          <div style={styles.issuanceHeader}>
            <span style={styles.sectionNum}>ⓘ</span>
            <h3 style={{ ...styles.sectionTitle, fontSize: "16px", margin: 0 }}>About the spectrum tax</h3>
          </div>
          <div style={styles.issuanceMeta}>
            Bulls frequently mark ECHO's spectrum sale gross of tax, but C-corp stock-for-asset exchanges are taxable at the corporate level. We model cash taxes on the spectrum transfer proceeds ($42.25B) less tax basis (default $5.0B) and ECHO's available NOLs (default $1.0B) at a 25% federal + state rate. If ECHO can defer tax via the "Spectrum Business Trust 2025-1" structure, the effective tax rate will be lower (preset Moon is 0%).
          </div>
        </div>
      </div>

      {/* CHANGELOG AND SOURCES */}
      <div style={styles.footer} className="footer">
        <div><strong>Changelog:</strong></div>
        <div style={{ marginBottom: "16px" }}>
          • <strong>July 9, 2026</strong> — Ticker migration SATS → ECHO (effective 6/24/26 on Nasdaq; page now lives at /echo, /sats redirects). Replaced the missed-payment credit alert with the actual event: DISH DBS and certain wireless subsidiaries filed a prepackaged Chapter 11 on June 30, 2026 (88% bondholder support, expected Q3 exit) after the delayed AT&T spectrum sale left $2B of notes unpaid — the parent and SpaceX stake sit outside the filing. Restructuring toggle re-labeled (on-plan exit vs contested). Added Citi&apos;s renewed coverage (Buy, $126 PT, values SpaceX at $200/sh → $52B stake) to the Wall Street reconciliation. Updated defaults: ECHO price ~$95.88, base SPCX ~$150 (live-fetched).<br />
          • <strong>June 15, 2026</strong> — Added visual upgrades for the SATS bridge and sensitivity matrix, including cleaner chart header spacing, a compact heatmap layout, top-aligned input controls, and a non-overlapping SATS price annotation. Added real-time SATS and SPCX price fetching for the live price inputs and base scenario defaults.<br />
          • <strong>June 12, 2026</strong> — Reconciled calculator targets against Barron's strategic analysis ("EchoStar Is Falling as SpaceX Surges. Why the Stock Looks Cheap.") and TD Cowen targets ($155 NAV). Added convertible bond dilution toggle (basic 289.8M vs diluted 304.4M). Added "Takeout" preset scenario for Oppenheimer buyout optionality (SpaceX acquires SATS/Boost in tax-free stock swap, $8.0B stub). Added Wall Street targets reconciliation card. Added qualitative callouts (Ergen key-man risk, multi-year closing delays, proxy-unwind decay).<br />
          • <strong>May 12, 2026</strong> — Updated S-1 regulatory track: FCC officially approved the SATS spectrum transfer application (FCC Order Granting SpaceX-EchoStar Applications, 5/12/26). DOJ antitrust review and closing conditions remain pending. Updated default SATS close probability to 85%.<br />
          • <strong>March 3, 2026</strong> — Initial SOTP model built on terms from SpaceX's S-1 Note F-26 (accession `000162828026036936`): 261.8M post-split shares of SPCX, $42.25B spectrum transfer proceeds, and SpaceX junior lien funding of SATS debt service.
        </div>
        
        <div><strong>Sources:</strong></div>
        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
          <div>• SpaceX Form S-1 Note F-26 "Spectrum Transactions" (Deal Terms): <a href="https://www.sec.gov/Archives/edgar/data/1181412/000162828026036936/spaceexplorationtechnologi.htm" target="_blank" rel="noopener noreferrer" style={styles.sourceLink}>SEC EDGAR</a></div>
          <div>• Amended SpaceX S-1 Prospectus (Priced Deal): <a href="https://www.sec.gov/Archives/edgar/data/1181412/000162828026039276/spaceexplorationtechnologi.htm" target="_blank" rel="noopener noreferrer" style={styles.sourceLink}>SEC Prospectus</a></div>
          <div>• Barron's (Andrew Bary, 6/12/26) "Why SATS looks cheap": <a href="https://www.barrons.com/articles/echostar-spacex-stock-cheap" target="_blank" rel="noopener noreferrer" style={styles.sourceLink}>Barron's Article</a></div>
          <div>• Barron&apos;s (Al Root, 7/8/26) &quot;Like SpaceX? Why EchoStar Might Be a Better Bet&quot; (Citi coverage renewal): <a href="https://www.msn.com/en-us/money/topstocks/echostar-stock-is-a-better-way-to-own-spacex-citi-says/ar-AA27uhpc" target="_blank" rel="noopener noreferrer" style={styles.sourceLink}>Barron&apos;s Article (7/8)</a></div>
          <div>• EchoStar ticker change SATS → ECHO (effective 6/24/26): <a href="https://www.satellitetoday.com/finance/2026/06/22/echostar-swaps-sats-ticker-for-echo-to-emphasize-business-shift/" target="_blank" rel="noopener noreferrer" style={styles.sourceLink}>Via Satellite</a></div>
          <div>• DISH DBS prepackaged Chapter 11 filing (6/30/26): <a href="https://www.satellitetoday.com/finance/2026/07/01/dish-satellite-tv-and-wireless-businesses-file-for-chapter-11-bankruptcy/" target="_blank" rel="noopener noreferrer" style={styles.sourceLink}>Via Satellite</a></div>
          <div>• EchoStar Spectrum Agreement Press Release: <a href="https://www.prnewswire.com/news-releases/echostar-announces-spectrum-sale-and-commercial-agreement-with-spacex-302548650.html" target="_blank" rel="noopener noreferrer" style={styles.sourceLink}>PR Newswire</a></div>
          <div>• FCC Granting Order (May 12, 2026): <a href="https://www.fcc.gov/document/order-granting-spacex-echostar-applications" target="_blank" rel="noopener noreferrer" style={styles.sourceLink}>FCC Order</a></div>
          <div>• QuiverQuant SATS missed DBS payment report: <a href="https://www.quiverquant.com/news/EchoStar+shares+slide+as+missed+interest+payment+rekindles+default+and+liquidity+concerns" target="_blank" rel="noopener noreferrer" style={styles.sourceLink}>QuiverQuant</a></div>
          <div>• SpaceNews Direct-to-Device AWS-3 deal: <a href="https://spacenews.com/echostar-sells-more-direct-to-device-spectrum-for-bigger-spacex-stake/" target="_blank" rel="noopener noreferrer" style={styles.sourceLink}>SpaceNews</a></div>
          <div>• bendeveran SATS Proxy-thesis: <a href="https://www.bendeveran.com/article/echostar" target="_blank" rel="noopener noreferrer" style={styles.sourceLink}>bendeveran SOTP</a></div>
        </div>

        <div style={{ marginTop: "24px", fontStyle: "italic", borderTop: "1px dashed #d6d3d1", paddingTop: "12px" }}>
          This site is for informational and educational purposes only. It does not constitute investment advice, an offer to buy or sell securities, or a recommendation of any kind. The author makes no warranty as to the accuracy of any figures shown. ECHO values are modeled estimates based on publicly available filings. The author may hold positions in ECHO or other securities mentioned. Do your own work.
        </div>
      </div>

      {/* STICKY SUMMARY BAR */}
      <div style={styles.stickyBar} className="vcx-sticky-bar">
        <div style={styles.stickyInner}>
          <div style={styles.stickyMetric}>
            <div style={styles.stickyLabel}>Risk-Adj NAV</div>
            <div style={styles.stickyValueAccent}>${calc.riskAdjustedPerEchoShare.toFixed(2)}</div>
          </div>
          <div style={styles.stickyDivider} />
          <div style={styles.stickyMetric}>
            <div style={styles.stickyLabel}>Pre-tax NAV</div>
            <div style={styles.stickyValue}>${calc.preTaxDiscountedPerEchoShare.toFixed(2)}</div>
          </div>
          <div style={styles.stickyDivider} />
          <div style={styles.stickyMetric}>
            <div style={styles.stickyLabel}>Implied SPCX cost</div>
            <div style={{ ...styles.stickyValue, color: "#fbbf24" }}>${calc.effectiveSpcxCostPerShare.toFixed(2)}</div>
          </div>
          <div style={styles.stickyDivider} />
          <div style={styles.stickyMetric}>
            <div style={styles.stickyLabel}>ECHO Upside (Risk-Adj)</div>
            <div style={{ ...styles.stickyValue, color: calc.riskAdjustedPerEchoShare > echoPrice ? "#86efac" : "#fca5a5" }}>
              {((calc.riskAdjustedPerEchoShare / echoPrice - 1) * 100).toFixed(0)}%
            </div>
          </div>
          <div style={styles.stickyDivider} />
          <div style={styles.stickyMetric}>
            <div style={styles.stickyLabel}>ECHO Stock</div>
            <div style={styles.stickyValue}>${echoPrice.toFixed(2)}</div>
          </div>
        </div>
      </div>

    </div>
  );
}

const styles = {
  container: {
    fontFamily: "'Fraunces', Georgia, serif",
    background: "#fefdf8",
    color: "#1c1917",
    minHeight: "100vh",
    padding: "48px 56px 80px 56px",
    maxWidth: "1180px",
    margin: "0 auto",
    boxSizing: "border-box",
    overflowX: "hidden",
  },
  header: {
    borderBottom: "1px solid #1c1917",
    paddingBottom: "32px",
    marginBottom: "40px",
  },
  eyebrow: {
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: "11px",
    letterSpacing: "0.18em",
    color: "#78716c",
    marginBottom: "16px",
    fontWeight: 500,
  },
  title: {
    fontSize: "72px",
    lineHeight: 0.95,
    fontWeight: 800,
    margin: "0 0 20px 0",
    letterSpacing: "-0.03em",
  },
  titleAccent: {
    color: "#d97706",
    fontStyle: "italic",
    fontWeight: 600,
  },
  subtitle: {
    fontSize: "16px",
    lineHeight: 1.55,
    color: "#44403c",
    maxWidth: "760px",
    margin: 0,
  },
  howToBox: {
    background: "#f5f5f4",
    border: "1px solid #d6d3d1",
    padding: "20px 24px",
    marginBottom: "32px",
  },
  howToTitle: {
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: "11px",
    letterSpacing: "0.15em",
    color: "#1c1917",
    textTransform: "uppercase",
    fontWeight: 600,
    marginBottom: "12px",
  },
  howToList: {
    margin: 0,
    paddingLeft: "20px",
    fontSize: "14px",
    lineHeight: 1.65,
    color: "#44403c",
    fontFamily: "'Fraunces', serif",
  },
  qualitativeContainer: {
    display: "flex",
    gap: "20px",
    marginBottom: "32px",
    flexWrap: "wrap"
  },
  qualitativeCard: {
    flex: 1,
    minWidth: "280px",
    background: "#fafaf9",
    border: "1px solid #e7e5e4",
    padding: "16px",
  },
  qualitativeHeader: {
    fontFamily: "'Fraunces', serif",
    fontSize: "14px",
    color: "#1c1917",
    marginBottom: "8px",
    display: "flex",
    alignItems: "center",
    gap: "6px"
  },
  qualitativeIcon: {
    fontSize: "16px"
  },
  qualitativeText: {
    fontSize: "12px",
    color: "#57534e",
    lineHeight: 1.5,
    margin: 0
  },
  controls: {
    display: "flex",
    gap: "32px",
    alignItems: "flex-start",
    marginBottom: "32px",
    flexWrap: "wrap",
  },
  controlGroup: {
    flex: 1,
    minWidth: "240px",
    display: "flex",
    flexDirection: "column"
  },
  label: {
    display: "block",
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: "11px",
    letterSpacing: "0.05em",
    textTransform: "uppercase",
    marginBottom: "8px",
    color: "#78716c",
  },
  smallInput: {
    padding: "8px 12px",
    fontSize: "18px",
    fontFamily: "'JetBrains Mono', monospace",
    border: "1px solid #d6d3d1",
    background: "#fff",
    color: "#1c1917",
    width: "120px",
    outline: "none",
  },
  scenarioGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
    gap: "12px",
    marginBottom: "40px"
  },
  scenarioCard: {
    textAlign: "left",
    background: "#fefdf8",
    border: "1px solid #d6d3d1",
    padding: "12px 16px",
    cursor: "pointer",
    borderRadius: 0,
    position: "relative",
    transition: "all 0.15s ease",
    fontFamily: "'Fraunces', serif",
    color: "#1c1917"
  },
  scenarioCardActive: {
    background: "#1c1917",
    color: "#fef3c7",
    border: "1px solid #1c1917"
  },
  activeDot: {
    position: "absolute",
    top: "12px",
    right: "12px",
    width: "6px",
    height: "6px",
    borderRadius: "50%",
    background: "#d97706",
  },
  visualsBlock: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(500px, 1fr))",
    gap: "24px",
    marginBottom: "40px"
  },
  chartCard: {
    border: "1px solid #1c1917",
    background: "#fff",
    display: "flex",
    flexDirection: "column"
  },
  chartHeader: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    padding: "12px 16px",
    background: "#fafaf9",
    borderBottom: "1px solid #e7e5e4"
  },
  chartTitle: {
    fontSize: "15px",
    fontWeight: "bold",
    margin: 0,
    fontFamily: "'Fraunces', serif"
  },
  toggleBtn: {
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: "9px",
    textTransform: "uppercase",
    border: "1px solid #d6d3d1",
    background: "#fff",
    color: "#78716c",
    padding: "4px 8px",
    cursor: "pointer"
  },
  toggleBtnActive: {
    background: "#1c1917",
    color: "#fef3c7",
    border: "1px solid #1c1917"
  },
  heatmapTableContainer: {
    padding: "16px",
    overflowX: "auto"
  },
  heatmapGrid: {
    display: "grid",
    gridTemplateColumns: "104px repeat(6, minmax(0, 1fr))",
    gap: "4px",
    minWidth: 0
  },
  heatmapHeaderCell: {
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: "10px",
    textTransform: "uppercase",
    textAlign: "right",
    padding: "6px 4px",
    borderBottom: "1px solid #d6d3d1",
    color: "#78716c",
    fontWeight: 600
  },
  heatmapRowHeaderCell: {
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: "11px",
    fontWeight: "bold",
    textAlign: "left",
    padding: "8px 4px",
    borderBottom: "1px solid #e7e5e4",
    alignSelf: "center"
  },
  heatmapSelectedRowLabel: {
    color: "#d97706"
  },
  heatmapCell: {
    textAlign: "right",
    padding: "8px 6px",
    borderRadius: "2px",
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    cursor: "help",
    transition: "all 0.15s ease"
  },
  section: {
    marginBottom: "40px",
  },
  sectionHeader: {
    display: "flex",
    alignItems: "baseline",
    gap: "16px",
    marginBottom: "16px",
    paddingBottom: "8px",
    borderBottom: "1px solid #d6d3d1",
  },
  sectionNum: {
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: "12px",
    color: "#d97706",
    fontWeight: 700,
    letterSpacing: "0.05em",
  },
  sectionTitle: {
    fontSize: "22px",
    fontWeight: 600,
    margin: 0,
    letterSpacing: "-0.01em",
  },
  sectionMeta: {
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: "11px",
    color: "#78716c",
    marginLeft: "auto",
    letterSpacing: "0.05em",
  },
  tableWrap: {
    border: "1px solid #1c1917",
  },
  tableHeaderRow: {
    display: "flex",
    background: "#1c1917",
    color: "#fef3c7",
    padding: "10px 16px",
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: "10px",
    letterSpacing: "0.1em",
    textTransform: "uppercase",
    fontWeight: 500,
  },
  th: {
    flex: 1,
  },
  tr: {
    display: "flex",
    padding: "14px 16px",
    borderBottom: "1px solid #e7e5e4",
    alignItems: "center",
    background: "#fff"
  },
  td: {
    fontSize: "14px",
  },
  companyName: {
    fontSize: "15px",
    fontWeight: 600,
    fontFamily: "'Fraunces', serif",
  },
  companyNote: {
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: "11px",
    color: "#78716c",
    marginTop: "2px",
  },
  ppsInput: {
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: "14px",
    fontWeight: 600,
    border: "1px solid #d6d3d1",
    background: "#fefdf8",
    padding: "6px 10px",
    width: "100px",
    textAlign: "right",
    borderRadius: 0,
  },
  quickSetBtn: {
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: "9px",
    padding: "2px 6px",
    border: "1px solid #d6d3d1",
    background: "#f5f5f4",
    cursor: "pointer"
  },
  subtotalRow: {
    display: "flex",
    padding: "14px 16px",
    background: "#f5f5f4",
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: "12px",
    fontWeight: 600,
    letterSpacing: "0.05em",
    textTransform: "uppercase",
    alignItems: "center",
    color: "#1c1917",
  },
  creditWarning: {
    background: "#fef2f2",
    borderLeft: "4px solid #b91c1c",
    padding: "12px 16px",
    marginBottom: "16px",
    color: "#991b1b",
    fontSize: "13px",
    lineHeight: 1.5,
  },
  summaryBlockContainer: {
    display: "flex",
    gap: "24px",
    flexWrap: "wrap",
    marginTop: "16px"
  },
  summaryCard: {
    flex: 1,
    minWidth: "320px",
    background: "#fafaf9",
    border: "1px solid #1c1917",
    padding: "32px 40px",
  },
  summaryCardTitle: {
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: "11px",
    letterSpacing: "0.18em",
    color: "#78716c",
    fontWeight: 600,
    marginBottom: "16px",
  },
  metricRow: {
    display: "flex",
    justifyContent: "space-between",
    padding: "8px 0",
    borderBottom: "1px dashed rgba(120, 113, 108, 0.2)",
    fontSize: "13px"
  },
  metricLabel: {
    fontFamily: "'JetBrains Mono', monospace",
    color: "#78716c"
  },
  metricValue: {
    fontWeight: "bold",
    fontFamily: "monospace"
  },
  issuanceBox: {
    background: "#fef3c7",
    border: "1px solid #d97706",
    padding: "20px 24px",
  },
  issuanceHeader: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    marginBottom: "16px",
    color: "#92400e",
  },
  issuanceMeta: {
    fontSize: "13px",
    fontFamily: "'Fraunces', serif",
    color: "#78350f",
    lineHeight: 1.55,
    paddingTop: "10px",
    borderTop: "1px solid rgba(217, 119, 6, 0.3)",
  },
  verifiedBadge: {
    fontSize: "10px",
    fontFamily: "monospace",
    color: "#15803d",
    border: "1px solid #15803d",
    padding: "2px 4px",
    background: "#f0fdf4"
  },
  estimateBadge: {
    fontSize: "10px",
    fontFamily: "monospace",
    color: "#d97706",
    border: "1px solid #d97706",
    padding: "2px 4px",
    background: "#fef3c7"
  },
  reportedBadge: {
    fontSize: "10px",
    fontFamily: "monospace",
    color: "#7c3aed",
    border: "1px solid #7c3aed",
    padding: "2px 4px",
    background: "#f5f3ff"
  },
  sourceLink: {
    color: "#d97706",
    textDecoration: "underline"
  },
  gtLabel: {
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: "11px",
    letterSpacing: "0.18em",
    color: "#a8a29e",
    fontWeight: 500,
    marginBottom: "8px",
  },
  gtValue: {
    fontSize: "48px",
    fontWeight: 700,
    fontFamily: "'Fraunces', serif",
    letterSpacing: "-0.02em",
    fontVariantNumeric: "tabular-nums",
    marginBottom: "24px",
  },
  gtValueAccent: {
    fontSize: "72px",
    fontWeight: 800,
    fontFamily: "'Fraunces', serif",
    letterSpacing: "-0.03em",
    color: "#fbbf24",
    fontStyle: "italic",
    fontVariantNumeric: "tabular-nums",
    lineHeight: 1,
    marginBottom: "16px",
  },
  gtDivider: {
    height: "1px",
    background: "#44403c",
    margin: "24px 0",
  },
  footer: {
    marginTop: "32px",
    paddingTop: "24px",
    borderTop: "1px solid #d6d3d1",
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: "10px",
    color: "#78716c",
    letterSpacing: "0.03em",
    lineHeight: 1.7,
  },
  stickyBar: {
    position: "fixed",
    bottom: 0,
    left: 0,
    right: 0,
    background: "#1c1917",
    borderTop: "2px solid #d97706",
    zIndex: 1000,
    padding: "0 24px",
  },
  stickyInner: {
    maxWidth: "1180px",
    margin: "0 auto",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "0",
    padding: "10px 0",
    flexWrap: "nowrap"
  },
  stickyMetric: {
    padding: "0 24px",
    textAlign: "center",
    flexShrink: 0,
  },
  stickyLabel: {
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: "9px",
    letterSpacing: "0.15em",
    textTransform: "uppercase",
    color: "#78716c",
    fontWeight: 500,
    marginBottom: "2px",
  },
  stickyValue: {
    fontFamily: "'Fraunces', serif",
    fontSize: "18px",
    fontWeight: 700,
    color: "#fef3c7",
    fontVariantNumeric: "tabular-nums",
    letterSpacing: "-0.01em",
  },
  stickyValueAccent: {
    fontFamily: "'Fraunces', serif",
    fontSize: "20px",
    fontWeight: 800,
    color: "#fbbf24",
    fontStyle: "italic",
    fontVariantNumeric: "tabular-nums",
    letterSpacing: "-0.02em",
  },
  stickyDivider: {
    width: "1px",
    height: "28px",
    background: "#44403c",
    flexShrink: 0,
  },
  modalOverlay: {
    position: "fixed",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(28, 25, 23, 0.85)",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 2000,
    padding: "24px",
    cursor: "zoom-out"
  },
  modalContent: {
    background: "#fefdf8",
    border: "2px solid #1c1917",
    padding: "32px",
    maxWidth: "960px",
    width: "100%",
    position: "relative",
    cursor: "default",
    boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.3), 0 10px 10px -5px rgba(0, 0, 0, 0.3)"
  },
  modalCloseBtn: {
    position: "absolute",
    top: "20px",
    right: "24px",
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: "11px",
    textTransform: "uppercase",
    background: "#1c1917",
    color: "#fef3c7",
    border: "none",
    padding: "6px 12px",
    cursor: "pointer",
    fontWeight: "bold",
    letterSpacing: "0.05em",
    zIndex: 10
  },
  modalChartHeader: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    borderBottom: "1px solid #d6d3d1",
    paddingBottom: "16px",
    marginBottom: "8px"
  },
  zoomHint: {
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: "9px",
    letterSpacing: "0.05em",
    textTransform: "uppercase",
    color: "#d97706",
    marginLeft: "12px",
    cursor: "pointer"
  }
};
