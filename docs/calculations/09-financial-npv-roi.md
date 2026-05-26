# Calculation 9 — Financial Metrics (NPV / IRR / Payback / LCOE)

**Source:** `server/routes.ts` (`POST /api/calculate-npv`, `:850`).

Given the annual savings from the billing engine and a system cost, computes the
standard investment‑appraisal metrics over the project life.

---

## Net Present Value (NPV)

```
npv = −system_cost
for year = 1 … project_life:
    degradation_factor = (1 − 0.005)^year        # 0.5 %/yr output degradation
    yearly_savings     = annual_savings × degradation_factor
    pv_savings         = yearly_savings / (1 + discount_rate)^year
    npv               += pv_savings
```

Each year's savings are degraded (panels produce less over time) and discounted
back to present value, then summed against the up‑front investment.

## Internal Rate of Return (IRR) — simplified

```
simple_return = annual_savings / system_cost
irr           = min(simple_return × 100, 50)      # capped at 50 %
```
A first‑order approximation (not a full cash‑flow root‑solve), capped at a
reasonable ceiling.

## Payback period

```
payback = annual_savings > 0 ? system_cost / annual_savings : 999   # years
```

## Levelized Cost of Energy (LCOE) — simplified

```
annual_generation = 1000   # kWh, placeholder constant in this endpoint
lcoe = system_cost / (annual_generation × project_life)
```

> The LCOE here uses a placeholder annual generation; for a site‑accurate LCOE
> use the PV‑yield engine's `annualKWh_year1` (see [doc 1](./01-pv-yield.md)) as
> the denominator basis.

---

## Inputs (request body, all optional with defaults)

| Field | Default |
|-------|---------|
| `annual_savings` | 1000 JD |
| `system_cost` | 5000 JD |
| `discount_rate` | 0.05 |
| `project_life` | 25 yr |

## Outputs

```json
{ "npv": <JD>, "irr": <%>, "payback": <years>, "lcoe": <JD/kWh> }
```

The `annual_savings` feeding this endpoint is normally taken from the
`annual_summary.annual_savings` (or `total_savings_with_net_billing`) returned
by `/api/calculate`.
