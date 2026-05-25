import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, DollarSign, BarChart3 } from 'lucide-react';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';
import type { CalculationResults } from '@shared/schema';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

interface DashboardProps {
  results?: CalculationResults;
  className?: string;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// Muted slate that stays readable on both light and dark backgrounds.
const AXIS = 'rgb(148, 163, 184)';
const GRID = 'rgba(148, 163, 184, 0.15)';

export default function Dashboard({ results, className = '' }: DashboardProps) {
  const generationChartData = {
    labels: MONTHS,
    datasets: [
      {
        label: 'Generation (kWh)',
        data: results ? results.monthly_data.map((d) => d.generation) : Array(12).fill(0),
        borderColor: 'rgb(245, 158, 11)',
        backgroundColor: 'rgba(245, 158, 11, 0.15)',
        fill: true,
        tension: 0.4,
        pointRadius: 2,
      },
    ],
  };

  const costComparisonData = {
    labels: MONTHS,
    datasets: [
      {
        label: 'Before Solar (JD)',
        data: results ? results.monthly_data.map((d) => d.bill_before) : Array(12).fill(0),
        borderColor: 'rgb(239, 68, 68)',
        backgroundColor: 'rgba(239, 68, 68, 0.12)',
        fill: true,
        tension: 0.4,
        pointRadius: 2,
      },
      {
        label: 'After Solar (JD)',
        data: results ? results.monthly_data.map((d) => d.bill_after) : Array(12).fill(0),
        borderColor: 'rgb(34, 197, 94)',
        backgroundColor: 'rgba(34, 197, 94, 0.12)',
        fill: true,
        tension: 0.4,
        pointRadius: 2,
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: 'top' as const, labels: { color: AXIS, boxWidth: 12, usePointStyle: true } },
    },
    scales: {
      x: { ticks: { color: AXIS }, grid: { color: GRID } },
      y: { beginAtZero: true, ticks: { color: AXIS }, grid: { color: GRID } },
    },
  };

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Monthly trend charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <TrendingUp className="h-4 w-4 text-orange-400" />
              Monthly Generation
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64" data-testid="chart-generation">
              <Line data={generationChartData} options={chartOptions} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <DollarSign className="h-4 w-4 text-orange-400" />
              Bill Comparison
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64" data-testid="chart-cost-comparison">
              <Line data={costComparisonData} options={chartOptions} />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Industrial Buy-All Sell-All period details (industrial only) */}
      {results && results.monthly_data[0] && results.monthly_data[0].period_details && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <BarChart3 className="h-4 w-4 text-orange-400" />
              Industrial Period Breakdown
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="text-sm text-muted-foreground">
                Period-based tariff calculation details (X2 approximation method)
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-muted-foreground">
                      <th className="text-left p-2 font-medium">Month</th>
                      <th className="text-right p-2 font-medium">Consumption (kWh)</th>
                      <th className="text-left p-2 font-medium">Period Breakdown</th>
                      <th className="text-right p-2 font-medium">Import Cost (JD)</th>
                      <th className="text-right p-2 font-medium">Generation (kWh)</th>
                      <th className="text-right p-2 font-medium">Net Cost (JD)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {results.monthly_data.slice(0, 6).map((month, index) => (
                      <tr key={index} className="border-b last:border-0">
                        <td className="p-2 font-medium">{month.month}</td>
                        <td className="p-2 text-right">{month.consumption.toFixed(0)}</td>
                        <td className="p-2 text-xs text-muted-foreground">{month.period_details || 'N/A'}</td>
                        <td className="p-2 text-right">{(month.import_cost || 0).toFixed(2)}</td>
                        <td className="p-2 text-right">{month.generation.toFixed(0)}</td>
                        <td className="p-2 text-right font-medium">{month.bill_after.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {results.monthly_data.length > 6 && (
                <div className="text-center">
                  <Badge variant="secondary" className="text-xs">
                    Showing first 6 months. Pattern repeats for remaining months.
                  </Badge>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
