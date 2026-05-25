import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  BarChart3,
  ArrowUpDown,
  Calendar,
  Sun,
  Home,
  PiggyBank
} from 'lucide-react';
import type { CalculationResults } from '@shared/schema';

interface ComparisonSectionProps {
  results: CalculationResults | null;
  customerType: string;
}

export default function ComparisonSection({ results, customerType }: ComparisonSectionProps) {
  if (!results) {
    return (
      <div className="text-center py-12">
        <h2 className="text-2xl font-semibold mb-4">System Comparison</h2>
        <p className="text-muted-foreground">
          Configure your system parameters and click "Calculate System" to view the detailed
          before/after comparison for the current case.
        </p>
      </div>
    );
  }

  const { annual_summary, monthly_data, net_billing_enabled } = results;

  // Calculate additional metrics
  const totalConsumption = monthly_data.reduce((sum, month) => sum + month.consumption, 0);
  const totalGeneration = monthly_data.reduce((sum, month) => sum + month.generation, 0);
  const totalSelfConsumption = monthly_data.reduce((sum, month) => sum + month.self_consumption, 0);
  const totalExport = monthly_data.reduce((sum, month) => sum + month.export, 0);
  const totalImport = monthly_data.reduce((sum, month) => sum + month.import, 0);

  const selfConsumptionRate = totalGeneration > 0 ? (totalSelfConsumption / totalGeneration) * 100 : 0;

  return (
    <div className="space-y-6">
      {/* Header Section */}
      <div className="flex items-center gap-3 flex-wrap">
        <ArrowUpDown className="h-6 w-6 text-primary" />
        <h2 className="text-2xl font-semibold">Current Case — Before vs After</h2>
        <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
          {customerType} Analysis
        </Badge>
      </div>

      <div className="space-y-6">
          {/* Current Study Case Content */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Monthly Performance Table
              </CardTitle>
            </CardHeader>
            <CardContent>
              {/* Before PV Installation Table */}
              <div className="mb-8">
                <h3 className="text-lg font-semibold mb-4 text-red-700 flex items-center gap-2">
                  <Home className="h-5 w-5" />
                  BEFORE PV Installation - Monthly Analysis
                </h3>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-red-50 dark:bg-red-900/20">
                        <TableHead>Month</TableHead>
                        <TableHead className="text-right">Consumption (kWh)</TableHead>
                        <TableHead className="text-right">Grid Import (kWh)</TableHead>
                        <TableHead className="text-right">Monthly Bill (JD)</TableHead>
                        <TableHead className="text-right">Grid Dependency</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {monthly_data.map((month) => (
                        <TableRow key={`before-${month.month}`} className="hover:bg-red-50/50">
                          <TableCell className="font-medium">{month.month}</TableCell>
                          <TableCell className="text-right font-mono text-sm">
                            {month.consumption.toFixed(0)}
                          </TableCell>
                          <TableCell className="text-right font-mono text-sm text-orange-600">
                            {month.consumption.toFixed(0)}
                          </TableCell>
                          <TableCell className="text-right font-mono text-sm">
                            <Badge variant="outline" className="bg-red-100 text-red-800 border-red-300">
                              {month.bill_before.toFixed(2)}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right font-mono text-sm">
                            <Badge variant="outline" className="bg-red-100 text-red-800">
                              100%
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>

              {/* After PV Installation Table */}
              <div>
                <h3 className="text-lg font-semibold mb-4 text-green-700 flex items-center gap-2">
                  <Sun className="h-5 w-5" />
                  AFTER PV Installation - Monthly Analysis
                </h3>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-green-50 dark:bg-green-900/20">
                        <TableHead>Month</TableHead>
                        <TableHead className="text-right">Consumption (kWh)</TableHead>
                        <TableHead className="text-right">PV Generation (kWh)</TableHead>
                        <TableHead className="text-right">Self-Use (kWh)</TableHead>
                        <TableHead className="text-right">Grid Export (kWh)</TableHead>
                        <TableHead className="text-right">Grid Import (kWh)</TableHead>
                        <TableHead className="text-right">Import Bill (JD)</TableHead>
                        <TableHead className="text-right">Export Revenue (JD)</TableHead>
                        <TableHead className="text-right">Net Bill (JD)</TableHead>
                        <TableHead className="text-right">Monthly Savings (JD)</TableHead>
                        {net_billing_enabled && (
                          <>
                            <TableHead className="text-right">Credits Used (JD)</TableHead>
                            <TableHead className="text-right">Credits Generated (JD)</TableHead>
                            <TableHead className="text-right">Credit Balance (JD)</TableHead>
                          </>
                        )}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {monthly_data.map((month) => (
                        <TableRow key={`after-${month.month}`} className="hover:bg-green-50/50">
                          <TableCell className="font-medium">{month.month}</TableCell>
                          <TableCell className="text-right font-mono text-sm">
                            {month.consumption.toFixed(0)}
                          </TableCell>
                          <TableCell className="text-right font-mono text-sm text-yellow-600">
                            {month.generation.toFixed(0)}
                          </TableCell>
                          <TableCell className="text-right font-mono text-sm text-green-600">
                            {month.self_consumption.toFixed(0)}
                          </TableCell>
                          <TableCell className="text-right font-mono text-sm text-blue-600">
                            {month.export.toFixed(0)}
                          </TableCell>
                          <TableCell className="text-right font-mono text-sm text-orange-600">
                            {month.import.toFixed(0)}
                          </TableCell>
                          <TableCell className="text-right font-mono text-sm">
                            <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
                              {(month.import_cost || 0).toFixed(2)}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right font-mono text-sm">
                            <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                              {month.export_revenue.toFixed(2)}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right font-mono text-sm">
                            <Badge variant="outline" className={month.bill_after > 0 ? "bg-orange-50 text-orange-700 border-orange-200" : "bg-green-50 text-green-700 border-green-200"}>
                              {month.bill_after.toFixed(2)}
                            </Badge>
                            <div className="text-xs text-muted-foreground mt-1">
                              {(month.import_cost || 0).toFixed(2)} - {month.export_revenue.toFixed(2)}
                            </div>
                          </TableCell>
                          <TableCell className="text-right font-mono text-sm">
                            <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                              {month.savings.toFixed(2)}
                            </Badge>
                          </TableCell>
                          {net_billing_enabled && (
                            <>
                              <TableCell className="text-right font-mono text-sm text-purple-600">
                                {(month.monthly_credit_used || 0).toFixed(2)}
                              </TableCell>
                              <TableCell className="text-right font-mono text-sm text-green-600">
                                {(month.monthly_credit_generated || 0).toFixed(2)}
                              </TableCell>
                              <TableCell className="text-right font-mono text-sm">
                                <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200">
                                  {(month.running_credit_balance || 0).toFixed(2)}
                                </Badge>
                                {/* Show credit generated indicator */}
                                {month.monthly_credit_generated && month.monthly_credit_generated > 0 && (
                                  <div className="text-xs text-green-600 mt-1">
                                    ↗ +{month.monthly_credit_generated.toFixed(2)} carried to next
                                  </div>
                                )}
                                {/* Show credit used indicator */}
                                {month.monthly_credit_used && month.monthly_credit_used > 0 && (
                                  <div className="text-xs text-blue-600 mt-1">
                                    ↙ Used from previous months
                                  </div>
                                )}
                              </TableCell>
                            </>
                          )}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Summary Statistics */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Annual Summary Comparison
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Before PV Column */}
                <div className="space-y-4">
                  <h4 className="font-semibold text-red-700 border-b border-red-200 pb-2">Before PV Installation</h4>
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-sm">Total Consumption:</span>
                      <Badge variant="outline">{totalConsumption.toFixed(0)} kWh</Badge>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm">Annual Cost:</span>
                      <Badge variant="outline" className="bg-red-100 text-red-800 border-red-300">
                        {annual_summary.cost_before.toFixed(0)} JD
                      </Badge>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm">Monthly Average:</span>
                      <Badge variant="outline">{(annual_summary.cost_before / 12).toFixed(0)} JD</Badge>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm">Grid Dependency:</span>
                      <Badge variant="outline" className="bg-red-100 text-red-800">100%</Badge>
                    </div>
                  </div>
                </div>

                {/* After PV Column */}
                <div className="space-y-4">
                  <h4 className="font-semibold text-green-700 border-b border-green-200 pb-2">After PV Installation</h4>
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-sm">PV Generation:</span>
                      <Badge variant="outline" className="bg-green-100 text-green-800">
                        {annual_summary.annual_generation.toFixed(0)} kWh
                      </Badge>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm">Self Consumption:</span>
                      <Badge variant="outline" className="bg-blue-100 text-blue-800">
                        {totalSelfConsumption.toFixed(0)} kWh
                      </Badge>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm">Grid Export:</span>
                      <Badge variant="outline" className="bg-purple-100 text-purple-800">
                        {totalExport.toFixed(0)} kWh
                      </Badge>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm">Annual Cost:</span>
                      <Badge variant="outline" className="bg-green-100 text-green-800">
                        {annual_summary.cost_after.toFixed(0)} JD
                      </Badge>
                    </div>
                  </div>
                </div>

                {/* Savings & Impact Column */}
                <div className="space-y-4">
                  <h4 className="font-semibold text-blue-700 border-b border-blue-200 pb-2">Impact & Savings</h4>
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-sm">Annual Savings:</span>
                      <Badge variant="outline" className="bg-blue-100 text-blue-800">
                        {annual_summary.annual_savings.toFixed(0)} JD
                      </Badge>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm">Export Revenue:</span>
                      <Badge variant="outline" className="bg-green-100 text-green-800">
                        {annual_summary.export_revenue.toFixed(0)} JD
                      </Badge>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm">Self Consumption Rate:</span>
                      <Badge variant="outline" className="bg-purple-100 text-purple-800">
                        {selfConsumptionRate.toFixed(1)}%
                      </Badge>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm">Grid Independence:</span>
                      <Badge variant="outline" className="bg-orange-100 text-orange-800">
                        {(100 - (totalImport/totalConsumption)*100).toFixed(1)}%
                      </Badge>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Net Billing Summary (if enabled) */}
          {net_billing_enabled && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <PiggyBank className="h-5 w-5" />
                  Net Billing System Summary
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="text-center p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                    <div className="text-2xl font-bold text-blue-700">
                      {monthly_data.reduce((sum, m) => sum + (m.monthly_credit_generated || 0), 0).toFixed(0)}
                    </div>
                    <div className="text-sm text-blue-600">Total Credits Generated (JD)</div>
                  </div>
                  <div className="text-center p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
                    <div className="text-2xl font-bold text-green-700">
                      {monthly_data.reduce((sum, m) => sum + (m.monthly_credit_used || 0), 0).toFixed(0)}
                    </div>
                    <div className="text-sm text-green-600">Total Credits Used (JD)</div>
                  </div>
                  <div className="text-center p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
                    <div className="text-2xl font-bold text-purple-700">
                      {(annual_summary.final_credit_balance || 0).toFixed(0)}
                    </div>
                    <div className="text-sm text-purple-600">Final Credit Balance (JD)</div>
                  </div>
                  <div className="text-center p-4 bg-orange-50 dark:bg-orange-900/20 rounded-lg">
                    <div className="text-2xl font-bold text-orange-700">
                      {(annual_summary.net_billing_savings || 0).toFixed(0)}
                    </div>
                    <div className="text-sm text-orange-600">Additional Net Billing Savings (JD)</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
      </div>
    </div>
  );
}