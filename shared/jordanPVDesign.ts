/**
 * Jordan PV system design module — engine + reference data.
 *
 * Converts user inputs (region, system size, design choices) into monthly
 * and annual kWh values that feed the tariff / billing engine in
 * `shared/jordanTariffs.ts`.
 *
 * Two surfaces share one underlying physics model:
 *   - Tier 1 "Quick Quote"      — 5 inputs, locks the rest to defaults
 *   - Tier 2 "Detailed Engineering" — every loss-chain knob exposed
 *
 * Resource dataset: Solargis "Solar Resource and PV Power Potential of
 * Jordan" (2018 atlas, still primary) cross-checked against PVGIS-SARAH2
 * and Alrwashdeh (2018) "Solar radiation map of Jordan governorates".
 */

// ---------------------------------------------------------------------------
// Regions, zones, and resource records
// ---------------------------------------------------------------------------

export type JordanRegion =
  | 'amman' | 'irbid' | 'mafraq' | 'zarqa' | 'aqaba' | 'maan'
  | 'tafileh' | 'karak' | 'madaba' | 'azraq' | 'jerash' | 'ajloun'
  | 'wadi-rum' | 'jordan-valley';

/**
 * Monthly-distribution climate zones (intra-zone variation < 1 %).
 *   N = Northern Highlands & central plateau
 *   S = Southern Desert
 *   E = Eastern Badia
 *   V = Jordan Valley / Dead Sea
 */
export type ClimateZone = 'N' | 'S' | 'E' | 'V';

export type SoilingClass = 'low' | 'medium' | 'medium-high' | 'high' | 'very-high';

export interface RegionResource {
  label: string;
  lat: number; lon: number; elev: number;
  /** Global horizontal irradiance (kWh/m²/yr). */
  ghi: number;
  /** Direct normal irradiance (kWh/m²/yr). */
  dni: number;
  /** Diffuse horizontal irradiance (kWh/m²/yr). */
  dhi: number;
  /** Global irradiation on optimally-tilted fixed plane (kWh/m²/yr). */
  gtiOpt: number;
  /** PV output assuming 1 kWp grid-tied fixed-tilt c-Si at optimum tilt
   *  with reasonable losses (Solargis PVOUT level 1). kWh/kWp/yr. */
  pvoutFix: number;
  /** Optimal fixed tilt, south-facing (°). */
  tiltOpt: number;
  zone: ClimateZone;
  soilingClass: SoilingClass;
  /** Annual mean ambient temperature (°C). */
  tAvg: number;
}

export const JORDAN_REGIONS: Record<JordanRegion, RegionResource> = {
  'amman':         { label: 'Amman',                     lat: 31.97, lon: 35.99, elev:  780, ghi: 2090, dni: 2580, dhi: 720, gtiOpt: 2310, pvoutFix: 1820, tiltOpt: 26, zone: 'N', soilingClass: 'medium',       tAvg: 18.4 },
  'irbid':         { label: 'Irbid',                     lat: 32.55, lon: 35.85, elev:  620, ghi: 2030, dni: 2440, dhi: 740, gtiOpt: 2240, pvoutFix: 1770, tiltOpt: 27, zone: 'N', soilingClass: 'medium',       tAvg: 19.2 },
  'mafraq':        { label: 'Mafraq',                    lat: 32.34, lon: 36.21, elev:  690, ghi: 2170, dni: 2720, dhi: 690, gtiOpt: 2400, pvoutFix: 1880, tiltOpt: 27, zone: 'E', soilingClass: 'high',         tAvg: 18.7 },
  'zarqa':         { label: 'Zarqa',                     lat: 32.07, lon: 36.09, elev:  620, ghi: 2120, dni: 2640, dhi: 710, gtiOpt: 2340, pvoutFix: 1840, tiltOpt: 26, zone: 'N', soilingClass: 'medium-high',  tAvg: 19.6 },
  'aqaba':         { label: 'Aqaba',                     lat: 29.53, lon: 35.00, elev:   50, ghi: 2260, dni: 2820, dhi: 670, gtiOpt: 2440, pvoutFix: 1910, tiltOpt: 24, zone: 'S', soilingClass: 'medium',       tAvg: 25.0 },
  'maan':          { label: "Ma'an / MDA",               lat: 30.19, lon: 35.74, elev: 1070, ghi: 2300, dni: 2950, dhi: 640, gtiOpt: 2520, pvoutFix: 1990, tiltOpt: 25, zone: 'S', soilingClass: 'high',         tAvg: 16.8 },
  'tafileh':       { label: 'Tafileh',                   lat: 30.84, lon: 35.60, elev: 1290, ghi: 2210, dni: 2800, dhi: 670, gtiOpt: 2430, pvoutFix: 1920, tiltOpt: 25, zone: 'S', soilingClass: 'medium',       tAvg: 14.5 },
  'karak':         { label: 'Karak',                     lat: 31.18, lon: 35.70, elev:  950, ghi: 2180, dni: 2740, dhi: 680, gtiOpt: 2400, pvoutFix: 1890, tiltOpt: 26, zone: 'N', soilingClass: 'medium',       tAvg: 16.0 },
  'madaba':        { label: 'Madaba',                    lat: 31.72, lon: 35.79, elev:  770, ghi: 2110, dni: 2620, dhi: 710, gtiOpt: 2330, pvoutFix: 1830, tiltOpt: 26, zone: 'N', soilingClass: 'medium',       tAvg: 17.8 },
  'azraq':         { label: 'Azraq / Eastern Badia',     lat: 31.83, lon: 36.83, elev:  510, ghi: 2200, dni: 2830, dhi: 670, gtiOpt: 2440, pvoutFix: 1910, tiltOpt: 27, zone: 'E', soilingClass: 'very-high',    tAvg: 19.4 },
  'jerash':        { label: 'Jerash',                    lat: 32.27, lon: 35.89, elev:  580, ghi: 2050, dni: 2490, dhi: 730, gtiOpt: 2260, pvoutFix: 1790, tiltOpt: 27, zone: 'N', soilingClass: 'medium',       tAvg: 18.6 },
  'ajloun':        { label: 'Ajloun',                    lat: 32.33, lon: 35.75, elev: 1080, ghi: 1990, dni: 2360, dhi: 750, gtiOpt: 2200, pvoutFix: 1740, tiltOpt: 27, zone: 'N', soilingClass: 'low',          tAvg: 16.4 },
  'wadi-rum':      { label: 'Wadi Rum / Petra',          lat: 29.58, lon: 35.42, elev:  990, ghi: 2290, dni: 2900, dhi: 650, gtiOpt: 2500, pvoutFix: 1970, tiltOpt: 24, zone: 'S', soilingClass: 'high',         tAvg: 19.5 },
  'jordan-valley': { label: 'Jordan Valley / Dead Sea',  lat: 31.55, lon: 35.55, elev: -400, ghi: 2070, dni: 2510, dhi: 730, gtiOpt: 2280, pvoutFix: 1800, tiltOpt: 26, zone: 'V', soilingClass: 'medium',       tAvg: 23.8 },
};

/** Monthly share of annual yield by zone. Source vectors are normalized so
 *  each row sums to exactly 1.000 (the spec's rounded values total ~1.02). */
function normalize12(v: number[]): number[] {
  const s = v.reduce((a, b) => a + b, 0);
  return v.map(x => x / s);
}

export const ZONE_MONTHLY_SHARES: Record<ClimateZone, number[]> = {
  N: normalize12([0.054, 0.061, 0.083, 0.089, 0.103, 0.111, 0.115, 0.110, 0.097, 0.082, 0.061, 0.052]),
  S: normalize12([0.063, 0.069, 0.087, 0.091, 0.101, 0.106, 0.108, 0.104, 0.094, 0.083, 0.066, 0.060]),
  E: normalize12([0.057, 0.064, 0.085, 0.091, 0.104, 0.110, 0.113, 0.107, 0.095, 0.082, 0.063, 0.057]),
  V: normalize12([0.058, 0.066, 0.085, 0.090, 0.101, 0.107, 0.111, 0.107, 0.095, 0.083, 0.063, 0.054]),
};

/** Monthly average ambient temperature for Amman (°C) — used as reference
 *  when a region-specific monthly vector is not yet populated.            */
export const AMMAN_MONTHLY_TEMP_C: number[] = [
  8.4, 9.6, 12.7, 17.0, 21.6, 24.6, 26.1, 26.0, 23.7, 20.0, 14.2, 9.8,
];

// ---------------------------------------------------------------------------
// System class & loss-chain defaults
// ---------------------------------------------------------------------------

export type SystemType = 'res-rooftop' | 'com-rooftop' | 'ground-mount' | 'ground-tracker';
export type MountingType = 'fixed' | 'HSAT' | 'dual-axis';
export type ModuleTech = 'TOPCon' | 'mono-PERC' | 'HJT';
export type CleaningFrequency = 'none' | 'quarterly' | 'monthly' | 'biweekly' | 'custom';

/** Tier 1 Performance Ratio defaults per system class. */
export const PR_DEFAULTS: Record<SystemType, number> = {
  'res-rooftop':    0.78,
  'com-rooftop':    0.80,
  'ground-mount':   0.82,
  'ground-tracker': 0.81,
};

/** Mounting uplift over fixed-tilt at optimal angle. */
export const MOUNTING_UPLIFT: Record<MountingType, number> = {
  'fixed':     1.00,
  'HSAT':      1.18,
  'dual-axis': 1.30,
};

/** Roof / land area required per kWp DC (m²). */
export const AREA_PER_KWP: Record<SystemType, number> = {
  'res-rooftop':    5.5,
  'com-rooftop':    7.0,
  'ground-mount':   15,
  'ground-tracker': 18,
};

/** Annual soiling loss (%) by soiling class with monthly cleaning. */
export const SOILING_ANNUAL_PCT: Record<SoilingClass, number> = {
  'low':         2,
  'medium':      3,
  'medium-high': 4,
  'high':        5,
  'very-high':   7,
};

/** Soiling cleaning-frequency adjustment factors (multiplied by base loss). */
export const SOILING_CLEANING_FACTOR: Record<CleaningFrequency, number> = {
  'none':      3.0,  // no cleaning → much higher loss
  'quarterly': 1.7,
  'monthly':   1.0,  // baseline
  'biweekly':  0.7,
  'custom':    1.0,
};

/** Monthly soiling-rate multipliers (× annual rate /12). Dust storms peak
 *  Mar–May (khamsin); rain naturally cleans Dec–Feb. */
export const SOILING_MONTHLY_MULTIPLIERS: number[] = [
  0.5, 0.6, 1.6, 1.8, 1.5, 1.2, 1.1, 1.0, 0.8, 0.7, 0.6, 0.5,
];

/** Bifacial rear-side uplift defaults (%) by mounting context. */
export const BIFACIAL_GAIN_PCT = {
  rooftop: 6,
  ground:  9,
  BIPV:    0,
} as const;

/** Albedo defaults. */
export const ALBEDO_DEFAULTS = {
  rooftop_concrete:  0.30,
  rooftop_asphalt:   0.15,
  rooftop_white:     0.55,
  ground_sand:       0.40,
  ground_gravel:     0.25,
  vegetation_sparse: 0.20,
  snow:              0.65,
  /** Defaults used by the engine when only mounting class is known. */
  rooftop_default:   0.25,
  ground_default:    0.35,
} as const;

/** Inverter clipping loss as a function of DC:AC ratio (Jordan irradiance). */
export function clippingLossPct(dcAcRatio: number): number {
  if (dcAcRatio <= 1.0) return 0;
  if (dcAcRatio <= 1.2) return 0.8 * ((dcAcRatio - 1.0) / 0.2);
  if (dcAcRatio <= 1.3) return 0.8 + 0.7 * ((dcAcRatio - 1.2) / 0.1);
  if (dcAcRatio <= 1.5) return 1.5 + 1.5 * ((dcAcRatio - 1.3) / 0.2);
  return 3.0;
}

// ---------------------------------------------------------------------------
// Equipment library (Jordan wholesale market, 2026)
// ---------------------------------------------------------------------------

export interface ModuleRecord {
  id: string;
  brand: string;
  series: string;
  wp: number;
  tech: ModuleTech;
  efficiencyPct: number;
  tempCoeffPct: number;
  bifaciality: number; // 0 = monofacial
  annualDegradationPct: number;
  notes?: string;
}

export const MODULE_LIBRARY: Record<string, ModuleRecord> = {
  'JKM-TN3-670': { id: 'JKM-TN3-670', brand: 'JinkoSolar',     series: 'Tiger Neo 3.0 72HL4M',       wp: 670, tech: 'TOPCon',    efficiencyPct: 24.8, tempCoeffPct: -0.26, bifaciality: 0.85, annualDegradationPct: 0.40, notes: '2025–26 flagship' },
  'JKM-TN-605':  { id: 'JKM-TN-605',  brand: 'JinkoSolar',     series: 'Tiger Neo 72HL4-V',           wp: 605, tech: 'TOPCon',    efficiencyPct: 23.4, tempCoeffPct: -0.28, bifaciality: 0,    annualDegradationPct: 0.40, notes: 'High-volume in Jordan' },
  'LR-HM7-625':  { id: 'LR-HM7-625',  brand: 'LONGi',          series: 'Hi-MO 7 LR7-72HGD',           wp: 625, tech: 'TOPCon',    efficiencyPct: 23.2, tempCoeffPct: -0.29, bifaciality: 0.80, annualDegradationPct: 0.40, notes: 'Premium HPBC' },
  'LR-HM6-565':  { id: 'LR-HM6-565',  brand: 'LONGi',          series: 'Hi-MO 6 LR5-72HPH',           wp: 565, tech: 'mono-PERC', efficiencyPct: 21.5, tempCoeffPct: -0.34, bifaciality: 0,    annualDegradationPct: 0.55, notes: 'Legacy stock, cheaper' },
  'JAM-DB4-625': { id: 'JAM-DB4-625', brand: 'JA Solar',       series: 'DeepBlue 4.0 Pro',            wp: 625, tech: 'TOPCon',    efficiencyPct: 23.0, tempCoeffPct: -0.29, bifaciality: 0.75, annualDegradationPct: 0.40 },
  'TSM-NEG-625': { id: 'TSM-NEG-625', brand: 'Trina',          series: 'Vertex N TSM-NEG21C.20',      wp: 625, tech: 'TOPCon',    efficiencyPct: 23.0, tempCoeffPct: -0.29, bifaciality: 0.80, annualDegradationPct: 0.40 },
  'CS-TH-620':   { id: 'CS-TH-620',   brand: 'Canadian Solar', series: 'TOPHiKu7',                    wp: 620, tech: 'TOPCon',    efficiencyPct: 22.8, tempCoeffPct: -0.30, bifaciality: 0.75, annualDegradationPct: 0.45 },
};

export interface InverterRecord {
  id: string;
  brand: string;
  model: string;
  kWac: number;
  phases: 1 | 3;
  euEfficiencyPct: number;
  mppts: number;
  maxDcAc: number;
  hybrid?: boolean;
  notes?: string;
}

export const INVERTER_LIBRARY: Record<string, InverterRecord> = {
  'HUA-SUN-3KTL':    { id: 'HUA-SUN-3KTL',    brand: 'Huawei',  model: 'SUN2000-3KTL-L1',    kWac:   3.0, phases: 1, euEfficiencyPct: 97.5, mppts: 2,  maxDcAc: 1.5, notes: 'Residential 1Φ' },
  'HUA-SUN-5KTL':    { id: 'HUA-SUN-5KTL',    brand: 'Huawei',  model: 'SUN2000-5KTL-L1',    kWac:   5.0, phases: 1, euEfficiencyPct: 97.6, mppts: 2,  maxDcAc: 1.5, notes: 'Residential 1Φ' },
  'HUA-SUN-10KTL':   { id: 'HUA-SUN-10KTL',   brand: 'Huawei',  model: 'SUN2000-10KTL-M2',   kWac:  10.0, phases: 3, euEfficiencyPct: 98.4, mppts: 4,  maxDcAc: 1.5, notes: 'Residential 3Φ' },
  'HUA-SUN-50KTL':   { id: 'HUA-SUN-50KTL',   brand: 'Huawei',  model: 'SUN2000-50KTL-M3',   kWac:  50.0, phases: 3, euEfficiencyPct: 98.7, mppts: 4,  maxDcAc: 1.5, notes: 'Small commercial' },
  'HUA-SUN-100KTL':  { id: 'HUA-SUN-100KTL',  brand: 'Huawei',  model: 'SUN2000-100KTL-M2',  kWac: 100.0, phases: 3, euEfficiencyPct: 98.8, mppts: 10, maxDcAc: 1.5, notes: 'Medium commercial' },
  'SG-RS-5K':        { id: 'SG-RS-5K',        brand: 'Sungrow', model: 'SG5.0RS',            kWac:   5.0, phases: 1, euEfficiencyPct: 97.5, mppts: 2,  maxDcAc: 1.5, notes: 'Residential 1Φ' },
  'SG-CX-50':        { id: 'SG-CX-50',        brand: 'Sungrow', model: 'SG50CX-P2',          kWac:  50.0, phases: 3, euEfficiencyPct: 98.5, mppts: 6,  maxDcAc: 1.5, notes: 'Commercial' },
  'SG-CX-110':       { id: 'SG-CX-110',       brand: 'Sungrow', model: 'SG110CX',            kWac: 110.0, phases: 3, euEfficiencyPct: 98.7, mppts: 9,  maxDcAc: 1.5, notes: 'Commercial/industrial' },
  'SMA-STP-25':      { id: 'SMA-STP-25',      brand: 'SMA',     model: 'Sunny Tripower 25000TL', kWac: 25.0, phases: 3, euEfficiencyPct: 98.2, mppts: 2,  maxDcAc: 1.5, notes: 'German premium' },
  'FR-SYM-20':       { id: 'FR-SYM-20',       brand: 'Fronius', model: 'Symo 20.0-3-M',      kWac:  20.0, phases: 3, euEfficiencyPct: 98.0, mppts: 2,  maxDcAc: 1.5, notes: 'Austrian premium' },
  'SLS-S6-5K':       { id: 'SLS-S6-5K',       brand: 'Solis',   model: 'S6-GR1P5K',          kWac:   5.0, phases: 1, euEfficiencyPct: 97.0, mppts: 2,  maxDcAc: 1.3, notes: 'Budget residential' },
  // Hybrids
  'HUA-SUN-5KTL-M1': { id: 'HUA-SUN-5KTL-M1', brand: 'Huawei',  model: 'SUN2000-5KTL-M1',    kWac:   5.0, phases: 1, euEfficiencyPct: 97.6, mppts: 2,  maxDcAc: 1.5, hybrid: true, notes: 'Hybrid + LUNA2000' },
  'SG-RH-5K':        { id: 'SG-RH-5K',        brand: 'Sungrow', model: 'SH5.0RT',            kWac:   5.0, phases: 1, euEfficiencyPct: 97.5, mppts: 2,  maxDcAc: 1.5, hybrid: true, notes: 'Hybrid + SBR' },
  'SG-RH-10K':       { id: 'SG-RH-10K',       brand: 'Sungrow', model: 'SH10RT',             kWac:  10.0, phases: 3, euEfficiencyPct: 98.2, mppts: 4,  maxDcAc: 1.5, hybrid: true, notes: 'Hybrid + SBR' },
};

export type BatteryChemistry = 'LFP' | 'NMC' | 'LeadAcid';

export interface BatteryRecord {
  id: string;
  brand: string;
  model: string;
  nominalKWh: number;
  dod: number;
  rte: number;
  cycles: number;
  chemistry: BatteryChemistry;
}

export const BATTERY_LIBRARY: Record<string, BatteryRecord> = {
  'HUA-LUNA-5':  { id: 'HUA-LUNA-5',  brand: 'Huawei',    model: 'LUNA2000-5kWh',              nominalKWh:  5.0,  dod: 1.00, rte: 0.95, cycles: 6000, chemistry: 'LFP' },
  'HUA-LUNA-15': { id: 'HUA-LUNA-15', brand: 'Huawei',    model: 'LUNA2000-15kWh',             nominalKWh: 15.0,  dod: 1.00, rte: 0.95, cycles: 6000, chemistry: 'LFP' },
  'BYD-HVS-7.7': { id: 'BYD-HVS-7.7', brand: 'BYD',       model: 'Battery-Box Premium HVS 7.7', nominalKWh:  7.7, dod: 0.90, rte: 0.95, cycles: 6000, chemistry: 'LFP' },
  'BYD-HVM-22':  { id: 'BYD-HVM-22',  brand: 'BYD',       model: 'Battery-Box Premium HVM 22.1', nominalKWh: 22.1, dod: 0.90, rte: 0.95, cycles: 6000, chemistry: 'LFP' },
  'PYL-FT4800':  { id: 'PYL-FT4800',  brand: 'Pylontech', model: 'Force H2',                    nominalKWh:  7.1, dod: 0.95, rte: 0.95, cycles: 6000, chemistry: 'LFP' },
  'SG-SBR-9.6':  { id: 'SG-SBR-9.6',  brand: 'Sungrow',   model: 'SBR096',                      nominalKWh:  9.6, dod: 1.00, rte: 0.95, cycles: 6000, chemistry: 'LFP' },
};

export const STORAGE_CHEMISTRY_DEFAULTS: Record<
  BatteryChemistry,
  { dod: number; rte: number; degPctPerYear: number; cycleLife: number; calendarLifeYears: number }
> = {
  'LFP':      { dod: 0.90, rte: 0.92, degPctPerYear: 2, cycleLife: 6000, calendarLifeYears: 12 },
  'NMC':      { dod: 0.80, rte: 0.92, degPctPerYear: 3, cycleLife: 4000, calendarLifeYears: 10 },
  'LeadAcid': { dod: 0.50, rte: 0.80, degPctPerYear: 5, cycleLife: 1200, calendarLifeYears:  6 },
};

// ---------------------------------------------------------------------------
// Tier inputs
// ---------------------------------------------------------------------------

export interface QuickQuoteInputs {
  region: JordanRegion;
  /** 'kWp' = sizeValue is module DC nameplate; 'roofArea' = m² of roof. */
  sizingMode: 'kWp' | 'roofArea';
  sizeValue: number;
  systemType: SystemType;
  /** Optional PR override (0.70 – 0.85). If absent → PR_DEFAULTS[systemType]. */
  prOverride?: number;
}

export interface DetailedInputs {
  // Site
  region: JordanRegion;
  overrideGHI_kWhPerM2Year?: number;
  overrideMonthlyShares?: number[];
  overrideMonthlyTemp_C?: number[];

  // Array geometry
  tilt_deg: number;
  azimuth_deg: number;
  mountingType: MountingType;
  gcr?: number;

  // System sizing
  dcKWp: number;            // module DC nameplate
  inverterKWac: number;     // inverter nameplate

  // Module electrical
  tempCoeffPct: number;     // %/°C, e.g. -0.30
  moduleTech: ModuleTech;
  noct_C: number;
  moduleMismatchPct: number;
  lidPct: number;
  annualDegradationPct: number;
  lifetimeYears: number;
  bifacial: boolean;
  bifacialGainPct: number;
  albedo: number;

  // Soiling
  cleaningFrequency: CleaningFrequency;
  soilingClass: SoilingClass;
  soilingAnnualPctOverride?: number;
  soilingMonthlyMultipliers?: number[];

  // Shading
  nearShadingPct: number;
  horizonShadingPct: number;
  interRowShadingPct: number;

  // Inverter
  euEfficiencyPct: number;
  mpptEfficiencyPct: number;
  inverterAvailabilityPct: number;

  // Wiring
  dcWiringLossPct: number;
  acLvWiringLossPct: number;
  mvTransformerLossPct: number;

  // Mismatch & optical
  moduleTolerancePct: number;
  spectrumLossPct: number;
  iamLossPct: number;
  lowIrradianceLossPct: number;

  // Availability
  pvAvailabilityPct: number;
  gridAvailabilityPct: number;

  // System class (for defaults dispatch)
  systemType: SystemType;
}

// ---------------------------------------------------------------------------
// Defaults dispatcher — fills in a complete DetailedInputs from a partial
// ---------------------------------------------------------------------------

export function defaultDetailedInputs(
  region: JordanRegion,
  systemType: SystemType,
  dcKWp: number,
  inverterKWac: number,
): DetailedInputs {
  const r = JORDAN_REGIONS[region];
  return {
    region,
    tilt_deg: r.tiltOpt,
    azimuth_deg: 0,
    mountingType: 'fixed',
    dcKWp,
    inverterKWac,
    tempCoeffPct: -0.30,
    moduleTech: 'TOPCon',
    noct_C: 45,
    moduleMismatchPct: 1.5,
    lidPct: 0.8,
    annualDegradationPct: 0.4,
    lifetimeYears: systemType === 'res-rooftop' ? 30 : 25,
    bifacial: false,
    bifacialGainPct: systemType.includes('rooftop')
      ? BIFACIAL_GAIN_PCT.rooftop
      : BIFACIAL_GAIN_PCT.ground,
    albedo: systemType.includes('rooftop')
      ? ALBEDO_DEFAULTS.rooftop_default
      : ALBEDO_DEFAULTS.ground_default,
    cleaningFrequency: 'monthly',
    soilingClass: r.soilingClass,
    nearShadingPct: { 'res-rooftop': 4, 'com-rooftop': 1.5, 'ground-mount': 0.5, 'ground-tracker': 0.5 }[systemType],
    horizonShadingPct: 0,
    interRowShadingPct: systemType.startsWith('ground') ? 2 : 0,
    euEfficiencyPct: 98.0,
    mpptEfficiencyPct: 99.5,
    inverterAvailabilityPct: 99.0,
    dcWiringLossPct: 1.5,
    acLvWiringLossPct: 0.8,
    mvTransformerLossPct: 0,
    moduleTolerancePct: 0,
    spectrumLossPct: 1.5,
    iamLossPct: 2.5,
    lowIrradianceLossPct: 1.0,
    pvAvailabilityPct: 99.0,
    gridAvailabilityPct: 99.3,
    systemType,
  };
}

// ---------------------------------------------------------------------------
// Core engine
// ---------------------------------------------------------------------------

export interface LossBreakdown {
  poaIrradiation_kWhPerM2: number;
  dcKWp: number;
  /** Energy (kWh) at each stage of the loss chain. */
  stages: { name: string; energyKWh: number; lossPct: number }[];
}

export interface YieldResult {
  annualKWh_year1: number;
  monthlyKWh_year1: number[];
  /** Cumulative annual kWh for each year of lifetime (with LID + linear degradation). */
  yearByYear: number[];
  performanceRatio: number;
  specificYield_kWhPerKWpYear: number;
  lossBreakdown: LossBreakdown;
  /** True if the Tier 1 PR shortcut was used (full loss chain skipped). */
  prShortcut: boolean;
}

/**
 * Tier 1 shortcut: use Solargis PVOUT_fix (which embeds PR ≈ 0.80) and
 * regross by the user's PR override or system-class default.
 *     annualKWh = dcKWp × PVOUT_fix × PR / 0.80
 */
export function quickQuoteYield(input: QuickQuoteInputs): YieldResult {
  const r = JORDAN_REGIONS[input.region];
  const pr = input.prOverride ?? PR_DEFAULTS[input.systemType];
  const dcKWp = input.sizingMode === 'kWp'
    ? input.sizeValue
    : input.sizeValue / AREA_PER_KWP[input.systemType];

  const annual = dcKWp * r.pvoutFix * (pr / 0.80);
  const shares = ZONE_MONTHLY_SHARES[r.zone];
  const monthly = shares.map(s => annual * s);

  // 25-year degraded curve (0.4 %/yr TOPCon default + 0.8 % LID year 1).
  const lifetime = input.systemType === 'res-rooftop' ? 30 : 25;
  const yearByYear = Array.from({ length: lifetime }, (_, y) => {
    const lid = 1 - 0.008;
    const deg = lid * Math.pow(1 - 0.004, Math.max(0, y));
    return annual * deg;
  });

  return {
    annualKWh_year1: annual,
    monthlyKWh_year1: monthly,
    yearByYear,
    performanceRatio: pr,
    specificYield_kWhPerKWpYear: annual / dcKWp,
    lossBreakdown: {
      poaIrradiation_kWhPerM2: r.gtiOpt,
      dcKWp,
      stages: [
        { name: 'POA (optimum tilt)', energyKWh: dcKWp * r.gtiOpt, lossPct: 0 },
        { name: `PR ${pr.toFixed(2)} (Tier-1 shortcut)`, energyKWh: annual, lossPct: (1 - pr / 1.0) * 100 },
      ],
    },
    prShortcut: true,
  };
}

/**
 * Tier 2 engine: full loss chain.
 *
 * Order of operations:
 *   1. Resolve site irradiance & geometry → POA per month
 *   2. Apply mounting uplift (HSAT / dual-axis)
 *   3. DC nameplate × POA → gross DC energy
 *   4. Apply DC-side losses (temperature, soiling, shading, mismatch,
 *      optical, bifacial gain, DC wiring)
 *   5. Inverter conversion + clipping + MPPT + availability
 *   6. AC-side losses (LV wiring, MV transformer, PV avail, grid avail)
 *   7. Year-by-year degradation curve (LID + linear)
 */
export function calculatePVYield(input: DetailedInputs): YieldResult {
  const r = JORDAN_REGIONS[input.region];
  const ghi = input.overrideGHI_kWhPerM2Year ?? r.ghi;
  const monthlyShares = input.overrideMonthlyShares ?? ZONE_MONTHLY_SHARES[r.zone];
  const tMonth = input.overrideMonthlyTemp_C ?? AMMAN_MONTHLY_TEMP_C;

  // 1. Tilt + azimuth → transposition factor (POA / GHI). Use the atlas's
  //    GTI_opt / GHI as the optimum-tilt anchor, then derate for off-optimum
  //    tilt and off-south azimuth with a quadratic shape (good to ~3 % over
  //    the relevant range).
  const tiltOptFactor = r.gtiOpt / r.ghi; // typically ≈ 1.10 for Jordan
  const tiltDeficit = Math.pow((input.tilt_deg - r.tiltOpt) / 60, 2);
  const azimuthDeficit = Math.pow(input.azimuth_deg / 180, 2);
  const transposition = tiltOptFactor * (1 - 0.08 * tiltDeficit - 0.06 * azimuthDeficit);
  const poaAnnual = ghi * transposition;
  const mountingFactor = MOUNTING_UPLIFT[input.mountingType];
  const poaMonthly = monthlyShares.map(s => poaAnnual * mountingFactor * s);

  // 2. Gross DC at STC: DC kWp × POA (already in kWh/m²)
  const grossDC = poaMonthly.map(p => p * input.dcKWp);

  // 3. Temperature loss per month
  //    Cell T ≈ T_amb + (NOCT-20)/0.8 × (POA / 1000) effective. Approximate
  //    monthly cell-temp avg as T_amb + (NOCT-20) × 0.6 (proxy for daytime).
  const tempLossPct = tMonth.map(ta => {
    const tCell = ta + (input.noct_C - 20) * 0.6;
    return Math.max(0, (tCell - 25) * Math.abs(input.tempCoeffPct));
  });

  // 4. Soiling: annual × monthly multiplier × cleaning factor
  const baseSoiling = input.soilingAnnualPctOverride
    ?? SOILING_ANNUAL_PCT[input.soilingClass];
  const cleaningFactor = SOILING_CLEANING_FACTOR[input.cleaningFrequency];
  const monthlySoilMults = input.soilingMonthlyMultipliers ?? SOILING_MONTHLY_MULTIPLIERS;
  const soilingLossPct = monthlySoilMults.map(m => baseSoiling * cleaningFactor * m / 12);

  // 5. Constant DC-side losses
  const constDcLossPct =
    input.moduleMismatchPct +
    input.nearShadingPct + input.horizonShadingPct + input.interRowShadingPct +
    input.spectrumLossPct + input.iamLossPct + input.lowIrradianceLossPct +
    Math.abs(input.moduleTolerancePct) +
    input.dcWiringLossPct;

  // 6. Bifacial gain (negative loss)
  const bifacialGain = input.bifacial ? input.bifacialGainPct : 0;

  // 7. Apply DC-side losses per month
  const monthlyDC = grossDC.map((e, m) => {
    const tempFactor = 1 - tempLossPct[m] / 100;
    const soilFactor = 1 - soilingLossPct[m] / 100;
    const constFactor = 1 - constDcLossPct / 100;
    const bifacialFactor = 1 + bifacialGain / 100;
    return e * tempFactor * soilFactor * constFactor * bifacialFactor;
  });

  // 8. Inverter conversion (per-month with clipping based on the DC peak;
  //    monthly average uses the system-level DC:AC ratio).
  const dcAcRatio = input.dcKWp / input.inverterKWac;
  const clip = clippingLossPct(dcAcRatio) / 100;
  const monthlyAC = monthlyDC.map(e =>
    e *
    (input.euEfficiencyPct / 100) *
    (input.mpptEfficiencyPct / 100) *
    (1 - clip) *
    (input.inverterAvailabilityPct / 100),
  );

  // 9. AC-side losses
  const monthlyACFinal = monthlyAC.map(e =>
    e *
    (1 - input.acLvWiringLossPct / 100) *
    (1 - input.mvTransformerLossPct / 100) *
    (input.pvAvailabilityPct / 100) *
    (input.gridAvailabilityPct / 100),
  );

  const annual = monthlyACFinal.reduce((s, v) => s + v, 0);
  const grossDCAnnual = grossDC.reduce((s, v) => s + v, 0);
  const pr = grossDCAnnual > 0 ? annual / grossDCAnnual : 0;

  // 10. Year-by-year degradation (LID first year + linear thereafter).
  const yearByYear = Array.from({ length: input.lifetimeYears }, (_, y) => {
    const lid = 1 - input.lidPct / 100;
    const deg = y === 0 ? lid : lid * Math.pow(1 - input.annualDegradationPct / 100, y);
    return annual * deg;
  });

  // 11. Loss breakdown waterfall (year 1)
  const stages: LossBreakdown['stages'] = [];
  const poaTotal = poaMonthly.reduce((s, v) => s + v, 0);
  stages.push({ name: 'POA irradiation', energyKWh: poaTotal * input.dcKWp, lossPct: 0 });
  let running = grossDCAnnual;
  const tempAvg = tempLossPct.reduce((s, v) => s + v, 0) / 12;
  running *= (1 - tempAvg / 100);
  stages.push({ name: 'Temperature', energyKWh: running, lossPct: tempAvg });
  const soilAvg = soilingLossPct.reduce((s, v) => s + v, 0);
  running *= (1 - soilAvg / 100);
  stages.push({ name: `Soiling (${input.cleaningFrequency})`, energyKWh: running, lossPct: soilAvg });
  running *= (1 - constDcLossPct / 100);
  stages.push({ name: 'DC mismatch / shading / optical / wiring', energyKWh: running, lossPct: constDcLossPct });
  if (bifacialGain > 0) {
    running *= 1 + bifacialGain / 100;
    stages.push({ name: 'Bifacial gain', energyKWh: running, lossPct: -bifacialGain });
  }
  const invFactor = (input.euEfficiencyPct / 100) * (input.mpptEfficiencyPct / 100) * (1 - clip) * (input.inverterAvailabilityPct / 100);
  running *= invFactor;
  stages.push({ name: `Inverter (η ${input.euEfficiencyPct}% × MPPT × clip × avail)`, energyKWh: running, lossPct: (1 - invFactor) * 100 });
  const acFactor = (1 - input.acLvWiringLossPct / 100) * (1 - input.mvTransformerLossPct / 100) * (input.pvAvailabilityPct / 100) * (input.gridAvailabilityPct / 100);
  running *= acFactor;
  stages.push({ name: 'AC wiring / transformer / availability', energyKWh: running, lossPct: (1 - acFactor) * 100 });

  return {
    annualKWh_year1: annual,
    monthlyKWh_year1: monthlyACFinal,
    yearByYear,
    performanceRatio: pr,
    specificYield_kWhPerKWpYear: annual / input.dcKWp,
    lossBreakdown: {
      poaIrradiation_kWhPerM2: poaAnnual * mountingFactor,
      dcKWp: input.dcKWp,
      stages,
    },
    prShortcut: false,
  };
}

/**
 * Tier 1 → Detailed wrapper. Useful when downstream code wants a single
 * entry point regardless of tier.
 */
export function calculatePVYieldQuick(quick: QuickQuoteInputs, inverterKWac?: number): YieldResult {
  return quickQuoteYield(quick);
}

// ---------------------------------------------------------------------------
// Roof-area helpers
// ---------------------------------------------------------------------------

export function kWpFromRoofArea(areaM2: number, systemType: SystemType): number {
  return areaM2 / AREA_PER_KWP[systemType];
}

export function roofAreaFromKWp(dcKWp: number, systemType: SystemType): number {
  return dcKWp * AREA_PER_KWP[systemType];
}

// ---------------------------------------------------------------------------
// Battery sizing rule-of-thumb (engineer can override)
// ---------------------------------------------------------------------------

export interface BatterySizingHint {
  recommendedKWh: number;
  rationale: string;
}

export function recommendBatterySize(
  mechanism: 'M1' | 'M2_res' | 'M2_com' | 'M3' | 'M4' | 'M5' | 'off-grid',
  avgDailyKWh: number,
): BatterySizingHint {
  switch (mechanism) {
    case 'M2_res':
      return { recommendedKWh: Math.round(avgDailyKWh * 0.40), rationale: '1–1.5× evening load — closes the 0.20 JD/kWh import vs 0.05 export arbitrage.' };
    case 'M2_com':
      return { recommendedKWh: Math.round(avgDailyKWh * 0.25), rationale: '0.5–1× midday excess; ~13 JD/kWac/mo grid fee makes self-consumption attractive.' };
    case 'M3':
      return { recommendedKWh: Math.round(avgDailyKWh * 0.30), rationale: 'Sized to absorb expected midday curtailment volume × ~1 hour.' };
    case 'M4':
    case 'M5':
      return { recommendedKWh: 0, rationale: 'No economic case — every kWh already sells at the fixed/1:1 rate.' };
    case 'off-grid':
      return { recommendedKWh: Math.round(avgDailyKWh * 1.0), rationale: '~1 day autonomy at 90% DoD (LFP); 2 days at 50% DoD (lead-acid).' };
    case 'M1':
    default:
      return { recommendedKWh: 0, rationale: 'Wheeling does not benefit from on-site storage at the off-take.' };
  }
}
