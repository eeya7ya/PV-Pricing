import { useState, useCallback } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import type { 
  MonthlyConsumption, 
  TimeFactors, 
  CalculationResults,
  CustomerType,
  GridConnection,
  IndustrialTariffs,
  TariffConfig,
  IndustrialBassConfig,
  TARIFF_PRESETS
} from '@shared/schema';
import { applyTariffPreset, TariffEngine } from '@/lib/tariffEngine';
import {
  calcUniversalAddOns,
  applyMinimumBillJD,
  defaultSectorFor,
  SPECIFIC_YIELD_KWH_PER_KWP_MONTH,
  inverterKWacFromMonthlyKWh,
  type SectorCode,
  type NetBillingMechanism,
} from '@shared/jordanTariffs';
import {
  quickQuoteYield,
  calculatePVYield,
  JORDAN_REGIONS,
  ZONE_MONTHLY_SHARES,
  type YieldResult,
} from '@shared/jordanPVDesign';
import { type PVDesignState, defaultPVDesignState } from '@/components/PVDesignPanel';
import { type ElectricalState, defaultElectricalState } from '@/components/ElectricalDesign';

/**
 * Map the project's grid-connection labels onto the Bylaw 58/2024 + legacy
 * enumeration of five operative PV grid-connection mechanisms.
 *   Net billing         → Mechanism 2 (Net Value On-site)
 *   wheeling            → Mechanism 1 (Net Value Off-site)
 *   Zero export         → Mechanism 3 (Zero Export, battery allowed)
 *   Buy all sell all    → Mechanism 4 (separate meter; zero grid fee)
 *   Legacy net metering → Mechanism 5 (pre-1/6/2024 grandfathered, 1:1 kWh)
 */
function mechanismFor(gridConnection: GridConnection): NetBillingMechanism {
  switch (gridConnection) {
    case 'wheeling':
      return 'M1_net_value_offsite';
    case 'Zero export':
      return 'M3_zero_export';
    case 'Buy all sell all':
      return 'M4_buy_all_sell_all';
    case 'Legacy net metering':
      return 'M5_legacy_net_metering';
    case 'Net billing':
    default:
      return 'M2_net_value_onsite';
  }
}

interface CalculatorState {
  customerType: CustomerType;
  gridConnection: GridConnection;
  consumption: MonthlyConsumption;
  efficiency: number;
  degradation: number;
  tariffSupported: boolean;
  exportTariff: number;

  // EMRC sub-sector override. 'auto' derives from customerType + tariffSupported;
  // an explicit SectorCode lets the user pick e.g. C3 large industrial, B3 banks,
  // D2 pre-2008 hotel, etc.
  sector: SectorCode | 'auto';
  // Detailed monthly mode: distribute PV generation across months by the
  // region's seasonal solar curve (instead of a flat annual/12 every month)
  // and expose the full per-month factor grids. Optional — off by default.
  detailedMonthly: boolean;
  
  // Residential parameters
  dayFactors: TimeFactors;
  eveningFactors: TimeFactors;
  nightFactors: TimeFactors;
  sunPeakFactors: TimeFactors;
  sunMediumFactors: TimeFactors;
  sunLowFactors: TimeFactors;
  pvConsumeDay: TimeFactors;
  pvConsumeEvening: TimeFactors;
  pvConsumeNight: TimeFactors;
  
  // Industrial parameters - NEW: 4-period system (5-14, 14-17, 17-23, 23-5)
  period1Factors: TimeFactors;
  period2Factors: TimeFactors;
  period3Factors: TimeFactors;
  period4Factors: TimeFactors;
  sunPeriod1Factors: TimeFactors;
  sunPeriod2Factors: TimeFactors;
  sunPeriod3Factors: TimeFactors;
  sunPeriod4Factors: TimeFactors;
  pvConsumePeriod1: TimeFactors;
  pvConsumePeriod2: TimeFactors;
  pvConsumePeriod3: TimeFactors;
  pvConsumePeriod4: TimeFactors;
  
  // Industrial tariff configuration
  industrialTariffs: IndustrialTariffs;
  
  // Industrial Buy-All Sell-All configuration
  industrialBassConfig?: IndustrialBassConfig;
  
  // Dynamic Tariff Configuration
  tariffType: string;
  tariffConfig: TariffConfig;

  // PV design module (Tier 1 Quick Quote / Tier 2 Detailed Engineering).
  // When `pvDesign.enabled` is true, the physics engine's monthly kWh vector
  // overrides the consumption-based PV generation in the billing pipeline.
  pvDesign: PVDesignState;

  // Electrical Balance-of-System self-design (module + inverter selection).
  // Drives the string/cable/protection sizing and single-line diagram shown
  // under the Results tab. Target array size is taken from `pvDesign`.
  electrical: ElectricalState;
}

interface CalculatorLogicProps {
  children: (props: {
    state: CalculatorState;
    setState: React.Dispatch<React.SetStateAction<CalculatorState>>;
    calculate: (opts?: { onSuccess?: () => void }) => void;
    results?: CalculationResults;
    isCalculating: boolean;
    updateField: <K extends keyof CalculatorState>(field: K, value: CalculatorState[K]) => void;
  }) => React.ReactNode;
}

const initialState: CalculatorState = {
  customerType: 'Residential',
  gridConnection: 'Net billing',
  consumption: {
    Jan: 500, Feb: 500, Mar: 500, Apr: 500, May: 500, Jun: 500,
    Jul: 500, Aug: 500, Sep: 500, Oct: 500, Nov: 500, Dec: 500
  },
  efficiency: 95,
  degradation: 0.05,
  tariffSupported: true,
  exportTariff: 0.05, // Default for Residential
  sector: 'auto',
  detailedMonthly: false,
  // Import default factors exactly as PyQt6 original
  dayFactors: { 
    Jan: 0.30, Feb: 0.30, Mar: 0.30, Apr: 0.30, May: 0.30, Jun: 0.30,
    Jul: 0.30, Aug: 0.30, Sep: 0.30, Oct: 0.30, Nov: 0.30, Dec: 0.30 
  },
  eveningFactors: { 
    Jan: 0.30, Feb: 0.30, Mar: 0.30, Apr: 0.30, May: 0.30, Jun: 0.30,
    Jul: 0.30, Aug: 0.30, Sep: 0.30, Oct: 0.30, Nov: 0.30, Dec: 0.30 
  },
  nightFactors: { 
    Jan: 0.40, Feb: 0.40, Mar: 0.40, Apr: 0.40, May: 0.40, Jun: 0.40,
    Jul: 0.40, Aug: 0.40, Sep: 0.40, Oct: 0.40, Nov: 0.40, Dec: 0.40 
  },
  sunPeakFactors: { 
    Jan: 1.00, Feb: 1.00, Mar: 1.00, Apr: 1.00, May: 1.00, Jun: 1.00,
    Jul: 1.00, Aug: 1.00, Sep: 1.00, Oct: 1.00, Nov: 1.00, Dec: 1.00 
  },
  sunMediumFactors: { 
    Jan: 0.20, Feb: 0.20, Mar: 0.20, Apr: 0.20, May: 0.20, Jun: 0.20,
    Jul: 0.20, Aug: 0.20, Sep: 0.20, Oct: 0.20, Nov: 0.20, Dec: 0.20 
  },
  sunLowFactors: { 
    Jan: 0.00, Feb: 0.00, Mar: 0.00, Apr: 0.00, May: 0.00, Jun: 0.00,
    Jul: 0.00, Aug: 0.00, Sep: 0.00, Oct: 0.00, Nov: 0.00, Dec: 0.00 
  },
  pvConsumeDay: { 
    Jan: 0.70, Feb: 0.70, Mar: 0.70, Apr: 0.70, May: 0.70, Jun: 0.70,
    Jul: 0.70, Aug: 0.70, Sep: 0.70, Oct: 0.70, Nov: 0.70, Dec: 0.70 
  },
  pvConsumeEvening: { 
    Jan: 0.90, Feb: 0.90, Mar: 0.90, Apr: 0.90, May: 0.90, Jun: 0.90,
    Jul: 0.90, Aug: 0.90, Sep: 0.90, Oct: 0.90, Nov: 0.90, Dec: 0.90 
  },
  pvConsumeNight: { 
    Jan: 1.00, Feb: 1.00, Mar: 1.00, Apr: 1.00, May: 1.00, Jun: 1.00,
    Jul: 1.00, Aug: 1.00, Sep: 1.00, Oct: 1.00, Nov: 1.00, Dec: 1.00 
  },
  
  // Industrial parameters - NEW: 4-period system (5-14, 14-17, 17-23, 23-5)
  period1Factors: { // Off Peak (5-14) - y1 factor
    Jan: 0.40, Feb: 0.40, Mar: 0.40, Apr: 0.40, May: 0.40, Jun: 0.40,
    Jul: 0.40, Aug: 0.40, Sep: 0.40, Oct: 0.40, Nov: 0.40, Dec: 0.40 
  },
  period2Factors: { // Half Peak (14-17) - y2 factor
    Jan: 0.20, Feb: 0.20, Mar: 0.20, Apr: 0.20, May: 0.20, Jun: 0.20,
    Jul: 0.20, Aug: 0.20, Sep: 0.20, Oct: 0.20, Nov: 0.20, Dec: 0.20 
  },
  period3Factors: { // Peak (17-23) - y3 factor
    Jan: 0.30, Feb: 0.30, Mar: 0.30, Apr: 0.30, May: 0.30, Jun: 0.30,
    Jul: 0.30, Aug: 0.30, Sep: 0.30, Oct: 0.30, Nov: 0.30, Dec: 0.30 
  },
  period4Factors: { // Half Peak (23-5) - y4 factor
    Jan: 0.10, Feb: 0.10, Mar: 0.10, Apr: 0.10, May: 0.10, Jun: 0.10,
    Jul: 0.10, Aug: 0.10, Sep: 0.10, Oct: 0.10, Nov: 0.10, Dec: 0.10 
  },
  // Solar Generation Factors - Industrial (4-period system)
  sunPeriod1Factors: { // Off Peak (5-14) solar generation factors
    Jan: 0.70, Feb: 0.70, Mar: 0.70, Apr: 0.70, May: 0.70, Jun: 0.70,
    Jul: 0.70, Aug: 0.70, Sep: 0.70, Oct: 0.70, Nov: 0.70, Dec: 0.70 
  },
  sunPeriod2Factors: { // Half Peak (14-17) solar generation factors
    Jan: 0.25, Feb: 0.25, Mar: 0.25, Apr: 0.25, May: 0.25, Jun: 0.25,
    Jul: 0.25, Aug: 0.25, Sep: 0.25, Oct: 0.25, Nov: 0.25, Dec: 0.25 
  },
  sunPeriod3Factors: { // Peak (17-23) solar generation factors
    Jan: 0.05, Feb: 0.05, Mar: 0.05, Apr: 0.05, May: 0.05, Jun: 0.05,
    Jul: 0.05, Aug: 0.05, Sep: 0.05, Oct: 0.05, Nov: 0.05, Dec: 0.05 
  },
  sunPeriod4Factors: { // Half Peak (23-5) solar generation factors
    Jan: 0.00, Feb: 0.00, Mar: 0.00, Apr: 0.00, May: 0.00, Jun: 0.00,
    Jul: 0.00, Aug: 0.00, Sep: 0.00, Oct: 0.00, Nov: 0.00, Dec: 0.00 
  },
  // PV Self-Consumption Factors - Industrial (NEW: k1, k2, k3, k4)
  pvConsumePeriod1: { // Off Peak (5-14) - k1 consumption factor
    Jan: 0.80, Feb: 0.80, Mar: 0.80, Apr: 0.80, May: 0.80, Jun: 0.80,
    Jul: 0.80, Aug: 0.80, Sep: 0.80, Oct: 0.80, Nov: 0.80, Dec: 0.80 
  },
  pvConsumePeriod2: { // Half Peak (14-17) - k2 consumption factor
    Jan: 0.85, Feb: 0.85, Mar: 0.85, Apr: 0.85, May: 0.85, Jun: 0.85,
    Jul: 0.85, Aug: 0.85, Sep: 0.85, Oct: 0.85, Nov: 0.85, Dec: 0.85 
  },
  pvConsumePeriod3: { // Peak (17-23) - k3 consumption factor
    Jan: 0.90, Feb: 0.90, Mar: 0.90, Apr: 0.90, May: 0.90, Jun: 0.90,
    Jul: 0.90, Aug: 0.90, Sep: 0.90, Oct: 0.90, Nov: 0.90, Dec: 0.90 
  },
  pvConsumePeriod4: { // Half Peak (23-5) - k4 consumption factor
    Jan: 0.70, Feb: 0.70, Mar: 0.70, Apr: 0.70, May: 0.70, Jun: 0.70,
    Jul: 0.70, Aug: 0.70, Sep: 0.70, Oct: 0.70, Nov: 0.70, Dec: 0.70 
  },
  
  // Industrial tariff defaults (specific rates provided by user)
  industrialTariffs: {
    import_period1: 5.9,    // Off Peak (5-14) import: 0.059 JD/kWh = 5.9 ¢/kWh
    import_period2: 6.9,    // Half Peak (14-17) import: 0.069 JD/kWh = 6.9 ¢/kWh
    import_period3: 7.9,    // Peak (17-23) import: 0.079 JD/kWh = 7.9 ¢/kWh
    import_period4: 6.9,    // Half Peak (23-5) import: 0.069 JD/kWh = 6.9 ¢/kWh
    export_period1: 4.0,    // Off Peak (5-14) export: 0.04 JD/kWh = 4.0 ¢/kWh
    export_period2: 4.0,    // Half Peak (14-17) export: 0.04 JD/kWh = 4.0 ¢/kWh
    export_period3: 4.0,    // Peak (17-23) export: 0.04 JD/kWh = 4.0 ¢/kWh
    export_period4: 4.0     // Half Peak (23-5) export: 0.04 JD/kWh = 4.0 ¢/kWh
  },
  
  // Industrial Buy-All Sell-All configuration (default values)
  industrialBassConfig: {
    type: 'Small Industrial',
    off_peak_factor: 0.250,      // 5:00-14:00 (9h) - 25%
    half_peak_day_factor: 0.125, // 14:00-17:00 (3h) - 12.5%
    peak_factor: 0.250,          // 17:00-23:00 (6h) - 25%
    half_peak_night_factor: 0.375, // 23:00-5:00 (6h) - 37.5%
    export_rate: 0.05            // 0.05 JD/kWh export rate
  },
  
  // Dynamic Tariff Configuration - Default to residential tiered
  tariffType: 'residential:tiered',
  tariffConfig: (() => {
    const { tariff_config } = applyTariffPreset('residential:tiered');
    return tariff_config;
  })(),

  pvDesign: defaultPVDesignState(),

  electrical: defaultElectricalState(),
};

export default function CalculatorLogic({ children }: CalculatorLogicProps) {
  const [state, setState] = useState<CalculatorState>(initialState);
  const [results, setResults] = useState<CalculationResults | undefined>();
  const { toast } = useToast();

  // Create tariff calculator based on user configuration
  const createTariffCalculator = useCallback((calculationData: CalculatorState) => {
    // Use configured tariff type and config instead of hardcoded values
    return TariffEngine.createCalculator(calculationData.tariffType, calculationData.tariffConfig);
  }, []);

  const calculateTaxes = useCallback((generation: number, efficiency: number): number => {
    // Legacy "TX" formula was (X2 / (130 * efficiency)) * 1. EMRC abolished
    // demand charges in 2024 and the PV round adopted the standard yield of
    // 150 kWh/kWp/month (1,800 kWh/kWp/yr). No tax/demand layer applies to
    // PV generation under any Bylaw 58/2024 mechanism — return 0.
    void generation; void efficiency;
    return 0;
  }, []);

  const calculateExportTariff = useCallback((generation: number, exportRate: number): number => {
    // Formula: Export Tariff = X2 * exportRate JD
    return generation * exportRate;
  }, []);

  // Industrial Buy-All Sell-All calculation function (based on PyQt6 implementation)
  const calculateIndustrialBuyAllSellAll = useCallback(async (calculationData: CalculatorState): Promise<CalculationResults> => {
    console.log('🏭 INDUSTRIAL BUY-ALL SELL-ALL CALCULATION: Starting industrial buy-all sell-all calculation...');
    
    // Define months array first
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    
    // Calculate total annual consumption - use proper month-key alignment
    const monthlyConsumption = months.map(month => calculationData.consumption[month as keyof MonthlyConsumption] || 0);
    const totalAnnualConsumption = monthlyConsumption.reduce((sum, consumption) => sum + consumption, 0);
    
    if (totalAnnualConsumption <= 0) {
      throw new Error('Please enter valid monthly consumption values.');
    }
    
    // X2 approximation: Total annual consumption / 12
    const x2Approximate = totalAnnualConsumption / 12;
    
    console.log(`📊 X2 Approximation: ${x2Approximate.toFixed(2)} kWh/month (${totalAnnualConsumption.toFixed(2)} kWh ÷ 12)`);
    
    // Get Industrial configuration from state
    const industrialConfig = calculationData.industrialBassConfig;
    if (!industrialConfig) {
      throw new Error('Industrial Buy-All Sell-All configuration is missing.');
    }

    // Validate time period factors sum to 1.0
    const factorSum = industrialConfig.off_peak_factor + industrialConfig.half_peak_day_factor + 
                     industrialConfig.peak_factor + industrialConfig.half_peak_night_factor;
    if (Math.abs(factorSum - 1.0) > 0.001) {
      throw new Error(`Time period factors must sum to 1.000. Current sum: ${factorSum.toFixed(3)}`);
    }

    const exportRate = industrialConfig.export_rate;
    const systemEfficiency = calculationData.efficiency / 100; // Convert percentage to decimal
    
    // Industrial tariff calculation function based on PyQt6
    const calculateIndustrialImportTariff = (consumption: number, isSmallIndustrial: boolean) => {
      // Calculate period consumptions using time distribution factors
      const y1 = consumption * industrialConfig.off_peak_factor;      // Off Peak (5-14)
      const y2 = consumption * industrialConfig.half_peak_day_factor; // Half Peak Day (14-17)
      const y3 = consumption * industrialConfig.peak_factor;          // Peak (17-23) 
      const y4 = consumption * industrialConfig.half_peak_night_factor; // Half Peak Night (23-5)
      
      let totalImportTariff = 0;
      let periodDetails = '';
      
      if (isSmallIndustrial) {
        // Small Industrial tariff calculation
        if (consumption <= 10000) {
          const rate = 0.06; // JD/kWh for ≤10000 kWh
          totalImportTariff = consumption * rate;
          periodDetails = `All periods: ${rate.toFixed(3)} JD/kWh`;
        } else {
          // First 10000 kWh at 0.06, remainder at 0.068
          totalImportTariff = (10000 * 0.06) + ((consumption - 10000) * 0.068);
          periodDetails = `≤10000@0.06, >${(consumption - 10000).toFixed(0)}@0.068`;
        }
      } else {
        // Medium Industrial - different rates per period
        const import_y1 = y1 * 0.059; // Off Peak
        const import_y2 = y2 * 0.069; // Half Peak Day
        const import_y3 = y3 * 0.079; // Peak
        const import_y4 = y4 * 0.069; // Half Peak Night
        totalImportTariff = import_y1 + import_y2 + import_y3 + import_y4;
        periodDetails = `OffP:${y1.toFixed(1)}@0.059, HalfP:${y2.toFixed(1)}+${y4.toFixed(1)}@0.069, Peak:${y3.toFixed(1)}@0.079`;
      }
      
      return { totalImportTariff, periodDetails, periods: { y1, y2, y3, y4 } };
    };

    // Calculate monthly data
    const monthlyData = [];
    const isSmallIndustrial = industrialConfig.type === 'Small Industrial';
    // Resolve sector for add-ons / min-bill (Industrial → C1 small or C2 medium).
    const industrialSector: SectorCode = isSmallIndustrial
      ? 'C1_small_industrial'
      : 'C2_medium_industrial';

    let totalImportCost = 0;
    let totalExportRevenue = 0;
    let totalTaxes = 0;
    let totalNetCost = 0;
    let totalCostWithoutPV = 0;

    for (let i = 0; i < 12; i++) {
      const month = months[i];
      const consumption = monthlyConsumption[i];

      // Use X2 approximation for generation
      const generation = x2Approximate;

      // Calculate import tariff using Industrial period-based calculation
      const { totalImportTariff: importTariff, periodDetails } = calculateIndustrialImportTariff(
        consumption,
        isSmallIndustrial,
      );

      // No demand charge / taxes layer in EMRC 2025 (demand charges abolished).
      const taxes = 0;

      // Calculate export tariff (Buy-All-Sell-All flat export rate).
      const exportTariff = generation * exportRate;

      // Universal add-ons applied to imported energy (Buy-All imports all kWh).
      const monthKey = `2026-${String(i + 1).padStart(2, '0')}`;
      const addOnsBefore = calcUniversalAddOns({
        sector: industrialSector,
        monthlyImportKWh: consumption,
        monthKey,
        meterPhase: 3,
        applyTvFee: false,
        applyGAM: false,
        wasteClass: null,
        applyRuralFils: true,
        applyMeterRent: true,
      });
      const billBefore = applyMinimumBillJD(importTariff + addOnsBefore.totalJD, industrialSector);

      // Buy-All-Sell-All: import side still consumes the full retail, then
      // export revenue is paid separately; min-bill applies to the energy
      // portion before export offset (export is revenue, not a discount).
      const netCost = applyMinimumBillJD(importTariff + addOnsBefore.totalJD, industrialSector) - exportTariff;

      monthlyData.push({
        month,
        consumption,
        generation,
        generation_day: 0,
        generation_evening: 0,
        generation_night: 0,
        self_consumption: 0,
        export: generation,
        import: consumption,
        bill_before: billBefore,
        bill_after: netCost,
        import_cost: importTariff + addOnsBefore.totalJD,
        export_revenue: exportTariff,
        savings: billBefore - netCost,
        period_details: periodDetails,
      });

      totalImportCost += importTariff + addOnsBefore.totalJD;
      totalExportRevenue += exportTariff;
      totalTaxes += taxes;
      totalNetCost += netCost;
      totalCostWithoutPV += billBefore;
    }

    // Annual savings = without-PV bill total minus with-PV net cost
    const annualSavings = totalCostWithoutPV - totalNetCost;
    
    const results: CalculationResults = {
      monthly_data: monthlyData,
      annual_summary: {
        total_consumption: totalAnnualConsumption,
        pv_size: x2Approximate, // Monthly generation approximation (kWh/month)
        inverter_size: inverterKWacFromMonthlyKWh(x2Approximate, 'industrial'), // EMRC 150 kWh/kWp/mo × DC:AC 1.2
        annual_generation: x2Approximate * 12,
        total_self_consumption: 0, // No self-consumption in Buy-All Sell-All
        total_export: x2Approximate * 12, // All generation is exported
        cost_before: totalCostWithoutPV,
        cost_after: totalNetCost,
        annual_savings: annualSavings,
        export_revenue: totalExportRevenue,
        efficiency: calculationData.efficiency / 100,
        export_tariff: exportRate,
        net_billing_savings: 0, // Not applicable for Buy-All Sell-All
        final_credit_balance: 0, // Not applicable for Buy-All Sell-All
        total_savings_with_net_billing: annualSavings
      }
    };
    
    console.log(`🏭 INDUSTRIAL BUY-ALL SELL-ALL RESULTS:
    • Industrial Type: ${industrialConfig.type}
    • X2 Approximation: ${x2Approximate.toFixed(2)} kWh/month
    • Total Import Cost: ${totalImportCost.toFixed(2)} JD
    • Total Export Revenue: ${totalExportRevenue.toFixed(2)} JD
    • Total Taxes: ${totalTaxes.toFixed(2)} JD
    • Annual NET Cost: ${totalNetCost.toFixed(2)} JD
    • Annual Savings: ${annualSavings.toFixed(2)} JD
    • Period Factors: OffPeak=${industrialConfig.off_peak_factor}, HalfPeakDay=${industrialConfig.half_peak_day_factor}, Peak=${industrialConfig.peak_factor}, HalfPeakNight=${industrialConfig.half_peak_night_factor}`);
    
    return results;
  }, []);

  // Buy-All Sell-All calculation function
  const calculateBuyAllSellAll = useCallback(async (calculationData: CalculatorState): Promise<CalculationResults> => {
    // Check if this is Industrial Buy-All Sell-All
    if (calculationData.customerType === 'Industrial') {
      return calculateIndustrialBuyAllSellAll(calculationData);
    }
    
    console.log('💰 BUY-ALL SELL-ALL CALCULATION: Starting residential buy-all sell-all calculation...');
    
    // Define months array first
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    
    // Calculate total annual consumption - use proper month-key alignment
    const monthlyConsumption = months.map(month => calculationData.consumption[month as keyof MonthlyConsumption] || 0);
    const totalAnnualConsumption = monthlyConsumption.reduce((sum, consumption) => sum + consumption, 0);
    
    if (totalAnnualConsumption <= 0) {
      throw new Error('Please enter valid monthly consumption values.');
    }
    
    // X2 approximation: Total annual consumption / 12
    const x2Approximate = totalAnnualConsumption / 12;
    
    console.log(`📊 X2 Approximation: ${x2Approximate.toFixed(2)} kWh/month (${totalAnnualConsumption.toFixed(2)} kWh ÷ 12)`);
    
    // Create tariff calculator based on user configuration
    const tariffCalculator = createTariffCalculator(calculationData);
    const exportRate = calculationData.exportTariff;
    const systemEfficiency = calculationData.efficiency / 100;

    // Residential sector for add-ons / min-bill dispatch.
    const residentialSector: SectorCode = calculationData.tariffSupported
      ? 'A1_subsidized'
      : 'A2_unsubsidized';

    // Calculate monthly data
    const monthlyData = [];

    let totalImportCost = 0;
    let totalExportRevenue = 0;
    let totalTaxes = 0;
    let totalNetCost = 0;
    let totalCostWithoutPV = 0;

    for (let i = 0; i < 12; i++) {
      const month = months[i];
      const consumption = monthlyConsumption[i];

      const generation = x2Approximate;

      const importTariff = tariffCalculator.calcImportCost(consumption);
      // No taxes/demand charge layer for residential.
      const taxes = 0;
      const exportTariff = calculateExportTariff(generation, exportRate);

      // EMRC universal add-ons on imported energy.
      const monthKey = `2026-${String(i + 1).padStart(2, '0')}`;
      const addOnsBefore = calcUniversalAddOns({
        sector: residentialSector,
        monthlyImportKWh: consumption,
        monthKey,
        meterPhase: 1,
        applyTvFee: true,
        applyGAM: false,
        wasteClass: null,
        applyRuralFils: true,
        applyMeterRent: true,
      });
      const billBefore = applyMinimumBillJD(importTariff + addOnsBefore.totalJD, residentialSector);
      const netCost = billBefore - exportTariff;

      monthlyData.push({
        month,
        consumption,
        generation,
        generation_day: 0,
        generation_evening: 0,
        generation_night: 0,
        self_consumption: 0,
        export: generation,
        import: consumption,
        bill_before: billBefore,
        bill_after: netCost,
        import_cost: importTariff + addOnsBefore.totalJD,
        export_revenue: exportTariff,
        savings: billBefore - netCost,
      });

      totalImportCost += importTariff + addOnsBefore.totalJD;
      totalExportRevenue += exportTariff;
      totalTaxes += taxes;
      totalNetCost += netCost;
      totalCostWithoutPV += billBefore;
    }

    const annualSavings = totalCostWithoutPV - totalNetCost;
    
    const results: CalculationResults = {
      monthly_data: monthlyData,
      annual_summary: {
        total_consumption: totalAnnualConsumption,
        pv_size: x2Approximate, // Monthly generation approximation (kWh/month)
        inverter_size: inverterKWacFromMonthlyKWh(x2Approximate, 'residential'), // EMRC 150 kWh/kWp/mo × DC:AC 1.5
        annual_generation: x2Approximate * 12,
        total_self_consumption: 0, // No self-consumption in Buy-All Sell-All
        total_export: x2Approximate * 12, // All generation is exported
        cost_before: totalCostWithoutPV,
        cost_after: totalNetCost,
        annual_savings: annualSavings,
        export_revenue: totalExportRevenue,
        efficiency: calculationData.efficiency / 100,
        export_tariff: exportRate, // User-configured export rate
        net_billing_savings: 0, // Not applicable for Buy-All Sell-All
        final_credit_balance: 0, // Not applicable for Buy-All Sell-All
        total_savings_with_net_billing: annualSavings
      }
    };
    
    console.log(`💰 BUY-ALL SELL-ALL RESULTS:
    • X2 Approximation: ${x2Approximate.toFixed(2)} kWh/month
    • Total Import Cost: ${totalImportCost.toFixed(2)} JD
    • Total Export Revenue: ${totalExportRevenue.toFixed(2)} JD
    • Total Taxes: ${totalTaxes.toFixed(2)} JD
    • Annual NET Cost: ${totalNetCost.toFixed(2)} JD
    • Annual Savings: ${annualSavings.toFixed(2)} JD`);
    
    return results;
  }, [createTariffCalculator, calculateTaxes, calculateExportTariff]);

  // Calculation mutation using EXACT PyQt6 formulas preserved in backend
  const calculateMutation = useMutation({
    mutationFn: async (calculationData: CalculatorState): Promise<CalculationResults> => {
      // Handle Buy-All Sell-All calculations locally (frontend-only)
      if (calculationData.gridConnection === 'Buy all sell all') {
        return calculateBuyAllSellAll(calculationData);
      }
      
      let requestBody;

      // If the PV Design module is enabled, run its physics engine here and
      // pipe its monthly kWh / inverter kWac into the backend so the billing
      // pipeline uses the physics-based generation instead of the
      // consumption-based X2 = consumption/12 fallback.
      let pvDesignOverride: { monthlyKWh: number[]; inverterKWac: number; kwpDC: number; annualKWh: number } | null = null;
      if (calculationData.pvDesign?.enabled) {
        const pvd = calculationData.pvDesign;
        const yr: YieldResult = pvd.tier === 'quick'
          ? quickQuoteYield({
              region: pvd.region,
              sizingMode: pvd.sizingMode,
              sizeValue: pvd.sizeValue,
              systemType: pvd.systemType,
              prOverride: pvd.prOverride ?? undefined,
            })
          : calculatePVYield(pvd.detailed);
        const inverterKWac =
          pvd.tier === 'detailed'
            ? pvd.detailed.inverterKWac
            : (pvd.sizingMode === 'kWp' ? pvd.sizeValue : pvd.sizeValue / 5.5)
              / (pvd.systemType === 'res-rooftop' ? 1.5 : 1.2);
        pvDesignOverride = {
          monthlyKWh: yr.monthlyKWh_year1,
          inverterKWac,
          kwpDC: yr.lossBreakdown.dcKWp,
          annualKWh: yr.annualKWh_year1,
        };
        console.log('☀️ PV DESIGN ENABLED →', {
          tier: pvd.tier,
          annual_kWh: yr.annualKWh_year1.toFixed(0),
          inverter_kWac: inverterKWac.toFixed(2),
          specific_yield: yr.specificYield_kWhPerKWpYear.toFixed(0),
        });
      }

      // Resolve the EMRC sub-sector. 'auto' → derive from customer type
      // (+ subsidized flag for residential); else honour the explicit pick.
      const effectiveSector: SectorCode =
        calculationData.sector === 'auto'
          ? defaultSectorFor(calculationData.customerType as any, {
              subsidized:
                calculationData.customerType === 'Residential'
                  ? calculationData.tariffSupported
                  : undefined,
            })
          : calculationData.sector;

      // Detailed monthly mode → seasonal generation curve (default Amman zone).
      const seasonalShares: number[] | undefined = calculationData.detailedMonthly
        ? ZONE_MONTHLY_SHARES[JORDAN_REGIONS.amman.zone]
        : undefined;

      // Map parameters based on customer type and grid connection
      if (calculationData.customerType === 'Industrial' && calculationData.gridConnection === 'Net billing') {
        console.log('🏭 INDUSTRIAL CALCULATION: Sending native 4-period data to backend...');
        
        // Send native 4-period Industrial factors to backend (no compression)
        requestBody = {
          consumption: calculationData.consumption,
          efficiency: calculationData.efficiency,
          tariff_supported: calculationData.tariffSupported,
          export_tariff: calculationData.exportTariff,
          customer_type: 'Industrial',
          // 4-period consumption factors
          period1_factors: calculationData.period1Factors,  // Off Peak (5-14) - y1
          period2_factors: calculationData.period2Factors,  // Half Peak (14-17) - y2
          period3_factors: calculationData.period3Factors,  // Peak (17-23) - y3
          period4_factors: calculationData.period4Factors,  // Half Peak (23-5) - y4
          
          // 4-period solar generation factors
          sun_period1_factors: calculationData.sunPeriod1Factors,  // Off Peak (5-14)
          sun_period2_factors: calculationData.sunPeriod2Factors,  // Half Peak (14-17)
          sun_period3_factors: calculationData.sunPeriod3Factors,  // Peak (17-23)
          sun_period4_factors: calculationData.sunPeriod4Factors,  // Half Peak (23-5)
          
          // 4-period PV self-consumption factors
          pv_consume_period1: calculationData.pvConsumePeriod1,  // Off Peak (5-14) - k1
          pv_consume_period2: calculationData.pvConsumePeriod2,  // Half Peak (14-17) - k2
          pv_consume_period3: calculationData.pvConsumePeriod3,  // Peak (17-23) - k3
          pv_consume_period4: calculationData.pvConsumePeriod4,  // Half Peak (23-5) - k4
          
          // Industrial tariff configuration (from state)
          industrial_tariffs: calculationData.industrialTariffs,
          // Jordan EMRC 2025 sector dispatch + Bylaw 58/2024 mechanism
          sector: effectiveSector,
          net_billing_mechanism: mechanismFor(calculationData.gridConnection),
          // PF defaults to 0.90 → no penalty (NEPCO §I.1.d threshold = 0.88).
          power_factor: 0.9,
          ...(seasonalShares && { seasonal_generation_shares: seasonalShares }),
          ...(pvDesignOverride && {
            monthly_pv_generation_override: pvDesignOverride.monthlyKWh,
            inverter_kwac: pvDesignOverride.inverterKWac,
            kwp_dc_override: pvDesignOverride.kwpDC,
          }),
        };

        console.log('🏭 INDUSTRIAL CALCULATION: Sent native 4-period data (no compression)');
      } else {
        // Residential-style 3-bucket path. Used for Residential AND the other
        // non-industrial sectors (Commercial / Hotels / Hospitals / Agriculture):
        // the backend prices the resolved sector, mapping the day/evening/night
        // buckets onto EMRC TOU windows when the sector is TOU-based.
        // 3-phase meter for non-residential; TV fee only for residential.
        const isResidential = calculationData.customerType === 'Residential';
        requestBody = {
          consumption: calculationData.consumption,
          efficiency: calculationData.efficiency,
          tariff_supported: calculationData.tariffSupported,
          export_tariff: calculationData.exportTariff,
          day_factors: calculationData.dayFactors,
          evening_factors: calculationData.eveningFactors,
          night_factors: calculationData.nightFactors,
          sun_peak_factors: calculationData.sunPeakFactors,
          sun_medium_factors: calculationData.sunMediumFactors,
          sun_low_factors: calculationData.sunLowFactors,
          pv_consume_day: calculationData.pvConsumeDay,
          pv_consume_evening: calculationData.pvConsumeEvening,
          pv_consume_night: calculationData.pvConsumeNight,
          sector: effectiveSector,
          meter_phase: isResidential ? 1 : 3,
          apply_tv_fee: isResidential,
          net_billing_mechanism: mechanismFor(calculationData.gridConnection),
          power_factor: 0.9,
          ...(seasonalShares && { seasonal_generation_shares: seasonalShares }),
          ...(pvDesignOverride && {
            monthly_pv_generation_override: pvDesignOverride.monthlyKWh,
            inverter_kwac: pvDesignOverride.inverterKWac,
            kwp_dc_override: pvDesignOverride.kwpDC,
          }),
        };

        console.log('Calculating with sector path:', {
          customerType: calculationData.customerType,
          gridConnection: calculationData.gridConnection,
          sector: effectiveSector,
          detailedMonthly: calculationData.detailedMonthly,
        });
      }
      
      const response = await fetch('/api/calculate', {
        method: 'POST',
        body: JSON.stringify(requestBody),
        headers: { 'Content-Type': 'application/json' }
      });
      if (!response.ok) {
        throw new Error('Calculation failed');
      }
      return response.json();
    },
    onSuccess: (data: CalculationResults) => {
      setResults(data);
      console.log('Calculation completed:', data.annual_summary);
    },
    onError: (error) => {
      console.error('Calculation failed:', error);
    }
  });

  const calculate = useCallback((opts?: { onSuccess?: () => void }) => {
    calculateMutation.mutate(state, opts?.onSuccess ? { onSuccess: opts.onSuccess } : undefined);
  }, [state, calculateMutation]);

  const updateField = useCallback(<K extends keyof CalculatorState>(
    field: K, 
    value: CalculatorState[K]
  ) => {
    setState(prev => {
      const newState = { ...prev, [field]: value };
      
      // Automatically set export tariff based on customer type (residential
      // 0.050 JD/kWh, all non-residential 0.040 per Bylaw 58/2024 defaults).
      // Reset the sub-sector to 'auto' so a stale pick from a prior type is
      // not carried over.
      if (field === 'customerType') {
        newState.exportTariff = value === 'Residential' ? 0.05 : 0.04;
        newState.sector = 'auto';
        console.log(`Auto-set export tariff to ${newState.exportTariff} for ${value} customer type`);
      }
      
      return newState;
    });
    console.log(`Updated ${field}:`, value);
  }, []);

  return (
    <>
      {children({
        state,
        setState,
        calculate,
        results,
        isCalculating: calculateMutation.isPending,
        updateField
      })}
    </>
  );
}