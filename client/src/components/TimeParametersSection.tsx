import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Clock, Sun, Settings, Zap, Building2, Factory } from 'lucide-react';
import { useState } from 'react';
import TimeFactorWidget from './TimeFactorWidget';
import type { TimeFactors, IndustrialBassConfig } from '@shared/schema';

interface TimeParametersSectionProps {
  customerType: string;
  gridConnection: string;
  detailedMonthly?: boolean;
  onDetailedMonthlyChange?: (value: boolean) => void;
  // Consumption Period Factors
  dayFactors: TimeFactors;
  eveningFactors: TimeFactors;
  nightFactors: TimeFactors;
  // Industrial Period Factors
  period1Factors: TimeFactors;
  period2Factors: TimeFactors;
  period3Factors: TimeFactors;
  period4Factors: TimeFactors;
  // Solar Generation Factors - Residential
  sunPeakFactors: TimeFactors;
  sunMediumFactors: TimeFactors;
  sunLowFactors: TimeFactors;
  // Solar Generation Factors - Industrial
  sunPeriod1Factors: TimeFactors;
  sunPeriod2Factors: TimeFactors;
  sunPeriod3Factors: TimeFactors;
  sunPeriod4Factors: TimeFactors;
  // PV Self-Consumption Factors - Residential
  pvConsumeDay: TimeFactors;
  pvConsumeEvening: TimeFactors;
  pvConsumeNight: TimeFactors;
  // PV Self-Consumption Factors - Industrial
  pvConsumePeriod1: TimeFactors;
  pvConsumePeriod2: TimeFactors;
  pvConsumePeriod3: TimeFactors;
  pvConsumePeriod4: TimeFactors;
  // Industrial Buy-All Sell-All configuration
  industrialBassConfig?: IndustrialBassConfig;
  onIndustrialBassConfigChange?: (config: IndustrialBassConfig) => void;
  // Update handlers
  updateField: (field: any, value: any) => void;
}

export default function TimeParametersSection({
  customerType,
  gridConnection,
  detailedMonthly = false,
  onDetailedMonthlyChange,
  dayFactors,
  eveningFactors,
  nightFactors,
  period1Factors,
  period2Factors,
  period3Factors,
  period4Factors,
  sunPeakFactors,
  sunMediumFactors,
  sunLowFactors,
  sunPeriod1Factors,
  sunPeriod2Factors,
  sunPeriod3Factors,
  sunPeriod4Factors,
  pvConsumeDay,
  pvConsumeEvening,
  pvConsumeNight,
  pvConsumePeriod1,
  pvConsumePeriod2,
  pvConsumePeriod3,
  pvConsumePeriod4,
  industrialBassConfig,
  onIndustrialBassConfigChange,
  updateField
}: TimeParametersSectionProps) {
  
  // State for dropdown selection
  const [selectedParameter, setSelectedParameter] = useState<'consumption' | 'solar' | 'pv-consumption'>('consumption');
  
  // Show configuration-specific parameters. The 3-bucket "residential-style"
  // grid is used for Residential AND the other non-industrial sectors
  // (Commercial / Hotels / Hospitals / Agriculture), which the backend prices
  // by mapping the buckets onto EMRC TOU windows.
  const showIndustrialParams = customerType === 'Industrial' && gridConnection === 'Net billing';
  const isResidentialBuyAllSellAll = customerType === 'Residential' && gridConnection === 'Buy all sell all';
  const isIndustrialBuyAllSellAll = customerType === 'Industrial' && gridConnection === 'Buy all sell all';
  const showResidentialParams =
    customerType !== 'Industrial' && gridConnection === 'Net billing' && !isResidentialBuyAllSellAll;
  const showUnsupportedConfig = !showResidentialParams && !showIndustrialParams && !isResidentialBuyAllSellAll && !isIndustrialBuyAllSellAll;

  // Handle Residential Buy-All Sell-All case (no time period parameters needed)
  if (isResidentialBuyAllSellAll) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Time Period Parameters
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="p-6 border-2 border-dashed border-green-200 bg-green-50 dark:bg-green-900/20 rounded-lg text-center">
            <Zap className="h-12 w-12 mx-auto text-green-600 mb-4" />
            <h4 className="font-medium text-green-700 dark:text-green-200 mb-2">
              No Time Period Parameters to Add
            </h4>
            <p className="text-sm text-green-600 dark:text-green-300">
              Residential Buy-All Sell-All systems use simplified calculations that don't require time period distribution factors.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Handle Industrial Buy-All Sell-All case (show 4-period distribution factors)
  if (isIndustrialBuyAllSellAll) {
    const validateFactors = () => {
      if (!industrialBassConfig) return false;
      const total = 
        industrialBassConfig.off_peak_factor + 
        industrialBassConfig.half_peak_day_factor + 
        industrialBassConfig.peak_factor + 
        industrialBassConfig.half_peak_night_factor;
      return Math.abs(total - 1.0) < 0.001;
    };

    const getFactorSum = () => {
      if (!industrialBassConfig) return 0;
      return industrialBassConfig.off_peak_factor + 
             industrialBassConfig.half_peak_day_factor + 
             industrialBassConfig.peak_factor + 
             industrialBassConfig.half_peak_night_factor;
    };

    const resetToDefaults = () => {
      if (onIndustrialBassConfigChange && industrialBassConfig) {
        onIndustrialBassConfigChange({
          ...industrialBassConfig,
          off_peak_factor: 0.250,
          half_peak_day_factor: 0.125,
          peak_factor: 0.250,
          half_peak_night_factor: 0.375
        });
      }
    };

    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Time Period Distribution Factors
            <Badge variant="outline" className="ml-auto">Industrial Buy-All Sell-All</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200">
            <div className="text-sm text-blue-600 dark:text-blue-300 space-y-1">
              <div className="font-medium">Specify what percentage of your total consumption occurs during each time period.</div>
              <div>The sum of all periods must equal 1.00 (100%). Default values are based on typical industrial patterns.</div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Off Peak */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Label className="text-sm font-medium">Off Peak</Label>
                <Badge variant="secondary" className="text-xs">5:00-14:00 (9h)</Badge>
              </div>
              <Input
                type="number"
                min="0"
                max="1"
                step="0.001"
                value={industrialBassConfig?.off_peak_factor || 0.250}
                onChange={(e) => {
                  if (onIndustrialBassConfigChange && industrialBassConfig) {
                    onIndustrialBassConfigChange({
                      ...industrialBassConfig,
                      off_peak_factor: Number(e.target.value)
                    });
                  }
                }}
                data-testid="input-off-peak-factor"
              />
              <div className="text-xs text-muted-foreground">Lower consumption period</div>
            </div>

            {/* Half Peak Day */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Label className="text-sm font-medium">Half Peak (Day)</Label>
                <Badge variant="secondary" className="text-xs">14:00-17:00 (3h)</Badge>
              </div>
              <Input
                type="number"
                min="0"
                max="1"
                step="0.001"
                value={industrialBassConfig?.half_peak_day_factor || 0.125}
                onChange={(e) => {
                  if (onIndustrialBassConfigChange && industrialBassConfig) {
                    onIndustrialBassConfigChange({
                      ...industrialBassConfig,
                      half_peak_day_factor: Number(e.target.value)
                    });
                  }
                }}
                data-testid="input-half-peak-day-factor"
              />
              <div className="text-xs text-muted-foreground">Afternoon period</div>
            </div>

            {/* Peak */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Label className="text-sm font-medium">Peak</Label>
                <Badge variant="secondary" className="text-xs">17:00-23:00 (6h)</Badge>
              </div>
              <Input
                type="number"
                min="0"
                max="1"
                step="0.001"
                value={industrialBassConfig?.peak_factor || 0.250}
                onChange={(e) => {
                  if (onIndustrialBassConfigChange && industrialBassConfig) {
                    onIndustrialBassConfigChange({
                      ...industrialBassConfig,
                      peak_factor: Number(e.target.value)
                    });
                  }
                }}
                data-testid="input-peak-factor"
              />
              <div className="text-xs text-muted-foreground">Highest consumption period</div>
            </div>

            {/* Half Peak Night */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Label className="text-sm font-medium">Half Peak (Night)</Label>
                <Badge variant="secondary" className="text-xs">23:00-5:00 (6h)</Badge>
              </div>
              <Input
                type="number"
                min="0"
                max="1"
                step="0.001"
                value={industrialBassConfig?.half_peak_night_factor || 0.375}
                onChange={(e) => {
                  if (onIndustrialBassConfigChange && industrialBassConfig) {
                    onIndustrialBassConfigChange({
                      ...industrialBassConfig,
                      half_peak_night_factor: Number(e.target.value)
                    });
                  }
                }}
                data-testid="input-half-peak-night-factor"
              />
              <div className="text-xs text-muted-foreground">Night operations</div>
            </div>
          </div>

          {/* Factor Sum Validation */}
          <div className="flex items-center justify-between p-4 border rounded-lg">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">Total Sum:</span>
              <Badge 
                variant={validateFactors() ? "default" : "destructive"} 
                className="font-mono"
              >
                {getFactorSum().toFixed(3)}
              </Badge>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={resetToDefaults}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors underline"
                data-testid="button-reset-factors"
              >
                Reset to Defaults
              </button>
            </div>
          </div>

          {!validateFactors() && (
            <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 rounded-lg">
              <div className="text-sm text-red-600 dark:text-red-300">
                ⚠️ Time period factors must sum to exactly 1.000 (100%)
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  if (showUnsupportedConfig) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Time Period Parameters
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="p-6 border-2 border-dashed border-muted-foreground/30 rounded-lg text-center">
            <h4 className="font-medium text-muted-foreground mb-2">
              Parameters for {customerType} + {gridConnection}
            </h4>
            <p className="text-sm text-muted-foreground">
              Time period parameters for this configuration will be added in future steps.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Settings className="h-5 w-5" />
          Time Period Parameters
          <Badge variant="outline" className="ml-auto">
            {customerType} + {gridConnection}
          </Badge>
        </CardTitle>
        <div className="flex items-center justify-between gap-3 mt-3 p-3 rounded-lg bg-muted/50">
          <div>
            <Label htmlFor="detailed-monthly" className="text-sm font-medium">
              Detailed monthly distribution
            </Label>
            <p className="text-xs text-muted-foreground">
              Off: one distribution applied to every month + flat generation. On: edit each
              month individually and spread PV generation across the seasonal solar curve.
            </p>
          </div>
          <Switch
            id="detailed-monthly"
            checked={detailedMonthly}
            onCheckedChange={(v) => onDetailedMonthlyChange?.(!!v)}
            data-testid="switch-detailed-monthly"
          />
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Settings className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Parameter Type:</span>
            </div>
            <Select value={selectedParameter} onValueChange={(value: 'consumption' | 'solar' | 'pv-consumption') => setSelectedParameter(value)} data-testid="select-parameter-type">
              <SelectTrigger className="w-64">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="consumption">
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4" />
                    Consumption Periods
                  </div>
                </SelectItem>
                <SelectItem value="solar">
                  <div className="flex items-center gap-2">
                    <Sun className="h-4 w-4" />
                    Solar Generation
                  </div>
                </SelectItem>
                <SelectItem value="pv-consumption">
                  <div className="flex items-center gap-2">
                    <Zap className="h-4 w-4" />
                    PV Self-Consumption Factors
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {selectedParameter === 'consumption' && (
            <div className="space-y-4">
            <div className="flex items-center gap-2 mb-4">
              <Zap className="h-5 w-5 text-primary" />
              <h3 className="text-lg font-semibold">Consumption Distribution by Time Period</h3>
            </div>
            
            {showResidentialParams && (
              <div className="grid gap-4">
                <TimeFactorWidget
                  detailed={detailedMonthly}
                  title="Day Time (5-17) Factors"
                  description="Consumption distribution during day hours"
                  defaultValue={30}
                  factors={dayFactors}
                  onChange={(factors) => updateField('dayFactors', factors)}
                  color="chart-1"
                />
                
                <TimeFactorWidget
                  detailed={detailedMonthly}
                  title="Evening Time (17-23) Factors"
                  description="Consumption distribution during evening hours"
                  defaultValue={30}
                  factors={eveningFactors}
                  onChange={(factors) => updateField('eveningFactors', factors)}
                  color="chart-2"
                />
                
                <TimeFactorWidget
                  detailed={detailedMonthly}
                  title="Night Time (23-5) Factors"
                  description="Consumption distribution during night hours"
                  defaultValue={40}
                  factors={nightFactors}
                  onChange={(factors) => updateField('nightFactors', factors)}
                  color="chart-3"
                />
              </div>
            )}

            {showIndustrialParams && (
              <div className="grid gap-4">
                <div className="text-sm text-muted-foreground mb-2">
                  Industrial 4-Period Consumption Distribution
                </div>
                
                <TimeFactorWidget
                  detailed={detailedMonthly}
                  title="Off Peak (5-14) Factors"
                  description="Industrial consumption y1 factor during off-peak hours"
                  defaultValue={40}
                  factors={period1Factors}
                  onChange={(factors) => updateField('period1Factors', factors)}
                  color="chart-1"
                />
                
                <TimeFactorWidget
                  detailed={detailedMonthly}
                  title="Half Peak (14-17) Factors"
                  description="Industrial consumption y2 factor during half-peak hours"
                  defaultValue={20}
                  factors={period2Factors}
                  onChange={(factors) => updateField('period2Factors', factors)}
                  color="chart-2"
                />
                
                <TimeFactorWidget
                  detailed={detailedMonthly}
                  title="Peak (17-23) Factors"
                  description="Industrial consumption y3 factor during peak hours"
                  defaultValue={30}
                  factors={period3Factors}
                  onChange={(factors) => updateField('period3Factors', factors)}
                  color="chart-3"
                />
                
                <TimeFactorWidget
                  detailed={detailedMonthly}
                  title="Half Peak (23-5) Factors"
                  description="Industrial consumption y4 factor during late night hours"
                  defaultValue={10}
                  factors={period4Factors}
                  onChange={(factors) => updateField('period4Factors', factors)}
                  color="chart-4"
                />
              </div>
            )}
            </div>
          )}

          {selectedParameter === 'solar' && (
            <div className="space-y-4">
            <div className="flex items-center gap-2 mb-4">
              <Sun className="h-5 w-5 text-chart-2" />
              <h3 className="text-lg font-semibold">Solar Generation Distribution by Time Period</h3>
            </div>

            {showResidentialParams && (
              <div className="grid gap-4">
                <div className="text-sm text-muted-foreground mb-2">
                  Residential 3-Period Solar Generation
                </div>
                
                <TimeFactorWidget
                  detailed={detailedMonthly}
                  title="Day Time Sun Factor"
                  description="Solar generation potential during day hours"
                  defaultValue={100}
                  factors={sunPeakFactors}
                  onChange={(factors) => updateField('sunPeakFactors', factors)}
                  color="chart-2"
                />
                
                <TimeFactorWidget
                  detailed={detailedMonthly}
                  title="Evening Time Sun Factor"
                  description="Solar generation potential during evening hours"
                  defaultValue={20}
                  factors={sunMediumFactors}
                  onChange={(factors) => updateField('sunMediumFactors', factors)}
                  color="chart-3"
                />
                
                <TimeFactorWidget
                  detailed={detailedMonthly}
                  title="Night Time Sun Factor"
                  description="Solar generation potential during night hours"
                  defaultValue={0}
                  factors={sunLowFactors}
                  onChange={(factors) => updateField('sunLowFactors', factors)}
                  color="chart-4"
                />
              </div>
            )}

            {showIndustrialParams && (
              <div className="grid gap-4">
                <div className="text-sm text-muted-foreground mb-2">
                  Industrial 4-Period Solar Generation
                </div>
                
                <TimeFactorWidget
                  detailed={detailedMonthly}
                  title="Off Peak Solar (5-14)"
                  description="Solar generation during off-peak hours"
                  defaultValue={70}
                  factors={sunPeriod1Factors}
                  onChange={(factors) => updateField('sunPeriod1Factors', factors)}
                  color="chart-2"
                />
                
                <TimeFactorWidget
                  detailed={detailedMonthly}
                  title="Half Peak Solar (14-17)"
                  description="Solar generation during half-peak afternoon"
                  defaultValue={25}
                  factors={sunPeriod2Factors}
                  onChange={(factors) => updateField('sunPeriod2Factors', factors)}
                  color="chart-3"
                />
                
                <TimeFactorWidget
                  detailed={detailedMonthly}
                  title="Peak Solar (17-23)"
                  description="Solar generation during peak evening hours"
                  defaultValue={5}
                  factors={sunPeriod3Factors}
                  onChange={(factors) => updateField('sunPeriod3Factors', factors)}
                  color="chart-4"
                />
                
                <TimeFactorWidget
                  detailed={detailedMonthly}
                  title="Half Peak Solar (23-5)"
                  description="Solar generation during night half-peak hours"
                  defaultValue={0}
                  factors={sunPeriod4Factors}
                  onChange={(factors) => updateField('sunPeriod4Factors', factors)}
                  color="chart-5"
                />
              </div>
            )}
            </div>
          )}

          {selectedParameter === 'pv-consumption' && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 mb-4">
                <Zap className="h-5 w-5 text-chart-3" />
                <h3 className="text-lg font-semibold">PV Self-Consumption Factors by Time Period</h3>
              </div>

              {showResidentialParams && (
                <div className="grid gap-4">
                  <div className="text-sm text-muted-foreground mb-2">
                    Residential 3-Period PV Self-Consumption
                  </div>
                  
                  <TimeFactorWidget
                  detailed={detailedMonthly}
                    title="Day Time PV Consumption"
                    description="Percentage of PV generation consumed on-site during day"
                    defaultValue={70}
                    factors={pvConsumeDay}
                    onChange={(factors) => updateField('pvConsumeDay', factors)}
                    color="chart-3"
                  />
                  
                  <TimeFactorWidget
                  detailed={detailedMonthly}
                    title="Evening Time PV Consumption"
                    description="Percentage of PV generation consumed on-site during evening"
                    defaultValue={90}
                    factors={pvConsumeEvening}
                    onChange={(factors) => updateField('pvConsumeEvening', factors)}
                    color="chart-4"
                  />
                  
                  <TimeFactorWidget
                  detailed={detailedMonthly}
                    title="Night Time PV Consumption"
                    description="Percentage of PV generation consumed on-site during night"
                    defaultValue={100}
                    factors={pvConsumeNight}
                    onChange={(factors) => updateField('pvConsumeNight', factors)}
                    color="chart-5"
                  />
                </div>
              )}

              {showIndustrialParams && (
                <div className="grid gap-4">
                  <div className="text-sm text-muted-foreground mb-2">
                    Industrial 4-Period PV Self-Consumption
                  </div>
                  
                  <TimeFactorWidget
                  detailed={detailedMonthly}
                    title="Off Peak PV Consumption (5-14)"
                    description="PV self-consumption during off-peak hours"
                    defaultValue={80}
                    factors={pvConsumePeriod1}
                    onChange={(factors) => updateField('pvConsumePeriod1', factors)}
                    color="chart-3"
                  />
                  
                  <TimeFactorWidget
                  detailed={detailedMonthly}
                    title="Half Peak PV Consumption (14-17)"
                    description="PV self-consumption during half-peak afternoon"
                    defaultValue={85}
                    factors={pvConsumePeriod2}
                    onChange={(factors) => updateField('pvConsumePeriod2', factors)}
                    color="chart-4"
                  />
                  
                  <TimeFactorWidget
                  detailed={detailedMonthly}
                    title="Peak PV Consumption (17-23)"
                    description="PV self-consumption during peak evening hours"
                    defaultValue={90}
                    factors={pvConsumePeriod3}
                    onChange={(factors) => updateField('pvConsumePeriod3', factors)}
                    color="chart-5"
                  />
                  
                  <TimeFactorWidget
                  detailed={detailedMonthly}
                    title="Half Peak PV Consumption (23-5)"
                    description="PV self-consumption during night half-peak hours"
                    defaultValue={70}
                    factors={pvConsumePeriod4}
                    onChange={(factors) => updateField('pvConsumePeriod4', factors)}
                    color="chart-1"
                  />
                </div>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}