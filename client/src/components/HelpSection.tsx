/**
 * Help & Methodology — ETAP-style documentation browser.
 *
 * Left rail: searchable, grouped topic tree. A dedicated "Calculation Paths"
 * group lets the user pick the grid mechanism (Net Billing / Wheeling / Zero
 * Export / Buy-All-Sell-All / Legacy NEM) and read exactly how that path is
 * computed. Right pane: the selected topic's step-by-step equations, defaults
 * and notes, kept in sync with the live engine (EMRC 2025 / Bylaw 58/2024).
 *
 * Methodology source of truth: CALCULATIONS.md + shared/jordanTariffs.ts,
 * shared/jordanPVDesign.ts, shared/pvElectrical.ts.
 */

import { useMemo, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import {
  BookOpen, Workflow, Ruler, Sun, Grid3x3, Split, Layers,
  Network, Ban, ArrowLeftRight, Repeat, Zap,
  DollarSign, Receipt, Wallet, Gauge,
  PlugZap, Cable, ShieldCheck, TrendingUp, Calculator,
  Settings, FileText, Search, ChevronLeft, ChevronRight,
  type LucideIcon,
} from 'lucide-react';

// ===========================================================================
// Presentational helpers
// ===========================================================================
function Eq({ children }: { children: React.ReactNode }) {
  return (
    <pre className="font-mono text-[13px] leading-relaxed bg-muted/60 border rounded-md p-3 overflow-x-auto whitespace-pre-wrap">
      {children}
    </pre>
  );
}

function Steps({ children }: { children: React.ReactNode }) {
  return <ol className="space-y-3 list-none m-0 p-0">{children}</ol>;
}

function Step({ n, title, children }: { n: number; title: string; children?: React.ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className="flex-none mt-0.5 h-6 w-6 rounded-full bg-primary/15 text-primary text-xs font-bold grid place-items-center">
        {n}
      </span>
      <div className="space-y-2 min-w-0 flex-1">
        <div className="font-medium">{title}</div>
        {children}
      </div>
    </li>
  );
}

type Tone = 'info' | 'warn' | 'ok';
function Callout({ tone = 'info', title, children }: { tone?: Tone; title?: string; children: React.ReactNode }) {
  const map: Record<Tone, string> = {
    info: 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-200',
    warn: 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-200',
    ok: 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800 text-green-700 dark:text-green-200',
  };
  return (
    <div className={`text-sm rounded-lg border p-3 ${map[tone]}`}>
      {title && <div className="font-semibold mb-1">{title}</div>}
      <div className="space-y-1">{children}</div>
    </div>
  );
}

function PTable({ head, rows }: { head: string[]; rows: (string | React.ReactNode)[][] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="border-b text-left text-muted-foreground">
            {head.map((h, i) => (
              <th key={i} className="py-1.5 pr-4 font-medium">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-b last:border-0">
              {r.map((c, j) => (
                <td key={j} className={`py-1.5 pr-4 ${j === 0 ? 'font-medium' : 'font-mono text-[13px]'}`}>{c}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Lead({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-muted-foreground">{children}</p>;
}

// ===========================================================================
// Topic model
// ===========================================================================
interface Topic {
  id: string;
  title: string;
  group: string;
  icon: LucideIcon;
  keywords?: string;
  body: () => JSX.Element;
}

const GROUP_ORDER = [
  'Getting started',
  'System sizing',
  'Energy allocation',
  'Calculation paths',
  'Tariffs & billing',
  'Electrical BoS',
  'Financials',
  'Reference',
] as const;

const TOPICS: Topic[] = [
  // ---- Getting started ----------------------------------------------------
  {
    id: 'overview', group: 'Getting started', icon: Workflow, title: 'How the calculator works',
    keywords: 'pipeline stages overview model',
    body: () => (
      <div className="space-y-4">
        <Lead>
          A deterministic, monthly energy-balance model. Every result is produced by the same
          three-stage pipeline — pick your grid mechanism under <strong>Calculation Paths</strong>
          to see how a specific path runs end to end.
        </Lead>
        <Steps>
          <Step n={1} title="Sizing">
            <Lead>From annual consumption, derive the target monthly PV generation <code>X₂</code> and an approximate inverter rating (or use the PV Design physics engine).</Lead>
          </Step>
          <Step n={2} title="Energy allocation">
            <Lead>For each month, split consumption and PV generation into time-of-use buckets (3 for residential, 4 for industrial), then compute self-consumption, export and import.</Lead>
          </Step>
          <Step n={3} title="Billing & finance">
            <Lead>Price the before/after flows with the resolved EMRC sector tariff, run the Bylaw 58/2024 credit ledger, add universal regulated charges, enforce the minimum bill, apply the power-factor surcharge, deduct credits, then layer the grid-service fee — and finally compute savings, NPV and payback.</Lead>
          </Step>
        </Steps>
        <Eq>{`consumption ─┐
              ├─▶ [1 SIZING] ─▶ X₂, kWp, inverter
PV design ───┘                       │
                                     ▼
            [2 ALLOCATION]  y_i (load) · z_i (PV) · k_i (self-use) · export · import
                                     │
                                     ▼
            [3 BILLING]  tariff → credit ledger → add-ons → min-bill → PF → grid-fee
                                     │
                                     ▼
                         savings · NPV · payback · LCOE`}</Eq>
      </div>
    ),
  },
  {
    id: 'glossary', group: 'Getting started', icon: BookOpen, title: 'Symbols & units',
    keywords: 'notation symbols units legend',
    body: () => (
      <div className="space-y-4">
        <Lead>Energies in kWh, power in kW, currency in JD. Sector rates are stored in fils/kWh (1 JD = 1000 fils).</Lead>
        <PTable
          head={['Symbol', 'Meaning']}
          rows={[
            ['Cₘ', 'consumption in month m (kWh)'],
            ['C_annual', 'Σ Cₘ over 12 months'],
            ['X₂', 'target monthly PV generation (kWh/month)'],
            ['α', 'mechanism generation-cap fraction (see Sizing → X₂)'],
            ['kWp_DC', 'DC array nameplate'],
            ['P_inv', 'inverter rating (kWac)'],
            ['η', 'system efficiency (default 0.95)'],
            ['r', 'DC:AC ratio (1.5 residential / 1.2 other)'],
            ['yᵢ', 'consumption in bucket i'],
            ['zᵢ', 'PV generation in bucket i'],
            ['ρᵢ', 'PV self-consumption factor for bucket i'],
            ['kᵢ', 'self-consumed PV in bucket i = min(zᵢ·ρᵢ, yᵢ)'],
            ['t_exp', 'export tariff (0.05 res / 0.04 non-res JD/kWh)'],
            ['S', 'running net-billing credit balance (JD)'],
            ['F_grid', 'annual grid-service fee (JD)'],
          ]}
        />
      </div>
    ),
  },

  // ---- System sizing ------------------------------------------------------
  {
    id: 'sizing-x2', group: 'System sizing', icon: Ruler, title: 'Target generation X₂',
    keywords: 'x2 sizing cap mechanism fraction annual consumption',
    body: () => (
      <div className="space-y-4">
        <Lead>X₂ is the prosumer's average monthly consumption scaled by the mechanism's generation-cap fraction α.</Lead>
        <Eq>{`C_annual = Σ Cₘ   (m = 1…12)

X₂ = α(mechanism, class) · C_annual / 12`}</Eq>
        <PTable
          head={['Mechanism', 'Residential', 'Non-residential']}
          rows={[
            ['M1 Wheeling (off-site)', 'n/a (excluded)', '50 %'],
            ['M2 Net Billing (on-site)', '100 %', '50 %'],
            ['M3 Zero Export', '100 %', '100 %'],
            ['M4 Buy-All / Sell-All', '100 %', '100 %'],
            ['M5 Legacy Net Metering', '100 %', '100 %'],
          ]}
        />
        <Callout tone="info" title="Monthly shape">
          By default each month gets the same X₂ (flat annual ÷ 12). The <strong>Detailed monthly
          distribution</strong> toggle instead spreads the same annual total by the region's seasonal
          solar curve. When the <strong>PV Design</strong> engine is applied to billing, its
          region × tilt × loss-chain monthly vector overrides both.
        </Callout>
      </div>
    ),
  },
  {
    id: 'sizing-inverter', group: 'System sizing', icon: Calculator, title: 'Inverter sizing & cap',
    keywords: 'inverter kwac dc ac ratio cap residential 3.6 10',
    body: () => (
      <div className="space-y-4">
        <Lead>Derived from the EMRC standard specific yield of 150 kWh/kWp·month (1,800 kWh/kWp·year) and the sector DC:AC ratio.</Lead>
        <Eq>{`kWp_DC = X₂ / 150
P_inv  = (kWp_DC / r) · (1 / η)

r = 1.5 (residential) | 1.2 (other)
η = 0.95 (default)`}</Eq>
        <Callout tone="warn" title="Residential inverter cap (Bylaw 58/2024)">
          Single-phase ≤ <strong>3.6 kWac</strong> (≈ 5.4 kWp DC) · three-phase ≤ <strong>10 kWac</strong> (≈ 15 kWp DC).
          If the cap binds, X₂ is re-derived from the capped inverter: <code>X₂ = P_inv,cap · r · 150 · η</code>.
          Non-residential sectors have no hard kWac cap (constrained by the grid-impact study).
        </Callout>
        <Callout tone="info" title="Subsidy-loss trigger">
          A single-phase residential inverter &gt; 3.6 kWac moves the customer from the subsidized A1
          tariff onto the unsubsidized A2 tariff, regardless of mechanism.
        </Callout>
      </div>
    ),
  },
  {
    id: 'sizing-pvdesign', group: 'System sizing', icon: Sun, title: 'PV Design physics engine',
    keywords: 'pvout tilt azimuth loss chain performance ratio yield region',
    body: () => (
      <div className="space-y-4">
        <Lead>
          The optional PV Design module replaces the consumption-based X₂ with a physics yield from the
          Jordan resource model. Two tiers share one engine.
        </Lead>
        <Steps>
          <Step n={1} title="Resource & geometry">
            <Lead>Start from the region's fixed-tilt PVOUT (kWh/kWp·yr), then apply the tilt/azimuth transposition and the mounting gain (fixed ×1.00 / HSAT ×1.18 / dual-axis ×1.30).</Lead>
          </Step>
          <Step n={2} title="Loss chain">
            <Lead>Apply the multiplicative loss stages: soiling, near/horizon/inter-row shading, temperature, module mismatch & tolerance, LID, spectral/IAM/low-irradiance optical losses, DC + AC + transformer wiring, inverter η_EU & MPPT, availability. Bifacial adds a gain.</Lead>
          </Step>
          <Step n={3} title="Yield">
            <Lead>specific yield = PVOUT × Π(stages); annual = kWp_DC × specific yield; monthly via the zone seasonal-share vector.</Lead>
          </Step>
        </Steps>
        <Callout tone="info" title="Quick Quote vs Detailed">
          Quick Quote uses a single Performance-Ratio shortcut (default 0.78 res-rooftop) instead of the
          full loss chain. Detailed Engineering exposes every factor. Both produce the same
          <code> YieldResult</code> shape, shown under Results → PV Yield.
        </Callout>
      </div>
    ),
  },

  // ---- Energy allocation --------------------------------------------------
  {
    id: 'alloc-residential', group: 'Energy allocation', icon: Grid3x3, title: 'Residential — 3 buckets',
    keywords: 'day evening night factors self consumption residential',
    body: () => (
      <div className="space-y-4">
        <Lead>Consumption x₁ = Cₘ and generation x₂ = X₂ are split into Day / Evening / Night by editable monthly factors.</Lead>
        <Eq>{`yᵢ = x₁ · f_cons[i, m]        (load split)
zᵢ = x₂ · f_gen[i, m]         (PV split)
kᵢ = min(zᵢ · ρᵢ,m , yᵢ)      (self-consumption, capped at load)`}</Eq>
        <PTable
          head={['Bucket', 'Window', 'Default load', 'Default PV self-use ρ']}
          rows={[
            ['Day', '05–17', '30 %', '70 %'],
            ['Evening', '17–23', '30 %', '90 %'],
            ['Night', '23–05', '40 %', '100 %'],
          ]}
        />
        <Callout tone="info">Load factors must sum to 1.0 (100 %) per month.</Callout>
      </div>
    ),
  },
  {
    id: 'alloc-industrial', group: 'Energy allocation', icon: Layers, title: 'Industrial — 4 buckets → TOU',
    keywords: 'industrial four period off peak partial peak mapping tou',
    body: () => (
      <div className="space-y-4">
        <Lead>Industrial inputs keep four monthly fractions. Pricing maps them onto EMRC's 3-period TOU.</Lead>
        <PTable
          head={['Index', 'Period', 'Window']}
          rows={[
            ['1', 'Off-peak', '05–14'],
            ['2', 'Partial (day)', '14–17'],
            ['3', 'Peak', '17–23'],
            ['4', 'Partial (night)', '23–05'],
          ]}
        />
        <Eq>{`Pricing map (4 buckets → 3 TOU periods):
  off-peak ← y₁
  partial  ← y₂ + y₄
  peak     ← y₃`}</Eq>
        <Callout tone="info">Self-consumption, export and import are computed per the four buckets; only the price lookup uses the 3-period mapping.</Callout>
      </div>
    ),
  },
  {
    id: 'alloc-flows', group: 'Energy allocation', icon: Split, title: 'Export, import & self-use',
    keywords: 'export import self consumption residual flows',
    body: () => (
      <div className="space-y-4">
        <Lead>After self-consumption, residual PV is exported and residual demand is imported.</Lead>
        <Eq>{`Exportᵢ = max(0, zᵢ − kᵢ)
Importᵢ = max(0, yᵢ − kᵢ)

Monthly totals:
  Export_m = Σ Exportᵢ
  Import_m = Σ Importᵢ
  SelfCons_m = Σ kᵢ`}</Eq>
      </div>
    ),
  },

  // ---- Calculation paths (the selectable mechanisms) ----------------------
  {
    id: 'path-net-billing', group: 'Calculation paths', icon: Network, title: 'M2 — Net Billing (on-site)',
    keywords: 'net billing m2 on-site default path mechanism',
    body: () => (
      <div className="space-y-4">
        <Callout tone="ok" title="When this path runs">Grid connection = “Net billing”. The default for most prosumers. Cap α: residential 100 %, non-residential 50 %.</Callout>
        <Steps>
          <Step n={1} title="Size">X₂ = α · C_annual/12; derive inverter; apply residential cap if binding.</Step>
          <Step n={2} title="Allocate">Split each month into buckets; compute self-use, export, import.</Step>
          <Step n={3} title="Price import">Raw energy charge T(Import_m) from the resolved sector tariff.</Step>
          <Step n={4} title="Export revenue">
            <Eq>{`R_exp = Export_m · t_exp
t_exp = 0.05 (res) | 0.04 (non-res) JD/kWh`}</Eq>
          </Step>
          <Step n={5} title="Raw bill & credit ledger">
            <Eq>{`B_raw = T(Import_m) − R_exp
→ run the net-billing credit ledger (see Tariffs → Credit ledger)`}</Eq>
          </Step>
          <Step n={6} title="Add-ons, min bill, PF">Layer rural fils, fuel clause, TV fee, meter rent (+optional GAM/waste), enforce the minimum bill, apply any power-factor surcharge.</Step>
          <Step n={7} title="Grid-service fee">Add F_grid = P_inv · r_sector · 12 to the annual after-PV cost.</Step>
        </Steps>
      </div>
    ),
  },
  {
    id: 'path-wheeling', group: 'Calculation paths', icon: ArrowLeftRight, title: 'M1 — Wheeling (off-site)',
    keywords: 'wheeling m1 off-site different tou windows',
    body: () => (
      <div className="space-y-4">
        <Callout tone="warn" title="Eligibility">Small/medium industrial, hotels and agriculture only — residential is excluded (LV only). Cap α = 50 %.</Callout>
        <Lead>Same pipeline as Net Billing, but wheeling uses different TOU windows:</Lead>
        <PTable
          head={['Period', 'Standard EMRC', 'Wheeling (M1)']}
          rows={[
            ['Off-peak', '05–14 (9h)', '05–17 (12h)'],
            ['Partial', '14–17 + 23–05 (9h)', '23–05 (6h)'],
            ['Peak', '17–23 (6h)', '17–23 (6h)'],
          ]}
        />
        <Callout tone="info">The 14:00–17:00 mid-afternoon hours fall in wheeling off-peak, not partial.</Callout>
      </div>
    ),
  },
  {
    id: 'path-zero-export', group: 'Calculation paths', icon: Ban, title: 'M3 — Zero Export',
    keywords: 'zero export m3 battery limiter no revenue',
    body: () => (
      <div className="space-y-4">
        <Callout tone="warn" title="Eligibility">All sectors except banks / “ordinary” / extractive. Export-limiter required; battery allowed. Cap α = 100 %.</Callout>
        <Lead>Identical to Net Billing except export revenue is forced to zero — accidental export is uncompensated.</Lead>
        <Eq>{`R_exp = 0
B_raw = T(Import_m)        (no export offset, no credit accrual)`}</Eq>
      </div>
    ),
  },
  {
    id: 'path-bass', group: 'Calculation paths', icon: Repeat, title: 'M4 — Buy-All / Sell-All',
    keywords: 'buy all sell all m4 bass export everything import everything',
    body: () => (
      <div className="space-y-4">
        <Callout tone="ok" title="When this path runs">Grid connection = “Buy all sell all”. Available to all sectors; the only option for banks / extractive. Computed live in the frontend.</Callout>
        <Lead>All PV generation is sold to the grid and all consumption is bought from it — no on-site self-consumption.</Lead>
        <Steps>
          <Step n={1} title="Generation estimate">
            <Eq>{`X₂ = C_annual / 12     (cap α = 100 %)
generation_m = X₂ ; self-consumption = 0`}</Eq>
          </Step>
          <Step n={2} title="Import cost">Full consumption priced at the sector tariff (+ universal add-ons, min bill).</Step>
          <Step n={3} title="Export revenue">
            <Eq>{`R_exp = X₂ · export_rate
(residential default 0.05 ; industrial configurable)`}</Eq>
          </Step>
          <Step n={4} title="Net monthly cost">
            <Eq>{`Net_m = applyMinBill(import + add-ons) − R_exp
Savings_m = Bill_before − Net_m`}</Eq>
          </Step>
        </Steps>
        <Callout tone="info">Industrial BASS uses the 4-period import schedule (Small: tiered 0.06/0.068; Medium: 0.059/0.069/0.079 by period). Grid-service fee is 0 (exempt).</Callout>
      </div>
    ),
  },
  {
    id: 'path-legacy-nem', group: 'Calculation paths', icon: Zap, title: 'M5 — Legacy Net Metering',
    keywords: 'legacy net metering m5 kwh credit grandfathered haircut',
    body: () => (
      <div className="space-y-4">
        <Callout tone="warn" title="Eligibility">Systems with EMRC/DISCO approval before 1 June 2024. Settled in kWh, not JD.</Callout>
        <Eq>{`creditedExportsKWh = exportsKWh · haircut          (default 0.80)
netKWh = importsKWh − creditedExportsKWh − priorCarryKWh

if netKWh ≥ 0:
    invoiceJD = netKWh · (retailTariff + fuelClause/1000)
    carryKWh  = 0
else:
    invoiceJD = 0
    carryKWh  = −netKWh    (forfeited at year end)`}</Eq>
        <Callout tone="info">Not subject to the new Bylaw 58 grid-service fee.</Callout>
      </div>
    ),
  },

  // ---- Tariffs & billing --------------------------------------------------
  {
    id: 'tariff-residential', group: 'Tariffs & billing', icon: DollarSign, title: 'Residential tariffs (A1/A2)',
    keywords: 'residential tiered subsidized unsubsidized a1 a2 blocks fils',
    body: () => (
      <div className="space-y-4">
        <div>
          <div className="font-medium mb-1">A1 — Subsidized (tiered)</div>
          <PTable head={['Block', 'fils/kWh', 'JD/kWh']} rows={[
            ['1 – 300 kWh', '50', '0.050'],
            ['301 – 600 kWh', '100', '0.100'],
            ['601+ kWh', '200', '0.200'],
          ]} />
          <Lead>Cash subsidies (bill credit): −2.500 JD for 51–200 kWh; −2.000 JD for 201–600 kWh.</Lead>
        </div>
        <div>
          <div className="font-medium mb-1">A2 — Unsubsidized (tiered)</div>
          <PTable head={['Block', 'fils/kWh', 'JD/kWh']} rows={[
            ['1 – 1000 kWh', '120', '0.120'],
            ['1001+ kWh', '150', '0.150'],
          ]} />
        </div>
        <Callout tone="info">Minimum bill 1.750 JD/month. A2 applies when the subsidy-loss trigger fires.</Callout>
      </div>
    ),
  },
  {
    id: 'tariff-industrial', group: 'Tariffs & billing', icon: Gauge, title: 'Industrial tariffs (TOU)',
    keywords: 'industrial c1 c2 c3 c4 tou off peak partial peak fils',
    body: () => (
      <div className="space-y-4">
        <div className="font-medium">C2 Medium — 3-period TOU (default)</div>
        <PTable head={['Period', 'Window', 'fils/kWh']} rows={[
          ['Off-peak', '05–14 (9h)', '59'],
          ['Partial', '14–17 + 23–05 (9h)', '69'],
          ['Peak', '17–23 (6h)', '79'],
        ]} />
        <PTable head={['Sector', 'Pricing (fils/kWh)']} rows={[
          ['C1 Small ≤200 kW', 'tiered 60 (≤10000 kWh) / 68 above — no TOU'],
          ['C3 Large', 'TOU 130 / 120 / 110'],
          ['C4 Extractive', 'TOU 226 / 216 / 206'],
        ]} />
        <Callout tone="info">Minimum bill 2.000 JD/month for all non-residential sectors. Other sectors (commercial, banks, hotels, hospitals, agriculture, government…) resolve to their own EMRC schedule.</Callout>
      </div>
    ),
  },
  {
    id: 'billing-addons', group: 'Tariffs & billing', icon: Receipt, title: 'Add-ons, min bill & PF',
    keywords: 'rural fils fuel clause tv fee meter rent gam waste minimum bill power factor penalty',
    body: () => (
      <div className="space-y-4">
        <Lead>Layered on every bill after the energy charge:</Lead>
        <PTable head={['Add-on', 'Amount']} rows={[
          ['Rural fils', '1 fils/kWh × import kWh'],
          ['Fuel clause', 'monthly fils/kWh × import kWh (0 fils Jan–May 2026)'],
          ['TV fee', '1.000 JD/mo (residential, if enabled)'],
          ['Meter rent', '0.200 (1-ph) / 0.500 (3-ph) JD/mo'],
          ['GAM municipal', '1.667 JD ≤200 kWh, else +0.005 × (kWh−200) — opt in'],
          ['Waste fee', 'Class A 3.000 / B 2.000 / C 1.667 JD/mo — opt in'],
        ]} />
        <Callout tone="info">Electricity is VAT-exempt (no VAT line). Minimum bill: 1.750 JD residential / 2.000 JD non-residential.</Callout>
        <div className="font-medium">Power-factor penalty (NEPCO §I.1.d)</div>
        <Lead>Industrial C2/C3/C4, agriculture F2, hotels D1/D2. Threshold pf = 0.88; default pf 0.90 → no penalty.</Lead>
        <Eq>{`steps = round((0.88 − pf) / 0.01)
PF surcharge = billJD · (pct_per_step · steps) / 100
  0.88 > pf ≥ 0.70 → 0.77 % | 0.70–0.60 → 0.95 %
  0.60–0.50 → 1.20 % | pf < 0.50 → 1.50 %`}</Eq>
      </div>
    ),
  },
  {
    id: 'billing-credit', group: 'Tariffs & billing', icon: Wallet, title: 'Net-billing credit ledger',
    keywords: 'credit ledger carry over balance surplus deficit annual reset forfeit cash out',
    body: () => (
      <div className="space-y-4">
        <Lead>A running balance S (start 0) accrues monthly surpluses and is drawn down by deficits. The customer is never billed below zero.</Lead>
        <Eq>{`B_raw = T(Import_m) − R_exp

if B_raw < 0:            # surplus
    S    ← S + |B_raw|
    B_m  ← 0
else:                    # deficit
    used ← min(S, B_raw)
    S    ← S − used
    B_m  ← B_raw − used`}</Eq>
        <PTable head={['Annual reset policy', 'Behaviour at Dec 31']} rows={[
          ['forfeit_year_end (default)', 'S → 0; forfeited JD adds to cost'],
          ['cash_out', 'DISCO refunds S in JD; S → 0'],
          ['rollover_indefinite', 'S carries into Year 2'],
        ]} />
        <Callout tone="warn">Whether Bylaw 58/2024 forfeits or cashes-out year-end credit is an open question; default is legacy forfeiture.</Callout>
      </div>
    ),
  },
  {
    id: 'billing-gridfee', group: 'Tariffs & billing', icon: PlugZap, title: 'Grid-service fee',
    keywords: 'grid service fee kwac per month bylaw 58',
    body: () => (
      <div className="space-y-4">
        <Eq>{`F_grid = P_inv · r_sector · 12      (JD/year)`}</Eq>
        <PTable head={['Sector / mechanism', 'JD/kWac/month']} rows={[
          ['Residential, application ≥ 1/6/2024', '1.000'],
          ['Residential, legacy (< 1/6/2024)', '2.000'],
          ['Small/medium industrial · agriculture', '0 (exempt)'],
          ['Hotels (~M1 off-site)', '~2.5'],
          ['Commercial / banks / large industrial', '~13'],
          ['M4 Buy-All / Sell-All (any sector)', '0 (exempt)'],
        ]} />
      </div>
    ),
  },

  // ---- Electrical BoS -----------------------------------------------------
  {
    id: 'elec-strings', group: 'Electrical BoS', icon: Network, title: 'String sizing',
    keywords: 'string voc cold vmp hot mppt window modules per string',
    body: () => (
      <div className="space-y-4">
        <Lead>String voltages at temperature extremes (IEC 62548), bounded by the inverter MPPT window and Vdc-max.</Lead>
        <Eq>{`Voc_cold = Voc_STC · (1 + k·(T_min − 25))
Vmp_hot  = Vmp_STC · (1 + k·(T_max,cell − 25))     (k = Voc temp-coeff, negative)

n_max = ⌊ Vdc_max / Voc_cold ⌋
n_min = ⌈ Vmppt_min / Vmp_hot ⌉

strings = round( targetkWp·1000 / (n · Wp) )`}</Eq>
        <Callout tone="info">The design uses the longest valid string within MPPT headroom; per-MPPT current (strings/MPPT × I_mp) is checked against the inverter limit. Defaults: T_min −5 °C, T_cell,max 70 °C.</Callout>
      </div>
    ),
  },
  {
    id: 'elec-cables', group: 'Electrical BoS', icon: Cable, title: 'Cable sizing',
    keywords: 'cable ampacity voltage drop copper cross section',
    body: () => (
      <div className="space-y-4">
        <Lead>Design current = 1.25 × operating current. Pick the smallest copper cross-section whose derated ampacity clears it, then upsize until voltage drop is within limit (≤ 2 % DC, ≤ 1 % AC).</Lead>
        <Eq>{`I_design = 1.25 · I       (DC: I = Isc·parallel strings)
                          (AC: I = kVA/(√3·V) 3-ph | kVA/V 1-ph)

ΔV_DC = Imp · ρ·(2L)/A
ΔV_AC = √3·I·ρ·L/A   (3-ph)  |  2·I·ρ·L/A  (1-ph)
ρ(Cu) = 0.0225 Ω·mm²/m`}</Eq>
      </div>
    ),
  },
  {
    id: 'elec-protection', group: 'Electrical BoS', icon: ShieldCheck, title: 'Protection ratings',
    keywords: 'fuse disconnect breaker iec 62548 r10',
    body: () => (
      <div className="space-y-4">
        <Eq>{`DC string fuse (only at ≥3 parallel strings/MPPT):
    1.5·Isc ≤ I_n ≤ module max-series-fuse   (snap to standard)
DC disconnect: ≥ 1.25 · Isc · strings_per_MPPT
AC breaker:    ≥ 1.25 · I_ac`}</Eq>
        <Callout tone="warn">First-pass sizing — verify against actual datasheets and DISCO connection rules before procurement. Breakers/fuses snap to the IEC R10 set (6…630 A); cables to the IEC cross-section set (1.5…300 mm²).</Callout>
      </div>
    ),
  },

  // ---- Financials ---------------------------------------------------------
  {
    id: 'fin-savings', group: 'Financials', icon: TrendingUp, title: 'Annual savings',
    keywords: 'savings annual grid fee',
    body: () => (
      <div className="space-y-4">
        <Eq>{`S_annual = Σ (Bill_before,m − Bill_after,m) − F_grid`}</Eq>
        <Lead>Monthly savings include export revenue and applied net-billing credit; the annual grid-service fee is subtracted once.</Lead>
      </div>
    ),
  },
  {
    id: 'fin-npv', group: 'Financials', icon: Calculator, title: 'NPV, payback & LCOE',
    keywords: 'npv payback lcoe degradation discount rate',
    body: () => (
      <div className="space-y-4">
        <Eq>{`Degradation:  δ_y = (1 − 0.005)^(y−1)        (y = 1…25)

NPV = −C₀ + Σ_{y=1}^{25}  (S_annual · δ_y) / (1 + d)^y      (d = 5 %)

Payback = C₀ / S_annual          (years)
LCOE    = C₀ / (E_annual · 25)   (E_annual = 12·X₂)`}</Eq>
        <Callout tone="info">Tariffs are held flat across the 25-year horizon; the discount rate alone discounts future savings. LCOE here is the simple (un-discounted) first-pass benchmark.</Callout>
      </div>
    ),
  },

  // ---- Reference ----------------------------------------------------------
  {
    id: 'defaults', group: 'Reference', icon: Settings, title: 'Default parameters',
    keywords: 'defaults assumptions efficiency degradation discount yield ratio',
    body: () => (
      <div className="space-y-4">
        <PTable head={['Quantity', 'Default']} rows={[
          ['System efficiency η', '95 %'],
          ['Specific yield (EMRC)', '150 kWh/kWp·month (1,800/yr)'],
          ['DC:AC ratio', '1.5 residential / 1.2 other'],
          ['Residential inverter cap', '3.6 kWac (1-ph) / 10 kWac (3-ph)'],
          ['Annual degradation', '0.5 %/year'],
          ['Discount rate (NPV)', '5 %/year'],
          ['Project lifetime', '25 years'],
          ['Export tariff', '0.050 res / 0.040 non-res JD/kWh'],
          ['Min bill', '1.750 res / 2.000 non-res JD/mo'],
          ['Power-factor threshold', '0.88 (default pf 0.90)'],
          ['Bylaw 58 grandfathering hinge', '1 June 2024 (approval date)'],
        ]} />
      </div>
    ),
  },
  {
    id: 'sources', group: 'Reference', icon: FileText, title: 'Regulatory sources',
    keywords: 'references emrc nepco bylaw 58 law 12 sources',
    body: () => (
      <div className="space-y-3">
        <ul className="list-disc pl-5 text-sm space-y-1.5">
          <li>EMRC Tariff Guide 2025 (effective 1 January 2025; Arabic prevails).</li>
          <li>NEPCO bilingual schedule.</li>
          <li>Bylaw No. 58 of 2024 (Official Gazette 19 August 2024) — net-billing economics.</li>
          <li>Law No. 12 of 2024 — REEEL amendment establishing the 1 June 2024 grandfathering hinge.</li>
          <li>EMRC Chairman statement (19 August 2024) — residential 3.6 / 10 kWac inverter caps.</li>
          <li>IEC 62548 (PV array protection) · IEC 60364-5-52 (cable ampacity & voltage drop).</li>
        </ul>
        <Callout tone="warn" title="Verify before launch">
          Several per-sector TOU spreads and the M2 credit reset policy are reconstructions/defaults
          pending EMRC primary confirmation. Validate against an actual post-2025 bill before
          commercial use.
        </Callout>
      </div>
    ),
  },
];

// ===========================================================================
// Component
// ===========================================================================
export default function HelpSection() {
  const [activeId, setActiveId] = useState<string>(TOPICS[0].id);
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return TOPICS;
    return TOPICS.filter((t) =>
      (t.title + ' ' + t.group + ' ' + (t.keywords ?? '')).toLowerCase().includes(q),
    );
  }, [query]);

  const grouped = useMemo(() => {
    const map = new Map<string, Topic[]>();
    for (const t of filtered) {
      if (!map.has(t.group)) map.set(t.group, []);
      map.get(t.group)!.push(t);
    }
    return GROUP_ORDER.filter((g) => map.has(g)).map((g) => [g, map.get(g)!] as const);
  }, [filtered]);

  const active = TOPICS.find((t) => t.id === activeId) ?? TOPICS[0];
  const activeIndex = TOPICS.findIndex((t) => t.id === active.id);
  const prev = TOPICS[activeIndex - 1];
  const next = TOPICS[activeIndex + 1];
  const ActiveIcon = active.icon;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <BookOpen className="h-6 w-6 text-primary" />
        <h2 className="text-2xl font-semibold">Help &amp; Methodology</h2>
        <Badge variant="outline">EMRC 2025 · Bylaw 58/2024</Badge>
      </div>

      <div className="grid lg:grid-cols-[300px_1fr] gap-6 items-start">
        {/* ---- Left rail: searchable topic tree ---- */}
        <Card className="lg:sticky lg:top-2">
          <CardContent className="p-3 space-y-3">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search topics…"
                className="pl-8 h-9"
                data-testid="input-help-search"
              />
            </div>
            <nav className="lg:max-h-[calc(100vh-220px)] lg:overflow-y-auto pr-1 space-y-3">
              {grouped.length === 0 && (
                <p className="text-sm text-muted-foreground px-1 py-4">No topics match “{query}”.</p>
              )}
              {grouped.map(([group, topics]) => (
                <div key={group}>
                  <div className="px-2 mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    {group}
                  </div>
                  <div className="space-y-0.5">
                    {topics.map((t) => {
                      const Icon = t.icon;
                      const isActive = t.id === active.id;
                      return (
                        <button
                          key={t.id}
                          onClick={() => setActiveId(t.id)}
                          data-testid={`help-topic-${t.id}`}
                          className={`w-full flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-left transition-colors ${
                            isActive
                              ? 'bg-primary/15 text-primary font-medium'
                              : 'hover:bg-muted text-foreground/80'
                          }`}
                        >
                          <Icon className={`h-4 w-4 flex-none ${isActive ? 'text-primary' : 'text-muted-foreground'}`} />
                          <span className="truncate">{t.title}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </nav>
          </CardContent>
        </Card>

        {/* ---- Right pane: selected topic ---- */}
        <Card>
          <CardContent className="p-6 space-y-5">
            <div className="space-y-1">
              <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {active.group}
              </div>
              <h3 className="text-xl font-semibold flex items-center gap-2">
                <ActiveIcon className="h-5 w-5 text-primary" />
                {active.title}
              </h3>
            </div>
            <Separator />
            <div className="space-y-4">{active.body()}</div>

            <Separator />
            <div className="flex items-center justify-between gap-2">
              <Button
                variant="ghost"
                size="sm"
                disabled={!prev}
                onClick={() => prev && setActiveId(prev.id)}
                className="gap-1"
              >
                <ChevronLeft className="h-4 w-4" />
                <span className="truncate max-w-[40vw]">{prev ? prev.title : ''}</span>
              </Button>
              <Button
                variant="ghost"
                size="sm"
                disabled={!next}
                onClick={() => next && setActiveId(next.id)}
                className="gap-1"
              >
                <span className="truncate max-w-[40vw]">{next ? next.title : ''}</span>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
