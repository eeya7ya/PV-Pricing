import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { 
  DollarSign, 
  Zap, 
  Clock, 
  TrendingUp, 
  Building2, 
  Home,
  Settings,
  Check
} from 'lucide-react';

import { TariffEngine, applyTariffPreset } from '@/lib/tariffEngine';
import { 
  type TariffConfig,
  type ResidentialTariff, 
  type IndustrialTariffs,
  TARIFF_PRESETS
} from '@shared/schema';

interface TariffPanelProps {
  customerType: string;
  tariffType: string;
  tariffConfig: TariffConfig;
  onTariffTypeChange: (tariffType: string) => void;
  onTariffConfigChange: (tariffConfig: TariffConfig) => void;
  className?: string;
}

export default function TariffPanel({
  customerType,
  tariffType,
  tariffConfig,
  onTariffTypeChange,
  onTariffConfigChange,
  className = ""
}: TariffPanelProps) {
  const [isAdvancedMode, setIsAdvancedMode] = useState(false);

  // Handle preset application
  const applyPreset = (presetKey: keyof typeof TARIFF_PRESETS) => {
    const { tariff_type, tariff_config } = applyTariffPreset(presetKey);
    onTariffTypeChange(tariff_type);
    onTariffConfigChange(tariff_config);
  };

  // Handle tariff configuration updates
  const updateResidentialConfig = (updates: Partial<ResidentialTariff>) => {
    if (tariffConfig.type === 'residential') {
      onTariffConfigChange({
        ...tariffConfig,
        config: { ...tariffConfig.config, ...updates }
      });
    }
  };

  const updateIndustrialConfig = (updates: Partial<IndustrialTariffs>) => {
    if (tariffConfig.type === 'industrial') {
      onTariffConfigChange({
        ...tariffConfig,
        config: { ...tariffConfig.config, ...updates }
      });
    }
  };

  // Handle tier updates for residential tariffs
  const updateTier = (tierIndex: number, field: 'upToKWh' | 'rate', value: number) => {
    if (tariffConfig.type === 'residential') {
      const updatedTiers = [...tariffConfig.config.tiers];
      updatedTiers[tierIndex] = { ...updatedTiers[tierIndex], [field]: value };
      updateResidentialConfig({ tiers: updatedTiers });
    }
  };

  const currentCalculator = TariffEngine.createCalculator(tariffType, tariffConfig);

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            Dynamic Tariff Configuration
            <Badge variant="secondary" className="ml-2">
              {customerType}
            </Badge>
          </CardTitle>
          <div className="flex items-center gap-2">
            <Label htmlFor="advanced-mode" className="text-sm">Advanced</Label>
            <Switch
              id="advanced-mode"
              checked={isAdvancedMode}
              onCheckedChange={setIsAdvancedMode}
              data-testid="switch-advanced-mode"
            />
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Current Tariff Display */}
        <div className="p-4 bg-primary/5 rounded-lg border">
          <div className="flex items-center gap-2 mb-2">
            <Check className="h-4 w-4 text-primary" />
            <span className="font-medium text-primary">Active Tariff:</span>
          </div>
          <Badge variant="default" className="text-sm">
            {currentCalculator.label}
          </Badge>
        </div>

        {/* Preset Buttons */}
        <div className="space-y-3">
          <Label className="text-base font-medium">Quick Apply Presets:</Label>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {/* Residential Tiered Preset (Figure-1) */}
            <Button
              variant={tariffType === 'residential:tiered' ? 'default' : 'outline'}
              className="flex flex-col items-center gap-2 h-auto p-4 hover-elevate active-elevate-2"
              onClick={() => applyPreset('residential:tiered')}
              data-testid="button-preset-residential-tiered"
            >
              <Home className="h-5 w-5" />
              <div className="text-center">
                <div className="font-medium">Residential Tiered</div>
                <div className="text-xs text-muted-foreground">Figure-1</div>
              </div>
            </Button>

            {/* Residential Flat Rate Preset (Figure-1) */}
            <Button
              variant={tariffType === 'residential:flat' ? 'default' : 'outline'}
              className="flex flex-col items-center gap-2 h-auto p-4 hover-elevate active-elevate-2"
              onClick={() => applyPreset('residential:flat')}
              data-testid="button-preset-residential-flat"
            >
              <TrendingUp className="h-5 w-5" />
              <div className="text-center">
                <div className="font-medium">Residential Flat</div>
                <div className="text-xs text-muted-foreground">Figure-1</div>
              </div>
            </Button>

            {/* Industrial TOU Preset (Figure-2) */}
            <Button
              variant={tariffType === 'industrial:tou' ? 'default' : 'outline'}
              className="flex flex-col items-center gap-2 h-auto p-4 hover-elevate active-elevate-2"
              onClick={() => applyPreset('industrial:tou')}
              data-testid="button-preset-industrial-tou"
            >
              <Building2 className="h-5 w-5" />
              <div className="text-center">
                <div className="font-medium">Industrial TOU</div>
                <div className="text-xs text-muted-foreground">Figure-2</div>
              </div>
            </Button>
          </div>
        </div>

        {/* Advanced Configuration */}
        {isAdvancedMode && (
          <>
            <Separator />
            
            {/* Manual Tariff Selection */}
            <div className="space-y-3">
              <Label className="text-base font-medium">Manual Tariff Selection:</Label>
              <Select value={tariffType} onValueChange={onTariffTypeChange}>
                <SelectTrigger data-testid="select-tariff-type">
                  <SelectValue placeholder="Select tariff type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="residential:tiered">Residential Tiered</SelectItem>
                  <SelectItem value="residential:flat">Residential Flat Rate</SelectItem>
                  <SelectItem value="industrial:tou">Industrial Time-of-Use</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Tariff Configuration Form */}
            {tariffConfig.type === 'residential' && (
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Settings className="h-4 w-4" />
                  <Label className="text-base font-medium">Residential Tariff Parameters:</Label>
                </div>
                
                {/* Export Rate */}
                <div className="space-y-2">
                  <Label htmlFor="export-rate">Export Rate:</Label>
                  <div className="relative max-w-xs">
                    <Input
                      id="export-rate"
                      type="number"
                      min="0"
                      max="1"
                      step="0.01"
                      value={tariffConfig.config.export_rate}
                      onChange={(e) => updateResidentialConfig({ export_rate: Number(e.target.value) })}
                      className="pr-16"
                      data-testid="input-export-rate"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                      JD/kWh
                    </span>
                  </div>
                </div>

                {/* Tier Configuration */}
                <div className="space-y-3">
                  <Label className="text-sm font-medium">Tier Structure:</Label>
                  <div className="space-y-3">
                    {tariffConfig.config.tiers.map((tier, index) => (
                      <div key={index} className="grid grid-cols-2 gap-3 p-3 bg-muted/30 rounded-md">
                        <div className="space-y-2">
                          <Label className="text-xs">Up to kWh:</Label>
                          <Input
                            type="number"
                            min="0"
                            value={tier.upToKWh === Infinity ? 999999 : tier.upToKWh}
                            onChange={(e) => updateTier(index, 'upToKWh', e.target.value === '999999' ? Infinity : Number(e.target.value))}
                            className="text-sm"
                            data-testid={`input-tier-${index}-kwh`}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-xs">Rate (JD/kWh):</Label>
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            value={tier.rate}
                            onChange={(e) => updateTier(index, 'rate', Number(e.target.value))}
                            className="text-sm"
                            data-testid={`input-tier-${index}-rate`}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {tariffConfig.type === 'industrial' && (
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  <Label className="text-base font-medium">Industrial TOU Parameters:</Label>
                </div>

                {/* Import Rates */}
                <div className="space-y-3">
                  <Label className="text-sm font-medium">Import Rates (¢/kWh):</Label>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label className="text-xs">Off Peak (5-14):</Label>
                      <Input
                        type="number"
                        min="0"
                        step="0.1"
                        value={tariffConfig.config.import_period1}
                        onChange={(e) => updateIndustrialConfig({ import_period1: Number(e.target.value) })}
                        className="text-sm"
                        data-testid="input-import-period1"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs">Half Peak (14-17):</Label>
                      <Input
                        type="number"
                        min="0"
                        step="0.1"
                        value={tariffConfig.config.import_period2}
                        onChange={(e) => updateIndustrialConfig({ import_period2: Number(e.target.value) })}
                        className="text-sm"
                        data-testid="input-import-period2"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs">Peak (17-23):</Label>
                      <Input
                        type="number"
                        min="0"
                        step="0.1"
                        value={tariffConfig.config.import_period3}
                        onChange={(e) => updateIndustrialConfig({ import_period3: Number(e.target.value) })}
                        className="text-sm"
                        data-testid="input-import-period3"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs">Half Peak Night (23-5):</Label>
                      <Input
                        type="number"
                        min="0"
                        step="0.1"
                        value={tariffConfig.config.import_period4}
                        onChange={(e) => updateIndustrialConfig({ import_period4: Number(e.target.value) })}
                        className="text-sm"
                        data-testid="input-import-period4"
                      />
                    </div>
                  </div>
                </div>

                {/* Export Rates */}
                <div className="space-y-3">
                  <Label className="text-sm font-medium">Export Rates (¢/kWh):</Label>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label className="text-xs">Off Peak Export:</Label>
                      <Input
                        type="number"
                        min="0"
                        step="0.1"
                        value={tariffConfig.config.export_period1}
                        onChange={(e) => updateIndustrialConfig({ export_period1: Number(e.target.value) })}
                        className="text-sm"
                        data-testid="input-export-period1"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs">Half Peak Export:</Label>
                      <Input
                        type="number"
                        min="0"
                        step="0.1"
                        value={tariffConfig.config.export_period2}
                        onChange={(e) => updateIndustrialConfig({ export_period2: Number(e.target.value) })}
                        className="text-sm"
                        data-testid="input-export-period2"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs">Peak Export:</Label>
                      <Input
                        type="number"
                        min="0"
                        step="0.1"
                        value={tariffConfig.config.export_period3}
                        onChange={(e) => updateIndustrialConfig({ export_period3: Number(e.target.value) })}
                        className="text-sm"
                        data-testid="input-export-period3"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs">Half Peak Night Export:</Label>
                      <Input
                        type="number"
                        min="0"
                        step="0.1"
                        value={tariffConfig.config.export_period4}
                        onChange={(e) => updateIndustrialConfig({ export_period4: Number(e.target.value) })}
                        className="text-sm"
                        data-testid="input-export-period4"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}