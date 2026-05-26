# Calculation 6 — Net‑Billing Mechanisms & the Before/After Engine

**Source:** `server/routes.ts` (`POST /api/calculate`) + `shared/jordanTariffs.ts`.

This is the core of the app: it computes the **12‑month before‑PV and after‑PV
bills** for the chosen Bylaw 58/2024 (or legacy) grid‑connection mechanism, and
sums them into annual savings.

---

## The five mechanisms

`NetBillingMechanism` (`jordanTariffs.ts:627`). The UI's grid‑connection label
maps to a mechanism in `CalculatorLogic.tsx` (`mechanismFor`, `:45`):

| UI label | Mechanism | Meaning |
|----------|-----------|---------|
| Net billing | **M2** net value on‑site | Default; export paid at a JD rate, self‑consumption offsets import |
| wheeling | **M1** net value off‑site | Generation at a remote site wheeled to the off‑take; 50 % cap |
| Zero export | **M3** zero export | Export‑limiter; any spill is **not** compensated |
| Buy all sell all | **M4** buy‑all/sell‑all | Separate meter, all generation sold; zero grid fee (see [doc 7](./07-buy-all-sell-all.md)) |
| Legacy net metering | **M5** legacy | Grandfathered pre‑1/6/2024; 1:1 kWh netting |

## Generation cap — `mechanismGenerationCapFraction(mech, class)` `:826`

Caps annual PV generation as a fraction of the prosumer's last‑12‑months
consumption:

| Mechanism | Cap |
|-----------|-----|
| M1 wheeling | 50 % |
| M2 net billing, residential | 100 % |
| M2 net billing, non‑residential | 50 % |
| M3 / M4 / M5 | 100 % |

Applied as `monthly_pv_generation = (annual_consumption / 12) × capFraction`
(`routes.ts:412`).

## Eligibility — `isEligibleForMechanism(sector, mech)` `:856`

Returns `eligible` / `ineligible` / `unclear`. Advisory only — surfaced as
`eligibility_status`, never blocks the calculation. M4 is the universal
fallback (`eligible`); M5 is always `unclear` (depends on the pre‑1/6/2024
approval date, checked via `isLegacyEligible`, `:1059`).

---

## Per‑month before/after loop

For each month (residential 3‑bucket path `routes.ts:693`, industrial 4‑bucket
path `:596`):

```
x1 = consumption[month]                 // load
x2 = pvGenForMonth(monthIndex)          // PV generation (design override,
                                        // seasonal share, or flat)

# Split load into time buckets by the per-month factor grids → y1..y3/y4
# BEFORE bill:
bill_before_raw = priceMonthlyImport(total load, TOU map if sector is TOU)
bill_before     = finalizeBill(bill_before_raw, load, month)   # add-ons, min-bill, PF

# Split generation into buckets (z*) and compute self-consumption:
k_i             = min(z_i × pvConsumeFactor_i, y_i)            # capped at that bucket's load
self_consumption= Σ k_i
export_energy   = Σ max(0, z_i − k_i)
import_energy   = Σ max(0, y_i − k_i)

import_cost     = priceMonthlyImport(import_energy, TOU map)
export_revenue  = (M3 or M5) ? 0 : export_energy × effective_export_rate
raw_net_bill    = import_cost − export_revenue
ledger          = applyCreditLedger(raw_net_bill)              # see below
bill_after      = finalizeBill(ledger.bill_after_credits, import_energy, month)
```

Self‑consumption is the key economic lever: a kWh consumed on‑site avoids the
**import rate** (e.g. 0.20 JD/kWh top residential tier), while an exported kWh
only earns the **export rate** (0.05 JD residential / 0.04 non‑res).

### Export rate — `netBillingExportRateJD(sector)` `:706`
```
NB_RESIDENTIAL_EXPORT_RATE_JD = 0.05
NB_NONRES_EXPORT_RATE_JD      = 0.04
```
`routes.ts:474` honors an explicit override, else uses the sector default.

---

## Monthly credit ledger — `applyCreditLedger` (`routes.ts:561`)

Bylaw 58/2024 monetary credits that draw down deficits:

```
if raw_net_bill < 0:                       # net exporter this month
    credit_generated = −raw_net_bill
    running_credit_balance += credit_generated
    bill_after_credits = 0
elif running_credit_balance > 0:           # draw down prior credit
    use = min(running_credit_balance, raw_net_bill)
    running_credit_balance −= use
    bill_after_credits = raw_net_bill − use
    total_net_billing_savings += use
else:
    bill_after_credits = raw_net_bill
```

## Annual reset — `applyAnnualReset(balance, policy)` `jordanTariffs.ts:1005`

At December end the running credit is resolved by policy:

| Policy | Effect |
|--------|--------|
| `forfeit_year_end` (default) | Surplus zeroed; counted as **added cost** (credit earned but lost) |
| `cash_out` | DISCO pays surplus → **refund** (negative cost) |
| `rollover_indefinite` | Balance carries forward |

`total_cost_after += forfeited_credit_jd − cashed_out_credit_jd`
(`routes.ts:775`).

> Which policy the new monetary regime actually uses is flagged in the source
> as the single highest‑stakes open question; default matches legacy practice.

## M5 legacy net metering

`legacyNetMeteringMonthly(input)` (`jordanTariffs.ts:970`) settles in **kWh**,
not JD, with an export haircut (`LEGACY_EXPORT_HAIRCUT = 0.80`):
```
creditedExports = exportsKWh × haircut
netKWh          = imports − creditedExports − priorCarry
netKWh ≥ 0 → invoice = netKWh × (retailTariff + fuelClause); carry = 0
netKWh < 0 → invoice = 0; carry = −netKWh
```

---

## Final annual assembly (`routes.ts:790`)

```
total_cost_after += forfeited − cashed_out          # annual reset
total_cost_after += gridServiceFee × 12             # Bylaw 58 §V
annual_savings    = total_cost_before − total_cost_after
```

## Inputs (request body, validated in `routes.ts:219`)

`consumption[12]`, `efficiency`, `tariff_supported`, `export_tariff`,
`customer_type`, `sector?`, `power_factor`, add‑on toggles, `meter_phase`,
`net_billing_mechanism`, `inverter_kwac?`, `connection_phase`,
`post_bylaw_application`, `is_welfare_beneficiary`, `is_temporary`,
`annual_reset_policy`, `legacy_export_haircut`, `monthly_pv_generation_override?`,
`kwp_dc_override?`, `seasonal_generation_shares?`, and the per‑bucket
factor grids (3 residential / 4 industrial).

## Outputs

`monthly_data[12]` + `annual_summary` — fully described in
[`docs/results.md`](../results.md).
