# Calculation 2 — Electrical (Balance‑of‑System) Design

**Source:** `shared/pvElectrical.ts`
**Used by:** the Electrical Design panel; produces the single‑line diagram and
string/cable/protection schedule shown under the Results tab.

Turns a module + inverter selection and a target DC array size into a buildable
**string layout**, **DC/AC cable cross‑sections** (ampacity + voltage‑drop
checked) and **DC/AC protection ratings**.

Reference basis: IEC 60364‑7‑712 / IEC 62548 (PV array protection) and
IEC 60364‑5‑52 (cable ampacity & voltage drop). Defaults target a Jordan
rooftop/ground install: cold morning ≈ −5 °C, hot cell ≈ 70 °C
(`DEFAULT_SITE_TEMPS`, `pvElectrical.ts:90`). All units SI (V, A, mm², m, W).

Top‑level entry point: `designElectrical(input)` — `pvElectrical.ts:374`.

---

## String / array sizing

`sizeStrings(module, inverter, targetKWpDC, site)` — `pvElectrical.ts:180`

```
k        = tempCoeffVocPctPerC / 100
vocCold  = vocStc × (1 + k·(tMin − 25))     // cold morning raises Voc
vmpHot   = vmpStc × (1 + k·(tMaxCell − 25)) // hot cell depresses Vmp

maxByVdcMax = floor(inverter.vdcMaxV / vocCold)   // never exceed abs. max DC V
minByMppt   = ceil(inverter.mpptMinV / vmpHot)    // stay above MPPT floor when hot
maxByMpptMax= floor(inverter.mpptMaxV / vmpHot)
```

- Upper bound = `min(maxByVdcMax, maxByMpptMax)`; aim for the **longest valid
  string** (fewer parallel strings → less balance‑of‑system).
- `stringCount = round(targetKWpDC·1000 / stringWp)`, ≥ 1.
- Strings spread across MPPTs: `stringsPerMppt = ceil(stringCount / mppts)`.
- Per‑MPPT current check: `stringsPerMppt × impStc ≤ maxDcCurrentPerMpptA`.

**Warnings** raised: no valid string length (MPPT floor exceeds Vdc‑max
ceiling), per‑MPPT current over limit, string cold‑Voc over inverter Vdc‑max.

---

## Cable sizing (ampacity + voltage drop)

### DC cable — `sizeDcCable(...)` `pvElectrical.ts:259`
```
arrayIsc      = iscStc × stringsPerMppt
designCurrent = 1.25 × arrayIsc            // IEC 62548
size          = smallest cable with ampacity ≥ designCurrent
```
Then upsize until the voltage drop at Pmax is within the limit:
```
R     = ρ × 2 × length / A                 // out-and-back, ρ = 0.0225 Ω·mm²/m
ΔV    = (impStc × stringsPerMppt) × R
drop% = ΔV / stringVmpHot × 100            // limit default 2 %
```

### AC cable — `sizeAcCable(...)` `pvElectrical.ts:298`
```
designCurrent = 1.25 × acCurrent
3-phase: ΔV = √3 · I · R_oneway
1-phase: ΔV = 2 · I · R_oneway             // out and back
drop% = ΔV / acVoltage × 100               // limit default 1 %
```

Standard copper cross‑sections `CABLE_SIZES_MM2` (1.5 … 300 mm²) and the
conservative ampacity table `COPPER_AMPACITY_A` are at `pvElectrical.ts:21`/`:36`.

---

## Protection

`sizeProtection(module, inverter, strings, acCurrentA)` — `pvElectrical.ts:347`

| Device | Rule |
|--------|------|
| DC string fuse | Required only when `stringsPerMppt ≥ 3` (IEC 62548). Rating: next standard ≥ `1.5 × Isc`, capped at the module's `maxSeriesFuseA`. |
| DC disconnect | Next standard ≥ `1.25 × Isc × stringsPerMppt`. |
| AC breaker | Next standard ≥ `1.25 × acCurrent`. |

AC current — `acCurrent(inverter, powerFactor)` `pvElectrical.ts:339`:
```
3-phase: I = kWac·1000 / (√3 · acVoltage · pf)
1-phase: I = kWac·1000 / (acVoltage · pf)
```
Standard breaker/fuse ratings `STANDARD_BREAKER_A` (6 … 630 A) at `:26`.

---

## DC:AC ratio check

`designElectrical` computes `dcAcRatio = actualKWpDC / inverter.kWac` and warns
when it exceeds **1.55** (Bylaw 58 annex caps residential at 1.5 → expect
inverter clipping). Also surfaces AC/DC voltage‑drop‑exceeds‑limit warnings.

---

## Inputs (`ElectricalDesignInput`, `pvElectrical.ts:92`)

- `module` (`ModuleElectrical`): wp, vocStc, vmpStc, iscStc, impStc,
  tempCoeffVocPctPerC, maxSeriesFuseA.
- `inverter` (`InverterElectrical`): kWac, phases, mpptMinV, mpptMaxV, vdcMaxV,
  maxDcCurrentPerMpptA, mppts, acVoltageV.
- `targetKWpDC`, optional `site`, `powerFactor` (default 1.0),
  `dcCableLengthM` (30), `acCableLengthM` (15), `dcVdropLimitPct` (2),
  `acVdropLimitPct` (1).

`defaultModuleElectrical(wp)` (`:403`) scales a representative 580 W TOPCon
datasheet to any Wp.

## Outputs (`ElectricalDesign`, `pvElectrical.ts:167`)

`strings` (`StringSizing`), `dcCable` & `acCable` (`CableResult`: design
current, picked size, ampacity, voltage drop, final size after upsizing),
`protection` (`ProtectionResult`), `dcAcRatio`, and aggregated `warnings`.
