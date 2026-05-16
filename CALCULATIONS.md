# PV-Pricing — Calculation Principles and Equations

This document explains the methodology, principles, and equations used by the
PV-Pricing calculator to size a photovoltaic (PV) system, estimate energy
flows between the array and the grid, compute electricity bills under the
Jordan EMRC 2025 tariff, and evaluate the financial performance of the
investment.

The core calculation pipeline lives in:

- `shared/jordanTariffs.ts` — canonical EMRC 2025 tariff reference and
  pricing helpers (sector rates, TOU windows, universal add-ons, PF
  penalty, Bylaw 58/2024 net-billing economics).
- `server/routes.ts` — backend `/api/calculate` endpoint (canonical math).
- `client/src/lib/tariffEngine.ts` — tariff resolution (tiered / flat / TOU)
  used by the live frontend Buy-All-Sell-All path.
- `client/src/components/CalculatorLogic.tsx` — frontend mirror used for
  live UI updates and the Buy-All-Sell-All mechanism.
- `shared/schema.ts` — input schemas, defaults, and shared types.

Authoritative tariff sources:

- EMRC Tariff Guide 2025 (effective 1 Jan 2025; Arabic prevails)
- NEPCO bilingual schedule
- Bylaw No. 58 of 2024 (Official Gazette 19 August 2024) — net-billing
  economics

---

## 1. Principles

The calculator follows a deterministic, monthly energy-balance model with
three high-level stages:

1. **Sizing.** From the customer's annual consumption, derive a target
   monthly PV generation `X2` and an approximate inverter rating.
2. **Energy allocation.** For each month, split the *consumption* and the
   *PV generation* into time-of-use buckets (3 buckets for Residential, 4
   buckets for Industrial), then compute self-consumption, grid export, and
   grid import per bucket.
3. **Billing & finance.** Price the *before* and *after* energy flows
   using the resolved sector tariff (tiered / flat / 3-period TOU),
   apply Bylaw 58/2024 net-billing credit ledger month-to-month, add
   universal regulated add-ons (rural fils, fuel clause, TV fee, meter
   rent, GAM municipal fee, waste fee), enforce the minimum bill, apply
   the power-factor surcharge where applicable, deduct net-billing
   credits, then layer the annual grid-service fee.

### Key assumptions

| Quantity                          | Default value            | Source                          |
| --------------------------------- | ------------------------ | ------------------------------- |
| System (DC→AC) efficiency         | 95 %                     | `routes.ts`, `schema.ts`        |
| Specific yield (sizing constant)  | 130 kWh / kW / month     | `routes.ts` (PV round upgrades to 1,800 kWh/kWp/yr ≈ 150 kWh/kWp/mo) |
| Annual module degradation         | 0.5 % / year             | `routes.ts`                     |
| Discount rate (NPV)               | 5 % / year               | `routes.ts`                     |
| Project lifetime                  | 25 years                 | `routes.ts`                     |
| Residential NB export tariff      | 0.050 JD/kWh             | Bylaw 58/2024; EMRC chair Sa'aydeh 4/9/2024 |
| Non-residential NB export tariff  | 0.040 JD/kWh             | EcoMENA / Buy-All baseline      |
| Residential grid-service fee      | 1.000 JD/kWac/month (new) | Bylaw 58/2024 §V (post-1/6/2024); 2.000 legacy |
| PF penalty threshold              | 0.88                     | NEPCO §I.1.d                    |
| Min bill (residential)            | 1.750 JD/month           | NEPCO                           |
| Min bill (non-residential)        | 2.000 JD/month           | EMRC §VII                       |
| Rural fils                        | 1 fils/kWh universal     | NEPCO §V, EMRC §VI              |
| TV fee                            | 1.000 JD/month (residential default) | 1979 TV Fees Regulation         |
| Meter rent                        | 0.200 (1-ph) / 0.500 (3-ph) JD/mo | Widely cited; primary 2024–26 doc not retrieved |
| GAM municipal fee                 | 1.667 JD if ≤200 kWh; +0.005 × (kWh−200) above | factjo.com (unchanged since 2006) |
| Fuel clause                       | 0 fils/kWh Jan–May 2026  | EMRC monthly bulletins          |
| Subsidy-loss inverter trigger     | 3.6 kWac single-phase / 10 kW three-phase | EMRC tariff PDF §6.‫ج‬          |

All energies are in **kWh**, powers in **kW**, and currency in **JD** unless
noted otherwise. Sector tariff rates are stored in **fils/kWh** (1 JD = 1000
fils) and divided by 1000 by the pricing helpers.

---

## 2. System Sizing

### 2.1 Target monthly PV generation

Let `C_m` be the consumption for month *m* (kWh) and let

$$
C_{\text{annual}} \;=\; \sum_{m=1}^{12} C_m .
$$

The target monthly PV generation `X2` is

$$
X_2 \;=\; \frac{C_{\text{annual}}}{12} \quad \text{(Residential)}
$$

$$
X_2 \;=\; \frac{1}{2} \cdot \frac{C_{\text{annual}}}{12} \quad \text{(Industrial)}
$$

The factor of ½ for Industrial customers reflects that industrial sites are
typically only partially offset by rooftop PV rather than sized to net
zero. (Project convention — to be revisited in the PV round alongside the
3.6 / 10 kWac cap rules in Bylaw 58/2024.)

### 2.2 Inverter sizing

The inverter nameplate rating (kWac) is estimated from the target monthly
yield using a specific-yield constant of 130 kWh / kW / month, derated by
the 95 % system efficiency:

$$
P_{\text{inv}} \;=\; \frac{X_2}{130 \times 0.95}\, .
$$

The PV round will replace this with the EcoMENA-recommended 1,800 kWh/kWp/year
≈ 150 kWh/kWp/month, plus DC:AC ratios (1.5 residential, 1.2 commercial)
and the Bylaw 58/2024 size caps (3.6 kWac 1-ph / 10 kWac 3-ph residential).

---

## 3. Energy Allocation (per month)

For every month *m*, the consumption `x1 = C_m` and the PV generation
`x2 = X2` are split into time-of-use buckets using user-editable monthly
fractions (the "factors").

### 3.1 Residential — three buckets (Day / Evening / Night)

Consumption split:

$$
y_i \;=\; x_1 \cdot f^{\text{cons}}_{i,m}, \qquad i \in \{\text{day, evening, night}\}
$$

Generation split:

$$
z_i \;=\; x_2 \cdot f^{\text{gen}}_{i,m}, \qquad i \in \{\text{peak sun, medium sun, low sun}\}
$$

Self-consumption in each bucket (capped at available consumption):

$$
k_i \;=\; \min\!\left(z_i \cdot \rho_{i,m},\; y_i\right)
$$

where `ρ` are the *PV-consume* factors representing the share of PV
production that is consumed on-site in that bucket.

### 3.2 Industrial — four buckets mapped onto EMRC 3-period TOU

Industrial input factors keep the project's four monthly fractions:

| Index | Period           | Window  |
| ----- | ---------------- | ------- |
| 1     | Off-peak         | 05–14   |
| 2     | Partial (day)    | 14–17   |
| 3     | Peak             | 17–23   |
| 4     | Partial (night)  | 23–05   |

EMRC's 2025 Guide defines a 3-period TOU. The calculator therefore maps the
four input buckets onto the EMRC three buckets for *pricing*:

$$
\text{off-peak} \to y_1, \qquad
\text{partial}  \to y_2 + y_4, \qquad
\text{peak}     \to y_3 .
$$

Self-consumption, export, and import are still computed per the four input
buckets; only the price-lookup step uses the 3-period mapping.

### 3.3 Export and import per bucket

After self-consumption, the residual generation is exported and the
residual demand is imported:

$$
E^{\text{exp}}_i \;=\; \max(0,\; z_i - k_i), \qquad
E^{\text{imp}}_i \;=\; \max(0,\; y_i - k_i) .
$$

Aggregated monthly totals:

$$
E^{\text{exp}}_m \;=\; \sum_i E^{\text{exp}}_i, \qquad
E^{\text{imp}}_m \;=\; \sum_i E^{\text{imp}}_i, \qquad
SC_m \;=\; \sum_i k_i .
$$

---

## 4. Tariffs and Billing

All per-kWh sector rates are sourced from `shared/jordanTariffs.ts` — see
that file for the full sector table. The calculator routes every monthly
import through the same pricing dispatcher:

```
priceImportJD({ sector, monthlyKWh, kwhByPeriod?, isTemporary? })
```

which selects the correct pricing model for the sector (`tiered`, `tou3`,
`flat`, or `mixed_well`).

### 4.1 Residential — Subsidized (A1) tiered

| Block          | Rate (fils/kWh) | Rate (JD/kWh) |
| -------------- | --------------- | ------------- |
| 1 – 300 kWh    | 50              | 0.050         |
| 301 – 600 kWh  | 100             | 0.100         |
| 601+ kWh       | 200             | 0.200         |

Cash subsidies (applied as bill credit; negative JD):

- 51 – 200 kWh: −2.500 JD
- 201 – 600 kWh: −2.000 JD

Minimum bill: 1.750 JD/month.

### 4.2 Residential — Unsubsidized (A2) tiered

| Block        | Rate (fils/kWh) | Rate (JD/kWh) |
| ------------ | --------------- | ------------- |
| 1 – 1000 kWh | 120             | 0.120         |
| 1001+ kWh    | 150             | 0.150         |

Minimum bill: 1.750 JD/month.

### 4.3 Industrial — 3-period TOU (C2 Medium default)

| Period   | Window        | Rate (fils/kWh) |
| -------- | ------------- | --------------- |
| Off-peak | 05–14 (9h)    | 59              |
| Partial  | 14–17 + 23–05 (9h) | 69         |
| Peak     | 17–23 (6h)    | 79              |

C1 Small ≤200 kW is *tiered* (60 fils ≤10000 kWh, 68 fils above) with no
TOU and no demand charge. C3 Large is 130/120/110, C4 Extractive 226/216/206.
All sectors carry a published temporary subscription rate; pass
`is_temporary: true` to use it.

**Audit fix (vs. previous spec):** C2 Medium Partial corrected from
0.068 → 0.069 JD/kWh (Jordan Times / Jordan Industrial Estates Co. 2025).

### 4.4 Other sectors (selected)

| Code | Sector                                  | Pricing                                    |
| ---- | --------------------------------------- | ------------------------------------------ |
| B1   | Commercial                              | tiered 120 / 152 fils, temp 185           |
| B3   | Banks (Phase-2 mandatory TOU)          | 298 / 287 / 278, temp 285 (editable defaults) |
| B4   | Telecom                                 | TOU 152 / 142 / 132                       |
| D1   | Hotel 4★+ post-2008                     | TOU 94 / 82 / 73                           |
| D2   | Hotel 4★+ pre-2008                      | flat 82 *or* TOU 94/82/73 (choice)         |
| E1   | Private hospital (Phase-2 TOU)         | TOU ≈151/140/130 (editable; peak per Al-Ghad) |
| E2   | Government hospital                     | Standard 7-tier (G1)                       |
| F1   | Agriculture standard ≤100 kVA          | flat 55                                    |
| F2   | Agriculture legacy day/night            | Day 55 / Night 49                          |
| F3   | Mixed-use well                          | 2/3 × 120 + 1/3 × 55 = 98.33 fils         |
| G1   | Standard 7-tier                         | 42/92/109/145/169/190/256 + temp 266      |
| G2   | Water pumping (Phase-2 TOU)            | 106 / 95 / 86 — flat option REMOVED       |
| G3   | Street lighting                         | flat 114                                   |
| G4   | Government / Armed Forces (Phase-2 TOU) | 158 / 147 / 138 — flat option REMOVED     |
| G5   | EV home charging                        | TOU 160 / 118 / 108                       |
| G6   | EV public wholesale                     | TOU 133 / 113 / 103 (+ operator commission ~3.5 slow / ~5 fast fils) |
| G7   | Broadcasting                            | flat 152                                   |
| G8   | Ports                                   | flat 159                                   |

### 4.5 Export revenue (Bylaw 58/2024)

For Net-Billing Mechanism 2 (and Mechanism 4 Buy-All/Sell-All) the export
rate is sector-dependent:

$$
t_{\text{exp}} = \begin{cases}
0.050 \;\text{JD/kWh} & \text{residential} \\
0.040 \;\text{JD/kWh} & \text{non-residential (default)}
\end{cases}
$$

Monthly export revenue:

$$
R^{\text{exp}}_m \;=\; E^{\text{exp}}_m \cdot t_{\text{exp}} .
$$

### 4.6 Net-billing credit ledger

The raw monthly bill is `B_m^{raw} = T(E^{imp}_m) − R^{exp}_m`. A running
credit balance `S` (initially 0) accumulates surpluses and is drawn down by
future deficits:

```
if  B_m^raw < 0:                    # surplus
    S      ← S + |B_m^raw|
    B_m    ← 0
else:                               # deficit
    used   ← min(S, B_m^raw)
    S      ← S − used
    B_m    ← B_m^raw − used
```

The customer is never billed below zero in a given month; surpluses persist
as credits available against subsequent months. (The PV round will add the
annual balance reset — credits do not roll over indefinitely; see Alrbai et
al., 2025.)

### 4.7 Universal regulated add-ons (every bill)

After the energy charge is computed, the following add-ons are layered on
the bill (`calcUniversalAddOns` in `shared/jordanTariffs.ts`):

| Add-on        | Amount                                                                          |
| ------------- | ------------------------------------------------------------------------------- |
| Rural fils    | 1 fils/kWh × monthly import kWh                                                |
| Fuel clause   | `FUEL_CLAUSE_FILS_BY_MONTH[YYYY-MM]` × monthly import kWh (0 fils Jan–May 2026) |
| TV fee        | 1.000 JD/month if residential and `apply_tv_fee` (default true)                 |
| Meter rent    | 0.200 JD (1-ph) / 0.500 JD (3-ph) per month                                     |
| GAM fee       | 1.667 JD if ≤200 kWh, else 1.667 + 0.005 × (kWh − 200) — opt in                |
| Waste fee     | Class A 3.000 / B 2.000 / C 1.667 JD/month — opt in                            |

VAT is exempt on electricity (no VAT line). REEEF is funded from sector
levies, not the consumer bill.

### 4.8 Minimum bill

After add-ons, the minimum-bill floor is enforced:

- Residential A1/A2: 1.750 JD/month
- All non-residential: 2.000 JD/month
- Private hospitals temp: 170 fils baseline (not min-bill; subscription rate)

`applyMinimumBillJD(rawBillJD, sector)` returns `max(rawBillJD, floor)`.

### 4.9 Power-factor penalty (NEPCO §I.1.d)

Applies to **industrial C2/C3/C4**, **3-part agriculture F2**, and
**3-part 4★+ hotels D1/D2**. Threshold pf = 0.88.

$$
\text{steps} \;=\; \mathrm{round}\!\left(\frac{0.88 - \mathrm{pf}}{0.01}\right)
$$

| pf range            | % per step |
| ------------------- | ---------- |
| 0.88 > pf ≥ 0.70    | 0.77 %     |
| 0.70 > pf ≥ 0.60    | 0.95 %     |
| 0.60 > pf ≥ 0.50    | 1.20 %     |
| pf < 0.50           | 1.50 %     |

$$
\text{PF surcharge} \;=\; \text{billJD} \times \frac{\text{pct per step} \times \text{steps}}{100} .
$$

Default `power_factor = 0.90` → no penalty. Pass a lower value to apply.

### 4.10 Grid-service fee (Bylaw 58/2024 §V)

Charged per inverter kWac per month for net-billing prosumers:

| Sector / mechanism                                       | JD/kWac/month |
| --------------------------------------------------------- | ------------- |
| Residential, application ≥ 1/6/2024 (new)                 | 1.000         |
| Residential, application < 1/6/2024 (legacy grandfathered) | 2.000         |
| Small/medium industrial (any mechanism)                   | 0 (exempt)    |
| Agriculture (any mechanism)                               | 0 (exempt)    |
| NAF / Takaful 1&3 / Royal Initiative beneficiaries        | 0 (exempt)    |
| Hotels (any mechanism, ~M1 off-site)                     | ~2.5          |
| Commercial / banks / large industrial / extractive / normal tariff | ~13   |
| Mechanism 4 — Buy-All / Sell-All (any sector)            | 0 (exempt)    |

Annual contribution to the post-PV bill:

$$
F_{\text{grid}} = P_{\text{inv}} \cdot r_{\text{sector}} \cdot 12 .
$$

### 4.11 Four prosumer mechanisms (Bylaw 58/2024)

| Mechanism | Mode                         | Eligibility                       | Cap | Grid fee |
| --------- | ---------------------------- | --------------------------------- | --- | -------- |
| M1        | Net Value Off-site (wheeling) | Small/med industrial, hotels, agri | 50 % of last year | per sector |
| M2        | Net Value On-site (Net Billing) | All sectors incl. residential   | 100 % of last year | per sector |
| M3        | Zero Export                   | All except banks / normal / extractive (battery allowed) | n/a | per sector |
| M4        | Buy-All / Sell-All            | All sectors; separate meter        | n/a | 0 (exempt) |

The project's `gridConnection` enum maps onto these mechanisms in
`CalculatorLogic.tsx::mechanismFor`.

### 4.12 Subsidy-loss trigger (residential prosumers)

Subsidy (A1) is lost for new installations exceeding:

- Single-phase inverter > **3.6 kWac** (~16 A × 230 V in legacy text)
- Three-phase parallel > **10 kWac**

See `losesResidentialSubsidy()` in `shared/jordanTariffs.ts`.

---

## 5. Financial Metrics

Let `S_m` be the *bill savings* in month *m* (i.e. the difference between
the pre-PV and post-PV bills, plus export revenue and net-billing credit
applied). Annual savings:

$$
S_{\text{annual}} \;=\; \sum_{m=1}^{12} S_m \;-\; F_{\text{grid}} .
$$

### 5.1 Module degradation

Energy yield (and therefore savings) in year *y* is derated by

$$
\delta_y \;=\; (1 - 0.005)^{y-1}, \qquad y = 1, \dots, 25 .
$$

### 5.2 Net present value

With a discount rate `d = 5 %` and capital cost `C_0`:

$$
\mathrm{NPV} \;=\; -C_0 \;+\; \sum_{y=1}^{N} \frac{S_{\text{annual}} \cdot \delta_y}{(1+d)^{y}}
$$

where `N = 25`.

### 5.3 Payback period

$$
T_{\text{payback}} \;=\; \frac{C_0}{S_{\text{annual}}} \quad \text{(years)} .
$$

### 5.4 Levelised cost of energy

$$
\mathrm{LCOE} \;=\; \frac{C_0}{E_{\text{annual}} \cdot N}
$$

with `E_annual = 12 · X2` and `N = 25 years`. This is the simple
(un-discounted) LCOE; it ignores degradation and O&M for a first-pass
benchmark.

---

## 6. Inputs and Outputs

### Inputs

- 12 monthly consumption values (kWh)
- Customer type (Residential / Industrial / Commercial / Hotels / Hospitals / Agriculture)
  and grid-connection (mechanism) selection
- Sector override (`sector`, optional — defaults derived from customer type)
- Power factor (optional, default 0.90)
- Universal add-on toggles + waste class + meter phase + GAM flag
- Monthly time-of-use factors for consumption (`f^cons`)
- Monthly factors for solar generation by bucket (`f^gen`)
- Monthly PV self-consumption factors (`ρ`)
- Export tariff override (else: 0.050 residential / 0.040 non-residential)
- System efficiency (default 95 %)
- Inverter kWac override + post-bylaw-application flag + welfare-beneficiary flag

### Outputs

- Monthly: PV generation, self-consumption, export, import, bill before/after,
  credit used/generated, running credit balance, import cost
- Annual summary: consumption, PV size, inverter size, generation, self-
  consumption, export, cost before/after, savings, export revenue, efficiency,
  effective export tariff, net-billing savings, final credit balance, monthly
  and annual grid-service fee, resolved sector + label + mechanism

---

## 7. Unit Conventions and Caveats

- **Currency:** Sector rates are stored in fils/kWh and divided by 1000 by
  `priceImportJD` / `priceTOU3JD` / `priceTieredJD` / `priceFlatJD`.
- **Specific yield (130 kWh/kW/month):** an assumption tuned to a
  conservative Jordan-class solar resource. The PV round will switch to
  150 kWh/kWp/month (1,800 kWh/kWp/year per EcoMENA).
- **Degradation curve:** geometric decay at 0.5 %/year; no end-of-life cliff.
- **No inflation / escalation:** tariffs are held flat across the 25-year
  horizon. The discount rate alone discounts future savings.
- **The factor `½` on Industrial sizing** is a project convention, not a
  physical limit; remove it to size to full net-zero.
- **Fuel clause** is monthly and applies to ALL sectors. Confirmed values
  for 2026 (Jan–May) are 0 fils/kWh; populate
  `FUEL_CLAUSE_FILS_BY_MONTH` from EMRC's monthly bulletin for new months.
- **No seasonal TOU shift** exists; EMRC Council retains a discretionary
  hook under §XII.f that has never been invoked.
- **Phase 2 (1 Jan 2025)** made banks, private hospitals, water pumping,
  Government / Armed Forces, and 4★+ hotels into mandatory TOU. The
  former flat options (0.140 / 0.146 / 0.095) are obsolete.
- **B3 Bank**, **E1 Private Hospital partial/off-peak**, **D1 Hotel TOU**,
  and the **~13 JD/kWac commercial grid-fee** numbers are user-editable
  defaults — not confirmed in any retrieved primary source. Validate
  against an actual bill or direct EMRC enquiry before launch.
