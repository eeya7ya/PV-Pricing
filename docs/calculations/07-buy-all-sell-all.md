# Calculation 7 — Buy-All / Sell-All, M4 (FULL MATH)

**File:** `client/src/components/CalculatorLogic.tsx`. Computed **client-side**
(no `/api/calculate`). Buy all consumption at retail, sell all generation at the
export rate; the two never net. Grid-service fee = 0 (M4 exempt).

---

## §1 Generation approximation (both variants)
$$
C_{ann}=\sum_m C_m,\qquad \boxed{X_2=\frac{C_{ann}}{12}}\quad(\text{flat monthly generation})
$$
Guard: throw if $C_{ann}\le0$. Generation $g_m=X_2$ for every month.

---

## §2 Residential M4 — `calculateBuyAllSellAll` `:486`

Sector: `tariffSupported ? A1_subsidized : A2_unsubsidized`. Per month $m$:
$$
\text{importTariff}=\text{calcImportCost}(C_m)\quad(\text{full retail, tiered, no PV offset})
$$
$$
\text{exportTariff}=g_m\cdot r_{exp}\quad(r_{exp}=\text{exportTariff, default }0.05)
$$
$$
\text{addOns}=\text{calcUniversalAddOns}(\text{meterPhase}=1,\ \text{tv}=true,\ \text{rural}=true,\ \text{meter}=true)
$$
$$
\text{bill\_before}=\text{applyMinimumBillJD}(\text{importTariff}+\text{addOns}_{tot},\ \text{sector})
$$
$$
\boxed{\;\text{netCost}=\text{bill\_before}-\text{exportTariff}\;}\qquad
\text{savings}_m=\text{bill\_before}-\text{netCost}=\text{exportTariff}
$$
```ts
const importTariff = tariffCalculator.calcImportCost(consumption);
const exportTariff = calculateExportTariff(generation, exportRate); // = generation * exportRate
const billBefore = applyMinimumBillJD(importTariff + addOnsBefore.totalJD, residentialSector);
const netCost = billBefore - exportTariff;
```
Min-bill applies to import+add-ons **before** the export offset (export = revenue).

---

## §3 Industrial M4 — `calculateIndustrialBuyAllSellAll` `:300`

Period factors must satisfy $\big|\sum f - 1\big|\le0.001$ (`:328`), else throw.
Sector = `Small` → `C1_small_industrial`, `Medium` → `C2_medium_industrial`.

### 3.1 Small Industrial import tariff (tiered, JD/kWh)
$$
\text{import}=
\begin{cases}
C_m\cdot0.06 & C_m\le10000\\[4pt]
10000\cdot0.06 + (C_m-10000)\cdot0.068 & C_m>10000
\end{cases}
$$

### 3.2 Medium Industrial import tariff (per-period, JD/kWh)
Bucket the load by the config factors:
$$
y_1=C_m f_{off},\ y_2=C_m f_{halfDay},\ y_3=C_m f_{peak},\ y_4=C_m f_{halfNight}
$$
$$
\boxed{\;\text{import}=0.059\,y_1+0.069\,y_2+0.079\,y_3+0.069\,y_4\;}
$$
```ts
if (consumption <= 10000) totalImportTariff = consumption * 0.06;
else totalImportTariff = (10000 * 0.06) + ((consumption - 10000) * 0.068);
// medium:
const import_y1 = y1*0.059, import_y2 = y2*0.069, import_y3 = y3*0.079, import_y4 = y4*0.069;
totalImportTariff = import_y1 + import_y2 + import_y3 + import_y4;
```

### 3.3 Monthly assembly
$$
\text{exportTariff}=g_m\cdot r_{exp}\quad(r_{exp}=\text{config.export\_rate, default }0.05)
$$
$$
\text{addOns}=\text{calcUniversalAddOns}(\text{sector}=C1/C2,\ \text{meterPhase}=3,\ \text{tv}=false,\ \text{rural}=true,\ \text{meter}=true)
$$
$$
\text{bill\_before}=\text{applyMinimumBillJD}(\text{import}+\text{addOns}_{tot},\ \text{sector}),\quad
\text{netCost}=\text{bill\_before}-\text{exportTariff}
$$

---

## §4 Annual totals (both variants)
$$
\text{cost\_before}=\sum_m \text{bill\_before}_m,\quad
\text{cost\_after}=\sum_m \text{netCost}_m
$$
$$
\boxed{\;\text{annual\_savings}=\text{cost\_before}-\text{cost\_after}\;}
$$
Inverter size = `inverterKWacFromMonthlyKWh(X2, class)` (= $\frac{X_2}{150\,\Re}$,
class residential 1.5 / industrial 1.2). `taxes = 0` everywhere (demand charges
abolished 2024; `calculateTaxes` returns 0, `:285`).

## §5 Output
`CalculationResults` with `monthly_data[12]` (`self_consumption = 0`,
`export = generation`, `import = consumption`; industrial rows carry
`period_details`) and `annual_summary` (`total_self_consumption = 0`,
`total_export = X2·12`, `net_billing_savings = 0`, `final_credit_balance = 0`).
