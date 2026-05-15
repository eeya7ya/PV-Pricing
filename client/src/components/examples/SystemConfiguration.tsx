import { useState } from 'react';
import SystemConfiguration from '../SystemConfiguration';

export default function SystemConfigurationExample() {
  const [efficiency, setEfficiency] = useState(95);
  const [degradation, setDegradation] = useState(0.5);
  const [tariffSupported, setTariffSupported] = useState(true);
  const [exportTariff, setExportTariff] = useState(0.05);
  
  return (
    <div className="p-6 max-w-4xl">
      <SystemConfiguration
        efficiency={efficiency}
        degradation={degradation}
        tariffSupported={tariffSupported}
        exportTariff={exportTariff}
        pvSize={416.67} // Example calculated value
        inverterSize={3.36} // Example calculated value
        onEfficiencyChange={setEfficiency}
        onDegradationChange={setDegradation}
        onTariffSupportedChange={setTariffSupported}
        onExportTariffChange={setExportTariff}
      />
    </div>
  );
}