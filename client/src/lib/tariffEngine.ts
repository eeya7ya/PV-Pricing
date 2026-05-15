import { 
  type TariffConfig, 
  type ResidentialTariff, 
  type IndustrialTariffs,
  type TimeFactors,
  type MonthlyConsumption,
  TARIFF_PRESETS
} from '@shared/schema';

/**
 * Core Tariff Calculator Interface
 * All tariff calculators must implement this interface for consistency
 */
export interface TariffCalculator {
  /** Human-readable label for this tariff */
  label: string;
  
  /** Calculate monthly import cost based on consumption and tariff rules */
  calcImportCost(monthlyImportKWh: number, monthlyImportByPeriod?: Record<string, number>): number;
  
  /** Calculate monthly export revenue based on export and tariff rules */
  calcExportRevenue(monthlyExportKWh: number, monthlyExportByPeriod?: Record<string, number>): number;
  
  /** Get tier/period breakdown for detailed reporting */
  getTierBreakdown?(monthlyImportKWh: number): Array<{ tier: string; kWh: number; rate: number; cost: number }>;
  
  /** Get period breakdown for TOU systems */
  getPeriodBreakdown?(monthlyImportByPeriod: Record<string, number>, monthlyExportByPeriod: Record<string, number>): Array<{ period: string; importKWh: number; exportKWh: number; importCost: number; exportRevenue: number; importRate: number; exportRate: number }>;
}

/**
 * Residential Tiered Tariff Calculator (Figure-1)
 * Implements 3-tier system: ≤300kWh @0.05, 300-600kWh @0.1, >600kWh @0.2 JD/kWh
 */
export class ResidentialTieredCalculator implements TariffCalculator {
  public label = 'Residential Tiered (Figure-1)';
  
  constructor(private config: ResidentialTariff) {}
  
  calcImportCost(monthlyImportKWh: number): number {
    if (this.config.mode !== 'tiered') return 0;
    
    let totalCost = 0;
    let remainingKWh = monthlyImportKWh;
    
    for (const tier of this.config.tiers) {
      if (remainingKWh <= 0) break;
      
      const tierKWh = Math.min(remainingKWh, tier.upToKWh === Infinity ? remainingKWh : tier.upToKWh - (monthlyImportKWh - remainingKWh));
      totalCost += tierKWh * tier.rate;
      remainingKWh -= tierKWh;
    }
    
    return totalCost;
  }
  
  calcExportRevenue(monthlyExportKWh: number): number {
    return monthlyExportKWh * this.config.export_rate;
  }
  
  getTierBreakdown(monthlyImportKWh: number) {
    if (this.config.mode !== 'tiered') return [];
    
    const breakdown: Array<{ tier: string; kWh: number; rate: number; cost: number }> = [];
    let remainingKWh = monthlyImportKWh;
    let consumedKWh = 0;
    
    for (let i = 0; i < this.config.tiers.length; i++) {
      const tier = this.config.tiers[i];
      if (remainingKWh <= 0) break;
      
      const tierLimit = tier.upToKWh === Infinity ? remainingKWh : tier.upToKWh - consumedKWh;
      const tierKWh = Math.min(remainingKWh, tierLimit);
      const tierCost = tierKWh * tier.rate;
      
      if (tierKWh > 0) {
        const tierLabel = tier.upToKWh === Infinity 
          ? `>${consumedKWh}kWh @ ${tier.rate} JD/kWh`
          : `${consumedKWh}-${tier.upToKWh}kWh @ ${tier.rate} JD/kWh`;
          
        breakdown.push({
          tier: tierLabel,
          kWh: tierKWh,
          rate: tier.rate,
          cost: tierCost
        });
      }
      
      remainingKWh -= tierKWh;
      consumedKWh += tierKWh;
    }
    
    return breakdown;
  }
}

/**
 * Residential Flat Rate Tariff Calculator (Figure-1)
 * Implements 2-tier system: ≤1000kWh @0.12, >1000kWh @0.15 JD/kWh
 */
export class ResidentialFlatRateCalculator implements TariffCalculator {
  public label = 'Residential Flat Rate (Figure-1)';
  
  constructor(private config: ResidentialTariff) {}
  
  calcImportCost(monthlyImportKWh: number): number {
    if (this.config.mode !== 'flat') return 0;
    
    let totalCost = 0;
    let remainingKWh = monthlyImportKWh;
    
    for (const tier of this.config.tiers) {
      if (remainingKWh <= 0) break;
      
      const tierKWh = Math.min(remainingKWh, tier.upToKWh === Infinity ? remainingKWh : tier.upToKWh - (monthlyImportKWh - remainingKWh));
      totalCost += tierKWh * tier.rate;
      remainingKWh -= tierKWh;
    }
    
    return totalCost;
  }
  
  calcExportRevenue(monthlyExportKWh: number): number {
    return monthlyExportKWh * this.config.export_rate;
  }
  
  getTierBreakdown(monthlyImportKWh: number) {
    if (this.config.mode !== 'flat') return [];
    
    const breakdown: Array<{ tier: string; kWh: number; rate: number; cost: number }> = [];
    let remainingKWh = monthlyImportKWh;
    let consumedKWh = 0;
    
    for (let i = 0; i < this.config.tiers.length; i++) {
      const tier = this.config.tiers[i];
      if (remainingKWh <= 0) break;
      
      const tierLimit = tier.upToKWh === Infinity ? remainingKWh : tier.upToKWh - consumedKWh;
      const tierKWh = Math.min(remainingKWh, tierLimit);
      const tierCost = tierKWh * tier.rate;
      
      if (tierKWh > 0) {
        const tierLabel = tier.upToKWh === Infinity 
          ? `>${consumedKWh}kWh @ ${tier.rate} JD/kWh`
          : `${consumedKWh}-${tier.upToKWh}kWh @ ${tier.rate} JD/kWh`;
          
        breakdown.push({
          tier: tierLabel,
          kWh: tierKWh,
          rate: tier.rate,
          cost: tierCost
        });
      }
      
      remainingKWh -= tierKWh;
      consumedKWh += tierKWh;
    }
    
    return breakdown;
  }
}

/**
 * Industrial 4-Period Time-of-Use Calculator (Figure-2)
 * Implements 4-period TOU: Off Peak (5-14), Half Peak (14-17), Peak (17-23), Half Peak Night (23-5)
 */
export class IndustrialTOUCalculator implements TariffCalculator {
  public label = 'Industrial 4-Period TOU (Figure-2)';
  
  constructor(private config: IndustrialTariffs) {}
  
  calcImportCost(monthlyImportKWh: number, monthlyImportByPeriod?: Record<string, number>): number {
    if (!monthlyImportByPeriod) {
      // If no period breakdown, use average rate
      const avgRate = (this.config.import_period1 + this.config.import_period2 + this.config.import_period3 + this.config.import_period4) / 4;
      return monthlyImportKWh * (avgRate / 100); // Convert from ¢/kWh to JD/kWh
    }
    
    const period1Cost = (monthlyImportByPeriod.period1 || 0) * (this.config.import_period1 / 100);
    const period2Cost = (monthlyImportByPeriod.period2 || 0) * (this.config.import_period2 / 100);
    const period3Cost = (monthlyImportByPeriod.period3 || 0) * (this.config.import_period3 / 100);
    const period4Cost = (monthlyImportByPeriod.period4 || 0) * (this.config.import_period4 / 100);
    
    return period1Cost + period2Cost + period3Cost + period4Cost;
  }
  
  calcExportRevenue(monthlyExportKWh: number, monthlyExportByPeriod?: Record<string, number>): number {
    if (!monthlyExportByPeriod) {
      // All periods have same export rate in Figure-2
      return monthlyExportKWh * (this.config.export_period1 / 100);
    }
    
    const period1Revenue = (monthlyExportByPeriod.period1 || 0) * (this.config.export_period1 / 100);
    const period2Revenue = (monthlyExportByPeriod.period2 || 0) * (this.config.export_period2 / 100);
    const period3Revenue = (monthlyExportByPeriod.period3 || 0) * (this.config.export_period3 / 100);
    const period4Revenue = (monthlyExportByPeriod.period4 || 0) * (this.config.export_period4 / 100);
    
    return period1Revenue + period2Revenue + period3Revenue + period4Revenue;
  }
  
  getPeriodBreakdown(
    monthlyImportByPeriod: Record<string, number>, 
    monthlyExportByPeriod: Record<string, number>
  ) {
    const periods = [
      { key: 'period1', name: 'Off Peak (5-14)', importRate: this.config.import_period1, exportRate: this.config.export_period1 },
      { key: 'period2', name: 'Half Peak (14-17)', importRate: this.config.import_period2, exportRate: this.config.export_period2 },
      { key: 'period3', name: 'Peak (17-23)', importRate: this.config.import_period3, exportRate: this.config.export_period3 },
      { key: 'period4', name: 'Half Peak Night (23-5)', importRate: this.config.import_period4, exportRate: this.config.export_period4 }
    ];
    
    return periods.map(period => {
      const importKWh = monthlyImportByPeriod[period.key] || 0;
      const exportKWh = monthlyExportByPeriod[period.key] || 0;
      const importCost = importKWh * (period.importRate / 100);
      const exportRevenue = exportKWh * (period.exportRate / 100);
      
      return {
        period: period.name,
        importKWh,
        exportKWh,
        importCost,
        exportRevenue,
        importRate: period.importRate,
        exportRate: period.exportRate
      };
    });
  }
}

/**
 * Energy Allocation Helper
 * Allocates monthly energy consumption/generation to time periods based on factors
 */
export class EnergyAllocator {
  /**
   * Allocate residential monthly energy to day/evening/night periods
   */
  static allocateResidentialEnergy(
    monthlyEnergy: MonthlyConsumption,
    dayFactors: TimeFactors,
    eveningFactors: TimeFactors,
    nightFactors: TimeFactors
  ) {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const;
    
    return months.reduce((allocation, month) => {
      const monthlyTotal = monthlyEnergy[month];
      allocation[month] = {
        day: monthlyTotal * dayFactors[month],
        evening: monthlyTotal * eveningFactors[month],
        night: monthlyTotal * nightFactors[month]
      };
      return allocation;
    }, {} as Record<string, { day: number; evening: number; night: number }>);
  }
  
  /**
   * Allocate industrial monthly energy to 4-period system
   */
  static allocateIndustrialEnergy(
    monthlyEnergy: MonthlyConsumption,
    period1Factors: TimeFactors,
    period2Factors: TimeFactors,
    period3Factors: TimeFactors,
    period4Factors: TimeFactors
  ) {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const;
    
    return months.reduce((allocation, month) => {
      const monthlyTotal = monthlyEnergy[month];
      allocation[month] = {
        period1: monthlyTotal * period1Factors[month],
        period2: monthlyTotal * period2Factors[month],
        period3: monthlyTotal * period3Factors[month],
        period4: monthlyTotal * period4Factors[month]
      };
      return allocation;
    }, {} as Record<string, { period1: number; period2: number; period3: number; period4: number }>);
  }
}

/**
 * Tariff Registry - Factory System for Easy Extensibility
 * Add new tariff types here for future expansion
 */
export const TariffRegistry: Record<string, (config: any) => TariffCalculator> = {
  'residential:tiered': (config: ResidentialTariff) => new ResidentialTieredCalculator(config),
  'residential:flat': (config: ResidentialTariff) => new ResidentialFlatRateCalculator(config),
  'industrial:tou': (config: IndustrialTariffs) => new IndustrialTOUCalculator(config),
};

/**
 * Tariff Engine - Main Interface
 * Creates and manages tariff calculators
 */
export class TariffEngine {
  /**
   * Create tariff calculator from configuration
   */
  static createCalculator(tariffType: string, tariffConfig: TariffConfig): TariffCalculator {
    const factory = TariffRegistry[tariffType];
    if (!factory) {
      throw new Error(`Unknown tariff type: ${tariffType}`);
    }
    
    return factory(tariffConfig.config);
  }
  
  /**
   * Get available tariff presets for easy UI integration
   */
  static getPresets() {
    return TARIFF_PRESETS;
  }
  
  /**
   * Get preset by key for programmatic access
   */
  static getPreset(key: keyof typeof TARIFF_PRESETS): TariffConfig {
    return JSON.parse(JSON.stringify(TARIFF_PRESETS[key]));
  }
}

/**
 * Helper function to apply tariff preset to project configuration
 * This is what the user calls when they say "apply residential tiered to this project"
 */
export function applyTariffPreset(presetKey: keyof typeof TARIFF_PRESETS): { 
  tariff_type: string; 
  tariff_config: TariffConfig 
} {
  const preset = JSON.parse(JSON.stringify(TARIFF_PRESETS[presetKey]));
  return {
    tariff_type: presetKey,
    tariff_config: preset as TariffConfig
  };
}