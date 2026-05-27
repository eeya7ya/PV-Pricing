# Calculation 2 — Electrical Balance-of-System Design (FULL MATH)

**File:** `shared/pvElectrical.ts`. Reference basis IEC 60364-7-712 / IEC 62548
(array protection) and IEC 60364-5-52 (ampacity & voltage drop). SI units (V,
A, mm², m, W). Entry point `designElectrical(input)` — `:374`.

---

## §0 Symbols

| Symbol | Code | Unit |
|--------|------|------|
| $V_{oc}^{STC}$ | `vocStc` | V |
| $V_{mp}^{STC}$ | `vmpStc` | V |
| $I_{sc}$ | `iscStc` | A |
| $I_{mp}$ | `impStc` | A |
| $\alpha$ | `tempCoeffVocPctPerC` | %/°C (negative) |
| $T_{min}$ | `site.tMinC` | °C (default −5) |
| $T_{max}$ | `site.tMaxCellC` | °C (default 70) |
| $N_s$ | `modulesPerString` | — |
| $n_{str}$ | `stringCount` | — |
| $n_{mppt}$ | `inverter.mppts` | — |
| $\rho$ | `COPPER_RHO_OHM_MM2_PER_M` | 0.0225 Ω·mm²/m |

`DEFAULT_SITE_TEMPS = { tMinC: -5, tMaxCellC: 70 }` (`:90`).

---

## §1 Standard component tables

```
CABLE_SIZES_MM2 (:21)      1.5, 2.5, 4, 6, 10, 16, 25, 35, 50, 70, 95, 120, 150, 185, 240, 300
STANDARD_BREAKER_A (:26)   6,10,13,16,20,25,32,40,50,63,80,100,125,160,200,250,315,400,500,630
COPPER_AMPACITY_A (:36)    1.5→18  2.5→25  4→34  6→43  10→60  16→80  25→101  35→126
                           50→153  70→196  95→238  120→276  150→319  185→364  240→430  300→497
COPPER_RHO (:42)           0.0225 Ω·mm²/m  (Cu at ~70–90 °C)
```

### Helper: next standard value (`:114`)
$$\text{nextStandard}(x,\text{tbl})=\min\{s\in\text{tbl}: s\ge x\}\ \text{(else last)}$$
```ts
function nextStandard(value: number, table: readonly number[]): number {
  for (const s of table) if (s >= value) return s;
  return table[table.length - 1];
}
```

### Helper: cable for ampacity (`:120`)
$$\text{cableForAmpacity}(I)=\min\{A\in\text{CABLE\_SIZES}: \text{COPPER\_AMPACITY}[A]\ge I\}$$
```ts
function cableForAmpacity(requiredA: number): number {
  for (const a of CABLE_SIZES_MM2) if (COPPER_AMPACITY_A[a] >= requiredA) return a;
  return CABLE_SIZES_MM2[CABLE_SIZES_MM2.length - 1];
}
```

---

## §2 String / array sizing — `sizeStrings(...)` `:180`

### 2.1 Temperature-shifted module voltages
$$k=\frac{\alpha}{100}$$
$$\boxed{\;V_{oc}^{cold}=V_{oc}^{STC}\big(1+k\,(T_{min}-25)\big)\;}\quad\text{(cold raises Voc; }k<0,\ \Delta T<0)$$
$$\boxed{\;V_{mp}^{hot}=V_{mp}^{STC}\big(1+k\,(T_{max}-25)\big)\;}\quad\text{(hot lowers Vmp)}$$
```ts
const k = module.tempCoeffVocPctPerC / 100;
const vocCold = module.vocStc * (1 + k * (site.tMinC - 25));
const vmpHot  = module.vmpStc * (1 + k * (site.tMaxCellC - 25));
```

### 2.2 String-length bounds
$$
N_{max}^{Vdc}=\Big\lfloor \frac{V_{dc,max}}{V_{oc}^{cold}}\Big\rfloor,\quad
N_{min}^{mppt}=\Big\lceil \frac{V_{mppt,min}}{V_{mp}^{hot}}\Big\rceil,\quad
N_{max}^{mppt}=\Big\lfloor \frac{V_{mppt,max}}{V_{mp}^{hot}}\Big\rfloor
$$
Upper bound: $N_{up}=N_{max}^{Vdc}$, reduced to $N_{max}^{mppt}$ if
$0<N_{max}^{mppt}<N_{up}$.
```ts
const maxByVdcMax = Math.floor(inverter.vdcMaxV / vocCold);
const minByMppt   = Math.ceil(inverter.mpptMinV / vmpHot);
const maxByMpptMax = Math.floor(inverter.mpptMaxV / vmpHot);
let upper = maxByVdcMax;
if (maxByMpptMax > 0 && maxByMpptMax < upper) upper = maxByMpptMax;
```
**Warning** if $N_{min}^{mppt} > N_{max}^{Vdc}$ (no valid length).

### 2.3 Chosen string length (longest valid)
$$
N_s=\max(N_{min}^{mppt},1),\quad\text{then } N_s=N_{up}\ \text{if } N_{up}\ge N_{min}^{mppt}
$$
```ts
let modulesPerString = Math.max(minByMppt, 1);
if (upper >= minByMppt) modulesPerString = upper;
```

### 2.4 String / module counts
$$
W_{str}=N_s\cdot W_p,\quad
n_{str}=\max\!\Big(1,\ \text{round}\frac{P_{dc}^{target}\cdot1000}{W_{str}}\Big),\quad
N_{tot}=N_s\,n_{str}
$$
$$
P_{dc}^{act}=\frac{N_{tot}\cdot W_p}{1000}\ \text{[kWp]}
$$
```ts
const stringWp = modulesPerString * module.wp;
let stringCount = Math.max(1, Math.round((targetKWpDC * 1000) / stringWp));
const modulesTotal = modulesPerString * stringCount;
const actualKWpDC = (modulesTotal * module.wp) / 1000;
```

### 2.5 Per-MPPT current check
$$
n_{str/mppt}=\Big\lceil\frac{n_{str}}{n_{mppt}}\Big\rceil,\quad
I_{mppt}=n_{str/mppt}\cdot I_{mp}
$$
$$\text{OK} \iff I_{mppt}\le I_{dc,max/mppt}$$
```ts
const stringsPerMppt = Math.ceil(stringCount / inverter.mppts);
const mpptCurrent = stringsPerMppt * module.impStc;
const mpptCurrentOkay = mpptCurrent <= inverter.maxDcCurrentPerMpptA;
```

### 2.6 String voltages
$$V_{oc,string}^{cold}=N_s\,V_{oc}^{cold},\qquad V_{mp,string}^{hot}=N_s\,V_{mp}^{hot}$$
**Warning** if $V_{oc,string}^{cold} > V_{dc,max}$.

---

## §3 DC cable — `sizeDcCable(...)` `:259`

### 3.1 Design & operating current
$$
I_{sc,array}=I_{sc}\cdot n_{str/mppt},\quad
\boxed{I_{design}=1.25\,I_{sc,array}}\ \text{(IEC 62548)}
$$
$$
I_{mp,array}=I_{mp}\cdot n_{str/mppt}\quad\text{(used for V-drop at }P_{max})
$$

### 3.2 Initial size by ampacity
$$A_0=\text{cableForAmpacity}(I_{design})$$

### 3.3 Voltage drop (out-and-back) and upsizing loop
$$
R(A)=\frac{\rho\cdot 2L}{A},\qquad
\Delta V(A)=I_{mp,array}\cdot R(A),\qquad
\Delta V\%(A)=\frac{\Delta V(A)}{V_{mp,string}^{hot}}\cdot100
$$
Loop: while $\Delta V\% > \text{limit}$ and not at max size,
$A\leftarrow\text{nextStandard}(A+0.01,\text{CABLE\_SIZES})$.
($V_{mp,string}^{hot}$ floored at 1 to avoid div-by-zero.)
```ts
const arrayIsc = module.iscStc * strings.stringsPerMppt;
const designCurrent = 1.25 * arrayIsc;
const impCurrent = module.impStc * strings.stringsPerMppt;
let size = cableForAmpacity(designCurrent);
const stringV = strings.stringVmpHotV > 0 ? strings.stringVmpHotV : 1;
const dropAt = (a: number) => {
  const r = (COPPER_RHO_OHM_MM2_PER_M * 2 * lengthM) / a;
  const v = impCurrent * r;
  return { v, pct: (v / stringV) * 100 };
};
let { v, pct } = dropAt(size);
while (pct > vdropLimitPct && size < CABLE_SIZES_MM2[CABLE_SIZES_MM2.length - 1]) {
  size = nextStandard(size + 0.01, CABLE_SIZES_MM2);
  ({ v, pct } = dropAt(size));
}
```
Default DC limit = **2 %**, default length = **30 m**.

> ⚠️ **Revision note:** the returned `sizeMm2` is `cableForAmpacity(designCurrent)`
> (the *ampacity-only* pick), while `finalSizeMm2` is the upsized result. The
> reported `ampacityA` and `voltageDropPct` are computed on the upsized `size`.
> So `sizeMm2` can be smaller than `finalSizeMm2` by design — confirm which you
> want surfaced in the UI.

---

## §4 AC cable — `sizeAcCable(...)` `:298`

$$
\boxed{I_{design}=1.25\,I_{ac}}\qquad A_0=\text{cableForAmpacity}(I_{design})
$$
One-way resistance $R_{1}(A)=\dfrac{\rho L}{A}$, then phase-dependent drop:
$$
\Delta V=
\begin{cases}
\sqrt3\,I_{ac}\,R_1 & \text{3-phase}\\[4pt]
2\,I_{ac}\,R_1 & \text{1-phase (out\&back)}
\end{cases}
\qquad
\Delta V\%=\frac{\Delta V}{V_{ac}}\cdot100
$$
Same upsizing loop as §3.3. Default AC limit = **1 %**, default length = **15 m**.
```ts
const designCurrent = 1.25 * acCurrentA;
const dropAt = (a: number) => {
  const rOneWay = (COPPER_RHO_OHM_MM2_PER_M * lengthM) / a;
  const drop = inverter.phases === 3
    ? Math.sqrt(3) * acCurrentA * rOneWay
    : 2 * acCurrentA * rOneWay;
  return { v: drop, pct: (drop / v) * 100 };   // v = inverter.acVoltageV
};
```

---

## §5 AC current — `acCurrent(inverter, pf)` `:339`
$$
W=P_{ac}\cdot1000,\quad pf'=pf>0\,?\,pf:1
$$
$$
\boxed{\,I_{ac}=
\begin{cases}
\dfrac{W}{\sqrt3\,V_{ac}\,pf'} & \text{3-phase}\\[8pt]
\dfrac{W}{V_{ac}\,pf'} & \text{1-phase}
\end{cases}}
$$
Default `powerFactor = 1.0` (unity PV inverter).

---

## §6 Protection — `sizeProtection(...)` `:347`

### 6.1 String fuse (only if $n_{str/mppt}\ge3$)
$$
\text{required}\iff n_{str/mppt}\ge 3
$$
$$
I_{fuse}=\min\big(\text{nextStandard}(1.5\,I_{sc},\text{BREAKERS}),\ I_{fuse}^{max}\big)
$$
Else `dcStringFuseA = null`.

### 6.2 DC disconnect
$$
I_{disc}=\text{nextStandard}\big(1.25\,I_{sc}\,n_{str/mppt},\ \text{BREAKERS}\big)
$$

### 6.3 AC breaker
$$
I_{br}=\text{nextStandard}\big(1.25\,I_{ac},\ \text{BREAKERS}\big)
$$
```ts
const fuseRequired = strings.stringsPerMppt >= 3;
let dcStringFuseA = null;
if (fuseRequired) {
  const target = 1.5 * module.iscStc;
  const cand = nextStandard(target, STANDARD_BREAKER_A);
  dcStringFuseA = Math.min(cand, module.maxSeriesFuseA);
}
const dcDisconnectA = nextStandard(1.25 * module.iscStc * strings.stringsPerMppt, STANDARD_BREAKER_A);
const acBreakerA = nextStandard(1.25 * acCurrentA, STANDARD_BREAKER_A);
```

---

## §7 Orchestration — `designElectrical(input)` `:374`

Defaults applied: `site = DEFAULT_SITE_TEMPS`, `pf = 1.0`, `dcLen = 30`,
`acLen = 15`, `dcLimit = 2`, `acLimit = 1`.

$$
r_{dc:ac}=\frac{P_{dc}^{act}}{P_{ac}}\ \ (0\ \text{if } P_{ac}=0)
$$
Extra warnings:
- $r_{dc:ac}>1.55$ → "high — expect clipping; Bylaw 58 caps residential at 1.5".
- AC / DC voltage drop not within limit even at largest cable.

```ts
const dcAcRatio = input.inverter.kWac > 0 ? strings.actualKWpDC / input.inverter.kWac : 0;
if (dcAcRatio > 1.55) warnings.push(`DC:AC ratio ${dcAcRatio.toFixed(2)} is high — expect inverter clipping...`);
if (!acCable.withinLimit) warnings.push('AC voltage drop exceeds limit even at largest cable — shorten the run.');
if (!dcCable.withinLimit) warnings.push('DC voltage drop exceeds limit even at largest cable — shorten the run.');
```

---

## §8 Default module electrical — `defaultModuleElectrical(wp=580)` `:403`
Scales a 580 W TOPCon reference (`voc 51.8, vmp 43.2, isc 14.2, imp 13.43`) by
$s=W_p/580$:
$$
I_{sc}=14.2\,s,\quad I_{mp}=13.43\,s,\quad
V_{oc}=51.8,\ V_{mp}=43.2\ (\text{unchanged}),\quad \alpha=-0.25,\ I_{fuse}^{max}=25
$$

## §9 Outputs
`StringSizing` (§2), `CableResult ×2` (§3–4), `ProtectionResult` (§6),
`dcAcRatio` (§7), `warnings[]`.
