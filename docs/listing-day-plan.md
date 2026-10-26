# Anthropic Listing-Day Plan (`Nasdaq: ANT`)

> **Status:** Preparation plan only — do **not** implement until `ANT` prices and lists on the Nasdaq Global Select Market.
> **Source:** Anthropic, PBC Form S-1 (Reg. No. 333-299633, accession `0001628280-26-067168`, filed publicly 2026-10-26 at 09:00:11 ET).

---

## 1. Yahoo Finance quote & recycled-ticker guard (`ANT`)

Anthropic has applied to list its Class A common stock on the Nasdaq Global Select Market under the symbol **`ANT`** (S-1 p. 20).

Before adding `ANT` to `/api/prices` and `/api/ai-prices` via `lib/yahooQuote.mjs` (`fetchChartPrice`):
- Enforce the existing `meta.symbol === "ANT"` guard **plus** a listing-date / exchange guard (`meta.exchangeName === "NMS"` or `"NasdaqGS"` and `meta.firstTradeDate >= listingEpochSeconds`), following the same pattern used for `SATS` → `ECHO` and `SPCX`.
- Reject any stale OTC or historical recycled `ANT` chart history whose `firstTradeDate` predates the November 2026 IPO pricing date.

---

## 2. 10-for-1 stock split & unit basis alignment

Anthropic effected a 10-for-1 forward stock split of Class A and Class N common stock on **2026-09-17** (S-1 p. 22). Preferred prices in S-1 p. F-47 and June 30, 2026 wrapper holdings (`DXYZ` `386,088` Magnitude ANC III units; `SKM` `3,860,330` shares) are pre-split, while live `ANT` quotes on Nasdaq will be **post-split**.

Two equivalent implementation options at listing (pick one atomically across `data/`, `lib/`, and `reference/`):
1. **Keep `data/` pre-split (minimal diff on historical filings):** Multiply the live `ANT` share price by `splitFactor = 10` (`preSplitEquivalentPps = antLivePrice * 10`) before valuing pre-split `filed-units` (`DXYZ`, `SKM`) and round-price share-equivalents, and continue displaying `"$X per ANT share ($10X per pre-split unit)"`.
2. **Migrate all Anthropic counts to post-split `ANT` shares:** Multiply `capitalization.json` `anthropic.*Shares` by `10` (`17,783,660,160` post-split pre-offering, plus IPO primary shares from the final 424B4), divide `roundPrices` by `10` (Series H-1 `$58.90095`), and multiply `DXYZ` (`3,860,880` post-split Class N equivalents) and `SKM` (`38,603,300` post-split equivalents) by `10` with an explicit `splitAdjustedFrom` field so raw pre-split filing numbers remain auditable.

Note on share class liquidity (S-1 pp. 20, 309):
- Series A, C-1 (`ARKVX`), D-1, D-2, E-1, F-1, G-1, H-1 convert into listed **Class A** common stock (1 vote/share).
- Series B (`DXYZ` Magnitude ANC III), C-2, D-3, E-2…E-5, F-2, G-2…G-4, H-2…H-4, and Amazon's convertible notes convert into unlisted, non-voting **Class N** common stock, which converts into Class A on a "qualifying transfer." Valuing Class N at parity with listed Class A (`ANT`) remains an explicit modeling convention, subject to lock-ups (S-1 pp. 321–323) and SPV distribution mechanics.

---

## 3. Switch default valuation from `1.0× Series H` (`$0.965T`) to live `ANT` market cap

Once the S-1/A and final 424B4 prospectus disclose the offering size, IPO price, and post-offering share counts:
- Update `data/capitalization.json` with the post-offering fully diluted share count (including primary Class A shares sold in the offering, full Amazon Note conversion, and the `846,840,960` post-split Class N shares held by Anthropic Public Benefit Fund, LLC; S-1 pp. 13, 20, 24).
- On `/ai` and `/dxyz`, switch the default Anthropic scenario from `1.0× Series H ($0.965T)` to **Live `ANT` market cap** (`liveAntPrice × postOfferingFdShares`), while keeping the scenario slider and `1.0× Series H` / IPO-price presets available for counterfactual comparison.
- On `/dxyz`, follow the same pattern as `SPCX`: default Box 1 Anthropic to the live `ANT` quote (`× 10` per pre-split unit) with a `● LIVE ANT` indicator, while `Restore June 30 snapshot` freezes the June 30 `$610.41` pre-split mark.

---

## 4. `io:ANTH` pre-IPO perp settlement / transition & `/anthropic-ipo-tape`

Entropy's `io:ANTH` market on Hyperliquid is a **pre-IPO implied-valuation perpetual** quoted in `$B` of implied valuation (`markPx`).
- **At IPO pricing / first trade:** Check Entropy / Hyperliquid HIP-3 contract specifications for whether `io:ANTH` settles to the IPO/first-day mark, transitions into a public-equity perpetual (analogous to `xyz:SPCX` after SpaceX's 2026-06-12 Nasdaq listing), or winds down.
- **On `/anthropic-ipo-tape`:**
  - Anchor `lockupSchedule.pricingDate` in `data/anthropic-investor-day.json` to the actual pricing date (`YYYY-MM-DD`) so `formatLockupMilestoneOffset` renders concrete calendar dates for day 1, day 27, day 48, day 62, day 76, day 180, and day 365 releases (S-1 pp. 321–323).
  - Add the live Nasdaq `ANT` quote, intraday return vs IPO price and vs prior close, and post-offering market cap to the hero scoreboard alongside (or replacing, if settled) `io:ANTH`.
  - Record final resolution values for the Polymarket (`closingCap`, `ipoBy`) and Kalshi (`ipoBefore2027`, `confirmedByDec1`) markets.
- **On `/private-tape` (`data/private-tape.json`):** Re-tag `assets.anthropic.tapeRole` from `"private_pre_ipo_perp"` to `"public_equity_perp"` (matching `assets.spacex`) once `ANT` begins regular-way Nasdaq trading, and record `publicListing.firstTradeDate` and `ticker: "ANT"`.

---

## 5. Public-benefit milestone issuances (+2% per +50% share price appreciation)

Under S-1 p. 13 (also pp. 144, 236):
- Anthropic contributed `846,840,960` post-split Class N shares (5% of June 30, 2026 FD shares) to **Anthropic Public Benefit Fund, LLC**.
- After the IPO, the board may issue up to an **additional 2% of then-outstanding shares (fully diluted, including the fund's shares)** to the fund each time the share price appreciates **50% above the prior milestone**, starting from the **IPO price** (`M_1 = 1.50 × P_IPO`, `M_2 = 1.50 × M_1 = 2.25 × P_IPO`, etc.).
- Once the IPO price `P_IPO` is set in the 424B4:
  - Store `ipoPrice` and the first milestone trigger price `1.50 × P_IPO` in `data/capitalization.json`.
  - On `/ai`, show the exact `ANT` share price thresholds (`1.5×`, `2.25×`, `3.375×` IPO price) next to the `+one future issuance` (`× 1.02`) FD preset, and optionally allow toggling automatic `× 1.02^k` step-ups when the scenario `ANT` share price crosses each `+50%` milestone.
