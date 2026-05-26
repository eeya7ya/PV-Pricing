# Calculation 3 — Inverter & PV Sizing

**Source:** `shared/jordanTariffs.ts` (sizing constants + helpers),
applied in `server/routes.ts` (`/api/calculate`).

When the user does **not** supply an explicit design via the PV Design module,
the billing engine sizes the system from the customer's consumption using the
EMRC standard specific yield and the Bylaw 58/2024 DC:AC and inverter caps.

---

## Specific yield

```
SPECIFIC_YIELD_KWH_PER_KWP_YEAR  = 1800        // EMRC standard
SPECIFIC_YIELD_KWH_PER_KWP_MONTH = 1800 / 12 = 150
```
(`jordanTariffs.ts:739`)

## DC:AC ratio and the kWp ↔ kWac conversion

```
DC_AC_RATIO = { residential: 1.5, nonResidential: 1.2 }   // jordanTariffs.ts:748

kWpFromKWac(kWac, class)  = kWac × ratio
kWacFromKWp(kWp,  class)  = kWp  / ratio
```

## Target monthly generation (consumption‑based fallback)

In `routes.ts` the target monthly PV generation starts as:
```
monthly_pv_generation = (total_annual_consumption / 12) × capFraction
```
where `capFraction` is the mechanism's generation cap (see
[net‑billing](./06-net-billing-mechanisms.md)): M1 = 0.50, M2 residential =
1.00, M2 non‑res = 0.50, M3/M4/M5 = 1.00.

## Inverter sizing from monthly kWh

`inverterKWacFromMonthlyKWh(monthlyKWh, class)` — `jordanTariffs.ts:785`
```
kWp  = monthlyKWh / 150
kWac = kWp / DC_AC_RATIO[class]
```
In `routes.ts` this is further divided by system efficiency:
```
estimated_kwac = inverterKWacFromMonthlyKWh(monthly_pv_generation, class) / (efficiency/100)
```

## Residential inverter cap

`applyResidentialInverterCap(kWac, phase, class)` — `jordanTariffs.ts:797`

```
RESIDENTIAL_INVERTER_CAP_KWAC = { singlePhase: 3.6, threePhase: 10 }
```
- Single‑phase residential capped at **3.6 kWac** (≈ 5.4 kWp DC at 1.5).
- Three‑phase residential capped at **10 kWac** (≈ 15 kWp DC at 1.5).
- Non‑residential: pass‑through (no hard kWac cap; sizing constrained by the
  grid‑impact study).

**When the cap binds**, the engine re‑derives the achievable generation from
the capped inverter (`routes.ts:433`):
```
kWp_DC               = kWac × DC:AC ratio
monthly_pv_generation= kWp_DC × 150 × (efficiency/100)
```

## Residential subsidy‑loss trigger

`losesResidentialSubsidy(inverterKWac, phase)` — `jordanTariffs.ts:726`
```
SUBSIDY_LOSS_TRIGGER_KW = { singlePhaseInverter: 3.6, threePhaseParallel: 10 }
```
A residential customer on the subsidized A1 tariff **loses the subsidy** if the
inverter exceeds 3.6 kWac (single‑phase) or 10 kWac (three‑phase parallel).
Surfaced as `loses_residential_subsidy` in the results (advisory, non‑blocking).

---

## Inputs

`total_annual_consumption` (from monthly consumption), `sectorClass`,
`net_billing_mechanism`, `connection_phase`, `efficiency`, and optionally
`inverter_kwac` (explicit override) / `kwp_dc_override` (from PV Design).

## Outputs (into `annual_summary`)

`inverter_size` (kWac), `kwp_dc`, `dc_ac_ratio`,
`specific_yield_kwh_per_kwp_year`, `inverter_cap_kwac`, `inverter_cap_binding`,
`pv_size` (monthly kWh), `annual_generation`.
