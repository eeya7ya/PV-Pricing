# PV-Pricing — Implementation Study Guide

A detailed walkthrough of the **Solar PV Calculator** codebase, written to help you
study the current implementation. It explains the architecture, the data flow,
and — most importantly — the calculation engine (Jordan EMRC 2025 tariffs +
Bylaw 58/2024 net-billing economics + a PV physics engine).

> Companion documents already in the repo:
> - `CALCULATIONS.md` — the full math/methodology reference (read alongside this).
> - `README.md` — quick-start and deployment.
> - `replit.md` — the original architecture notes from the Replit project.

---

## 1. What the application does

It is a professional tool that, given a customer's **12 months of electricity
consumption** and a set of system/tariff parameters, computes:

1. **PV system sizing** — target monthly generation, kWp DC, inverter kWac
   (subject to Jordan's regulatory caps).
2. **Before-vs-after bills** — the monthly electricity bill without PV vs. with
   PV, under the chosen grid-connection mechanism.
3. **Net-billing economics** — self-consumption, export, monetary credits, grid
   service fees, and annual savings.
4. **Financial analysis** — NPV, IRR, payback, LCOE.
5. **A physics-based yield model** (optional "PV Design" module) that replaces
   the rough sizing heuristic with a real region × tilt × loss-chain calculation.
6. **An exportable technical report** (PDF via the browser print dialog).

The math originated in a PyQt6 desktop application and was ported to a
React + Express web app, then substantially upgraded to reflect Jordan's
**EMRC 2025 Tariff Guide** and **Bylaw No. 58 of 2024**.

---

## 2. Tech stack & project layout

```
api/          Vercel serverless function output (handler.mjs — built artifact)
client/       React + Vite + TypeScript frontend (shadcn/ui + Tailwind)
server/       Express app (also runs as Vite middleware in dev)
shared/       Domain logic + Zod/Drizzle schemas shared by client and server
vercel.json   Vercel build & rewrite config
vite.config.ts / tsconfig.json / tailwind.config.ts / postcss.config.js
```

| Layer        | Technology |
|--------------|------------|
| Frontend     | React 18, Vite, TypeScript, Wouter (routing), TanStack Query, Tailwind, Radix/shadcn, Chart.js + Recharts |
| Backend      | Node.js, Express (ESM), Zod validation |
| Shared       | TypeScript modules; Drizzle ORM types + Zod schemas |
| Auth         | Stateless signed-cookie demo auth (HMAC-SHA256) |
| Persistence  | In-memory store (no database in the demo deployment) |
| Deploy       | Vercel (serverless function + static SPA) |

### Path aliases
- `@/*` → `client/src/*`
- `@shared/*` → `shared/*`

These are configured in both `tsconfig.json` and `vite.config.ts`.

---

## 3. How it runs (build & serve)

### Local development (`npm run dev`)
`server/index.ts` is the entrypoint. It calls `createApp()` (from `server/app.ts`)
to build the Express app, then in development attaches **Vite as middleware**
(`setupVite`) so the React app and API are served from one port (`5000`) with HMR.

### Production / Vercel
- `npm run build` does two things:
  1. `vite build` → static SPA into `dist/public`.
  2. `build:api` → esbuild bundles `server/handler.ts` into `api/handler.mjs`
     (a Node serverless function).
- `vercel.json` rewrites:
  - `/api/(.*)` → `/api/handler` (the Express app handles all API routes)
  - everything else → `/index.html` (SPA client-side routing)
- `server/handler.ts` lazily constructs the Express app once per cold start
  (`appPromise`) and reuses it across invocations.

The **same `createApp()` factory** powers both dev and prod — there is one
Express app definition, not two.

---

## 4. Request/data flow (end to end)

```
┌────────────────────────────────────────────────────────────────────────┐
│ Browser (React SPA)                                                      │
│                                                                          │
│  App.tsx → Router (Wouter) → ProtectedRoute → SolarCalculatorApp        │
│                                   │                                       │
│                                   ▼                                       │
│            CalculatorLogic (render-prop, holds ALL calculator state)     │
│                                   │                                       │
│   ┌───────────────────────────────┼───────────────────────────────┐     │
│   │ Input components               │ Output components             │     │
│   │  CustomerGridSelection         │  CircularGauge / Dashboard    │     │
│   │  MonthlyConsumptionInputs      │  BeforeAfterResults           │     │
│   │  SystemConfiguration           │  AnalysisSection              │     │
│   │  TimeParametersSection         │  ComparisonSection            │     │
│   │  PVDesignPanel                 │  TechnicalReport (print)      │     │
│   └───────────────────────────────┴───────────────────────────────┘     │
│                                   │                                       │
│                 calculate()  →  POST /api/calculate                       │
└────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│ Express (server/routes.ts)                                               │
│   /api/calculate     → validates (Zod) → runs billing engine             │
│   /api/calculate-npv → NPV/IRR/payback/LCOE                              │
│   /api/projects[...]  → CRUD (in-memory)                                 │
│   /api/login etc.     → fakeAuth demo session                            │
│                                    │                                      │
│              uses shared/jordanTariffs.ts (pricing helpers)              │
└────────────────────────────────────────────────────────────────────────┘
```

Two important nuances:

- **"Buy all sell all"** is computed **entirely on the client** in
  `CalculatorLogic.tsx` (it never hits `/api/calculate`).
- The **PV Design module** (physics yield) runs on the **client**, and its
  resulting monthly-kWh vector is sent to the server as an *override* so the
  billing engine uses real generation instead of the consumption heuristic.

---

## 5. The shared domain model (`shared/`)

This is the heart of the project. Three files:

### 5.1 `shared/schema.ts`
- **Enums / constants**: `CUSTOMER_TYPES` (Residential, Industrial, Commercial,
  Hotels, Hospitals, Agriculture) and `GRID_CONNECTION_METHODS`.
- **Grid-connection → mechanism mapping** (documented in comments):
  | UI label | Bylaw 58 mechanism |
  |---|---|
  | Net billing | M2 Net Value On-site |
  | wheeling | M1 Net Value Off-site |
  | Zero export | M3 Zero Export |
  | Buy all sell all | M4 Buy-All/Sell-All |
  | Legacy net metering | M5 (grandfathered pre-1/6/2024) |
- **Drizzle tables**: `solarProjects` (full project record, JSONB for the factor
  maps and results), plus `sessions` and `users` (legacy Replit-auth shape —
  unused by the demo cookie auth but kept).
- **Zod schemas** for all I/O: `MonthlyConsumptionSchema`, `TimeFactorsSchema`
  (12 monthly values in 0–1), `MonthlyDataSchema`, `AnnualSummarySchema`,
  `CalculationResultsSchema`, `IndustrialTariffsSchema`, the dynamic
  `TariffConfigSchema` (discriminated union of residential/industrial), and
  `IndustrialBassConfigSchema`.
- **Default datasets**: `DEFAULT_TIME_FACTORS` (residential 3-period),
  `INDUSTRIAL_TIME_FACTORS` (4-period), `DEFAULT_CONSUMPTION`, and
  `TARIFF_PRESETS`.
- Re-exports the entire tariff API from `jordanTariffs.ts` so the UI can import
  everything from one place.

### 5.2 `shared/jordanTariffs.ts` — the regulatory engine (the most important file)
This encodes the **Jordan EMRC 2025 Tariff Guide** and **Bylaw 58/2024**. Rates
are stored in **fils/kWh** (1 JD = 1000 fils); JD helpers divide by 1000.

Key pieces:

- **`SectorCode`** — ~28 sector codes across Residential (A1/A2), Commercial
  (B1–B4), Industrial (C1–C4), Hotels (D1–D3), Hospitals (E1/E2), Agriculture
  (F1–F3), and Special (G1–G8). `SECTOR_TO_CLASS` collapses them into coarse
  `CustomerClass` buckets.
- **`SECTOR_TARIFFS`** — the full table. Each sector declares a `pricingModel`:
  - `tiered` (e.g. residential A1: 50/100/200 fils across 300/600/∞ kWh bands),
  - `tou3` (three-period time-of-use: peak/partial/off-peak),
  - `flat`, or `mixed_well` (agriculture).
  Plus optional min-bill, PF-penalty flag, cash subsidies, temporary rate, notes.
- **TOU windows** — `TOU_WINDOWS` (standard EMRC: off-peak 05–14, partial
  14–17 + 23–05, peak 17–23) and `WHEELING_TOU_WINDOWS` (M1 uses different
  windows — off-peak absorbs 14–17).
- **Pricing helpers**: `priceTieredJD`, `priceTOU3JD`, `priceFlatJD`,
  `priceLegacyDayNightJD`, and the dispatcher `priceImportJD` (picks the right
  model per sector, honors temporary rates).
- **Universal add-ons** (`calcUniversalAddOns`): rural electrification fils
  (1 fils/kWh), monthly fuel clause (`FUEL_CLAUSE_FILS_BY_MONTH` — all 0 through
  May 2026), TV fee (residential, 1 JD/mo), meter rent (0.2/0.5 JD by phase),
  GAM municipal fee, waste fee. All charged on **imported** kWh.
- **Minimum bill** (`applyMinimumBillJD`): 1.75 JD residential, 2.0 JD others.
- **Power-factor penalty** (`powerFactorSurchargeJD`): NEPCO §I.1.d, threshold
  0.88, banded surcharge — applies only to sectors flagged `pfPenaltyApplies`
  (C2/C3/C4, F2, D1/D2 TOU).
- **Net-billing / Bylaw 58 logic**:
  - `NetBillingMechanism` type (M1–M5) and `mechanismGenerationCapFraction`
    (M1 = 50%, M2 residential = 100% / non-res = 50%, M3/M4/M5 = 100%).
  - `gridServiceFeeJD` — JD per inverter-kWac per month, sector/mechanism
    dependent (residential 1.0 post-Bylaw vs 2.0 legacy; ~13 JD commercial;
    industrial/agri exempt; M4 & M5 exempt; welfare beneficiaries exempt).
  - `netBillingExportRateJD` — 0.05 JD/kWh residential, 0.04 JD/kWh non-res.
  - `isEligibleForMechanism` — sector × mechanism eligibility matrix returning
    `eligible | ineligible | unclear` (warnings, not hard blocks).
  - `legacyNetMeteringMonthly` (M5) — kWh-for-kWh netting with an ~80% export
    haircut (`LEGACY_EXPORT_HAIRCUT`) and carry-forward.
  - `applyAnnualReset` — year-end credit policy: `forfeit_year_end` (default),
    `rollover_indefinite`, or `cash_out` (the single biggest open regulatory
    question, flagged in comments).
- **PV sizing constants**:
  - `SPECIFIC_YIELD_KWH_PER_KWP_YEAR = 1800` → `..._MONTH = 150`.
  - `DC_AC_RATIO` (1.5 residential, 1.2 others).
  - `RESIDENTIAL_INVERTER_CAP_KWAC` (3.6 kWac single-phase, 10 kWac three-phase)
    + `applyResidentialInverterCap`.
  - `kWpFromKWac` / `kWacFromKWp` / `inverterKWacFromMonthlyKWh`.
  - `losesResidentialSubsidy` — subsidy lost if inverter exceeds the cap.
- **Four-bucket → TOU mappers**: `mapFourBucketToStandardTOU` and
  `mapFourBucketToWheelingTOU` translate the UI's 4 time buckets into the
  3-period TOU the rate tables expect.

### 5.3 `shared/jordanPVDesign.ts` — the PV physics engine
Converts site + system inputs into monthly/annual kWh, on two tiers.

- **`JORDAN_REGIONS`** — 14 governorate/region resource records (lat/lon/elev,
  GHI/DNI/DHI, optimal-tilt GTI, `pvoutFix` specific yield, optimal tilt,
  climate zone, soiling class, mean temp). Data from the Solargis Jordan atlas.
- **`ZONE_MONTHLY_SHARES`** — normalized monthly yield distribution by climate
  zone (N/S/E/V).
- **Equipment libraries** — `MODULE_LIBRARY`, `INVERTER_LIBRARY`,
  `BATTERY_LIBRARY` (Jordan 2026 market) with electrical/thermal specs.
- **Loss-chain defaults** — PR by system type, mounting uplift (fixed/HSAT/
  dual-axis), area-per-kWp, soiling by class and cleaning frequency, monthly
  soiling multipliers (dust storms Mar–May), bifacial gain, albedo, and a
  `clippingLossPct(dcAcRatio)` curve.
- **`quickQuoteYield`** (Tier 1) — shortcut: `annual = dcKWp × PVOUT_fix × PR/0.80`,
  spread to months via the zone shares, with a degradation curve.
- **`calculatePVYield`** (Tier 2) — full loss chain in order: transposition
  (tilt/azimuth) → mounting uplift → gross DC → temperature loss → soiling →
  constant DC losses (mismatch/shading/optical/wiring) → bifacial gain →
  inverter (η × MPPT × clipping × availability) → AC losses (wiring/transformer/
  availability) → year-by-year degradation (LID + linear). Returns a
  `LossBreakdown` waterfall and the monthly kWh vector.
- **Helpers** — `kWpFromRoofArea`, `roofAreaFromKWp`, `recommendBatterySize`
  (per mechanism rule-of-thumb).

---

## 6. The calculation engine in detail (`server/routes.ts` → `/api/calculate`)

This endpoint is the core billing calculation. Step by step:

### 6.1 Validation
The request is validated with Zod. There's a `baseCalculationSchema` (sector,
power factor, add-on toggles, mechanism, inverter, reset policy, PV-design
override, etc.) extended into either a **residential 3-period** schema or an
**industrial 4-period** schema depending on `customer_type`.

### 6.2 Sector resolution & sizing
1. **Sector**: explicit `sector` override wins; otherwise `defaultSectorFor`
   derives it (residential `tariff_supported` → A1 subsidized / A2 unsubsidized).
2. **Target generation X2**: `(annual consumption / 12) × mechanismCapFraction`.
   The cap fraction encodes the regulatory ceiling (e.g. 50% for non-residential
   M2, 100% for residential M2).
3. **Inverter sizing**: `inverterKWacFromMonthlyKWh(X2) / efficiency`, then
   `applyResidentialInverterCap` (3.6/10 kWac). If the cap binds, monthly
   generation is **re-derived** from the capped inverter: `kWp = kWac × DC:AC`,
   `monthlyKWh = kWp × 150 × efficiency`.
4. **PV-design override**: if `monthly_pv_generation_override` (a 12-vector from
   the physics engine) is present, it replaces the heuristic per month.
5. **Advisories**: eligibility status and residential-subsidy-loss flag are
   computed (warnings, not blockers).

### 6.3 Per-month loop
For each month, the engine builds a "before" (no PV) and "after" (with PV) bill.

**`finalizeBill(rawBillJD, importKWh, monthIndex)`** is the shared post-processor:
it adds universal add-ons (on imported kWh), applies the PF surcharge if the
sector allows it and PF < 0.88, then enforces the minimum bill.

**`applyCreditLedger(rawNetBill)`** is the shared net-billing ledger: a negative
net bill (export > import value) generates a credit that accumulates in
`running_credit_balance`; a positive bill draws down available credit first.
This carries forward month to month.

#### Residential branch (tiered, 3-period)
- Consumption split into day/evening/night buckets via the factor maps.
- "Before" bill = `priceImportJD(total_cons)` → `finalizeBill`.
- Generation split via sun factors; self-consumption per bucket is
  `min(generation × pvConsumeFactor, bucketConsumption)`; remainder exports.
- Import = consumption − self-consumption; `import_cost = priceImportJD(import)`.
- Export revenue = `export × effective_export_rate` (0 for M3 zero-export and
  M5 legacy).
- `raw_net_bill = import_cost − export_revenue` → ledger → `finalizeBill`.

> Note: residential is **tiered** (not TOU), so the day/evening/night split only
> affects how much PV is self-consumed vs exported — not the per-kWh rate.

#### Industrial branch (TOU, 4-period)
- Same structure but with 4 buckets (y1–y4) and TOU pricing. The 4 buckets are
  mapped onto the EMRC 3-period TOU via `mapFourBucketToStandardTOU` (or the
  wheeling variant for M1) before `priceImportJD`.
- Self-consumption (k1–k4), export, and import are computed per bucket then
  re-mapped to TOU for pricing.

### 6.4 Year-end adjustments
- **Annual reset**: `applyAnnualReset(running_credit_balance, policy)` — forfeited
  credit increases total cost; cashed-out credit reduces it.
- **Grid service fee**: `gridServiceFeeJD(...) × 12` added to total cost-after
  (sector/mechanism aware; M4/M5/welfare exempt).
- **`annual_savings = total_cost_before − total_cost_after`**.

### 6.5 Output
A `CalculationResults` object: `monthly_data[]` (consumption, generation,
self-consumption, import/export, before/after bills, credits) plus a rich
`annual_summary` (sizing, costs, savings, sector metadata, grid fee, eligibility,
reset accounting, PV-design flag).

### 6.6 NPV endpoint (`/api/calculate-npv`)
Straightforward 25-year (default) DCF: initial `-system_cost`, yearly savings
degraded 0.5%/yr, discounted at `discount_rate`; plus a simplified IRR, payback
(`system_cost / annual_savings`), and LCOE.

---

## 7. Client-side calculator state (`CalculatorLogic.tsx`)

`CalculatorLogic` is a **render-prop component** that owns the entire calculator
state (`CalculatorState`) and exposes `{ state, setState, updateField, calculate,
results, isCalculating }` to its children.

- **`initialState`** seeds everything: default consumption (500 kWh/mo),
  residential 3-period + industrial 4-period factor maps (ported verbatim from
  the PyQt6 originals), industrial tariffs, Buy-All/Sell-All config, the dynamic
  tariff config, and the PV-design state.
- **`updateField`** updates one field and auto-sets the export tariff when the
  customer type changes (0.05 residential / 0.04 industrial).
- **`calculateMutation`** (TanStack Query) is the dispatcher:
  1. If grid connection is **Buy all sell all** → compute locally
     (`calculateBuyAllSellAll`, which forks to an industrial variant). These use
     an "X2 = annual/12" generation approximation, per-period import pricing,
     universal add-ons, min-bill, and a flat export rate.
  2. If **PV Design is enabled** → run `quickQuoteYield`/`calculatePVYield` on
     the client and attach `monthly_pv_generation_override`, `inverter_kwac`,
     and `kwp_dc_override` to the request.
  3. Build the request body (industrial 4-period vs residential 3-period shape),
     attach the resolved `sector` and `net_billing_mechanism`, and
     `POST /api/calculate`.
- **`mechanismFor(gridConnection)`** maps the UI label to the M1–M5 enum.

The local Buy-All/Sell-All path means **two code paths** can price energy —
keep that in mind when reasoning about consistency.

---

## 8. Frontend structure (`client/src`)

- **`App.tsx`** — providers (QueryClient, Tooltip, Theme, Auth) + Wouter routes:
  `/` (protected → `SolarCalculatorApp`), `/auth`, and a 404.
- **`SolarCalculatorApp.tsx`** — the shell: sidebar + header + tabbed content.
  Tabs: `designer`, `pv-design`, `dashboard`, `analysis`, `comparison`, `help`,
  `users` (admin). Wraps everything in `CalculatorLogic` and always mounts the
  print-only `TechnicalReport`.
- **Input components**: `CustomerGridSelection`, `MonthlyConsumptionInputs`,
  `SystemConfiguration`, `TimeParametersSection` (+ `TimeFactorWidget`),
  `PVDesignPanel`.
- **Output components**: `CircularGauge`, `Dashboard`, `BeforeAfterResults`,
  `AnalysisSection`, `ComparisonSection`, `TechnicalReport`, `HelpSection`.
- **`components/ui/*`** — the shadcn/ui primitive library (Radix-based).
- **`lib/`** — `tariffEngine.ts` (client tariff calculators + registry),
  `queryClient.ts` (TanStack Query + `apiRequest`), `protected-route.tsx`,
  `utils.ts`.
- **`hooks/`** — `use-auth.tsx` (auth context), `use-toast`, `use-mobile`.
- **`pages/`** — `auth-page.tsx`, `user-management.tsx`, `not-found.tsx`.

### `lib/tariffEngine.ts` vs `shared/jordanTariffs.ts`
Note there are **two tariff systems**:
- `shared/jordanTariffs.ts` — the authoritative EMRC/Bylaw-58 engine used by the
  server `/api/calculate`.
- `client/src/lib/tariffEngine.ts` — a simpler "dynamic tariff" calculator
  (tiered/flat/4-period TOU classes + a registry/factory). It's used by the
  client Buy-All/Sell-All path and the configurable tariff presets. The two
  overlap conceptually; the server engine is the more complete/canonical one.

---

## 9. Backend infrastructure (`server/`)

- **`app.ts`** — `createApp()`: JSON/urlencoded middleware, a light `/api`
  request logger, `registerRoutes`, and a final error handler.
- **`index.ts`** — local dev entrypoint (Express + Vite middleware on port 5000).
- **`handler.ts`** — Vercel serverless entrypoint (lazy singleton app).
- **`routes.ts`** — all API routes (projects CRUD, `/api/calculate`,
  `/api/calculate-npv`) + `setupAuth`.
- **`storage.ts`** — `MemStorage` (in-memory `Map`s). **No database** in the demo;
  projects do not persist across serverless invocations (intentional).
- **`fakeAuth.ts`** — stateless demo auth (see below).
- **`vite.ts`** — dev Vite middleware + static serving helpers.

### Authentication (`fakeAuth.ts`)
- Three hardcoded demo users: `admin/admin123` (admin), `user/user123`,
  `engineer/engineer123`.
- Login issues a **signed cookie** (`pv_session`): `base64url(payload).base64url(HMAC-SHA256)`,
  verified with `timingSafeEqual`. Fully stateless — no session store, works on
  serverless. Secret from `SESSION_SECRET` env (falls back to a dev default).
- Endpoints: `/api/login`, `/api/demo-login?as=`, `/api/logout`,
  `/api/auth/user`, `/api/user`, `/api/demo-users`, `/api/admin/create-user`
  (admin-only, in-memory).
- `isAuthenticated` middleware + `getCurrentUser` helper guard protected routes.

---

## 10. Key concepts to internalize

1. **Two-stage sizing**: a rough heuristic (`X2 = annual/12 × capFraction`) that
   the optional physics engine can override with a real monthly yield vector.
2. **fils vs JD**: rate tables are in fils/kWh; always `/1000` for JD. The client
   tariff engine uses ¢/kWh in places (`/100`) — watch units when cross-reading.
3. **Mechanism cap fraction** is how the "industrial half-sizing" rule and the
   wheeling 50% rule are enforced — folded into one place.
4. **The credit ledger + annual reset** is the net-billing core; the reset policy
   default (`forfeit_year_end`) is a deliberate, flagged assumption.
5. **Add-ons & min-bill always apply to imported energy** regardless of PV, via
   `finalizeBill`. Export is revenue, not a discount on the energy charge.
6. **Residential = tiered, Industrial = TOU**: the time-bucket split changes
   self-consumption/export for both, but only changes the *rate* for TOU sectors.
7. **Regulatory uncertainty is explicit**: many constants carry source citations
   and "verify before launch" notes (M3 grid fee, annual reset, some TOU rates).

---

## 11. Suggested reading order for study

1. `shared/jordanTariffs.ts` — learn the rate tables and helpers first.
2. `server/routes.ts` (`/api/calculate`) — see how those helpers compose into a
   bill, month by month.
3. `shared/jordanPVDesign.ts` — the physics yield model.
4. `client/src/components/CalculatorLogic.tsx` — how the client assembles a
   request and handles the local Buy-All/Sell-All + PV-design paths.
5. `shared/schema.ts` — the contract/types tying it all together.
6. `CALCULATIONS.md` — the narrative math reference for the formulas above.
7. The UI components (`SolarCalculatorApp.tsx` and the input/output panels).

---

## 12. Notable gaps / things to watch (for a learner)

- **Persistence**: in-memory only; restarting the server loses all projects.
- **Auth**: demo-grade (hardcoded users, default secret) — not production auth.
- **Duplicate tariff logic**: `lib/tariffEngine.ts` (client) vs
  `jordanTariffs.ts` (server) can diverge; the Buy-All/Sell-All path is computed
  client-side and doesn't reuse the server engine.
- **Unit mismatches**: ¢/kWh (client industrial) vs fils/kWh (server) vs JD.
- **Unused legacy schema**: the `users`/`sessions` Drizzle tables reflect the old
  Replit OAuth design and aren't used by the cookie auth.
- **Regulatory placeholders**: several rates/policies are editable defaults
  pending EMRC confirmation (clearly commented in `jordanTariffs.ts`).
