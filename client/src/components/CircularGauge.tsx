import { Card, CardContent } from '@/components/ui/card';

interface CircularGaugeProps {
  title: string;
  value: number;
  min?: number;
  max: number;
  unit: string;
  variant?: 'chart-1' | 'chart-2' | 'chart-3' | 'primary';
  size?: number;
  thickness?: number;
  className?: string;
}

export default function CircularGauge({ 
  title, 
  value, 
  min = 0, 
  max, 
  unit, 
  variant = 'chart-1',
  size = 160,
  thickness = 12,
  className = "" 
}: CircularGaugeProps) {
  
  // Calculate percentage and clamp to valid range
  const normalizedValue = Math.max(min, Math.min(max, value));
  const percentage = max === min ? 0 : Math.max(0, Math.min(1, (normalizedValue - min) / (max - min)));
  
  // SVG circle calculations
  const center = size / 2;
  const radius = center - thickness / 2 - 8;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference * (1 - percentage);
  
  return (
    <Card className={`hover-elevate ${className}`}>
      <CardContent className="p-6 flex flex-col items-center">
        <h3 className="text-sm font-medium text-muted-foreground mb-4 text-center">
          {title}
        </h3>
        
        <div className="relative inline-block">
          {/* SVG Progress Ring */}
          <svg
            width={size}
            height={size}
            className="transform -rotate-90"
            data-testid={`gauge-${title.toLowerCase().replace(/\s+/g, '-')}`}
          >
            {/* Background Track */}
            <circle
              cx={center}
              cy={center}
              r={radius}
              stroke="hsl(var(--muted) / 0.2)"
              strokeWidth={thickness}
              fill="none"
              className="transition-all duration-300"
            />
            
            {/* Progress Circle */}
            <circle
              cx={center}
              cy={center}
              r={radius}
              stroke={`hsl(var(--${variant}))`}
              strokeWidth={thickness}
              fill="none"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              className="transition-all duration-700 ease-out"
              style={{ 
                filter: `drop-shadow(0 0 8px hsl(var(--${variant}) / 0.3))` 
              }}
            />
          </svg>
          
          {/* Center Content */}
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <div className="text-2xl font-bold text-card-foreground">
              {normalizedValue.toFixed(value >= 100 ? 0 : 1)}
            </div>
            <div className="text-xs text-muted-foreground">
              {unit}
            </div>
          </div>
        </div>
        
        {/* Progress Percentage */}
        <div className="text-xs text-muted-foreground mt-2">
          {(percentage * 100).toFixed(0)}%
        </div>
      </CardContent>
    </Card>
  );
}