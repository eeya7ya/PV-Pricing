# Results — Output Structure

**Source schema:** `shared/schema.ts` (`CalculationResultsSchema`, `:200`).
**Produced by:** `/api/calculate` (server), the Buy‑All/Sell‑All client path,
and `/api/calculate-npv` (financial).
**Consumed by:** `BeforeAfterResults.tsx`, `Dashboard.tsx`, `TechnicalReport.tsx`,
the charts and gauges.

Every billing calculation returns the same shape:

```ts
CalculationResults = {
  monthly_data: MonthlyData[12],
  annual_summary: AnnualSummary,
  net_billing_enabled?: boolean
}
```

---

## `monthly_data[]` — one row per month (`MonthlyDataSchema`, `schema.ts:134`)

| Field | Unit | Meaning |
|-------|------|---------|
| `month` | — | `'Jan'` … `'Dec'` |
| `consumption` | kWh | Total load that month (x1) |
| `generation` | kWh | PV generated that month (x2) |
| `generation_day` / `_evening` / `_night` | kWh | Generation split across time buckets |
| `self_consumption` | kWh | PV used on‑site (avoids the import rate) |
| `export` | kWh | PV sent to grid (earns the export rate) |
| `import` | kWh | Energy drawn from grid after self‑consumption |
| `bill_before` | JD | Monthly bill **without** PV (finalized: energy + add‑ons + min‑bill + PF) |
| `bill_after` | JD | Monthly bill **with** PV (after credits, add‑ons, min‑bill) |
| `raw_bill_after` | JD | `import_cost − export_revenue` before the credit ledger / add‑ons (optional) |
| `import_cost` | JD | Cost of imported energy at the sector tariff |
| `export_revenue` | JD | Revenue from exported energy |
| `savings` | JD | `bill_before − bill_after` |
| `monthly_credit_used` | JD | Net‑billing credit drawn down this month |
| `monthly_credit_generated` | JD | Net‑billing credit earned this month |
| `running_credit_balance` | JD | Carry‑forward credit balance after this month |
| `period_details` | string | Industrial Buy‑All period breakdown (optional) |

---

## `annual_summary` — 12‑month totals & metadata (`AnnualSummarySchema`, `schema.ts:158`)

### Energy & sizing
| Field | Unit | Meaning |
|-------|------|---------|
| `total_consumption` | kWh/yr | Σ monthly consumption |
| `pv_size` | kWh/mo | Monthly PV generation (or annual/12 with a design override) |
| `inverter_size` | kWac | Sized inverter nameplate |
| `kwp_dc` | kWp | DC array size |
| `dc_ac_ratio` | — | 1.5 residential / 1.2 non‑residential |
| `specific_yield_kwh_per_kwp_year` | kWh/kWp/yr | EMRC standard (1800) |
| `annual_generation` | kWh/yr | Σ monthly generation |
| `total_self_consumption` | kWh/yr | Σ self‑consumption |
| `total_export` | kWh/yr | Σ export |
| `efficiency` | fraction | System efficiency used |

### Money
| Field | Unit | Meaning |
|-------|------|---------|
| `cost_before` | JD/yr | Σ `bill_before` |
| `cost_after` | JD/yr | Σ `bill_after` + annual reset + grid‑service fee |
| `annual_savings` | JD/yr | `cost_before − cost_after` |
| `export_revenue` | JD/yr | Σ export revenue |
| `export_tariff` | JD/kWh | Effective export rate applied |
| `net_billing_savings` | JD/yr | Extra savings from drawing down credits |
| `final_credit_balance` | JD | Credit left after the annual reset |
| `total_savings_with_net_billing` | JD/yr | `annual_savings + net_billing_savings` |
| `grid_service_fee_jd_per_month` / `_annual` | JD | Bylaw 58 §V fee |
| `forfeited_credit_jd` / `cashed_out_credit_jd` | JD | Year‑end reset outcome |

### Metadata / advisories
| Field | Meaning |
|-------|---------|
| `sector` / `sector_label` | Resolved EMRC sector |
| `net_billing_mechanism` | M1–M5 applied |
| `mechanism_cap_fraction` | Generation cap fraction (0.5 / 1.0) |
| `inverter_cap_kwac` / `inverter_cap_binding` | Residential 3.6/10 kWac cap and whether it bound |
| `loses_residential_subsidy` | Subsidy‑loss flag (advisory) |
| `eligibility_status` | `eligible` / `ineligible` / `unclear` (advisory) |
| `annual_reset_policy` | `forfeit_year_end` / `cash_out` / `rollover_indefinite` |
| `pv_design_active` | `true` if a PV‑design generation override was used |

---

## Financial results (`/api/calculate-npv`)

A separate, smaller payload — see [doc 9](./calculations/09-financial-npv-roi.md):

```json
{ "npv": <JD>, "irr": <%>, "payback": <years>, "lcoe": <JD/kWh> }
```

---

## Reading the results

- **The headline number** is `annual_summary.annual_savings` (or
  `total_savings_with_net_billing` when credit‑ledger drawdown matters).
- **Self‑consumption vs export** explains *why* the savings land where they do:
  on‑site use avoids the (higher) import tariff, export only earns the (lower)
  export rate.
- **`bill_before` vs `bill_after`** per month drives the before/after bar chart;
  both are fully finalized bills (energy + add‑ons + minimum‑bill floor + any
  PF penalty), so they are directly comparable to a real EMRC invoice.
- **Advisory flags** (`eligibility_status`, `loses_residential_subsidy`,
  `inverter_cap_binding`) never block a calculation — they warn the engineer.
