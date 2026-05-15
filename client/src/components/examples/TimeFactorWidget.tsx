import { useState } from 'react';
import TimeFactorWidget from '../TimeFactorWidget';
import { DEFAULT_TIME_FACTORS, type TimeFactors } from '@shared/schema';

export default function TimeFactorWidgetExample() {
  const [dayFactors, setDayFactors] = useState<TimeFactors>(DEFAULT_TIME_FACTORS.DAY_FACTORS);
  const [eveningFactors, setEveningFactors] = useState<TimeFactors>(DEFAULT_TIME_FACTORS.EVENING_FACTORS);
  
  return (
    <div className="space-y-6 p-6 max-w-4xl">
      <TimeFactorWidget
        title="Day Time (5-17) Factors"
        description="Percentage of consumption during day hours for each month"
        defaultValue={30}
        factors={dayFactors}
        onChange={setDayFactors}
        color="chart-1"
      />
      
      <TimeFactorWidget
        title="Evening Time (17-23) Factors"
        description="Percentage of consumption during evening hours for each month"
        defaultValue={30}
        factors={eveningFactors}
        onChange={setEveningFactors}
        color="chart-2"
      />
    </div>
  );
}