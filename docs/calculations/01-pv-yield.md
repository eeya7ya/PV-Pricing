# Calculation 1 — PV Energy Yield (FULL MATH)

**File:** `shared/jordanPVDesign.ts`
Every equation below is paired with the verbatim implementation and the exact
line. Symbols are defined once in §0 and reused throughout.

---

## §0 Symbols & units

| Symbol | Code | Unit | Meaning |
|--------|------|------|---------|
| $P_{dc}$ | `dcKWp` | kWp | DC nameplate of the array |
| $P_{ac}$ | `inverterKWac` | kWac | Inverter AC nameplate |
| $G_{ghi}$ | `ghi` | kWh/m²·yr | Global horizontal irradiance |
| $G_{gti}$ | `gtiOpt` | kWh/m²·yr | Irradiation on optimally tilted plane |
| $Y_{fix}$ | `pvoutFix` | kWh/kWp·yr | Atlas PVOUT, **PR ≈ 0.80 embedded** |
| $\beta$ | `tilt_deg` | ° | Array tilt |
| $\beta_{opt}$ | `tiltOpt` | ° | Optimal tilt for the region |
| $\gamma$ | `azimuth_deg` | ° | Azimuth deviation from due south (0 = south) |
| $s_m$ | `monthlyShares[m]` | — | Fraction of annual yield in month $m$, $\sum s_m = 1$ |
| $\text{PR}$ | `pr` | — | Performance ratio |
| $\eta_{EU}$ | `euEfficiencyPct/100` | — | Inverter Euro efficiency |
| $T_{a,m}$ | `tMonth[m]` | °C | Monthly ambient temperature |
| $\alpha_{Voc}$ | `tempCoeffPct` | %/°C | Power/Voc temp coefficient (negative) |

Month index $m \in \{0,\dots,11\}$ (Jan…Dec).

---

## §1 Region resource records (constants)

`JORDAN_REGIONS` — `jordanPVDesign.ts:59`. All 14 records, exact values:

| region | ghi | dni | dhi | gtiOpt | pvoutFix | tiltOpt | zone | soiling | tAvg |
|--------|----:|----:|----:|------:|--------:|-------:|:----:|---------|----:|
| amman | 2090 | 2580 | 720 | 2310 | 1820 | 26 | N | medium | 18.4 |
| irbid | 2030 | 2440 | 740 | 2240 | 1770 | 27 | N | medium | 19.2 |
| mafraq | 2170 | 2720 | 690 | 2400 | 1880 | 27 | E | high | 18.7 |
| zarqa | 2120 | 2640 | 710 | 2340 | 1840 | 26 | N | medium-high | 19.6 |
| aqaba | 2260 | 2820 | 670 | 2440 | 1910 | 24 | S | medium | 25.0 |
| maan | 2300 | 2950 | 640 | 2520 | 1990 | 25 | S | high | 16.8 |
| tafileh | 2210 | 2800 | 670 | 2430 | 1920 | 25 | S | medium | 14.5 |
| karak | 2180 | 2740 | 680 | 2400 | 1890 | 26 | N | medium | 16.0 |
| madaba | 2110 | 2620 | 710 | 2330 | 1830 | 26 | N | medium | 17.8 |
| azraq | 2200 | 2830 | 670 | 2440 | 1910 | 27 | E | very-high | 19.4 |
| jerash | 2050 | 2490 | 730 | 2260 | 1790 | 27 | N | medium | 18.6 |
| ajloun | 1990 | 2360 | 750 | 2200 | 1740 | 27 | N | low | 16.4 |
| wadi-rum | 2290 | 2900 | 650 | 2500 | 1970 | 24 | S | high | 19.5 |
| jordan-valley | 2070 | 2510 | 730 | 2280 | 1800 | 26 | V | medium | 23.8 |

### Monthly-share vectors (normalized)

`normalize12(v)` divides each element by the sum so $\sum_m s_m = 1$ exactly
(`:78`):

```ts
function normalize12(v: number[]): number[] {
  const s = v.reduce((a, b) => a + b, 0);
  return v.map(x => x / s);
}
```

Raw vectors before normalization (`ZONE_MONTHLY_SHARES`, `:83`):

| zone | Jan | Feb | Mar | Apr | May | Jun | Jul | Aug | Sep | Oct | Nov | Dec |
|------|----|----|----|----|----|----|----|----|----|----|----|----|
| N | .054 | .061 | .083 | .089 | .103 | .111 | .115 | .110 | .097 | .082 | .061 | .052 |
| S | .063 | .069 | .087 | .091 | .101 | .106 | .108 | .104 | .094 | .083 | .066 | .060 |
| E | .057 | .064 | .085 | .091 | .104 | .110 | .113 | .107 | .095 | .082 | .063 | .057 |
| V | .058 | .066 | .085 | .090 | .101 | .107 | .111 | .107 | .095 | .083 | .063 | .054 |

Each is divided by its own sum at module load.

### Amman monthly ambient temperature (`AMMAN_MONTHLY_TEMP_C`, `:92`)
$$T_a = [8.4,\,9.6,\,12.7,\,17.0,\,21.6,\,24.6,\,26.1,\,26.0,\,23.7,\,20.0,\,14.2,\,9.8]\ \text{°C}$$
Used as the default monthly temperature vector when no override is supplied.

---

## §2 Loss-chain default constants

```
PR_DEFAULTS         res-rooftop 0.78 | com-rooftop 0.80 | ground-mount 0.82 | ground-tracker 0.81   (:106)
MOUNTING_UPLIFT     fixed 1.00 | HSAT 1.18 | dual-axis 1.30                                          (:114)
AREA_PER_KWP (m²)   res-rooftop 5.5 | com-rooftop 7.0 | ground-mount 15 | ground-tracker 18          (:121)
SOILING_ANNUAL_PCT  low 2 | medium 3 | medium-high 4 | high 5 | very-high 7                          (:129)
SOILING_CLEANING_FACTOR  none 3.0 | quarterly 1.7 | monthly 1.0 | biweekly 0.7 | custom 1.0          (:138)
SOILING_MONTHLY_MULTIPLIERS  [0.5,0.6,1.6,1.8,1.5,1.2,1.1,1.0,0.8,0.7,0.6,0.5]                       (:148)
BIFACIAL_GAIN_PCT   rooftop 6 | ground 9 | BIPV 0                                                    (:153)
ALBEDO_DEFAULTS     rooftop_concrete .30 | rooftop_asphalt .15 | rooftop_white .55 | ground_sand .40
                    ground_gravel .25 | vegetation_sparse .20 | snow .65 | rooftop_default .25
                    ground_default .35                                                               (:160)
```

---

## §3 Inverter clipping loss

`clippingLossPct(r)` where $r = P_{dc}/P_{ac}$ — `jordanPVDesign.ts:174`.
Piecewise-linear in the DC:AC ratio:

$$
L_{clip}(r) =
\begin{cases}
0 & r \le 1.0 \\[2pt]
0.8 \cdot \dfrac{r-1.0}{0.2} & 1.0 < r \le 1.2 \\[6pt]
0.8 + 0.7 \cdot \dfrac{r-1.2}{0.1} & 1.2 < r \le 1.3 \\[6pt]
1.5 + 1.5 \cdot \dfrac{r-1.3}{0.2} & 1.3 < r \le 1.5 \\[6pt]
3.0 & r > 1.5
\end{cases}
\quad [\%]
$$

```ts
export function clippingLossPct(dcAcRatio: number): number {
  if (dcAcRatio <= 1.0) return 0;
  if (dcAcRatio <= 1.2) return 0.8 * ((dcAcRatio - 1.0) / 0.2);
  if (dcAcRatio <= 1.3) return 0.8 + 0.7 * ((dcAcRatio - 1.2) / 0.1);
  if (dcAcRatio <= 1.5) return 1.5 + 1.5 * ((dcAcRatio - 1.3) / 0.2);
  return 3.0;
}
```

Continuity check: at $r=1.2$ both pieces give $0.8$; at $r=1.3$ both give $1.5$;
at $r=1.5$ both give $3.0$. ✓

---

## §4 Tier 1 — Quick Quote

`quickQuoteYield(input)` — `jordanPVDesign.ts:430`.

### 4.1 DC size resolution
$$
P_{dc} =
\begin{cases}
\text{sizeValue} & \text{sizingMode = kWp} \\[4pt]
\dfrac{\text{sizeValue}}{\text{AREA\_PER\_KWP}[\text{systemType}]} & \text{sizingMode = roofArea}
\end{cases}
$$

### 4.2 Performance ratio
$$\text{PR} = \text{prOverride} \ \text{?}\ \text{prOverride} : \text{PR\_DEFAULTS}[\text{systemType}]$$

### 4.3 Annual energy (regross the 0.80-PR atlas figure)
$$\boxed{\;E_{ann} = P_{dc}\cdot Y_{fix}\cdot \frac{\text{PR}}{0.80}\;}$$

### 4.4 Monthly energy
$$E_m = E_{ann}\cdot s_m,\qquad s_m = \text{ZONE\_MONTHLY\_SHARES}[\text{zone}]$$

### 4.5 Specific yield
$$Y_{spec} = E_{ann}/P_{dc}$$

```ts
const dcKWp = input.sizingMode === 'kWp'
  ? input.sizeValue
  : input.sizeValue / AREA_PER_KWP[input.systemType];
const pr = input.prOverride ?? PR_DEFAULTS[input.systemType];
const annual = dcKWp * r.pvoutFix * (pr / 0.80);
const shares = ZONE_MONTHLY_SHARES[r.zone];
const monthly = shares.map(s => annual * s);
```

### 4.6 Degradation curve (Tier 1 hard-codes the rates)
Lifetime $N = 30$ (res-rooftop) else $25$. For year $y \in \{0,\dots,N-1\}$:
$$
E_{ann}(y) = E_{ann}\cdot\underbrace{(1-0.008)}_{\text{LID, yr-1}}\cdot(1-0.004)^{\max(0,\,y)}
$$

```ts
const lifetime = input.systemType === 'res-rooftop' ? 30 : 25;
const yearByYear = Array.from({ length: lifetime }, (_, y) => {
  const lid = 1 - 0.008;
  const deg = lid * Math.pow(1 - 0.004, Math.max(0, y));
  return annual * deg;
});
```
> Note: because of `Math.max(0, y)`, year 0 gets $(1-0.008)(1-0.004)^0 = 0.992$.

### 4.7 Loss-breakdown waterfall (Tier 1, 2 stages, `:455`)
$$
\text{POA stage} = P_{dc}\cdot G_{gti},\quad \text{loss}=0\%
$$
$$
\text{PR stage} = E_{ann},\quad \text{loss}=(1-\tfrac{\text{PR}}{1.0})\cdot100\ \%
$$

Returns `prShortcut: true`.

---

## §5 Tier 2 — Detailed loss chain

`calculatePVYield(input)` — `jordanPVDesign.ts:480`. Executed strictly in this
order.

### 5.0 Resolve site inputs (`:481`)
```ts
const ghi = input.overrideGHI_kWhPerM2Year ?? r.ghi;
const monthlyShares = input.overrideMonthlyShares ?? ZONE_MONTHLY_SHARES[r.zone];
const tMonth = input.overrideMonthlyTemp_C ?? AMMAN_MONTHLY_TEMP_C;
```

### 5.1 Transposition (GHI → POA) — `:490`
$$
f_{opt} = \frac{G_{gti}}{G_{ghi}}\quad(\approx 1.10)
$$
$$
d_\beta = \left(\frac{\beta-\beta_{opt}}{60}\right)^2,\qquad
d_\gamma = \left(\frac{\gamma}{180}\right)^2
$$
$$
\boxed{\;f_{tr} = f_{opt}\,(1 - 0.08\,d_\beta - 0.06\,d_\gamma)\;}
$$
$$
\text{POA}_{ann} = G_{ghi}\cdot f_{tr}
$$
$$
\text{POA}_m = \text{POA}_{ann}\cdot u\cdot s_m,\qquad u=\text{MOUNTING\_UPLIFT[mounting]}
$$

```ts
const tiltOptFactor = r.gtiOpt / r.ghi;
const tiltDeficit = Math.pow((input.tilt_deg - r.tiltOpt) / 60, 2);
const azimuthDeficit = Math.pow(input.azimuth_deg / 180, 2);
const transposition = tiltOptFactor * (1 - 0.08 * tiltDeficit - 0.06 * azimuthDeficit);
const poaAnnual = ghi * transposition;
const mountingFactor = MOUNTING_UPLIFT[input.mountingType];
const poaMonthly = monthlyShares.map(s => poaAnnual * mountingFactor * s);
```

### 5.2 Gross DC energy — `:499`
$$E^{gross}_m = \text{POA}_m\cdot P_{dc}$$

### 5.3 Temperature loss (per month) — `:504`
Daytime cell-temp proxy, then linear power derate (clamped at 0):
$$
T_{cell,m} = T_{a,m} + (\text{NOCT}-20)\cdot 0.6
$$
$$
\boxed{\;L^{temp}_m = \max\!\big(0,\ (T_{cell,m}-25)\cdot|\alpha_{Voc}|\big)\;}\quad[\%]
$$
```ts
const tempLossPct = tMonth.map(ta => {
  const tCell = ta + (input.noct_C - 20) * 0.6;
  return Math.max(0, (tCell - 25) * Math.abs(input.tempCoeffPct));
});
```

### 5.4 Soiling loss (per month) — `:509`
$$
b = \text{soilingAnnualPctOverride} \ ?\ \cdot : \text{SOILING\_ANNUAL\_PCT[class]}
$$
$$
c = \text{SOILING\_CLEANING\_FACTOR[freq]},\qquad \mu_m=\text{monthly multiplier}
$$
$$
\boxed{\;L^{soil}_m = \frac{b\cdot c\cdot \mu_m}{12}\;}\quad[\%]
$$
```ts
const baseSoiling = input.soilingAnnualPctOverride ?? SOILING_ANNUAL_PCT[input.soilingClass];
const cleaningFactor = SOILING_CLEANING_FACTOR[input.cleaningFrequency];
const monthlySoilMults = input.soilingMonthlyMultipliers ?? SOILING_MONTHLY_MULTIPLIERS;
const soilingLossPct = monthlySoilMults.map(m => baseSoiling * cleaningFactor * m / 12);
```

### 5.5 Constant DC-side losses (scalar, summed) — `:517`
$$
L^{const} = L_{mismatch} + L_{near} + L_{horizon} + L_{interrow}
+ L_{spectrum} + L_{IAM} + L_{lowIrr} + |L_{tol}| + L_{dcWire}\quad[\%]
$$
```ts
const constDcLossPct =
  input.moduleMismatchPct +
  input.nearShadingPct + input.horizonShadingPct + input.interRowShadingPct +
  input.spectrumLossPct + input.iamLossPct + input.lowIrradianceLossPct +
  Math.abs(input.moduleTolerancePct) +
  input.dcWiringLossPct;
```

### 5.6 Bifacial gain — `:525`
$$g = \text{bifacial}\ ?\ \text{bifacialGainPct}\ :\ 0\quad[\%]$$

### 5.7 Monthly DC after all DC-side effects — `:528`
$$
\boxed{\;E^{dc}_m = E^{gross}_m\Big(1-\tfrac{L^{temp}_m}{100}\Big)\Big(1-\tfrac{L^{soil}_m}{100}\Big)\Big(1-\tfrac{L^{const}}{100}\Big)\Big(1+\tfrac{g}{100}\Big)\;}
$$
```ts
const monthlyDC = grossDC.map((e, m) => {
  const tempFactor = 1 - tempLossPct[m] / 100;
  const soilFactor = 1 - soilingLossPct[m] / 100;
  const constFactor = 1 - constDcLossPct / 100;
  const bifacialFactor = 1 + bifacialGain / 100;
  return e * tempFactor * soilFactor * constFactor * bifacialFactor;
});
```

### 5.8 Inverter conversion + clipping — `:538`
$$
r = \frac{P_{dc}}{P_{ac}},\qquad L_{clip}=\frac{\text{clippingLossPct}(r)}{100}
$$
$$
\boxed{\;E^{ac}_m = E^{dc}_m\cdot \eta_{EU}\cdot \eta_{MPPT}\cdot(1-L_{clip})\cdot A_{inv}\;}
$$
where $\eta_{EU}=$`euEfficiencyPct/100`, $\eta_{MPPT}=$`mpptEfficiencyPct/100`,
$A_{inv}=$`inverterAvailabilityPct/100`.
```ts
const dcAcRatio = input.dcKWp / input.inverterKWac;
const clip = clippingLossPct(dcAcRatio) / 100;
const monthlyAC = monthlyDC.map(e =>
  e * (input.euEfficiencyPct / 100) * (input.mpptEfficiencyPct / 100)
    * (1 - clip) * (input.inverterAvailabilityPct / 100));
```

### 5.9 AC-side losses — `:549`
$$
\boxed{\;E^{ac,f}_m = E^{ac}_m\Big(1-\tfrac{L_{acWire}}{100}\Big)\Big(1-\tfrac{L_{mvTx}}{100}\Big)\cdot A_{pv}\cdot A_{grid}\;}
$$
$A_{pv}=$`pvAvailabilityPct/100`, $A_{grid}=$`gridAvailabilityPct/100`.
```ts
const monthlyACFinal = monthlyAC.map(e =>
  e * (1 - input.acLvWiringLossPct / 100) * (1 - input.mvTransformerLossPct / 100)
    * (input.pvAvailabilityPct / 100) * (input.gridAvailabilityPct / 100));
```

### 5.10 Annual energy & performance ratio — `:557`
$$
E_{ann}=\sum_{m} E^{ac,f}_m,\qquad
E^{gross}_{ann}=\sum_m E^{gross}_m,\qquad
\boxed{\;\text{PR}=\frac{E_{ann}}{E^{gross}_{ann}}\;}\ \ (0\ \text{if } E^{gross}_{ann}=0)
$$

### 5.11 Degradation curve (Tier 2, parametric) — `:562`
For $y\in\{0,\dots,N-1\}$, $N=$`lifetimeYears`:
$$
E_{ann}(y)=
\begin{cases}
E_{ann}\,(1-\tfrac{\text{lidPct}}{100}) & y=0 \\[4pt]
E_{ann}\,(1-\tfrac{\text{lidPct}}{100})\,(1-\tfrac{\text{degPct}}{100})^{y} & y>0
\end{cases}
$$
```ts
const yearByYear = Array.from({ length: input.lifetimeYears }, (_, y) => {
  const lid = 1 - input.lidPct / 100;
  const deg = y === 0 ? lid : lid * Math.pow(1 - input.annualDegradationPct / 100, y);
  return annual * deg;
});
```

### 5.12 Loss-breakdown waterfall (running product) — `:569`
Start at $\text{running}=E^{gross}_{ann}$, then sequentially multiply.
Stages pushed (energy after each step):
1. **POA irradiation**: $\text{POA}_{tot}\cdot P_{dc}$, loss 0.
2. **Temperature**: $\bar L^{temp}=\frac1{12}\sum_m L^{temp}_m$; running $\times(1-\bar L^{temp}/100)$.
3. **Soiling**: $L^{soil}_{tot}=\sum_m L^{soil}_m$; running $\times(1-L^{soil}_{tot}/100)$.
4. **DC mismatch/shading/optical/wiring**: running $\times(1-L^{const}/100)$.
5. **Bifacial gain** (only if $g>0$): running $\times(1+g/100)$, reported loss $=-g$.
6. **Inverter**: $f_{inv}=\eta_{EU}\eta_{MPPT}(1-L_{clip})A_{inv}$; running $\times f_{inv}$, loss $=(1-f_{inv})100$.
7. **AC wiring/transformer/availability**: $f_{ac}=(1-L_{acWire}/100)(1-L_{mvTx}/100)A_{pv}A_{grid}$; running $\times f_{ac}$.

```ts
let running = grossDCAnnual;
const tempAvg = tempLossPct.reduce((s, v) => s + v, 0) / 12;
running *= (1 - tempAvg / 100);
const soilAvg = soilingLossPct.reduce((s, v) => s + v, 0);
running *= (1 - soilAvg / 100);
running *= (1 - constDcLossPct / 100);
if (bifacialGain > 0) running *= 1 + bifacialGain / 100;
const invFactor = (input.euEfficiencyPct/100)*(input.mpptEfficiencyPct/100)*(1-clip)*(input.inverterAvailabilityPct/100);
running *= invFactor;
const acFactor = (1-input.acLvWiringLossPct/100)*(1-input.mvTransformerLossPct/100)*(input.pvAvailabilityPct/100)*(input.gridAvailabilityPct/100);
running *= acFactor;
```

> ⚠️ **Implementation note for your revision:** the waterfall in §5.12 recomputes
> from `grossDCAnnual` using the **average** monthly temp/soiling loss, whereas
> the actual energy in §5.7–5.9 applies temp & soiling **per month** before
> summing. Because the per-month products and the annual-average product are not
> algebraically identical (Jensen / covariance between $E^{gross}_m$ and
> $L_m$), the waterfall's final `running` will differ slightly from
> `annual` (§5.10). The returned `annualKWh_year1` uses the per-month sum
> (§5.10), not the waterfall. Flag if you want them reconciled.

---

## §6 `defaultDetailedInputs` (every default) — `:353`

```
tilt_deg = tiltOpt(region)      azimuth_deg = 0           mountingType = 'fixed'
tempCoeffPct = -0.30            moduleTech = 'TOPCon'     noct_C = 45
moduleMismatchPct = 1.5         lidPct = 0.8              annualDegradationPct = 0.4
lifetimeYears = res-rooftop?30:25
bifacial = false               bifacialGainPct = rooftop?6:9    albedo = rooftop?.25:.35
cleaningFrequency = 'monthly'  soilingClass = region.soilingClass
nearShadingPct = res 4 | com 1.5 | ground-mount 0.5 | ground-tracker 0.5
horizonShadingPct = 0          interRowShadingPct = ground?2:0
euEfficiencyPct = 98.0         mpptEfficiencyPct = 99.5  inverterAvailabilityPct = 99.0
dcWiringLossPct = 1.5          acLvWiringLossPct = 0.8   mvTransformerLossPct = 0
moduleTolerancePct = 0         spectrumLossPct = 1.5     iamLossPct = 2.5   lowIrradianceLossPct = 1.0
pvAvailabilityPct = 99.0       gridAvailabilityPct = 99.3
```

---

## §7 Area helpers — `:619`
$$
P_{dc}=\frac{A}{\text{AREA\_PER\_KWP[type]}},\qquad A=P_{dc}\cdot\text{AREA\_PER\_KWP[type]}
$$

## §8 Outputs (`YieldResult`, `:413`)
`annualKWh_year1` (§5.10/4.3), `monthlyKWh_year1[12]`, `yearByYear[]` (§5.11/4.6),
`performanceRatio` (§5.10), `specificYield_kWhPerKWpYear` $=E_{ann}/P_{dc}$,
`lossBreakdown` (§5.12/4.7), `prShortcut`.
