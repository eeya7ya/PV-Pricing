import { sql } from "drizzle-orm";
import { pgTable, text, varchar, real, boolean, jsonb, serial, timestamp, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Customer Types and Grid Connection Methods
export const CUSTOMER_TYPES = ['Residential', 'Industrial', 'Commercial', 'Hotels', 'Hospitals', 'Agriculture'] as const;
export const GRID_CONNECTION_METHODS = ['Net billing', 'wheeling', 'Zero export', 'Buy all sell all'] as const;

// Tariff Categories for Dynamic System
export const TARIFF_CATEGORIES = ['Residential', 'Industrial', 'Custom'] as const;

// Solar PV Calculator Schema - preserving all original calculations and parameters
export const solarProjects = pgTable("solar_projects", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  
  // Customer Configuration
  customer_type: text("customer_type").notNull().default('Residential'), // Customer type selection
  grid_connection: text("grid_connection").notNull().default('Net billing'), // Grid connection method
  
  consumption_data: jsonb("consumption_data").notNull(), // Monthly consumption {Jan: 500, Feb: 450, ...}
  
  // System Configuration (exactly as original)
  efficiency: real("efficiency").notNull().default(95), // System efficiency %
  degradation: real("degradation").notNull().default(0.5), // Annual degradation %
  
  // Tariff Configuration (exactly as original)
  tariff_supported: boolean("tariff_supported").notNull().default(true),
  export_tariff: real("export_tariff").notNull().default(0.05), // JD/kWh
  
  // Time Period Factors (exactly as original PyQt6 implementation)
  day_factors: jsonb("day_factors").notNull(), // Day Time (5-17) Factors
  evening_factors: jsonb("evening_factors").notNull(), // Evening Time (17-23) Factors  
  night_factors: jsonb("night_factors").notNull(), // Night Time (23-5) Factors
  
  // Solar Generation Factors (exactly as original)
  sun_peak_factors: jsonb("sun_peak_factors").notNull(), // Day Time Sun Factor
  sun_medium_factors: jsonb("sun_medium_factors").notNull(), // Evening Time Sun Factor
  sun_low_factors: jsonb("sun_low_factors").notNull(), // Night Time Sun Factor
  
  // PV Self-Consumption Factors (exactly as original)
  pv_consume_day: jsonb("pv_consume_day").notNull(), // Day Time PV Consumption
  pv_consume_evening: jsonb("pv_consume_evening").notNull(), // Evening Time PV Consumption
  pv_consume_night: jsonb("pv_consume_night").notNull(), // Night Time PV Consumption
  
  // Calculated Results (stored for persistence)
  calculation_results: jsonb("calculation_results"), // Complete calculation results
  
  // Dynamic Tariff Configuration
  tariff_type: text("tariff_type").notNull().default('residential:tiered'), // Tariff type identifier
  tariff_config: jsonb("tariff_config").notNull(), // Tariff configuration data
  
  created_at: text("created_at").default(sql`CURRENT_TIMESTAMP`),
  updated_at: text("updated_at").default(sql`CURRENT_TIMESTAMP`)
});

// Session storage table - Required for Replit Auth
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)],
);

// User authentication table - Updated for Google OAuth via Replit Auth
export const users = pgTable("users", {
  // Keep existing serial ID structure to avoid migration issues
  id: serial("id").primaryKey(),
  // OAuth subject ID from OIDC provider (used for OAuth user identification)
  oidcSub: varchar("oidc_sub").unique(),
  // OAuth fields from Replit Auth integration
  email: varchar("email").unique(),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  // Legacy fields for backwards compatibility (optional)
  username: varchar("username", { length: 255 }).unique(),
  password: text("password"), // Optional for OAuth users
  isAdmin: boolean("is_admin").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow()
});

// Monthly data type (exactly matching PyQt6 structure)
export const MonthlyDataSchema = z.object({
  month: z.string(),
  consumption: z.number(),
  generation: z.number(),
  generation_day: z.number(),
  generation_evening: z.number(),
  generation_night: z.number(),
  self_consumption: z.number(),
  export: z.number(),
  import: z.number(),
  bill_before: z.number(),
  bill_after: z.number(),
  raw_bill_after: z.number().optional(), // Net billing enhancement
  import_cost: z.number().optional(), // Cost of imported electricity using proper tariff calculation
  savings: z.number(),
  export_revenue: z.number(),
  // Net billing system fields
  monthly_credit_used: z.number().optional(),
  monthly_credit_generated: z.number().optional(),
  running_credit_balance: z.number().optional(),
  period_details: z.string().optional() // Industrial Buy-All Sell-All period breakdown
});

// Annual summary type (exactly matching PyQt6 structure)
export const AnnualSummarySchema = z.object({
  total_consumption: z.number(),
  pv_size: z.number(),
  inverter_size: z.number(),
  annual_generation: z.number(),
  total_self_consumption: z.number(),
  total_export: z.number(),
  cost_before: z.number(),
  cost_after: z.number(),
  annual_savings: z.number(),
  export_revenue: z.number(),
  efficiency: z.number(),
  export_tariff: z.number(),
  // Net billing system fields
  net_billing_savings: z.number().optional(),
  final_credit_balance: z.number().optional(),
  total_savings_with_net_billing: z.number().optional()
});



// Complete calculation results (exactly matching PyQt6 structure)
export const CalculationResultsSchema = z.object({
  monthly_data: z.array(MonthlyDataSchema),
  annual_summary: AnnualSummarySchema,
  net_billing_enabled: z.boolean().optional()
});

// Industrial 4-period tariff structure (Figure-2)
export const IndustrialTariffsSchema = z.object({
  import_period1: z.number().min(0), // Off Peak (5-14) import tariff ¢/kWh
  import_period2: z.number().min(0), // Half Peak (14-17) import tariff ¢/kWh
  import_period3: z.number().min(0), // Peak (17-23) import tariff ¢/kWh
  import_period4: z.number().min(0), // Half Peak (23-5) import tariff ¢/kWh
  export_period1: z.number().min(0), // Off Peak (5-14) export tariff ¢/kWh
  export_period2: z.number().min(0), // Half Peak (14-17) export tariff ¢/kWh
  export_period3: z.number().min(0), // Peak (17-23) export tariff ¢/kWh
  export_period4: z.number().min(0), // Half Peak (23-5) export tariff ¢/kWh
});

// Residential Tariff Tier Structure
export const TariffTierSchema = z.object({
  upToKWh: z.number().min(0), // Upper limit of this tier (kWh)
  rate: z.number().min(0), // Rate for this tier (JD/kWh)
});

// Residential Tariff Schemas (Figure-1)
export const ResidentialTieredTariffSchema = z.object({
  mode: z.literal('tiered'),
  tiers: z.array(TariffTierSchema).min(1), // Array of tariff tiers
  export_rate: z.number().min(0).default(0.04), // Export tariff rate
});

export const ResidentialFlatRateTariffSchema = z.object({
  mode: z.literal('flat'),
  tiers: z.array(TariffTierSchema).min(1), // Array of tariff tiers (usually 2 for flat rate)
  export_rate: z.number().min(0).default(0.04), // Export tariff rate
});

// Union of all residential tariff types
export const ResidentialTariffSchema = z.discriminatedUnion('mode', [
  ResidentialTieredTariffSchema,
  ResidentialFlatRateTariffSchema,
]);

// Industrial Tariff Configuration (Figure-2)
export const IndustrialTariffConfigSchema = z.object({
  type: z.literal('industrial'),
  config: IndustrialTariffsSchema,
  time_periods: z.object({
    off_peak: z.object({ start: z.number(), end: z.number(), duration: z.number() }).default({ start: 5, end: 14, duration: 9 }),
    half_peak_1: z.object({ start: z.number(), end: z.number(), duration: z.number() }).default({ start: 14, end: 17, duration: 3 }),
    peak: z.object({ start: z.number(), end: z.number(), duration: z.number() }).default({ start: 17, end: 23, duration: 6 }),
    half_peak_2: z.object({ start: z.number(), end: z.number(), duration: z.number() }).default({ start: 23, end: 5, duration: 6 }),
  }).optional(),
});

// Residential Tariff Configuration (Figure-1)
export const ResidentialTariffConfigSchema = z.object({
  type: z.literal('residential'),
  config: ResidentialTariffSchema,
});

// Dynamic Tariff Configuration System - Discriminated Union
export const TariffConfigSchema = z.discriminatedUnion('type', [
  ResidentialTariffConfigSchema,
  IndustrialTariffConfigSchema,
]);

// Time factors type (exactly as original - monthly percentages)
export const TimeFactorsSchema = z.object({
  Jan: z.number().min(0).max(1),
  Feb: z.number().min(0).max(1),
  Mar: z.number().min(0).max(1),
  Apr: z.number().min(0).max(1),
  May: z.number().min(0).max(1),
  Jun: z.number().min(0).max(1),
  Jul: z.number().min(0).max(1),
  Aug: z.number().min(0).max(1),
  Sep: z.number().min(0).max(1),
  Oct: z.number().min(0).max(1),
  Nov: z.number().min(0).max(1),
  Dec: z.number().min(0).max(1)
});

// Monthly consumption type  
export const MonthlyConsumptionSchema = z.object({
  Jan: z.number().min(0),
  Feb: z.number().min(0),
  Mar: z.number().min(0),
  Apr: z.number().min(0),
  May: z.number().min(0),
  Jun: z.number().min(0),
  Jul: z.number().min(0),
  Aug: z.number().min(0),
  Sep: z.number().min(0),
  Oct: z.number().min(0),
  Nov: z.number().min(0),
  Dec: z.number().min(0)
});

// Scenario comparison type (exactly as original)
export const ScenarioSchema = z.object({
  name: z.string(),
  pv_size: z.number(),
  annual_savings: z.number(),
  roi: z.number(),
  consumption: MonthlyConsumptionSchema
});

// Industrial Buy-All Sell-All Configuration (based on PyQt6 implementation)
export const INDUSTRIAL_BASS_TYPES = ['Small Industrial', 'Medium Industrial'] as const;
export const IndustrialBassTypeSchema = z.enum(INDUSTRIAL_BASS_TYPES);

export const IndustrialBassConfigSchema = z.object({
  type: IndustrialBassTypeSchema,
  // Time period distribution factors (4 periods, must sum to 1.0)
  off_peak_factor: z.number().min(0).max(1).default(0.250),      // 5:00-14:00 (9h)
  half_peak_day_factor: z.number().min(0).max(1).default(0.125), // 14:00-17:00 (3h)
  peak_factor: z.number().min(0).max(1).default(0.250),          // 17:00-23:00 (6h)
  half_peak_night_factor: z.number().min(0).max(1).default(0.375), // 23:00-5:00 (6h)
  // Export tariff rate
  export_rate: z.number().min(0).default(0.05), // 0.05 JD/kWh export rate
});

// Customer and Grid Connection Schemas
export const CustomerTypeSchema = z.enum(CUSTOMER_TYPES);
export const GridConnectionSchema = z.enum(GRID_CONNECTION_METHODS);
export const TariffCategorySchema = z.enum(TARIFF_CATEGORIES);
export type IndustrialBassType = z.infer<typeof IndustrialBassTypeSchema>;
export type IndustrialBassConfig = z.infer<typeof IndustrialBassConfigSchema>;

// Insert schemas
export const insertSolarProjectSchema = createInsertSchema(solarProjects).omit({
  id: true,
  created_at: true,
  updated_at: true
});

// Types
export type CustomerType = z.infer<typeof CustomerTypeSchema>;
export type GridConnection = z.infer<typeof GridConnectionSchema>;
export type TariffCategory = z.infer<typeof TariffCategorySchema>;
export type InsertSolarProject = z.infer<typeof insertSolarProjectSchema>;
export type SolarProject = typeof solarProjects.$inferSelect;
export type MonthlyData = z.infer<typeof MonthlyDataSchema>;
export type AnnualSummary = z.infer<typeof AnnualSummarySchema>;
export type CalculationResults = z.infer<typeof CalculationResultsSchema>;
export type TimeFactors = z.infer<typeof TimeFactorsSchema>;
export type MonthlyConsumption = z.infer<typeof MonthlyConsumptionSchema>;
export type Scenario = z.infer<typeof ScenarioSchema>;
export type IndustrialTariffs = z.infer<typeof IndustrialTariffsSchema>;
// Tariff Types
export type TariffTier = z.infer<typeof TariffTierSchema>;
export type ResidentialTariff = z.infer<typeof ResidentialTariffSchema>;
export type ResidentialTieredTariff = z.infer<typeof ResidentialTieredTariffSchema>;
export type ResidentialFlatRateTariff = z.infer<typeof ResidentialFlatRateTariffSchema>;
export type TariffConfig = z.infer<typeof TariffConfigSchema>;
export type ResidentialTariffConfig = z.infer<typeof ResidentialTariffConfigSchema>;
export type IndustrialTariffConfig = z.infer<typeof IndustrialTariffConfigSchema>;

// User authentication types
export const insertUserSchema = createInsertSchema(users);
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type UpsertUser = typeof users.$inferInsert; // Required for Replit Auth integration

// Default values - Residential + Net Billing (exactly as PyQt6 original)
export const DEFAULT_TIME_FACTORS = {
  DAY_FACTORS: { Jan: 0.30, Feb: 0.30, Mar: 0.30, Apr: 0.30, May: 0.30, Jun: 0.30, Jul: 0.30, Aug: 0.30, Sep: 0.30, Oct: 0.30, Nov: 0.30, Dec: 0.30 },
  EVENING_FACTORS: { Jan: 0.30, Feb: 0.30, Mar: 0.30, Apr: 0.30, May: 0.30, Jun: 0.30, Jul: 0.30, Aug: 0.30, Sep: 0.30, Oct: 0.30, Nov: 0.30, Dec: 0.30 },
  NIGHT_FACTORS: { Jan: 0.40, Feb: 0.40, Mar: 0.40, Apr: 0.40, May: 0.40, Jun: 0.40, Jul: 0.40, Aug: 0.40, Sep: 0.40, Oct: 0.40, Nov: 0.40, Dec: 0.40 },
  SUN_PEAK_FACTORS: { Jan: 1.00, Feb: 1.00, Mar: 1.00, Apr: 1.00, May: 1.00, Jun: 1.00, Jul: 1.00, Aug: 1.00, Sep: 1.00, Oct: 1.00, Nov: 1.00, Dec: 1.00 },
  SUN_MEDIUM_FACTORS: { Jan: 0.20, Feb: 0.20, Mar: 0.20, Apr: 0.20, May: 0.20, Jun: 0.20, Jul: 0.20, Aug: 0.20, Sep: 0.20, Oct: 0.20, Nov: 0.20, Dec: 0.20 },
  SUN_LOW_FACTORS: { Jan: 0.00, Feb: 0.00, Mar: 0.00, Apr: 0.00, May: 0.00, Jun: 0.00, Jul: 0.00, Aug: 0.00, Sep: 0.00, Oct: 0.00, Nov: 0.00, Dec: 0.00 },
  PV_CONSUME_DAY: { Jan: 0.70, Feb: 0.70, Mar: 0.70, Apr: 0.70, May: 0.70, Jun: 0.70, Jul: 0.70, Aug: 0.70, Sep: 0.70, Oct: 0.70, Nov: 0.70, Dec: 0.70 },
  PV_CONSUME_EVENING: { Jan: 0.90, Feb: 0.90, Mar: 0.90, Apr: 0.90, May: 0.90, Jun: 0.90, Jul: 0.90, Aug: 0.90, Sep: 0.90, Oct: 0.90, Nov: 0.90, Dec: 0.90 },
  PV_CONSUME_NIGHT: { Jan: 1.00, Feb: 1.00, Mar: 1.00, Apr: 1.00, May: 1.00, Jun: 1.00, Jul: 1.00, Aug: 1.00, Sep: 1.00, Oct: 1.00, Nov: 1.00, Dec: 1.00 }
};

// Industrial + Net Billing Default Factors (NEW: 4-period system from updated spreadsheet)
export const INDUSTRIAL_TIME_FACTORS = {
  // Consumption Energy Factors - NEW 4-period system (5-14, 14-17, 17-23, 23-5)
  PERIOD1_FACTORS: { Jan: 0.40, Feb: 0.40, Mar: 0.40, Apr: 0.40, May: 0.40, Jun: 0.40, Jul: 0.40, Aug: 0.40, Sep: 0.40, Oct: 0.40, Nov: 0.40, Dec: 0.40 }, // Off Peak (5-14) - y1 factor
  PERIOD2_FACTORS: { Jan: 0.20, Feb: 0.20, Mar: 0.20, Apr: 0.20, May: 0.20, Jun: 0.20, Jul: 0.20, Aug: 0.20, Sep: 0.20, Oct: 0.20, Nov: 0.20, Dec: 0.20 }, // Half Peak (14-17) - y2 factor
  PERIOD3_FACTORS: { Jan: 0.30, Feb: 0.30, Mar: 0.30, Apr: 0.30, May: 0.30, Jun: 0.30, Jul: 0.30, Aug: 0.30, Sep: 0.30, Oct: 0.30, Nov: 0.30, Dec: 0.30 }, // Peak (17-23) - y3 factor
  PERIOD4_FACTORS: { Jan: 0.10, Feb: 0.10, Mar: 0.10, Apr: 0.10, May: 0.10, Jun: 0.10, Jul: 0.10, Aug: 0.10, Sep: 0.10, Oct: 0.10, Nov: 0.10, Dec: 0.10 }, // Half Peak (23-5) - y4 factor
  
  // Solar Generation Factors (Industrial 4-period system)
  SUN_PERIOD1_FACTORS: { Jan: 0.70, Feb: 0.70, Mar: 0.70, Apr: 0.70, May: 0.70, Jun: 0.70, Jul: 0.70, Aug: 0.70, Sep: 0.70, Oct: 0.70, Nov: 0.70, Dec: 0.70 }, // Off Peak (5-14) solar generation factors
  SUN_PERIOD2_FACTORS: { Jan: 0.25, Feb: 0.25, Mar: 0.25, Apr: 0.25, May: 0.25, Jun: 0.25, Jul: 0.25, Aug: 0.25, Sep: 0.25, Oct: 0.25, Nov: 0.25, Dec: 0.25 }, // Half Peak (14-17) solar generation factors
  SUN_PERIOD3_FACTORS: { Jan: 0.05, Feb: 0.05, Mar: 0.05, Apr: 0.05, May: 0.05, Jun: 0.05, Jul: 0.05, Aug: 0.05, Sep: 0.05, Oct: 0.05, Nov: 0.05, Dec: 0.05 }, // Peak (17-23) solar generation factors
  SUN_PERIOD4_FACTORS: { Jan: 0.00, Feb: 0.00, Mar: 0.00, Apr: 0.00, May: 0.00, Jun: 0.00, Jul: 0.00, Aug: 0.00, Sep: 0.00, Oct: 0.00, Nov: 0.00, Dec: 0.00 }, // Half Peak (23-5) solar generation factors
  
  // PV Self-Consumption Factors (Industrial specific - NEW: k1, k2, k3, k4)
  PV_CONSUME_PERIOD1: { Jan: 0.80, Feb: 0.80, Mar: 0.80, Apr: 0.80, May: 0.80, Jun: 0.80, Jul: 0.80, Aug: 0.80, Sep: 0.80, Oct: 0.80, Nov: 0.80, Dec: 0.80 }, // Off Peak (5-14) - k1 consumption factor
  PV_CONSUME_PERIOD2: { Jan: 0.85, Feb: 0.85, Mar: 0.85, Apr: 0.85, May: 0.85, Jun: 0.85, Jul: 0.85, Aug: 0.85, Sep: 0.85, Oct: 0.85, Nov: 0.85, Dec: 0.85 }, // Half Peak (14-17) - k2 consumption factor
  PV_CONSUME_PERIOD3: { Jan: 0.90, Feb: 0.90, Mar: 0.90, Apr: 0.90, May: 0.90, Jun: 0.90, Jul: 0.90, Aug: 0.90, Sep: 0.90, Oct: 0.90, Nov: 0.90, Dec: 0.90 }, // Peak (17-23) - k3 consumption factor
  PV_CONSUME_PERIOD4: { Jan: 0.70, Feb: 0.70, Mar: 0.70, Apr: 0.70, May: 0.70, Jun: 0.70, Jul: 0.70, Aug: 0.70, Sep: 0.70, Oct: 0.70, Nov: 0.70, Dec: 0.70 }  // Half Peak (23-5) - k4 consumption factor
};

export const DEFAULT_CONSUMPTION: MonthlyConsumption = {
  Jan: 500, Feb: 500, Mar: 500, Apr: 500, May: 500, Jun: 500,
  Jul: 500, Aug: 500, Sep: 500, Oct: 500, Nov: 500, Dec: 500
};

// Default Tariff Presets based on Figure-1 and Figure-2
export const TARIFF_PRESETS = {
  // Residential Tiered Tariff (Figure-1)
  'residential:tiered': {
    type: 'residential' as const,
    config: {
      mode: 'tiered' as const,
      tiers: [
        { upToKWh: 300, rate: 0.05 },  // ≤300kWh @ 0.05 JD/kWh
        { upToKWh: 600, rate: 0.10 },  // 300-600kWh @ 0.10 JD/kWh
        { upToKWh: Infinity, rate: 0.20 }  // >600kWh @ 0.20 JD/kWh
      ],
      export_rate: 0.04
    }
  },
  
  // Residential Flat Rate Tariff (Figure-1)
  'residential:flat': {
    type: 'residential' as const,
    config: {
      mode: 'flat' as const,
      tiers: [
        { upToKWh: 1000, rate: 0.12 },  // ≤1000kWh @ 0.12 JD/kWh
        { upToKWh: Infinity, rate: 0.15 }  // >1000kWh @ 0.15 JD/kWh
      ],
      export_rate: 0.04
    }
  },
  
  // Industrial 4-Period TOU (Figure-2)
  'industrial:tou': {
    type: 'industrial' as const,
    config: {
      import_period1: 5.9,  // Off Peak (5-14) - 5.9¢/kWh
      import_period2: 6.9,  // Half Peak (14-17) - 6.9¢/kWh
      import_period3: 7.9,  // Peak (17-23) - 7.9¢/kWh
      import_period4: 6.9,  // Half Peak Night (23-5) - 6.9¢/kWh
      export_period1: 4.0,  // All periods export at 4.0¢/kWh
      export_period2: 4.0,
      export_period3: 4.0,
      export_period4: 4.0,
    },
    time_periods: {
      off_peak: { start: 5, end: 14, duration: 9 },
      half_peak_1: { start: 14, end: 17, duration: 3 },
      peak: { start: 17, end: 23, duration: 6 },
      half_peak_2: { start: 23, end: 5, duration: 6 },
    }
  }
} as const;