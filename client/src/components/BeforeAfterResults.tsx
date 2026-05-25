import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  TrendingUp,
  TrendingDown,
  Zap,
  DollarSign,
  Calendar,
  BarChart3,
  PiggyBank,
  Lightbulb,
  ArrowRight,
  CheckCircle,
  Sun,
  Home,
  Building2,
  CreditCard,
  Banknote,
} from 'lucide-react';
import type { CalculationResults } from '@shared/schema';

interface BeforeAfterResultsProps {
  results: CalculationResults;
  customerType: string;
  totalConsumption: number;
}

export default function BeforeAfterResults({ 
  results, 
  customerType,
  totalConsumption 
}: BeforeAfterResultsProps) {
  const { annual_summary, monthly_data, net_billing_enabled } = results;
  
  // Calculate key metrics
  const roiPercentage = annual_summary.cost_before > 0 ?
    (annual_summary.annual_savings / annual_summary.cost_before) * 100 : 0;

  const selfConsumptionPercentage = annual_summary.annual_generation > 0 ?
    (annual_summary.total_self_consumption / annual_summary.annual_generation) * 100 : 0;

  // Best performance = the month that saves the most money.
  const bestMonth = [...monthly_data].sort((a, b) => b.savings - a.savings)[0];
  // Peak month = the month with the highest pre-solar bill (highest demand),
  // so the before→after contrast is meaningful (sorting by the after-bill is
  // useless once net-billing flattens most months to the minimum bill).
  const peakMonth = [...monthly_data].sort((a, b) => b.bill_before - a.bill_before)[0];

  // Calculate total credits generated and used (if net billing enabled)
  const totalCreditsGenerated = net_billing_enabled ? 
    monthly_data.reduce((sum, month) => sum + (month.monthly_credit_generated || 0), 0) : 0;
  const totalCreditsUsed = net_billing_enabled ?
    monthly_data.reduce((sum, month) => sum + (month.monthly_credit_used || 0), 0) : 0;

  return (
    <div className="space-y-6">
      {/* Header Section */}
      <div className="flex items-center gap-3 flex-wrap">
        <BarChart3 className="h-6 w-6 text-primary" />
        <h2 className="text-2xl font-semibold">System Performance Results</h2>
        <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
          {customerType} + PV System
        </Badge>
      </div>

      {/* Key Performance Indicators */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20 border-green-200">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-green-700 dark:text-green-200">Annual Savings</p>
                <p className="text-2xl font-bold text-green-900 dark:text-green-100" data-testid="result-annual-savings">
                  {annual_summary.annual_savings.toFixed(0)} JD
                </p>
              </div>
              <PiggyBank className="h-8 w-8 text-green-600" />
            </div>
            <div className="mt-2">
              <Badge variant="secondary" className="text-xs">
                {roiPercentage.toFixed(0)}% lower bills
              </Badge>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 border-blue-200">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-blue-700 dark:text-blue-200">System Size</p>
                <p className="text-2xl font-bold text-blue-900 dark:text-blue-100" data-testid="result-system-size">
                  {annual_summary.pv_size.toFixed(1)} kWh/month
                </p>
              </div>
              <Sun className="h-8 w-8 text-blue-600" />
            </div>
            <div className="mt-2">
              <Badge variant="secondary" className="text-xs">
                {annual_summary.inverter_size.toFixed(1)} kW Inverter
              </Badge>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-900/20 dark:to-orange-800/20 border-orange-200">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-orange-700 dark:text-orange-200">Self Consumption</p>
                <p className="text-2xl font-bold text-orange-900 dark:text-orange-100" data-testid="result-self-consumption">
                  {selfConsumptionPercentage.toFixed(1)}%
                </p>
              </div>
              <Lightbulb className="h-8 w-8 text-orange-600" />
            </div>
            <div className="mt-2">
              <Badge variant="secondary" className="text-xs">
                {annual_summary.total_self_consumption.toFixed(0)} kWh/year
              </Badge>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-800/20 border-purple-200">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-purple-700 dark:text-purple-200">Export Revenue</p>
                <p className="text-2xl font-bold text-purple-900 dark:text-purple-100" data-testid="result-export-revenue">
                  {annual_summary.export_revenue.toFixed(0)} JD
                </p>
              </div>
              <TrendingUp className="h-8 w-8 text-purple-600" />
            </div>
            <div className="mt-2">
              <Badge variant="secondary" className="text-xs">
                {annual_summary.total_export.toFixed(0)} kWh exported
              </Badge>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Before vs After Comparison */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Before vs After Solar PV System
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Before Solar */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                <h3 className="font-semibold text-red-700 dark:text-red-300">Before Solar</h3>
              </div>
              <div className="space-y-3">
                <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200">
                  <div className="text-sm text-red-600 dark:text-red-300">Annual Electricity Cost</div>
                  <div className="text-2xl font-bold text-red-800 dark:text-red-200" data-testid="cost-before">
                    {annual_summary.cost_before.toFixed(0)} JD
                  </div>
                </div>
                <div className="text-sm text-muted-foreground space-y-1">
                  <div>Monthly Average: {(annual_summary.cost_before / 12).toFixed(0)} JD</div>
                  <div>Total Consumption: {totalConsumption.toFixed(0)} kWh/year</div>
                  <div>No renewable energy generation</div>
                  <div>100% grid dependency</div>
                </div>
              </div>
            </div>

            {/* Arrow */}
            <div className="flex items-center justify-center">
              <div className="flex flex-col items-center gap-2">
                <ArrowRight className="h-8 w-8 text-primary" />
                <Badge variant="outline" className="text-xs">
                  Solar PV Installation
                </Badge>
              </div>
            </div>

            {/* After Solar */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                <h3 className="font-semibold text-green-700 dark:text-green-300">After Solar</h3>
              </div>
              <div className="space-y-3">
                <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200">
                  <div className="text-sm text-green-600 dark:text-green-300">Annual Electricity Cost</div>
                  <div className="text-2xl font-bold text-green-800 dark:text-green-200" data-testid="cost-after">
                    {annual_summary.cost_after.toFixed(0)} JD
                  </div>
                </div>
                <div className="text-sm text-muted-foreground space-y-1">
                  <div>Monthly Average: {(annual_summary.cost_after / 12).toFixed(0)} JD</div>
                  <div>PV Generation: {annual_summary.annual_generation.toFixed(0)} kWh/year</div>
                  <div>Self Consumption: {selfConsumptionPercentage.toFixed(1)}%</div>
                  <div>Grid Export: {annual_summary.total_export.toFixed(0)} kWh</div>
                </div>
              </div>
            </div>
          </div>

          {/* Savings Progress Bar */}
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium">Cost Reduction</span>
              <span className="text-sm text-muted-foreground">
                {roiPercentage.toFixed(1)}% savings
              </span>
            </div>
            <Progress value={roiPercentage} className="h-3" />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>0% savings</span>
              <span className="font-medium text-green-600">
                {annual_summary.annual_savings.toFixed(0)} JD saved annually
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Net Billing Section (if enabled) */}
      {net_billing_enabled && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              Net Billing System Benefits
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                <div className="flex items-center gap-2">
                  <Banknote className="h-4 w-4 text-blue-600" />
                  <span className="text-sm font-medium text-blue-700 dark:text-blue-300">Credits Generated</span>
                </div>
                <div className="text-2xl font-bold text-blue-900 dark:text-blue-100">
                  {totalCreditsGenerated.toFixed(0)} JD
                </div>
              </div>
              
              <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <span className="text-sm font-medium text-green-700 dark:text-green-300">Credits Used</span>
                </div>
                <div className="text-2xl font-bold text-green-900 dark:text-green-100">
                  {totalCreditsUsed.toFixed(0)} JD
                </div>
              </div>
              
              <div className="p-4 bg-orange-50 dark:bg-orange-900/20 rounded-lg">
                <div className="flex items-center gap-2">
                  <PiggyBank className="h-4 w-4 text-orange-600" />
                  <span className="text-sm font-medium text-orange-700 dark:text-orange-300">Final Balance</span>
                </div>
                <div className="text-2xl font-bold text-orange-900 dark:text-orange-100">
                  {(annual_summary.final_credit_balance || 0).toFixed(0)} JD
                </div>
              </div>
            </div>
            
            {(annual_summary.net_billing_savings ?? 0) > 0 && (
              <div className="p-4 bg-gradient-to-r from-green-50 to-blue-50 dark:from-green-900/20 dark:to-blue-900/20 rounded-lg border">
                <div className="flex items-center gap-3">
                  <TrendingUp className="h-5 w-5 text-green-600" />
                  <div>
                    <div className="font-semibold text-green-700 dark:text-green-300">
                      Additional Net Billing Savings: {(annual_summary.net_billing_savings ?? 0).toFixed(0)} JD
                    </div>
                    <div className="text-sm text-muted-foreground">
                      Total savings with net billing: {(annual_summary.total_savings_with_net_billing || annual_summary.annual_savings).toFixed(0)} JD
                    </div>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Monthly Performance Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Monthly Performance Highlights
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <h4 className="font-semibold text-muted-foreground">Best Performance Month</h4>
              <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200">
                <div className="flex justify-between items-center">
                  <span className="font-medium">{bestMonth.month}</span>
                  <Badge variant="secondary" className="bg-green-100 text-green-800">
                    Top Savings
                  </Badge>
                </div>
                <div className="mt-2 space-y-1 text-sm">
                  <div>Savings: {bestMonth.savings.toFixed(0)} JD</div>
                  <div>Bill after solar: {bestMonth.bill_after.toFixed(0)} JD</div>
                  <div>Self consumption: {bestMonth.self_consumption.toFixed(0)} kWh</div>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <h4 className="font-semibold text-muted-foreground">Highest Bill Month</h4>
              <div className="p-4 bg-orange-50 dark:bg-orange-900/20 rounded-lg border border-orange-200">
                <div className="flex justify-between items-center">
                  <span className="font-medium">{peakMonth.month}</span>
                  <Badge variant="secondary" className="bg-orange-100 text-orange-800">
                    Peak Demand
                  </Badge>
                </div>
                <div className="mt-2 space-y-1 text-sm">
                  <div>Bill before solar: {peakMonth.bill_before.toFixed(0)} JD</div>
                  <div>Bill after solar: {peakMonth.bill_after.toFixed(0)} JD</div>
                  <div>Consumption: {peakMonth.consumption.toFixed(0)} kWh</div>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* System Configuration Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {customerType === 'Industrial' ? <Building2 className="h-5 w-5" /> : <Home className="h-5 w-5" />}
            System Configuration Summary
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div className="space-y-1">
              <div className="text-muted-foreground">Customer Type</div>
              <div className="font-medium">{customerType}</div>
            </div>
            <div className="space-y-1">
              <div className="text-muted-foreground">System Efficiency</div>
              <div className="font-medium">{(annual_summary.efficiency * 100).toFixed(0)}%</div>
            </div>
            <div className="space-y-1">
              <div className="text-muted-foreground">Export Tariff</div>
              <div className="font-medium">{annual_summary.export_tariff.toFixed(3)} JD/kWh</div>
            </div>
            <div className="space-y-1">
              <div className="text-muted-foreground">Net Billing</div>
              <div className="font-medium">{net_billing_enabled ? 'Enabled' : 'Disabled'}</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}