import type { Express } from "express";
import { setupAuth } from "./fakeAuth";
import { z } from "zod";
import { storage } from "./storage";
import {
  insertSolarProjectSchema,
  type CalculationResults,
  MonthlyConsumptionSchema,
} from "../shared/schema";
import {
  type SectorCode,
  type NetBillingMechanism,
  type WasteClass,
  type AnnualResetPolicy,
  SECTOR_TARIFFS,
  SECTOR_TO_CLASS,
  defaultSectorFor,
  priceImportJD,
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
} from "../shared/jordanTariffs";
import {
  type ClimateZone,
  JORDAN_REGIONS,
  loadTOUFor,
  pvTOUFor,
} from "../shared/jordanPVDesign";

export async function registerRoutes(app: Express): Promise<void> {
  setupAuth(app);

  // ---- Project CRUD -------------------------------------------------------

  app.get("/api/projects", async (_req, res) => {
    try {
      res.json(await storage.getAllSolarProjects());
    } catch {
      res.status(500).json({ error: "Failed to fetch projects" });
    }
  });

  app.get("/api/projects/:id", async (req, res) => {
    try {
      const project = await storage.getSolarProject(req.params.id);
      if (!project) return res.status(404).json({ error: "Project not found" });
      res.json(project);
    } catch {
      res.status(500).json({ error: "Failed to fetch project" });
    }
  });

  app.post("/api/projects", async (req, res) => {
    try {
      const data = insertSolarProjectSchema.parse(req.body);
      res.status(201).json(await storage.createSolarProject(data));
    } catch (error) {
      res.status(400).json({ error: "Invalid project data", details: error });
    }
  });

  app.put("/api/projects/:id", async (req, res) => {
    try {
      const data = insertSolarProjectSchema.partial().parse(req.body);
      const project = await storage.updateSolarProject(req.params.id, data);
      if (!project) return res.status(404).json({ error: "Project not found" });
      res.json(project);
    } catch (error) {
      res.status(400).json({ error: "Invalid project data", details: error });
    }
  });

  app.delete("/api/projects/:id", async (req, res) => {
    try {
      const ok = await storage.deleteSolarProject(req.params.id);
      if (!ok) return res.status(404).json({ error: "Project not found" });
      res.status(204).send();
    } catch {
      res.status(500).json({ error: "Failed to delete project" });
    }
  });

  // ---------------------------------------------------------------------
  // POST /api/calculate
  //
  // Unified accurate billing engine — replaces the legacy factor-based
  // pipeline (no more user-set day/evening/night load percentages, no
  // user-set sun-distribution factors, no user-set PV-self-consumption
  // percentages — all of which had no physical basis).
  //
  // Inputs (all numeric quantities in kWh / kWac / JD unless noted):
  //   • monthly consumption (12 values, kWh)
  //   • monthly PV generation (12 values, kWh) from the physics engine
  //   • sector + mechanism + power factor + inverter kWac + kWp DC
  //   • load TOU profile (sector default; user override)
  //   • PV   TOU profile (zone+mechanism default; user override)
  //
  // Per-month per-TOU-bucket energy balance:
  //   SC_b = min(G_b, L_b)            (self-consumption per bucket)
  //   E_b  = max(0, G_b − L_b)        (export)
  //   I_b  = max(0, L_b − G_b)        (import)
  //
  // Billing:
  //   • Bill_before = priceImport(sector, total_load, {Lp,La,Lo}) + add-ons → min-bill
  //   • Energy charge = priceImport(sector, total_import, {Ip,Ia,Io})
  //   • Export revenue = total_export × export_rate (0 under M3/M5)
  //   • Raw net = energy_charge − export_revenue
  //   • Apply credit ledger → bill_after_credits
  //   • Add universal add-ons (rural fils, fuel clause, TV, GAM, meter,
  //     waste) on imported kWh
  //   • Apply PF penalty (if sector allows and pf < 0.88)
  //   • Apply min bill floor
  //   • At Dec, apply annual reset policy
  //   • Annualise: add grid service fee × 12
  // ---------------------------------------------------------------------
  app.post("/api/calculate", async (req, res) => {
    try {
      const SECTOR_CODES = Object.keys(SECTOR_TARIFFS) as [SectorCode, ...SectorCode[]];
      const TOUSchema = z.object({
        offPeak: z.number().min(0).max(1),
        partial: z.number().min(0).max(1),
        peak:    z.number().min(0).max(1),
      });
      const schema = z.object({
        // Demand side
        consumption: MonthlyConsumptionSchema,
        // Supply side (from PV physics engine)
        monthly_pv_generation: z.array(z.number().min(0)).length(12),
        inverter_kwac: z.number().min(0),
        kwp_dc: z.number().min(0),
        // Tariff identity
        sector: z.enum(SECTOR_CODES),
        customer_type: z.string().optional().default('Residential'),
        net_billing_mechanism: z.enum([
          'M1_net_value_offsite',
          'M2_net_value_onsite',
          'M3_zero_export',
          'M4_buy_all_sell_all',
          'M5_legacy_net_metering',
        ]).default('M2_net_value_onsite'),
        // TOU profiles (sector / zone defaults)
        load_tou: TOUSchema.optional(),
        pv_tou:   TOUSchema.optional(),
        zone: z.enum(['N', 'S', 'E', 'V']).optional(),
        // Modifiers
        export_tariff: z.number().min(0).optional(),
        power_factor: z.number().min(0.1).max(1).default(0.9),
        efficiency: z.number().min(0).max(100).default(95),
        // Universal add-ons
        apply_rural_fils: z.boolean().default(true),
        apply_tv_fee:     z.boolean().default(true),
        apply_meter_rent: z.boolean().default(true),
        meter_phase: z.union([z.literal(1), z.literal(3)]).default(1),
        connection_phase: z.union([z.literal(1), z.literal(3)]).default(1),
        apply_gam_fee: z.boolean().default(false),
        waste_class: z.enum(['A', 'B', 'C']).nullable().default(null),
        tariff_year: z.number().int().default(2026),
        // Net billing
        post_bylaw_application: z.boolean().default(true),
        is_welfare_beneficiary: z.boolean().default(false),
        is_temporary: z.boolean().default(false),
        annual_reset_policy: z.enum([
          'forfeit_year_end', 'rollover_indefinite', 'cash_out',
        ]).default(DEFAULT_ANNUAL_RESET_POLICY),
        legacy_export_haircut: z.number().min(0).max(1).default(LEGACY_EXPORT_HAIRCUT),
      });

      const input = schema.parse(req.body);

      const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
      const sector = input.sector;
      const sectorTariff = SECTOR_TARIFFS[sector];
      const sectorClass = SECTOR_TO_CLASS[sector];
      const mech = input.net_billing_mechanism;
      const zone: ClimateZone = (input.zone as ClimateZone) ?? 'N';

      // Resolve TOU profiles — explicit user override → defaults
      const loadTOU = input.load_tou ?? loadTOUFor(sector);
      const pvTOU   = input.pv_tou   ?? pvTOUFor(zone, mech);

      // Total annual consumption
      const annualConsumption = months.reduce((s, m) =>
        s + ((input.consumption as any)[m] || 0), 0);

      // Export rate: Bylaw 58/2024 default by sector class unless overridden
      const exportRate = input.export_tariff ?? netBillingExportRateJD(sector);

      // Eligibility advisory and subsidy-loss flag
      const eligibility = isEligibleForMechanism(sector, mech);
      const losesSubsidy = sectorClass === 'residential'
        && losesResidentialSubsidy(input.inverter_kwac, input.connection_phase as 1 | 3);

      // Universal add-ons helper (per month, on imported kWh)
      const addOnsFor = (importKWh: number, monthIdx: number) =>
        calcUniversalAddOns({
          sector,
          monthlyImportKWh: Math.max(0, importKWh),
          monthKey: `${input.tariff_year}-${String(monthIdx + 1).padStart(2, '0')}`,
          meterPhase: input.meter_phase,
          applyTvFee: input.apply_tv_fee,
          applyGAM: input.apply_gam_fee,
          wasteClass: (input.waste_class as WasteClass) ?? null,
          applyRuralFils: input.apply_rural_fils,
          applyMeterRent: input.apply_meter_rent,
        });

      // Monthly loop — proper time-coincident energy balance per TOU bucket
      let runningCreditJD = 0;
      let runningCarryKWh = 0; // M5 legacy NEM only
      let totalCostBefore = 0;
      let totalCostAfter = 0;
      let totalExportRevenue = 0;
      let totalSelfConsumption = 0;
      let totalExport = 0;
      let totalImport = 0;
      let netBillingSavings = 0;
      const monthly: any[] = [];

      for (let mi = 0; mi < 12; mi++) {
        const monthKey = months[mi];
        const load = (input.consumption as any)[monthKey] || 0;
        const gen  = input.monthly_pv_generation[mi];

        // 1. Distribute load and generation across TOU buckets
        const Lp = load * loadTOU.peak;
        const La = load * loadTOU.partial;
        const Lo = load * loadTOU.offPeak;
        const Gp = gen * pvTOU.peak;
        const Ga = gen * pvTOU.partial;
        const Go = gen * pvTOU.offPeak;

        // 2. Energy balance per bucket.
        //    M4 Buy-All / Sell-All has separate meters: ALL load imports at
        //    retail and ALL generation exports at the fixed sell rate (no
        //    on-site overlap, no self-consumption).
        //    Every other mechanism nets on-site: SC = min(G, L).
        let SCp: number, SCa: number, SCo: number;
        let Ep: number, Ea: number, Eo: number;
        let Ip: number, Ia: number, Io: number;
        if (mech === 'M4_buy_all_sell_all') {
          SCp = SCa = SCo = 0;
          Ep = Gp; Ea = Ga; Eo = Go;
          Ip = Lp; Ia = La; Io = Lo;
        } else {
          SCp = Math.min(Gp, Lp);
          SCa = Math.min(Ga, La);
          SCo = Math.min(Go, Lo);
          Ep = Math.max(0, Gp - Lp);
          Ea = Math.max(0, Ga - La);
          Eo = Math.max(0, Go - Lo);
          Ip = Math.max(0, Lp - Gp);
          Ia = Math.max(0, La - Ga);
          Io = Math.max(0, Lo - Go);
        }
        const SC = SCp + SCa + SCo;
        const exportEnergy = Ep + Ea + Eo;
        const importEnergy = Ip + Ia + Io;

        // 5. Energy charges from sector tariff
        const billBeforeEnergyJD = priceImportJD({
          sector, monthlyKWh: load,
          kwhByPeriod: { peak: Lp, partial: La, offPeak: Lo },
          isTemporary: input.is_temporary,
        });
        const importEnergyJD = priceImportJD({
          sector, monthlyKWh: importEnergy,
          kwhByPeriod: { peak: Ip, partial: Ia, offPeak: Io },
          isTemporary: input.is_temporary,
        });

        // 6. Add-ons (rural fils, fuel clause, TV, meter rent, GAM, waste)
        const addOnsBefore = addOnsFor(load, mi);
        const addOnsAfter  = addOnsFor(importEnergy, mi);

        // 7. PF surcharge — only for sectors that allow it
        const pfSurchargeBefore =
          sectorAllowsPFPenalty(sector) && input.power_factor < 0.88
            ? powerFactorSurchargeJD(billBeforeEnergyJD, input.power_factor)
            : 0;
        const pfSurchargeAfter =
          sectorAllowsPFPenalty(sector) && input.power_factor < 0.88
            ? powerFactorSurchargeJD(importEnergyJD, input.power_factor)
            : 0;

        // 8. Bill BEFORE PV — energy + add-ons + PF surcharge, min-bill floor
        const billBefore = applyMinimumBillJD(
          billBeforeEnergyJD + addOnsBefore.totalJD + pfSurchargeBefore,
          sector,
        );

        // 9. Export revenue — M3 zero-export and M5 legacy yield no JD revenue
        const exportRevenueJD =
          mech === 'M3_zero_export' || mech === 'M5_legacy_net_metering'
            ? 0
            : exportEnergy * exportRate;

        // 10. Mechanism-specific net-billing logic
        let billAfter: number;
        let monthlyCreditUsed = 0;
        let monthlyCreditGenerated = 0;
        let m5Carry = 0;
        let rawNetBill = 0;

        if (mech === 'M5_legacy_net_metering') {
          // True 1:1 kWh netting with year-end forfeiture and ~80% credit haircut
          const m5 = legacyNetMeteringMonthly({
            importsKWh: importEnergy,
            exportsKWh: exportEnergy,
            retailTariffJDPerKWh: load > 0 ? billBeforeEnergyJD / load : 0,
            exportHaircut: input.legacy_export_haircut,
            fuelClauseFils: 0, // included in retailTariffJDPerKWh proxy
            priorCarryKWh: runningCarryKWh,
          });
          m5Carry = m5.carryKWh;
          runningCarryKWh = m5.carryKWh;
          rawNetBill = m5.invoiceJD - 0; // no JD export credit in M5
          // Add-ons & PF still apply
          billAfter = applyMinimumBillJD(
            m5.invoiceJD + addOnsAfter.totalJD + pfSurchargeAfter,
            sector,
          );
        } else {
          // M1/M2/M3/M4: monetary settlement
          rawNetBill = importEnergyJD - exportRevenueJD;
          // Credit ledger (M2/M1 monthly carry; M3 has no exports so no credit;
          // M4 is BASS — handled the same as M2 here for credit flow).
          let billAfterCreditsEnergyJD = 0;
          if (rawNetBill < 0) {
            monthlyCreditGenerated = -rawNetBill;
            runningCreditJD += monthlyCreditGenerated;
            billAfterCreditsEnergyJD = 0;
          } else if (runningCreditJD > 0) {
            if (runningCreditJD >= rawNetBill) {
              monthlyCreditUsed = rawNetBill;
              runningCreditJD -= rawNetBill;
              billAfterCreditsEnergyJD = 0;
              netBillingSavings += rawNetBill;
            } else {
              monthlyCreditUsed = runningCreditJD;
              billAfterCreditsEnergyJD = rawNetBill - runningCreditJD;
              netBillingSavings += runningCreditJD;
              runningCreditJD = 0;
            }
          } else {
            billAfterCreditsEnergyJD = rawNetBill;
          }
          billAfter = applyMinimumBillJD(
            billAfterCreditsEnergyJD + addOnsAfter.totalJD + pfSurchargeAfter,
            sector,
          );
        }

        // Accumulators
        totalCostBefore += billBefore;
        totalCostAfter  += billAfter;
        totalExportRevenue += exportRevenueJD;
        totalSelfConsumption += SC;
        totalExport += exportEnergy;
        totalImport += importEnergy;

        monthly.push({
          month: monthKey,
          consumption: load,
          generation: gen,
          // Backward-compat fields (no longer the source of truth)
          generation_day: Go,
          generation_evening: Gp,
          generation_night: Ga,
          self_consumption: SC,
          export: exportEnergy,
          import: importEnergy,
          bill_before: billBefore,
          bill_after: billAfter,
          raw_bill_after: rawNetBill,
          import_cost: importEnergyJD + addOnsAfter.totalJD,
          savings: billBefore - billAfter,
          export_revenue: exportRevenueJD,
          monthly_credit_used: monthlyCreditUsed,
          monthly_credit_generated: monthlyCreditGenerated,
          running_credit_balance: runningCreditJD,
          // TOU breakdown for the technical report
          tou: { Lp, La, Lo, Gp, Ga, Go, SCp, SCa, SCo, Ep, Ea, Eo, Ip, Ia, Io },
          // Add-on breakdown (transparent itemisation)
          add_ons_after: addOnsAfter,
          m5_carry_kwh: m5Carry || undefined,
        });
      }

      // Year-end reset
      const reset = applyAnnualReset(runningCreditJD, input.annual_reset_policy as AnnualResetPolicy);
      const forfeitedCreditJD = reset.forfeitedJD;
      const cashedOutCreditJD = reset.cashedOutJD;
      runningCreditJD = reset.balanceAfter;
      totalCostAfter += forfeitedCreditJD - cashedOutCreditJD;

      // Annual grid-service fee (Bylaw 58/2024 §V)
      const gridFeeMonthly = gridServiceFeeJD({
        sector,
        mechanism: mech as NetBillingMechanism,
        inverterKWac: input.inverter_kwac,
        postBylawApplication: input.post_bylaw_application,
        isWelfareBeneficiary: input.is_welfare_beneficiary,
      });
      const gridFeeAnnual = gridFeeMonthly * 12;
      totalCostAfter += gridFeeAnnual;

      const annualSavings = totalCostBefore - totalCostAfter;
      const annualGeneration = input.monthly_pv_generation.reduce((s, v) => s + v, 0);
      const dcAcRatio = sectorClass === 'residential' ? 1.5 : 1.2;

      const results: CalculationResults = {
        monthly_data: monthly,
        annual_summary: {
          total_consumption: annualConsumption,
          pv_size: annualGeneration / 12,
          inverter_size: input.inverter_kwac,
          annual_generation: annualGeneration,
          total_self_consumption: totalSelfConsumption,
          total_export: totalExport,
          cost_before: totalCostBefore,
          cost_after: totalCostAfter,
          annual_savings: annualSavings,
          export_revenue: totalExportRevenue,
          efficiency: input.efficiency / 100,
          export_tariff: exportRate,
          net_billing_savings: netBillingSavings,
          final_credit_balance: runningCreditJD,
          grid_service_fee_jd_per_month: gridFeeMonthly,
          grid_service_fee_jd_annual: gridFeeAnnual,
          sector,
          sector_label: sectorTariff.label,
          net_billing_mechanism: mech,
          kwp_dc: input.kwp_dc,
          dc_ac_ratio: dcAcRatio,
          specific_yield_kwh_per_kwp_year: SPECIFIC_YIELD_KWH_PER_KWP_MONTH * 12,
          inverter_cap_kwac: sectorClass === 'residential'
            ? (input.connection_phase === 3 ? 10 : 3.6)
            : null,
          inverter_cap_binding: false, // capped on the client before send
          mechanism_cap_fraction: mechanismGenerationCapFraction(mech, sectorClass),
          loses_residential_subsidy: losesSubsidy,
          eligibility_status: eligibility,
          annual_reset_policy: input.annual_reset_policy,
          forfeited_credit_jd: forfeitedCreditJD,
          cashed_out_credit_jd: cashedOutCreditJD,
          pv_design_active: true,
        },
        net_billing_enabled: true,
      };

      res.json(results);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({
          error: "Invalid calculation parameters",
          details: error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', '),
        });
      } else {
        res.status(400).json({ error: "Calculation failed", details: String(error) });
      }
    }
  });

  // ---------------------------------------------------------------------
  // POST /api/calculate-npv — unchanged from legacy
  // ---------------------------------------------------------------------
  app.post("/api/calculate-npv", async (req, res) => {
    try {
      const {
        annual_savings = 1000,
        system_cost = 5000,
        discount_rate = 0.05,
        project_life = 25,
      } = req.body;

      let npv = -system_cost;
      for (let year = 1; year <= project_life; year++) {
        const deg = Math.pow(1 - 0.005, year);
        const pv = (annual_savings * deg) / Math.pow(1 + discount_rate, year);
        npv += pv;
      }
      const irr = Math.min((annual_savings / system_cost) * 100, 50);
      const payback = annual_savings > 0 ? system_cost / annual_savings : 999;
      const annualGen = 1000;
      const lcoe = system_cost / (annualGen * project_life);
      res.json({ npv, irr, payback, lcoe });
    } catch (error) {
      res.status(400).json({ error: "NPV calculation failed", details: String(error) });
    }
  });
}
