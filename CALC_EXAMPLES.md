# PV-Pricing — Worked Calculation Examples (Accuracy Test Vectors)

Purpose: verify the calculator by hand. For each **customer type × grid
mechanism**, this shows the exact formula sequence the code runs **and a fully
worked numeric example** carried from input to final output. Plug the same
inputs into the app and compare against the "Expected output" tables.

All examples use the simplest reproducible input so you can check arithmetic:

> **Standard test input:** 500 kWh every month (annual = 6,000 kWh),
> system efficiency = 95 %, single-phase, power factor = 0.90, fuel clause = 0
> (2026), all default time/sun/self-consumption factors, default add-on toggles.

Units: rates stored in **fils/kWh** (÷1000 → JD). 1 JD = 1000 fils.

Two engines exist:
- **Server** `/api/calculate` (`server/routes.ts`) — used by every mechanism
  **except** Buy-All/Sell-All.
- **Client** (`CalculatorLogic.tsx`) — used **only** for Buy-All/Sell-All (M4).

---

## 0. The server pipeline (applies to M1, M2, M3, M5)

Order of operations per run:

1. **Resolve sector** from customer type (`A1` subsidized residential, `A2`
   unsubsidized, `C2` medium industrial default, …).
2. **Size the system**
   - `X2 = (annual / 12) × capFraction`  ← target monthly generation
   - `kWp_DC = X2 / 150`,  `inverter_kWac = (kWp_DC / DC:AC) / efficiency`
   - residential cap: `inverter_kWac ≤ 3.6` (1-ph) / `10` (3-ph). If it binds,
     re-derive `X2 = inverter_kWac × DC:AC × 150 × efficiency`.
3. **Per month** (loop ×12): split consumption & generation into buckets →
   self-consumption → export & import → price import → export revenue →
   credit ledger → add-ons + min-bill + PF surcharge.
4. **Year-end**: apply annual credit reset; add annual grid-service fee.
5. `annual_savings = total_cost_before − total_cost_after`.

### Cap fraction (`capFraction`) by mechanism

| Mechanism | Residential | Non-residential |
|---|---|---|
| M1 wheeling | excluded | 0.50 |
| **M2 net billing** | **1.00** | **0.50** |
| M3 zero export | 1.00 | 1.00 |
| M4 buy-all/sell-all | 1.00 | 1.00 |
| M5 legacy | 1.00 | 1.00 |

### Per-bucket energy math (same shape for all server mechanisms)

```
y_i = consumption × consumptionFactor_i      # demand in bucket i
z_i = generation  × sunFactor_i              # PV produced in bucket i
k_i = min(z_i × selfConsumeFactor_i , y_i)   # self-consumed (capped at demand)
export_i = max(0, z_i − k_i)
import_i = max(0, y_i − k_i)
```

### Finalize a bill (`finalizeBill`)

```
addOns   = ruralFils(1 fils/kWh × import) + fuelClause + tvFee + meterRent + GAM + waste
pfSurch  = (sector allows PF penalty AND pf<0.88) ? banded surcharge : 0
finalBill = max( rawBill + addOns + pfSurch , minBill )      # minBill 1.75 res / 2.00 non-res
```

Add-on values for the standard input:
- rural fils = `1 × importKWh / 1000`
- TV fee = 1.000 JD **(residential only)**
- meter rent = 0.200 JD (1-ph) / 0.500 JD (3-ph)
- fuel/GAM/waste = 0

### Credit ledger (`applyCreditLedger`) per month

```
raw = import_cost − export_revenue
if raw < 0:   credit_balance += −raw ;  bill = 0          # surplus banked
elif balance>0: use = min(balance,raw); balance−=use; bill = raw−use
else:         bill = raw
```

### Year-end reset (default `forfeit_year_end`)

Residual `credit_balance` is **zeroed and ADDED to cost** as forfeited credit.
(`cash_out` subtracts it instead; `rollover_indefinite` keeps it.)

---

## 1. RESIDENTIAL · Net Billing (M2)  → sector A1 subsidized

**Tariff A1 (tiered):** 0–300 kWh @ 50 fils · 301–600 @ 100 · 601+ @ 200.
**Export rate:** 0.050 JD/kWh. **capFraction = 1.00.**

> ⚠️ The A1 *cash subsidies* (−2.5 / −2.0 JD) are defined in the table but
> **not applied** by the pricing function — don't expect them in the output.

### Sizing
- `X2 = 6000/12 × 1.00 = 500 kWh/mo`
- `kWp_DC = 500/150 = 3.333`
- `inverter_kWac = (3.333 / 1.5) / 0.95 = 2.339 kWac` → below 3.6 cap, not capped.

### One month (all 12 identical)
Buckets — consumption factors day/eve/night = 0.30/0.30/0.40; sun = 1.00/0.20/0.00;
self-consume = 0.70/0.90/1.00:

| | day | eve | night |
|---|---|---|---|
| y (demand) | 150 | 150 | 200 |
| z (PV) | 500 | 100 | 0 |
| k (self-cons) | min(350,150)=**150** | min(90,150)=**90** | min(0,200)=**0** |
| export | 350 | 10 | 0 |
| import | 0 | 60 | 200 |

- self-consumption = **240**, export = **360**, import = **260**
- **bill_before** = price A1(500) = 300×50 + 200×100 = 35,000 fils = **35.000 JD**
  → +add-ons (rural 0.500 + TV 1.000 + meter 0.200 = 1.700) = **36.700 JD**
- **import_cost** = price A1(260) = 260×50 = 13,000 fils = **13.000 JD**
- **export_revenue** = 360 × 0.050 = **18.000 JD**
- raw = 13.000 − 18.000 = **−5.000 JD** → surplus: credit += 5.000, bill = 0
- **bill_after** = max(0 + add-ons(rural 0.260 + TV 1.000 + meter 0.200 = 1.460), 1.75) = **1.750 JD**

### Year-end & annual
- credit accumulates 5.000 × 12 = **60.000 JD**, never used → **forfeited** (adds to cost)
- grid fee = 2.339 kWac × 1.000 × 12 = **28.07 JD**

**Expected output:**

| Field | Value |
|---|---|
| pv_size (X2) | 500 kWh/mo |
| inverter_size | 2.34 kWac |
| cost_before | 36.700 × 12 = **440.40 JD** |
| cost_after | (1.750×12) + 60.00 forfeited + 28.07 grid = **109.07 JD** |
| **annual_savings** | **331.33 JD** |
| net_billing_savings | 0 (credits never drawn down) |
| final_credit_balance | 0 (forfeited) |

> 🔎 **Accuracy insight:** with *flat* consumption the surplus is banked every
> month, never used, then forfeited at year-end — so export revenue is
> effectively lost. Use *seasonal* consumption (low summer / high winter) to see
> credits actually drawn down (`net_billing_savings > 0`).

---

## 2. RESIDENTIAL · Buy-All / Sell-All (M4)  → CLIENT path

Computed in `CalculatorLogic.calculateBuyAllSellAll` — **does not call the
server**. No bucket split, no credit ledger, no cap fraction.

- `generation = annual/12 = 500 kWh/mo` (note: **no** capFraction here)
- import priced by the **client** tariff engine preset `residential:tiered`
  (0.05/0.10/0.20 JD — numerically equals A1)
- export revenue = generation × exportRate (0.050 residential)

### One month
- import_tariff = 300×0.05 + 200×0.10 = **35.000 JD**
- add-ons (rural 0.500 + TV 1.000 + meter 0.200) = 1.700
- **bill_before** = max(35.000 + 1.700, 1.75) = **36.700 JD**
- export_revenue = 500 × 0.050 = **25.000 JD**
- **net_cost** = 36.700 − 25.000 = **11.700 JD**

**Expected output:**

| Field | Value |
|---|---|
| pv_size | 500 kWh/mo · inverter 2.22 kWac |
| cost_before | **440.40 JD** |
| cost_after | 11.700 × 12 = **140.40 JD** |
| **annual_savings** | **300.00 JD** |

> M4 has **no grid-service fee** and **no year-end forfeiture**, so its savings
> here (300) exceed M2 (331 minus the forfeiture/grid drag → net lower benefit
> per JD exported). Compare the two to sanity-check the mechanism logic.

---

## 3. INDUSTRIAL · Net Billing (M2)  → sector C2 medium, 3-period TOU

**Tariff C2 (TOU):** peak 79 · partial 69 · off-peak 59 fils.
**Export rate:** 0.040 JD/kWh. **capFraction = 0.50** (non-residential M2).
PF penalty *applies* to C2, but pf=0.90 ≥ 0.88 → 0. Default meter phase = 1.

### Sizing
- `X2 = 6000/12 × 0.50 = 250 kWh/mo`
- `inverter_kWac = (250/150 / 1.2) / 0.95 = 1.462 kWac` (no residential cap)

### 4-bucket → 3-period TOU mapping (standard)
`offPeak = y1` · `partial = y2 + y4` · `peak = y3`

### One month (factors 0.40/0.20/0.30/0.10; sun 0.70/0.25/0.05/0.00; self 0.80/0.85/0.90/0.70)

| bucket | 1 off(05-14) | 2 (14-17) | 3 peak(17-23) | 4 (23-05) |
|---|---|---|---|---|
| y demand | 200 | 100 | 150 | 50 |
| z PV (×250) | 175 | 62.5 | 12.5 | 0 |
| k self-cons | min(140,200)=140 | min(53.125,100)=53.125 | min(11.25,150)=11.25 | 0 |
| export | 35 | 9.375 | 1.25 | 0 |
| import | 60 | 46.875 | 138.75 | 50 |

- self-consumption = **204.375**, export = **45.625**, import = **295.625**
- **bill_before**: TOU{peak 150, partial 150, offPeak 200} =
  150×79 + 150×69 + 200×59 = 34,000 fils = **34.000 JD**
  → + add-ons (rural 0.500 + meter 0.200; **no TV**) = **34.700 JD**
- **import_cost**: TOU{peak 138.75, partial 96.875, offPeak 60} =
  138.75×79 + 96.875×69 + 60×59 = 21,185.6 fils = **21.186 JD**
- **export_revenue** = 45.625 × 0.040 = **1.825 JD**
- raw = 21.186 − 1.825 = **19.361 JD** (positive, no credit)
- **bill_after** = 19.361 + add-ons(rural 0.296 + meter 0.200 = 0.496) = **19.857 JD**

### Annual
- grid fee for C2 medium industrial = **0 (exempt)**; no credit forfeiture.

**Expected output:**

| Field | Value |
|---|---|
| pv_size | 250 kWh/mo · inverter 1.46 kWac |
| cost_before | 34.700 × 12 = **416.40 JD** |
| cost_after | 19.857 × 12 = **238.28 JD** |
| **annual_savings** | **178.12 JD** |

---

## 4. INDUSTRIAL · Buy-All / Sell-All (M4)  → CLIENT path

`CalculatorLogic.calculateIndustrialBuyAllSellAll`. Period factors must sum to
1.0 (validated). Default config = **Small Industrial**, export 0.050,
meter phase hardcoded to **3** (→ meter rent 0.500). No TV fee.

- `generation = annual/12 = 500` (no cap fraction)
- Small industrial import: ≤10,000 kWh → flat **0.060 JD/kWh**
  (medium uses per-period 0.059/0.069/0.079; >10,000 small → 0.068 on excess)

### One month (Small Industrial)
- import_tariff = 500 × 0.060 = **30.000 JD**
- add-ons = rural 0.500 + meter 0.500 = 1.000
- **bill_before** = max(30.000 + 1.000, 2.0) = **31.000 JD**
- export_revenue = 500 × 0.050 = **25.000 JD**
- **net_cost** = 31.000 − 25.000 = **6.000 JD**

**Expected output:**

| Field | Value |
|---|---|
| pv_size | 500 kWh/mo · inverter 2.78 kWac |
| cost_before | **372.00 JD** |
| cost_after | 6.000 × 12 = **72.00 JD** |
| **annual_savings** | **300.00 JD** |

> Switch config to **Medium Industrial** to exercise the per-period rates:
> y1=125@0.059, y2=62.5@0.069, y3=125@0.079, y4=187.5@0.069 (factors
> 0.250/0.125/0.250/0.375) → import = 7.375+4.3125+9.875+12.9375 = **34.50 JD**.

---

## 5. Other mechanisms — deltas vs. the worked examples

These reuse the §0 server pipeline; only the marked steps change.

### M1 · Wheeling (`gridConnection = "wheeling"`)
- Residential **excluded**; non-residential capFraction = **0.50**.
- Uses **different TOU windows**: `offPeak = y1 + y2`, `partial = y4`,
  `peak = y3` (the 14–17 hours move into off-peak).
- Grid fee per sector (hotels ≈2.5, commercial ≈13 JD/kWac/mo).

### M3 · Zero Export (`gridConnection = "Zero export"`)
- capFraction = **1.00**; **export_revenue forced to 0** (surplus uncompensated).
- Everything else identical; grid fee uses the M2 schedule as upper-bound default.
- Effect: savings come **only** from self-consumption avoided-import.

### M5 · Legacy Net Metering (`gridConnection = "Legacy net metering"`)
- capFraction = **1.00**; grid fee = **0** (exempt).
- In the main `/api/calculate` loop, **export_revenue is forced to 0** (legacy
  settles in kWh, not JD).
- ⚠️ The kWh-netting helper `legacyNetMeteringMonthly` (0.80 export haircut,
  carry-forward) exists in `jordanTariffs.ts` but is **not wired into**
  `/api/calculate` — so M5 in the live calc behaves like "self-consume only,
  exports earn nothing, no grid fee." Flag this when testing M5 accuracy.

---

## 6. Financial metrics (`/api/calculate-npv`, separate endpoint)

Independent of the billing engine; takes its own inputs (defaults shown):

```
annual_savings = 1000, system_cost = 5000, discount_rate = 0.05, project_life = 25
NPV = −system_cost + Σ_{y=1..25} [ annual_savings × (1−0.005)^y / (1+0.05)^y ]
IRR ≈ min( annual_savings/system_cost × 100 , 50 )
payback = system_cost / annual_savings
LCOE = system_cost / (annual_generation × project_life)   # annual_generation hardcoded 1000
```

> Note: degradation here is `(1−0.005)^y` (starts at y=1), LCOE uses a
> placeholder `annual_generation = 1000` — not your real generation. Treat NPV
> as a first-pass benchmark, not a tied-out figure.

---

## 7. Quick verification checklist

| # | Test | Expected |
|---|---|---|
| 1 | Residential M2, 500 flat | savings **331.33**, before 440.40, after 109.07 |
| 2 | Residential M4 | savings **300.00**, after 140.40 |
| 3 | Industrial M2 (C2) | savings **178.12**, before 416.40, after 238.28 |
| 4 | Industrial M4 (Small) | savings **300.00**, after 72.00 |
| 5 | A1 cash subsidy | **not** applied (table-only) |
| 6 | M2 flat consumption | credits forfeited at year-end → net_billing_savings 0 |
| 7 | M5 export | earns 0 JD in live calc (kWh-netting not wired in) |

If any of these diverge in the app, the discrepancy is the bug to chase. All
numbers above are hand-derived from `server/routes.ts` +
`shared/jordanTariffs.ts` at the current commit; re-derive after any rate change.
