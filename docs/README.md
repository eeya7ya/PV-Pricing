# PV‑Pricing — Jordan Solar PV Calculator

A web application that sizes a rooftop / ground‑mount solar PV system for a
Jordanian customer and computes the **before‑vs‑after electricity bill** under
the country's 2025 tariff rules and the Bylaw 58/2024 net‑billing mechanisms.

It answers three questions for a given consumer:

1. **How much energy** will a PV system of a given size produce on this site?
   (region irradiance → loss chain → monthly kWh)
2. **What does the electricity bill look like** today, and what will it look
   like after PV under the chosen grid‑connection mechanism?
3. **Is it worth it** — annual savings, payback, NPV, ROI, and the
   balance‑of‑system electrical design (strings, cables, protection).

---

## Tech stack

| Layer        | Technology |
|--------------|------------|
| Frontend     | React 18 + TypeScript, Vite, Wouter (routing), TanStack Query |
| UI           | Tailwind CSS, Radix UI primitives, shadcn‑style components, Chart.js / Recharts |
| Backend      | Express (Node 20, ESM), bundled to a serverless handler via esbuild |
| Persistence  | Neon Postgres via Drizzle ORM (saved study cases, per‑user) |
| Validation   | Zod schemas shared between client and server |
| Deployment   | Vercel (`api/handler.mjs` serverless function + static client) |

## Repository layout

```
shared/                      ← pure, framework-free calculation engines + data
  jordanPVDesign.ts          ← PV energy-yield physics (Tier 1 + Tier 2)
  jordanTariffs.ts           ← EMRC 2025 tariff tables + Bylaw 58 helpers
  pvElectrical.ts            ← string / cable / protection sizing (IEC)
  schema.ts                  ← Zod schemas + shared TypeScript types

server/
  routes.ts                  ← /api/calculate (before/after billing engine)
                               /api/calculate-npv (financial metrics)
                               /api/cases CRUD (saved studies)
  fakeAuth.ts, db.ts, storage.ts, savedCases.ts

client/src/
  components/                ← UI (calculator, panels, results, charts)
  lib/tariffEngine.ts        ← client-side tariff calculator classes
  components/CalculatorLogic.tsx ← orchestrates inputs → /api/calculate

docs/                        ← (this folder) methodology documentation
```

## How a calculation flows through the app

```
User inputs (customer type, consumption, grid connection, PV design)
        │
        ▼
CalculatorLogic.tsx  ── builds request body, optionally runs the PV physics
        │                engine locally (PV Design module) and the
        │                Buy-All/Sell-All path entirely on the client
        ▼
POST /api/calculate  ── server/routes.ts
        │   1. resolve EMRC sector (auto or explicit)
        │   2. size PV generation (X2 = consumption/12 × cap, or design override)
        │   3. size inverter (specific yield + DC:AC + residential cap)
        │   4. per month: split load by time buckets, compute self-consumption,
        │      export, import; price import for the sector; apply add-ons,
        │      min-bill, PF penalty; run the net-billing credit ledger
        │   5. annual reset + grid-service fee
        ▼
CalculationResults  ── monthly_data[12] + annual_summary
        │
        ▼
BeforeAfterResults / Dashboard / TechnicalReport  ── tables, gauges, charts
```

## The calculations, documented

Each engine has its own methodology document under
[`docs/calculations/`](./calculations):

| # | Document | What it covers |
|---|----------|----------------|
| 1 | [PV energy yield](./calculations/01-pv-yield.md) | Region irradiance → monthly/annual kWh (Tier 1 Quick Quote & Tier 2 full loss chain), degradation curve |
| 2 | [Electrical (balance‑of‑system) design](./calculations/02-electrical-design.md) | String sizing, DC/AC cable cross‑section, protection ratings (IEC) |
| 3 | [Inverter & PV sizing](./calculations/03-inverter-and-pv-sizing.md) | Specific‑yield sizing, DC:AC ratios, residential inverter caps, subsidy‑loss trigger |
| 4 | [Tariff import pricing](./calculations/04-tariff-import-pricing.md) | Tiered / 3‑period TOU / flat pricing per EMRC sector |
| 5 | [Universal add‑ons & fees](./calculations/05-universal-add-ons-and-fees.md) | Rural fils, fuel clause, TV fee, meter rent, GAM, waste, PF penalty, grid‑service fee, minimum bill |
| 6 | [Net‑billing mechanisms](./calculations/06-net-billing-mechanisms.md) | M1–M5, the monthly credit ledger, generation caps, eligibility, annual reset |
| 7 | [Buy‑All / Sell‑All](./calculations/07-buy-all-sell-all.md) | Client‑side M4 path (residential + industrial) |
| 8 | [Battery sizing](./calculations/08-battery-sizing.md) | Rule‑of‑thumb storage recommendation per mechanism |
| 9 | [Financial metrics](./calculations/09-financial-npv-roi.md) | NPV, IRR, payback, LCOE |

The **outputs** of all of the above are described in
[`docs/results.md`](./results.md).

## Units & conventions

- Energy: **kWh**. Power: **kWp** (DC nameplate) and **kWac** (inverter).
- Money: tariff rates are stored in **fils/kWh** (1 JD = 1000 fils); helpers
  return **JD**. Bills and savings are JD.
- Time buckets: the EMRC time‑of‑use schedule is 3‑period
  (off‑peak 05–14, partial 14–17 + 23–05, peak 17–23); the industrial UI uses
  a 4‑bucket grid (05–14, 14–17, 17–23, 23–05) that is mapped onto the 3 EMRC
  periods.
- Monthly factors are fractions in `[0, 1]`; consumption is split across time
  buckets by per‑month factor grids.

## Data sources (authoritative)

- **EMRC Tariff Guide 2025** (effective 1 Jan 2025) and the NEPCO bilingual
  schedule — sector rates, TOU windows, add‑ons.
- **Bylaw No. 58 of 2024** (Official Gazette 19 Aug 2024) — the five prosumer
  mechanisms, grid‑service fees, generation caps, DC:AC and inverter caps.
- **Solargis** "Solar Resource and PV Power Potential of Jordan" (2018 atlas),
  cross‑checked against PVGIS‑SARAH2 — regional irradiance and PVOUT.

> Some per‑period TOU values for sectors moved to mandatory TOU in 2025
> (banks, private hospitals, some hotels) are **reconstructed around a
> published anchor** and flagged in the source data — verify against a
> post‑2025 bill before relying on them commercially.
