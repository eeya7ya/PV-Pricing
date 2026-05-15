import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, Zap, DollarSign, Calendar, BarChart3 } from 'lucide-react';
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
} from 'chart.js';
import type { CalculationResults } from '@shared/schema';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

interface DashboardProps {
  results?: CalculationResults;
  className?: string;
}

export default function Dashboard({ results, className = "" }: DashboardProps) {
  
  // KPI Cards
  const kpis = [
    {
      title: "Total Generation",
      value: results?.annual_summary.annual_generation || 0,
      unit: "kWh",
      icon: <Zap className="h-5 w-5" />,
      color: "chart-1",
      testId: "kpi-generation"
    },
    {
      title: "Annual Savings", 
      value: results?.annual_summary.annual_savings || 0,
      unit: "JD",
      icon: <DollarSign className="h-5 w-5" />,
      color: "chart-2",
      testId: "kpi-savings"
    },
    {
      title: "System Size",
      value: results?.annual_summary.pv_size || 0,
      unit: "kWh/month",
      icon: <BarChart3 className="h-5 w-5" />,
      color: "chart-3",
      testId: "kpi-system-size"
    },
    {
      title: "Payback Period",
      value: results ? (5000 / (results.annual_summary.annual_savings || 1)) : 0, // Simplified calculation
      unit: "years",
      icon: <Calendar className="h-5 w-5" />,
      color: "chart-4",
      testId: "kpi-payback"
    }
  ];

  // Chart data preparation
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  
  const generationChartData = {
    labels: months,
    datasets: [
      {
        label: 'Monthly Generation',
        data: results ? results.monthly_data.map(d => d.generation) : Array(12).fill(0),
        borderColor: 'hsl(var(--chart-1))',
        backgroundColor: 'hsl(var(--chart-1) / 0.2)',
        tension: 0.4,
      },
    ],
  };

  const costComparisonData = {
    labels: months,
    datasets: [
      {
        label: 'Before Solar PV',
        data: results ? results.monthly_data.map(d => d.bill_before) : Array(12).fill(0),
        borderColor: 'hsl(var(--destructive))',
        backgroundColor: 'hsl(var(--destructive) / 0.2)',
        tension: 0.4,
        fill: false,
      },
      {
        label: 'After Solar PV',
        data: results ? results.monthly_data.map(d => d.bill_after) : Array(12).fill(0),
        borderColor: 'hsl(var(--chart-2))',
        backgroundColor: 'hsl(var(--chart-2) / 0.2)',
        tension: 0.4,
        fill: false,
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    plugins: {
      legend: {
        position: 'top' as const,
      },
    },
    scales: {
      y: {
        beginAtZero: true,
      },
    },
  };

  return (
    <div className={`space-y-6 ${className}`}>
      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {kpis.map((kpi) => (
          <Card key={kpi.title} className="hover-elevate">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {kpi.title}
              </CardTitle>
              <div className={`text-${kpi.color}`}>
                {kpi.icon}
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid={kpi.testId}>
                {kpi.value.toFixed(kpi.unit === 'years' ? 1 : 0)}
              </div>
              <p className="text-xs text-muted-foreground">
                {kpi.unit}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Generation Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Monthly Generation
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64" data-testid="chart-generation">
              <Line data={generationChartData} options={chartOptions} />
            </div>
          </CardContent>
        </Card>

        {/* Cost Comparison Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5" />
              Cost Comparison
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64" data-testid="chart-cost-comparison">
              <Line data={costComparisonData} options={chartOptions} />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Results Summary */}
      {results && (
        <Card>
          <CardHeader>
            <CardTitle>Calculation Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <div className="text-sm text-muted-foreground">System Performance</div>
                <div className="space-y-1">
                  <div className="flex justify-between">
                    <span>Self Consumption:</span>
                    <Badge variant="outline" data-testid="text-self-consumption">
                      {results.annual_summary.total_self_consumption.toFixed(0)} kWh
                    </Badge>
                  </div>
                  <div className="flex justify-between">
                    <span>Export to Grid:</span>
                    <Badge variant="outline" data-testid="text-export">
                      {results.annual_summary.total_export.toFixed(0)} kWh
                    </Badge>
                  </div>
                </div>
              </div>
              
              <div className="space-y-2">
                <div className="text-sm text-muted-foreground">Financial Impact</div>
                <div className="space-y-1">
                  <div className="flex justify-between">
                    <span>Cost Before:</span>
                    <Badge variant="outline" data-testid="text-cost-before">
                      {results.annual_summary.cost_before.toFixed(0)} JD
                    </Badge>
                  </div>
                  <div className="flex justify-between">
                    <span>Cost After:</span>
                    <Badge variant="outline" data-testid="text-cost-after">
                      {results.annual_summary.cost_after.toFixed(0)} JD
                    </Badge>
                  </div>
                </div>
              </div>
              
              <div className="space-y-2">
                <div className="text-sm text-muted-foreground">Revenue</div>
                <div className="space-y-1">
                  <div className="flex justify-between">
                    <span>Export Revenue:</span>
                    <Badge variant="outline" data-testid="text-export-revenue">
                      {results.annual_summary.export_revenue.toFixed(0)} JD
                    </Badge>
                  </div>
                  <div className="flex justify-between">
                    <span>Export Tariff:</span>
                    <Badge variant="outline" data-testid="text-export-tariff">
                      {results.annual_summary.export_tariff.toFixed(3)} JD/kWh
                    </Badge>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Industrial Buy-All Sell-All Period Details */}
      {results && results.monthly_data[0] && results.monthly_data[0].period_details && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Industrial Period Breakdown
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="text-sm text-muted-foreground mb-4">
                Period-based tariff calculation details (X2 Approximation method)
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left p-2">Month</th>
                      <th className="text-right p-2">Consumption (kWh)</th>
                      <th className="text-left p-2">Period Breakdown</th>
                      <th className="text-right p-2">Import Cost (JD)</th>
                      <th className="text-right p-2">Generation (kWh)</th>
                      <th className="text-right p-2">NET Cost (JD)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {results.monthly_data.slice(0, 6).map((month, index) => (
                      <tr key={index} className="border-b">
                        <td className="p-2 font-medium">{month.month}</td>
                        <td className="p-2 text-right">{month.consumption.toFixed(0)}</td>
                        <td className="p-2 text-xs text-muted-foreground">
                          {month.period_details || 'N/A'}
                        </td>
                        <td className="p-2 text-right">{(month.import_cost || 0).toFixed(2)}</td>
                        <td className="p-2 text-right">{month.generation.toFixed(0)}</td>
                        <td className="p-2 text-right font-medium">
                          {month.bill_after.toFixed(2)}
                        </td>
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