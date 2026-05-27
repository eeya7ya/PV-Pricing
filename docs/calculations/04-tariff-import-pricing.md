# Calculation 4 — Tariff Import Pricing (FULL MATH)

**File:** `shared/jordanTariffs.ts`. All rates in **fils/kWh** (1 JD = 1000
fils); helpers return **JD**. Prices the month's imported energy for the
resolved EMRC 2025 sector.

---

## §1 Complete sector rate table (`SECTOR_TARIFFS`, `:149`)

### Tiered sectors — tiers as `(upToKWh, rateFils)`
| Sector | Tiers (fils/kWh) | temp | minBill |
|--------|------------------|------|---------|
| A1_subsidized | (300, 50)(600, 100)(∞, 200) | — | 1.75 JD; cash subsidies below |
| A2_unsubsidized | (1000, 120)(∞, 150) | 150 | 1.75 JD |
| B1_commercial | (2000, 120)(∞, 152) | 185 | — |
| D3_hotel_low_star | (2000, 120)(∞, 152) | 185 | (priced as B1) |
| C1_small_industrial | (10000, 60)(∞, 68) | 115 | — |
| E2_govt_hospital / G1_standard_7tier | (160,42)(300,92)(500,109)(750,145)(1000,169)(2000,190)(∞,256) | 266 | — |

A1 **cash subsidies** (`cashSubsidies`, JD credit on the bill):
`fromKWh 51–200 → −2.5 JD`, `201–600 → −2.0 JD`.
(Defined in data; applied wherever the bill builder consumes `cashSubsidies`.)

### 3-period TOU sectors — `(peakFils, partialFils, offPeakFils)`
| Sector | peak | partial | offPeak | temp | PF pen. |
|--------|----:|----:|----:|----:|:--:|
| B3_banks | 298 | 287 | 278 | 285 | — |
| B4_telecom | 152 | 142 | 132 | 170 | — |
| C2_medium_industrial | 79 | 69 | 59 | 115 | ✓ |
| C3_large_industrial | 130 | 120 | 110 | 123 | ✓ |
| C4_extractive | 226 | 216 | 206 | 230 | ✓ |
| D1_hotel_post2008 | 94 | 82 | 73 | 115 | ✓ |
| D2_hotel_pre2008_tou | 94 | 82 | 73 | 115 | ✓ |
| E1_private_hospital | 151 | 140 | 130 | 170 | — |
| F2_agri_legacy | 55 | 55 | 49 | 115 | ✓ (day 55 / night 49) |
| G2_water_pumping | 106 | 95 | 86 | 115 | — |
| G4_govt_armed_forces | 158 | 147 | 138 | 156 | — |
| G5_ev_home | 160 | 118 | 108 | — | — |
| G6_ev_public_wholesale | 133 | 113 | 103 | 185 | — |

### Flat / mixed sectors — `flatFils`
| Sector | flat | temp |
|--------|----:|----:|
| B2_temp_commercial | 185 | — |
| D2_hotel_pre2008_flat | 82 | 115 |
| F1_agri_std | 55 | 115 |
| F3_agri_mixed_well | $\tfrac23\cdot120+\tfrac13\cdot55 = 98.33$ | 115 |
| G3_street_lighting | 114 | — |
| G7_broadcasting | 152 | — |
| G8_ports | 159 | — |

`F3` mixed-well effective rate (`:341`): $r_{F3}=\frac23(120)+\frac13(55)=98.\overline{3}$ fils.

EV public retail add-on (`EV_PUBLIC_OPERATOR_COMMISSION_FILS`, `:415`):
slow +3.5, fast +5.0 fils/kWh on top of the G6 wholesale.

---

## §2 TOU windows (`TOU_WINDOWS`, `:99`)
```
peak         17:00–23:00  (6 h)
partialDay   14:00–17:00  (3 h)
partialNight 23:00–05:00  (6 h)
offPeak      05:00–14:00  (9 h)
legacyDay    07:00–23:00  (16 h)
legacyNight  23:00–07:00  (8 h)
```

---

## §3 Tiered pricing — `priceTieredJD(Q, tiers)` `:548`

Block tariff: charge each tier's `rateFils` only on the energy that falls inside
its `[consumed, upToKWh]` band.
$$
\text{Let } q=\text{remaining},\ c=\text{consumed (running)},\ T=0.
$$
For each tier $i$ (in order), with capacity
$\kappa_i = (\text{upTo}_i=\infty)\,?\,q : \max(0,\ \text{upTo}_i-c)$:
$$
\text{take}_i=\min(q,\kappa_i),\quad
T \mathrel{+}= \text{take}_i\cdot \text{rate}_i,\quad
q \mathrel{-}= \text{take}_i,\quad c\mathrel{+}=\text{take}_i
$$
$$
\boxed{\;\text{JD}=T/1000\;}
$$
```ts
let remaining = monthlyKWh, consumed = 0, totalFils = 0;
for (const tier of tiers) {
  if (remaining <= 0) break;
  const tierCapacity = tier.upToKWh === Infinity ? remaining : Math.max(0, tier.upToKWh - consumed);
  const take = Math.min(remaining, tierCapacity);
  totalFils += take * tier.rateFils;
  remaining -= take; consumed += take;
}
return totalFils / 1000;
```
**Worked example** — A1, $Q=700$ kWh: $300(50)+300(100)+100(200)=15000+30000+20000=65000$ fils $=65.0$ JD.

---

## §4 Three-period TOU — `priceTOU3JD({peak,partial,offPeak}, tou)` `:563`
$$
\boxed{\;\text{JD}=\frac{Q_{peak}\,r_{peak}+Q_{partial}\,r_{partial}+Q_{off}\,r_{off}}{1000}\;}
$$
```ts
const totalFils = kwhByPeriod.peak*tou.peakFils + kwhByPeriod.partial*tou.partialFils + kwhByPeriod.offPeak*tou.offPeakFils;
return totalFils / 1000;
```

## §5 Flat — `priceFlatJD(Q, r)` `:574`
$$\text{JD}=\frac{Q\cdot r}{1000}$$

## §6 Legacy day/night — `priceLegacyDayNightJD({day,night}, dayFils, nightFils)` `:579`
$$\text{JD}=\frac{Q_{day}\,r_{day}+Q_{night}\,r_{night}}{1000}$$

---

## §7 Dispatch — `priceImportJD({sector, monthlyKWh, kwhByPeriod?, isTemporary?})` `:595`

```
if isTemporary AND tariff.temporaryFils != null:
    return priceFlatJD(monthlyKWh, temporaryFils)
switch pricingModel:
    'tiered'              → priceTieredJD(monthlyKWh, tiers)
    'tou3'                → priceTOU3JD(kwhByPeriod ?? {peak:0,partial:0,offPeak:monthlyKWh}, tou3)
    'flat' | 'mixed_well' → priceFlatJD(monthlyKWh, flatFils)
```
> If a TOU sector is priced **without** a period breakdown, all kWh default to
> the **off-peak** bucket (cheapest) — the engine always supplies a breakdown,
> so this only matters for direct callers.

---

## §8 Mapping UI buckets → EMRC 3 periods

### 8.1 Residential 3 buckets → TOU (`routes.ts:498`)
Day = 05–17 (12 h: 9 h off-peak + 3 h partial), evening = peak, night = partial:
$$
Q_{peak}=\text{evening},\quad
Q_{partial}=0.25\,\text{day}+\text{night},\quad
Q_{off}=0.75\,\text{day}
$$
```ts
({ peak: evening, partial: day*0.25 + night, offPeak: day*0.75 })
```

### 8.2 Industrial 4 buckets → standard TOU (`jordanTariffs.ts:936`)
$y_1$=05–14, $y_2$=14–17, $y_3$=17–23, $y_4$=23–05:
$$
Q_{off}=y_1,\quad Q_{partial}=y_2+y_4,\quad Q_{peak}=y_3
$$

### 8.3 Industrial 4 buckets → wheeling/M1 TOU (`:925`)
M1 off-peak absorbs the 14–17 hours:
$$
Q_{off}=y_1+y_2,\quad Q_{partial}=y_4,\quad Q_{peak}=y_3
$$
M1 wheeling windows (`WHEELING_TOU_WINDOWS`, `:914`): offPeak 05–17, peak 17–23,
partial 23–05.

---

## §9 Client-side calculators (`tariffEngine.ts`)

Mirror logic for the client / Buy-All path. **Important unit difference:** the
industrial calculator stores rates in **¢/kWh** and divides by 100 (not 1000):
$$
\text{cost}=\sum_{p} Q_p\cdot\frac{r_p}{100}
$$
```ts
const period1Cost = (byPeriod.period1 || 0) * (config.import_period1 / 100);
// ... + period2..4
```
With **no** period breakdown the industrial calculator uses the 4-period
arithmetic mean: $\bar r=\frac{r_1+r_2+r_3+r_4}{4}$, cost $=Q\cdot\bar r/100$.

Residential calculators (`ResidentialTieredCalculator`,
`ResidentialFlatRateCalculator`) replicate §3 with `rate` already in **JD/kWh**
(no /1000), export revenue $=Q_{exp}\cdot\text{export\_rate}$.

## §10 Output
A single **JD** value for the month's import. Finalized downstream by
[add-ons + min-bill + PF](./05-universal-add-ons-and-fees.md) and netted by the
[credit ledger](./06-net-billing-mechanisms.md).
