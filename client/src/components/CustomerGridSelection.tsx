import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Building2, Zap, Users, Hotel, Hospital, Wheat } from 'lucide-react';
import { CUSTOMER_TYPES, GRID_CONNECTION_METHODS, CustomerType, GridConnection, SECTOR_TARIFFS, type SectorCode } from '@shared/schema';

// EMRC sub-sectors selectable per coarse customer type. 'auto' lets the
// engine derive the default sector (and, for residential, follow the
// subsidized-tariff toggle).
const SECTORS_BY_TYPE: Record<CustomerType, SectorCode[]> = {
  Residential: ['A1_subsidized', 'A2_unsubsidized'],
  Industrial: ['C1_small_industrial', 'C2_medium_industrial', 'C3_large_industrial', 'C4_extractive'],
  Commercial: ['B1_commercial', 'B2_temp_commercial', 'B3_banks', 'B4_telecom'],
  Hotels: ['D1_hotel_post2008', 'D2_hotel_pre2008_flat', 'D2_hotel_pre2008_tou', 'D3_hotel_low_star'],
  Hospitals: ['E1_private_hospital', 'E2_govt_hospital'],
  Agriculture: ['F1_agri_std', 'F2_agri_legacy', 'F3_agri_mixed_well'],
};

interface CustomerGridSelectionProps {
  customerType: CustomerType;
  gridConnection: GridConnection;
  sector: SectorCode | 'auto';
  onCustomerTypeChange: (customerType: CustomerType) => void;
  onGridConnectionChange: (gridConnection: GridConnection) => void;
  onSectorChange: (sector: SectorCode | 'auto') => void;
}

export default function CustomerGridSelection({
  customerType,
  gridConnection,
  sector,
  onCustomerTypeChange,
  onGridConnectionChange,
  onSectorChange
}: CustomerGridSelectionProps) {

  const getCustomerIcon = (type: CustomerType) => {
    switch (type) {
      case 'Residential': return <Users className="h-4 w-4" />;
      case 'Industrial': return <Building2 className="h-4 w-4" />;
      case 'Commercial': return <Building2 className="h-4 w-4" />;
      case 'Hotels': return <Hotel className="h-4 w-4" />;
      case 'Hospitals': return <Hospital className="h-4 w-4" />;
      case 'Agriculture': return <Wheat className="h-4 w-4" />;
      default: return <Users className="h-4 w-4" />;
    }
  };

  return (
    <Card className="hover-elevate">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <Zap className="h-5 w-5 text-primary" />
          Customer Configuration
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Customer Type Selection */}
        <div className="space-y-2">
          <Label htmlFor="customer-type" className="text-sm font-medium">
            Customer Type
          </Label>
          <Select 
            value={customerType} 
            onValueChange={(value: CustomerType) => onCustomerTypeChange(value)}
            data-testid="select-customer-type"
          >
            <SelectTrigger id="customer-type">
              <SelectValue placeholder="Select customer type">
                <div className="flex items-center gap-2">
                  {getCustomerIcon(customerType)}
                  {customerType}
                </div>
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {CUSTOMER_TYPES.map((type) => (
                <SelectItem key={type} value={type} data-testid={`option-customer-${type.toLowerCase()}`}>
                  <div className="flex items-center gap-2">
                    {getCustomerIcon(type)}
                    {type}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Sub-sector / tariff selection */}
        <div className="space-y-2">
          <Label htmlFor="sector" className="text-sm font-medium">
            EMRC Tariff Sector
          </Label>
          <Select
            value={sector}
            onValueChange={(value) => onSectorChange(value as SectorCode | 'auto')}
            data-testid="select-sector"
          >
            <SelectTrigger id="sector">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="auto" data-testid="option-sector-auto">
                Auto (default for {customerType})
              </SelectItem>
              {SECTORS_BY_TYPE[customerType].map((code) => (
                <SelectItem key={code} value={code} data-testid={`option-sector-${code}`}>
                  {SECTOR_TARIFFS[code].label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            {sector === 'auto'
              ? 'Tariff derived automatically. Pick a specific sector to override.'
              : SECTOR_TARIFFS[sector as SectorCode]?.notes ?? `Using ${SECTOR_TARIFFS[sector as SectorCode]?.pricingModel} pricing.`}
          </p>
        </div>

        {/* Grid Connection Selection */}
        <div className="space-y-2">
          <Label htmlFor="grid-connection" className="text-sm font-medium">
            Grid Connection Method
          </Label>
          <Select 
            value={gridConnection} 
            onValueChange={(value: GridConnection) => onGridConnectionChange(value)}
            data-testid="select-grid-connection"
          >
            <SelectTrigger id="grid-connection">
              <SelectValue placeholder="Select grid connection">
                {gridConnection}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {GRID_CONNECTION_METHODS.map((method) => (
                <SelectItem key={method} value={method} data-testid={`option-grid-${method.toLowerCase().replace(/\s+/g, '-')}`}>
                  <div className="flex items-center justify-between w-full">
                    <span>{method}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Current Configuration Badge */}
        <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg mt-4">
          <div className="text-sm">
            <span className="font-medium text-muted-foreground">Active Configuration:</span>
            <div className="flex items-center gap-2 mt-1">
              {getCustomerIcon(customerType)}
              <span className="font-semibold text-primary">{customerType}</span>
              <span className="text-muted-foreground">•</span>
              <span className="text-foreground">{gridConnection}</span>
            </div>
          </div>
        </div>

      </CardContent>
    </Card>
  );
}