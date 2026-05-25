/**
 * Analysis — self-service PV designer.
 *
 * The user picks a module (per-module W_dc at STC) and an inverter (kWac +
 * DC window), and the page computes a buildable string layout, DC/AC cable
 * cross-sections (ampacity + voltage-drop), DC/AC protection ratings, a bill
 * of quantities and a single-line diagram. Pure engine lives in
 * `shared/pvElectrical.ts`; this file is presentation + input wiring only.
 */

import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Cable, Cpu, Gauge, Settings2, AlertTriangle, CircuitBoard, Sun, Zap, ListChecks,
} from 'lucide-react';
import type { CalculationResults } from '@shared/schema';
import { INVERTER_LIBRARY, MODULE_LIBRARY, type InverterRecord } from '@shared/jordanPVDesign';
import {
  designElectrical,
  defaultModuleElectrical,
  type ModuleElectrical,
  type InverterElectrical,
  type ElectricalDesign,
} from '@shared/pvElectrical';

interface AnalysisSectionProps {
  customerType: string;
  gridConnection: string;
  results?: CalculationResults;
  efficiency: number;
  degradation: number;
  tariffSupported: boolean;
  exportTariff: number;
  consumption: any;
  industrialTariffs?: any;
}

/** Build a full electrical spec from a catalogue inverter with typical DC windows. */
function inverterElectrical(rec: InverterRecord): InverterElectrical {
  const onePh = rec.phases === 1;
  const large = rec.kWac >= 50;
  return {
    kWac: rec.kWac,
    phases: rec.phases,
    vdcMaxV: onePh ? 600 : 1100,
    mpptMinV: onePh ? 90 : large ? 200 : 140,
    mpptMaxV: onePh ? 520 : 1000,
    maxDcCurrentPerMpptA: onePh ? 13.5 : large ? 30 : 26,
    mppts: rec.mppts,
    acVoltageV: rec.phases === 3 ? 400 : 230,
  };
}

export default function AnalysisSection({ results }: AnalysisSectionProps) {
  const inverterIds = Object.keys(INVERTER_LIBRARY);
  const moduleIds = Object.keys(MODULE_LIBRARY);

  // ---- design state -------------------------------------------------------
  const [moduleId, setModuleId] = useState<string>('JKM-TN-605');
  const [moduleWp, setModuleWp] = useState<number>(MODULE_LIBRARY['JKM-TN-605'].wp);
  const [inverterId, setInverterId] = useState<string>('HUA-SUN-5KTL');
  const [targetKWp, setTargetKWp] = useState<number>(
    Math.max(1, Number((results?.annual_summary as any)?.kwp_dc) || 5),
  );
  const [dcLen, setDcLen] = useState<number>(30);
  const [acLen, setAcLen] = useState<number>(15);
  const [tMin, setTMin] = useState<number>(-5);
  const [tMaxCell, setTMaxCell] = useState<number>(70);
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Advanced module electrical overrides (seeded from defaults for the Wp).
  const seed = defaultModuleElectrical(moduleWp);
  const [voc, setVoc] = useState<number>(seed.vocStc);
  const [vmp, setVmp] = useState<number>(seed.vmpStc);
  const [isc, setIsc] = useState<number>(Number(seed.iscStc.toFixed(2)));
  const [imp, setImp] = useState<number>(Number(seed.impStc.toFixed(2)));
  const [tcVoc, setTcVoc] = useState<number>(seed.tempCoeffVocPctPerC);
  const [maxFuse, setMaxFuse] = useState<number>(seed.maxSeriesFuseA);

  const applyModulePreset = (id: string) => {
    setModuleId(id);
    const wp = MODULE_LIBRARY[id].wp;
    setModuleWp(wp);
    const s = defaultModuleElectrical(wp);
    setVoc(s.vocStc); setVmp(s.vmpStc);
    setIsc(Number(s.iscStc.toFixed(2))); setImp(Number(s.impStc.toFixed(2)));
    setTcVoc(MODULE_LIBRARY[id].tempCoeffPct);
  };

  const module: ModuleElectrical = {
    wp: moduleWp, vocStc: voc, vmpStc: vmp, iscStc: isc, impStc: imp,
    tempCoeffVocPctPerC: tcVoc, maxSeriesFuseA: maxFuse,
  };
  const inverter = inverterElectrical(INVERTER_LIBRARY[inverterId]);

  const design: ElectricalDesign = useMemo(
    () => designElectrical({
      module, inverter, targetKWpDC: targetKWp,
      site: { tMinC: tMin, tMaxCellC: tMaxCell },
      dcCableLengthM: dcLen, acCableLengthM: acLen,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [moduleWp, voc, vmp, isc, imp, tcVoc, maxFuse, inverterId, targetKWp, tMin, tMaxCell, dcLen, acLen],
  );

  const invRec = INVERTER_LIBRARY[inverterId];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-semibold flex items-center gap-2">
            <CircuitBoard className="h-6 w-6 text-primary" /> PV Self-Design &amp; Electrical BoS
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Size strings, cables and protection from your module and inverter — IEC 62548 / 60364 basis.
          </p>
        </div>
        <Badge variant="outline">Single-line diagram included</Badge>
      </div>

      {/* ===== Inputs ===== */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Module */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Sun className="h-4 w-4 text-amber-500" /> PV Module
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Module preset">
                <Select value={moduleId} onValueChange={applyModulePreset}>
                  <SelectTrigger data-testid="select-module"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {moduleIds.map((id) => (
                      <SelectItem key={id} value={id}>
                        {MODULE_LIBRARY[id].brand} {MODULE_LIBRARY[id].wp} W
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <NumField label="Module W_dc @ STC" v={moduleWp} step={5} on={setModuleWp} testid="input-module-wp" />
            </div>
            <Button size="sm" variant="ghost" onClick={() => setShowAdvanced((s) => !s)} className="gap-2 px-0">
              <Settings2 className="h-3 w-3" /> {showAdvanced ? 'Hide' : 'Show'} module electrical (Voc/Vmp/Isc/Imp)
            </Button>
            {showAdvanced && (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3 pt-1">
                <NumField label="Voc STC (V)" v={voc} step={0.1} on={setVoc} />
                <NumField label="Vmp STC (V)" v={vmp} step={0.1} on={setVmp} />
                <NumField label="Isc STC (A)" v={isc} step={0.1} on={setIsc} />
                <NumField label="Imp STC (A)" v={imp} step={0.1} on={setImp} />
                <NumField label="Voc temp-co (%/°C)" v={tcVoc} step={0.01} on={setTcVoc} />
                <NumField label="Max series fuse (A)" v={maxFuse} step={1} on={setMaxFuse} />
              </div>
            )}
          </CardContent>
        </Card>

        {/* Inverter + sizing */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Cpu className="h-4 w-4 text-primary" /> Inverter &amp; sizing
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Inverter">
                <Select value={inverterId} onValueChange={setInverterId}>
                  <SelectTrigger data-testid="select-inverter"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {inverterIds.map((id) => (
                      <SelectItem key={id} value={id}>
                        {INVERTER_LIBRARY[id].brand} {INVERTER_LIBRARY[id].kWac} kW {INVERTER_LIBRARY[id].phases}Φ
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <NumField label="Target array (kWp DC)" v={targetKWp} step={0.5} on={setTargetKWp} testid="input-target-kwp" />
            </div>
            <div className="text-xs text-muted-foreground font-mono">
              {invRec.kWac} kWac · {invRec.phases}-phase · {inverter.mppts} MPPT ·
              window {inverter.mpptMinV}–{inverter.mpptMaxV} V · Vdc-max {inverter.vdcMaxV} V ·
              {inverter.maxDcCurrentPerMpptA} A/MPPT
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <NumField label="DC run (m)" v={dcLen} step={1} on={setDcLen} />
              <NumField label="AC run (m)" v={acLen} step={1} on={setAcLen} />
              <NumField label="T min (°C)" v={tMin} step={1} on={setTMin} />
              <NumField label="T cell max (°C)" v={tMaxCell} step={1} on={setTMaxCell} />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ===== Warnings ===== */}
      {design.warnings.length > 0 && (
        <Card className="border-amber-300 bg-amber-50 dark:bg-amber-900/20">
          <CardContent className="py-3 space-y-1">
            {design.warnings.map((w, i) => (
              <div key={i} className="flex items-start gap-2 text-sm text-amber-800 dark:text-amber-200">
                <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" /> <span>{w}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* ===== Results ===== */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {/* Strings */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2"><Zap className="h-4 w-4" /> Array layout</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            <KV k="Modules / string" v={`${design.strings.modulesPerString}`} />
            <KV k="Strings" v={`${design.strings.stringCount}`} />
            <KV k="Strings / MPPT" v={`${design.strings.stringsPerMppt}`} />
            <KV k="Total modules" v={`${design.strings.modulesTotal}`} />
            <KV k="Actual size" v={`${design.strings.actualKWpDC.toFixed(2)} kWp`} accent />
            <KV k="DC : AC ratio" v={design.dcAcRatio.toFixed(2)} />
            <Separator className="my-2" />
            <KV k="String Voc (cold)" v={`${design.strings.stringVocColdV.toFixed(0)} V`} />
            <KV k="String Vmp (hot)" v={`${design.strings.stringVmpHotV.toFixed(0)} V`} />
            <KV k="Range allowed" v={`${design.strings.minModulesPerString}–${design.strings.maxModulesPerString}`} />
          </CardContent>
        </Card>

        {/* DC cable */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2"><Cable className="h-4 w-4" /> DC cable</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            <KV k="Cross-section" v={`${design.dcCable.finalSizeMm2} mm²`} accent />
            <KV k="Design current" v={`${design.dcCable.designCurrentA.toFixed(1)} A`} />
            <KV k="Ampacity" v={`${design.dcCable.ampacityA} A`} />
            <KV k="Length (1-way)" v={`${design.dcCable.lengthM} m`} />
            <KV
              k="Voltage drop"
              v={`${design.dcCable.voltageDropPct.toFixed(2)} %`}
              danger={!design.dcCable.withinLimit}
            />
          </CardContent>
        </Card>

        {/* AC cable */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2"><Cable className="h-4 w-4" /> AC cable</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            <KV k="Cross-section" v={`${design.acCable.finalSizeMm2} mm²`} accent />
            <KV k="AC current" v={`${design.protection.acCurrentA.toFixed(1)} A`} />
            <KV k="Design current" v={`${design.acCable.designCurrentA.toFixed(1)} A`} />
            <KV k="Ampacity" v={`${design.acCable.ampacityA} A`} />
            <KV
              k="Voltage drop"
              v={`${design.acCable.voltageDropPct.toFixed(2)} %`}
              danger={!design.acCable.withinLimit}
            />
          </CardContent>
        </Card>

        {/* Protection */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2"><Gauge className="h-4 w-4" /> Protection</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            <KV
              k="DC string fuse"
              v={design.protection.dcStringFuseRequired ? `${design.protection.dcStringFuseA} A` : 'not required'}
            />
            <KV k="DC disconnect" v={`${design.protection.dcDisconnectA} A`} />
            <KV k="AC breaker" v={`${design.protection.acBreakerA} A`} accent />
            <KV k="Phases" v={`${invRec.phases}Φ @ ${inverter.acVoltageV} V`} />
          </CardContent>
        </Card>
      </div>

      {/* ===== Single-line diagram ===== */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <CircuitBoard className="h-4 w-4" /> Single-line diagram
          </CardTitle>
        </CardHeader>
        <CardContent>
          <SingleLineDiagram design={design} inverterLabel={`${invRec.brand} ${invRec.kWac} kW`} acVoltageV={inverter.acVoltageV} phases={invRec.phases} />
        </CardContent>
      </Card>

      {/* ===== Bill of quantities ===== */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <ListChecks className="h-4 w-4" /> Bill of quantities
          </CardTitle>
        </CardHeader>
        <CardContent>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="py-1">Item</th><th className="py-1">Spec</th><th className="py-1 text-right">Qty</th>
              </tr>
            </thead>
            <tbody>
              <BoqRow item="PV modules" spec={`${MODULE_LIBRARY[moduleId]?.brand ?? 'Module'} ${moduleWp} W`} qty={`${design.strings.modulesTotal} pcs`} />
              <BoqRow item="Inverter" spec={`${invRec.brand} ${invRec.kWac} kW ${invRec.phases}Φ`} qty="1 pc" />
              <BoqRow item="DC cable (PV)" spec={`${design.dcCable.finalSizeMm2} mm² solar cable`} qty={`≈ ${(design.dcCable.lengthM * 2 * design.strings.stringsPerMppt * inverter.mppts).toFixed(0)} m`} />
              <BoqRow item="AC cable" spec={`${design.acCable.finalSizeMm2} mm² ${invRec.phases === 3 ? '4/5-core' : '3-core'}`} qty={`≈ ${(design.acCable.lengthM * (invRec.phases === 3 ? 4 : 2)).toFixed(0)} m`} />
              {design.protection.dcStringFuseRequired && (
                <BoqRow item="DC string fuse" spec={`${design.protection.dcStringFuseA} A gPV + holder`} qty={`${design.strings.stringCount * 2} pcs`} />
              )}
              <BoqRow item="DC isolator" spec={`${design.protection.dcDisconnectA} A / ${design.strings.stringVocColdV.toFixed(0)}+ V`} qty="1 pc" />
              <BoqRow item="AC breaker (MCB/MCCB)" spec={`${design.protection.acBreakerA} A ${invRec.phases}P`} qty="1 pc" />
              <BoqRow item="DC SPD" spec="Type 2, PV-rated" qty="1 set" />
              <BoqRow item="AC SPD" spec="Type 2" qty="1 set" />
            </tbody>
          </table>
          <p className="text-xs text-muted-foreground mt-3">
            Sizing basis: string voltages from module Voc/Vmp at {tMin} °C / {tMaxCell} °C cell; cable from 1.25× current
            ampacity then upsized for ≤2 % DC / ≤1 % AC voltage drop (Cu, ρ = 0.0225 Ω·mm²/m); protection per IEC 62548.
            Verify against the actual datasheets and DISCO connection rules before procurement.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

// ===========================================================================
// Single-line diagram (SVG)
// ===========================================================================
function SingleLineDiagram({
  design, inverterLabel, acVoltageV, phases,
}: {
  design: ElectricalDesign;
  inverterLabel: string;
  acVoltageV: number;
  phases: 1 | 3;
}) {
  const s = design.strings;
  // Layout coordinates.
  const boxW = 150, boxH = 70, gap = 70, y = 60;
  const xs = [20, 20 + boxW + gap, 20 + 2 * (boxW + gap), 20 + 3 * (boxW + gap)];
  const cy = y + boxH / 2;
  const width = xs[3] + boxW + 20;

  const connector = (x1: number, x2: number, label: string, sub?: string) => (
    <g>
      <line x1={x1} y1={cy} x2={x2} y2={cy} stroke="currentColor" strokeWidth={2} />
      <text x={(x1 + x2) / 2} y={cy - 10} textAnchor="middle" className="fill-current text-[11px] font-medium">{label}</text>
      {sub && <text x={(x1 + x2) / 2} y={cy + 18} textAnchor="middle" className="fill-current text-[10px] opacity-70">{sub}</text>}
    </g>
  );

  const box = (x: number, title: string, lines: string[], fill: string) => (
    <g>
      <rect x={x} y={y} width={boxW} height={boxH} rx={8} className={fill} stroke="currentColor" strokeWidth={1.5} />
      <text x={x + boxW / 2} y={y + 22} textAnchor="middle" className="fill-current text-[12px] font-semibold">{title}</text>
      {lines.map((l, i) => (
        <text key={i} x={x + boxW / 2} y={y + 40 + i * 14} textAnchor="middle" className="fill-current text-[10px] opacity-80">{l}</text>
      ))}
    </g>
  );

  return (
    <div className="w-full overflow-x-auto">
      <svg viewBox={`0 0 ${width} 170`} className="text-foreground" style={{ minWidth: width }}>
        {/* connectors first (under boxes) */}
        {connector(xs[0] + boxW, xs[1], `DC ${design.dcCable.finalSizeMm2}mm²`, `${s.stringVmpHotV.toFixed(0)}V · ${(design.dcCable.designCurrentA).toFixed(0)}A`)}
        {connector(xs[1] + boxW, xs[2], `AC ${design.acCable.finalSizeMm2}mm²`, `${design.protection.acBreakerA}A breaker`)}
        {connector(xs[2] + boxW, xs[3], 'Meter', 'bi-directional')}

        {/* fuse/isolator marker on DC line */}
        <g>
          <circle cx={(xs[0] + boxW + xs[1]) / 2} cy={cy} r={6} className="fill-background" stroke="currentColor" strokeWidth={1.5} />
          <text x={(xs[0] + boxW + xs[1]) / 2} y={cy + 34} textAnchor="middle" className="fill-current text-[9px] opacity-70">
            {design.protection.dcStringFuseRequired ? `fuse ${design.protection.dcStringFuseA}A + isolator` : `isolator ${design.protection.dcDisconnectA}A`}
          </text>
        </g>

        {box(xs[0], 'PV Array', [`${s.modulesPerString}×${s.stringCount} modules`, `${s.actualKWpDC.toFixed(2)} kWp`], 'fill-amber-100 dark:fill-amber-900/40')}
        {box(xs[1], 'Inverter', [inverterLabel, `${phases}-phase`], 'fill-sky-100 dark:fill-sky-900/40')}
        {box(xs[2], 'Distribution', [`${design.protection.acBreakerA}A MCB`, `${acVoltageV}V ${phases}Φ`], 'fill-slate-100 dark:fill-slate-800/60')}
        {box(xs[3], 'Grid', ['DISCO', 'net-billing'], 'fill-emerald-100 dark:fill-emerald-900/40')}
      </svg>
    </div>
  );
}

// ===========================================================================
// UI helpers
// ===========================================================================
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      {children}
    </div>
  );
}

function NumField({ label, v, step, on, testid }: { label: string; v: number; step: number; on: (x: number) => void; testid?: string }) {
  return (
    <Field label={label}>
      <Input type="number" step={step} value={v} onChange={(e) => on(Number(e.target.value))} data-testid={testid} />
    </Field>
  );
}

function KV({ k, v, accent, danger }: { k: string; v: string; accent?: boolean; danger?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-muted-foreground text-xs">{k}</span>
      <span className={`font-mono text-sm ${danger ? 'text-red-600 font-semibold' : accent ? 'text-green-700 font-semibold' : ''}`}>{v}</span>
    </div>
  );
}

function BoqRow({ item, spec, qty }: { item: string; spec: string; qty: string }) {
  return (
    <tr className="border-b last:border-0">
      <td className="py-1.5 font-medium">{item}</td>
      <td className="py-1.5 text-muted-foreground">{spec}</td>
      <td className="py-1.5 text-right font-mono">{qty}</td>
    </tr>
  );
}
