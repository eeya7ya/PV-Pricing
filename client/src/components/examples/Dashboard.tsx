import Dashboard from '../Dashboard';
import type { CalculationResults } from '@shared/schema';

// Mock calculation results for demo
const mockResults: CalculationResults = {
  monthly_data: [
    { month: 'Jan', consumption: 500, generation: 416.67, generation_day: 416.67, generation_evening: 83.33, generation_night: 0, self_consumption: 350, export: 66.67, import: 150, bill_before: 55, bill_after: 18, savings: 37, export_revenue: 3.33 },
    { month: 'Feb', consumption: 500, generation: 416.67, generation_day: 416.67, generation_evening: 83.33, generation_night: 0, self_consumption: 350, export: 66.67, import: 150, bill_before: 55, bill_after: 18, savings: 37, export_revenue: 3.33 },
    { month: 'Mar', consumption: 500, generation: 416.67, generation_day: 416.67, generation_evening: 83.33, generation_night: 0, self_consumption: 350, export: 66.67, import: 150, bill_before: 55, bill_after: 18, savings: 37, export_revenue: 3.33 },
    { month: 'Apr', consumption: 500, generation: 416.67, generation_day: 416.67, generation_evening: 83.33, generation_night: 0, self_consumption: 350, export: 66.67, import: 150, bill_before: 55, bill_after: 18, savings: 37, export_revenue: 3.33 },
    { month: 'May', consumption: 500, generation: 416.67, generation_day: 416.67, generation_evening: 83.33, generation_night: 0, self_consumption: 350, export: 66.67, import: 150, bill_before: 55, bill_after: 18, savings: 37, export_revenue: 3.33 },
    { month: 'Jun', consumption: 500, generation: 416.67, generation_day: 416.67, generation_evening: 83.33, generation_night: 0, self_consumption: 350, export: 66.67, import: 150, bill_before: 55, bill_after: 18, savings: 37, export_revenue: 3.33 },
    { month: 'Jul', consumption: 500, generation: 416.67, generation_day: 416.67, generation_evening: 83.33, generation_night: 0, self_consumption: 350, export: 66.67, import: 150, bill_before: 55, bill_after: 18, savings: 37, export_revenue: 3.33 },
    { month: 'Aug', consumption: 500, generation: 416.67, generation_day: 416.67, generation_evening: 83.33, generation_night: 0, self_consumption: 350, export: 66.67, import: 150, bill_before: 55, bill_after: 18, savings: 37, export_revenue: 3.33 },
    { month: 'Sep', consumption: 500, generation: 416.67, generation_day: 416.67, generation_evening: 83.33, generation_night: 0, self_consumption: 350, export: 66.67, import: 150, bill_before: 55, bill_after: 18, savings: 37, export_revenue: 3.33 },
    { month: 'Oct', consumption: 500, generation: 416.67, generation_day: 416.67, generation_evening: 83.33, generation_night: 0, self_consumption: 350, export: 66.67, import: 150, bill_before: 55, bill_after: 18, savings: 37, export_revenue: 3.33 },
    { month: 'Nov', consumption: 500, generation: 416.67, generation_day: 416.67, generation_evening: 83.33, generation_night: 0, self_consumption: 350, export: 66.67, import: 150, bill_before: 55, bill_after: 18, savings: 37, export_revenue: 3.33 },
    { month: 'Dec', consumption: 500, generation: 416.67, generation_day: 416.67, generation_evening: 83.33, generation_night: 0, self_consumption: 350, export: 66.67, import: 150, bill_before: 55, bill_after: 18, savings: 37, export_revenue: 3.33 }
  ],
  annual_summary: {
    total_consumption: 6000,
    pv_size: 416.67,
    inverter_size: 3.36,
    annual_generation: 5000,
    total_self_consumption: 4200,
    total_export: 800,
    cost_before: 660,
    cost_after: 216,
    annual_savings: 444,
    export_revenue: 40,
    efficiency: 0.95,
    export_tariff: 0.05
  }
};

export default function DashboardExample() {
  return (
    <div className="p-6">
      <Dashboard results={mockResults} />
    </div>
  );
}