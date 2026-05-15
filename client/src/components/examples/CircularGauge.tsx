import CircularGauge from '../CircularGauge';

export default function CircularGaugeExample() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 p-6">
      <CircularGauge
        title="Power Generation" 
        value={750}
        max={1000}
        unit="kWh"
        color="hsl(var(--chart-1))"
      />
      <CircularGauge
        title="System Efficiency"
        value={95}
        max={100}
        unit="%"
        color="hsl(var(--chart-2))"
      />
      <CircularGauge
        title="Annual Savings"
        value={3200}
        max={5000}
        unit="JD"
        color="hsl(var(--chart-3))"
      />
    </div>
  );
}