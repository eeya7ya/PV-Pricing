import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calculator, Zap, Building2, Factory } from 'lucide-react';
import type { IndustrialBassType, IndustrialBassConfig } from '@shared/schema';

interface SystemConfigurationProps {
  efficiency: number;
  degradation: number;
  tariffSupported: boolean;
  exportTariff: number;
  pvSize?: number;
  inverterSize?: number;
  customerType: string;
  gridConnection: string;
  onEfficiencyChange: (value: number) => void;
  onDegradationChange: (value: number) => void;
  onTariffSupportedChange: (value: boolean) => void;
  onExportTariffChange: (value: number) => void;
  className?: string;
  // Industrial Buy-All Sell-All props
  industrialBassConfig?: IndustrialBassConfig;
  onIndustrialBassConfigChange?: (config: IndustrialBassConfig) => void;
}

export default function SystemConfiguration({
  efficiency,
  degradation,
  tariffSupported,
  exportTariff,
  pvSize,
  inverterSize,
  customerType,
  gridConnection,
  onEfficiencyChange,
  onDegradationChange,
  onTariffSupportedChange,
  onExportTariffChange,
  className = "",
  industrialBassConfig,
  onIndustrialBassConfigChange
}: SystemConfigurationProps) {
  
  const isIndustrialBuyAllSellAll = customerType === 'Industrial' && gridConnection === 'Buy all sell all';
  
  return (
    <div className={`space-y-6 ${className}`}>
      {/* System Sizing Display */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calculator className="h-5 w-5" />
            System Sizing
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-sm font-medium">Monthly PV Generation:</Label>
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="text-lg px-3 py-1">
                  <span data-testid="text-pv-size">
                    {pvSize ? `${pvSize.toFixed(2)} kWh/month` : 'Will be calculated automatically'}
                  </span>
                </Badge>
              </div>
            </div>
            
            <div className="space-y-2">
              <Label className="text-sm font-medium">Estimated Inverter Size:</Label>
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="text-lg px-3 py-1">
                  <span data-testid="text-inverter-size">
                    {inverterSize ? `${inverterSize.toFixed(2)} kW` : 'Will be calculated automatically'}
                  </span>
                </Badge>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* System Parameters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5" />
            System Parameters
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="efficiency">System Efficiency:</Label>
              <div className="relative">
                <Input
                  id="efficiency"
                  type="number"
                  min="70"
                  max="100"
                  value={efficiency}
                  onChange={(e) => onEfficiencyChange(Number(e.target.value))}
                  className="pr-8"
                  data-testid="input-efficiency"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground pointer-events-none">
                  %
                </span>
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="degradation">Annual Degradation:</Label>
              <div className="relative">
                <Input
                  id="degradation"
                  type="number"
                  min="0"
                  max="5"
                  step="0.1"
                  value={degradation}
                  onChange={(e) => onDegradationChange(Number(e.target.value))}
                  className="pr-8"
                  data-testid="input-degradation"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground pointer-events-none">
                  %
                </span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Industrial Buy-All Sell-All Configuration */}
      {isIndustrialBuyAllSellAll && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Industrial Configuration
              <Badge variant="outline" className="ml-auto">Buy All Sell All</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="industrial-type" className="text-sm font-medium">
                Industrial Type
              </Label>
              <Select 
                value={industrialBassConfig?.type || 'Small Industrial'} 
                onValueChange={(value: IndustrialBassType) => {
                  if (onIndustrialBassConfigChange && industrialBassConfig) {
                    onIndustrialBassConfigChange({
                      ...industrialBassConfig,
                      type: value
                    });
                  }
                }}
                data-testid="select-industrial-type"
              >
                <SelectTrigger id="industrial-type">
                  <SelectValue placeholder="Select industrial type">
                    <div className="flex items-center gap-2">
                      <Factory className="h-4 w-4" />
                      {industrialBassConfig?.type || 'Small Industrial'}
                    </div>
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Small Industrial" data-testid="option-small-industrial">
                    <div className="flex items-center gap-2">
                      <Factory className="h-4 w-4" />
                      <div>
                        <div className="font-medium">Small Industrial</div>
                        <div className="text-xs text-muted-foreground">
                          &lt;10000 kWh: 0.06JD/kWh, &gt;10000 kWh: 0.068JD/kWh
                        </div>
                      </div>
                    </div>
                  </SelectItem>
                  <SelectItem value="Medium Industrial" data-testid="option-medium-industrial">
                    <div className="flex items-center gap-2">
                      <Building2 className="h-4 w-4" />
                      <div>
                        <div className="font-medium">Medium Industrial</div>
                        <div className="text-xs text-muted-foreground">
                          Off Peak: 0.059JD, Half Peak: 0.069JD, Peak: 0.079JD
                        </div>
                      </div>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="export-rate" className="text-sm font-medium">
                Export Rate (JD/kWh)
              </Label>
              <Input
                id="export-rate"
                type="number"
                min="0"
                max="1"
                step="0.001"
                value={industrialBassConfig?.export_rate || 0.05}
                onChange={(e) => {
                  if (onIndustrialBassConfigChange && industrialBassConfig) {
                    onIndustrialBassConfigChange({
                      ...industrialBassConfig,
                      export_rate: Number(e.target.value)
                    });
                  }
                }}
                data-testid="input-export-rate"
              />
            </div>

            <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200">
              <h4 className="font-medium text-blue-700 dark:text-blue-200 mb-2">
                Buy-All Sell-All System
              </h4>
              <div className="text-sm text-blue-600 dark:text-blue-300 space-y-1">
                <div>• All PV generation is exported to the grid (no direct consumption)</div>
                <div>• All consumption is imported from the grid</div>
                <div>• Calculation: X2 = Total Annual Consumption ÷ 12 (approximation)</div>
                <div>• NET Tariff = (Import Tariff + Taxes) - Export Tariff</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

    </div>
  );
}