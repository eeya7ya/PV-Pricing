import type { Express } from "express";
import { setupAuth } from "./fakeAuth";
import { z } from "zod";
import { storage } from "./storage";
import { insertSolarProjectSchema, type CalculationResults, type MonthlyConsumption, type TimeFactors, IndustrialTariffsSchema, TimeFactorsSchema, MonthlyConsumptionSchema } from "@shared/schema";

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

  // Calculate solar system performance (EXACT PyQt6 calculations preserved)
  app.post("/api/calculate", async (req, res) => {
    try {
      // Validate request body based on customer type
      const baseCalculationSchema = z.object({
        consumption: MonthlyConsumptionSchema,
        efficiency: z.number().min(0).max(100).optional().default(95),
        tariff_supported: z.boolean().optional().default(true),
        export_tariff: z.number().min(0).optional().default(0.04),
        customer_type: z.string().optional().default('Residential')
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
        // Extract all possible fields, will be undefined for unused customer types
        day_factors,
        evening_factors,
        night_factors,
        sun_peak_factors,
        sun_medium_factors,
        sun_low_factors,
        pv_consume_day,
        pv_consume_evening,
        pv_consume_night,
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
        industrial_tariffs
      } = validatedData as any; // Use any to simplify type handling since Zod already validates

      // EXACT calculation logic from PyQt6 - calculateTariff function (Residential)
      const calculateTariff = (energy_kwh: number, tariff_supported: boolean): number => {
        if (tariff_supported) {
          if (energy_kwh <= 300) {
            return energy_kwh * 0.05;
          } else if (energy_kwh <= 600) {
            return (300 * 0.05) + ((energy_kwh - 300) * 0.1);
          } else {
            return (300 * 0.05) + (300 * 0.1) + ((energy_kwh - 600) * 0.2);
          }
        } else {
          if (energy_kwh <= 1000) {
            return energy_kwh * 0.12;
          } else {
            return (1000 * 0.12) + ((energy_kwh - 1000) * 0.15);
          }
        }
      };

      // Industrial 4-period tariff calculation function
      const calculateIndustrialTariff = (consumption_by_period: number[], tariffs: z.infer<typeof IndustrialTariffsSchema>): number => {
        if (!tariffs) {
          console.error('❌ Industrial tariffs are undefined/null!');
          return 0;
        }
        
        let total_cost = 0;
        total_cost += consumption_by_period[0] * (tariffs.import_period1 / 100); // Convert ¢/kWh to $/kWh
        total_cost += consumption_by_period[1] * (tariffs.import_period2 / 100);
        total_cost += consumption_by_period[2] * (tariffs.import_period3 / 100);
        total_cost += consumption_by_period[3] * (tariffs.import_period4 / 100);
        
        return total_cost;
      };

      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      
      // Calculate total annual consumption
      const total_annual_consumption = months.reduce((sum, month) => sum + consumption[month], 0);
      
      // X2 = (sum of consumption / 12) kWh - EXACT formula
      // For Industrial: X2 = AVG/2 (divide by 2 as requested)
      let monthly_pv_generation = total_annual_consumption / 12;
      if (customer_type === 'Industrial') {
        monthly_pv_generation = monthly_pv_generation / 2; // X2 = AVG/2 for Industrial
      }
      
      // Calculate inverter size (for display only) - EXACT formula
      const inverter_size = monthly_pv_generation / (130 * 0.95);
      
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

      // ====================================
      // INDUSTRIAL 4-PERIOD CALCULATION
      // ====================================
      if (customer_type === 'Industrial') {
        for (const month of months) {
          const x1 = consumption[month];
          const x2 = monthly_pv_generation;
          
          // Split consumption into 4 periods - EXACT factors from spreadsheet
          const y1 = x1 * period1_factors[month]; // Off Peak (5-14)
          const y2 = x1 * period2_factors[month]; // Half Peak (14-17)
          const y3 = x1 * period3_factors[month]; // Peak (17-23)
          const y4 = x1 * period4_factors[month]; // Half Peak (23-5)
          
          // Calculate before cost using Industrial 4-period tariffs
          const consumption_by_period = [y1, y2, y3, y4];
          const bill_before = calculateIndustrialTariff(consumption_by_period, industrial_tariffs || {});
          total_cost_before += bill_before;
          
          // PV generation split using 4-period sun factors
          const z1 = x2 * sun_period1_factors[month]; // Off Peak solar (5-14)
          const z2 = x2 * sun_period2_factors[month]; // Half Peak solar (14-17)
          const z3 = x2 * sun_period3_factors[month]; // Peak solar (17-23)
          const z4 = x2 * sun_period4_factors[month]; // Half Peak solar (23-5)
          
          // Self-consumption using 4-period PV consumption factors
          const k1 = Math.min(z1 * pv_consume_period1[month], y1);
          const k2 = Math.min(z2 * pv_consume_period2[month], y2);
          const k3 = Math.min(z3 * pv_consume_period3[month], y3);
          const k4 = Math.min(z4 * pv_consume_period4[month], y4);
          
          const self_consumption = k1 + k2 + k3 + k4;
          total_self_consumption += self_consumption;
          
          // Export calculation for 4 periods
          const export1 = Math.max(0, z1 - k1);
          const export2 = Math.max(0, z2 - k2);
          const export3 = Math.max(0, z3 - k3);
          const export4 = Math.max(0, z4 - k4);
          const export_energy = export1 + export2 + export3 + export4;
          total_export += export_energy;
          
          // Import calculation for 4 periods
          const import1 = Math.max(0, y1 - k1);
          const import2 = Math.max(0, y2 - k2);
          const import3 = Math.max(0, y3 - k3);
          const import4 = Math.max(0, y4 - k4);
          const import_by_period = [import1, import2, import3, import4];
          
          // After costs using Industrial 4-period tariffs  
          const import_cost = calculateIndustrialTariff(import_by_period, industrial_tariffs);
          
          // Export revenue using 4-period export tariffs
          const export_revenue = export1 * (industrial_tariffs.export_period1 / 100) +
                                export2 * (industrial_tariffs.export_period2 / 100) +
                                export3 * (industrial_tariffs.export_period3 / 100) +
                                export4 * (industrial_tariffs.export_period4 / 100);
          total_export_revenue += export_revenue;
          
          // ENHANCED NET BILLING CALCULATION
          const raw_net_bill = import_cost - export_revenue;
          
          // Apply net billing credit system
          let actual_bill_after_credits = 0;
          let monthly_credit_used = 0;
          let monthly_credit_generated = 0;
          
          if (raw_net_bill < 0) {
            // User generated more than consumed - add to credit balance
            monthly_credit_generated = Math.abs(raw_net_bill);
            running_credit_balance += monthly_credit_generated;
            actual_bill_after_credits = 0; // No payment due
          } else {
            // User owes money - deduct from credits first
            if (running_credit_balance > 0) {
              if (running_credit_balance >= raw_net_bill) {
                // Credits cover entire bill
                monthly_credit_used = raw_net_bill;
                running_credit_balance -= raw_net_bill;
                actual_bill_after_credits = 0;
                total_net_billing_savings += raw_net_bill;
              } else {
                // Credits partially cover bill
                monthly_credit_used = running_credit_balance;
                actual_bill_after_credits = raw_net_bill - running_credit_balance;
                total_net_billing_savings += running_credit_balance;
                running_credit_balance = 0;
              }
            } else {
              // No credits available
              actual_bill_after_credits = raw_net_bill;
            }
          }
          
          total_cost_after += actual_bill_after_credits;
          
          monthly_data.push({
            month,
            consumption: x1,
            generation: x2,
            generation_day: z1 + z2, // Combine morning periods for display
            generation_evening: z3, // Peak period
            generation_night: z4, // Night period
            self_consumption,
            export: export_energy,
            import: import1 + import2 + import3 + import4,
            bill_before,
            bill_after: actual_bill_after_credits,
            raw_bill_after: raw_net_bill,
            import_cost, // Cost of imported electricity using proper tariff calculation
            savings: bill_before - actual_bill_after_credits,
            export_revenue,
            monthly_credit_used,
            monthly_credit_generated,
            running_credit_balance: running_credit_balance // Show balance after this month
          });
        }
      } else {
        // ====================================
        // RESIDENTIAL 3-PERIOD CALCULATION (existing logic)
        // ====================================
        for (const month of months) {
        const x1 = consumption[month];
        const x2 = monthly_pv_generation;
        
        // Split consumption - EXACT factors
        const y1 = x1 * day_factors[month];
        const y2 = x1 * evening_factors[month];
        const y3 = x1 * night_factors[month];
        
        // Calculate before cost - EXACT tariff calculation
        const total = y1 + y2 + y3;
        const bill_before = calculateTariff(total, tariff_supported);
        total_cost_before += bill_before;
        
        // PV generation split using sun factors - EXACT logic
        const z1 = x2 * sun_peak_factors[month];      // Day generation
        const z2 = x2 * sun_medium_factors[month];    // Evening generation  
        const z3 = x2 * sun_low_factors[month];       // Night generation
        
        // Self-consumption using PV consumption factors - EXACT logic
        const k1 = Math.min(z1 * pv_consume_day[month], y1);
        const k2 = Math.min(z2 * pv_consume_evening[month], y2);
        const k3 = Math.min(z3 * pv_consume_night[month], y3);
        
        const self_consumption = k1 + k2 + k3;
        total_self_consumption += self_consumption;
        
        // Export - EXACT logic
        const export_energy = Math.max(0, z1 - k1) + Math.max(0, z2 - k2) + Math.max(0, z3 - k3);
        total_export += export_energy;
        
        // Import - EXACT logic
        const import_energy = Math.max(0, y1 - k1) + Math.max(0, y2 - k2) + Math.max(0, y3 - k3);
        
        // After costs - EXACT logic
        const import_cost = import_energy > 0 ? calculateTariff(import_energy, tariff_supported) : 0;
        const export_revenue = export_energy * export_tariff;
        total_export_revenue += export_revenue;
        
        // ENHANCED NET BILLING CALCULATION FOR RESIDENTIAL
        const raw_net_bill = import_cost - export_revenue;
        
        // Apply net billing credit system
        let actual_bill_after_credits = 0;
        let monthly_credit_used = 0;
        let monthly_credit_generated = 0;
        
        if (raw_net_bill < 0) {
          // User generated more than consumed - add to credit balance
          monthly_credit_generated = Math.abs(raw_net_bill);
          running_credit_balance += monthly_credit_generated;
          actual_bill_after_credits = 0; // No payment due
        } else {
          // User owes money - deduct from credits first
          if (running_credit_balance > 0) {
            if (running_credit_balance >= raw_net_bill) {
              // Credits cover entire bill
              monthly_credit_used = raw_net_bill;
              running_credit_balance -= raw_net_bill;
              actual_bill_after_credits = 0;
              total_net_billing_savings += raw_net_bill;
            } else {
              // Credits partially cover bill
              monthly_credit_used = running_credit_balance;
              actual_bill_after_credits = raw_net_bill - running_credit_balance;
              total_net_billing_savings += running_credit_balance;
              running_credit_balance = 0;
            }
          } else {
            // No credits available
            actual_bill_after_credits = raw_net_bill;
          }
        }
        
        total_cost_after += actual_bill_after_credits;
        
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
          bill_before,
          bill_after: actual_bill_after_credits,
          raw_bill_after: raw_net_bill,
          import_cost, // Cost of imported electricity using proper tariff calculation
          savings: bill_before - actual_bill_after_credits,
          export_revenue,
          monthly_credit_used,
          monthly_credit_generated,
          running_credit_balance: running_credit_balance // Show balance after this month
        });
        }
      }
      
      // Calculate savings
      const annual_savings = total_cost_before - total_cost_after;
      
      const results: CalculationResults = {
        monthly_data,
        annual_summary: {
          total_consumption: total_annual_consumption,
          pv_size: monthly_pv_generation,
          inverter_size,
          annual_generation: monthly_pv_generation * 12,
          total_self_consumption,
          total_export,
          cost_before: total_cost_before,
          cost_after: total_cost_after,
          annual_savings,
          export_revenue: total_export_revenue,
          efficiency: efficiency / 100,
          export_tariff,
          // NET BILLING ENHANCEMENTS
          net_billing_savings: total_net_billing_savings,
          final_credit_balance: running_credit_balance,
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