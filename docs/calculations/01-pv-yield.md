# Calculation 1 — PV Energy Yield

**Source:** `shared/jordanPVDesign.ts`
**Used by:** `client/src/components/CalculatorLogic.tsx` (PV Design module),
which pipes the monthly kWh vector into `/api/calculate`.

Converts a site + system description into **monthly and annual AC energy
(kWh)**. Two surfaces share one physics model:

- **Tier 1 — Quick Quote**: 5 inputs, everything else locked to class defaults.
- **Tier 2 — Detailed Engineering**: every loss‑chain knob exposed.

---

## Resource data

Each of 14 Jordanian regions carries an irradiance record
(`JORDAN_REGIONS`, `jordanPVDesign.ts:59`):

| Field | Meaning |
|-------|---------|
| `ghi` | Global horizontal irradiance (kWh/m²/yr) |
| `gtiOpt` | Global irradiation on optimally‑tilted plane (kWh/m²/yr) |
| `pvoutFix` | PV output of 1 kWp fixed‑tilt c‑Si at optimum tilt, **PR ≈ 0.80 baked in** (kWh/kWp/yr) |
| `tiltOpt` | Optimal south‑facing tilt (°) |
| `zone` | Monthly‑distribution climate zone (N / S / E / V) |
| `soilingClass` | Dust‑loss class |
| `tAvg` | Annual mean ambient temperature (°C) |

Monthly energy is distributed by **zone monthly shares**
(`ZONE_MONTHLY_SHARES`, `:83`), each row normalized to sum to exactly 1.000.

---

## Tier 1 — Quick Quote

`quickQuoteYield(input)` — `jordanPVDesign.ts:430`

Inputs (`QuickQuoteInputs`): `region`, `sizingMode` (`kWp` | `roofArea`),
`sizeValue`, `systemType`, optional `prOverride`.

```
dcKWp   = sizingMode === 'kWp' ? sizeValue : sizeValue / AREA_PER_KWP[systemType]
pr      = prOverride ?? PR_DEFAULTS[systemType]
annual  = dcKWp × pvoutFix × (pr / 0.80)        // regross the 0.80-PR atlas figure
monthly = annual × ZONE_MONTHLY_SHARES[zone]
```

`PR_DEFAULTS` (`:106`): res‑rooftop 0.78, com‑rooftop 0.80, ground‑mount 0.82,
ground‑tracker 0.81. `AREA_PER_KWP` (`:121`): 5.5 / 7.0 / 15 / 18 m²/kWp.

The `/0.80` rescales the atlas PVOUT (which already embeds PR ≈ 0.80) to the
chosen PR. Tier 1 sets `prShortcut: true` and skips the full loss chain.

---

## Tier 2 — Detailed loss chain

`calculatePVYield(input)` — `jordanPVDesign.ts:480`. Order of operations:

### 1. Plane‑of‑array (POA) irradiance
```
tiltOptFactor   = gtiOpt / ghi                       // ≈ 1.10 for Jordan
tiltDeficit     = ((tilt − tiltOpt) / 60)²
azimuthDeficit  = (azimuth / 180)²
transposition   = tiltOptFactor × (1 − 0.08·tiltDeficit − 0.06·azimuthDeficit)
poaAnnual       = ghi × transposition
poaMonthly[m]   = poaAnnual × MOUNTING_UPLIFT[mounting] × monthlyShares[m]
```
`MOUNTING_UPLIFT` (`:114`): fixed 1.00, HSAT 1.18, dual‑axis 1.30.

### 2. Gross DC energy
```
grossDC[m] = poaMonthly[m] × dcKWp
```

### 3. Temperature loss (per month)
```
tCell        = tAmb[m] + (NOCT − 20) × 0.6           // daytime proxy
tempLoss%[m] = max(0, (tCell − 25) × |tempCoeffPct|)
```

### 4. Soiling loss (per month)
```
baseSoiling   = soilingAnnualPctOverride ?? SOILING_ANNUAL_PCT[soilingClass]
cleaningFactor= SOILING_CLEANING_FACTOR[cleaningFrequency]
soilLoss%[m]  = baseSoiling × cleaningFactor × monthlyMult[m] / 12
```
`SOILING_ANNUAL_PCT` (`:129`): low 2 … very‑high 7 %.
`SOILING_CLEANING_FACTOR` (`:138`): none ×3.0, quarterly ×1.7, monthly ×1.0,
biweekly ×0.7. Monthly multipliers peak Mar–May (khamsin dust), low in winter.

### 5. Constant DC‑side losses (summed, applied flat)
`moduleMismatch + nearShading + horizonShading + interRowShading +
spectrum + IAM + lowIrradiance + |moduleTolerance| + dcWiring` (`:517`).

### 6. Bifacial gain (negative loss)
`bifacialGainPct` applied as `× (1 + gain/100)` when `bifacial` is true.
Defaults (`BIFACIAL_GAIN_PCT`, `:153`): rooftop 6 %, ground 9 %.

### 7. Monthly DC after losses
```
monthlyDC[m] = grossDC[m] × (1 − temp%) × (1 − soil%) × (1 − const%) × (1 + bifacial%)
```

### 8. Inverter conversion + clipping
```
dcAcRatio = dcKWp / inverterKWac
clip      = clippingLossPct(dcAcRatio) / 100
monthlyAC[m] = monthlyDC[m] × ηEU × ηMPPT × (1 − clip) × inverterAvailability
```
`clippingLossPct` (`:174`) is a piecewise curve: 0 % at ratio ≤ 1.0, rising to
~3 % above 1.5.

### 9. AC‑side losses
```
monthlyACFinal[m] = monthlyAC[m] × (1 − acLvWiring%) × (1 − mvTransformer%)
                                 × pvAvailability × gridAvailability
```

### 10. Year‑by‑year degradation
```
year 1:   × (1 − lidPct/100)                                  // light-induced degradation
year y>1: × (1 − lidPct/100) × (1 − annualDegradationPct/100)^y
```
Lifetime defaults to 30 yr (res‑rooftop) / 25 yr (other).

### 11. Performance ratio
```
PR = annualAC / grossDCAnnual
```

`defaultDetailedInputs(region, systemType, dcKWp, inverterKWac)` (`:353`)
fills a complete `DetailedInputs` from class defaults.

---

## Inputs

**Tier 1 (`QuickQuoteInputs`):** region, sizingMode, sizeValue, systemType, prOverride?
**Tier 2 (`DetailedInputs`, `:285`):** site (region + overrides), array geometry
(tilt, azimuth, mounting, GCR), sizing (dcKWp, inverterKWac), module electrical
(temp coeff, tech, NOCT, mismatch, LID, degradation, lifetime, bifacial, albedo),
soiling, shading, inverter efficiencies, wiring losses, optical losses,
availability.

## Outputs (`YieldResult`, `:413`)

| Field | Meaning |
|-------|---------|
| `annualKWh_year1` | Year‑1 annual AC energy |
| `monthlyKWh_year1[12]` | Year‑1 monthly AC energy |
| `yearByYear[]` | Degraded annual kWh for each lifetime year |
| `performanceRatio` | Year‑1 PR |
| `specificYield_kWhPerKWpYear` | annual / dcKWp |
| `lossBreakdown` | Waterfall: POA → temp → soiling → DC losses → bifacial → inverter → AC |
| `prShortcut` | `true` for Tier 1 |

## Related helpers

- `kWpFromRoofArea` / `roofAreaFromKWp` (`:619`) — area ↔ kWp via `AREA_PER_KWP`.
- Equipment libraries: `MODULE_LIBRARY`, `INVERTER_LIBRARY`, `BATTERY_LIBRARY`
  (Jordan market, 2026).
