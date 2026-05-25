/**
 * PV balance-of-system electrical sizing.
 *
 * Pure, dependency-free functions that turn a module + inverter selection
 * into a buildable string layout, DC/AC cable cross-sections (ampacity +
 * voltage-drop checked) and DC/AC protection ratings. The reference basis is
 * IEC 60364-7-712 / IEC 62548 (PV array protection) and IEC 60364-5-52
 * (cable ampacity & voltage drop). All assumptions are surfaced as inputs so
 * an engineer can override them; the defaults target a Jordan rooftop/ground
 * install (cold morning ≈ −5 °C, hot cell ≈ 70 °C).
 *
 * Everything here is deterministic and unit-tested by construction: SI units
 * throughout (V, A, mm², m, W) unless a field name says otherwise.
 */

// ---------------------------------------------------------------------------
// Standard component sizes
// ---------------------------------------------------------------------------

/** IEC copper conductor cross-sections (mm²). */
export const CABLE_SIZES_MM2 = [
  1.5, 2.5, 4, 6, 10, 16, 25, 35, 50, 70, 95, 120, 150, 185, 240, 300,
] as const;

/** Standard breaker / fuse current ratings (A) — IEC 60898 / 60269 R10-ish. */
export const STANDARD_BREAKER_A = [
  6, 10, 13, 16, 20, 25, 32, 40, 50, 63, 80, 100, 125, 160, 200, 250, 315, 400, 500, 630,
] as const;

/**
 * Copper conductor ampacity (A) — single conservative column roughly matching
 * IEC 60364-5-52 reference method C (clipped to surface / in conduit, 30 °C
 * ambient, 2–3 loaded cores). PV DC string cable in free air carries more,
 * but using the AC column keeps the sizing conservative for both.
 */
export const COPPER_AMPACITY_A: Record<number, number> = {
  1.5: 18, 2.5: 25, 4: 34, 6: 43, 10: 60, 16: 80, 25: 101, 35: 126,
  50: 153, 70: 196, 95: 238, 120: 276, 150: 319, 185: 364, 240: 430, 300: 497,
};

/** Copper resistivity at operating temperature (Ω·mm²/m), ~70–90 °C. */
export const COPPER_RHO_OHM_MM2_PER_M = 0.0225;

// ---------------------------------------------------------------------------
// Inputs
// ---------------------------------------------------------------------------

export interface ModuleElectrical {
  /** Nameplate DC power at STC (W). */
  wp: number;
  /** Open-circuit voltage at STC (V). */
  vocStc: number;
  /** Voltage at max power at STC (V). */
  vmpStc: number;
  /** Short-circuit current at STC (A). */
  iscStc: number;
  /** Current at max power at STC (A). */
  impStc: number;
  /** Temperature coefficient of Voc (%/°C, negative, e.g. −0.25). */
  tempCoeffVocPctPerC: number;
  /** Max series fuse rating printed on the module datasheet (A). */
  maxSeriesFuseA: number;
}

export interface InverterElectrical {
  /** AC nameplate (kW). */
  kWac: number;
  phases: 1 | 3;
  /** MPPT tracking window lower bound (V). */
  mpptMinV: number;
  /** MPPT tracking window upper bound (V). */
  mpptMaxV: number;
  /** Absolute maximum DC input voltage — never exceed (V). */
  vdcMaxV: number;
  /** Max usable DC input current per MPPT (A). */
  maxDcCurrentPerMpptA: number;
  /** Number of independent MPPT trackers. */
  mppts: number;
  /** AC connection voltage: 230 (1-ph L-N) or 400 (3-ph L-L). */
  acVoltageV: number;
}

export interface SiteTemps {
  /** Coldest expected cell temperature → highest Voc (°C). */
  tMinC: number;
  /** Hottest expected cell temperature → lowest Vmp (°C). */
  tMaxCellC: number;
}

export const DEFAULT_SITE_TEMPS: SiteTemps = { tMinC: -5, tMaxCellC: 70 };

export interface ElectricalDesignInput {
  module: ModuleElectrical;
  inverter: InverterElectrical;
  /** Target DC array size (kWp). Drives string/array count. */
  targetKWpDC: number;
  site?: SiteTemps;
  /** Power factor used for AC current (default 1.0 for unity PV inverter). */
  powerFactor?: number;
  /** One-way DC cable run, array → inverter (m). */
  dcCableLengthM?: number;
  /** One-way AC cable run, inverter → point of connection (m). */
  acCableLengthM?: number;
  /** Allowed DC voltage drop (% of string Vmp). IEC guidance ≤ 3 %. */
  dcVdropLimitPct?: number;
  /** Allowed AC voltage drop (% of nominal). IEC guidance ≤ 1–3 %. */
  acVdropLimitPct?: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function nextStandard(value: number, table: readonly number[]): number {
  for (const s of table) if (s >= value) return s;
  return table[table.length - 1];
}

/** Smallest cable whose derated ampacity ≥ required current. */
function cableForAmpacity(requiredA: number): number {
  for (const a of CABLE_SIZES_MM2) {
    if (COPPER_AMPACITY_A[a] >= requiredA) return a;
  }
  return CABLE_SIZES_MM2[CABLE_SIZES_MM2.length - 1];
}

// ---------------------------------------------------------------------------
// Results
// ---------------------------------------------------------------------------

export interface StringSizing {
  vocColdPerModuleV: number;
  vmpHotPerModuleV: number;
  maxModulesPerString: number;
  minModulesPerString: number;
  modulesPerString: number;
  stringCount: number;
  modulesTotal: number;
  actualKWpDC: number;
  stringVocColdV: number;
  stringVmpHotV: number;
  stringsPerMppt: number;
  mpptCurrentOkay: boolean;
  warnings: string[];
}

export interface CableResult {
  designCurrentA: number;
  sizeMm2: number;
  ampacityA: number;
  lengthM: number;
  voltageDropPct: number;
  voltageDropV: number;
  withinLimit: boolean;
  /** Size after upsizing for voltage-drop, if ampacity pick was too small. */
  finalSizeMm2: number;
}

export interface ProtectionResult {
  dcStringFuseA: number | null; // null when ≤2 strings/MPPT → fuse not required
  dcStringFuseRequired: boolean;
  dcDisconnectA: number;
  acBreakerA: number;
  acCurrentA: number;
}

export interface ElectricalDesign {
  strings: StringSizing;
  dcCable: CableResult;
  acCable: CableResult;
  protection: ProtectionResult;
  dcAcRatio: number;
  warnings: string[];
}

// ---------------------------------------------------------------------------
// String / array sizing
// ---------------------------------------------------------------------------

export function sizeStrings(
  module: ModuleElectrical,
  inverter: InverterElectrical,
  targetKWpDC: number,
  site: SiteTemps = DEFAULT_SITE_TEMPS,
): StringSizing {
  const warnings: string[] = [];
  const k = module.tempCoeffVocPctPerC / 100;

  // Cold morning lifts Voc above STC (coeff is negative, ΔT negative).
  const vocCold = module.vocStc * (1 + k * (site.tMinC - 25));
  // Hot cell depresses Vmp below STC. Vmp temp-coeff ≈ Voc coeff for Si.
  const vmpHot = module.vmpStc * (1 + k * (site.tMaxCellC - 25));

  // Upper bound: never exceed absolute max DC input voltage when cold.
  const maxByVdcMax = Math.floor(inverter.vdcMaxV / vocCold);
  // Lower bound: string Vmp when hot must stay above MPPT minimum.
  const minByMppt = Math.ceil(inverter.mpptMinV / vmpHot);
  // Also keep the cold Voc string below the MPPT upper bound where possible
  // (operating point sits near Vmp, but flag if even Vmp-cold would clip).
  const maxByMpptMax = Math.floor(inverter.mpptMaxV / vmpHot);

  let upper = maxByVdcMax;
  if (maxByMpptMax > 0 && maxByMpptMax < upper) upper = maxByMpptMax;

  if (minByMppt > maxByVdcMax) {
    warnings.push(
      `No valid string length: min ${minByMppt} modules (MPPT floor) exceeds max ${maxByVdcMax} (Vdc-max ceiling). Pick an inverter with a wider DC window.`,
    );
  }

  // Aim for the longest valid string (fewer parallel strings, less BoS).
  let modulesPerString = Math.max(minByMppt, 1);
  if (upper >= minByMppt) modulesPerString = upper;

  const stringWp = modulesPerString * module.wp;
  let stringCount = Math.max(1, Math.round((targetKWpDC * 1000) / stringWp));
  const modulesTotal = modulesPerString * stringCount;
  const actualKWpDC = (modulesTotal * module.wp) / 1000;

  // Distribute strings across MPPTs and check the per-MPPT current.
  const stringsPerMppt = Math.ceil(stringCount / inverter.mppts);
  const mpptCurrent = stringsPerMppt * module.impStc;
  const mpptCurrentOkay = mpptCurrent <= inverter.maxDcCurrentPerMpptA;
  if (!mpptCurrentOkay) {
    warnings.push(
      `Per-MPPT current ${mpptCurrent.toFixed(1)} A exceeds inverter limit ${inverter.maxDcCurrentPerMpptA} A — reduce strings per MPPT or choose a larger inverter.`,
    );
  }

  const stringVocColdV = modulesPerString * vocCold;
  if (stringVocColdV > inverter.vdcMaxV) {
    warnings.push(
      `String cold Voc ${stringVocColdV.toFixed(0)} V exceeds inverter Vdc-max ${inverter.vdcMaxV} V.`,
    );
  }

  return {
    vocColdPerModuleV: vocCold,
    vmpHotPerModuleV: vmpHot,
    maxModulesPerString: maxByVdcMax,
    minModulesPerString: minByMppt,
    modulesPerString,
    stringCount,
    modulesTotal,
    actualKWpDC,
    stringVocColdV,
    stringVmpHotV: modulesPerString * vmpHot,
    stringsPerMppt,
    mpptCurrentOkay,
    warnings,
  };
}

// ---------------------------------------------------------------------------
// Cable sizing (ampacity + voltage drop)
// ---------------------------------------------------------------------------

/** DC string/array cable from array to inverter. */
export function sizeDcCable(
  module: ModuleElectrical,
  strings: StringSizing,
  lengthM: number,
  vdropLimitPct: number,
): CableResult {
  // IEC 62548: array cable design current = 1.25 × Isc × (parallel strings).
  const arrayIsc = module.iscStc * strings.stringsPerMppt;
  const designCurrent = 1.25 * arrayIsc;
  const impCurrent = module.impStc * strings.stringsPerMppt; // for V-drop at Pmax
  let size = cableForAmpacity(designCurrent);

  const stringV = strings.stringVmpHotV > 0 ? strings.stringVmpHotV : 1;
  const dropAt = (a: number) => {
    const r = (COPPER_RHO_OHM_MM2_PER_M * 2 * lengthM) / a; // out-and-back
    const v = impCurrent * r;
    return { v, pct: (v / stringV) * 100 };
  };

  let { v, pct } = dropAt(size);
  // Upsize until voltage drop within limit.
  while (pct > vdropLimitPct && size < CABLE_SIZES_MM2[CABLE_SIZES_MM2.length - 1]) {
    size = nextStandard(size + 0.01, CABLE_SIZES_MM2);
    ({ v, pct } = dropAt(size));
  }

  return {
    designCurrentA: designCurrent,
    sizeMm2: cableForAmpacity(designCurrent),
    ampacityA: COPPER_AMPACITY_A[size],
    lengthM,
    voltageDropPct: pct,
    voltageDropV: v,
    withinLimit: pct <= vdropLimitPct,
    finalSizeMm2: size,
  };
}

/** AC cable from inverter to point of connection. */
export function sizeAcCable(
  inverter: InverterElectrical,
  acCurrentA: number,
  lengthM: number,
  vdropLimitPct: number,
): CableResult {
  const designCurrent = 1.25 * acCurrentA;
  let size = cableForAmpacity(designCurrent);

  const v = inverter.acVoltageV;
  const dropAt = (a: number) => {
    const rOneWay = (COPPER_RHO_OHM_MM2_PER_M * lengthM) / a;
    // 3-phase: ΔV = √3·I·R; 1-phase: ΔV = 2·I·R (out and back).
    const drop = inverter.phases === 3
      ? Math.sqrt(3) * acCurrentA * rOneWay
      : 2 * acCurrentA * rOneWay;
    return { v: drop, pct: (drop / v) * 100 };
  };

  let { v: dropV, pct } = dropAt(size);
  while (pct > vdropLimitPct && size < CABLE_SIZES_MM2[CABLE_SIZES_MM2.length - 1]) {
    size = nextStandard(size + 0.01, CABLE_SIZES_MM2);
    ({ v: dropV, pct } = dropAt(size));
  }

  return {
    designCurrentA: designCurrent,
    sizeMm2: cableForAmpacity(designCurrent),
    ampacityA: COPPER_AMPACITY_A[size],
    lengthM,
    voltageDropPct: pct,
    voltageDropV: dropV,
    withinLimit: pct <= vdropLimitPct,
    finalSizeMm2: size,
  };
}

// ---------------------------------------------------------------------------
// Protection
// ---------------------------------------------------------------------------

export function acCurrent(inverter: InverterElectrical, powerFactor: number): number {
  const w = inverter.kWac * 1000;
  const pf = powerFactor > 0 ? powerFactor : 1;
  return inverter.phases === 3
    ? w / (Math.sqrt(3) * inverter.acVoltageV * pf)
    : w / (inverter.acVoltageV * pf);
}

export function sizeProtection(
  module: ModuleElectrical,
  inverter: InverterElectrical,
  strings: StringSizing,
  acCurrentA: number,
): ProtectionResult {
  // String fuses required only where ≥3 strings can back-feed a fault into one
  // string (IEC 62548). With 1–2 strings per MPPT, omit.
  const fuseRequired = strings.stringsPerMppt >= 3;
  // String fuse: 1.5 × Isc ≤ In ≤ module max series fuse.
  let dcStringFuseA: number | null = null;
  if (fuseRequired) {
    const target = 1.5 * module.iscStc;
    const cand = nextStandard(target, STANDARD_BREAKER_A);
    dcStringFuseA = Math.min(cand, module.maxSeriesFuseA);
  }
  // DC load-break disconnect rated for the full array current with margin.
  const dcDisconnectA = nextStandard(1.25 * module.iscStc * strings.stringsPerMppt, STANDARD_BREAKER_A);
  // AC breaker: next standard above 1.25 × inverter AC current.
  const acBreakerA = nextStandard(1.25 * acCurrentA, STANDARD_BREAKER_A);
  return { dcStringFuseA, dcStringFuseRequired: fuseRequired, dcDisconnectA, acBreakerA, acCurrentA };
}

// ---------------------------------------------------------------------------
// Top-level orchestration
// ---------------------------------------------------------------------------

export function designElectrical(input: ElectricalDesignInput): ElectricalDesign {
  const site = input.site ?? DEFAULT_SITE_TEMPS;
  const pf = input.powerFactor ?? 1.0;
  const dcLen = input.dcCableLengthM ?? 30;
  const acLen = input.acCableLengthM ?? 15;
  const dcLimit = input.dcVdropLimitPct ?? 2;
  const acLimit = input.acVdropLimitPct ?? 1;

  const strings = sizeStrings(input.module, input.inverter, input.targetKWpDC, site);
  const iac = acCurrent(input.inverter, pf);
  const dcCable = sizeDcCable(input.module, strings, dcLen, dcLimit);
  const acCable = sizeAcCable(input.inverter, iac, acLen, acLimit);
  const protection = sizeProtection(input.module, input.inverter, strings, iac);

  const dcAcRatio = input.inverter.kWac > 0 ? strings.actualKWpDC / input.inverter.kWac : 0;
  const warnings = [...strings.warnings];
  if (dcAcRatio > 1.55) {
    warnings.push(`DC:AC ratio ${dcAcRatio.toFixed(2)} is high — expect inverter clipping. Bylaw 58 annex caps residential at 1.5.`);
  }
  if (!acCable.withinLimit) warnings.push('AC voltage drop exceeds limit even at largest cable — shorten the run.');
  if (!dcCable.withinLimit) warnings.push('DC voltage drop exceeds limit even at largest cable — shorten the run.');

  return { strings, dcCable, acCable, protection, dcAcRatio, warnings };
}

// ---------------------------------------------------------------------------
// Default module electrical (typical 2025 Jordan-market 580 W TOPCon)
// ---------------------------------------------------------------------------

export function defaultModuleElectrical(wp = 580): ModuleElectrical {
  // Scale a representative 580 W TOPCon datasheet to the requested Wp.
  const ref = { wp: 580, voc: 51.8, vmp: 43.2, isc: 14.2, imp: 13.43 };
  const s = wp / ref.wp;
  return {
    wp,
    vocStc: ref.voc,
    vmpStc: ref.vmp,
    iscStc: ref.isc * s,
    impStc: ref.imp * s,
    tempCoeffVocPctPerC: -0.25,
    maxSeriesFuseA: 25,
  };
}
