import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { MonthlyConsumption } from '@shared/schema';

interface MonthlyConsumptionInputsProps {
  consumption: MonthlyConsumption;
  onChange: (consumption: MonthlyConsumption) => void;
  className?: string;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const;

export default function MonthlyConsumptionInputs({ 
  consumption, 
  onChange, 
  className = "" 
}: MonthlyConsumptionInputsProps) {
  
  const handleMonthChange = (month: keyof MonthlyConsumption, value: number) => {
    const newConsumption = { ...consumption };
    newConsumption[month] = value;
    onChange(newConsumption);
    console.log(`Updated ${month} consumption to ${value} kWh`);
  };
  
  const totalAnnual = Object.values(consumption).reduce((sum, val) => sum + val, 0);
  const monthlyAverage = totalAnnual / 12;
  
  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Monthly Energy Consumption</span>
          <div className="text-sm font-normal text-muted-foreground">
            Total: <span className="font-medium text-foreground">{totalAnnual.toFixed(0)} kWh/year</span>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {MONTHS.map((month) => (
            <div key={month} className="space-y-2">
              <Label htmlFor={`consumption-${month}`} className="text-sm font-medium">
                {month}:
              </Label>
              <div className="relative">
                <Input
                  id={`consumption-${month}`}
                  type="number"
                  min="0"
                  max="10000"
                  value={consumption[month]}
                  onChange={(e) => handleMonthChange(month, Number(e.target.value))}
                  className="pr-12"
                  data-testid={`input-consumption-${month.toLowerCase()}`}
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none">
                  kWh
                </span>
              </div>
            </div>
          ))}
        </div>
        
        <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg text-sm">
          <span className="text-muted-foreground">Monthly Average:</span>
          <span className="font-medium" data-testid="text-monthly-average">
            {monthlyAverage.toFixed(1)} kWh
          </span>
        </div>
      </CardContent>
    </Card>
  );
}