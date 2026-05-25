import type { Express } from "express";
import { setupAuth } from "./fakeAuth";
import { z } from "zod";
import { storage } from "./storage";
import { insertSolarProjectSchema, type CalculationResults, type MonthlyConsumption, type TimeFactors, IndustrialTariffsSchema, TimeFactorsSchema, MonthlyConsumptionSchema } from "../shared/schema";
import {
  type SectorCode,
  type NetBillingMechanism,
  type WasteClass,
  type AnnualResetPolicy,
  SECTOR_TARIFFS,
  SECTOR_TO_CLASS,
  defaultSectorFor,
  priceImportJD,
  priceTOU3JD,
  priceTieredJD,
  priceFlatJD,
  applyMinimumBillJD,
  calcUniversalAddOns,
  powerFactorSurchargeJD,
  sectorAllowsPFPenalty,
  gridServiceFeeJD,
  netBillingExportRateJD,
  SPECIFIC_YIELD_KWH_PER_KWP_MONTH,
  inverterKWacFromMonthlyKWh,
  applyResidentialInverterCap,
  kWpFromKWac,
  mechanismGenerationCapFraction,
  isEligibleForMechanism,
  legacyNetMeteringMonthly,
  LEGACY_EXPORT_HAIRCUT,
  applyAnnualReset,
  DEFAULT_ANNUAL_RESET_POLICY,
  losesResidentialSubsidy,
  mapFourBucketToStandardTOU,
  mapFourBucketToWheelingTOU,
} from "../shared/jordanTariffs";

export async function registerRoutes(app: Express): Promise<void> {
  // Setup fake (demo) authentication routes — replaces Replit/Google OAuth.
  setupAuth(app);

  // Solar PV Calculator API Routes
  
  // Get all projects
  app.get("/api/projects", async (req, res) => {
    try {
      const projects = await storage.getAllSolarProjects();
      res.json(projects);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch projects" });
    }
  });

  // Get single project
  app.get("/api/projects/:id", async (req, res) => {
    try {
      const project = await storage.getSolarProject(req.params.id);
      if (!project) {
        return res.status(404).json({ error: "Project not found" });
      }
      res.json(project);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch project" });
    }
  });

  // Create new project
  app.post("/api/projects", async (req, res) => {
    try {
      const validatedData = insertSolarProjectSchema.parse(req.body);
      const project = await storage.createSolarProject(validatedData);
      res.status(201).json(project);
    } catch (error) {
      res.status(400).json({ error: "Invalid project data", details: error });
    }
  });

  // Update project
  app.put("/api/projects/:id", async (req, res) => {
    try {
      const validatedData = insertSolarProjectSchema.partial().parse(req.body);
      const project = await storage.updateSolarProject(req.params.id, validatedData);
      if (!project) {
        return res.status(404).json({ error: "Project not found" });
      }
      res.json(project);
    } catch (error) {
      res.status(400).json({ error: "Invalid project data", details: error });
    }
  });

  // Delete project
  app.delete("/api/projects/:id", async (req, res) => {
    try {
      const deleted = await storage.deleteSolarProject(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Project not found" });
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete project" });
    }
  });

  // Calculate solar system performance.
  //
  // Tariff math reflects the Jordan EMRC 2025 Tariff Guide and Bylaw 58/2024
  // for net-billing economics (see shared/jordanTariffs.ts for the canonical
  // reference and CALCULATIONS.md for the full methodology).
  app.post("/api/calculate", async (req, res) => {
    try {
      // Validate request body based on customer type
      const SECTOR_CODES = Object.keys(SECTOR_TARIFFS) as [SectorCode, ...SectorCode[]];
      const baseCalculationSchema = z.object({
        consumption: MonthlyConsumptionSchema,
        efficiency: z.number().min(0).max(100).optional().default(95),
        tariff_supported: z.boolean().optional().default(true),
        // Bylaw 58/2024 default export rates: 0.050 JD/kWh residential,
        // 0.040 JD/kWh non-residential. Caller may override.
        export_tariff: z.number().min(0).optional().default(0.05),
        customer_type: z.string().optional().default('Residential'),
        // Sector dispatcher (Jordan EMRC 2025 sector codes). If omitted we
        // derive a sensible default from customer_type + tariff_supported.
        sector: z.enum(SECTOR_CODES).optional(),
        // Power-factor input (0.50–1.00). Default 0.90 → no penalty.
        // Penalty applies only to industrial C2/C3/C4, 3-part agri F2, and
        // 3-part 4★+ hotels D1/D2 (NEPCO §I.1.d).
        power_factor: z.number().min(0.1).max(1).optional().default(0.9),
        // Universal add-on toggles (default to "on" per EMRC reality).
        apply_rural_fils: z.boolean().optional().default(true),
        apply_tv_fee: z.boolean().optional().default(true),
        apply_meter_rent: z.boolean().optional().default(true),
        meter_phase: z.union([z.literal(1), z.literal(3)]).optional().default(1),
        apply_gam_fee: z.boolean().optional().default(false),
        waste_class: z.enum(['A', 'B', 'C']).nullable().optional().default(null),
        // Fuel-clause: defaults to EMRC monthly bulletin (0 fils through May
        // 2026). Provide tariff_year = 2026 to pick up published values.
        tariff_year: z.number().int().optional().default(2026),
        // Net-billing structure (Bylaw 58/2024 + M5 legacy NEM).
        net_billing_mechanism: z
          .enum([
            'M1_net_value_offsite',
            'M2_net_value_onsite',
            'M3_zero_export',
            'M4_buy_all_sell_all',
            'M5_legacy_net_metering',
          ])
          .optional()
          .default('M2_net_value_onsite'),
        // Inverter nameplate (kWac). If absent we estimate from monthly PV
        // generation using the EMRC specific yield + DC:AC ratio + the
        // residential 3.6/10 kWac inverter cap.
        inverter_kwac: z.number().min(0).optional(),
        // Connection phase (relevant for residential inverter cap and
        // single-phase subsidy-loss trigger).
        connection_phase: z.union([z.literal(1), z.literal(3)]).optional().default(1),
        // Residential grid-fee grandfathering: applications dated 1/6/2024+
        // pay 1.000 JD/kWac/month; older systems keep the legacy 2.000.
        post_bylaw_application: z.boolean().optional().default(true),
        // NAF / Takaful 1&3 / Royal Initiative beneficiaries are exempt.
        is_welfare_beneficiary: z.boolean().optional().default(false),
        // EMRC temporary-subscription override (B2/C-temp/etc.).
        is_temporary: z.boolean().optional().default(false),
        // Year-end credit policy. Default 'forfeit_year_end' matches legacy
        // practice; flip when EMRC publishes M2 rollover/cash-out rules.
        annual_reset_policy: z
          .enum(['forfeit_year_end', 'rollover_indefinite', 'cash_out'])
          .optional()
          .default(DEFAULT_ANNUAL_RESET_POLICY),
        // M5 legacy NEM export haircut (default 0.80 per MDPI Energies 2025
        // review; verify against the legacy Instructions PDF on emrc.gov.jo).
        legacy_export_haircut: z.number().min(0).max(1).optional().default(LEGACY_EXPORT_HAIRCUT),
        // PV Design module override (Jordan PV physics engine). When
        // present, the per-month PV generation comes from the design engine
        // (region × tilt × loss chain) instead of the consumption-based
        // X2 = (consumption / 12) × mechanism-cap-fraction fallback.
        monthly_pv_generation_override: z.array(z.number().min(0)).length(12).optional(),
        kwp_dc_override: z.number().min(0).optional(),
        // Detailed monthly mode: distribute the (flat) annual PV generation
        // across months by these 12 normalized shares (e.g. the region's
        // seasonal solar curve) instead of a flat consumption/12 every month.
        // Ignored when monthly_pv_generation_override is supplied.
        seasonal_generation_shares: z.array(z.number().min(0)).length(12).optional(),
      });

      // Residential 3-period validation schema
      const residentialSchema = baseCalculationSchema.extend({
        day_factors: TimeFactorsSchema,
        evening_factors: TimeFactorsSchema,
        night_factors: TimeFactorsSchema,
        sun_peak_factors: TimeFactorsSchema,
        sun_medium_factors: TimeFactorsSchema,
        sun_low_factors: TimeFactorsSchema,
        pv_consume_day: TimeFactorsSchema,
        pv_consume_evening: TimeFactorsSchema,
        pv_consume_night: TimeFactorsSchema
      });

      // Industrial 4-period validation schema
      const industrialSchema = baseCalculationSchema.extend({
        period1_factors: TimeFactorsSchema,
        period2_factors: TimeFactorsSchema,
        period3_factors: TimeFactorsSchema,
        period4_factors: TimeFactorsSchema,
        sun_period1_factors: TimeFactorsSchema,
        sun_period2_factors: TimeFactorsSchema,
        sun_period3_factors: TimeFactorsSchema,
        sun_period4_factors: TimeFactorsSchema,
        pv_consume_period1: TimeFactorsSchema,
        pv_consume_period2: TimeFactorsSchema,
        pv_consume_period3: TimeFactorsSchema,
        pv_consume_period4: TimeFactorsSchema,
        industrial_tariffs: IndustrialTariffsSchema
      });

      // Validate request based on customer type
      let validatedData;
      const customerType = req.body.customer_type || 'Residential';
      
      if (customerType === 'Industrial') {
        validatedData = industrialSchema.parse(req.body);
      } else {
        validatedData = residentialSchema.parse(req.body);
      }

      const {
        consumption,
        efficiency,
        tariff_supported,
        export_tariff,
        customer_type,
        sector: sector_override,
        power_factor,
        apply_rural_fils,
        apply_tv_fee,
        apply_meter_rent,
        meter_phase,
        apply_gam_fee,
        waste_class,
        tariff_year,
        net_billing_mechanism,
        inverter_kwac: inverter_kwac_input,
        connection_phase,
        post_bylaw_application,
        is_welfare_beneficiary,
        is_temporary,
        annual_reset_policy,
        legacy_export_haircut,
        monthly_pv_generation_override,
        kwp_dc_override,
        seasonal_generation_shares,
        // Residential 3-period factor fields (undefined for industrial)
        day_factors,
        evening_factors,
        night_factors,
        sun_peak_factors,
        sun_medium_factors,
        sun_low_factors,
        pv_consume_day,
        pv_consume_evening,
        pv_consume_night,
        // Industrial 4-period factor fields (undefined for residential)
        period1_factors,
        period2_factors,
        period3_factors,
        period4_factors,
        sun_period1_factors,
        sun_period2_factors,
        sun_period3_factors,
        sun_period4_factors,
        pv_consume_period1,
        pv_consume_period2,
        pv_consume_period3,
        pv_consume_period4,
        industrial_tariffs,
      } = validatedData as any;

      // Resolve sector — explicit override wins, else derive from customer type.
      // Residential tariff_supported=false → A2_unsubsidized; true → A1_subsidized.
      const sector: SectorCode =
        sector_override ??
        defaultSectorFor(customer_type as any, {
          subsidized: customer_type === 'Residential' ? Boolean(tariff_supported) : undefined,
        });
      const sectorTariff = SECTOR_TARIFFS[sector];
      const sectorClass = SECTOR_TO_CLASS[sector];

      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

      // Calculate total annual consumption
      const total_annual_consumption = months.reduce((sum, month) => sum + consumption[month], 0);

      // X2 = (sum of consumption / 12) kWh — target monthly PV generation.
      // Apply the mechanism's generation-cap fraction:
      //   M1 wheeling                   50 %
      //   M2 net billing residential   100 %
      //   M2 net billing non-res        50 %
      //   M3 zero export               100 %
      //   M4 buy-all/sell-all          100 %
      //   M5 legacy                    100 %
      // The industrial half-sizing convention is now folded into the
      // mechanism cap (50 % for M2 non-res), so the separate ½ factor on
      // Industrial-customers becomes redundant for M2 — keep it only as a
      // safety floor below the cap for legacy compatibility.
      const mech = net_billing_mechanism as NetBillingMechanism;
      const capFraction = mechanismGenerationCapFraction(mech, sectorClass);
      let monthly_pv_generation = (total_annual_consumption / 12) * capFraction;

      // Inverter sizing — EMRC standard specific yield 1,800 kWh/kWp/year
      // = 150 kWh/kWp/month, with sector DC:AC ratio (1.5 residential, 1.2
      // others) and system efficiency.
      const estimated_kwac =
        inverterKWacFromMonthlyKWh(monthly_pv_generation, sectorClass) / (efficiency / 100);
      // Residential inverter cap (3.6 kWac 1-ph / 10 kWac 3-ph).
      const capped = applyResidentialInverterCap(
        inverter_kwac_input ?? estimated_kwac,
        connection_phase as 1 | 3,
        sectorClass,
      );
      const inverter_kwac = capped.kWac;
      const inverter_size = inverter_kwac; // kept for back-compat in output
      const kwp_dc = kWpFromKWac(inverter_kwac, sectorClass);

      // If the inverter cap binds, the effective monthly PV generation must
      // be re-derived from the capped inverter rating:
      //   kWp_DC = kWac × DC:AC ratio
      //   monthly kWh AC = kWp_DC × specific yield × efficiency
      if (capped.capped) {
        monthly_pv_generation = kwp_dc * SPECIFIC_YIELD_KWH_PER_KWP_MONTH * (efficiency / 100);
      }

      // Detailed monthly mode: normalize the seasonal share vector (defensive —
      // shares need not sum to exactly 1 from the client).
      const shareSum: number = seasonal_generation_shares
        ? seasonal_generation_shares.reduce((s: number, v: number) => s + v, 0)
        : 0;
      const seasonalShares: number[] | null =
        seasonal_generation_shares && shareSum > 0
          ? seasonal_generation_shares.map((v: number) => v / shareSum)
          : null;
      const annual_flat_generation = monthly_pv_generation * 12;

      // Per-month PV generation precedence:
      //   1. PV Design physics override (12-vector) — used directly.
      //   2. Detailed monthly seasonal shares — annual total spread by curve.
      //   3. Flat consumption-based fallback — same value every month.
      const pvGenForMonth = (monthIndex: number): number =>
        monthly_pv_generation_override
          ? monthly_pv_generation_override[monthIndex]
          : seasonalShares
            ? annual_flat_generation * seasonalShares[monthIndex]
            : monthly_pv_generation;
      const annual_pv_generation = monthly_pv_generation_override
        ? monthly_pv_generation_override.reduce((s: number, v: number) => s + v, 0)
        : annual_flat_generation;
      // If the design module also supplied a kWp_DC, surface it; else compute
      // from the resolved inverter kWac × DC:AC ratio.
      const final_kwp_dc = kwp_dc_override ?? kwp_dc;

      // Eligibility advisory (warning only — does not block the calc).
      const eligibility = isEligibleForMechanism(sector, mech);
      // Residential subsidy-loss flag.
      const loses_subsidy = sectorClass === 'residential'
        && losesResidentialSubsidy(inverter_kwac, connection_phase as 1 | 3);

      // Resolve the residential export rate from Bylaw 58/2024 default if the
      // caller passed the legacy 0.04 default and we're on residential. Caller
      // can always override; we just align the *default* with sector reality.
      const effective_export_rate_jd =
        export_tariff != null && export_tariff !== 0.04
          ? export_tariff
          : netBillingExportRateJD(sector);

      // Helper — price a month's import for the resolved sector.
      // For tiered/flat sectors we price the monthly total; for TOU sectors
      // we feed the {peak, partial, offPeak} breakdown.
      const priceMonthlyImport = (
        monthlyKWh: number,
        tou?: { peak: number; partial: number; offPeak: number },
      ): number =>
        priceImportJD({
          sector,
          monthlyKWh,
          kwhByPeriod: tou,
          isTemporary: is_temporary,
        });

      // Map the 3 residential-style buckets (day 05–17 / evening 17–23 /
      // night 23–05) onto the EMRC 3-period TOU windows so non-residential
      // TOU sectors (banks, telecom, hotels, hospitals, …) price correctly
      // through the 3-bucket path. Day (12 h) splits 9 h off-peak (05–14) +
      // 3 h partial (14–17); evening = peak (17–23); night = partial (23–05).
      const mapResidentialBucketsToTOU = (
        day: number,
        evening: number,
        night: number,
      ): { peak: number; partial: number; offPeak: number } => ({
        peak: evening,
        partial: day * 0.25 + night,
        offPeak: day * 0.75,
      });
      const sectorIsTOU = sectorTariff.pricingModel === 'tou3';

      // Helper — export revenue for a month. Residential uses the flat NB
      // export rate; non-residential TOU may also use flat (Bylaw 58/2024
      // defaults to 0.040 JD/kWh for non-residential NB Mechanism 2).
      const calcExportRevenueJD = (exportKWh: number, _exportByPeriod?: any): number => {
        return exportKWh * effective_export_rate_jd;
      };

      // Helper — universal add-ons + min-bill + PF penalty applied to a raw
      // post-PV bill. Add-ons (rural fils, fuel clause, GAM, waste, TV,
      // meter rent) are charged on *imported* energy regardless of PV.
      const finalizeBill = (
        rawBillJD: number,
        importKWh: number,
        monthIndex: number,
      ): { finalBill: number; addOns: ReturnType<typeof calcUniversalAddOns>; pfSurcharge: number } => {
        const monthKey = `${tariff_year}-${String(monthIndex + 1).padStart(2, '0')}`;
        const addOns = calcUniversalAddOns({
          sector,
          monthlyImportKWh: Math.max(0, importKWh),
          monthKey,
          meterPhase: meter_phase,
          applyTvFee: apply_tv_fee,
          applyGAM: apply_gam_fee,
          wasteClass: (waste_class as WasteClass) ?? null,
          applyRuralFils: apply_rural_fils,
          applyMeterRent: apply_meter_rent,
        });
        const pfSurcharge =
          sectorAllowsPFPenalty(sector) && power_factor < 0.88
            ? powerFactorSurchargeJD(Math.max(0, rawBillJD), power_factor)
            : 0;
        const subtotal = Math.max(0, rawBillJD) + addOns.totalJD + pfSurcharge;
        const finalBill = applyMinimumBillJD(subtotal, sector);
        return { finalBill, addOns, pfSurcharge };
      };
      
      // Calculate before and after scenarios - EXACT logic
      let total_cost_before = 0;
      let total_cost_after = 0;
      let total_export_revenue = 0;
      let total_self_consumption = 0;
      let total_export = 0;
      
      // Net billing system - track credits/debits across months
      let running_credit_balance = 0; // Carries forward monthly credits
      let total_net_billing_savings = 0; // Additional savings from net billing
      
      const monthly_data = [];

      // Shared net-billing credit ledger application. Bylaw 58/2024 specifies
      // monthly cash credits that draw down deficits. (PV round will add the
      // annual reset — credits do not roll over indefinitely.)
      const applyCreditLedger = (rawNetBill: number) => {
        let monthly_credit_used = 0;
        let monthly_credit_generated = 0;
        let bill_after_credits = 0;

        if (rawNetBill < 0) {
          monthly_credit_generated = -rawNetBill;
          running_credit_balance += monthly_credit_generated;
          bill_after_credits = 0;
        } else if (running_credit_balance > 0) {
          if (running_credit_balance >= rawNetBill) {
            monthly_credit_used = rawNetBill;
            running_credit_balance -= rawNetBill;
            bill_after_credits = 0;
            total_net_billing_savings += rawNetBill;
          } else {
            monthly_credit_used = running_credit_balance;
            bill_after_credits = rawNetBill - running_credit_balance;
            total_net_billing_savings += running_credit_balance;
            running_credit_balance = 0;
          }
        } else {
          bill_after_credits = rawNetBill;
        }
        return { monthly_credit_used, monthly_credit_generated, bill_after_credits };
      };

      // ====================================
      // INDUSTRIAL 4-PERIOD CALCULATION
      // EMRC TOU is 3-period (off-peak / partial / peak). We map the project's
      // 4 input buckets onto the EMRC 3 buckets:
      //   off-peak (05–14)  = period1
      //   partial  (14–17 + 23–05) = period2 + period4
      //   peak     (17–23)  = period3
      // ====================================
      if (customer_type === 'Industrial') {
        for (let mi = 0; mi < months.length; mi++) {
          const month = months[mi];
          const x1 = consumption[month];
          const x2 = pvGenForMonth(mi);

          const y1 = x1 * period1_factors[month]; // 05–14
          const y2 = x1 * period2_factors[month]; // 14–17
          const y3 = x1 * period3_factors[month]; // 17–23
          const y4 = x1 * period4_factors[month]; // 23–05

          // M1 wheeling uses different TOU windows than the standard EMRC
          // schedule (off-peak absorbs the 14–17 mid-afternoon hours).
          const cons_tou =
            mech === 'M1_net_value_offsite'
              ? mapFourBucketToWheelingTOU(y1, y2, y3, y4)
              : mapFourBucketToStandardTOU(y1, y2, y3, y4);
          const bill_before_raw = priceMonthlyImport(x1, cons_tou);

          const before_final = finalizeBill(bill_before_raw, x1, mi);
          total_cost_before += before_final.finalBill;

          const z1 = x2 * sun_period1_factors[month];
          const z2 = x2 * sun_period2_factors[month];
          const z3 = x2 * sun_period3_factors[month];
          const z4 = x2 * sun_period4_factors[month];

          const k1 = Math.min(z1 * pv_consume_period1[month], y1);
          const k2 = Math.min(z2 * pv_consume_period2[month], y2);
          const k3 = Math.min(z3 * pv_consume_period3[month], y3);
          const k4 = Math.min(z4 * pv_consume_period4[month], y4);

          const self_consumption = k1 + k2 + k3 + k4;
          total_self_consumption += self_consumption;

          const export1 = Math.max(0, z1 - k1);
          const export2 = Math.max(0, z2 - k2);
          const export3 = Math.max(0, z3 - k3);
          const export4 = Math.max(0, z4 - k4);
          const export_energy = export1 + export2 + export3 + export4;
          total_export += export_energy;

          const import1 = Math.max(0, y1 - k1);
          const import2 = Math.max(0, y2 - k2);
          const import3 = Math.max(0, y3 - k3);
          const import4 = Math.max(0, y4 - k4);
          const import_energy = import1 + import2 + import3 + import4;

          const imp_tou =
            mech === 'M1_net_value_offsite'
              ? mapFourBucketToWheelingTOU(import1, import2, import3, import4)
              : mapFourBucketToStandardTOU(import1, import2, import3, import4);
          const import_cost = priceMonthlyImport(import_energy, imp_tou);
          // M3 zero-export: any accidental export is NOT compensated.
          // M5 legacy: export revenue is settled as kWh credit, not JD —
          // handled by the legacy ledger below.
          const export_revenue =
            mech === 'M3_zero_export' || mech === 'M5_legacy_net_metering'
              ? 0
              : calcExportRevenueJD(export_energy);
          total_export_revenue += export_revenue;

          const raw_net_bill = import_cost - export_revenue;
          const ledger = applyCreditLedger(raw_net_bill);

          // Add-ons + min-bill + PF surcharge layered on top of the (already
          // credited) energy bill component.
          const after_final = finalizeBill(ledger.bill_after_credits, import_energy, mi);
          total_cost_after += after_final.finalBill;

          monthly_data.push({
            month,
            consumption: x1,
            generation: x2,
            generation_day: z1 + z2,
            generation_evening: z3,
            generation_night: z4,
            self_consumption,
            export: export_energy,
            import: import_energy,
            bill_before: before_final.finalBill,
            bill_after: after_final.finalBill,
            raw_bill_after: raw_net_bill,
            import_cost,
            savings: before_final.finalBill - after_final.finalBill,
            export_revenue,
            monthly_credit_used: ledger.monthly_credit_used,
            monthly_credit_generated: ledger.monthly_credit_generated,
            running_credit_balance,
          });
        }
      } else {
        // ====================================
        // RESIDENTIAL 3-PERIOD CALCULATION
        // EMRC residential is tiered (not TOU) so the bucket split affects
        // only self-consumption/export, not the per-kWh rate.
        // ====================================
        for (let mi = 0; mi < months.length; mi++) {
          const month = months[mi];
          const x1 = consumption[month];
          const x2 = pvGenForMonth(mi);

          const y1 = x1 * day_factors[month];
          const y2 = x1 * evening_factors[month];
          const y3 = x1 * night_factors[month];
          const total_cons = y1 + y2 + y3;

          const before_tou = sectorIsTOU ? mapResidentialBucketsToTOU(y1, y2, y3) : undefined;
          const bill_before_raw = priceMonthlyImport(total_cons, before_tou);
          const before_final = finalizeBill(bill_before_raw, total_cons, mi);
          total_cost_before += before_final.finalBill;

          const z1 = x2 * sun_peak_factors[month];
          const z2 = x2 * sun_medium_factors[month];
          const z3 = x2 * sun_low_factors[month];

          const k1 = Math.min(z1 * pv_consume_day[month], y1);
          const k2 = Math.min(z2 * pv_consume_evening[month], y2);
          const k3 = Math.min(z3 * pv_consume_night[month], y3);

          const self_consumption = k1 + k2 + k3;
          total_self_consumption += self_consumption;

          const export_energy =
            Math.max(0, z1 - k1) + Math.max(0, z2 - k2) + Math.max(0, z3 - k3);
          total_export += export_energy;

          const imp1 = Math.max(0, y1 - k1);
          const imp2 = Math.max(0, y2 - k2);
          const imp3 = Math.max(0, y3 - k3);
          const import_energy = imp1 + imp2 + imp3;

          const imp_tou = sectorIsTOU ? mapResidentialBucketsToTOU(imp1, imp2, imp3) : undefined;
          const import_cost = import_energy > 0 ? priceMonthlyImport(import_energy, imp_tou) : 0;
          // M3 zero-export and M5 legacy NEM monetary-side both yield no
          // JD export revenue (M5 is settled as kWh credit elsewhere).
          const export_revenue =
            mech === 'M3_zero_export' || mech === 'M5_legacy_net_metering'
              ? 0
              : calcExportRevenueJD(export_energy);
          total_export_revenue += export_revenue;

          const raw_net_bill = import_cost - export_revenue;
          const ledger = applyCreditLedger(raw_net_bill);
          const after_final = finalizeBill(ledger.bill_after_credits, import_energy, mi);
          total_cost_after += after_final.finalBill;

          monthly_data.push({
            month,
            consumption: x1,
            generation: x2,
            generation_day: z1,
            generation_evening: z2,
            generation_night: z3,
            self_consumption,
            export: export_energy,
            import: import_energy,
            bill_before: before_final.finalBill,
            bill_after: after_final.finalBill,
            raw_bill_after: raw_net_bill,
            import_cost,
            savings: before_final.finalBill - after_final.finalBill,
            export_revenue,
            monthly_credit_used: ledger.monthly_credit_used,
            monthly_credit_generated: ledger.monthly_credit_generated,
            running_credit_balance,
          });
        }
      }

      // Annual credit reset (Bylaw 58/2024 — single highest-stakes open
      // question per the engine spec). Default 'forfeit_year_end' matches
      // legacy DISCO practice. Apply at end of December.
      const reset = applyAnnualReset(running_credit_balance, annual_reset_policy as AnnualResetPolicy);
      const forfeited_credit_jd = reset.forfeitedJD;
      const cashed_out_credit_jd = reset.cashedOutJD;
      running_credit_balance = reset.balanceAfter;
      // Forfeiture is a loss to the prosumer — surfaces as additional cost
      // (the credit they earned but lost). Cash-out is a refund (negative cost).
      total_cost_after += forfeited_credit_jd - cashed_out_credit_jd;

      // Annual grid-service fee (Bylaw 58/2024 §V) — JD/kWac × inverter size
      // × 12. Sector- and mechanism-dependent; M4 Buy-All/Sell-All and M5
      // legacy NEM are exempt.
      const grid_service_fee_monthly_jd = gridServiceFeeJD({
        sector,
        mechanism: mech,
        inverterKWac: inverter_kwac,
        postBylawApplication: post_bylaw_application,
        isWelfareBeneficiary: is_welfare_beneficiary,
      });
      const grid_service_fee_annual_jd = grid_service_fee_monthly_jd * 12;
      total_cost_after += grid_service_fee_annual_jd;

      const annual_savings = total_cost_before - total_cost_after;
      
      const results: CalculationResults = {
        monthly_data,
        annual_summary: {
          total_consumption: total_annual_consumption,
          pv_size: monthly_pv_generation_override
            ? annual_pv_generation / 12
            : monthly_pv_generation,
          inverter_size,
          annual_generation: annual_pv_generation,
          total_self_consumption,
          total_export,
          cost_before: total_cost_before,
          cost_after: total_cost_after,
          annual_savings,
          export_revenue: total_export_revenue,
          efficiency: efficiency / 100,
          export_tariff: effective_export_rate_jd,
          // NET BILLING ENHANCEMENTS
          net_billing_savings: total_net_billing_savings,
          final_credit_balance: running_credit_balance,
          grid_service_fee_jd_per_month: grid_service_fee_monthly_jd,
          grid_service_fee_jd_annual: grid_service_fee_annual_jd,
          sector,
          sector_label: sectorTariff.label,
          net_billing_mechanism,
          // PV sizing (EMRC standard yield + DC:AC + residential caps)
          kwp_dc: final_kwp_dc,
          pv_design_active: !!monthly_pv_generation_override,
          dc_ac_ratio: sectorClass === 'residential' ? 1.5 : 1.2,
          specific_yield_kwh_per_kwp_year: SPECIFIC_YIELD_KWH_PER_KWP_MONTH * 12,
          inverter_cap_kwac: capped.cap ?? null,
          inverter_cap_binding: capped.capped,
          mechanism_cap_fraction: capFraction,
          loses_residential_subsidy: loses_subsidy,
          eligibility_status: eligibility,
          annual_reset_policy,
          forfeited_credit_jd,
          cashed_out_credit_jd,
          total_savings_with_net_billing: annual_savings + total_net_billing_savings
        },
        net_billing_enabled: true
      };
      
      res.json(results);
      
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ 
          error: "Invalid calculation parameters", 
          details: error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')
        });
      } else {
        res.status(400).json({ error: "Calculation failed", details: error });
      }
    }
  });

  // NPV/ROI calculation endpoint (EXACT PyQt6 logic preserved)
  app.post("/api/calculate-npv", async (req, res) => {
    try {
      const {
        annual_savings = 1000,
        system_cost = 5000,
        discount_rate = 0.05,
        project_life = 25
      } = req.body;

      // EXACT NPV calculation from PyQt6
      let npv = -system_cost; // Initial investment
      
      for (let year = 1; year <= project_life; year++) {
        // Account for degradation - EXACT formula
        const degradation_factor = Math.pow(1 - 0.005, year); // 0.5% annual degradation
        const yearly_savings = annual_savings * degradation_factor;
        
        // Discount to present value - EXACT formula
        const pv_savings = yearly_savings / Math.pow(1 + discount_rate, year);
        npv += pv_savings;
      }

      // EXACT IRR calculation (simplified)
      const simple_return = annual_savings / system_cost;
      const irr = Math.min(simple_return * 100, 50); // Cap at reasonable value
      
      // Payback period - EXACT formula
      const payback = annual_savings > 0 ? system_cost / annual_savings : 999;
      
      // LCOE calculation - EXACT formula
      const annual_generation = 1000; // kWh - simplified
      const lcoe = system_cost / (annual_generation * project_life);

      res.json({
        npv,
        irr,
        payback,
        lcoe
      });

    } catch (error) {
      res.status(400).json({ error: "NPV calculation failed", details: error });
    }
  });
}