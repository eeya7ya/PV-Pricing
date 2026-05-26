# Calculation 8 — Battery Sizing

**Source:** `shared/jordanPVDesign.ts` (`recommendBatterySize`, `:636`) +
`STORAGE_CHEMISTRY_DEFAULTS` (`:262`) + `BATTERY_LIBRARY` (`:253`).

A rule‑of‑thumb storage recommendation keyed to the prosumer mechanism — the
economic case for a battery depends entirely on the import‑vs‑export spread,
which differs per mechanism. An engineer can override the result.

---

## Recommendation — `recommendBatterySize(mechanism, avgDailyKWh)`

| Mechanism | Recommended kWh | Rationale |
|-----------|-----------------|-----------|
| `M2_res` (net billing, residential) | `round(avgDailyKWh × 0.40)` | 1–1.5× evening load — closes the 0.20 import vs 0.05 export arbitrage |
| `M2_com` (net billing, commercial) | `round(avgDailyKWh × 0.25)` | 0.5–1× midday excess; ~13 JD/kWac/mo grid fee makes self‑consumption attractive |
| `M3` (zero export) | `round(avgDailyKWh × 0.30)` | Absorbs expected midday curtailment volume × ~1 h |
| `M4` / `M5` | `0` | No case — every kWh already sells at a fixed / 1:1 rate |
| `off-grid` | `round(avgDailyKWh × 1.0)` | ~1 day autonomy at 90 % DoD (LFP); 2 days at 50 % DoD (lead‑acid) |
| `M1` (wheeling) | `0` | Wheeling does not benefit from storage at the off‑take |

Returns `{ recommendedKWh, rationale }`.

The intuition: storage pays off only where stored energy displaces a high
**import** rate that you would otherwise pay. Under M4/M5/M1 export is already
fairly priced, so there is nothing to arbitrage.

---

## Chemistry defaults — `STORAGE_CHEMISTRY_DEFAULTS`

| Chemistry | DoD | Round‑trip eff. | Degradation/yr | Cycle life | Calendar life |
|-----------|-----|------|----------------|------------|---------------|
| LFP | 0.90 | 0.92 | 2 % | 6000 | 12 yr |
| NMC | 0.80 | 0.92 | 3 % | 4000 | 10 yr |
| Lead‑acid | 0.50 | 0.80 | 5 % | 1200 | 6 yr |

(DoD = depth of discharge; usable energy = nominal × DoD.)

## Battery library

`BATTERY_LIBRARY` lists market units (Huawei LUNA2000, BYD HVS/HVM, Pylontech,
Sungrow SBR) with `nominalKWh`, `dod`, `rte` (round‑trip efficiency), `cycles`,
and `chemistry`.

## Inputs

`mechanism` (the recommendation enum), `avgDailyKWh` (average daily
consumption, ≈ annual consumption / 365).

## Outputs

`{ recommendedKWh, rationale }` — a sizing hint surfaced in the design panel,
not part of the billing `CalculationResults`.
