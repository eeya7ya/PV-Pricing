# PV-Pricing — Calculation Principles and Equations

This document explains the methodology, principles, and equations used by the
PV-Pricing calculator to size a photovoltaic (PV) system, estimate energy
flows between the array and the grid, compute electricity bills under the
applicable tariff structure, and evaluate the financial performance of the
investment.

The core calculation pipeline lives in:

- `server/routes.ts` — backend `/api/calculate` endpoint (canonical math)
- `client/src/components/CalculatorLogic.tsx` — frontend mirror used for
  live UI updates
- `client/src/lib/tariffEngine.ts` — tariff resolution (tiered / flat / TOU)
- `shared/schema.ts` — input schemas, defaults, and constants

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
3. **Billing & finance.** Price the *before* and *after* energy flows using
   the applicable tariff (tiered, flat, or TOU), apply a net-billing credit
   ledger month-to-month, and finally compute investment metrics (savings,
   payback, NPV, LCOE).

### Key assumptions

| Quantity                          | Default value         | Source                          |
| --------------------------------- | --------------------- | ------------------------------- |
| System (DC→AC) efficiency         | 95 %                  | `routes.ts:80`, `schema.ts:81`  |
| Specific yield (sizing constant)  | 130 kWh / kW / month  | `routes.ts:205`                 |
| Annual module degradation         | 0.5 % / year          | `routes.ts:495`                 |
| Discount rate (NPV)               | 5 % / year            | `routes.ts:486`                 |
| Project lifetime                  | 25 years              | `routes.ts:487`                 |
| Residential export tariff (default) | 0.04 JD/kWh         | `routes.ts:82`                  |

All energies are in **kWh**, powers in **kW**, and currency in **JD** unless
noted otherwise. Industrial tariffs are stored in **fils/kWh** (¢-style
hundredths of a JD) and divided by 100 when applied to energy.

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
zero. (`routes.ts:199–202`)

### 2.2 Inverter sizing

The inverter nameplate rating (kW) is estimated from the target monthly
yield using a specific-yield constant of 130 kWh / kW / month, derated by
the 95 % system efficiency:

$$
P_{\text{inv}} \;=\; \frac{X_2}{130 \times 0.95}\, .
$$

(`routes.ts:205`) The 130 kWh/kW/month figure is an empirical specific yield
representative of the project's solar resource (Jordan-class irradiance).

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
production that is consumed on-site in that bucket. (`routes.ts:346–363`)

### 3.2 Industrial — four buckets (TOU)

Industrial customers use a four-period schedule aligned with the utility
tariff:

| Index | Period           | Window  |
| ----- | ---------------- | ------- |
| 1     | Off-peak         | 05–14   |
| 2     | Half-peak (day)  | 14–17   |
| 3     | Peak             | 17–23   |
| 4     | Half-peak (night)| 23–05   |

The same allocation equations apply with `i ∈ {1,2,3,4}`. (`routes.ts:229–249`)

### 3.3 Export and import per bucket

After self-consumption, the residual generation is exported and the residual
demand is imported:

$$
E^{\text{exp}}_i \;=\; \max(0,\; z_i - k_i)
$$

$$
E^{\text{imp}}_i \;=\; \max(0,\; y_i - k_i)
$$

(`routes.ts:255–266`, `routes.ts:369–373`)

Aggregated monthly totals:

$$
E^{\text{exp}}_m \;=\; \sum_i E^{\text{exp}}_i, \qquad
E^{\text{imp}}_m \;=\; \sum_i E^{\text{imp}}_i, \qquad
SC_m \;=\; \sum_i k_i .
$$

---

## 4. Tariffs and Billing

### 4.1 Residential tiered (subsidised) tariff

For monthly import energy `E` (kWh):

$$
T(E) \;=\;
\begin{cases}
0.05 \cdot E & E \le 300 \\[4pt]
0.05 \cdot 300 + 0.10 \cdot (E - 300) & 300 < E \le 600 \\[4pt]
0.05 \cdot 300 + 0.10 \cdot 300 + 0.20 \cdot (E - 600) & E > 600
\end{cases}
$$

(`routes.ts:158–166`)

### 4.2 Residential flat (non-supported) tariff

$$
T(E) \;=\;
\begin{cases}
0.12 \cdot E & E \le 1000 \\[4pt]
0.12 \cdot 1000 + 0.15 \cdot (E - 1000) & E > 1000
\end{cases}
$$

(`routes.ts:168–171`)

### 4.3 Industrial four-period TOU

Industrial rates are stored in fils/kWh; the monthly import cost is

$$
T_{\text{ind}}(\{y_i\}) \;=\; \sum_{i=1}^{4} y_i \cdot \frac{r^{\text{imp}}_i}{100}
$$

where `r^imp_i` is the period-*i* import rate (fils/kWh). (`routes.ts:177–190`)

Default import rates (fils/kWh): `[5.9, 6.9, 7.9, 6.9]`; default export
rate: `4.0`. (`schema.ts:342–387`)

### 4.4 Export revenue

For Residential:

$$
R^{\text{exp}}_m \;=\; E^{\text{exp}}_m \cdot t_{\text{exp}}
$$

For Industrial:

$$
R^{\text{exp}}_m \;=\; \sum_{i=1}^{4} E^{\text{exp}}_i \cdot \frac{r^{\text{exp}}_i}{100} .
$$

### 4.5 Net-billing credit ledger

The "raw" monthly bill is `B_m^{raw} = T(E^{imp}_m) − R^{exp}_m`. A running
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

(`routes.ts:287–312`)

The customer is never billed below zero in a given month; surpluses persist
as credits available against subsequent months.

---

## 5. Financial Metrics

Let `S_m` be the *bill savings* in month *m* (i.e. the difference between
the pre-PV and post-PV bills, plus export revenue and net-billing credit
applied). Annual savings:

$$
S_{\text{annual}} \;=\; \sum_{m=1}^{12} S_m .
$$

### 5.1 Module degradation

Energy yield (and therefore savings) in year *y* is derated by

$$
\delta_y \;=\; (1 - 0.005)^{y-1}, \qquad y = 1, \dots, 25 .
$$

(`routes.ts:495`)

### 5.2 Net present value

With a discount rate `d = 5 %` and capital cost `C_0`:

$$
\mathrm{NPV} \;=\; -C_0 \;+\; \sum_{y=1}^{N} \frac{S_{\text{annual}} \cdot \delta_y}{(1+d)^{y}}
$$

where `N = 25`. (`routes.ts:486–500`)

### 5.3 Payback period

$$
T_{\text{payback}} \;=\; \frac{C_0}{S_{\text{annual}}} \quad \text{(years)} .
$$

(`routes.ts:508`)

### 5.4 Levelised cost of energy

$$
\mathrm{LCOE} \;=\; \frac{C_0}{E_{\text{annual}} \cdot N}
$$

with `E_annual = 12 · X2` and `N = 25 years`. (`routes.ts:512`) This is the
simple (un-discounted) LCOE; it ignores degradation and O&M for a first-pass
benchmark.

---

## 6. Inputs and Outputs

### Inputs
- 12 monthly consumption values (kWh)
- Customer type (Residential / Industrial) and tariff scheme flag
- Monthly time-of-use factors for consumption (`f^cons`)
- Monthly factors for solar generation by bucket (`f^gen`)
- Monthly PV self-consumption factors (`ρ`)
- Export tariff (Residential) or 4-period industrial tariff table
- System efficiency (default 95 %)

### Outputs
- Monthly and annual: PV generation, self-consumption, export, import
- Monthly and annual bills *before* and *after* PV
- Net-billing credit balance per month
- Inverter size (kW)
- Annual savings, NPV, simple payback, LCOE

---

## 7. Unit Conventions and Caveats

- **Currency:** Residential rates are in JD/kWh; industrial rates in
  fils/kWh and are divided by 100 in cost equations.
- **Specific yield (130 kWh/kW/month):** an assumption tuned to the local
  solar resource; changes to climate or tilt should revisit this constant.
- **Degradation curve:** geometric decay at 0.5 %/year; no end-of-life cliff.
- **No inflation / escalation:** tariffs are held flat across the 25-year
  horizon. The discount rate alone discounts future savings.
- **The factor `½` on Industrial sizing** is a project convention, not a
  physical limit; remove it to size to full net-zero.
