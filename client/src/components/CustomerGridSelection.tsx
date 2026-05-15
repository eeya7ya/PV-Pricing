import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Building2, Zap, Users, Hotel, Hospital, Wheat } from 'lucide-react';
import { CUSTOMER_TYPES, GRID_CONNECTION_METHODS, CustomerType, GridConnection } from '@shared/schema';

interface CustomerGridSelectionProps {
  customerType: CustomerType;
  gridConnection: GridConnection;
  onCustomerTypeChange: (customerType: CustomerType) => void;
  onGridConnectionChange: (gridConnection: GridConnection) => void;
}

export default function CustomerGridSelection({
  customerType,
  gridConnection,
  onCustomerTypeChange,
  onGridConnectionChange
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