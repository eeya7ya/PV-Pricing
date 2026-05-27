# Calculation 6 — Net-Billing Mechanisms & Before/After Engine (FULL MATH)

**Files:** `server/routes.ts` (`POST /api/calculate`) + `shared/jordanTariffs.ts`.
Computes the 12-month before/after bills and annual savings.

---

## §0 Mechanism map (`CalculatorLogic.tsx:45`)
| UI label | code | mechanism |
|----------|------|-----------|
| wheeling | `M1_net_value_offsite` | M1 |
| Net billing (default) | `M2_net_value_onsite` | M2 |
| Zero export | `M3_zero_export` | M3 |
| Buy all sell all | `M4_buy_all_sell_all` | M4 (→ [doc 7](./07-buy-all-sell-all.md), client-side) |
| Legacy net metering | `M5_legacy_net_metering` | M5 |

---

## §1 Sector resolution (`routes.ts:385`)
$$
\text{sector}=\text{sector\_override}\ ??\ \text{defaultSectorFor}(\text{customerType},\{\text{subsidized}\})
$$
`defaultSectorFor` (`jordanTariffs.ts:1068`): Residential→`A1_subsidized`
(subsidized) / `A2_unsubsidized`; Industrial→ small `C1` / medium `C2` (default)
/ large `C3` / extractive `C4`; Commercial→`B1`; Hotels→`D1`; Hospitals→`E1`;
Agriculture→`F1`.

---

## §2 Generation cap fraction — `mechanismGenerationCapFraction(mech, class)` `:826`
$$
f_{cap}=\begin{cases}
0.5 & M1\\
1.0\ (\text{res}),\ 0.5\ (\text{non-res}) & M2\\
1.0 & M3,\,M4,\,M5
\end{cases}
$$

---

## §3 Eligibility — `isEligibleForMechanism(sector, mech)` `:856`
Returns `eligible | ineligible | unclear` (advisory only).
- $M5\Rightarrow$ `unclear` (depends on pre-1/6/2024 approval; `isLegacyEligible`).
- $M4\Rightarrow$ `eligible` (universal fallback).
- $M1$: eligible for C1, C2, hotels, agriculture; residential `ineligible`; C3 `unclear`; else `unclear`.
- $M2$: residential, C1, C2, hotels, agriculture `eligible`; C4, B3 `ineligible`; else `unclear`.
- $M3$: B3, C4, G1 `ineligible`; else `eligible`.

Grandfather hinge: `BYLAW_58_CUTOVER_DATE = 2024-06-01`;
$\text{legacy eligible}\iff \text{approvalDate} < \text{cutover}$ (`:1059`).

---

## §4 Export rate (`routes.ts:474`)
$$
r_{exp}=
\begin{cases}
\text{export\_tariff} & \text{export\_tariff}\neq0.04\\
\text{netBillingExportRateJD(sector)} & \text{else}
\end{cases}
$$
$$
\text{netBillingExportRateJD}=\begin{cases}0.05 & \text{class=residential}\\0.04 & \text{else}\end{cases}\ [\text{JD/kWh}]
$$

---

## §5 Per-month PV generation precedence — `pvGenForMonth(m)` `routes.ts:452`
$$
G_m=\begin{cases}
\text{override}[m] & \text{if monthly\_pv\_generation\_override given}\\[4pt]
G_{ann}^{flat}\cdot \hat s_m & \text{else if seasonalShares given}\\[4pt]
G_{mo} & \text{else (flat)}
\end{cases}
$$
where seasonal shares are renormalized
$\hat s_m = s_m/\sum_j s_j$ (`routes.ts:442`), and
$G_{ann}^{flat}=G_{mo}\cdot12$. $G_{mo}$ from [doc 3 §3/§5.1].
```ts
const pvGenForMonth = (i) => monthly_pv_generation_override ? monthly_pv_generation_override[i]
  : seasonalShares ? annual_flat_generation * seasonalShares[i] : monthly_pv_generation;
```

---

## §6 RESIDENTIAL 3-period loop (`routes.ts:693`)

For each month $m$ with load $x_1=C_m$ and generation $x_2=G_m$:

### 6.1 Load buckets
$$
y_1=x_1\cdot d_m,\quad y_2=x_1\cdot e_m,\quad y_3=x_1\cdot n_m,\quad
\Sigma_{cons}=y_1+y_2+y_3
$$
($d,e,n$ = day/evening/night factors.)

### 6.2 Before-PV bill
$$
\text{TOU}_{bf}=\text{sectorIsTOU}\,?\,\text{mapResidentialBucketsToTOU}(y_1,y_2,y_3):\varnothing
$$
$$
\text{billBeforeRaw}=\text{priceImport}(\Sigma_{cons},\text{TOU}_{bf}),\quad
\text{bill\_before}=\text{finalizeBill}(\text{billBeforeRaw},\Sigma_{cons},m)
$$

### 6.3 Generation buckets & self-consumption
$$
z_1=x_2\,\sigma^{peak}_m,\quad z_2=x_2\,\sigma^{med}_m,\quad z_3=x_2\,\sigma^{low}_m
$$
$$
\boxed{\;k_i=\min\!\big(z_i\cdot \kappa^{pv}_{i,m},\ y_i\big)\;}\quad(i=1,2,3),\qquad
\text{self}=\sum_i k_i
$$
($\sigma$ = sun factors, $\kappa^{pv}$ = pvConsume factors. The $\min(\cdot,y_i)$
caps self-consumption at that bucket's load.)

### 6.4 Export / import energy
$$
\text{export}=\sum_i \max(0,\ z_i-k_i),\qquad
\text{imp}_i=\max(0,\ y_i-k_i),\quad \text{import}=\sum_i \text{imp}_i
$$

### 6.5 Import cost, export revenue, raw net bill
$$
\text{TOU}_{imp}=\text{sectorIsTOU}\,?\,\text{mapResidentialBucketsToTOU}(\text{imp}_1,\text{imp}_2,\text{imp}_3):\varnothing
$$
$$
\text{import\_cost}=\text{import}>0\,?\,\text{priceImport}(\text{import},\text{TOU}_{imp}):0
$$
$$
\text{export\_revenue}=
\begin{cases}0 & mech\in\{M3,M5\}\\ \text{export}\cdot r_{exp} & \text{else}\end{cases}
$$
$$
\boxed{\;\text{rawNetBill}=\text{import\_cost}-\text{export\_revenue}\;}
$$

### 6.6 Credit ledger + finalize
$$
\text{ledger}=\text{applyCreditLedger}(\text{rawNetBill}),\quad
\text{bill\_after}=\text{finalizeBill}(\text{ledger.billAfterCredits},\text{import},m)
$$

```ts
const z1 = x2 * sun_peak_factors[month], z2 = x2 * sun_medium_factors[month], z3 = x2 * sun_low_factors[month];
const k1 = Math.min(z1 * pv_consume_day[month], y1);
const k2 = Math.min(z2 * pv_consume_evening[month], y2);
const k3 = Math.min(z3 * pv_consume_night[month], y3);
const self_consumption = k1 + k2 + k3;
const export_energy = Math.max(0,z1-k1)+Math.max(0,z2-k2)+Math.max(0,z3-k3);
const import_energy = Math.max(0,y1-k1)+Math.max(0,y2-k2)+Math.max(0,y3-k3);
const import_cost = import_energy > 0 ? priceMonthlyImport(import_energy, imp_tou) : 0;
const export_revenue = (mech==='M3_zero_export'||mech==='M5_legacy_net_metering') ? 0 : calcExportRevenueJD(export_energy);
const raw_net_bill = import_cost - export_revenue;
```

---

## §7 INDUSTRIAL 4-period loop (`routes.ts:596`)

Buckets $y_1$=05–14, $y_2$=14–17, $y_3$=17–23, $y_4$=23–05:
$$
y_j=x_1\cdot p^{(j)}_m\quad(p^{(j)}=\text{period}_j\text{Factors})
$$

### 7.1 Before-PV TOU mapping (mechanism-dependent)
$$
\text{cons\_tou}=
\begin{cases}
\text{mapFourBucketToWheelingTOU}(y_1,y_2,y_3,y_4) & mech=M1\\
\text{mapFourBucketToStandardTOU}(y_1,y_2,y_3,y_4) & \text{else}
\end{cases}
$$
(definitions in [doc 4 §8.2/8.3]). `bill_before = finalizeBill(priceImport(x1, cons_tou), x1, m)`.

### 7.2 Generation, self-consumption, export, import (4 buckets)
$$
z_j=x_2\cdot \sigma^{(j)}_m,\quad
k_j=\min(z_j\cdot\kappa^{(j)}_m,\ y_j),\quad
\text{self}=\sum_{j=1}^4 k_j
$$
$$
\text{export}=\sum_j\max(0,z_j-k_j),\quad
\text{imp}_j=\max(0,y_j-k_j),\quad \text{import}=\sum_j \text{imp}_j
$$
Import priced with the same wheeling/standard mapping on $(\text{imp}_1..\text{imp}_4)$.
Export revenue and raw net bill as §6.5.

```ts
const y1=x1*period1_factors[month], y2=x1*period2_factors[month], y3=x1*period3_factors[month], y4=x1*period4_factors[month];
const z1=x2*sun_period1_factors[month] /*…z4*/;
const k1=Math.min(z1*pv_consume_period1[month], y1) /*…k4*/;
const self_consumption = k1+k2+k3+k4;
```

---

## §8 Credit ledger — `applyCreditLedger(rawNetBill)` `routes.ts:561`

State: `running_credit_balance` $B$ (carried across months),
`total_net_billing_savings` $S$.
$$
\textbf{if } \text{rawNetBill}<0:\quad
\text{gen}=-\text{rawNetBill},\ B\mathrel{+}=\text{gen},\ \text{billAfter}=0
$$
$$
\textbf{elif } B>0:\quad
\begin{cases}
B\ge \text{raw}: & \text{use}=\text{raw},\ B\mathrel{-}=\text{raw},\ \text{billAfter}=0,\ S\mathrel{+}=\text{raw}\\
B<\text{raw}: & \text{use}=B,\ \text{billAfter}=\text{raw}-B,\ S\mathrel{+}=B,\ B=0
\end{cases}
$$
$$
\textbf{else }:\quad \text{billAfter}=\text{raw}
$$
```ts
if (rawNetBill < 0) { monthly_credit_generated = -rawNetBill; running_credit_balance += monthly_credit_generated; bill_after_credits = 0; }
else if (running_credit_balance > 0) {
  if (running_credit_balance >= rawNetBill) { monthly_credit_used = rawNetBill; running_credit_balance -= rawNetBill; bill_after_credits = 0; total_net_billing_savings += rawNetBill; }
  else { monthly_credit_used = running_credit_balance; bill_after_credits = rawNetBill - running_credit_balance; total_net_billing_savings += running_credit_balance; running_credit_balance = 0; }
} else { bill_after_credits = rawNetBill; }
```
> Note: `finalizeBill` then adds add-ons + min-bill **on top of**
> `bill_after_credits`, so a month fully covered by credit still pays the
> minimum bill + add-ons.

---

## §9 Annual reset — `applyAnnualReset(B, policy)` `jordanTariffs.ts:1005`
$$
\begin{array}{lll}
\texttt{forfeit\_year\_end} & \text{balanceAfter}=0, & \text{forfeited}=B,\ \text{cashedOut}=0\\
\texttt{cash\_out} & \text{balanceAfter}=0, & \text{forfeited}=0,\ \text{cashedOut}=B\\
\texttt{rollover\_indefinite} & \text{balanceAfter}=B, & \text{forfeited}=0,\ \text{cashedOut}=0
\end{array}
$$
Applied at year end (`routes.ts:769`):
$$
\text{total\_cost\_after}\mathrel{+}= \text{forfeited}-\text{cashedOut}
$$
(Default `forfeit_year_end`: forfeited credit is a **loss** → added cost.)

---

## §10 M5 legacy net metering — `legacyNetMeteringMonthly(input)` `:970`
kWh-settled, with export haircut $h$ (`LEGACY_EXPORT_HAIRCUT = 0.80`):
$$
E_{cred}=\text{exports}\cdot h,\qquad
\text{net}=\text{imports}-E_{cred}-\text{priorCarry}
$$
$$
\begin{cases}
\text{net}\ge0: & \text{invoice}=\text{net}\cdot\big(r_{retail}+\tfrac{\phi}{1000}\big),\ \text{carry}=0\\
\text{net}<0: & \text{invoice}=0,\ \text{carry}=-\text{net}
\end{cases}
$$
> In the main `/api/calculate` loop, M5 simply sets `export_revenue = 0` (kWh
> credit handled by this separate legacy ledger, not the JD ledger).

---

## §11 Final annual assembly (`routes.ts:769`)
$$
\text{total\_cost\_after}\mathrel{+}=\text{forfeited}-\text{cashedOut}\quad(\text{§9})
$$
$$
\text{gridFee}_{mo}=\text{gridServiceFeeJD}(\dots),\quad
\text{total\_cost\_after}\mathrel{+}=\text{gridFee}_{mo}\cdot12
$$
$$
\boxed{\;\text{annual\_savings}=\text{total\_cost\_before}-\text{total\_cost\_after}\;}
$$
$$
\text{total\_savings\_with\_net\_billing}=\text{annual\_savings}+\text{total\_net\_billing\_savings}
$$

---

## §12 Inputs / Outputs
**In:** request body validated at `routes.ts:219` (consumption[12], efficiency,
tariff_supported, export_tariff, customer_type, sector?, power_factor, add-on
toggles, meter_phase, net_billing_mechanism, inverter_kwac?, connection_phase,
post_bylaw_application, is_welfare_beneficiary, is_temporary,
annual_reset_policy, legacy_export_haircut, monthly_pv_generation_override?,
kwp_dc_override?, seasonal_generation_shares?, plus the 3- or 4-bucket factor
grids).
**Out:** `monthly_data[12]` + `annual_summary` — see [`results.md`](../results.md).
