import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import type { TimeFactors } from '@shared/schema';

interface TimeFactorWidgetProps {
  title: string;
  description?: string;
  defaultValue: number;
  factors: TimeFactors;
  onChange: (factors: TimeFactors) => void;
  color?: string;
  className?: string;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const;

export default function TimeFactorWidget({ 
  title, 
  description,
  defaultValue, 
  factors, 
  onChange,
  color = "primary",
  className = "" 
}: TimeFactorWidgetProps) {
  const [setAllValue, setSetAllValue] = useState(defaultValue);
  
  const handleApplyToAll = () => {
    const newFactors = {} as TimeFactors;
    MONTHS.forEach(month => {
      newFactors[month] = setAllValue / 100;
    });
    onChange(newFactors);
    console.log(`Applied ${setAllValue}% to all months for ${title}`);
  };
  
  const handleMonthChange = (month: keyof TimeFactors, value: number) => {
    const newFactors = { ...factors };
    newFactors[month] = value / 100; // Convert percentage to decimal
    onChange(newFactors);
    console.log(`Updated ${month} to ${value}% for ${title}`);
  };
  
  return (
    <Card className={`${className}`}>
      <CardHeader className="pb-4">
        <CardTitle className="text-lg flex items-center gap-2">
          <Badge variant="outline" className={`text-${color}`}>
            {title}
          </Badge>
        </CardTitle>
        {description && (
          <p className="text-sm text-muted-foreground">{description}</p>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Set All Controls */}
        <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg">
          <Label htmlFor={`set-all-${title}`} className="text-sm font-medium">
            Set all to:
          </Label>
          <Input
            id={`set-all-${title}`}
            type="number"
            min="0"
            max="100"
            value={setAllValue}
            onChange={(e) => setSetAllValue(Number(e.target.value))}
            className="w-20"
            data-testid={`input-set-all-${title.toLowerCase().replace(/\s+/g, '-')}`}
          />
          <span className="text-sm text-muted-foreground">%</span>
          <Button
            onClick={handleApplyToAll}
            size="sm"
            data-testid={`button-apply-all-${title.toLowerCase().replace(/\s+/g, '-')}`}
          >
            Apply for all
          </Button>
        </div>
        
        {/* Monthly Inputs Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
          {MONTHS.map((month) => (
            <div key={month} className="space-y-1">
              <Label htmlFor={`${title}-${month}`} className="text-xs font-medium">
                {month}:
              </Label>
              <div className="relative">
                <Input
                  id={`${title}-${month}`}
                  type="number"
                  min="0"
                  max="100"
                  value={Math.round(factors[month] * 100)}
                  onChange={(e) => handleMonthChange(month, Number(e.target.value))}
                  className="text-sm pr-8"
                  data-testid={`input-factor-${title.toLowerCase().replace(/\s+/g, '-')}-${month.toLowerCase()}`}
                />
                <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none">
                  %
                </span>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}