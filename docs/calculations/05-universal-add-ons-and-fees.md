# Calculation 5 — Universal Add-ons, Fees & Minimum Bill (FULL MATH)

**File:** `shared/jordanTariffs.ts`; assembled in `server/routes.ts`
(`finalizeBill`). All add-ons charged on **imported** kWh only. fils→JD divides
by 1000.

---

## §1 Constants
```
RURAL_FILS_PER_KWH = 1                                  (:424)
TV_FEE_JD_PER_MONTH = 1.0                               (:425)
METER_RENT_JD = { singlePhase: 0.2, threePhase: 0.5 }   (:426)
MIN_BILL_JD = { residential: 1.75, nonResidential: 2.0 }(:427)
FUEL_CLAUSE_FILS_BY_MONTH = { 2026-01..2026-05: 0 }     (:438)  → getFuelClauseFils(key) ?? 0
WASTE_FEE_JD = { A: 3.0, B: 2.0, C: 1.667 }             (:451)
```

---

## §2 GAM municipal fee — `gamMunicipalFeeJD(Q)` `:463`
$$
\text{GAM}(Q)=
\begin{cases}
1.667 & Q\le 200\\[4pt]
1.667 + 0.005\,(Q-200) & Q>200
\end{cases}\quad[\text{JD}]
$$
```ts
if (monthlyKWh <= 200) return 1.667;
return 1.667 + 0.005 * (monthlyKWh - 200);
```

---

## §3 Universal add-ons — `calcUniversalAddOns(input)` `:490`

Let $Q$ = monthly import kWh, $\phi$ = fuel-clause fils for the month-key.
$$
\text{rural}= \mathbb{1}_{rural}\cdot\frac{1\cdot Q}{1000}
\qquad
\text{fuel}=\frac{\phi\cdot Q}{1000}
$$
$$
\text{tv}= \mathbb{1}_{tv}\cdot\mathbb{1}_{\text{class=residential}}\cdot 1.0
\qquad
\text{meter}= \mathbb{1}_{meter}\cdot
\begin{cases}0.5 & \text{phase}=3\\0.2 & \text{else}\end{cases}
$$
$$
\text{gam}=\mathbb{1}_{gam}\cdot\text{GAM}(Q)
\qquad
\text{waste}=\text{wasteClass}\,?\,\text{WASTE\_FEE\_JD[class]}:0
$$
$$
\boxed{\;\text{addOns}_{tot}=\text{rural}+\text{fuel}+\text{tv}+\text{meter}+\text{gam}+\text{waste}\;}
$$
```ts
const filsToJD = (fils) => fils / 1000;
const ruralFilsJD = input.applyRuralFils ? filsToJD(RURAL_FILS_PER_KWH * input.monthlyImportKWh) : 0;
const fuelClauseJD = filsToJD(getFuelClauseFils(input.monthKey) * input.monthlyImportKWh);
const tvFeeJD = input.applyTvFee && SECTOR_TO_CLASS[input.sector] === 'residential' ? TV_FEE_JD_PER_MONTH : 0;
const meterRentJD = input.applyMeterRent ? (input.meterPhase === 3 ? 0.5 : 0.2) : 0;
const gamJD = input.applyGAM ? gamMunicipalFeeJD(input.monthlyImportKWh) : 0;
const wasteJD = input.wasteClass ? WASTE_FEE_JD[input.wasteClass] : 0;
const totalJD = ruralFilsJD + fuelClauseJD + tvFeeJD + meterRentJD + gamJD + wasteJD;
```
> TV fee applies **only** if the sector's class is residential, regardless of
> the `applyTvFee` flag.

---

## §4 Power-factor surcharge — `powerFactorSurchargeJD(bill, pf)` `:529`

Zero if $pf\ge0.88$ or $pf\le0$. Otherwise:
$$
n=\text{round}\!\left(\frac{0.88-pf}{0.01}\right)
$$
$$
\rho=\begin{cases}
0.77\% & pf\ge0.70\\
0.95\% & 0.60\le pf<0.70\\
1.20\% & 0.50\le pf<0.60\\
1.50\% & pf<0.50
\end{cases}
$$
$$
\boxed{\;\text{surcharge}=\text{bill}\cdot\frac{\rho\cdot n}{100}\;}
$$
```ts
if (powerFactor >= 0.88 || powerFactor <= 0) return 0;
const steps = Math.round((0.88 - powerFactor) / 0.01);
let pctPerStep;
if (powerFactor >= 0.7) pctPerStep = 0.77;
else if (powerFactor >= 0.6) pctPerStep = 0.95;
else if (powerFactor >= 0.5) pctPerStep = 1.2;
else pctPerStep = 1.5;
return billJD * (pctPerStep * steps) / 100;
```
Applies only where `sectorAllowsPFPenalty(sector)` (`pfPenaltyApplies` flag):
C2, C3, C4, F2, D1, D2_tou. Engine default $pf=0.90 \Rightarrow$ surcharge 0.

---

## §5 Minimum bill — `applyMinimumBillJD(raw, sector)` `:514`
$$
\text{floor}=\text{minBillJD}_{sector}\ ??\
\begin{cases}1.75 & \text{class=residential}\\2.0 & \text{else}\end{cases}
$$
$$
\boxed{\;\text{bill}=\max(\text{raw},\ \text{floor})\;}
$$

---

## §6 Grid-service fee — `gridServiceFeeJD(input)` `:648`

Per inverter **kWac per month**. Precedence (first match wins):
$$
\text{fee}=0 \quad\text{if } mech\in\{M4, M5\}\ \text{or isWelfareBeneficiary}
$$
Residential class:
$$
\text{fee}=P_{ac}\cdot\big(\text{postBylaw}\,?\,1.0:2.0\big)
$$
Non-residential by sector:
$$
\text{fee}=P_{ac}\cdot
\begin{cases}
0 & C1, C2, F1, F2, F3\ \text{(exempt)}\\
2.5 & \text{hotels } D1,D2_{flat},D2_{tou},D3\\
13.0 & \text{all other non-res (B,C3,C4,E,G…)}\\
13.0 & \text{default}
\end{cases}
$$
```ts
if (input.mechanism === 'M4_buy_all_sell_all') return 0;
if (input.mechanism === 'M5_legacy_net_metering') return 0;
if (input.isWelfareBeneficiary) return 0;
if (klass === 'residential') {
  const ratePerKWac = input.postBylawApplication ? 1.0 : 2.0;
  return input.inverterKWac * ratePerKWac;
}
switch (input.sector) {
  case 'C1_small_industrial': case 'C2_medium_industrial': return 0;
  case 'F1_agri_std': case 'F2_agri_legacy': case 'F3_agri_mixed_well': return 0;
  case 'D1...': case 'D2...': case 'D3...': return input.inverterKWac * 2.5;
  default: return input.inverterKWac * 13.0;
}
```
`gridServiceFeeM3JD` (`:1029`) = `gridServiceFeeJD({...,mechanism:'M2'})`
(M2 schedule reused as a conservative M3 upper bound).

Annualized in the engine: $\text{fee}_{ann}=\text{fee}_{mo}\cdot12$
(`routes.ts:787`).

---

## §7 Assembly — `finalizeBill(rawBill, importKWh, monthIndex)` `routes.ts:519`
$$
\text{monthKey}=\text{`YYYY-MM`},\quad \text{addOns}=\text{calcUniversalAddOns}(\dots)
$$
$$
\text{pf}=\big(\text{sectorAllowsPF}\wedge pf<0.88\big)\,?\,\text{powerFactorSurchargeJD}(\max(0,\text{rawBill}),pf):0
$$
$$
\text{subtotal}=\max(0,\text{rawBill})+\text{addOns}_{tot}+\text{pf}
$$
$$
\boxed{\;\text{finalBill}=\text{applyMinimumBillJD}(\text{subtotal},\text{sector})\;}
$$
```ts
const subtotal = Math.max(0, rawBillJD) + addOns.totalJD + pfSurcharge;
const finalBill = applyMinimumBillJD(subtotal, sector);
```
Called for both before-PV (import = full consumption) and after-PV (import =
residual). The annual grid fee (§6) is added once to `total_cost_after`.
