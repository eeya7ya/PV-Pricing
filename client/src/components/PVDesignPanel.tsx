/**
 * PV Design — two-tier UI on the same physics engine.
 *
 *   Tier 1 "Quick Quote"         — 5 inputs (region, sizing mode, size,
 *                                  system type, optional PR override).
 *   Tier 2 "Detailed Engineering" — every loss-chain knob exposed.
 *
 * Both tiers produce the same `YieldResult`. When the user toggles
 * "Apply to billing", the monthly kWh from this engine overrides the
 * consumption-based PV generation in the tariff/billing pipeline.
 *
 * Inputs (`PVDesignInputs`) live on the Inputs tab; the Year-1 yield
 * output (`PVDesignResults`) lives under the Results tab. Both read the
 * same `PVDesignState` so there is a single source of truth.
 */

import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sun, Zap, Wrench, Map, Settings, CheckCircle, Building2, Home } from 'lucide-react';

import {
  type JordanRegion,
  type SystemType,
  type MountingType,
  type ModuleTech,
  type CleaningFrequency,
  type SoilingClass,
  type YieldResult,
  type DetailedInputs,
  JORDAN_REGIONS,
  PR_DEFAULTS,
  AREA_PER_KWP,
  SOILING_ANNUAL_PCT,
  quickQuoteYield,
  calculatePVYield,
  defaultDetailedInputs,
  kWpFromRoofArea,
  roofAreaFromKWp,
} from '@shared/jordanPVDesign';

export interface PVDesignState {
  enabled: boolean;
  tier: 'quick' | 'detailed';
  // Tier 1 fields
  region: JordanRegion;
  systemType: SystemType;
  sizingMode: 'kWp' | 'roofArea';
  sizeValue: number;
  prOverride: number | null;
  // Tier 2 — full DetailedInputs (filled from defaults when first switching)
  detailed: DetailedInputs;
}

export function defaultPVDesignState(): PVDesignState {
  const region: JordanRegion = 'amman';
  const systemType: SystemType = 'res-rooftop';
  const dcKWp = 5;
  return {
    enabled: false,
    tier: 'quick',
    region,
    systemType,
    sizingMode: 'kWp',
    sizeValue: dcKWp,
    prOverride: null,
    detailed: defaultDetailedInputs(region, systemType, dcKWp, 5),
  };
}

/** DC nameplate (kWp) implied by the current PV-design inputs, regardless of
 *  tier or sizing mode. Single source of truth for "system size" — the
 *  electrical designer reads this instead of asking for the size again. */
export function pvDesignDcKWp(s: PVDesignState): number {
  if (s.tier === 'detailed') return s.detailed.dcKWp;
  return s.sizingMode === 'kWp'
    ? s.sizeValue
    : kWpFromRoofArea(s.sizeValue, s.systemType);
}

interface Props {
  state: PVDesignState;
  onChange: (s: PVDesignState) => void;
}

/** Compute Year-1 yield live from the current PV-design inputs. */
function yieldFromState(state: PVDesignState): YieldResult {
  if (state.tier === 'quick') {
    return quickQuoteYield({
      region: state.region,
      sizingMode: state.sizingMode,
      sizeValue: state.sizeValue,
      systemType: state.systemType,
      prOverride: state.prOverride ?? undefined,
    });
  }
  return calculatePVYield(state.detailed);
}

// ===========================================================================
// Inputs (Inputs tab)
// ===========================================================================
export function PVDesignInputs({ state, onChange }: Props) {
  const update = (patch: Partial<PVDesignState>) => onChange({ ...state, ...patch });
  const updateDetailed = (patch: Partial<DetailedInputs>) =>
    onChange({ ...state, detailed: { ...state.detailed, ...patch } });

  // When switching tier, sync the detailed inputs from the quick inputs.
  const switchTier = (tier: 'quick' | 'detailed') => {
    if (tier === 'detailed' && state.tier === 'quick') {
      const dcKWp = state.sizingMode === 'kWp'
        ? state.sizeValue
        : kWpFromRoofArea(state.sizeValue, state.systemType);
      // Estimate inverter from DC:AC default (1.5 res, 1.2 others).
      const dcAcDefault = state.systemType === 'res-rooftop' ? 1.5 : 1.2;
      const inverterKWac = dcKWp / dcAcDefault;
      onChange({
        ...state,
        tier,
        detailed: defaultDetailedInputs(state.region, state.systemType, dcKWp, inverterKWac),
      });
    } else {
      update({ tier });
    }
  };

  return (
    <div className="space-y-6">
      {/* ===== Header + tier toggle ===== */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-3">
            <CardTitle className="flex items-center gap-2">
              <Sun className="h-5 w-5 text-amber-500" />
              PV Design — Jordan Resource Model
            </CardTitle>
            <div className="flex items-center gap-3">
              <div className="flex rounded-md border p-1">
                <Button
                  size="sm"
                  variant={state.tier === 'quick' ? 'default' : 'ghost'}
                  onClick={() => switchTier('quick')}
                  data-testid="button-tier-quick"
                  className="gap-2"
                >
                  <Zap className="h-4 w-4" /> Quick Quote
                </Button>
                <Button
                  size="sm"
                  variant={state.tier === 'detailed' ? 'default' : 'ghost'}
                  onClick={() => switchTier('detailed')}
                  data-testid="button-tier-detailed"
                  className="gap-2"
                >
                  <Wrench className="h-4 w-4" /> Detailed Engineering
                </Button>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  id="pv-design-enabled"
                  checked={state.enabled}
                  onCheckedChange={(v) => update({ enabled: !!v })}
                  data-testid="switch-pv-design-enabled"
                />
                <Label htmlFor="pv-design-enabled" className="text-sm">
                  Apply to billing
                </Label>
              </div>
            </div>
          </div>
          <p className="text-sm text-muted-foreground mt-2">
            {state.tier === 'quick'
              ? 'Salesperson-grade quote — 5 inputs, sensible Jordan defaults, one PR knob. See the Year-1 yield under the Results tab.'
              : 'Engineer-grade — every loss-chain factor exposed. Same physics engine. See the Year-1 yield under the Results tab.'}
          </p>
        </CardHeader>
      </Card>

      {state.tier === 'quick' ? <QuickTier state={state} update={update} /> :
        <DetailedTier state={state} updateDetailed={updateDetailed} />}
    </div>
  );
}

// ===========================================================================
// Results (Results tab → PV Yield)
// ===========================================================================
export function PVDesignResults({ state }: { state: PVDesignState }) {
  const [showLossWaterfall, setShowLossWaterfall] = useState(false);
  const result = useMemo(() => yieldFromState(state), [state]);
  const region = JORDAN_REGIONS[state.region];
  const monthLabels = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-green-600" />
            PV Design — Year-1 yield
          </CardTitle>
          <Badge variant={state.enabled ? 'default' : 'outline'} className="text-xs">
            {state.enabled ? 'Applied to billing' : 'Not applied to billing'}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Metric label="Annual energy" value={`${result.annualKWh_year1.toFixed(0)} kWh`} accent />
          <Metric label="Specific yield" value={`${result.specificYield_kWhPerKWpYear.toFixed(0)} kWh/kWp·yr`} />
          <Metric label="Performance Ratio" value={result.performanceRatio.toFixed(3)} />
          <Metric label="DC nameplate" value={`${result.lossBreakdown.dcKWp.toFixed(2)} kWp`} />
        </div>

        <Separator />

        {/* Monthly bars */}
        <div>
          <Label className="text-sm font-medium mb-2 inline-block">
            Monthly kWh — year 1
          </Label>
          <div className="grid grid-cols-12 gap-1 items-end h-24 mt-2">
            {result.monthlyKWh_year1.map((kwh, i) => {
              const max = Math.max(...result.monthlyKWh_year1);
              const pct = max > 0 ? (kwh / max) * 100 : 0;
              return (
                <div key={i} className="flex flex-col items-center gap-1">
                  <div className="w-full flex items-end h-20">
                    <div
                      className="w-full bg-amber-400 rounded-t"
                      style={{ height: `${pct}%` }}
                      title={`${monthLabels[i]}: ${kwh.toFixed(0)} kWh`}
                    />
                  </div>
                  <span className="text-[10px] text-muted-foreground">{monthLabels[i]}</span>
                </div>
              );
            })}
          </div>
          <div className="grid grid-cols-12 gap-1 text-[10px] text-center font-mono text-muted-foreground mt-1">
            {result.monthlyKWh_year1.map((k, i) => (
              <div key={i}>{k.toFixed(0)}</div>
            ))}
          </div>
        </div>

        {/* Sanity check anchor for the region */}
        <div className="text-xs text-muted-foreground border-t pt-3">
          <Map className="h-3 w-3 inline mr-1" />
          <strong>{region.label}</strong> · PVOUT<sub>fix</sub> = {region.pvoutFix} kWh/kWp·yr ·
          tilt<sub>opt</sub> = {region.tiltOpt}° · zone {region.zone} · soiling {region.soilingClass}
          {result.prShortcut && (
            <span className="ml-2 text-amber-700">
              · Tier-1 PR shortcut (loss chain skipped)
            </span>
          )}
        </div>

        {/* Loss waterfall (Tier 2 only) */}
        {!result.prShortcut && (
          <>
            <Separator />
            <div>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setShowLossWaterfall(!showLossWaterfall)}
                className="gap-2"
              >
                <Settings className="h-3 w-3" />
                {showLossWaterfall ? 'Hide' : 'Show'} loss waterfall
              </Button>
              {showLossWaterfall && (
                <table className="w-full text-xs mt-2 border-collapse">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left p-1">Stage</th>
                      <th className="text-right p-1">Energy (kWh)</th>
                      <th className="text-right p-1">Loss / gain</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.lossBreakdown.stages.map((s, i) => (
                      <tr key={i} className="border-b">
                        <td className="p-1">{s.name}</td>
                        <td className="p-1 text-right font-mono">{s.energyKWh.toFixed(0)}</td>
                        <td className="p-1 text-right font-mono">
                          {s.lossPct > 0 ? `−${s.lossPct.toFixed(2)}%` :
                           s.lossPct < 0 ? `+${(-s.lossPct).toFixed(2)}%` : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

// ===========================================================================
// Tier 1 — Quick Quote
// ===========================================================================
function QuickTier({
  state,
  update,
}: {
  state: PVDesignState;
  update: (p: Partial<PVDesignState>) => void;
}) {
  const regionOptions = Object.entries(JORDAN_REGIONS) as [JordanRegion, typeof JORDAN_REGIONS[JordanRegion]][];
  const sysTypeIcons: Record<SystemType, JSX.Element> = {
    'res-rooftop':    <Home className="h-4 w-4" />,
    'com-rooftop':    <Building2 className="h-4 w-4" />,
    'ground-mount':   <Map className="h-4 w-4" />,
    'ground-tracker': <Map className="h-4 w-4" />,
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Quick Quote — 5 inputs</CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* 1. Region */}
        <div className="space-y-2">
          <Label>1. Region</Label>
          <Select
            value={state.region}
            onValueChange={(v) => update({ region: v as JordanRegion })}
          >
            <SelectTrigger data-testid="select-pv-region"><SelectValue /></SelectTrigger>
            <SelectContent>
              {regionOptions.map(([id, r]) => (
                <SelectItem key={id} value={id}>
                  {r.label} — {r.pvoutFix} kWh/kWp·yr
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* 2. System type */}
        <div className="space-y-2">
          <Label>2. System type</Label>
          <div className="grid grid-cols-2 gap-2">
            {(['res-rooftop','com-rooftop','ground-mount','ground-tracker'] as SystemType[]).map(t => (
              <Button
                key={t}
                size="sm"
                variant={state.systemType === t ? 'default' : 'outline'}
                onClick={() => update({ systemType: t, prOverride: null })}
                className="gap-2 justify-start"
              >
                {sysTypeIcons[t]}
                <span className="text-xs">
                  {t === 'res-rooftop' ? 'Residential' :
                   t === 'com-rooftop' ? 'Commercial' :
                   t === 'ground-mount' ? 'Ground fixed' : 'Ground tracker'}
                </span>
              </Button>
            ))}
          </div>
        </div>

        {/* 3. Sizing mode */}
        <div className="space-y-2">
          <Label>3. Sizing mode</Label>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant={state.sizingMode === 'kWp' ? 'default' : 'outline'}
              onClick={() => update({ sizingMode: 'kWp' })}
            >
              kWp DC
            </Button>
            <Button
              size="sm"
              variant={state.sizingMode === 'roofArea' ? 'default' : 'outline'}
              onClick={() => update({ sizingMode: 'roofArea' })}
            >
              Roof area (m²)
            </Button>
          </div>
        </div>

        {/* 4. Size value */}
        <div className="space-y-2">
          <Label>
            4. {state.sizingMode === 'kWp' ? 'System size (kWp DC)' : 'Available roof area (m²)'}
          </Label>
          <Input
            type="number"
            min={0}
            step={state.sizingMode === 'kWp' ? 0.1 : 1}
            value={state.sizeValue}
            onChange={(e) => update({ sizeValue: Number(e.target.value) || 0 })}
            data-testid="input-pv-size"
          />
          {state.sizingMode === 'roofArea' && (
            <p className="text-xs text-muted-foreground">
              {AREA_PER_KWP[state.systemType]} m²/kWp →{' '}
              <strong>{kWpFromRoofArea(state.sizeValue, state.systemType).toFixed(1)} kWp DC</strong>
            </p>
          )}
          {state.sizingMode === 'kWp' && (
            <p className="text-xs text-muted-foreground">
              Required area ≈{' '}
              <strong>{roofAreaFromKWp(state.sizeValue, state.systemType).toFixed(0)} m²</strong>
            </p>
          )}
        </div>

        {/* 5. PR override */}
        <div className="space-y-2 md:col-span-2">
          <div className="flex items-center justify-between">
            <Label>
              5. Performance Ratio (PR) — default {PR_DEFAULTS[state.systemType].toFixed(2)} for{' '}
              {state.systemType}
            </Label>
            <Badge variant="outline" className="font-mono">
              {(state.prOverride ?? PR_DEFAULTS[state.systemType]).toFixed(2)}
            </Badge>
          </div>
          <input
            type="range"
            min={0.70}
            max={0.85}
            step={0.01}
            value={state.prOverride ?? PR_DEFAULTS[state.systemType]}
            onChange={(e) => update({ prOverride: Number(e.target.value) })}
            className="w-full"
            data-testid="input-pv-pr"
          />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>0.70 (dusty, shaded, derated)</span>
            <span>0.85 (clean, MV-connected, well-designed)</span>
          </div>
          {state.prOverride !== null && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => update({ prOverride: null })}
              className="text-xs"
            >
              Reset to default
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ===========================================================================
// Tier 2 — Detailed Engineering
// ===========================================================================
function DetailedTier({
  state,
  updateDetailed,
}: {
  state: PVDesignState;
  updateDetailed: (p: Partial<DetailedInputs>) => void;
}) {
  const d = state.detailed;
  const regionOptions = Object.entries(JORDAN_REGIONS) as [JordanRegion, typeof JORDAN_REGIONS[JordanRegion]][];

  return (
    <div className="space-y-4">
      {/* Site & geometry */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Map className="h-4 w-4" /> A. Site &amp; geometry
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <Field label="Region">
            <Select value={d.region} onValueChange={(v) => updateDetailed({ region: v as JordanRegion })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {regionOptions.map(([id, r]) => (
                  <SelectItem key={id} value={id}>{r.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <NumField label="Tilt (°)" v={d.tilt_deg} step={1} on={(x)=>updateDetailed({tilt_deg:x})} />
          <NumField label="Azimuth (° from S)" v={d.azimuth_deg} step={5} on={(x)=>updateDetailed({azimuth_deg:x})} />
          <Field label="Mounting">
            <Select value={d.mountingType} onValueChange={(v)=>updateDetailed({mountingType: v as MountingType})}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="fixed">Fixed (× 1.00)</SelectItem>
                <SelectItem value="HSAT">HSAT (× 1.18)</SelectItem>
                <SelectItem value="dual-axis">Dual-axis (× 1.30)</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <NumField label="DC nameplate (kWp)" v={d.dcKWp} step={0.5} on={(x)=>updateDetailed({dcKWp:x})} />
          <NumField label="Inverter (kWac)" v={d.inverterKWac} step={0.5} on={(x)=>updateDetailed({inverterKWac:x})} />
        </CardContent>
      </Card>

      {/* Module electrical & thermal */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">B. Module electrical &amp; thermal</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <Field label="Module tech">
            <Select value={d.moduleTech} onValueChange={(v)=>updateDetailed({moduleTech: v as ModuleTech})}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="TOPCon">TOPCon</SelectItem>
                <SelectItem value="mono-PERC">mono-PERC</SelectItem>
                <SelectItem value="HJT">HJT</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <NumField label="T-coeff (%/°C)" v={d.tempCoeffPct} step={0.01} on={(x)=>updateDetailed({tempCoeffPct:x})} />
          <NumField label="NOCT (°C)" v={d.noct_C} step={1} on={(x)=>updateDetailed({noct_C:x})} />
          <NumField label="Module mismatch (%)" v={d.moduleMismatchPct} step={0.1} on={(x)=>updateDetailed({moduleMismatchPct:x})} />
          <NumField label="LID year 1 (%)" v={d.lidPct} step={0.1} on={(x)=>updateDetailed({lidPct:x})} />
          <NumField label="Linear deg (%/yr)" v={d.annualDegradationPct} step={0.05} on={(x)=>updateDetailed({annualDegradationPct:x})} />
          <NumField label="Lifetime (yr)" v={d.lifetimeYears} step={1} on={(x)=>updateDetailed({lifetimeYears:x})} />
          <Field label="Bifacial">
            <Switch checked={d.bifacial} onCheckedChange={(v)=>updateDetailed({bifacial:!!v})} />
          </Field>
          <NumField label="Bifacial gain (%)" v={d.bifacialGainPct} step={0.5} on={(x)=>updateDetailed({bifacialGainPct:x})} />
          <NumField label="Albedo" v={d.albedo} step={0.05} on={(x)=>updateDetailed({albedo:x})} />
        </CardContent>
      </Card>

      {/* Soiling & shading */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">C/D. Soiling &amp; shading</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <Field label="Soiling class">
            <Select value={d.soilingClass} onValueChange={(v)=>updateDetailed({soilingClass: v as SoilingClass})}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {(['low','medium','medium-high','high','very-high'] as SoilingClass[]).map(c => (
                  <SelectItem key={c} value={c}>{c} ({SOILING_ANNUAL_PCT[c]}%/yr)</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Cleaning frequency">
            <Select value={d.cleaningFrequency} onValueChange={(v)=>updateDetailed({cleaningFrequency: v as CleaningFrequency})}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None (×3.0)</SelectItem>
                <SelectItem value="quarterly">Quarterly (×1.7)</SelectItem>
                <SelectItem value="monthly">Monthly (×1.0)</SelectItem>
                <SelectItem value="biweekly">Biweekly (×0.7)</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <NumField label="Soiling annual override (%)" v={d.soilingAnnualPctOverride ?? 0} step={0.5} on={(x)=>updateDetailed({soilingAnnualPctOverride: x || undefined})} />
          <NumField label="Near shading (%)" v={d.nearShadingPct} step={0.5} on={(x)=>updateDetailed({nearShadingPct:x})} />
          <NumField label="Horizon shading (%)" v={d.horizonShadingPct} step={0.5} on={(x)=>updateDetailed({horizonShadingPct:x})} />
          <NumField label="Inter-row shading (%)" v={d.interRowShadingPct} step={0.5} on={(x)=>updateDetailed({interRowShadingPct:x})} />
        </CardContent>
      </Card>

      {/* Inverter & electrical */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">F/G. Inverter, wiring &amp; availability</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <NumField label="Inverter η_EU (%)" v={d.euEfficiencyPct} step={0.1} on={(x)=>updateDetailed({euEfficiencyPct:x})} />
          <NumField label="MPPT η (%)" v={d.mpptEfficiencyPct} step={0.1} on={(x)=>updateDetailed({mpptEfficiencyPct:x})} />
          <NumField label="Inverter availability (%)" v={d.inverterAvailabilityPct} step={0.1} on={(x)=>updateDetailed({inverterAvailabilityPct:x})} />
          <NumField label="DC wiring loss (%)" v={d.dcWiringLossPct} step={0.1} on={(x)=>updateDetailed({dcWiringLossPct:x})} />
          <NumField label="AC LV wiring loss (%)" v={d.acLvWiringLossPct} step={0.1} on={(x)=>updateDetailed({acLvWiringLossPct:x})} />
          <NumField label="MV transformer loss (%)" v={d.mvTransformerLossPct} step={0.1} on={(x)=>updateDetailed({mvTransformerLossPct:x})} />
          <NumField label="PV system availability (%)" v={d.pvAvailabilityPct} step={0.1} on={(x)=>updateDetailed({pvAvailabilityPct:x})} />
          <NumField label="Grid availability (%)" v={d.gridAvailabilityPct} step={0.1} on={(x)=>updateDetailed({gridAvailabilityPct:x})} />
        </CardContent>
      </Card>

      {/* Mismatch & optical */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">H. Mismatch &amp; optical</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <NumField label="Module tolerance (%, neg)" v={d.moduleTolerancePct} step={0.5} on={(x)=>updateDetailed({moduleTolerancePct:x})} />
          <NumField label="Spectrum loss (%)" v={d.spectrumLossPct} step={0.1} on={(x)=>updateDetailed({spectrumLossPct:x})} />
          <NumField label="IAM loss (%)" v={d.iamLossPct} step={0.1} on={(x)=>updateDetailed({iamLossPct:x})} />
          <NumField label="Low-irradiance loss (%)" v={d.lowIrradianceLossPct} step={0.1} on={(x)=>updateDetailed({lowIrradianceLossPct:x})} />
        </CardContent>
      </Card>
    </div>
  );
}

// ===========================================================================
// Small UI helpers
// ===========================================================================

function Metric({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="space-y-1">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`text-lg font-mono ${accent ? 'text-green-700 font-semibold' : ''}`}>
        {value}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      {children}
    </div>
  );
}

function NumField({ label, v, step, on }: { label: string; v: number; step: number; on: (x: number) => void }) {
  return (
    <Field label={label}>
      <Input type="number" step={step} value={v} onChange={(e) => on(Number(e.target.value))} />
    </Field>
  );
}
