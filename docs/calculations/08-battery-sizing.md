# Calculation 8 — Battery Sizing (FULL MATH)

**File:** `shared/jordanPVDesign.ts` (`recommendBatterySize`, `:636`;
`STORAGE_CHEMISTRY_DEFAULTS`, `:262`; `BATTERY_LIBRARY`, `:253`).

---

## §1 Recommended capacity — `recommendBatterySize(mechanism, D)` `:636`

$D$ = `avgDailyKWh` (≈ annual consumption / 365). Output rounded to integer kWh:
$$
\text{recommendedKWh}=\text{round}\big(\lambda_{mech}\cdot D\big),\qquad
\lambda_{mech}=
\begin{cases}
0.40 & \texttt{M2\_res}\\
0.25 & \texttt{M2\_com}\\
0.30 & \texttt{M3}\\
1.00 & \texttt{off-grid}\\
0 & \texttt{M4},\ \texttt{M5}\\
0 & \texttt{M1}\ (\text{default})
\end{cases}
$$
```ts
case 'M2_res': return { recommendedKWh: Math.round(avgDailyKWh * 0.40), rationale: ... };
case 'M2_com': return { recommendedKWh: Math.round(avgDailyKWh * 0.25), rationale: ... };
case 'M3':     return { recommendedKWh: Math.round(avgDailyKWh * 0.30), rationale: ... };
case 'M4': case 'M5': return { recommendedKWh: 0, rationale: 'No economic case…' };
case 'off-grid': return { recommendedKWh: Math.round(avgDailyKWh * 1.0), rationale: ... };
case 'M1': default: return { recommendedKWh: 0, rationale: 'Wheeling does not benefit…' };
```
Economic logic: storage only pays where stored energy displaces a high
**import** rate (M2 res arbitrage 0.20 import vs 0.05 export). M4/M5/M1 already
price export fairly → $\lambda=0$.

---

## §2 Chemistry defaults — `STORAGE_CHEMISTRY_DEFAULTS` `:262`
| chemistry | dod | rte | degPctPerYear | cycleLife | calendarLifeYears |
|-----------|----:|----:|--------------:|----------:|------------------:|
| LFP | 0.90 | 0.92 | 2 | 6000 | 12 |
| NMC | 0.80 | 0.92 | 3 | 4000 | 10 |
| LeadAcid | 0.50 | 0.80 | 5 | 1200 | 6 |

Derived quantities (used by callers, not by `recommendBatterySize` itself):
$$
E_{usable}=E_{nom}\cdot\text{dod},\qquad
E_{deliv/cycle}=E_{usable}\cdot\sqrt{\text{rte}}\ \text{(per direction)}
$$
$$
\text{capacity}(y)=E_{nom}\,(1-\text{degPctPerYear}/100)^y
$$
(off-grid rationale: ~1 day autonomy at 90 % DoD LFP; 2 days at 50 % DoD lead-acid.)

---

## §3 Battery library — `BATTERY_LIBRARY` `:253`
| id | nominalKWh | dod | rte | cycles | chem |
|----|----:|----:|----:|----:|------|
| HUA-LUNA-5 | 5.0 | 1.00 | 0.95 | 6000 | LFP |
| HUA-LUNA-15 | 15.0 | 1.00 | 0.95 | 6000 | LFP |
| BYD-HVS-7.7 | 7.7 | 0.90 | 0.95 | 6000 | LFP |
| BYD-HVM-22 | 22.1 | 0.90 | 0.95 | 6000 | LFP |
| PYL-FT4800 | 7.1 | 0.95 | 0.95 | 6000 | LFP |
| SG-SBR-9.6 | 9.6 | 1.00 | 0.95 | 6000 | LFP |

## §4 Inputs / Outputs
**In:** `mechanism` ∈ {M1, M2_res, M2_com, M3, M4, M5, off-grid}, `avgDailyKWh`.
**Out:** `{ recommendedKWh, rationale }` — a design hint, not part of the billing
`CalculationResults`.
