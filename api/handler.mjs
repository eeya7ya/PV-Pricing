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

// shared/jordanTariffs.ts
var SECTOR_TO_CLASS = {
  A1_subsidized: "residential",
  A2_unsubsidized: "residential",
  B1_commercial: "commercial",
  B2_temp_commercial: "commercial",
  B3_banks: "commercial",
  B4_telecom: "commercial",
  C1_small_industrial: "industrial",
  C2_medium_industrial: "industrial",
  C3_large_industrial: "industrial",
  C4_extractive: "industrial",
  D1_hotel_post2008: "hotel",
  D2_hotel_pre2008_flat: "hotel",
  D2_hotel_pre2008_tou: "hotel",
  D3_hotel_low_star: "hotel",
  E1_private_hospital: "hospital",
  E2_govt_hospital: "hospital",
  F1_agri_std: "agriculture",
  F2_agri_legacy: "agriculture",
  F3_agri_mixed_well: "agriculture",
  G1_standard_7tier: "special",
  G2_water_pumping: "special",
  G3_street_lighting: "special",
  G4_govt_armed_forces: "special",
  G5_ev_home: "special",
  G6_ev_public_wholesale: "special",
  G7_broadcasting: "special",
  G8_ports: "special"
};
var SECTOR_TARIFFS = {
  // ---- Residential ------------------------------------------------------
  A1_subsidized: {
    code: "A1_subsidized",
    label: "Residential \u2014 subsidized (A1)",
    pricingModel: "tiered",
    tiers: [
      { upToKWh: 300, rateFils: 50 },
      { upToKWh: 600, rateFils: 100 },
      { upToKWh: Infinity, rateFils: 200 }
    ],
    cashSubsidies: [
      { fromKWh: 51, toKWh: 200, jd: -2.5 },
      { fromKWh: 201, toKWh: 600, jd: -2 }
    ],
    minBillJD: 1.75,
    notes: "Eligibility: 1 meter, Jordanian (or Gazan Palestinian, women heads of family, Armed Forces auto-enrolled); subsidy lost on PV inverter >3.6 kW (1-ph) or parallel three-phase >10 kW."
  },
  A2_unsubsidized: {
    code: "A2_unsubsidized",
    label: "Residential \u2014 unsubsidized (A2)",
    pricingModel: "tiered",
    tiers: [
      { upToKWh: 1e3, rateFils: 120 },
      { upToKWh: Infinity, rateFils: 150 }
    ],
    temporaryFils: 150,
    minBillJD: 1.75
  },
  // ---- Commercial -------------------------------------------------------
  B1_commercial: {
    code: "B1_commercial",
    label: "Commercial (B1)",
    pricingModel: "tiered",
    tiers: [
      { upToKWh: 2e3, rateFils: 120 },
      { upToKWh: Infinity, rateFils: 152 }
    ],
    temporaryFils: 185
  },
  B2_temp_commercial: {
    code: "B2_temp_commercial",
    label: "Commercial \u2014 temporary subscription (B2)",
    pricingModel: "flat",
    flatFils: 185
  },
  B3_banks: {
    code: "B3_banks",
    label: "Banks (B3, TOU since 1/1/2025)",
    pricingModel: "tou3",
    tou3: { peakFils: 298, partialFils: 287, offPeakFils: 278 },
    temporaryFils: 285,
    phase2MandatoryTOU: true,
    notes: "TOU rates 298/287/278 are user-editable defaults \u2014 not confirmed in any retrieved primary source. Verify against actual bill before launch."
  },
  B4_telecom: {
    code: "B4_telecom",
    label: "Telecommunications (B4, TOU)",
    pricingModel: "tou3",
    tou3: { peakFils: 152, partialFils: 142, offPeakFils: 132 },
    temporaryFils: 170
  },
  // ---- Industrial (demand charges abolished since 1/7/2024) -------------
  C1_small_industrial: {
    code: "C1_small_industrial",
    label: "Small industrial \u2264200 kW (C1)",
    pricingModel: "tiered",
    tiers: [
      { upToKWh: 1e4, rateFils: 60 },
      { upToKWh: Infinity, rateFils: 68 }
    ],
    temporaryFils: 115
    // C1 has no TOU and no demand charge; PF penalty does NOT apply.
  },
  C2_medium_industrial: {
    code: "C2_medium_industrial",
    label: "Medium industrial (C2, TOU)",
    pricingModel: "tou3",
    // Audit fix: Partial 0.068 → 0.069 (69 fils)
    tou3: { peakFils: 79, partialFils: 69, offPeakFils: 59 },
    temporaryFils: 115,
    pfPenaltyApplies: true
  },
  C3_large_industrial: {
    code: "C3_large_industrial",
    label: "Large industrial (C3, TOU)",
    pricingModel: "tou3",
    tou3: { peakFils: 130, partialFils: 120, offPeakFils: 110 },
    temporaryFils: 123,
    pfPenaltyApplies: true
  },
  C4_extractive: {
    code: "C4_extractive",
    label: "Extractive industries (C4, TOU)",
    pricingModel: "tou3",
    tou3: { peakFils: 226, partialFils: 216, offPeakFils: 206 },
    temporaryFils: 230,
    pfPenaltyApplies: true
  },
  // ---- Hotels -----------------------------------------------------------
  D1_hotel_post2008: {
    code: "D1_hotel_post2008",
    label: "Hotel 4\u2605+ post-14/3/2008 (D1, TOU)",
    pricingModel: "tou3",
    tou3: { peakFils: 94, partialFils: 82, offPeakFils: 73 },
    temporaryFils: 115,
    pfPenaltyApplies: true
  },
  D2_hotel_pre2008_flat: {
    code: "D2_hotel_pre2008_flat",
    label: "Hotel 4\u2605+ pre-14/3/2008 (D2, flat option)",
    pricingModel: "flat",
    flatFils: 82,
    temporaryFils: 115
  },
  D2_hotel_pre2008_tou: {
    code: "D2_hotel_pre2008_tou",
    label: "Hotel 4\u2605+ pre-14/3/2008 (D2, TOU option)",
    pricingModel: "tou3",
    tou3: { peakFils: 94, partialFils: 82, offPeakFils: 73 },
    temporaryFils: 115,
    pfPenaltyApplies: true
  },
  D3_hotel_low_star: {
    code: "D3_hotel_low_star",
    label: "Hotel \u22643\u2605 (industry practice: priced as B1 commercial)",
    pricingModel: "tiered",
    tiers: [
      { upToKWh: 2e3, rateFils: 120 },
      { upToKWh: Infinity, rateFils: 152 }
    ],
    temporaryFils: 185,
    notes: "Not explicitly carved out in EMRC \xA716; treated as commercial B1 by industry practice."
  },
  // ---- Hospitals --------------------------------------------------------
  E1_private_hospital: {
    code: "E1_private_hospital",
    label: "Private hospital (E1, Phase-2 mandatory TOU since 1/1/2025)",
    pricingModel: "tou3",
    // Peak ≈151 reported (Al-Ghad / Private Hospitals Association); partial &
    // off-peak NOT published in any retrieved source. Treat as editable defaults.
    tou3: { peakFils: 151, partialFils: 140, offPeakFils: 130 },
    temporaryFils: 170,
    phase2MandatoryTOU: true,
    notes: "Partial and off-peak rates are placeholders pending EMRC confirmation. Peak \u2248151 fils per Al-Ghad citing Private Hospitals Association."
  },
  E2_govt_hospital: {
    code: "E2_govt_hospital",
    label: "Government hospital (E2 \u2192 Standard 7-tier G1)",
    pricingModel: "tiered",
    tiers: [
      { upToKWh: 160, rateFils: 42 },
      { upToKWh: 300, rateFils: 92 },
      { upToKWh: 500, rateFils: 109 },
      { upToKWh: 750, rateFils: 145 },
      { upToKWh: 1e3, rateFils: 169 },
      { upToKWh: 2e3, rateFils: 190 },
      { upToKWh: Infinity, rateFils: 256 }
    ],
    temporaryFils: 266
  },
  // ---- Agriculture ------------------------------------------------------
  F1_agri_std: {
    code: "F1_agri_std",
    label: "Agriculture \u2014 standard post-2008 \u2264100 kVA (F1, flat)",
    pricingModel: "flat",
    flatFils: 55,
    temporaryFils: 115
  },
  F2_agri_legacy: {
    code: "F2_agri_legacy",
    label: "Agriculture \u2014 legacy day/night (F2)",
    pricingModel: "tou3",
    // Legacy uses Day/Night, not 3-period TOU. We map Day → offPeak+partial,
    // Night → "peakFils slot reused as Night". Caller should use legacyDay/Night
    // helpers; tou3 fields here carry day/night as a degenerate mapping.
    tou3: { peakFils: 55, partialFils: 55, offPeakFils: 49 },
    temporaryFils: 115,
    pfPenaltyApplies: true,
    notes: "Day 07:00\u201323:00 = 55 fils; Night 23:00\u201307:00 = 49 fils. Use priceLegacyDayNight() for accurate billing."
  },
  F3_agri_mixed_well: {
    code: "F3_agri_mixed_well",
    label: "Agriculture \u2014 mixed-use well (F3)",
    pricingModel: "mixed_well",
    // Effective rate = 2/3 × 120 + 1/3 × 55 = 98.33 fils/kWh
    flatFils: 2 / 3 * 120 + 1 / 3 * 55,
    temporaryFils: 115,
    notes: "Formula: 2/3 \xD7 0.120 + 1/3 \xD7 0.055 (NEPCO \xA713)."
  },
  // ---- Special ----------------------------------------------------------
  G1_standard_7tier: {
    code: "G1_standard_7tier",
    label: "Standard 7-tier (G1)",
    pricingModel: "tiered",
    tiers: [
      { upToKWh: 160, rateFils: 42 },
      { upToKWh: 300, rateFils: 92 },
      { upToKWh: 500, rateFils: 109 },
      { upToKWh: 750, rateFils: 145 },
      { upToKWh: 1e3, rateFils: 169 },
      { upToKWh: 2e3, rateFils: 190 },
      { upToKWh: Infinity, rateFils: 256 }
    ],
    temporaryFils: 266
  },
  G2_water_pumping: {
    code: "G2_water_pumping",
    label: "Water pumping (G2, Phase-2 mandatory TOU since 1/1/2025)",
    pricingModel: "tou3",
    // Audit fix: Partial 0.096 → 0.095; flat 0.095 option REMOVED.
    tou3: { peakFils: 106, partialFils: 95, offPeakFils: 86 },
    temporaryFils: 115,
    phase2MandatoryTOU: true
  },
  G3_street_lighting: {
    code: "G3_street_lighting",
    label: "Street lighting (G3, flat)",
    pricingModel: "flat",
    flatFils: 114
  },
  G4_govt_armed_forces: {
    code: "G4_govt_armed_forces",
    label: "Government / Armed Forces (G4, Phase-2 mandatory TOU since 1/1/2025)",
    pricingModel: "tou3",
    // Audit fix: flat 0.146 option REMOVED — sector is mandatory TOU.
    tou3: { peakFils: 158, partialFils: 147, offPeakFils: 138 },
    temporaryFils: 156,
    phase2MandatoryTOU: true
  },
  G5_ev_home: {
    code: "G5_ev_home",
    label: "EV home charging (G5, TOU)",
    pricingModel: "tou3",
    tou3: { peakFils: 160, partialFils: 118, offPeakFils: 108 }
  },
  G6_ev_public_wholesale: {
    code: "G6_ev_public_wholesale",
    label: "EV public charging \u2014 regulated wholesale rate (G6, TOU)",
    pricingModel: "tou3",
    tou3: { peakFils: 133, partialFils: 113, offPeakFils: 103 },
    temporaryFils: 185,
    notes: "Retail price at the plug = wholesale + operator commission (~3.5 fils/kWh slow chargers, ~5 fils/kWh fast). See EV_PUBLIC_OPERATOR_COMMISSION_FILS."
  },
  G7_broadcasting: {
    code: "G7_broadcasting",
    label: "Broadcasting (G7, flat)",
    pricingModel: "flat",
    flatFils: 152
  },
  G8_ports: {
    code: "G8_ports",
    label: "Ports (G8, flat)",
    pricingModel: "flat",
    flatFils: 159
  }
};
var RURAL_FILS_PER_KWH = 1;
var TV_FEE_JD_PER_MONTH = 1;
var METER_RENT_JD = { singlePhase: 0.2, threePhase: 0.5 };
var MIN_BILL_JD = { residential: 1.75, nonResidential: 2 };
var FUEL_CLAUSE_FILS_BY_MONTH = {
  "2026-01": 0,
  "2026-02": 0,
  "2026-03": 0,
  "2026-04": 0,
  "2026-05": 0
};
function getFuelClauseFils(monthKey) {
  return FUEL_CLAUSE_FILS_BY_MONTH[monthKey] ?? 0;
}
var WASTE_FEE_JD = {
  A: 3,
  B: 2,
  C: 1.667
};
function gamMunicipalFeeJD(monthlyKWh) {
  if (monthlyKWh <= 200) return 1.667;
  return 1.667 + 5e-3 * (monthlyKWh - 200);
}
function calcUniversalAddOns(input) {
  const filsToJD = (fils) => fils / 1e3;
  const ruralFilsJD = input.applyRuralFils ? filsToJD(RURAL_FILS_PER_KWH * input.monthlyImportKWh) : 0;
  const fuelClauseJD = filsToJD(getFuelClauseFils(input.monthKey) * input.monthlyImportKWh);
  const tvFeeJD = input.applyTvFee && SECTOR_TO_CLASS[input.sector] === "residential" ? TV_FEE_JD_PER_MONTH : 0;
  const meterRentJD = input.applyMeterRent ? input.meterPhase === 3 ? METER_RENT_JD.threePhase : METER_RENT_JD.singlePhase : 0;
  const gamJD = input.applyGAM ? gamMunicipalFeeJD(input.monthlyImportKWh) : 0;
  const wasteJD = input.wasteClass ? WASTE_FEE_JD[input.wasteClass] : 0;
  const totalJD = ruralFilsJD + fuelClauseJD + tvFeeJD + meterRentJD + gamJD + wasteJD;
  return { ruralFilsJD, fuelClauseJD, tvFeeJD, meterRentJD, gamJD, wasteJD, totalJD };
}
function applyMinimumBillJD(rawBillJD, sector) {
  const klass = SECTOR_TO_CLASS[sector];
  const def = SECTOR_TARIFFS[sector].minBillJD;
  const floor = def ?? (klass === "residential" ? MIN_BILL_JD.residential : MIN_BILL_JD.nonResidential);
  return Math.max(rawBillJD, floor);
}
function powerFactorSurchargeJD(billJD, powerFactor) {
  if (powerFactor >= 0.88 || powerFactor <= 0) return 0;
  const steps = Math.round((0.88 - powerFactor) / 0.01);
  let pctPerStep;
  if (powerFactor >= 0.7) pctPerStep = 0.77;
  else if (powerFactor >= 0.6) pctPerStep = 0.95;
  else if (powerFactor >= 0.5) pctPerStep = 1.2;
  else pctPerStep = 1.5;
  return billJD * (pctPerStep * steps) / 100;
}
function sectorAllowsPFPenalty(sector) {
  return SECTOR_TARIFFS[sector].pfPenaltyApplies === true;
}
function priceTieredJD(monthlyKWh, tiers) {
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
  return totalFils / 1e3;
}
function priceTOU3JD(kwhByPeriod, tou) {
  const totalFils = kwhByPeriod.peak * tou.peakFils + kwhByPeriod.partial * tou.partialFils + kwhByPeriod.offPeak * tou.offPeakFils;
  return totalFils / 1e3;
}
function priceFlatJD(monthlyKWh, rateFils) {
  return monthlyKWh * rateFils / 1e3;
}
function priceImportJD(input) {
  const tariff = SECTOR_TARIFFS[input.sector];
  if (input.isTemporary && tariff.temporaryFils != null) {
    return priceFlatJD(input.monthlyKWh, tariff.temporaryFils);
  }
  switch (tariff.pricingModel) {
    case "tiered":
      return priceTieredJD(input.monthlyKWh, tariff.tiers);
    case "tou3": {
      const k = input.kwhByPeriod ?? { peak: 0, partial: 0, offPeak: input.monthlyKWh };
      return priceTOU3JD(k, tariff.tou3);
    }
    case "flat":
    case "mixed_well":
      return priceFlatJD(input.monthlyKWh, tariff.flatFils);
  }
}
var NB_RESIDENTIAL_EXPORT_RATE_JD = 0.05;
var NB_NONRES_EXPORT_RATE_JD = 0.04;
function gridServiceFeeJD(input) {
  if (input.mechanism === "M4_buy_all_sell_all") return 0;
  if (input.mechanism === "M5_legacy_net_metering") return 0;
  if (input.isWelfareBeneficiary) return 0;
  const klass = SECTOR_TO_CLASS[input.sector];
  if (klass === "residential") {
    const ratePerKWac = input.postBylawApplication ? 1 : 2;
    return input.inverterKWac * ratePerKWac;
  }
  switch (input.sector) {
    case "C1_small_industrial":
    case "C2_medium_industrial":
      return 0;
    // small/medium industrial exempt
    case "F1_agri_std":
    case "F2_agri_legacy":
    case "F3_agri_mixed_well":
      return 0;
    // agriculture exempt
    case "D1_hotel_post2008":
    case "D2_hotel_pre2008_flat":
    case "D2_hotel_pre2008_tou":
    case "D3_hotel_low_star":
      if (input.mechanism === "M1_net_value_offsite") return input.inverterKWac * 2.5;
      return input.inverterKWac * 2.5;
    case "B1_commercial":
    case "B2_temp_commercial":
    case "B3_banks":
    case "B4_telecom":
    case "C3_large_industrial":
    case "C4_extractive":
    case "E1_private_hospital":
    case "E2_govt_hospital":
    case "G1_standard_7tier":
    case "G2_water_pumping":
    case "G3_street_lighting":
    case "G4_govt_armed_forces":
    case "G5_ev_home":
    case "G6_ev_public_wholesale":
    case "G7_broadcasting":
    case "G8_ports":
      return input.inverterKWac * 13;
    // commercial / banks / normal tariff
    default:
      return input.inverterKWac * 13;
  }
}
function netBillingExportRateJD(sector) {
  return SECTOR_TO_CLASS[sector] === "residential" ? NB_RESIDENTIAL_EXPORT_RATE_JD : NB_NONRES_EXPORT_RATE_JD;
}
var SUBSIDY_LOSS_TRIGGER_KW = {
  singlePhaseInverter: 3.6,
  // formerly described as "16 A × 230 V" — equivalent
  threePhaseParallel: 10
};
function losesResidentialSubsidy(inverterKWac, phase) {
  if (phase === 1) return inverterKWac > SUBSIDY_LOSS_TRIGGER_KW.singlePhaseInverter;
  return inverterKWac > SUBSIDY_LOSS_TRIGGER_KW.threePhaseParallel;
}
var SPECIFIC_YIELD_KWH_PER_KWP_YEAR = 1800;
var SPECIFIC_YIELD_KWH_PER_KWP_MONTH = SPECIFIC_YIELD_KWH_PER_KWP_YEAR / 12;
var DC_AC_RATIO = {
  residential: 1.5,
  nonResidential: 1.2
};
var RESIDENTIAL_INVERTER_CAP_KWAC = {
  singlePhase: 3.6,
  threePhase: 10
};
function kWpFromKWac(kWac, sectorClass) {
  const ratio = sectorClass === "residential" ? DC_AC_RATIO.residential : DC_AC_RATIO.nonResidential;
  return kWac * ratio;
}
function kWacFromKWp(kWp, sectorClass) {
  const ratio = sectorClass === "residential" ? DC_AC_RATIO.residential : DC_AC_RATIO.nonResidential;
  return kWp / ratio;
}
function inverterKWacFromMonthlyKWh(monthlyKWh, sectorClass) {
  const kWp = monthlyKWh / SPECIFIC_YIELD_KWH_PER_KWP_MONTH;
  return kWacFromKWp(kWp, sectorClass);
}
function applyResidentialInverterCap(kWac, phase, sectorClass) {
  if (sectorClass !== "residential") return { kWac, capped: false, cap: null };
  const cap = phase === 1 ? RESIDENTIAL_INVERTER_CAP_KWAC.singlePhase : RESIDENTIAL_INVERTER_CAP_KWAC.threePhase;
  if (kWac > cap) return { kWac: cap, capped: true, cap };
  return { kWac, capped: false, cap };
}
function mechanismGenerationCapFraction(mechanism, sectorClass) {
  switch (mechanism) {
    case "M1_net_value_offsite":
      return 0.5;
    case "M2_net_value_onsite":
      return sectorClass === "residential" ? 1 : 0.5;
    case "M3_zero_export":
      return 1;
    case "M4_buy_all_sell_all":
      return 1;
    case "M5_legacy_net_metering":
      return 1;
  }
}
function isEligibleForMechanism(sector, mechanism) {
  if (mechanism === "M5_legacy_net_metering") return "unclear";
  if (mechanism === "M4_buy_all_sell_all") return "eligible";
  const klass = SECTOR_TO_CLASS[sector];
  if (mechanism === "M1_net_value_offsite") {
    if (sector === "C1_small_industrial" || sector === "C2_medium_industrial") return "eligible";
    if (klass === "hotel") return "eligible";
    if (klass === "agriculture") return "eligible";
    if (klass === "residential") return "ineligible";
    if (sector === "C3_large_industrial") return "unclear";
    return "unclear";
  }
  if (mechanism === "M2_net_value_onsite") {
    if (klass === "residential") return "eligible";
    if (sector === "C1_small_industrial" || sector === "C2_medium_industrial") return "eligible";
    if (klass === "hotel") return "eligible";
    if (klass === "agriculture") return "eligible";
    if (sector === "C4_extractive" || sector === "B3_banks") return "ineligible";
    return "unclear";
  }
  if (mechanism === "M3_zero_export") {
    if (sector === "B3_banks" || sector === "C4_extractive") return "ineligible";
    if (sector === "G1_standard_7tier") return "ineligible";
    return "eligible";
  }
  return "unclear";
}
function mapFourBucketToWheelingTOU(y1, y2, y3, y4) {
  return { offPeak: y1 + y2, partial: y4, peak: y3 };
}
function mapFourBucketToStandardTOU(y1, y2, y3, y4) {
  return { offPeak: y1, partial: y2 + y4, peak: y3 };
}
var LEGACY_EXPORT_HAIRCUT = 0.8;
var DEFAULT_ANNUAL_RESET_POLICY = "forfeit_year_end";
function applyAnnualReset(runningCreditJD, policy = DEFAULT_ANNUAL_RESET_POLICY) {
  switch (policy) {
    case "forfeit_year_end":
      return { balanceAfter: 0, forfeitedJD: runningCreditJD, cashedOutJD: 0 };
    case "cash_out":
      return { balanceAfter: 0, forfeitedJD: 0, cashedOutJD: runningCreditJD };
    case "rollover_indefinite":
      return { balanceAfter: runningCreditJD, forfeitedJD: 0, cashedOutJD: 0 };
  }
}
function defaultSectorFor(customerType, opts) {
  switch (customerType) {
    case "Residential":
      return opts?.subsidized === false ? "A2_unsubsidized" : "A1_subsidized";
    case "Industrial":
      switch (opts?.size) {
        case "small":
          return "C1_small_industrial";
        case "large":
          return "C3_large_industrial";
        case "extractive":
          return "C4_extractive";
        default:
          return "C2_medium_industrial";
      }
    case "Commercial":
      return "B1_commercial";
    case "Hotels":
      return "D1_hotel_post2008";
    case "Hospitals":
      return "E1_private_hospital";
    case "Agriculture":
      return "F1_agri_std";
  }
}

// shared/schema.ts
var CUSTOMER_TYPES = ["Residential", "Industrial", "Commercial", "Hotels", "Hospitals", "Agriculture"];
var GRID_CONNECTION_METHODS = ["Net billing", "wheeling", "Zero export", "Buy all sell all", "Legacy net metering"];
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
  total_savings_with_net_billing: z.number().optional(),
  // Bylaw 58/2024 grid service fee
  grid_service_fee_jd_per_month: z.number().optional(),
  grid_service_fee_jd_annual: z.number().optional(),
  // Jordan EMRC 2025 sector dispatch metadata
  sector: z.string().optional(),
  sector_label: z.string().optional(),
  net_billing_mechanism: z.string().optional(),
  // PV sizing outputs (EMRC standard yield 1,800 kWh/kWp/yr + DC:AC)
  kwp_dc: z.number().optional(),
  dc_ac_ratio: z.number().optional(),
  specific_yield_kwh_per_kwp_year: z.number().optional(),
  inverter_cap_kwac: z.number().nullable().optional(),
  inverter_cap_binding: z.boolean().optional(),
  mechanism_cap_fraction: z.number().optional(),
  loses_residential_subsidy: z.boolean().optional(),
  eligibility_status: z.enum(["eligible", "ineligible", "unclear"]).optional(),
  annual_reset_policy: z.string().optional(),
  forfeited_credit_jd: z.number().optional(),
  cashed_out_credit_jd: z.number().optional(),
  pv_design_active: z.boolean().optional()
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
      const SECTOR_CODES = Object.keys(SECTOR_TARIFFS);
      const baseCalculationSchema = z2.object({
        consumption: MonthlyConsumptionSchema,
        efficiency: z2.number().min(0).max(100).optional().default(95),
        tariff_supported: z2.boolean().optional().default(true),
        // Bylaw 58/2024 default export rates: 0.050 JD/kWh residential,
        // 0.040 JD/kWh non-residential. Caller may override.
        export_tariff: z2.number().min(0).optional().default(0.05),
        customer_type: z2.string().optional().default("Residential"),
        // Sector dispatcher (Jordan EMRC 2025 sector codes). If omitted we
        // derive a sensible default from customer_type + tariff_supported.
        sector: z2.enum(SECTOR_CODES).optional(),
        // Power-factor input (0.50–1.00). Default 0.90 → no penalty.
        // Penalty applies only to industrial C2/C3/C4, 3-part agri F2, and
        // 3-part 4★+ hotels D1/D2 (NEPCO §I.1.d).
        power_factor: z2.number().min(0.1).max(1).optional().default(0.9),
        // Universal add-on toggles (default to "on" per EMRC reality).
        apply_rural_fils: z2.boolean().optional().default(true),
        apply_tv_fee: z2.boolean().optional().default(true),
        apply_meter_rent: z2.boolean().optional().default(true),
        meter_phase: z2.union([z2.literal(1), z2.literal(3)]).optional().default(1),
        apply_gam_fee: z2.boolean().optional().default(false),
        waste_class: z2.enum(["A", "B", "C"]).nullable().optional().default(null),
        // Fuel-clause: defaults to EMRC monthly bulletin (0 fils through May
        // 2026). Provide tariff_year = 2026 to pick up published values.
        tariff_year: z2.number().int().optional().default(2026),
        // Net-billing structure (Bylaw 58/2024 + M5 legacy NEM).
        net_billing_mechanism: z2.enum([
          "M1_net_value_offsite",
          "M2_net_value_onsite",
          "M3_zero_export",
          "M4_buy_all_sell_all",
          "M5_legacy_net_metering"
        ]).optional().default("M2_net_value_onsite"),
        // Inverter nameplate (kWac). If absent we estimate from monthly PV
        // generation using the EMRC specific yield + DC:AC ratio + the
        // residential 3.6/10 kWac inverter cap.
        inverter_kwac: z2.number().min(0).optional(),
        // Connection phase (relevant for residential inverter cap and
        // single-phase subsidy-loss trigger).
        connection_phase: z2.union([z2.literal(1), z2.literal(3)]).optional().default(1),
        // Residential grid-fee grandfathering: applications dated 1/6/2024+
        // pay 1.000 JD/kWac/month; older systems keep the legacy 2.000.
        post_bylaw_application: z2.boolean().optional().default(true),
        // NAF / Takaful 1&3 / Royal Initiative beneficiaries are exempt.
        is_welfare_beneficiary: z2.boolean().optional().default(false),
        // EMRC temporary-subscription override (B2/C-temp/etc.).
        is_temporary: z2.boolean().optional().default(false),
        // Year-end credit policy. Default 'forfeit_year_end' matches legacy
        // practice; flip when EMRC publishes M2 rollover/cash-out rules.
        annual_reset_policy: z2.enum(["forfeit_year_end", "rollover_indefinite", "cash_out"]).optional().default(DEFAULT_ANNUAL_RESET_POLICY),
        // M5 legacy NEM export haircut (default 0.80 per MDPI Energies 2025
        // review; verify against the legacy Instructions PDF on emrc.gov.jo).
        legacy_export_haircut: z2.number().min(0).max(1).optional().default(LEGACY_EXPORT_HAIRCUT),
        // PV Design module override (Jordan PV physics engine). When
        // present, the per-month PV generation comes from the design engine
        // (region × tilt × loss chain) instead of the consumption-based
        // X2 = (consumption / 12) × mechanism-cap-fraction fallback.
        monthly_pv_generation_override: z2.array(z2.number().min(0)).length(12).optional(),
        kwp_dc_override: z2.number().min(0).optional(),
        // Detailed monthly mode: distribute the (flat) annual PV generation
        // across months by these 12 normalized shares (e.g. the region's
        // seasonal solar curve) instead of a flat consumption/12 every month.
        // Ignored when monthly_pv_generation_override is supplied.
        seasonal_generation_shares: z2.array(z2.number().min(0)).length(12).optional()
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
        industrial_tariffs
      } = validatedData;
      const sector = sector_override ?? defaultSectorFor(customer_type, {
        subsidized: customer_type === "Residential" ? Boolean(tariff_supported) : void 0
      });
      const sectorTariff = SECTOR_TARIFFS[sector];
      const sectorClass = SECTOR_TO_CLASS[sector];
      const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      const total_annual_consumption = months.reduce((sum, month) => sum + consumption[month], 0);
      const mech = net_billing_mechanism;
      const capFraction = mechanismGenerationCapFraction(mech, sectorClass);
      let monthly_pv_generation = total_annual_consumption / 12 * capFraction;
      const estimated_kwac = inverterKWacFromMonthlyKWh(monthly_pv_generation, sectorClass) / (efficiency / 100);
      const capped = applyResidentialInverterCap(
        inverter_kwac_input ?? estimated_kwac,
        connection_phase,
        sectorClass
      );
      const inverter_kwac = capped.kWac;
      const inverter_size = inverter_kwac;
      const kwp_dc = kWpFromKWac(inverter_kwac, sectorClass);
      if (capped.capped) {
        monthly_pv_generation = kwp_dc * SPECIFIC_YIELD_KWH_PER_KWP_MONTH * (efficiency / 100);
      }
      const shareSum = seasonal_generation_shares ? seasonal_generation_shares.reduce((s, v) => s + v, 0) : 0;
      const seasonalShares = seasonal_generation_shares && shareSum > 0 ? seasonal_generation_shares.map((v) => v / shareSum) : null;
      const annual_flat_generation = monthly_pv_generation * 12;
      const pvGenForMonth = (monthIndex) => monthly_pv_generation_override ? monthly_pv_generation_override[monthIndex] : seasonalShares ? annual_flat_generation * seasonalShares[monthIndex] : monthly_pv_generation;
      const annual_pv_generation = monthly_pv_generation_override ? monthly_pv_generation_override.reduce((s, v) => s + v, 0) : annual_flat_generation;
      const final_kwp_dc = kwp_dc_override ?? kwp_dc;
      const eligibility = isEligibleForMechanism(sector, mech);
      const loses_subsidy = sectorClass === "residential" && losesResidentialSubsidy(inverter_kwac, connection_phase);
      const effective_export_rate_jd = export_tariff != null && export_tariff !== 0.04 ? export_tariff : netBillingExportRateJD(sector);
      const priceMonthlyImport = (monthlyKWh, tou) => priceImportJD({
        sector,
        monthlyKWh,
        kwhByPeriod: tou,
        isTemporary: is_temporary
      });
      const mapResidentialBucketsToTOU = (day, evening, night) => ({
        peak: evening,
        partial: day * 0.25 + night,
        offPeak: day * 0.75
      });
      const sectorIsTOU = sectorTariff.pricingModel === "tou3";
      const calcExportRevenueJD = (exportKWh, _exportByPeriod) => {
        return exportKWh * effective_export_rate_jd;
      };
      const finalizeBill = (rawBillJD, importKWh, monthIndex) => {
        const monthKey = `${tariff_year}-${String(monthIndex + 1).padStart(2, "0")}`;
        const addOns = calcUniversalAddOns({
          sector,
          monthlyImportKWh: Math.max(0, importKWh),
          monthKey,
          meterPhase: meter_phase,
          applyTvFee: apply_tv_fee,
          applyGAM: apply_gam_fee,
          wasteClass: waste_class ?? null,
          applyRuralFils: apply_rural_fils,
          applyMeterRent: apply_meter_rent
        });
        const pfSurcharge = sectorAllowsPFPenalty(sector) && power_factor < 0.88 ? powerFactorSurchargeJD(Math.max(0, rawBillJD), power_factor) : 0;
        const subtotal = Math.max(0, rawBillJD) + addOns.totalJD + pfSurcharge;
        const finalBill = applyMinimumBillJD(subtotal, sector);
        return { finalBill, addOns, pfSurcharge };
      };
      let total_cost_before = 0;
      let total_cost_after = 0;
      let total_export_revenue = 0;
      let total_self_consumption = 0;
      let total_export = 0;
      let running_credit_balance = 0;
      let total_net_billing_savings = 0;
      const monthly_data = [];
      const applyCreditLedger = (rawNetBill) => {
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
      if (customer_type === "Industrial") {
        for (let mi = 0; mi < months.length; mi++) {
          const month = months[mi];
          const x1 = consumption[month];
          const x2 = pvGenForMonth(mi);
          const y1 = x1 * period1_factors[month];
          const y2 = x1 * period2_factors[month];
          const y3 = x1 * period3_factors[month];
          const y4 = x1 * period4_factors[month];
          const cons_tou = mech === "M1_net_value_offsite" ? mapFourBucketToWheelingTOU(y1, y2, y3, y4) : mapFourBucketToStandardTOU(y1, y2, y3, y4);
          const bill_before_raw = priceMonthlyImport(x1, cons_tou);
          const before_final = finalizeBill(bill_before_raw, x1, mi);
          total_cost_before += before_final.finalBill;
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
          const import_energy = import1 + import2 + import3 + import4;
          const imp_tou = mech === "M1_net_value_offsite" ? mapFourBucketToWheelingTOU(import1, import2, import3, import4) : mapFourBucketToStandardTOU(import1, import2, import3, import4);
          const import_cost = priceMonthlyImport(import_energy, imp_tou);
          const export_revenue = mech === "M3_zero_export" || mech === "M5_legacy_net_metering" ? 0 : calcExportRevenueJD(export_energy);
          total_export_revenue += export_revenue;
          const raw_net_bill = import_cost - export_revenue;
          const ledger = applyCreditLedger(raw_net_bill);
          const after_final = finalizeBill(ledger.bill_after_credits, import_energy, mi);
          total_cost_after += after_final.finalBill;
          monthly_data.push({
            month,
            consumption: x1,
            generation: x2,
            generation_day: z1 + z22,
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
            running_credit_balance
          });
        }
      } else {
        for (let mi = 0; mi < months.length; mi++) {
          const month = months[mi];
          const x1 = consumption[month];
          const x2 = pvGenForMonth(mi);
          const y1 = x1 * day_factors[month];
          const y2 = x1 * evening_factors[month];
          const y3 = x1 * night_factors[month];
          const total_cons = y1 + y2 + y3;
          const before_tou = sectorIsTOU ? mapResidentialBucketsToTOU(y1, y2, y3) : void 0;
          const bill_before_raw = priceMonthlyImport(total_cons, before_tou);
          const before_final = finalizeBill(bill_before_raw, total_cons, mi);
          total_cost_before += before_final.finalBill;
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
          const imp1 = Math.max(0, y1 - k1);
          const imp2 = Math.max(0, y2 - k2);
          const imp3 = Math.max(0, y3 - k3);
          const import_energy = imp1 + imp2 + imp3;
          const imp_tou = sectorIsTOU ? mapResidentialBucketsToTOU(imp1, imp2, imp3) : void 0;
          const import_cost = import_energy > 0 ? priceMonthlyImport(import_energy, imp_tou) : 0;
          const export_revenue = mech === "M3_zero_export" || mech === "M5_legacy_net_metering" ? 0 : calcExportRevenueJD(export_energy);
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
            generation_evening: z22,
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
            running_credit_balance
          });
        }
      }
      const reset = applyAnnualReset(running_credit_balance, annual_reset_policy);
      const forfeited_credit_jd = reset.forfeitedJD;
      const cashed_out_credit_jd = reset.cashedOutJD;
      running_credit_balance = reset.balanceAfter;
      total_cost_after += forfeited_credit_jd - cashed_out_credit_jd;
      const grid_service_fee_monthly_jd = gridServiceFeeJD({
        sector,
        mechanism: mech,
        inverterKWac: inverter_kwac,
        postBylawApplication: post_bylaw_application,
        isWelfareBeneficiary: is_welfare_beneficiary
      });
      const grid_service_fee_annual_jd = grid_service_fee_monthly_jd * 12;
      total_cost_after += grid_service_fee_annual_jd;
      const annual_savings = total_cost_before - total_cost_after;
      const results = {
        monthly_data,
        annual_summary: {
          total_consumption: total_annual_consumption,
          pv_size: monthly_pv_generation_override ? annual_pv_generation / 12 : monthly_pv_generation,
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
          dc_ac_ratio: sectorClass === "residential" ? 1.5 : 1.2,
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
