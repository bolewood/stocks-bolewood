# SoftBank holdco NAV bridge — reviewed September 5, 2026

This calculator combines dated issuer observations with scenarios. It does **not** establish current reported NAV or exact shareholder-attributable OpenAI ownership. Every curated record in [sftby-sotp.json](./sftby-sotp.json) has a basis, date and source. Common shares, ADR ratio, pro forma OpenAI stake and the valuation anchor are shared with `/ai` through [SFTBY.json](./wrappers/SFTBY.json) and [marks.json](./marks.json).

## What changed

- Replace the stale $840B anchor with [OpenAI's March 31 $852B post-money round](https://openai.com/index/accelerating-the-next-phase-ai/). A $1.6T IPO is a user scenario.
- Remove `13% × funded cost / eventual cost`: investments at different prices do not reveal current ownership. Default to the disclosed pro forma case. The optional July proxy scales the [rounded $100B July 31 gross fund FV](https://group.softbank/media/Project/sbg/sbg/pdf/ir/presentations/2026/investor-svf_q1fy2026_01_en.pdf#page=10) against $852B. This is a cross-date, cross-security calibration, not an issuer ownership disclosure. The 13% includes October funding.
- Use the same 5,699,049,389 ordinary shares and 1:2 ADR ratio as `/ai`. These are outstanding shares, not forecast diluted shares. [July option terms](https://group.softbank/en/news/press/20260730) do not establish exercised shares.
- Retain 922,733,999 Arm shares, corroborated by the [FY2026 20-F](https://investors.arm.com/static-files/0b97f8e1-ac58-4b25-84d8-9df66807ab19). Its May 21 ownership percentage was approximately 86.4%; remove the stale 86.7% label.
- Preserve SBG's reported SVF2 NAV instead of claiming a gross OpenAI holding can be carved out as an exact shareholder allocation. Apply only an incremental valuation bridge.
- Remove undated Fiscal.ai EV/debt/market-cap comparisons. Freeze June balance translations at June FX, rather than treating every reported yen equivalent as a yen-denominated liability. FX now converts modeled USD NAV into yen.
- Add dilution, allocation sensitivity, optional tax/basis inputs, other net-debt adjustment, the $1.6T preset, full scenario links and downloads. Solve the residual against the complete model; do not report a negative company valuation.

## Economic perimeter and equations

[Issuer NAV, June 30](https://group.softbank/en/ir/stock/sotp): ¥83.11T adjusted holdings less ¥10.81T SBG adjusted net debt equals ¥72.30T pre-tax NAV. SVF2's ¥19.29T is already SBG's share of NAV. Arm's ¥3.22T financing is deducted from Arm and excluded from adjusted debt. Subsidiary debt already reflected in equity values is not subtracted again. Preserve the small rounding differences in the published totals.

All equations below use USD billions. June yen observations are converted at 162.39. Other reported balances stay frozen in USD; this is not a full FX or hedging model.

```text
Pro forma gross OpenAI = 0.13 × selected company value × (1 − dilution)
July gross OpenAI proxy = 100 × selected company value / 852 × (1 − dilution)
Discounted OpenAI = gross OpenAI × (1 − liquidity discount)
OpenAI change = discounted OpenAI − 89.6
New funding = July 10 + October 10 if pro forma
Incremental revaluation = OpenAI change − new funding
Management sensitivity = selected rate × max(0, incremental revaluation)

Arm net = 922,733,999 × ARM quote / 1e9 − June Arm financing
Other base = June total holdings − June adjusted Arm − June SVF2
Holdings = Arm net + June SVF2 + other base × multiplier
           + OpenAI change − management sensitivity
Net debt = June SBG adjusted net debt + new funding + other net-debt adjustment
Tax proxy = selected tax rate × [max(0, Arm gross − selected Arm basis)
            + max(0, discounted OpenAI − management sensitivity − funded cost)]
NAV = holdings − net debt − tax proxy
Market cap = SFTBY quote × 11,398,098,778 / 1e9
NAV / ADR = NAV × 1e9 / 11,398,098,778
Gross OpenAI per $100 = 100 × gross OpenAI / market cap
```

The OpenAI June report gives $89.6B gross FV and $44.6B cost. July adds $10B of cost and net borrowing; October adds another $10B in the pro forma scenario. A new investment valued at cost offsets its funding and does not create NAV. Historical carry is not rebased when the valuation or dilution sliders move.

## Unresolved assumptions

**Management economics.** [The shareholder-meeting disclosure](https://group.softbank/media/Project/sbg/sbg/pdf/ir/investors/shareholders/2026/shareholders-meeting_46_02_en.pdf#page=71) puts OpenAI within the co-investment program. [June Note 14](https://group.softbank/media/Project/sbg/sbg/pdf/ir/financials/financial_reports/financial-report_q1fy2026_01_en.pdf#page=65) describes preferred capital, restricted distributions and receivable offsets. The 17.25% relates to fund Equity, not every gross asset. Public aggregate disclosures do not permit an exact future per-asset allocation. The model brackets 0–17.25% of **positive incremental revaluation**, excluding new capital, defaulting to the larger deduction. This is an author-selected stress, not a confidence interval, proven bound, actual tax basis or replication of the whole waterfall. Fund hurdles, other investments and losses can produce different outcomes. Do not label 13% × 82.75% as a disclosed net stake.

**Funding and current balances.** [July completion](https://group.softbank/en/news/press/20260701) confirms $10B invested and borrowed. October remains planned and may accelerate on a listing. The $40B bridge is a facility limit. The August SVF2 $10B loan agreement in the quarterly report does not independently reconcile its draw and cash uses. The default zero other-net-debt adjustment is an unresolved bridge, not evidence that no other cash flows occurred. Interest accrual, operating cash use, disposals, repayments, acquisitions and financing fees are not automatically projected. The control stresses their net effect; a transaction with a new asset also requires that asset's corresponding value.

**Tax and securities.** Tax and liquidity discounts default to zero. The inherited $40B Arm basis is explicitly unverified and adjustable; no disclosed tax basis was found. Gross preferred/common exposure uses linear scenarios and cannot reproduce all security rights, conversion adjustments or liquidity restrictions. Dilution is an input, not a forecast. SBG's own future stock dilution is not modeled.

**Other holdings.** SVF1, LatAm, SoftBank Corp., T-Mobile and other assets retain June values plus disclosed rounding. SVF2's full June base remains separately visible. Neither SB Energy nor subsidiary assets are added again on top of existing holdings. This model does not mark every listed security or private investment to September 5.

## Events checked through September 5

| Evidence | Treatment |
| --- | --- |
| [August 4 ¥90B bond issue](https://group.softbank/en/news/press/20260729) | Proceeds earmarked for September redemption. Cash and borrowing are offset until uses occur; no automatic net-debt addition. |
| [August 28 LINE MAN timing](https://group.softbank/en/news/press/20260828) | $130M capital increase delayed until October; investment remains inside LY/SoftBank Corp.'s equity perimeter. |
| [September 2 SB Energy IPO filing](https://group.softbank/en/news/press/20260902) | Price and offered share count are undetermined. No invented IPO valuation or duplicate asset. |
| [September 4 ¥1T bond terms](https://group.softbank/en/news/press/20260904) | 4.75%, September 17 planned issue; redemptions and ABB robotics funding. Not September 5 debt or free cash. |
| [July 30 options](https://group.softbank/en/news/press/20260730) | Keep the dated outstanding-share denominator; authorization/issuance of rights does not prove exercise. |
| [CFO acquisition/capital plans](https://group.softbank/en/ir/financials/annual_reports/2026/message/goto) | ABB robotics and DigitalBridge are planned; do not book an asset without its purchase funding, or confuse gross consolidated debt with holdco net debt. |

## Reproduce

- `npm test` covers the June issuer NAV identity, July/October funding offsets, all sensitivities, full residual equation, share counts, source metadata and `/ai` gross parity over 48 combinations.
- `npm run reference` continues to verify `/ai` at its original frozen prices. Its $16.54 SFTBY price is different from the September 4 $17.72 snapshot used by the SOTP example.
- `/sftby?reference=sftby` fixes September 4 snapshot quotes and disables the quote request. `/sftby?reference=sftby&scenario=ipo1600` selects the user's $1.6T case. Copying a scenario includes **every** selected input and pins quote fields against later quote responses.
- Download includes all inputs, outputs, source configuration, shared wrapper and company marks. The calculation lives in `lib/sftbySotp.mjs`; a saved input object can be passed to `computeSotp` to reproduce it.

At ARM $252.09 and SFTBY $17.72, the 13%, $1.6T, zero-dilution scenario produces $208B gross OpenAI exposure against $201.974310346B market cap: **$102.983394098 per $100**. This ratio is before management allocation, debt and taxes. It is not a realizable shareholder asset value.
