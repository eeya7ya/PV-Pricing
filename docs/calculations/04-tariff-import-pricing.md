# Calculation 4 — Tariff Import Pricing

**Source:** `shared/jordanTariffs.ts`
**Used by:** `server/routes.ts` (`priceMonthlyImport`) and
`client/src/lib/tariffEngine.ts` (client‑side calculator classes).

Prices a month's **imported energy** for any EMRC 2025 sector. All sector rates
are stored in **fils/kWh** (1 JD = 1000 fils); helpers return **JD**.

---

## Sectors and pricing models

`SECTOR_TARIFFS` (`jordanTariffs.ts:149`) defines ~30 sector codes across
Residential (A), Commercial (B), Industrial (C), Hotels (D), Hospitals (E),
Agriculture (F) and Special (G). Each carries a `pricingModel`:

| Model | How it prices | Example sectors |
|-------|---------------|-----------------|
| `tiered` | Block tiers, cheaper first block | A1, A2, B1, G1 7‑tier |
| `tou3` | 3‑period time‑of‑use | C2/C3/C4, banks B3, hotels D1, water G2 |
| `flat` | Single rate | B2 temp, F1 agri, street lighting G3 |
| `mixed_well` | Blended fixed rate (agri F3) | F3 = ⅔·120 + ⅓·55 fils |

`SECTOR_TO_CLASS` (`:64`) maps each sector to a coarse class (residential /
commercial / industrial / hotel / hospital / agriculture / special) used to
pick add‑ons and defaults.

---

## Pricing helpers

### Tiered — `priceTieredJD(monthlyKWh, tiers)` `:548`
Walks the tier list, charging each block's rate up to its `upToKWh` cap
(`Infinity` for the last). Example A1 subsidized: ≤300 kWh @ 50 fils,
300–600 @ 100, >600 @ 200.

### 3‑period TOU — `priceTOU3JD({peak, partial, offPeak}, tou)` `:563`
```
totalFils = peak·peakFils + partial·partialFils + offPeak·offPeakFils
JD        = totalFils / 1000
```
TOU windows (`TOU_WINDOWS`, `:99`): peak 17–23, partial 14–17 + 23–05,
off‑peak 05–14.

### Flat — `priceFlatJD(monthlyKWh, rateFils)` `:574`
`monthlyKWh × rateFils / 1000`.

### Legacy day/night — `priceLegacyDayNightJD(...)` `:579`
For agriculture F2: day 07–23, night 23–07.

---

## Dispatch — `priceImportJD(input)` `:595`

```
if isTemporary && tariff.temporaryFils != null → flat at temporaryFils
switch pricingModel:
  tiered      → priceTieredJD
  tou3        → priceTOU3JD (defaults all kWh to off-peak if no breakdown)
  flat / mixed_well → priceFlatJD
```

Input: `{ sector, monthlyKWh, kwhByPeriod?, isTemporary? }`.

---

## Mapping the UI buckets onto EMRC TOU

The UI collects load in time buckets that differ from EMRC's 3 periods, so
`routes.ts` maps them before pricing a TOU sector:

**Residential 3 buckets** → TOU (`routes.ts:498`, `mapResidentialBucketsToTOU`):
```
peak    = evening
partial = day·0.25 + night
offPeak = day·0.75
```

**Industrial 4 buckets** (y1 05–14, y2 14–17, y3 17–23, y4 23–05):
- Standard TOU (`mapFourBucketToStandardTOU`, `jordanTariffs.ts:936`):
  `offPeak = y1`, `partial = y2 + y4`, `peak = y3`.
- Wheeling/M1 TOU (`mapFourBucketToWheelingTOU`, `:925`):
  `offPeak = y1 + y2`, `partial = y4`, `peak = y3` (M1 off‑peak absorbs 14–17).

Tiered/flat residential sectors ignore the bucket split for the **rate** — the
split only affects self‑consumption vs export.

---

## Client‑side calculators (`tariffEngine.ts`)

Mirror the same logic for the front end and the Buy‑All/Sell‑All path:
`ResidentialTieredCalculator`, `ResidentialFlatRateCalculator`,
`IndustrialTOUCalculator` (4‑period, rates in ¢/kWh in this layer), created via
`TariffEngine.createCalculator(type, config)` from `TARIFF_PRESETS`.

## Outputs

A single **JD value** for the month's import energy. Combined downstream with
add‑ons, minimum bill, PF penalty, and the net‑billing ledger
(see docs 5 and 6).
