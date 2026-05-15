import { useState } from 'react';
import MonthlyConsumptionInputs from '../MonthlyConsumptionInputs';
import { DEFAULT_CONSUMPTION, type MonthlyConsumption } from '@shared/schema';

export default function MonthlyConsumptionInputsExample() {
  const [consumption, setConsumption] = useState<MonthlyConsumption>(DEFAULT_CONSUMPTION);
  
  return (
    <div className="p-6 max-w-4xl">
      <MonthlyConsumptionInputs
        consumption={consumption}
        onChange={setConsumption}
      />
    </div>
  );
}