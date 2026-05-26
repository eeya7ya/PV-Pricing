# Calculation 5 — Universal Add‑ons, Fees & Minimum Bill

**Source:** `shared/jordanTariffs.ts`
**Used by:** `server/routes.ts` (`finalizeBill`) and the client Buy‑All path.

After the energy charge (doc 4) is computed, every monthly bill is finalized by
layering on the universal add‑ons, the power‑factor penalty (where applicable),
and the minimum‑bill floor. The Bylaw 58/2024 grid‑service fee is added once per
year.

---

## Universal add‑ons — `calcUniversalAddOns(input)` `jordanTariffs.ts:490`

Charged on **imported kWh** (never on exported kWh):

| Add‑on | Rule | Constant |
|--------|------|----------|
| Rural fils | `1 fils/kWh × importKWh` | `RURAL_FILS_PER_KWH = 1` (`:424`) |
| Fuel clause | `getFuelClauseFils(monthKey) × importKWh` | `FUEL_CLAUSE_FILS_BY_MONTH` (`:438`); all 0 fils through May 2026 |
| TV fee | `1.0 JD/month`, **residential only** | `TV_FEE_JD_PER_MONTH = 1.0` (`:425`) |
| Meter rent | single‑phase 0.2 JD / three‑phase 0.5 JD | `METER_RENT_JD` (`:426`) |
| GAM municipal | ≤200 kWh: 1.667 JD; >200: `1.667 + 0.005·(kWh−200)` | `gamMunicipalFeeJD` (`:463`) |
| Waste fee | class A 3.0 / B 2.0 / C 1.667 JD | `WASTE_FEE_JD` (`:451`) |

Returns an `AddOnBreakdown` with each component and `totalJD`.

> The fuel clause applies to imported kWh only, under any prosumer mechanism;
> future months default to 0 until EMRC publishes a non‑zero value.

---

## Power‑factor penalty — `powerFactorSurchargeJD(billJD, pf)` `:529`

NEPCO §I.1.d. Threshold **0.88**; below it a surcharge is applied per 0.01 step:

```
steps      = round((0.88 − pf) / 0.01)
pctPerStep = pf ≥ 0.70 → 0.77 %
             pf ≥ 0.60 → 0.95 %
             pf ≥ 0.50 → 1.20 %
             else      → 1.50 %
surcharge  = billJD × (pctPerStep × steps) / 100
```

Applies only where `sectorAllowsPFPenalty(sector)` is true (`pfPenaltyApplies`
flag): industrial C2/C3/C4, 3‑part agriculture F2, and 3‑part 4★+ hotels
D1/D2. The engine defaults power factor to 0.90 → no penalty.

---

## Minimum bill — `applyMinimumBillJD(rawBillJD, sector)` `:514`

```
floor = sector.minBillJD ?? (residential 1.75 JD : non-residential 2.0 JD)
final = max(rawBillJD, floor)
```
(`MIN_BILL_JD`, `:427`.)

---

## Grid‑service fee (Bylaw 58/2024 §V) — `gridServiceFeeJD(input)` `:648`

Monthly fee per inverter **kWac**, billed × 12 annually:

| Customer | Fee (JD/kWac/month) |
|----------|---------------------|
| Residential, post‑1/6/2024 application | 1.0 |
| Residential, legacy application | 2.0 |
| Small / medium industrial (C1/C2) | 0 (exempt) |
| Agriculture (F1/F2/F3) | 0 (exempt) |
| Hotels (D) | 2.5 |
| Commercial / banks / large industrial / hospitals / special | 13.0 |
| M4 Buy‑All/Sell‑All (any sector) | 0 (exempt) |
| M5 legacy net metering | 0 (exempt) |
| Welfare beneficiary (NAF / Takaful 1&3 / Royal Initiative) | 0 (exempt) |

`gridServiceFeeM3JD` (`:1029`) reuses the M2 schedule as a conservative
upper‑bound default until EMRC publishes M3‑specific values.

---

## How they combine — `finalizeBill` (`routes.ts:519`)

```
addOns     = calcUniversalAddOns(...)
pfSurcharge= sectorAllowsPFPenalty && pf < 0.88 ? powerFactorSurchargeJD(rawBill, pf) : 0
subtotal   = max(0, rawBill) + addOns.totalJD + pfSurcharge
finalBill  = applyMinimumBillJD(subtotal, sector)
```

Applied to **both** the before‑PV bill (import = full consumption) and the
after‑PV bill (import = residual after self‑consumption and credits). The annual
grid‑service fee is added once to `total_cost_after` (`routes.ts:788`).
