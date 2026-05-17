/**
 * Load Profile Panel — makes the load TOU assumption visible and editable.
 *
 * The accuracy of every billing calculation depends on HOW the user's
 * monthly consumption gets split across the EMRC TOU buckets
 * (off-peak 05–14 / partial 14–17 + 23–05 / peak 17–23). Without
 * smart-meter data we can't know the true split, so we ship a
 * sector-typical default and let the user correct it with knowledge of
 * their actual usage pattern (night-shift worker, work-from-home,
 * commuter, vacation home, etc.).
 *
 * This panel:
 *   1. Shows the current load TOU split (assumed or overridden)
 *   2. Lets the user pick a preset that matches their household
 *   3. Lets the user fine-tune each share manually
 *   4. Shows the PV TOU split side-by-side
 *   5. Visualises the overlap (= self-consumption) so the user can see
 *      WHY their savings are what they are
 */

import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Clock, Sun, Home, Briefcase, Plane, Moon, Building2, Factory, Hotel, Hospital, Sprout, RotateCcw } from 'lucide-react';

import {
  loadTOUFor,
  pvTOUFor,
  type TOUShares,
  type JordanRegion,
  JORDAN_REGIONS,
} from '@shared/jordanPVDesign';

// ===========================================================================
// Preset library — sector-class × usage-pattern combinations
// ===========================================================================

interface Preset {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  shares: TOUShares;
  description: string;
}

const RESIDENTIAL_PRESETS: Preset[] = [
  {
    id: 'res-typical',
    label: 'Typical household',
    icon: Home,
    shares: { offPeak: 0.30, partial: 0.25, peak: 0.45 },
    description: 'AC + cooking + lighting concentrated 17–23. Most Jordan homes.',
  },
  {
    id: 'res-wfh',
    label: 'Work from home',
    icon: Briefcase,
    shares: { offPeak: 0.40, partial: 0.30, peak: 0.30 },
    description: 'Daytime AC + computer + appliances. Higher midday load.',
  },
  {
    id: 'res-commuter',
    label: 'Empty by day (commuter)',
    icon: Briefcase,
    shares: { offPeak: 0.15, partial: 0.20, peak: 0.65 },
    description: 'Nobody home 8–17. Almost all load in evening.',
  },
  {
    id: 'res-nightshift',
    label: 'Night-shift worker',
    icon: Moon,
    shares: { offPeak: 0.20, partial: 0.45, peak: 0.35 },
    description: 'Active 14–05, sleeping 06–13. Heavy partial-window load.',
  },
  {
    id: 'res-vacation',
    label: 'Vacation / holiday home',
    icon: Plane,
    shares: { offPeak: 0.45, partial: 0.30, peak: 0.25 },
    description: 'Mostly daytime occupancy, lighter evenings.',
  },
  {
    id: 'res-summer-ac',
    label: 'AC-heavy (summer)',
    icon: Sun,
    shares: { offPeak: 0.25, partial: 0.25, peak: 0.50 },
    description: 'Heavy A/C 14–23 in Amman/Aqaba summers.',
  },
];

const COMMERCIAL_PRESETS: Preset[] = [
  {
    id: 'com-office',
    label: 'Office hours (8–17)',
    icon: Briefcase,
    shares: { offPeak: 0.55, partial: 0.30, peak: 0.15 },
    description: 'Standard B1 office building. Closed evenings.',
  },
  {
    id: 'com-retail',
    label: 'Retail / restaurant',
    icon: Building2,
    shares: { offPeak: 0.25, partial: 0.30, peak: 0.45 },
    description: 'Open until 22–23. Evening-heavy.',
  },
  {
    id: 'com-24-7',
    label: '24/7 operation',
    icon: Clock,
    shares: { offPeak: 0.34, partial: 0.33, peak: 0.33 },
    description: 'Telecom, data centre, convenience store.',
  },
];

const INDUSTRIAL_PRESETS: Preset[] = [
  {
    id: 'ind-day-shift',
    label: 'Single day shift',
    icon: Factory,
    shares: { offPeak: 0.55, partial: 0.30, peak: 0.15 },
    description: 'One shift 7–16 or 8–17.',
  },
  {
    id: 'ind-two-shift',
    label: 'Two shifts (6–22)',
    icon: Factory,
    shares: { offPeak: 0.40, partial: 0.30, peak: 0.30 },
    description: 'Day + evening production.',
  },
  {
    id: 'ind-24-7',
    label: '24/7 continuous',
    icon: Clock,
    shares: { offPeak: 0.34, partial: 0.33, peak: 0.33 },
    description: 'Three shifts, continuous process.',
  },
];

const HOTEL_PRESETS: Preset[] = [
  {
    id: 'hot-typical',
    label: 'Typical hotel',
    icon: Hotel,
    shares: { offPeak: 0.30, partial: 0.30, peak: 0.40 },
    description: 'Guest check-in + dining + AC 17–23.',
  },
  {
    id: 'hot-resort',
    label: 'Resort (high day pool / spa)',
    icon: Sun,
    shares: { offPeak: 0.40, partial: 0.30, peak: 0.30 },
    description: 'Heavy daytime use (pool pumps, spa, day activities).',
  },
];

const AGRI_PRESETS: Preset[] = [
  {
    id: 'agri-day-pump',
    label: 'Daytime irrigation',
    icon: Sun,
    shares: { offPeak: 0.65, partial: 0.25, peak: 0.10 },
    description: 'Pumps run mostly 06–14 when staff present.',
  },
  {
    id: 'agri-night-pump',
    label: 'Off-peak night irrigation',
    icon: Moon,
    shares: { offPeak: 0.20, partial: 0.40, peak: 0.40 },
    description: 'Shifted to avoid daytime peak demand.',
  },
];

const HOSPITAL_PRESETS: Preset[] = [
  {
    id: 'hosp-24-7',
    label: '24/7 hospital',
    icon: Hospital,
    shares: { offPeak: 0.36, partial: 0.32, peak: 0.32 },
    description: 'Slight daytime peak (surgeries, outpatient).',
  },
];

export function presetsForCustomerType(customerType: string): Preset[] {
  switch (customerType) {
    case 'Residential': return RESIDENTIAL_PRESETS;
    case 'Commercial':  return COMMERCIAL_PRESETS;
    case 'Industrial':  return INDUSTRIAL_PRESETS;
    case 'Hotels':      return HOTEL_PRESETS;
    case 'Hospitals':   return HOSPITAL_PRESETS;
    case 'Agriculture': return AGRI_PRESETS;
    default:            return RESIDENTIAL_PRESETS;
  }
}

// ===========================================================================
// Panel
// ===========================================================================

interface Props {
  customerType: string;
  sector: string; // resolved sector code (for default lookup)
  region: JordanRegion;
  mechanism: string;
  monthlyConsumptionAvg: number;
  monthlyPVAvg: number;
  loadTOUOverride: TOUShares | null;
  onLoadTOUChange: (s: TOUShares | null) => void;
}

export default function LoadProfilePanel({
  customerType,
  sector,
  region,
  mechanism,
  monthlyConsumptionAvg,
  monthlyPVAvg,
  loadTOUOverride,
  onLoadTOUChange,
}: Props) {
  const presets = presetsForCustomerType(customerType);
  const defaultLoad = loadTOUFor(sector);
  const loadTOU = loadTOUOverride ?? defaultLoad;
  const zone = JORDAN_REGIONS[region].zone;
  const pvTOU = pvTOUFor(zone, mechanism);

  // Match current shares to a preset for highlighting
  const matchedPresetId = useMemo(() => {
    const eq = (a: number, b: number) => Math.abs(a - b) < 0.005;
    return presets.find(p =>
      eq(p.shares.offPeak, loadTOU.offPeak) &&
      eq(p.shares.partial, loadTOU.partial) &&
      eq(p.shares.peak, loadTOU.peak),
    )?.id ?? null;
  }, [presets, loadTOU]);

  // Kilowatt-hours per bucket from the user's average month
  const Lp = monthlyConsumptionAvg * loadTOU.peak;
  const La = monthlyConsumptionAvg * loadTOU.partial;
  const Lo = monthlyConsumptionAvg * loadTOU.offPeak;
  const Gp = monthlyPVAvg * pvTOU.peak;
  const Ga = monthlyPVAvg * pvTOU.partial;
  const Go = monthlyPVAvg * pvTOU.offPeak;
  const SCp = Math.min(Gp, Lp);
  const SCa = Math.min(Ga, La);
  const SCo = Math.min(Go, Lo);
  const totalSC = SCp + SCa + SCo;
  const scPct = monthlyPVAvg > 0 ? (totalSC / monthlyPVAvg) * 100 : 0;
  const ssPct = monthlyConsumptionAvg > 0 ? (totalSC / monthlyConsumptionAvg) * 100 : 0;

  // Bar max for visualization scaling
  const barMax = Math.max(Lp, La, Lo, Gp, Ga, Go, 1);

  // Adjust a single share — the other two re-normalise proportionally
  const adjustShare = (bucket: keyof TOUShares, value: number) => {
    const clamped = Math.max(0, Math.min(1, value));
    const others = (Object.keys(loadTOU) as (keyof TOUShares)[]).filter(k => k !== bucket);
    const remaining = 1 - clamped;
    const othersSum = others.reduce((s, k) => s + loadTOU[k], 0);
    const next: TOUShares = { ...loadTOU, [bucket]: clamped };
    if (othersSum > 0) {
      others.forEach(k => {
        next[k] = (loadTOU[k] / othersSum) * remaining;
      });
    } else {
      others.forEach(k => { next[k] = remaining / others.length; });
    }
    onLoadTOUChange(next);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-blue-500" />
            When do you use electricity?
          </CardTitle>
          {loadTOUOverride && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => onLoadTOUChange(null)}
              className="gap-2"
              data-testid="button-reset-load-tou"
            >
              <RotateCcw className="h-3 w-3" />
              Reset to {customerType.toLowerCase()} default
            </Button>
          )}
        </div>
        <p className="text-sm text-muted-foreground">
          Self-consumption (and therefore your savings) depends on WHEN you use power vs WHEN the sun shines.
          Pick the pattern that matches your household / business, or adjust the shares manually.
        </p>
      </CardHeader>
      <CardContent className="space-y-6">

        {/* ====== Preset row ====== */}
        <div>
          <Label className="text-sm font-medium mb-2 inline-block">Usage pattern</Label>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {presets.map(p => {
              const Icon = p.icon;
              const active = matchedPresetId === p.id;
              return (
                <Button
                  key={p.id}
                  variant={active ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => onLoadTOUChange(p.shares)}
                  className="h-auto flex flex-col items-start gap-1 p-3 text-left"
                  data-testid={`button-preset-${p.id}`}
                >
                  <div className="flex items-center gap-2 w-full">
                    <Icon className="h-4 w-4 shrink-0" />
                    <span className="font-medium text-xs flex-1">{p.label}</span>
                    {active && <Badge variant="secondary" className="text-[10px]">active</Badge>}
                  </div>
                  <span className="text-[10px] text-muted-foreground font-normal whitespace-normal leading-snug">
                    {p.description}
                  </span>
                </Button>
              );
            })}
          </div>
        </div>

        <Separator />

        {/* ====== TOU share editor — 3 sliders ====== */}
        <div className="space-y-4">
          <Label className="text-sm font-medium">Or adjust the shares directly:</Label>
          {(['offPeak', 'partial', 'peak'] as const).map(bucket => {
            const meta = {
              offPeak: { label: 'Off-peak', window: '05:00 – 14:00 (9 h)',  hint: 'Morning + early afternoon' },
              partial: { label: 'Partial',  window: '14:00 – 17:00 + 23:00 – 05:00 (9 h)', hint: 'Mid-afternoon + overnight' },
              peak:    { label: 'Peak',     window: '17:00 – 23:00 (6 h)',  hint: 'Evening — most expensive on TOU tariffs' },
            }[bucket];
            const pct = loadTOU[bucket] * 100;
            const kwh = monthlyConsumptionAvg * loadTOU[bucket];
            return (
              <div key={bucket}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium">{meta.label}</span>
                  <span className="text-xs text-muted-foreground">{meta.window}</span>
                  <Badge variant="outline" className="font-mono">
                    {pct.toFixed(0)}% · {kwh.toFixed(0)} kWh/mo
                  </Badge>
                </div>
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={1}
                  value={pct}
                  onChange={(e) => adjustShare(bucket, Number(e.target.value) / 100)}
                  className="w-full"
                  data-testid={`slider-load-${bucket}`}
                />
                <p className="text-[10px] text-muted-foreground mt-1">{meta.hint}</p>
              </div>
            );
          })}
        </div>

        <Separator />

        {/* ====== Overlap visualisation ====== */}
        <div>
          <Label className="text-sm font-medium mb-2 inline-block">
            <Sun className="h-3 w-3 inline mr-1 text-amber-500" />
            Overlap forecast (typical month)
          </Label>
          <p className="text-xs text-muted-foreground mb-3">
            The orange overlap is what your PV directly covers
            (<strong>self-consumption</strong> = min of generation and load in each bucket).
            Anything above is grid import; PV excess is exported.
          </p>

          <div className="grid grid-cols-3 gap-4">
            {(['offPeak', 'partial', 'peak'] as const).map(bucket => {
              const L = bucket === 'peak' ? Lp : bucket === 'partial' ? La : Lo;
              const G = bucket === 'peak' ? Gp : bucket === 'partial' ? Ga : Go;
              const SC = Math.min(L, G);
              const meta = {
                offPeak: { label: 'Off-peak\n05–14', color: 'bg-slate-400' },
                partial: { label: 'Partial\n14–17 / 23–05', color: 'bg-blue-400' },
                peak:    { label: 'Peak\n17–23', color: 'bg-red-400' },
              }[bucket];

              return (
                <div key={bucket} className="flex flex-col items-center">
                  <div className="text-xs text-center whitespace-pre-line text-muted-foreground mb-2 leading-tight">
                    {meta.label}
                  </div>
                  <div className="flex items-end gap-1 h-32 w-full">
                    {/* Load bar */}
                    <div className="flex-1 relative flex flex-col justify-end" title={`Load: ${L.toFixed(0)} kWh`}>
                      <div className="relative w-full" style={{ height: `${(L / barMax) * 100}%` }}>
                        <div className="absolute inset-0 bg-slate-500 rounded-t" />
                        {/* self-consumption overlay */}
                        <div
                          className="absolute left-0 right-0 bottom-0 bg-amber-500 rounded-t"
                          style={{ height: `${(SC / L) * 100}%` }}
                        />
                      </div>
                      <div className="text-[10px] text-center mt-1 font-mono">{L.toFixed(0)}</div>
                      <div className="text-[9px] text-center text-muted-foreground">Load</div>
                    </div>
                    {/* PV bar */}
                    <div className="flex-1 relative flex flex-col justify-end" title={`PV gen: ${G.toFixed(0)} kWh`}>
                      <div
                        className="relative w-full bg-amber-300 rounded-t"
                        style={{ height: `${(G / barMax) * 100}%` }}
                      />
                      <div className="text-[10px] text-center mt-1 font-mono">{G.toFixed(0)}</div>
                      <div className="text-[9px] text-center text-muted-foreground">PV</div>
                    </div>
                  </div>
                  <div className="text-[10px] text-center mt-2 font-medium text-amber-700">
                    SC: {SC.toFixed(0)} kWh
                  </div>
                </div>
              );
            })}
          </div>

          {/* Headline metrics */}
          <div className="grid grid-cols-3 gap-2 mt-4 text-center">
            <Stat label="Self-consumed" value={`${totalSC.toFixed(0)} kWh`} hint={`${scPct.toFixed(0)}% of generation`} />
            <Stat label="Exported to grid" value={`${Math.max(0, monthlyPVAvg - totalSC).toFixed(0)} kWh`} hint={`${(100 - scPct).toFixed(0)}% of generation`} />
            <Stat label="Self-sufficiency" value={`${ssPct.toFixed(0)}%`} hint="of your demand" />
          </div>
        </div>

        <Separator />

        {/* ====== PV split (read-only, from region) ====== */}
        <div className="text-xs text-muted-foreground space-y-1">
          <div className="flex items-center gap-2">
            <Sun className="h-3 w-3 text-amber-500" />
            <strong>PV generation split for {JORDAN_REGIONS[region].label}</strong>
            (zone {zone}, {mechanism === 'M1_net_value_offsite' ? 'wheeling windows' : 'standard windows'}):
          </div>
          <div className="font-mono pl-5">
            off-peak {(pvTOU.offPeak * 100).toFixed(0)}% ·
            partial {(pvTOU.partial * 100).toFixed(0)}% ·
            peak {(pvTOU.peak * 100).toFixed(0)}%
          </div>
          <div className="pl-5 italic">
            Derived from the sun's diurnal pattern (sunrise ≈ 06, sunset ≈ 18, peak production 10–14).
            This is physics — not assumed — so you can't override it. The load split above IS your knob.
          </div>
        </div>

      </CardContent>
    </Card>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="rounded border p-2">
      <div className="text-[10px] text-muted-foreground uppercase tracking-wide">{label}</div>
      <div className="text-base font-semibold font-mono">{value}</div>
      <div className="text-[10px] text-muted-foreground">{hint}</div>
    </div>
  );
}
