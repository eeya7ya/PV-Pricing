// In-memory storage for the Solar PV Calculator.
//
// Originally backed by Drizzle/Neon Postgres. For the Vercel demo deployment
// we use a purely in-memory store so the app works without any database
// provisioning. Solar projects do not persist across serverless function
// invocations — that's intentional for a demo. Users are managed by
// `fakeAuth.ts`.

import {
  type SolarProject,
  type InsertSolarProject,
  type CalculationResults,
  TARIFF_PRESETS,
} from "../shared/schema";
import { randomUUID } from "crypto";

export interface IStorage {
  getSolarProject(id: string): Promise<SolarProject | undefined>;
  getSolarProjectByName(name: string): Promise<SolarProject | undefined>;
  createSolarProject(project: InsertSolarProject): Promise<SolarProject>;
  updateSolarProject(
    id: string,
    project: Partial<InsertSolarProject>,
  ): Promise<SolarProject | undefined>;
  deleteSolarProject(id: string): Promise<boolean>;
  getAllSolarProjects(): Promise<SolarProject[]>;
  saveCalculationResults(projectId: string, results: CalculationResults): Promise<void>;
  getCalculationResults(projectId: string): Promise<CalculationResults | undefined>;
}

export class MemStorage implements IStorage {
  private solarProjects = new Map<string, SolarProject>();
  private calculationResults = new Map<string, CalculationResults>();

  async getSolarProject(id: string) {
    return this.solarProjects.get(id);
  }

  async getSolarProjectByName(name: string) {
    return Array.from(this.solarProjects.values()).find((p) => p.name === name);
  }

  async createSolarProject(insertProject: InsertSolarProject): Promise<SolarProject> {
    const id = randomUUID();
    const now = new Date().toISOString();

    const customerType = insertProject.customer_type ?? "Residential";
    const defaultTariffType =
      customerType === "Industrial" ? "industrial:tou" : "residential:tiered";
    const defaultTariffConfig = TARIFF_PRESETS[defaultTariffType];

    const project: SolarProject = {
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
      tariff_config: insertProject.tariff_config ?? defaultTariffConfig,
    };
    this.solarProjects.set(id, project);
    return project;
  }

  async updateSolarProject(
    id: string,
    updateData: Partial<InsertSolarProject>,
  ): Promise<SolarProject | undefined> {
    const existing = this.solarProjects.get(id);
    if (!existing) return undefined;
    const updated: SolarProject = {
      ...existing,
      ...updateData,
      updated_at: new Date().toISOString(),
    };
    this.solarProjects.set(id, updated);
    return updated;
  }

  async deleteSolarProject(id: string): Promise<boolean> {
    const deleted = this.solarProjects.delete(id);
    if (deleted) this.calculationResults.delete(id);
    return deleted;
  }

  async getAllSolarProjects(): Promise<SolarProject[]> {
    return Array.from(this.solarProjects.values());
  }

  async saveCalculationResults(projectId: string, results: CalculationResults) {
    this.calculationResults.set(projectId, results);
    const project = this.solarProjects.get(projectId);
    if (project) {
      project.calculation_results = results as any;
      project.updated_at = new Date().toISOString();
    }
  }

  async getCalculationResults(projectId: string) {
    return this.calculationResults.get(projectId);
  }
}

export const storage = new MemStorage();
