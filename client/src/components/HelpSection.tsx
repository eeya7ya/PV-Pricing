import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { 
  Calculator, 
  Zap, 
  DollarSign, 
  Clock, 
  Sun, 
  Home, 
  Building2,
  TrendingUp,
  Info,
  BookOpen,
  FileText
} from 'lucide-react';

export default function HelpSection() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <BookOpen className="h-6 w-6 text-primary" />
        <h2 className="text-2xl font-semibold">Help & Documentation</h2>
        <Badge variant="outline">PyQt6 Formula Reference</Badge>
      </div>
      
      <div className="text-sm text-muted-foreground bg-muted/50 p-4 rounded-lg">
        <Info className="h-4 w-4 inline mr-2" />
        This section displays all equations and parameters used in the Solar PV Calculator, 
        preserved exactly as implemented in the original PyQt6 application.
      </div>

      {/* Core Calculation Formula */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calculator className="h-5 w-5" />
            Core System Sizing Formula
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-accent/20 p-4 rounded-lg font-mono text-sm">
            <div className="font-bold text-primary mb-2">X2 Formula (Monthly PV Generation):</div>
            <div className="space-y-2">
              <div><strong>Residential:</strong> X2 = (Sum of all monthly consumption) / 12</div>
              <div><strong>Industrial:</strong> X2 = ((Sum of all monthly consumption) / 12) / 2</div>
            </div>
            <div className="text-muted-foreground mt-2">
              Where X2 represents the required monthly PV generation in kWh/month
            </div>
            <div className="text-xs text-orange-600 mt-2">
              <strong>Note:</strong> Industrial customers use X2 = AVG/2 formula as requested
            </div>
          </div>
          
          <div className="bg-accent/20 p-4 rounded-lg font-mono text-sm">
            <div className="font-bold text-primary mb-2">Inverter Size Calculation:</div>
            <div>Inverter Size (kW) = X2 / (130 × 0.95)</div>
            <div className="text-muted-foreground mt-2">
              Where 130 is the performance ratio factor and 0.95 is the system efficiency
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tariff Calculation */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            Tariff Calculation Methods
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="p-4 bg-primary/5 rounded-lg border border-primary/20">
            <div className="flex items-center gap-2 mb-3">
              <Info className="h-4 w-4 text-primary" />
              <span className="font-semibold text-primary">User Selection Required</span>
            </div>
            <p className="text-sm text-muted-foreground mb-4">
              The user must specify their tariff type in the System Configuration section. 
              This choice determines which calculation method is used:
            </p>
            
            <h4 className="font-semibold mb-3">✓ Tiered Tariff Support (checkbox checked):</h4>
            <div className="bg-accent/20 p-4 rounded-lg font-mono text-sm space-y-2 mb-4">
              <div>if energy_kwh ≤ 300: <span className="text-chart-1">Cost = energy_kwh × 0.05 JD/kWh</span></div>
              <div>elif energy_kwh ≤ 600: <span className="text-chart-2">Cost = (300 × 0.05) + ((energy_kwh - 300) × 0.1) JD</span></div>
              <div>else: <span className="text-chart-3">Cost = (300 × 0.05) + (300 × 0.1) + ((energy_kwh - 600) × 0.2) JD</span></div>
            </div>
          
            <h4 className="font-semibold mb-3">✗ Flat Rate Tariff (checkbox unchecked):</h4>
            <div className="bg-accent/20 p-4 rounded-lg font-mono text-sm space-y-2">
              <div>if energy_kwh ≤ 1000: <span className="text-chart-1">Cost = energy_kwh × 0.12 JD/kWh</span></div>
              <div>else: <span className="text-chart-2">Cost = (1000 × 0.12) + ((energy_kwh - 1000) × 0.15) JD</span></div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Buy-All Sell-All System */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5" />
            Residential Buy-All Sell-All System
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200">
            <h3 className="font-semibold text-green-700 dark:text-green-200 mb-3">Buy-All Sell-All Calculation Steps</h3>
            <div className="space-y-3 text-sm">
              <div className="bg-white dark:bg-green-900/40 p-3 rounded font-mono">
                <div className="font-bold text-green-600 mb-2">Step-by-Step Equations:</div>
                <div className="space-y-1">
                  <div><strong>1. Generation Approximation:</strong> X2 = Total Annual Consumption ÷ 12</div>
                  <div><strong>2. Import Cost:</strong> Uses selected tariff (Tiered or Flat Rate)</div>
                  <div><strong>3. Taxes:</strong> TX = X2 ÷ (130 × Efficiency)</div>
                  <div><strong>4. Export Revenue:</strong> X2 × Export Rate</div>
                  <div><strong>5. NET Monthly Cost:</strong> (Import Cost + Taxes) - Export Revenue</div>
                </div>
              </div>
              <div className="bg-white dark:bg-green-900/40 p-3 rounded">
                <div className="font-semibold text-green-600 mb-2">System Parameters:</div>
                <ul className="list-disc pl-4 space-y-1">
                  <li><strong>Generation Method:</strong> All PV generation exported to grid (X2 = monthly estimate)</li>
                  <li><strong>Consumption Method:</strong> All consumption imported from grid</li>
                  <li><strong>Self-Consumption:</strong> Zero (no direct PV use)</li>
                  <li><strong>Export Rate:</strong> User-configurable (default: 0.05 JD/kWh)</li>
                  <li><strong>Efficiency:</strong> User-configurable system efficiency (default: 95%)</li>
                  <li><strong>Tariff Options:</strong> Tiered (≤300@0.05, 300-600@0.1, &gt;600@0.2) or Flat (≤1000@0.12, &gt;1000@0.15)</li>
                </ul>
              </div>
              <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 rounded">
                <div className="font-semibold text-yellow-700 dark:text-yellow-200 mb-1">Key Differences from Net Billing:</div>
                <div className="text-yellow-600 dark:text-yellow-300 text-sm">
                  • No time period parameters required<br/>
                  • Simplified calculation model<br/>
                  • All energy flows through the grid (no direct consumption)
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Time Period Factors */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Time Period Distribution Factors
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-accent/20 p-4 rounded-lg">
              <h4 className="font-semibold text-chart-1 mb-2">Day Time (5:00-17:00)</h4>
              <div className="font-mono text-sm">
                <div>Y1 = X1 × day_factors[month]</div>
                <div className="text-muted-foreground text-xs mt-1">
                  Default: 30% per month
                </div>
              </div>
            </div>
            
            <div className="bg-accent/20 p-4 rounded-lg">
              <h4 className="font-semibold text-chart-2 mb-2">Evening (17:00-23:00)</h4>
              <div className="font-mono text-sm">
                <div>Y2 = X1 × evening_factors[month]</div>
                <div className="text-muted-foreground text-xs mt-1">
                  Default: 30% per month
                </div>
              </div>
            </div>
            
            <div className="bg-accent/20 p-4 rounded-lg">
              <h4 className="font-semibold text-chart-3 mb-2">Night Time (23:00-5:00)</h4>
              <div className="font-mono text-sm">
                <div>Y3 = X1 × night_factors[month]</div>
                <div className="text-muted-foreground text-xs mt-1">
                  Default: 40% per month
                </div>
              </div>
            </div>
          </div>
          
          <div className="text-sm text-muted-foreground p-3 bg-muted/50 rounded">
            <strong>Note:</strong> X1 represents monthly consumption, and these factors must sum to 1.0 (100%) for each month
          </div>
        </CardContent>
      </Card>

      {/* Solar Generation Factors */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sun className="h-5 w-5" />
            Solar Generation Distribution
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-accent/20 p-4 rounded-lg">
              <h4 className="font-semibold text-chart-1 mb-2">Peak Generation (Day)</h4>
              <div className="font-mono text-sm">
                <div>Z1 = X2 × sun_peak_factors[month]</div>
                <div className="text-muted-foreground text-xs mt-1">
                  Default: 100% (full sun)
                </div>
              </div>
            </div>
            
            <div className="bg-accent/20 p-4 rounded-lg">
              <h4 className="font-semibold text-chart-2 mb-2">Medium Generation (Evening)</h4>
              <div className="font-mono text-sm">
                <div>Z2 = X2 × sun_medium_factors[month]</div>
                <div className="text-muted-foreground text-xs mt-1">
                  Default: 20% (low sun)
                </div>
              </div>
            </div>
            
            <div className="bg-accent/20 p-4 rounded-lg">
              <h4 className="font-semibold text-chart-3 mb-2">Low Generation (Night)</h4>
              <div className="font-mono text-sm">
                <div>Z3 = X2 × sun_low_factors[month]</div>
                <div className="text-muted-foreground text-xs mt-1">
                  Default: 0% (no sun)
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Self-Consumption Calculation */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Home className="h-5 w-5" />
            Self-Consumption Calculation
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-accent/20 p-4 rounded-lg font-mono text-sm space-y-2">
            <div className="font-bold text-primary mb-3">Self-Consumption Formula:</div>
            <div>K1 = min(Z1 × pv_consume_day[month], Y1) <span className="text-muted-foreground"># Day consumption</span></div>
            <div>K2 = min(Z2 × pv_consume_evening[month], Y2) <span className="text-muted-foreground"># Evening consumption</span></div>
            <div>K3 = min(Z3 × pv_consume_night[month], Y3) <span className="text-muted-foreground"># Night consumption</span></div>
            <Separator className="my-2" />
            <div className="font-bold">Total Self-Consumption = K1 + K2 + K3</div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
            <div className="text-center p-3 bg-muted/50 rounded">
              <div className="font-semibold text-chart-1">Day PV Consumption</div>
              <div className="text-sm text-muted-foreground">Default: 70%</div>
            </div>
            <div className="text-center p-3 bg-muted/50 rounded">
              <div className="font-semibold text-chart-2">Evening PV Consumption</div>
              <div className="text-sm text-muted-foreground">Default: 90%</div>
            </div>
            <div className="text-center p-3 bg-muted/50 rounded">
              <div className="font-semibold text-chart-3">Night PV Consumption</div>
              <div className="text-sm text-muted-foreground">Default: 100%</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Export and Import Calculation */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Export & Import Calculation
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-accent/20 p-4 rounded-lg font-mono text-sm space-y-2">
            <div className="font-bold text-primary mb-3">Export to Grid:</div>
            <div>Export = max(0, Z1 - K1) + max(0, Z2 - K2) + max(0, Z3 - K3)</div>
            
            <div className="font-bold text-primary mt-4 mb-3">Import from Grid:</div>
            <div>Import = max(0, Y1 - K1) + max(0, Y2 - K2) + max(0, Y3 - K3)</div>
            
            <div className="font-bold text-primary mt-4 mb-3">Export Revenue:</div>
            <div>Revenue = Export × export_tariff_rate</div>
          </div>
        </CardContent>
      </Card>


      {/* Billing Breakdown & Net Billing System */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Billing Breakdown & Net Billing System
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-accent/20 p-4 rounded-lg font-mono text-sm space-y-3">
            <div className="font-bold text-primary mb-3">Before Solar PV:</div>
            <div>Bill_Before = calculateTariff(Total_Consumption, tariff_supported)</div>
            <div className="text-xs text-muted-foreground">Total monthly consumption charged at applicable tariff rates</div>
            
            <Separator className="my-3" />
            
            <div className="font-bold text-primary mb-3">After Solar PV - Monthly Billing Components:</div>
            <div className="space-y-2">
              <div><strong className="text-blue-600">Import_Bill</strong> = calculateTariff(Grid_Import, tariff_supported)</div>
              <div><strong className="text-green-600">Export_Revenue</strong> = Grid_Export × export_tariff_rate</div>
              <div><strong className="text-orange-600">Net_Bill</strong> = Import_Bill - Export_Revenue</div>
            </div>
            <div className="text-xs text-muted-foreground mt-2">
              Net Bill shows the final amount after offsetting import costs with export earnings
            </div>
            
            <Separator className="my-3" />
            
            <div className="font-bold text-primary mb-3">Monthly Savings Calculation:</div>
            <div>Monthly_Savings = Bill_Before - Net_Bill</div>
          </div>

          {/* Net Billing Credit System */}
          <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border border-blue-200">
            <div className="font-bold text-blue-700 dark:text-blue-200 mb-3">Net Billing Credit Carry-Over System:</div>
            <div className="font-mono text-sm space-y-2">
              <div className="space-y-1">
                <div><strong>Credit Generation:</strong> When Net_Bill &lt; 0 (export revenue exceeds import cost)</div>
                <div className="pl-4">Credits_Generated = |Net_Bill| (absolute value of negative bill)</div>
                
                <div className="mt-2"><strong>Credit Usage:</strong> When Net_Bill &gt; 0 (import cost exceeds export revenue)</div>
                <div className="pl-4">Credits_Used = min(Available_Credits, Net_Bill)</div>
                <div className="pl-4">Final_Bill = Net_Bill - Credits_Used</div>
                
                <div className="mt-2"><strong>Running Balance:</strong></div>
                <div className="pl-4">Credit_Balance = Previous_Balance + Credits_Generated - Credits_Used</div>
                
                <div className="text-xs text-blue-600 mt-3">
                  <strong>Month-to-Month Carry-Over:</strong> Unused credits automatically carry forward to subsequent months
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* NPV and Financial Analysis */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            NPV & Financial Analysis
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-accent/20 p-4 rounded-lg font-mono text-sm space-y-2">
            <div className="font-bold text-primary mb-3">Net Present Value (NPV):</div>
            <div>NPV = -Initial_Investment + Σ(Annual_Savings_Year_t / (1 + discount_rate)^t)</div>
            
            <div className="font-bold text-primary mt-4 mb-3">With Degradation:</div>
            <div>Degradation_Factor = (1 - 0.005)^year <span className="text-muted-foreground"># 0.5% annual degradation</span></div>
            <div>Yearly_Savings = Annual_Savings × Degradation_Factor</div>
            
            <div className="font-bold text-primary mt-4 mb-3">Simple Payback Period:</div>
            <div>Payback = System_Cost / Annual_Savings (years)</div>
          </div>
        </CardContent>
      </Card>

      {/* Default Parameters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Info className="h-5 w-5" />
            Default System Parameters
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-3">
              <h4 className="font-semibold">System Configuration:</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span>System Efficiency:</span>
                  <Badge variant="outline">95%</Badge>
                </div>
                <div className="flex justify-between">
                  <span>Annual Degradation:</span>
                  <Badge variant="outline">0.5%</Badge>
                </div>
                <div className="flex justify-between">
                  <span>Export Tariff (Residential):</span>
                  <Badge variant="outline">0.05 JD/kWh</Badge>
                </div>
                <div className="flex justify-between">
                  <span>Export Tariff (Industrial):</span>
                  <Badge variant="outline">0.04 JD/kWh</Badge>
                </div>
                <div className="flex justify-between">
                  <span>Default Consumption:</span>
                  <Badge variant="outline">500 kWh/month</Badge>
                </div>
              </div>
            </div>
            
            <div className="space-y-3">
              <h4 className="font-semibold">Financial Analysis:</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span>Discount Rate:</span>
                  <Badge variant="outline">5%</Badge>
                </div>
                <div className="flex justify-between">
                  <span>Project Life:</span>
                  <Badge variant="outline">25 years</Badge>
                </div>
                <div className="flex justify-between">
                  <span>Performance Ratio:</span>
                  <Badge variant="outline">130 factor</Badge>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Residential Customer Calculation Methodology */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Home className="h-5 w-5" />
            Residential Customer Calculation Methodology
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
            <h4 className="font-semibold text-blue-700 dark:text-blue-200 mb-2">Residential 3-Period Time Structure</h4>
            <p className="text-sm text-blue-600 dark:text-blue-300">
              Residential customers use a 3-period time-of-use system with Day, Evening, and Night periods.
            </p>
          </div>

          {/* Reference to main tariff section */}
          <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
            <div className="text-sm font-medium text-blue-800 dark:text-blue-200 mb-2">📋 Tariff Calculation Methods</div>
            <p className="text-sm text-blue-600 dark:text-blue-300">
              Residential customers use the same tariff calculation methods as described in the "Tariff Calculation Methods" section above.
              Both tiered and flat rate options are available based on user configuration.
            </p>
          </div>

          {/* Time Periods for Residential */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-3">
              <h4 className="font-semibold text-muted-foreground">Time Period Definitions</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between p-2 bg-muted/50 rounded">
                  <span className="font-medium">Day (7-14):</span>
                  <span className="text-muted-foreground">7 hours</span>
                </div>
                <div className="flex justify-between p-2 bg-muted/50 rounded">
                  <span className="font-medium">Evening (14-23):</span>
                  <span className="text-muted-foreground">9 hours</span>
                </div>
                <div className="flex justify-between p-2 bg-muted/50 rounded">
                  <span className="font-medium">Night (23-7):</span>
                  <span className="text-muted-foreground">8 hours</span>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <h4 className="font-semibold text-muted-foreground">Default Export Rates</h4>
              <div className="space-y-2 text-sm">
                <div className="p-2 bg-muted/50 rounded text-center">
                  <div className="text-green-600 font-medium">All Periods</div>
                  <div className="text-lg font-bold text-green-700">5.0 ¢/kWh</div>
                  <div className="text-xs text-muted-foreground">Residential</div>
                </div>
              </div>
            </div>
          </div>

          {/* Residential PV Generation Factors */}
          <div className="space-y-3">
            <h4 className="font-semibold text-muted-foreground">Residential PV Generation Factors (K-Factors)</h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
              <div className="p-3 bg-muted/50 rounded text-center">
                <div className="font-medium text-chart-1">Day Factor</div>
                <div className="text-xs text-muted-foreground">Day (7-14)</div>
                <div className="text-lg font-bold text-chart-1">75%</div>
              </div>
              <div className="p-3 bg-muted/50 rounded text-center">
                <div className="font-medium text-chart-2">Evening Factor</div>
                <div className="text-xs text-muted-foreground">Evening (14-23)</div>
                <div className="text-lg font-bold text-chart-2">85%</div>
              </div>
              <div className="p-3 bg-muted/50 rounded text-center">
                <div className="font-medium text-chart-3">Night Factor</div>
                <div className="text-xs text-muted-foreground">Night (23-7)</div>
                <div className="text-lg font-bold text-chart-3">60%</div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Industrial Customer Calculation Methodology */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Industrial Customer Calculation Methodology
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="p-4 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg">
            <h4 className="font-semibold text-orange-700 dark:text-orange-200 mb-2">Industrial 4-Period Time Structure</h4>
            <p className="text-sm text-orange-600 dark:text-orange-300">
              Industrial customers use a sophisticated 4-period time-of-use system with distinct rates for each period.
            </p>
          </div>

          {/* Time Periods */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-3">
              <h4 className="font-semibold text-muted-foreground">Time Period Definitions</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between p-2 bg-muted/50 rounded">
                  <span className="font-medium">Off Peak (5-14):</span>
                  <span className="text-muted-foreground">9 hours</span>
                </div>
                <div className="flex justify-between p-2 bg-muted/50 rounded">
                  <span className="font-medium">Half Peak (14-17):</span>
                  <span className="text-muted-foreground">3 hours</span>
                </div>
                <div className="flex justify-between p-2 bg-muted/50 rounded">
                  <span className="font-medium">Peak (17-23):</span>
                  <span className="text-muted-foreground">6 hours</span>
                </div>
                <div className="flex justify-between p-2 bg-muted/50 rounded">
                  <span className="font-medium">Half Peak (23-5):</span>
                  <span className="text-muted-foreground">6 hours</span>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <h4 className="font-semibold text-muted-foreground">Default Tariff Rates</h4>
              <div className="space-y-2 text-sm">
                <div className="grid grid-cols-2 gap-2">
                  <div className="text-orange-600 font-medium">Import (¢/kWh)</div>
                  <div className="text-green-600 font-medium">Export (¢/kWh)</div>
                </div>
                <div className="grid grid-cols-2 gap-2 p-2 bg-muted/50 rounded text-xs">
                  <span>Off Peak: 5.9</span>
                  <span>Off Peak: 4.0</span>
                </div>
                <div className="grid grid-cols-2 gap-2 p-2 bg-muted/50 rounded text-xs">
                  <span>Half Peak: 6.9</span>
                  <span>Half Peak: 4.0</span>
                </div>
                <div className="grid grid-cols-2 gap-2 p-2 bg-muted/50 rounded text-xs">
                  <span>Peak: 7.9</span>
                  <span>Peak: 4.0</span>
                </div>
                <div className="grid grid-cols-2 gap-2 p-2 bg-muted/50 rounded text-xs">
                  <span>Half Peak Night: 6.9</span>
                  <span>Half Peak Night: 4.0</span>
                </div>
              </div>
            </div>
          </div>

          {/* Industrial Net Billing Tariff Calculation */}
          <div className="space-y-4">
            <h4 className="font-semibold text-orange-700 dark:text-orange-200">Industrial Net Billing Calculation Methods</h4>
            
            <div className="bg-orange-50 dark:bg-orange-900/20 p-4 rounded-lg border border-orange-200 dark:border-orange-800">
              <div className="text-sm font-medium text-orange-800 dark:text-orange-200 mb-3">🏭 Industrial 4-Period Tariff Structure</div>
              
              <div className="space-y-3 font-mono text-xs">
                <div className="space-y-1">
                  <div className="text-orange-700 dark:text-orange-300 font-semibold">For each time period (P1, P2, P3, P4):</div>
                  <div className="pl-4 space-y-1">
                    <div><span className="text-orange-600">if</span> consumption_period &gt; 0: <span className="text-blue-600">cost</span> = consumption_period × import_rate_¢/kWh</div>
                    <div><span className="text-orange-600">if</span> export_period &gt; 0: <span className="text-green-600">revenue</span> = export_period × <span className="text-green-700">4.0</span> ¢/kWh</div>
                  </div>
                </div>
                
                <div className="space-y-1">
                  <div className="text-orange-700 dark:text-orange-300 font-semibold">Monthly calculation:</div>
                  <div className="pl-4 space-y-1">
                    <div><span className="text-blue-600">total_cost</span> = (P1_cost + P2_cost + P3_cost + P4_cost)</div>
                    <div><span className="text-green-600">total_revenue</span> = (P1_export + P2_export + P3_export + P4_export) × <span className="text-green-700">4.0</span> ¢/kWh</div>
                    <div><span className="text-purple-600">net_bill</span> = <span className="text-blue-600">total_cost</span> - <span className="text-green-600">total_revenue</span></div>
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="text-orange-700 dark:text-orange-300 font-semibold">Net billing credit system:</div>
                  <div className="pl-4 space-y-1">
                    <div><span className="text-orange-600">if</span> <span className="text-purple-600">net_bill</span> &lt; 0: credit_generated = |net_bill|</div>
                    <div><span className="text-orange-600">if</span> <span className="text-purple-600">net_bill</span> &gt; 0 <span className="text-orange-600">and</span> credits_available &gt; 0:</div>
                    <div className="pl-8">final_bill = max(0, net_bill - credits_available)</div>
                  </div>
                </div>
              </div>
            </div>

            <div className="text-xs text-muted-foreground bg-muted/30 p-3 rounded">
              <strong>Industrial Rates Example:</strong> Off Peak: 5.9¢/kWh import | Half Peak: 6.9¢/kWh import | Peak: 7.9¢/kWh import | All exports: 4.0¢/kWh
            </div>
          </div>

          {/* Industrial Calculation Formula */}
          <div className="bg-accent/20 p-4 rounded-lg font-mono text-sm">
            <div className="font-bold text-primary mb-2">Industrial Cost Calculation:</div>
            <div className="space-y-1 text-xs">
              <div>Monthly Cost = (Consumption_P1 × Rate_P1) + (Consumption_P2 × Rate_P2) + (Consumption_P3 × Rate_P3) + (Consumption_P4 × Rate_P4)</div>
              <div>Monthly Revenue = (Export_P1 × Export_Rate_P1) + (Export_P2 × Export_Rate_P2) + (Export_P3 × Export_Rate_P3) + (Export_P4 × Export_Rate_P4)</div>
              <div className="text-muted-foreground mt-2">
                Where P1=Off Peak, P2=Half Peak, P3=Peak, P4=Half Peak Night
              </div>
            </div>
          </div>

          {/* PV Generation Factors */}
          <div className="space-y-3">
            <h4 className="font-semibold text-muted-foreground">Industrial PV Generation Factors (K-Factors)</h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
              <div className="p-3 bg-muted/50 rounded text-center">
                <div className="font-medium text-chart-3">K1 Factor</div>
                <div className="text-xs text-muted-foreground">Off Peak (5-14)</div>
                <div className="text-lg font-bold text-chart-3">80%</div>
              </div>
              <div className="p-3 bg-muted/50 rounded text-center">
                <div className="font-medium text-chart-4">K2 Factor</div>
                <div className="text-xs text-muted-foreground">Half Peak (14-17)</div>
                <div className="text-lg font-bold text-chart-4">85%</div>
              </div>
              <div className="p-3 bg-muted/50 rounded text-center">
                <div className="font-medium text-chart-5">K3 Factor</div>
                <div className="text-xs text-muted-foreground">Peak (17-23)</div>
                <div className="text-lg font-bold text-chart-5">90%</div>
              </div>
              <div className="p-3 bg-muted/50 rounded text-center">
                <div className="font-medium text-chart-6">K4 Factor</div>
                <div className="text-xs text-muted-foreground">Half Peak (23-5)</div>
                <div className="text-lg font-bold text-chart-6">70%</div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Formula Verification */}
      <Card className="border-primary/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-primary">
            <Calculator className="h-5 w-5" />
            Formula Verification & Quality Assurance
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="bg-primary/5 p-4 rounded-lg">
            <p className="text-sm">
              <strong>All formulas and calculations in this web application are preserved EXACTLY 
              as implemented in the original PyQt6 Solar PV Calculator.</strong>
            </p>
            <Separator className="my-3" />
            <div className="text-xs text-muted-foreground space-y-1">
              <div>• No modifications have been made to the core calculation logic</div>
              <div>• All default parameters match the original PyQt6 values</div>
              <div>• Time factors, solar factors, and consumption factors are identical</div>
              <div>• Tariff calculation methods are preserved exactly</div>
              <div>• NPV and financial analysis formulas are unchanged</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}