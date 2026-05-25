/**
 * Jordan EMRC 2025 Tariff Guide — canonical reference data and pricing helpers.
 *
 * Authoritative sources:
 *   - EMRC Tariff Guide 2025 (effective 1 Jan 2025; Arabic prevails)
 *     https://emrc.gov.jo/EBV4.0/Root_Storage/AR/EB_List_Page/2025_دليل_التعرفة.pdf
 *   - NEPCO bilingual schedule https://www.nepco.com.jo/assets/doc/tariff.pdf
 *   - Bylaw No. 58 of 2024 (Official Gazette 19/8/2024) — net-billing economics
 *
 * All sector rates are stored in fils/kWh (1 JD = 1000 fils). Helpers that
 * return JD divide by 1000.
 */

// ---------------------------------------------------------------------------
// Sector codes
// ---------------------------------------------------------------------------

export type SectorCode =
  // Residential
  | 'A1_subsidized'
  | 'A2_unsubsidized'
  // Commercial
  | 'B1_commercial'
  | 'B2_temp_commercial'
  | 'B3_banks'
  | 'B4_telecom'
  // Industrial
  | 'C1_small_industrial'
  | 'C2_medium_industrial'
  | 'C3_large_industrial'
  | 'C4_extractive'
  // Hotels
  | 'D1_hotel_post2008'
  | 'D2_hotel_pre2008_flat'
  | 'D2_hotel_pre2008_tou'
  | 'D3_hotel_low_star' // ≤3★ → priced as B1 commercial
  // Hospitals
  | 'E1_private_hospital'
  | 'E2_govt_hospital' // → priced via G1 standard 7-tier
  // Agriculture
  | 'F1_agri_std'
  | 'F2_agri_legacy'
  | 'F3_agri_mixed_well'
  // Special
  | 'G1_standard_7tier'
  | 'G2_water_pumping'
  | 'G3_street_lighting'
  | 'G4_govt_armed_forces'
  | 'G5_ev_home'
  | 'G6_ev_public_wholesale'
  | 'G7_broadcasting'
  | 'G8_ports';

/** Coarse class used to pick add-ons (TV fee, min bill, meter rent default). */
export type CustomerClass =
  | 'residential'
  | 'commercial'
  | 'industrial'
  | 'hotel'
  | 'hospital'
  | 'agriculture'
  | 'special';

export const SECTOR_TO_CLASS: Record<SectorCode, CustomerClass> = {
  A1_subsidized: 'residential',
  A2_unsubsidized: 'residential',
  B1_commercial: 'commercial',
  B2_temp_commercial: 'commercial',
  B3_banks: 'commercial',
  B4_telecom: 'commercial',
  C1_small_industrial: 'industrial',
  C2_medium_industrial: 'industrial',
  C3_large_industrial: 'industrial',
  C4_extractive: 'industrial',
  D1_hotel_post2008: 'hotel',
  D2_hotel_pre2008_flat: 'hotel',
  D2_hotel_pre2008_tou: 'hotel',
  D3_hotel_low_star: 'hotel',
  E1_private_hospital: 'hospital',
  E2_govt_hospital: 'hospital',
  F1_agri_std: 'agriculture',
  F2_agri_legacy: 'agriculture',
  F3_agri_mixed_well: 'agriculture',
  G1_standard_7tier: 'special',
  G2_water_pumping: 'special',
  G3_street_lighting: 'special',
  G4_govt_armed_forces: 'special',
  G5_ev_home: 'special',
  G6_ev_public_wholesale: 'special',
  G7_broadcasting: 'special',
  G8_ports: 'special',
};

// ---------------------------------------------------------------------------
// TOU windows — year-round, no seasonal split
// (EMRC 2025 Guide §XII.a–e; EMRC Council may redefine via §XII.f.)
// ---------------------------------------------------------------------------

export const TOU_WINDOWS = {
  peak: { startHour: 17, endHour: 23, durationHours: 6 },         // 17:00–23:00
  partialDay: { startHour: 14, endHour: 17, durationHours: 3 },   // 14:00–17:00
  partialNight: { startHour: 23, endHour: 5, durationHours: 6 },  // 23:00–05:00
  offPeak: { startHour: 5, endHour: 14, durationHours: 9 },       // 05:00–14:00
  legacyDay: { startHour: 7, endHour: 23, durationHours: 16 },    // 07:00–23:00
  legacyNight: { startHour: 23, endHour: 7, durationHours: 8 },   // 23:00–07:00
} as const;

// ---------------------------------------------------------------------------
// Tier and TOU structures
// ---------------------------------------------------------------------------

export interface TariffTier {
  upToKWh: number; // upper limit of this tier (use Infinity for last)
  rateFils: number; // fils/kWh
}

export interface ThreePeriodTOU {
  peakFils: number; // 17:00–23:00
  partialFils: number; // 14:00–17:00 + 23:00–05:00
  offPeakFils: number; // 05:00–14:00
}

export interface SectorTariff {
  code: SectorCode;
  label: string;
  /** How import energy is priced. */
  pricingModel: 'tiered' | 'tou3' | 'flat' | 'mixed_well';
  tiers?: TariffTier[];
  tou3?: ThreePeriodTOU;
  flatFils?: number;
  /** Temporary subscription rate (fils/kWh). null = no published temp rate. */
  temporaryFils?: number | null;
  /** Override sector default min bill (JD). */
  minBillJD?: number;
  /** PF penalty applies to this sector (industrial/agri/hotels 3-part). */
  pfPenaltyApplies?: boolean;
  /** Phase 2 mandatory TOU since 1/1/2025 — no flat alternative survives. */
  phase2MandatoryTOU?: boolean;
  /** Cash subsidies by consumption band (JD, negative = credit on bill). */
  cashSubsidies?: { fromKWh: number; toKWh: number; jd: number }[];
  notes?: string;
}

// ---------------------------------------------------------------------------
// EMRC 2025 sector tariff table
// (effective 1 Jan 2025; reflects audit corrections in §2 of the spec audit)
// ---------------------------------------------------------------------------

export const SECTOR_TARIFFS: Record<SectorCode, SectorTariff> = {
  // ---- Residential ------------------------------------------------------
  A1_subsidized: {
    code: 'A1_subsidized',
    label: 'Residential — subsidized (A1)',
    pricingModel: 'tiered',
    tiers: [
      { upToKWh: 300, rateFils: 50 },
      { upToKWh: 600, rateFils: 100 },
      { upToKWh: Infinity, rateFils: 200 },
    ],
    cashSubsidies: [
      { fromKWh: 51, toKWh: 200, jd: -2.5 },
      { fromKWh: 201, toKWh: 600, jd: -2.0 },
    ],
    minBillJD: 1.75,
    notes: 'Eligibility: 1 meter, Jordanian (or Gazan Palestinian, women heads of family, Armed Forces auto-enrolled); subsidy lost on PV inverter >3.6 kW (1-ph) or parallel three-phase >10 kW.',
  },
  A2_unsubsidized: {
    code: 'A2_unsubsidized',
    label: 'Residential — unsubsidized (A2)',
    pricingModel: 'tiered',
    tiers: [
      { upToKWh: 1000, rateFils: 120 },
      { upToKWh: Infinity, rateFils: 150 },
    ],
    temporaryFils: 150,
    minBillJD: 1.75,
  },

  // ---- Commercial -------------------------------------------------------
  B1_commercial: {
    code: 'B1_commercial',
    label: 'Commercial (B1)',
    pricingModel: 'tiered',
    tiers: [
      { upToKWh: 2000, rateFils: 120 },
      { upToKWh: Infinity, rateFils: 152 },
    ],
    temporaryFils: 185,
  },
  B2_temp_commercial: {
    code: 'B2_temp_commercial',
    label: 'Commercial — temporary subscription (B2)',
    pricingModel: 'flat',
    flatFils: 185,
  },
  B3_banks: {
    code: 'B3_banks',
    label: 'Banks (B3, TOU since 1/1/2025)',
    pricingModel: 'tou3',
    tou3: { peakFils: 298, partialFils: 287, offPeakFils: 278 },
    temporaryFils: 285,
    phase2MandatoryTOU: true,
    notes: 'Pre-TOU flat rate 285 fils CONFIRMED by NEPCO/EMRC tariff book (Electricity Tariff Instructions eff. 1/1/2020, rates upd. 1/4/2022). Banks moved to mandatory TOU in Phase 2 (1/1/2025) per EMRC/MEMR press, but the per-period peak/partial/off-peak fils are NOT published; 298/287/278 is a reconstruction around the 285 anchor — verify against a post-2025 bill.',
  },
  B4_telecom: {
    code: 'B4_telecom',
    label: 'Telecommunications (B4, TOU)',
    pricingModel: 'tou3',
    tou3: { peakFils: 152, partialFils: 142, offPeakFils: 132 },
    temporaryFils: 170,
  },

  // ---- Industrial (demand charges abolished since 1/7/2024) -------------
  C1_small_industrial: {
    code: 'C1_small_industrial',
    label: 'Small industrial ≤200 kW (C1)',
    pricingModel: 'tiered',
    tiers: [
      { upToKWh: 10000, rateFils: 60 },
      { upToKWh: Infinity, rateFils: 68 },
    ],
    temporaryFils: 115,
    // C1 has no TOU and no demand charge; PF penalty does NOT apply.
  },
  C2_medium_industrial: {
    code: 'C2_medium_industrial',
    label: 'Medium industrial (C2, TOU)',
    pricingModel: 'tou3',
    // Audit fix: Partial 0.068 → 0.069 (69 fils)
    tou3: { peakFils: 79, partialFils: 69, offPeakFils: 59 },
    temporaryFils: 115,
    pfPenaltyApplies: true,
  },
  C3_large_industrial: {
    code: 'C3_large_industrial',
    label: 'Large industrial (C3, TOU)',
    pricingModel: 'tou3',
    tou3: { peakFils: 130, partialFils: 120, offPeakFils: 110 },
    temporaryFils: 123,
    pfPenaltyApplies: true,
  },
  C4_extractive: {
    code: 'C4_extractive',
    label: 'Extractive industries (C4, TOU)',
    pricingModel: 'tou3',
    tou3: { peakFils: 226, partialFils: 216, offPeakFils: 206 },
    temporaryFils: 230,
    pfPenaltyApplies: true,
  },

  // ---- Hotels -----------------------------------------------------------
  D1_hotel_post2008: {
    code: 'D1_hotel_post2008',
    label: 'Hotel 4★+ post-14/3/2008 (D1, TOU)',
    pricingModel: 'tou3',
    tou3: { peakFils: 94, partialFils: 82, offPeakFils: 73 },
    temporaryFils: 115,
    pfPenaltyApplies: true,
    notes: 'Pre-TOU rate CONFIRMED by NEPCO/EMRC tariff book (eff. 1/4/2022): flat 82 fils, or legacy 2-part day/night 82/82 (max-load tariff 0). Mandatory 3-part for 4★+ connected since 14/3/2008; the post-Phase-2 per-period values (94/82/73) are reconstructed around the 82 anchor — verify against a post-2025 bill.',
  },
  D2_hotel_pre2008_flat: {
    code: 'D2_hotel_pre2008_flat',
    label: 'Hotel 4★+ pre-14/3/2008 (D2, flat option)',
    pricingModel: 'flat',
    flatFils: 82,
    temporaryFils: 115,
  },
  D2_hotel_pre2008_tou: {
    code: 'D2_hotel_pre2008_tou',
    label: 'Hotel 4★+ pre-14/3/2008 (D2, TOU option)',
    pricingModel: 'tou3',
    tou3: { peakFils: 94, partialFils: 82, offPeakFils: 73 },
    temporaryFils: 115,
    pfPenaltyApplies: true,
  },
  D3_hotel_low_star: {
    code: 'D3_hotel_low_star',
    label: 'Hotel ≤3★ (industry practice: priced as B1 commercial)',
    pricingModel: 'tiered',
    tiers: [
      { upToKWh: 2000, rateFils: 120 },
      { upToKWh: Infinity, rateFils: 152 },
    ],
    temporaryFils: 185,
    notes: 'Not explicitly carved out in EMRC §16; treated as commercial B1 by industry practice.',
  },

  // ---- Hospitals --------------------------------------------------------
  E1_private_hospital: {
    code: 'E1_private_hospital',
    label: 'Private hospital (E1, Phase-2 mandatory TOU since 1/1/2025)',
    pricingModel: 'tou3',
    // Peak ≈151 reported (Al-Ghad / Private Hospitals Association); partial &
    // off-peak NOT published in any retrieved source. Treat as editable defaults.
    tou3: { peakFils: 151, partialFils: 140, offPeakFils: 130 },
    temporaryFils: 170,
    phase2MandatoryTOU: true,
    notes: 'Pre-TOU flat rate 140 fils CONFIRMED by NEPCO/EMRC tariff book (eff. 1/1/2020). Mandatory TOU since Phase 2 (1/1/2025); only peak ≈151 reported (Al-Ghad / Private Hospitals Association). Partial/off-peak (140/130) reconstructed around the 140 anchor — verify against a post-2025 bill.',
  },
  E2_govt_hospital: {
    code: 'E2_govt_hospital',
    label: 'Government hospital (E2 → Standard 7-tier G1)',
    pricingModel: 'tiered',
    tiers: [
      { upToKWh: 160, rateFils: 42 },
      { upToKWh: 300, rateFils: 92 },
      { upToKWh: 500, rateFils: 109 },
      { upToKWh: 750, rateFils: 145 },
      { upToKWh: 1000, rateFils: 169 },
      { upToKWh: 2000, rateFils: 190 },
      { upToKWh: Infinity, rateFils: 256 },
    ],
    temporaryFils: 266,
  },

  // ---- Agriculture ------------------------------------------------------
  F1_agri_std: {
    code: 'F1_agri_std',
    label: 'Agriculture — standard post-2008 ≤100 kVA (F1, flat)',
    pricingModel: 'flat',
    flatFils: 55,
    temporaryFils: 115,
  },
  F2_agri_legacy: {
    code: 'F2_agri_legacy',
    label: 'Agriculture — legacy day/night (F2)',
    pricingModel: 'tou3',
    // Legacy uses Day/Night, not 3-period TOU. We map Day → offPeak+partial,
    // Night → "peakFils slot reused as Night". Caller should use legacyDay/Night
    // helpers; tou3 fields here carry day/night as a degenerate mapping.
    tou3: { peakFils: 55, partialFils: 55, offPeakFils: 49 },
    temporaryFils: 115,
    pfPenaltyApplies: true,
    notes: 'Day 07:00–23:00 = 55 fils; Night 23:00–07:00 = 49 fils. Use priceLegacyDayNight() for accurate billing.',
  },
  F3_agri_mixed_well: {
    code: 'F3_agri_mixed_well',
    label: 'Agriculture — mixed-use well (F3)',
    pricingModel: 'mixed_well',
    // Effective rate = 2/3 × 120 + 1/3 × 55 = 98.33 fils/kWh
    flatFils: (2 / 3) * 120 + (1 / 3) * 55,
    temporaryFils: 115,
    notes: 'Formula: 2/3 × 0.120 + 1/3 × 0.055 (NEPCO §13).',
  },

  // ---- Special ----------------------------------------------------------
  G1_standard_7tier: {
    code: 'G1_standard_7tier',
    label: 'Standard 7-tier (G1)',
    pricingModel: 'tiered',
    tiers: [
      { upToKWh: 160, rateFils: 42 },
      { upToKWh: 300, rateFils: 92 },
      { upToKWh: 500, rateFils: 109 },
      { upToKWh: 750, rateFils: 145 },
      { upToKWh: 1000, rateFils: 169 },
      { upToKWh: 2000, rateFils: 190 },
      { upToKWh: Infinity, rateFils: 256 },
    ],
    temporaryFils: 266,
  },
  G2_water_pumping: {
    code: 'G2_water_pumping',
    label: 'Water pumping (G2, Phase-2 mandatory TOU since 1/1/2025)',
    pricingModel: 'tou3',
    // Audit fix: Partial 0.096 → 0.095; flat 0.095 option REMOVED.
    tou3: { peakFils: 106, partialFils: 95, offPeakFils: 86 },
    temporaryFils: 115,
    phase2MandatoryTOU: true,
  },
  G3_street_lighting: {
    code: 'G3_street_lighting',
    label: 'Street lighting (G3, flat)',
    pricingModel: 'flat',
    flatFils: 114,
  },
  G4_govt_armed_forces: {
    code: 'G4_govt_armed_forces',
    label: 'Government / Armed Forces (G4, Phase-2 mandatory TOU since 1/1/2025)',
    pricingModel: 'tou3',
    // Audit fix: flat 0.146 option REMOVED — sector is mandatory TOU.
    tou3: { peakFils: 158, partialFils: 147, offPeakFils: 138 },
    temporaryFils: 156,
    phase2MandatoryTOU: true,
  },
  G5_ev_home: {
    code: 'G5_ev_home',
    label: 'EV home charging (G5, TOU)',
    pricingModel: 'tou3',
    tou3: { peakFils: 160, partialFils: 118, offPeakFils: 108 },
  },
  G6_ev_public_wholesale: {
    code: 'G6_ev_public_wholesale',
    label: 'EV public charging — regulated wholesale rate (G6, TOU)',
    pricingModel: 'tou3',
    tou3: { peakFils: 133, partialFils: 113, offPeakFils: 103 },
    temporaryFils: 185,
    notes: 'Retail price at the plug = wholesale + operator commission (~3.5 fils/kWh slow chargers, ~5 fils/kWh fast). See EV_PUBLIC_OPERATOR_COMMISSION_FILS.',
  },
  G7_broadcasting: {
    code: 'G7_broadcasting',
    label: 'Broadcasting (G7, flat)',
    pricingModel: 'flat',
    flatFils: 152,
  },
  G8_ports: {
    code: 'G8_ports',
    label: 'Ports (G8, flat)',
    pricingModel: 'flat',
    flatFils: 159,
  },
};

/** Regulated operator commission added on top of G6 wholesale rate. */
export const EV_PUBLIC_OPERATOR_COMMISSION_FILS = {
  slow: 3.5,
  fast: 5.0,
} as const;

// ---------------------------------------------------------------------------
// Universal add-ons
// ---------------------------------------------------------------------------

export const RURAL_FILS_PER_KWH = 1; // NEPCO §V / EMRC §VI — universal
export const TV_FEE_JD_PER_MONTH = 1.0; // Residential default (1979 regulation)
export const METER_RENT_JD = { singlePhase: 0.2, threePhase: 0.5 } as const;
export const MIN_BILL_JD = { residential: 1.75, nonResidential: 2.0 } as const;

/**
 * Monthly fuel-clause (fils/kWh). Sector-wide, set monthly by EMRC. Confirmed
 * values for 2026 so far are all zero (Jan through May per EMRC monthly
 * bulletins; April–May 2026 reconfirmed in the May 2026 announcement).
 *
 * Fuel clause applies to **imported kWh only**, never to exported kWh under
 * any prosumer mechanism. Future months default to 0 until EMRC publishes a
 * non-zero value. Keyed by ISO YYYY-MM.
 */
export const FUEL_CLAUSE_FILS_BY_MONTH: Record<string, number> = {
  '2026-01': 0,
  '2026-02': 0,
  '2026-03': 0,
  '2026-04': 0,
  '2026-05': 0,
};

export function getFuelClauseFils(monthKey: string): number {
  return FUEL_CLAUSE_FILS_BY_MONTH[monthKey] ?? 0;
}

export type WasteClass = 'A' | 'B' | 'C' | null;
export const WASTE_FEE_JD: Record<Exclude<WasteClass, null>, number> = {
  A: 3.0,
  B: 2.0,
  C: 1.667,
};

/**
 * Greater Amman Municipality (GAM) electricity fee:
 *   - ≤200 kWh: 1.667 JD
 *   - >200 kWh: 1.667 + 0.005 × (kWh − 200)
 * Unchanged since 2006.
 */
export function gamMunicipalFeeJD(monthlyKWh: number): number {
  if (monthlyKWh <= 200) return 1.667;
  return 1.667 + 0.005 * (monthlyKWh - 200);
}

export interface AddOnInputs {
  sector: SectorCode;
  monthlyImportKWh: number;
  monthKey: string; // 'YYYY-MM' for fuel-clause lookup
  meterPhase: 1 | 3;
  applyTvFee: boolean; // residential default true
  applyGAM: boolean; // true if customer is in Greater Amman Municipality
  wasteClass: WasteClass; // null = no waste fee
  applyRuralFils: boolean;
  applyMeterRent: boolean;
}

export interface AddOnBreakdown {
  ruralFilsJD: number;
  fuelClauseJD: number;
  tvFeeJD: number;
  meterRentJD: number;
  gamJD: number;
  wasteJD: number;
  totalJD: number;
}

export function calcUniversalAddOns(input: AddOnInputs): AddOnBreakdown {
  const filsToJD = (fils: number) => fils / 1000;
  const ruralFilsJD = input.applyRuralFils
    ? filsToJD(RURAL_FILS_PER_KWH * input.monthlyImportKWh)
    : 0;
  const fuelClauseJD = filsToJD(getFuelClauseFils(input.monthKey) * input.monthlyImportKWh);
  const tvFeeJD = input.applyTvFee && SECTOR_TO_CLASS[input.sector] === 'residential'
    ? TV_FEE_JD_PER_MONTH
    : 0;
  const meterRentJD = input.applyMeterRent
    ? input.meterPhase === 3
      ? METER_RENT_JD.threePhase
      : METER_RENT_JD.singlePhase
    : 0;
  const gamJD = input.applyGAM ? gamMunicipalFeeJD(input.monthlyImportKWh) : 0;
  const wasteJD = input.wasteClass ? WASTE_FEE_JD[input.wasteClass] : 0;
  const totalJD = ruralFilsJD + fuelClauseJD + tvFeeJD + meterRentJD + gamJD + wasteJD;
  return { ruralFilsJD, fuelClauseJD, tvFeeJD, meterRentJD, gamJD, wasteJD, totalJD };
}

// ---------------------------------------------------------------------------
// Minimum bill
// ---------------------------------------------------------------------------

export function applyMinimumBillJD(rawBillJD: number, sector: SectorCode): number {
  const klass = SECTOR_TO_CLASS[sector];
  const def = SECTOR_TARIFFS[sector].minBillJD;
  const floor =
    def ??
    (klass === 'residential' ? MIN_BILL_JD.residential : MIN_BILL_JD.nonResidential);
  return Math.max(rawBillJD, floor);
}

// ---------------------------------------------------------------------------
// Power-factor penalty (NEPCO §I.1.d)
// Threshold 0.88, step = round((0.88 − pf)/0.01), % per step varies by band.
// Applies to: industrial C2/C3/C4, 3-part agri F2, 3-part 4★+ hotels D1/D2.
// ---------------------------------------------------------------------------

export function powerFactorSurchargeJD(billJD: number, powerFactor: number): number {
  if (powerFactor >= 0.88 || powerFactor <= 0) return 0;
  const steps = Math.round((0.88 - powerFactor) / 0.01);
  let pctPerStep: number;
  if (powerFactor >= 0.7) pctPerStep = 0.77;
  else if (powerFactor >= 0.6) pctPerStep = 0.95;
  else if (powerFactor >= 0.5) pctPerStep = 1.2;
  else pctPerStep = 1.5;
  return billJD * (pctPerStep * steps) / 100;
}

export function sectorAllowsPFPenalty(sector: SectorCode): boolean {
  return SECTOR_TARIFFS[sector].pfPenaltyApplies === true;
}

// ---------------------------------------------------------------------------
// Tiered / TOU / flat pricing helpers
// ---------------------------------------------------------------------------

export function priceTieredJD(monthlyKWh: number, tiers: TariffTier[]): number {
  let remaining = monthlyKWh;
  let consumed = 0;
  let totalFils = 0;
  for (const tier of tiers) {
    if (remaining <= 0) break;
    const tierCapacity = tier.upToKWh === Infinity ? remaining : Math.max(0, tier.upToKWh - consumed);
    const take = Math.min(remaining, tierCapacity);
    totalFils += take * tier.rateFils;
    remaining -= take;
    consumed += take;
  }
  return totalFils / 1000;
}

export function priceTOU3JD(
  kwhByPeriod: { peak: number; partial: number; offPeak: number },
  tou: ThreePeriodTOU,
): number {
  const totalFils =
    kwhByPeriod.peak * tou.peakFils +
    kwhByPeriod.partial * tou.partialFils +
    kwhByPeriod.offPeak * tou.offPeakFils;
  return totalFils / 1000;
}

export function priceFlatJD(monthlyKWh: number, rateFils: number): number {
  return (monthlyKWh * rateFils) / 1000;
}

/** Legacy day/night pricing (F2 agriculture). */
export function priceLegacyDayNightJD(
  kwhByPeriod: { day: number; night: number },
  dayFils: number,
  nightFils: number,
): number {
  return (kwhByPeriod.day * dayFils + kwhByPeriod.night * nightFils) / 1000;
}

/** Dispatch pricing for any sector. */
export interface PriceImportInput {
  sector: SectorCode;
  monthlyKWh: number;
  kwhByPeriod?: { peak: number; partial: number; offPeak: number };
  isTemporary?: boolean;
}

export function priceImportJD(input: PriceImportInput): number {
  const tariff = SECTOR_TARIFFS[input.sector];
  if (input.isTemporary && tariff.temporaryFils != null) {
    return priceFlatJD(input.monthlyKWh, tariff.temporaryFils);
  }
  switch (tariff.pricingModel) {
    case 'tiered':
      return priceTieredJD(input.monthlyKWh, tariff.tiers!);
    case 'tou3': {
      const k =
        input.kwhByPeriod ??
        { peak: 0, partial: 0, offPeak: input.monthlyKWh };
      return priceTOU3JD(k, tariff.tou3!);
    }
    case 'flat':
    case 'mixed_well':
      return priceFlatJD(input.monthlyKWh, tariff.flatFils!);
  }
}

// ---------------------------------------------------------------------------
// Net Billing — Bylaw 58/2024
// ---------------------------------------------------------------------------

/**
 * The five prosumer mechanisms currently operative in Jordan.
 *   M1–M4 are defined by Bylaw 58/2024 (Official Gazette 19 Aug 2024).
 *   M5 is the pre-existing kWh-for-kWh net-metering regime issued under
 *   EMRC Instructions under Article 10/B of REEEL No. 13/2012, preserved
 *   by Article 10-bis of Law 12/2024 for systems with formal connection
 *   approval before 1 June 2024.
 */
export type NetBillingMechanism =
  | 'M1_net_value_offsite' // wheeling: small/med industrial, hotels, agri; 50% cap
  | 'M2_net_value_onsite' // net billing (default for residential)
  | 'M3_zero_export' // all except banks/normal/extractive; export-limiter required
  | 'M4_buy_all_sell_all' // separate meter; zero grid fee universal
  | 'M5_legacy_net_metering'; // grandfathered pre-1/6/2024; true 1:1 kWh netting

export const NB_RESIDENTIAL_EXPORT_RATE_JD = 0.05; // EMRC chair Sa'aydeh 4/9/2024
export const NB_NONRES_EXPORT_RATE_JD = 0.04; // Buy-All baseline; sector-specific in NB Mechanism 2

/** Grid-service fee per inverter kWac per month (Bylaw 58/2024 §V). */
export interface GridFeeInput {
  sector: SectorCode;
  mechanism: NetBillingMechanism;
  inverterKWac: number;
  /** True if application is dated 1/6/2024 or later (post-Bylaw). */
  postBylawApplication: boolean;
  /** NAF / Takaful 1&3 / Royal Initiative beneficiary → exempt. */
  isWelfareBeneficiary?: boolean;
}

export function gridServiceFeeJD(input: GridFeeInput): number {
  // Buy-All/Sell-All is exempt regardless of sector.
  if (input.mechanism === 'M4_buy_all_sell_all') return 0;
  // Legacy net-metering (M5) is NOT subject to the new Bylaw 58 grid
  // service fee per statutory reading of Article 10-bis (Law 12/2024).
  // EMRC has not issued an explicit FAQ confirming this — verify before
  // launch if any legacy customer disputes a fee charge.
  if (input.mechanism === 'M5_legacy_net_metering') return 0;
  // Welfare beneficiaries always exempt.
  if (input.isWelfareBeneficiary) return 0;

  const klass = SECTOR_TO_CLASS[input.sector];

  if (klass === 'residential') {
    // 1/6/2024 cutover: new applications pay 1.000; legacy 2.000.
    const ratePerKWac = input.postBylawApplication ? 1.0 : 2.0;
    return input.inverterKWac * ratePerKWac;
  }

  // Non-residential: by sector
  switch (input.sector) {
    case 'C1_small_industrial':
    case 'C2_medium_industrial':
      return 0; // small/medium industrial exempt
    case 'F1_agri_std':
    case 'F2_agri_legacy':
    case 'F3_agri_mixed_well':
      return 0; // agriculture exempt
    case 'D1_hotel_post2008':
    case 'D2_hotel_pre2008_flat':
    case 'D2_hotel_pre2008_tou':
    case 'D3_hotel_low_star':
      // Mechanism 1 off-site for hotels: ≈ 2.5 JD/kWac/month
      if (input.mechanism === 'M1_net_value_offsite') return input.inverterKWac * 2.5;
      return input.inverterKWac * 2.5;
    case 'B1_commercial':
    case 'B2_temp_commercial':
    case 'B3_banks':
    case 'B4_telecom':
    case 'C3_large_industrial':
    case 'C4_extractive':
    case 'E1_private_hospital':
    case 'E2_govt_hospital':
    case 'G1_standard_7tier':
    case 'G2_water_pumping':
    case 'G3_street_lighting':
    case 'G4_govt_armed_forces':
    case 'G5_ev_home':
    case 'G6_ev_public_wholesale':
    case 'G7_broadcasting':
    case 'G8_ports':
      return input.inverterKWac * 13.0; // commercial / banks / normal tariff
    default:
      return input.inverterKWac * 13.0;
  }
}

/** Default export rate (JD/kWh) for Net-Billing Mechanism 2. */
export function netBillingExportRateJD(sector: SectorCode): number {
  return SECTOR_TO_CLASS[sector] === 'residential'
    ? NB_RESIDENTIAL_EXPORT_RATE_JD
    : NB_NONRES_EXPORT_RATE_JD;
}

// ---------------------------------------------------------------------------
// Subsidy-loss trigger for prosumers (EMRC tariff PDF §6.‫)ج‬
// ---------------------------------------------------------------------------
// The 3.6 kWac single-phase threshold applies on single-phase meters only.
// Three-phase residential metering follows a 10 kWac inverter cap but the
// subsidy-loss trigger on 3-phase is not explicitly published — we use the
// inverter cap as the conservative trigger.
// ---------------------------------------------------------------------------

export const SUBSIDY_LOSS_TRIGGER_KW = {
  singlePhaseInverter: 3.6, // formerly described as "16 A × 230 V" — equivalent
  threePhaseParallel: 10,
} as const;

export function losesResidentialSubsidy(
  inverterKWac: number,
  phase: 1 | 3,
): boolean {
  if (phase === 1) return inverterKWac > SUBSIDY_LOSS_TRIGGER_KW.singlePhaseInverter;
  return inverterKWac > SUBSIDY_LOSS_TRIGGER_KW.threePhaseParallel;
}

// ---------------------------------------------------------------------------
// PV sizing constants (Bylaw 58/2024 common framework)
// ---------------------------------------------------------------------------

/** EMRC standard specific yield (kWh per kWp DC per year). */
export const SPECIFIC_YIELD_KWH_PER_KWP_YEAR = 1800;
/** Monthly equivalent: 1,800 / 12 = 150 kWh/kWp/month. */
export const SPECIFIC_YIELD_KWH_PER_KWP_MONTH = SPECIFIC_YIELD_KWH_PER_KWP_YEAR / 12;

/**
 * DC : AC ratio caps from the Bylaw 58/2024 annex.
 *   Residential single-phase: 1.5  → a 3.6 kWac inverter can carry 5.4 kWp DC.
 *   All other sectors:        1.2
 */
export const DC_AC_RATIO = {
  residential: 1.5,
  nonResidential: 1.2,
} as const;

/**
 * Maximum inverter nameplate (kWac) for residential prosumers.
 *   Single-phase: 3.6 kWac (≈ 5.4 kWp DC at 1.5 ratio)
 *   Three-phase:  10  kWac (≈ 15  kWp DC at 1.5 ratio)
 * Non-residential has no hard kWac cap — sizing is constrained by the
 * grid-impact study at the off-take and generation sites (the 2019
 * 1 MW project ceiling was lifted in September 2024).
 */
export const RESIDENTIAL_INVERTER_CAP_KWAC = {
  singlePhase: 3.6,
  threePhase: 10,
} as const;

/** kWp_DC from kWac for a given customer class. */
export function kWpFromKWac(kWac: number, sectorClass: CustomerClass): number {
  const ratio = sectorClass === 'residential' ? DC_AC_RATIO.residential : DC_AC_RATIO.nonResidential;
  return kWac * ratio;
}

/** kWac from kWp_DC (inverse of kWpFromKWac). */
export function kWacFromKWp(kWp: number, sectorClass: CustomerClass): number {
  const ratio = sectorClass === 'residential' ? DC_AC_RATIO.residential : DC_AC_RATIO.nonResidential;
  return kWp / ratio;
}

/**
 * Inverter sizing from a target monthly PV generation (kWh). Uses the EMRC
 * specific yield (150 kWh/kWp/month) and the sector's DC:AC ratio.
 *
 *     kWp_DC  = monthlyKWh / 150
 *     kWac    = kWp_DC / DC:AC
 */
export function inverterKWacFromMonthlyKWh(
  monthlyKWh: number,
  sectorClass: CustomerClass,
): number {
  const kWp = monthlyKWh / SPECIFIC_YIELD_KWH_PER_KWP_MONTH;
  return kWacFromKWp(kWp, sectorClass);
}

/**
 * Apply the residential inverter cap. Returns the capped kWac and a flag
 * indicating whether the cap was binding. Non-residential pass-through.
 */
export function applyResidentialInverterCap(
  kWac: number,
  phase: 1 | 3,
  sectorClass: CustomerClass,
): { kWac: number; capped: boolean; cap: number | null } {
  if (sectorClass !== 'residential') return { kWac, capped: false, cap: null };
  const cap =
    phase === 1
      ? RESIDENTIAL_INVERTER_CAP_KWAC.singlePhase
      : RESIDENTIAL_INVERTER_CAP_KWAC.threePhase;
  if (kWac > cap) return { kWac: cap, capped: true, cap };
  return { kWac, capped: false, cap };
}

// ---------------------------------------------------------------------------
// System-size caps per mechanism (% of last 12 months' consumption)
// ---------------------------------------------------------------------------

/**
 * Cap on annual PV generation as a fraction of the prosumer's last 12 months
 * of consumption.
 *   M1 wheeling                : 50 %  (all eligible sectors)
 *   M2 net billing residential : 100 %
 *   M2 net billing non-res     : 50 %
 *   M3 zero export             : 100 % (any sector)
 *   M4 buy-all/sell-all        : 100 %
 *   M5 legacy                  : ≤ prosumer's annual consumption (per original
 *                                contract; pre-2024 default = 100 %)
 */
export function mechanismGenerationCapFraction(
  mechanism: NetBillingMechanism,
  sectorClass: CustomerClass,
): number {
  switch (mechanism) {
    case 'M1_net_value_offsite':
      return 0.5;
    case 'M2_net_value_onsite':
      return sectorClass === 'residential' ? 1.0 : 0.5;
    case 'M3_zero_export':
      return 1.0;
    case 'M4_buy_all_sell_all':
      return 1.0;
    case 'M5_legacy_net_metering':
      return 1.0;
  }
}

// ---------------------------------------------------------------------------
// Sector × mechanism eligibility matrix
// ---------------------------------------------------------------------------

export type EligibilityStatus = 'eligible' | 'ineligible' | 'unclear';

/**
 * Eligibility lookup for sector × mechanism. Values map the Part-3 matrix
 * in the Bylaw 58/2024 engine specification. "unclear" cells are flagged in
 * the spec as requiring EMRC confirmation; they should NOT be auto-blocked
 * — surface as warnings instead.
 */
export function isEligibleForMechanism(
  sector: SectorCode,
  mechanism: NetBillingMechanism,
): EligibilityStatus {
  // M5 legacy is conditional on pre-1/6/2024 approval — surface as
  // "unclear" so the caller must explicitly confirm the approval date.
  if (mechanism === 'M5_legacy_net_metering') return 'unclear';
  // M4 Buy-All/Sell-All is the universal fallback.
  if (mechanism === 'M4_buy_all_sell_all') return 'eligible';

  const klass = SECTOR_TO_CLASS[sector];

  if (mechanism === 'M1_net_value_offsite') {
    // Only small/med industrial, hotels, agriculture are explicitly named.
    if (sector === 'C1_small_industrial' || sector === 'C2_medium_industrial') return 'eligible';
    if (klass === 'hotel') return 'eligible';
    if (klass === 'agriculture') return 'eligible';
    if (klass === 'residential') return 'ineligible';
    // Large industrial in practice migrates to BOO/PPA track outside the
    // four-mechanism framework.
    if (sector === 'C3_large_industrial') return 'unclear';
    return 'unclear';
  }

  if (mechanism === 'M2_net_value_onsite') {
    // EMRC press release explicitly named five sectors: small_industrial,
    // medium_industrial, hotel, agriculture, residential.
    if (klass === 'residential') return 'eligible';
    if (sector === 'C1_small_industrial' || sector === 'C2_medium_industrial') return 'eligible';
    if (klass === 'hotel') return 'eligible';
    if (klass === 'agriculture') return 'eligible';
    // All others may be eligible via implicit commercial/government band
    // (EcoMENA analysis implies commercial is in citing ~13 JD/kWac fee);
    // EMRC press list is narrower.
    if (sector === 'C4_extractive' || sector === 'B3_banks') return 'ineligible';
    return 'unclear';
  }

  if (mechanism === 'M3_zero_export') {
    // All except banks/normal/extractive.
    if (sector === 'B3_banks' || sector === 'C4_extractive') return 'ineligible';
    // "Ordinary" tariff (G1 standard 7-tier) is also explicitly excluded
    // in the spec; treat as ineligible.
    if (sector === 'G1_standard_7tier') return 'ineligible';
    return 'eligible';
  }

  return 'unclear';
}

// ---------------------------------------------------------------------------
// Mechanism 1 (wheeling) TOU windows
// ---------------------------------------------------------------------------
// Wheeling uses different TOU windows than the standard EMRC schedule used
// for the rest of the tariff system. The off-peak block absorbs the
// 14:00–17:00 mid-afternoon hours.
// ---------------------------------------------------------------------------

export const WHEELING_TOU_WINDOWS = {
  offPeak: { startHour: 5, endHour: 17, durationHours: 12 },  // 05–17
  peak: { startHour: 17, endHour: 23, durationHours: 6 },      // 17–23
  partial: { startHour: 23, endHour: 5, durationHours: 6 },    // 23–05
} as const;

/**
 * Map the project's four monthly factor buckets (y1=05–14, y2=14–17,
 * y3=17–23, y4=23–05) onto wheeling's three TOU buckets. The 14–17 hours
 * (y2) are part of wheeling off-peak — NOT partial — under M1.
 */
export function mapFourBucketToWheelingTOU(
  y1: number, y2: number, y3: number, y4: number,
): { offPeak: number; partial: number; peak: number } {
  return { offPeak: y1 + y2, partial: y4, peak: y3 };
}

/**
 * Map the project's four monthly factor buckets onto the standard EMRC
 * 3-period TOU (used by C2/C3/C4 industrial, banks, hotels, hospitals,
 * water pumping, govt, EV, etc).
 */
export function mapFourBucketToStandardTOU(
  y1: number, y2: number, y3: number, y4: number,
): { offPeak: number; partial: number; peak: number } {
  return { offPeak: y1, partial: y2 + y4, peak: y3 };
}

// ---------------------------------------------------------------------------
// Mechanism 5 — Legacy Net Metering (grandfathered pre-1/6/2024)
// ---------------------------------------------------------------------------
// Pure kWh-for-kWh netting, surplus rolls forward monthly, year-end surplus
// is forfeited (historical DISCO practice). Some pre-2024 Instructions
// versions applied an ~80 % credit haircut on exported kWh (DISCOs withheld
// ~20 % for losses/fees) per MDPI Energies 2025 review — verify against the
// legacy Instructions PDF on emrc.gov.jo.
// ---------------------------------------------------------------------------

export const LEGACY_EXPORT_HAIRCUT = 0.8;

export interface LegacyNetMeteringMonthlyInput {
  importsKWh: number;
  exportsKWh: number;
  retailTariffJDPerKWh: number; // resolved per sector / tier
  exportHaircut?: number; // default 0.80
  fuelClauseFils: number;
  priorCarryKWh: number;
}

export interface LegacyNetMeteringMonthlyOutput {
  invoiceJD: number;
  carryKWh: number;
  creditedExportsKWh: number;
  netKWh: number;
}

export function legacyNetMeteringMonthly(
  input: LegacyNetMeteringMonthlyInput,
): LegacyNetMeteringMonthlyOutput {
  const haircut = input.exportHaircut ?? LEGACY_EXPORT_HAIRCUT;
  const creditedExportsKWh = input.exportsKWh * haircut;
  const netKWh = input.importsKWh - creditedExportsKWh - input.priorCarryKWh;
  if (netKWh >= 0) {
    const invoiceJD = netKWh * (input.retailTariffJDPerKWh + input.fuelClauseFils / 1000);
    return { invoiceJD, carryKWh: 0, creditedExportsKWh, netKWh };
  }
  return { invoiceJD: 0, carryKWh: -netKWh, creditedExportsKWh, netKWh };
}

// ---------------------------------------------------------------------------
// Annual credit reset policy (Bylaw 58/2024 — open question)
// ---------------------------------------------------------------------------
// Whether the new monetary Net-Billing regime (M2/M1) preserves the legacy
// year-end forfeiture practice OR introduces cash settlement is the single
// highest-stakes open question for billing-engine math (per Bylaw 58/2024
// engine spec §"Net-billing credit ledger mechanics"). Default to forfeit
// to match legacy practice; flip to 'rollover' or 'cash_out' once EMRC
// publishes a definitive FAQ.
// ---------------------------------------------------------------------------

export type AnnualResetPolicy =
  | 'forfeit_year_end' // legacy default; surplus zeroed at Dec 31
  | 'rollover_indefinite' // hypothetical — preserve indefinitely
  | 'cash_out'; // hypothetical — DISCO pays surplus at year-end

export const DEFAULT_ANNUAL_RESET_POLICY: AnnualResetPolicy = 'forfeit_year_end';

/**
 * Apply the year-end reset to a running credit balance. Returns the balance
 * after reset and the JD amount forfeited / cashed out for reporting.
 */
export function applyAnnualReset(
  runningCreditJD: number,
  policy: AnnualResetPolicy = DEFAULT_ANNUAL_RESET_POLICY,
): { balanceAfter: number; forfeitedJD: number; cashedOutJD: number } {
  switch (policy) {
    case 'forfeit_year_end':
      return { balanceAfter: 0, forfeitedJD: runningCreditJD, cashedOutJD: 0 };
    case 'cash_out':
      return { balanceAfter: 0, forfeitedJD: 0, cashedOutJD: runningCreditJD };
    case 'rollover_indefinite':
      return { balanceAfter: runningCreditJD, forfeitedJD: 0, cashedOutJD: 0 };
  }
}

// ---------------------------------------------------------------------------
// M3 Zero Export — sector-dependent grid fee (placeholder)
// ---------------------------------------------------------------------------
// Per the Bylaw 58/2024 engine spec §"Mechanism 3 / F. Grid Service Fee":
// per-sector schedule "not published"; EMRC stated the fee "can reach zero"
// for some sectors under M3 to preserve grid financial stability. We default
// to the M2 schedule (same numerical values) until EMRC publishes the M3
// table — this is conservative (likely overestimates M3 cost).
// ---------------------------------------------------------------------------

export function gridServiceFeeM3JD(input: Omit<GridFeeInput, 'mechanism'>): number {
  // Reuse the M2 schedule as the upper-bound default. Override per-sector
  // when EMRC publishes M3-specific values.
  return gridServiceFeeJD({ ...input, mechanism: 'M2_net_value_onsite' });
}

// ---------------------------------------------------------------------------
// M4 Buy-All/Sell-All — sub-300 kWh additional exemption
// ---------------------------------------------------------------------------
// "Consumers below 300 kWh/month are explicitly exempt from grid fees under
// M4" — moot in practice because M4 grid fee is universally zero, but
// preserved here for forward-compatibility if EMRC ever introduces an M4 fee.
// ---------------------------------------------------------------------------

export function m4FeeExemptForLowConsumer(monthlyKWh: number): boolean {
  return monthlyKWh < 300;
}

// ---------------------------------------------------------------------------
// Grandfathering hinge (Bylaw 58/2024)
// ---------------------------------------------------------------------------
// Hinge is the date of EMRC/DISCO **approval**, NOT physical commissioning.
// Systems with formal connection approval before 1 June 2024 keep legacy
// (M5) treatment indefinitely for the duration of their original contract.
// Voluntary migration to a Bylaw 58 mechanism is permitted but likely
// irreversible.
// ---------------------------------------------------------------------------

export const BYLAW_58_CUTOVER_DATE = new Date('2024-06-01T00:00:00Z');

export function isLegacyEligible(approvalDateISO: string): boolean {
  return new Date(approvalDateISO) < BYLAW_58_CUTOVER_DATE;
}

// ---------------------------------------------------------------------------
// Customer-type → default sector dispatcher
// ---------------------------------------------------------------------------

/** Default sector for a given coarse customer type and tariff preference. */
export function defaultSectorFor(
  customerType: 'Residential' | 'Industrial' | 'Commercial' | 'Hotels' | 'Hospitals' | 'Agriculture',
  opts?: { subsidized?: boolean; size?: 'small' | 'medium' | 'large' | 'extractive' },
): SectorCode {
  switch (customerType) {
    case 'Residential':
      return opts?.subsidized === false ? 'A2_unsubsidized' : 'A1_subsidized';
    case 'Industrial':
      switch (opts?.size) {
        case 'small': return 'C1_small_industrial';
        case 'large': return 'C3_large_industrial';
        case 'extractive': return 'C4_extractive';
        default: return 'C2_medium_industrial';
      }
    case 'Commercial':
      return 'B1_commercial';
    case 'Hotels':
      return 'D1_hotel_post2008';
    case 'Hospitals':
      return 'E1_private_hospital';
    case 'Agriculture':
      return 'F1_agri_std';
  }
}
