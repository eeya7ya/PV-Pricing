// server/app.ts
import express from "express";

// server/fakeAuth.ts
import { createHmac, timingSafeEqual } from "crypto";
var COOKIE_NAME = "pv_session";
var COOKIE_MAX_AGE = 7 * 24 * 60 * 60 * 1e3;
function getSecret() {
  return process.env.SESSION_SECRET || "pv-pricing-demo-secret-change-me";
}
var DEMO_USERS = [
  {
    id: 1,
    username: "admin",
    password: "admin123",
    firstName: "Demo",
    lastName: "Admin",
    email: "admin@demo.local",
    profileImageUrl: null,
    isAdmin: true
  },
  {
    id: 2,
    username: "user",
    password: "user123",
    firstName: "Demo",
    lastName: "User",
    email: "user@demo.local",
    profileImageUrl: null,
    isAdmin: false
  },
  {
    id: 3,
    username: "engineer",
    password: "engineer123",
    firstName: "Solar",
    lastName: "Engineer",
    email: "engineer@demo.local",
    profileImageUrl: null,
    isAdmin: false
  }
];
function base64UrlEncode(buf) {
  const b = typeof buf === "string" ? Buffer.from(buf) : buf;
  return b.toString("base64").replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}
function base64UrlDecode(str) {
  const pad = str.length % 4 === 0 ? "" : "=".repeat(4 - str.length % 4);
  return Buffer.from(str.replace(/-/g, "+").replace(/_/g, "/") + pad, "base64");
}
function signSession(payload) {
  const body = base64UrlEncode(JSON.stringify(payload));
  const sig = createHmac("sha256", getSecret()).update(body).digest();
  return `${body}.${base64UrlEncode(sig)}`;
}
function verifySession(token) {
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [body, sig] = parts;
  const expected = createHmac("sha256", getSecret()).update(body).digest();
  const provided = base64UrlDecode(sig);
  if (expected.length !== provided.length) return null;
  if (!timingSafeEqual(expected, provided)) return null;
  try {
    const payload = JSON.parse(base64UrlDecode(body).toString("utf8"));
    if (payload.exp < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}
function parseCookies(header) {
  const out = {};
  if (!header) return out;
  for (const part of header.split(";")) {
    const idx = part.indexOf("=");
    if (idx < 0) continue;
    const k = part.slice(0, idx).trim();
    const v = part.slice(idx + 1).trim();
    if (k) out[k] = decodeURIComponent(v);
  }
  return out;
}
function setSessionCookie(res, token) {
  const isProd = process.env.NODE_ENV === "production";
  const parts = [
    `${COOKIE_NAME}=${encodeURIComponent(token)}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${Math.floor(COOKIE_MAX_AGE / 1e3)}`
  ];
  if (isProd) parts.push("Secure");
  res.setHeader("Set-Cookie", parts.join("; "));
}
function clearSessionCookie(res) {
  res.setHeader(
    "Set-Cookie",
    `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`
  );
}
function findUserByUsername(username) {
  return DEMO_USERS.find((u) => u.username.toLowerCase() === username.toLowerCase());
}
function findUserById(id) {
  return DEMO_USERS.find((u) => u.id === id);
}
function publicUser(u) {
  const { password: _pw, ...rest } = u;
  return rest;
}
function getCurrentUser(req) {
  const cookies = parseCookies(req.headers.cookie);
  const token = cookies[COOKIE_NAME];
  if (!token) return null;
  const session = verifySession(token);
  if (!session) return null;
  const user = findUserById(session.userId);
  return user ? publicUser(user) : null;
}
function setupAuth(app) {
  app.post("/api/login", (req, res) => {
    const { username, password } = req.body ?? {};
    if (typeof username !== "string" || typeof password !== "string") {
      return res.status(400).json({ message: "Username and password required" });
    }
    const user = findUserByUsername(username);
    if (!user || user.password !== password) {
      return res.status(401).json({ message: "Invalid credentials" });
    }
    const token = signSession({
      userId: user.id,
      username: user.username,
      exp: Date.now() + COOKIE_MAX_AGE
    });
    setSessionCookie(res, token);
    res.status(200).json(publicUser(user));
  });
  app.post("/api/demo-login", (req, res) => {
    const as = req.body?.as ?? req.query?.as ?? "user";
    const user = findUserByUsername(as) ?? findUserByUsername("user");
    const token = signSession({
      userId: user.id,
      username: user.username,
      exp: Date.now() + COOKIE_MAX_AGE
    });
    setSessionCookie(res, token);
    res.status(200).json(publicUser(user));
  });
  app.post("/api/logout", (_req, res) => {
    clearSessionCookie(res);
    res.status(200).json({ ok: true });
  });
  app.get("/api/auth/user", (req, res) => {
    const user = getCurrentUser(req);
    if (!user) return res.status(401).json({ message: "Unauthorized" });
    res.json(user);
  });
  app.get("/api/user", (req, res) => {
    const user = getCurrentUser(req);
    if (!user) return res.status(401).json({ message: "Unauthorized" });
    res.json(user);
  });
  app.get("/api/demo-users", (_req, res) => {
    res.json(
      DEMO_USERS.map((u) => ({
        username: u.username,
        password: u.password,
        firstName: u.firstName,
        lastName: u.lastName,
        isAdmin: u.isAdmin
      }))
    );
  });
  app.post("/api/admin/create-user", (req, res, next) => {
    const current = getCurrentUser(req);
    if (!current || !current.isAdmin) {
      return res.status(403).json({ message: "Admin access required" });
    }
    const { username, password, isAdmin } = req.body ?? {};
    if (typeof username !== "string" || typeof password !== "string" || password.length < 8) {
      return res.status(400).json({ message: "Username and password (min 8 chars) required" });
    }
    if (findUserByUsername(username)) {
      return res.status(400).json({ message: "Username already exists" });
    }
    const newUser = {
      id: DEMO_USERS.length > 0 ? Math.max(...DEMO_USERS.map((u) => u.id)) + 1 : 1,
      username,
      password,
      firstName: username,
      lastName: "",
      email: `${username}@demo.local`,
      profileImageUrl: null,
      isAdmin: Boolean(isAdmin)
    };
    DEMO_USERS.push(newUser);
    res.status(201).json(publicUser(newUser));
  });
}

// server/routes.ts
import { z as z2 } from "zod";

// shared/schema.ts
import { sql } from "drizzle-orm";
import { pgTable, text, varchar, real, boolean, jsonb, serial, timestamp, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
var CUSTOMER_TYPES = ["Residential", "Industrial", "Commercial", "Hotels", "Hospitals", "Agriculture"];
var GRID_CONNECTION_METHODS = ["Net billing", "wheeling", "Zero export", "Buy all sell all"];
var TARIFF_CATEGORIES = ["Residential", "Industrial", "Custom"];
var solarProjects = pgTable("solar_projects", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  // Customer Configuration
  customer_type: text("customer_type").notNull().default("Residential"),
  // Customer type selection
  grid_connection: text("grid_connection").notNull().default("Net billing"),
  // Grid connection method
  consumption_data: jsonb("consumption_data").notNull(),
  // Monthly consumption {Jan: 500, Feb: 450, ...}
  // System Configuration (exactly as original)
  efficiency: real("efficiency").notNull().default(95),
  // System efficiency %
  degradation: real("degradation").notNull().default(0.5),
  // Annual degradation %
  // Tariff Configuration (exactly as original)
  tariff_supported: boolean("tariff_supported").notNull().default(true),
  export_tariff: real("export_tariff").notNull().default(0.05),
  // JD/kWh
  // Time Period Factors (exactly as original PyQt6 implementation)
  day_factors: jsonb("day_factors").notNull(),
  // Day Time (5-17) Factors
  evening_factors: jsonb("evening_factors").notNull(),
  // Evening Time (17-23) Factors  
  night_factors: jsonb("night_factors").notNull(),
  // Night Time (23-5) Factors
  // Solar Generation Factors (exactly as original)
  sun_peak_factors: jsonb("sun_peak_factors").notNull(),
  // Day Time Sun Factor
  sun_medium_factors: jsonb("sun_medium_factors").notNull(),
  // Evening Time Sun Factor
  sun_low_factors: jsonb("sun_low_factors").notNull(),
  // Night Time Sun Factor
  // PV Self-Consumption Factors (exactly as original)
  pv_consume_day: jsonb("pv_consume_day").notNull(),
  // Day Time PV Consumption
  pv_consume_evening: jsonb("pv_consume_evening").notNull(),
  // Evening Time PV Consumption
  pv_consume_night: jsonb("pv_consume_night").notNull(),
  // Night Time PV Consumption
  // Calculated Results (stored for persistence)
  calculation_results: jsonb("calculation_results"),
  // Complete calculation results
  // Dynamic Tariff Configuration
  tariff_type: text("tariff_type").notNull().default("residential:tiered"),
  // Tariff type identifier
  tariff_config: jsonb("tariff_config").notNull(),
  // Tariff configuration data
  created_at: text("created_at").default(sql`CURRENT_TIMESTAMP`),
  updated_at: text("updated_at").default(sql`CURRENT_TIMESTAMP`)
});
var sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull()
  },
  (table) => [index("IDX_session_expire").on(table.expire)]
);
var users = pgTable("users", {
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
  password: text("password"),
  // Optional for OAuth users
  isAdmin: boolean("is_admin").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow()
});
var MonthlyDataSchema = z.object({
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
  raw_bill_after: z.number().optional(),
  // Net billing enhancement
  import_cost: z.number().optional(),
  // Cost of imported electricity using proper tariff calculation
  savings: z.number(),
  export_revenue: z.number(),
  // Net billing system fields
  monthly_credit_used: z.number().optional(),
  monthly_credit_generated: z.number().optional(),
  running_credit_balance: z.number().optional(),
  period_details: z.string().optional()
  // Industrial Buy-All Sell-All period breakdown
});
var AnnualSummarySchema = z.object({
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
var CalculationResultsSchema = z.object({
  monthly_data: z.array(MonthlyDataSchema),
  annual_summary: AnnualSummarySchema,
  net_billing_enabled: z.boolean().optional()
});
var IndustrialTariffsSchema = z.object({
  import_period1: z.number().min(0),
  // Off Peak (5-14) import tariff ¢/kWh
  import_period2: z.number().min(0),
  // Half Peak (14-17) import tariff ¢/kWh
  import_period3: z.number().min(0),
  // Peak (17-23) import tariff ¢/kWh
  import_period4: z.number().min(0),
  // Half Peak (23-5) import tariff ¢/kWh
  export_period1: z.number().min(0),
  // Off Peak (5-14) export tariff ¢/kWh
  export_period2: z.number().min(0),
  // Half Peak (14-17) export tariff ¢/kWh
  export_period3: z.number().min(0),
  // Peak (17-23) export tariff ¢/kWh
  export_period4: z.number().min(0)
  // Half Peak (23-5) export tariff ¢/kWh
});
var TariffTierSchema = z.object({
  upToKWh: z.number().min(0),
  // Upper limit of this tier (kWh)
  rate: z.number().min(0)
  // Rate for this tier (JD/kWh)
});
var ResidentialTieredTariffSchema = z.object({
  mode: z.literal("tiered"),
  tiers: z.array(TariffTierSchema).min(1),
  // Array of tariff tiers
  export_rate: z.number().min(0).default(0.04)
  // Export tariff rate
});
var ResidentialFlatRateTariffSchema = z.object({
  mode: z.literal("flat"),
  tiers: z.array(TariffTierSchema).min(1),
  // Array of tariff tiers (usually 2 for flat rate)
  export_rate: z.number().min(0).default(0.04)
  // Export tariff rate
});
var ResidentialTariffSchema = z.discriminatedUnion("mode", [
  ResidentialTieredTariffSchema,
  ResidentialFlatRateTariffSchema
]);
var IndustrialTariffConfigSchema = z.object({
  type: z.literal("industrial"),
  config: IndustrialTariffsSchema,
  time_periods: z.object({
    off_peak: z.object({ start: z.number(), end: z.number(), duration: z.number() }).default({ start: 5, end: 14, duration: 9 }),
    half_peak_1: z.object({ start: z.number(), end: z.number(), duration: z.number() }).default({ start: 14, end: 17, duration: 3 }),
    peak: z.object({ start: z.number(), end: z.number(), duration: z.number() }).default({ start: 17, end: 23, duration: 6 }),
    half_peak_2: z.object({ start: z.number(), end: z.number(), duration: z.number() }).default({ start: 23, end: 5, duration: 6 })
  }).optional()
});
var ResidentialTariffConfigSchema = z.object({
  type: z.literal("residential"),
  config: ResidentialTariffSchema
});
var TariffConfigSchema = z.discriminatedUnion("type", [
  ResidentialTariffConfigSchema,
  IndustrialTariffConfigSchema
]);
var TimeFactorsSchema = z.object({
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
var MonthlyConsumptionSchema = z.object({
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
var ScenarioSchema = z.object({
  name: z.string(),
  pv_size: z.number(),
  annual_savings: z.number(),
  roi: z.number(),
  consumption: MonthlyConsumptionSchema
});
var INDUSTRIAL_BASS_TYPES = ["Small Industrial", "Medium Industrial"];
var IndustrialBassTypeSchema = z.enum(INDUSTRIAL_BASS_TYPES);
var IndustrialBassConfigSchema = z.object({
  type: IndustrialBassTypeSchema,
  // Time period distribution factors (4 periods, must sum to 1.0)
  off_peak_factor: z.number().min(0).max(1).default(0.25),
  // 5:00-14:00 (9h)
  half_peak_day_factor: z.number().min(0).max(1).default(0.125),
  // 14:00-17:00 (3h)
  peak_factor: z.number().min(0).max(1).default(0.25),
  // 17:00-23:00 (6h)
  half_peak_night_factor: z.number().min(0).max(1).default(0.375),
  // 23:00-5:00 (6h)
  // Export tariff rate
  export_rate: z.number().min(0).default(0.05)
  // 0.05 JD/kWh export rate
});
var CustomerTypeSchema = z.enum(CUSTOMER_TYPES);
var GridConnectionSchema = z.enum(GRID_CONNECTION_METHODS);
var TariffCategorySchema = z.enum(TARIFF_CATEGORIES);
var insertSolarProjectSchema = createInsertSchema(solarProjects).omit({
  id: true,
  created_at: true,
  updated_at: true
});
var insertUserSchema = createInsertSchema(users);
var TARIFF_PRESETS = {
  // Residential Tiered Tariff (Figure-1)
  "residential:tiered": {
    type: "residential",
    config: {
      mode: "tiered",
      tiers: [
        { upToKWh: 300, rate: 0.05 },
        // ≤300kWh @ 0.05 JD/kWh
        { upToKWh: 600, rate: 0.1 },
        // 300-600kWh @ 0.10 JD/kWh
        { upToKWh: Infinity, rate: 0.2 }
        // >600kWh @ 0.20 JD/kWh
      ],
      export_rate: 0.04
    }
  },
  // Residential Flat Rate Tariff (Figure-1)
  "residential:flat": {
    type: "residential",
    config: {
      mode: "flat",
      tiers: [
        { upToKWh: 1e3, rate: 0.12 },
        // ≤1000kWh @ 0.12 JD/kWh
        { upToKWh: Infinity, rate: 0.15 }
        // >1000kWh @ 0.15 JD/kWh
      ],
      export_rate: 0.04
    }
  },
  // Industrial 4-Period TOU (Figure-2)
  "industrial:tou": {
    type: "industrial",
    config: {
      import_period1: 5.9,
      // Off Peak (5-14) - 5.9¢/kWh
      import_period2: 6.9,
      // Half Peak (14-17) - 6.9¢/kWh
      import_period3: 7.9,
      // Peak (17-23) - 7.9¢/kWh
      import_period4: 6.9,
      // Half Peak Night (23-5) - 6.9¢/kWh
      export_period1: 4,
      // All periods export at 4.0¢/kWh
      export_period2: 4,
      export_period3: 4,
      export_period4: 4
    },
    time_periods: {
      off_peak: { start: 5, end: 14, duration: 9 },
      half_peak_1: { start: 14, end: 17, duration: 3 },
      peak: { start: 17, end: 23, duration: 6 },
      half_peak_2: { start: 23, end: 5, duration: 6 }
    }
  }
};

// server/storage.ts
import { randomUUID } from "crypto";
var MemStorage = class {
  solarProjects = /* @__PURE__ */ new Map();
  calculationResults = /* @__PURE__ */ new Map();
  async getSolarProject(id) {
    return this.solarProjects.get(id);
  }
  async getSolarProjectByName(name) {
    return Array.from(this.solarProjects.values()).find((p) => p.name === name);
  }
  async createSolarProject(insertProject) {
    const id = randomUUID();
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const customerType = insertProject.customer_type ?? "Residential";
    const defaultTariffType = customerType === "Industrial" ? "industrial:tou" : "residential:tiered";
    const defaultTariffConfig = TARIFF_PRESETS[defaultTariffType];
    const project = {
      id,
      created_at: now,
      updated_at: now,
      name: insertProject.name,
      customer_type: customerType,
      grid_connection: insertProject.grid_connection ?? "Net billing",
      consumption_data: insertProject.consumption_data,
      efficiency: insertProject.efficiency ?? 95,
      degradation: insertProject.degradation ?? 0.5,
      tariff_supported: insertProject.tariff_supported ?? true,
      export_tariff: insertProject.export_tariff ?? 0.05,
      day_factors: insertProject.day_factors,
      evening_factors: insertProject.evening_factors,
      night_factors: insertProject.night_factors,
      sun_peak_factors: insertProject.sun_peak_factors,
      sun_medium_factors: insertProject.sun_medium_factors,
      sun_low_factors: insertProject.sun_low_factors,
      pv_consume_day: insertProject.pv_consume_day,
      pv_consume_evening: insertProject.pv_consume_evening,
      pv_consume_night: insertProject.pv_consume_night,
      calculation_results: insertProject.calculation_results,
      tariff_type: insertProject.tariff_type ?? defaultTariffType,
      tariff_config: insertProject.tariff_config ?? defaultTariffConfig
    };
    this.solarProjects.set(id, project);
    return project;
  }
  async updateSolarProject(id, updateData) {
    const existing = this.solarProjects.get(id);
    if (!existing) return void 0;
    const updated = {
      ...existing,
      ...updateData,
      updated_at: (/* @__PURE__ */ new Date()).toISOString()
    };
    this.solarProjects.set(id, updated);
    return updated;
  }
  async deleteSolarProject(id) {
    const deleted = this.solarProjects.delete(id);
    if (deleted) this.calculationResults.delete(id);
    return deleted;
  }
  async getAllSolarProjects() {
    return Array.from(this.solarProjects.values());
  }
  async saveCalculationResults(projectId, results) {
    this.calculationResults.set(projectId, results);
    const project = this.solarProjects.get(projectId);
    if (project) {
      project.calculation_results = results;
      project.updated_at = (/* @__PURE__ */ new Date()).toISOString();
    }
  }
  async getCalculationResults(projectId) {
    return this.calculationResults.get(projectId);
  }
};
var storage = new MemStorage();

// server/routes.ts
async function registerRoutes(app) {
  setupAuth(app);
  app.get("/api/projects", async (req, res) => {
    try {
      const projects = await storage.getAllSolarProjects();
      res.json(projects);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch projects" });
    }
  });
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
  app.post("/api/projects", async (req, res) => {
    try {
      const validatedData = insertSolarProjectSchema.parse(req.body);
      const project = await storage.createSolarProject(validatedData);
      res.status(201).json(project);
    } catch (error) {
      res.status(400).json({ error: "Invalid project data", details: error });
    }
  });
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
  app.post("/api/calculate", async (req, res) => {
    try {
      const baseCalculationSchema = z2.object({
        consumption: MonthlyConsumptionSchema,
        efficiency: z2.number().min(0).max(100).optional().default(95),
        tariff_supported: z2.boolean().optional().default(true),
        export_tariff: z2.number().min(0).optional().default(0.04),
        customer_type: z2.string().optional().default("Residential")
      });
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
      let validatedData;
      const customerType = req.body.customer_type || "Residential";
      if (customerType === "Industrial") {
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
      } = validatedData;
      const calculateTariff = (energy_kwh, tariff_supported2) => {
        if (tariff_supported2) {
          if (energy_kwh <= 300) {
            return energy_kwh * 0.05;
          } else if (energy_kwh <= 600) {
            return 300 * 0.05 + (energy_kwh - 300) * 0.1;
          } else {
            return 300 * 0.05 + 300 * 0.1 + (energy_kwh - 600) * 0.2;
          }
        } else {
          if (energy_kwh <= 1e3) {
            return energy_kwh * 0.12;
          } else {
            return 1e3 * 0.12 + (energy_kwh - 1e3) * 0.15;
          }
        }
      };
      const calculateIndustrialTariff = (consumption_by_period, tariffs) => {
        if (!tariffs) {
          console.error("\u274C Industrial tariffs are undefined/null!");
          return 0;
        }
        let total_cost = 0;
        total_cost += consumption_by_period[0] * (tariffs.import_period1 / 100);
        total_cost += consumption_by_period[1] * (tariffs.import_period2 / 100);
        total_cost += consumption_by_period[2] * (tariffs.import_period3 / 100);
        total_cost += consumption_by_period[3] * (tariffs.import_period4 / 100);
        return total_cost;
      };
      const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      const total_annual_consumption = months.reduce((sum, month) => sum + consumption[month], 0);
      let monthly_pv_generation = total_annual_consumption / 12;
      if (customer_type === "Industrial") {
        monthly_pv_generation = monthly_pv_generation / 2;
      }
      const inverter_size = monthly_pv_generation / (130 * 0.95);
      let total_cost_before = 0;
      let total_cost_after = 0;
      let total_export_revenue = 0;
      let total_self_consumption = 0;
      let total_export = 0;
      let running_credit_balance = 0;
      let total_net_billing_savings = 0;
      const monthly_data = [];
      if (customer_type === "Industrial") {
        for (const month of months) {
          const x1 = consumption[month];
          const x2 = monthly_pv_generation;
          const y1 = x1 * period1_factors[month];
          const y2 = x1 * period2_factors[month];
          const y3 = x1 * period3_factors[month];
          const y4 = x1 * period4_factors[month];
          const consumption_by_period = [y1, y2, y3, y4];
          const bill_before = calculateIndustrialTariff(consumption_by_period, industrial_tariffs || {});
          total_cost_before += bill_before;
          const z1 = x2 * sun_period1_factors[month];
          const z22 = x2 * sun_period2_factors[month];
          const z3 = x2 * sun_period3_factors[month];
          const z4 = x2 * sun_period4_factors[month];
          const k1 = Math.min(z1 * pv_consume_period1[month], y1);
          const k2 = Math.min(z22 * pv_consume_period2[month], y2);
          const k3 = Math.min(z3 * pv_consume_period3[month], y3);
          const k4 = Math.min(z4 * pv_consume_period4[month], y4);
          const self_consumption = k1 + k2 + k3 + k4;
          total_self_consumption += self_consumption;
          const export1 = Math.max(0, z1 - k1);
          const export2 = Math.max(0, z22 - k2);
          const export3 = Math.max(0, z3 - k3);
          const export4 = Math.max(0, z4 - k4);
          const export_energy = export1 + export2 + export3 + export4;
          total_export += export_energy;
          const import1 = Math.max(0, y1 - k1);
          const import2 = Math.max(0, y2 - k2);
          const import3 = Math.max(0, y3 - k3);
          const import4 = Math.max(0, y4 - k4);
          const import_by_period = [import1, import2, import3, import4];
          const import_cost = calculateIndustrialTariff(import_by_period, industrial_tariffs);
          const export_revenue = export1 * (industrial_tariffs.export_period1 / 100) + export2 * (industrial_tariffs.export_period2 / 100) + export3 * (industrial_tariffs.export_period3 / 100) + export4 * (industrial_tariffs.export_period4 / 100);
          total_export_revenue += export_revenue;
          const raw_net_bill = import_cost - export_revenue;
          let actual_bill_after_credits = 0;
          let monthly_credit_used = 0;
          let monthly_credit_generated = 0;
          if (raw_net_bill < 0) {
            monthly_credit_generated = Math.abs(raw_net_bill);
            running_credit_balance += monthly_credit_generated;
            actual_bill_after_credits = 0;
          } else {
            if (running_credit_balance > 0) {
              if (running_credit_balance >= raw_net_bill) {
                monthly_credit_used = raw_net_bill;
                running_credit_balance -= raw_net_bill;
                actual_bill_after_credits = 0;
                total_net_billing_savings += raw_net_bill;
              } else {
                monthly_credit_used = running_credit_balance;
                actual_bill_after_credits = raw_net_bill - running_credit_balance;
                total_net_billing_savings += running_credit_balance;
                running_credit_balance = 0;
              }
            } else {
              actual_bill_after_credits = raw_net_bill;
            }
          }
          total_cost_after += actual_bill_after_credits;
          monthly_data.push({
            month,
            consumption: x1,
            generation: x2,
            generation_day: z1 + z22,
            // Combine morning periods for display
            generation_evening: z3,
            // Peak period
            generation_night: z4,
            // Night period
            self_consumption,
            export: export_energy,
            import: import1 + import2 + import3 + import4,
            bill_before,
            bill_after: actual_bill_after_credits,
            raw_bill_after: raw_net_bill,
            import_cost,
            // Cost of imported electricity using proper tariff calculation
            savings: bill_before - actual_bill_after_credits,
            export_revenue,
            monthly_credit_used,
            monthly_credit_generated,
            running_credit_balance
            // Show balance after this month
          });
        }
      } else {
        for (const month of months) {
          const x1 = consumption[month];
          const x2 = monthly_pv_generation;
          const y1 = x1 * day_factors[month];
          const y2 = x1 * evening_factors[month];
          const y3 = x1 * night_factors[month];
          const total = y1 + y2 + y3;
          const bill_before = calculateTariff(total, tariff_supported);
          total_cost_before += bill_before;
          const z1 = x2 * sun_peak_factors[month];
          const z22 = x2 * sun_medium_factors[month];
          const z3 = x2 * sun_low_factors[month];
          const k1 = Math.min(z1 * pv_consume_day[month], y1);
          const k2 = Math.min(z22 * pv_consume_evening[month], y2);
          const k3 = Math.min(z3 * pv_consume_night[month], y3);
          const self_consumption = k1 + k2 + k3;
          total_self_consumption += self_consumption;
          const export_energy = Math.max(0, z1 - k1) + Math.max(0, z22 - k2) + Math.max(0, z3 - k3);
          total_export += export_energy;
          const import_energy = Math.max(0, y1 - k1) + Math.max(0, y2 - k2) + Math.max(0, y3 - k3);
          const import_cost = import_energy > 0 ? calculateTariff(import_energy, tariff_supported) : 0;
          const export_revenue = export_energy * export_tariff;
          total_export_revenue += export_revenue;
          const raw_net_bill = import_cost - export_revenue;
          let actual_bill_after_credits = 0;
          let monthly_credit_used = 0;
          let monthly_credit_generated = 0;
          if (raw_net_bill < 0) {
            monthly_credit_generated = Math.abs(raw_net_bill);
            running_credit_balance += monthly_credit_generated;
            actual_bill_after_credits = 0;
          } else {
            if (running_credit_balance > 0) {
              if (running_credit_balance >= raw_net_bill) {
                monthly_credit_used = raw_net_bill;
                running_credit_balance -= raw_net_bill;
                actual_bill_after_credits = 0;
                total_net_billing_savings += raw_net_bill;
              } else {
                monthly_credit_used = running_credit_balance;
                actual_bill_after_credits = raw_net_bill - running_credit_balance;
                total_net_billing_savings += running_credit_balance;
                running_credit_balance = 0;
              }
            } else {
              actual_bill_after_credits = raw_net_bill;
            }
          }
          total_cost_after += actual_bill_after_credits;
          monthly_data.push({
            month,
            consumption: x1,
            generation: x2,
            generation_day: z1,
            generation_evening: z22,
            generation_night: z3,
            self_consumption,
            export: export_energy,
            import: import_energy,
            bill_before,
            bill_after: actual_bill_after_credits,
            raw_bill_after: raw_net_bill,
            import_cost,
            // Cost of imported electricity using proper tariff calculation
            savings: bill_before - actual_bill_after_credits,
            export_revenue,
            monthly_credit_used,
            monthly_credit_generated,
            running_credit_balance
            // Show balance after this month
          });
        }
      }
      const annual_savings = total_cost_before - total_cost_after;
      const results = {
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
      if (error instanceof z2.ZodError) {
        res.status(400).json({
          error: "Invalid calculation parameters",
          details: error.errors.map((e) => `${e.path.join(".")}: ${e.message}`).join(", ")
        });
      } else {
        res.status(400).json({ error: "Calculation failed", details: error });
      }
    }
  });
  app.post("/api/calculate-npv", async (req, res) => {
    try {
      const {
        annual_savings = 1e3,
        system_cost = 5e3,
        discount_rate = 0.05,
        project_life = 25
      } = req.body;
      let npv = -system_cost;
      for (let year = 1; year <= project_life; year++) {
        const degradation_factor = Math.pow(1 - 5e-3, year);
        const yearly_savings = annual_savings * degradation_factor;
        const pv_savings = yearly_savings / Math.pow(1 + discount_rate, year);
        npv += pv_savings;
      }
      const simple_return = annual_savings / system_cost;
      const irr = Math.min(simple_return * 100, 50);
      const payback = annual_savings > 0 ? system_cost / annual_savings : 999;
      const annual_generation = 1e3;
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

// server/app.ts
async function createApp() {
  const app = express();
  app.use(express.json());
  app.use(express.urlencoded({ extended: false }));
  app.use((req, res, next) => {
    const start = Date.now();
    const path = req.path;
    res.on("finish", () => {
      if (path.startsWith("/api")) {
        const duration = Date.now() - start;
        console.log(`${req.method} ${path} ${res.statusCode} in ${duration}ms`);
      }
    });
    next();
  });
  await registerRoutes(app);
  app.use((err, _req, res, _next) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";
    if (!res.headersSent) res.status(status).json({ message });
  });
  return app;
}

// server/handler.ts
var appPromise = null;
async function getHandler() {
  if (!appPromise) {
    appPromise = createApp().then(
      (app) => app
    );
  }
  return appPromise;
}
async function handler(req, res) {
  const app = await getHandler();
  return app(req, res);
}
export {
  handler as default
};
