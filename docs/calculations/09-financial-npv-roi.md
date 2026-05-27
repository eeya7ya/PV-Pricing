# Calculation 9 — Financial Metrics (FULL MATH)

**File:** `server/routes.ts` (`POST /api/calculate-npv`, `:850`).

Inputs (defaults): `annual_savings` $S=1000$, `system_cost` $C=5000$,
`discount_rate` $d=0.05$, `project_life` $N=25$.

---

## §1 Net Present Value
Hard-coded **0.5 %/yr** output degradation inside this endpoint:
$$
\boxed{\;\text{NPV}=-C+\sum_{y=1}^{N}\frac{S\,(1-0.005)^{y}}{(1+d)^{y}}\;}
$$
```ts
let npv = -system_cost;
for (let year = 1; year <= project_life; year++) {
  const degradation_factor = Math.pow(1 - 0.005, year);
  const yearly_savings = annual_savings * degradation_factor;
  const pv_savings = yearly_savings / Math.pow(1 + discount_rate, year);
  npv += pv_savings;
}
```
> The 0.5 % here is independent of the PV-yield engine's degradation
> (doc 1 §5.11 uses `annualDegradationPct`, default 0.4 %). Flag if you want
> these unified.

## §2 IRR (first-order approximation, capped)
$$
\text{IRR}=\min\!\Big(\frac{S}{C}\cdot100,\ 50\Big)\quad[\%]
$$
Not a cash-flow root-solve — just the simple return capped at 50 %.

## §3 Payback period
$$
\text{payback}=\begin{cases}\dfrac{C}{S} & S>0\\[6pt]999 & \text{else}\end{cases}\quad[\text{years}]
$$

## §4 LCOE (simplified, placeholder generation)
$$
\text{LCOE}=\frac{C}{E_{ann}\cdot N},\qquad E_{ann}=1000\ \text{kWh (hard-coded)}
$$
```ts
const annual_generation = 1000; // kWh - simplified
const lcoe = system_cost / (annual_generation * project_life);
```
> ⚠️ LCOE uses a **constant 1000 kWh/yr**, not the site yield. For a real LCOE
> substitute `annualKWh_year1` from [doc 1](./01-pv-yield.md).

## §5 Output
```json
{ "npv": <JD>, "irr": <%>, "payback": <years>, "lcoe": <JD/kWh> }
```
`annual_savings` normally comes from `annual_summary.annual_savings` /
`total_savings_with_net_billing` (doc 6 §11).
