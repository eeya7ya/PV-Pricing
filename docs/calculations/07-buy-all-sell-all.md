# Calculation 7 — Buy‑All / Sell‑All (Mechanism 4)

**Source:** `client/src/components/CalculatorLogic.tsx`
(`calculateBuyAllSellAll`, `:486`; `calculateIndustrialBuyAllSellAll`, `:300`).

Unlike the other mechanisms, the **Buy‑All/Sell‑All** path is computed entirely
on the **client** (no `/api/calculate` round trip). Under M4 the consumer buys
**all** of their consumption at the retail tariff and sells **all** of their
generation at the export rate through a separate meter, so import and export
never net against each other.

The grid‑service fee for M4 is **zero** (see [doc 5](./05-universal-add-ons-and-fees.md)).

---

## Generation approximation (X2)

```
total_annual_consumption = Σ monthly consumption
x2Approximate            = total_annual_consumption / 12      # flat monthly generation
```
Used as `generation` for every month.

---

## Residential M4 — `calculateBuyAllSellAll`

```
sector       = tariff_supported ? A1_subsidized : A2_unsubsidized
importTariff = tariffCalculator.calcImportCost(consumption)   # full retail, no PV offset
exportTariff = generation × exportRate                        # default 0.05 JD/kWh
addOns       = calcUniversalAddOns(... meterPhase 1, applyTvFee true, ruralFils, meterRent)
bill_before  = applyMinimumBillJD(importTariff + addOns, sector)
netCost      = bill_before − exportTariff                     # export is revenue, not a discount
savings      = bill_before − netCost  (= exportTariff)
```

The minimum bill applies to the **import (energy + add‑ons) side before** the
export offset — export is treated as separate revenue.

---

## Industrial M4 — `calculateIndustrialBuyAllSellAll`

The 4 time‑period distribution factors (`industrialBassConfig`) must sum to
1.000 (validated, `:328`). The import tariff depends on the industrial type:

**Small Industrial** (tiered):
```
consumption ≤ 10000 kWh → consumption × 0.06 JD/kWh
consumption > 10000 kWh → 10000 × 0.06 + (consumption − 10000) × 0.068
```

**Medium Industrial** (per‑period rates on the bucketed load):
```
y1 (Off Peak 05–14)   × 0.059
y2 (Half Peak 14–17)  × 0.069
y3 (Peak 17–23)       × 0.079
y4 (Half Peak 23–05)  × 0.069
importTariff = Σ
```

Then, per month:
```
exportTariff = generation × export_rate           # config export rate (default 0.05)
addOns       = calcUniversalAddOns(... sector C1/C2, meterPhase 3, no TV, ruralFils, meterRent)
bill_before  = applyMinimumBillJD(importTariff + addOns, sector)
netCost      = bill_before − exportTariff
```

Inverter size is reported via `inverterKWacFromMonthlyKWh(x2Approximate, 'industrial')`.

---

## Notes

- No taxes / demand‑charge layer — EMRC abolished demand charges in 2024
  (`calculateTaxes` returns 0, `CalculatorLogic.tsx:285`).
- No self‑consumption and no export‑by‑period split: under M4 everything is
  exported, everything is imported.
- `annual_savings = total_cost_before − total_net_cost` (the export revenue net
  of the full retail import).

## Inputs

`customerType`, `consumption[12]`, `efficiency`, `tariffSupported`,
`exportTariff`, and (industrial) `industrialBassConfig`
(type + four period factors + export_rate).

## Outputs

A `CalculationResults` object identical in shape to the server path:
`monthly_data[12]` (with `period_details` for industrial) + `annual_summary`
(`net_billing_savings` and `final_credit_balance` are 0 — not applicable to M4).
