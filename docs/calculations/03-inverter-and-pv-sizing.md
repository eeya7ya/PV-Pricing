# Calculation 3 — Inverter & PV Sizing (FULL MATH)

**Files:** constants/helpers in `shared/jordanTariffs.ts`; applied in
`server/routes.ts` (`/api/calculate`). Used when no explicit PV-Design override
is supplied.

---

## §1 Constants

```
SPECIFIC_YIELD_KWH_PER_KWP_YEAR  = 1800                      (jordanTariffs.ts:739)
SPECIFIC_YIELD_KWH_PER_KWP_MONTH = 1800 / 12 = 150           (:741)
DC_AC_RATIO = { residential: 1.5, nonResidential: 1.2 }      (:748)
RESIDENTIAL_INVERTER_CAP_KWAC = { singlePhase: 3.6, threePhase: 10 }   (:761)
SUBSIDY_LOSS_TRIGGER_KW = { singlePhaseInverter: 3.6, threePhaseParallel: 10 }   (:721)
```
Let $\Re(\text{class})=1.5$ if residential else $1.2$.

---

## §2 kWp ↔ kWac — `:767`, `:773`
$$
\boxed{P_{dc}=P_{ac}\cdot\Re(\text{class})}\qquad
\boxed{P_{ac}=\frac{P_{dc}}{\Re(\text{class})}}
$$
```ts
export function kWpFromKWac(kWac, sectorClass) {
  const ratio = sectorClass === 'residential' ? 1.5 : 1.2;
  return kWac * ratio;
}
export function kWacFromKWp(kWp, sectorClass) { return kWp / ratio; }
```

---

## §3 Target monthly generation (consumption-based fallback) — `routes.ts:412`
$$
C_{ann}=\sum_{m} C_m\quad(\text{annual consumption})
$$
$$
\boxed{\;G_{mo}=\frac{C_{ann}}{12}\cdot f_{cap}\;}
$$
where $f_{cap}=$`mechanismGenerationCapFraction(mech, class)`:

| Mechanism | $f_{cap}$ |
|-----------|:---------:|
| M1 wheeling | 0.50 |
| M2 net billing, residential | 1.00 |
| M2 net billing, non-residential | 0.50 |
| M3 zero export | 1.00 |
| M4 buy-all/sell-all | 1.00 |
| M5 legacy | 1.00 |

```ts
const capFraction = mechanismGenerationCapFraction(mech, sectorClass);
let monthly_pv_generation = (total_annual_consumption / 12) * capFraction;
```

---

## §4 Inverter sizing from monthly kWh

### 4.1 Pure helper — `inverterKWacFromMonthlyKWh(G, class)` `:785`
$$
P_{dc}=\frac{G}{150},\qquad \boxed{P_{ac}=\frac{P_{dc}}{\Re(\text{class})}=\frac{G}{150\,\Re}}
$$
```ts
export function inverterKWacFromMonthlyKWh(monthlyKWh, sectorClass) {
  const kWp = monthlyKWh / SPECIFIC_YIELD_KWH_PER_KWP_MONTH;
  return kWacFromKWp(kWp, sectorClass);
}
```

### 4.2 As applied in the engine (with efficiency) — `routes.ts:417`
$$
\boxed{\;P_{ac}^{est}=\frac{\text{inverterKWacFromMonthlyKWh}(G_{mo},\text{class})}{\eta}\;},\qquad \eta=\frac{\text{efficiency}}{100}
$$
```ts
const estimated_kwac = inverterKWacFromMonthlyKWh(monthly_pv_generation, sectorClass) / (efficiency / 100);
```

---

## §5 Residential inverter cap — `applyResidentialInverterCap(kWac, phase, class)` `:797`

Non-residential → pass-through (no cap). Residential:
$$
\text{cap}=\begin{cases}3.6 & \text{phase}=1\\ 10 & \text{phase}=3\end{cases}
$$
$$
P_{ac}=\min(P_{ac}^{in},\ \text{cap}),\qquad \text{capped}=P_{ac}^{in}>\text{cap}
$$
The engine feeds $P_{ac}^{in}=$ `inverter_kwac_input ?? estimated_kwac`:
```ts
const capped = applyResidentialInverterCap(inverter_kwac_input ?? estimated_kwac, connection_phase, sectorClass);
const inverter_kwac = capped.kWac;
const kwp_dc = kWpFromKWac(inverter_kwac, sectorClass);
```

### 5.1 Re-derive generation when the cap binds — `routes.ts:433`
$$
\text{if capped:}\quad
P_{dc}=P_{ac}\cdot\Re,\qquad
\boxed{G_{mo}=P_{dc}\cdot150\cdot\eta}
$$
```ts
if (capped.capped) {
  monthly_pv_generation = kwp_dc * SPECIFIC_YIELD_KWH_PER_KWP_MONTH * (efficiency / 100);
}
```

---

## §6 Residential subsidy-loss trigger — `losesResidentialSubsidy(kWac, phase)` `:726`
$$
\text{loses subsidy}\iff
\begin{cases}
P_{ac}>3.6 & \text{phase}=1\\
P_{ac}>10 & \text{phase}=3
\end{cases}
$$
Applied only for residential class (`routes.ts:468`); advisory flag
`loses_residential_subsidy`, never blocks.

---

## §7 Annual generation & final kWp surfaced

```
annual_flat_generation = monthly_pv_generation × 12
final_kwp_dc           = kwp_dc_override ?? kwp_dc            (routes.ts:463)
```
(Per-month spreading by seasonal shares / design override is in
[net-billing §pvGenForMonth](./06-net-billing-mechanisms.md).)

## §8 Inputs / Outputs
**In:** `total_annual_consumption`, `sectorClass`, `net_billing_mechanism`,
`connection_phase`, `efficiency`, `inverter_kwac?`, `kwp_dc_override?`.
**Out (into `annual_summary`):** `inverter_size`=$P_{ac}$, `kwp_dc`,
`dc_ac_ratio`=$\Re$, `specific_yield_kwh_per_kwp_year`=1800,
`inverter_cap_kwac`, `inverter_cap_binding`, `mechanism_cap_fraction`=$f_{cap}$,
`loses_residential_subsidy`.
