import { useState } from 'react';
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import AppSidebar from '@/components/AppSidebar';
import { Button } from '@/components/ui/button';
import { Moon, Sun, Play, LogOut, FileText } from 'lucide-react';
import { useTheme } from '@/components/ThemeProvider';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';

// Import calculator components
import CalculatorLogic from '@/components/CalculatorLogic';
import CustomerGridSelection from '@/components/CustomerGridSelection';
import MonthlyConsumptionInputs from '@/components/MonthlyConsumptionInputs';
import SystemConfiguration from '@/components/SystemConfiguration';
import TimeFactorWidget from '@/components/TimeFactorWidget';
import TimeParametersSection from '@/components/TimeParametersSection';
import CircularGauge from '@/components/CircularGauge';
import Dashboard from '@/components/Dashboard';
import AnalysisSection from '@/components/AnalysisSection';
import BeforeAfterResults from '@/components/BeforeAfterResults';
import TechnicalReport from '@/components/TechnicalReport';
import PVDesignPanel from '@/components/PVDesignPanel';
import ComparisonSection from '@/components/ComparisonSection';
import HelpSection from '@/components/HelpSection';
import UserManagement from '@/pages/user-management';
import { useAuth } from '@/hooks/use-auth';

type ActiveTab = 'designer' | 'pv-design' | 'dashboard' | 'analysis' | 'comparison' | 'help' | 'users';

export default function SolarCalculatorApp() {
  const { theme, toggleTheme } = useTheme();
  const { user, logoutMutation } = useAuth();
  const [activeTab, setActiveTab] = useState<ActiveTab>('designer');

  const handleTabChange = (tab: string) => {
    setActiveTab(tab as ActiveTab);
  };

  const sidebarStyle = {
    "--sidebar-width": "20rem",
    "--sidebar-width-icon": "4rem",
  };

  return (
    <SidebarProvider style={sidebarStyle as React.CSSProperties}>
      <div className="flex h-screen w-full">
        <AppSidebar activeTab={activeTab} onTabChange={handleTabChange} isAdmin={user?.isAdmin} />
        <div className="flex flex-col flex-1">
          {/* Header */}
          <header className="flex items-center justify-between p-4 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
            <div className="flex items-center gap-4">
              <SidebarTrigger data-testid="button-sidebar-toggle" />
              <div className="flex items-center gap-2">
                <img src="/espark-logo.png" alt="eSpark" className="h-7 w-7 rounded-md object-contain" />
                <h1 className="text-xl font-semibold">eSpark PV Calculator</h1>
                <Badge variant="secondary" className="text-xs">Professional</Badge>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {user && (
                <span className="text-sm text-muted-foreground hidden sm:inline" data-testid="text-current-user">
                  {user.firstName} {user.lastName} ({user.username})
                </span>
              )}
              <Button
                variant="ghost"
                size="icon"
                onClick={toggleTheme}
                data-testid="button-theme-toggle"
              >
                {theme === 'light' ? <Moon className="h-5 w-5" /> : <Sun className="h-5 w-5" />}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => logoutMutation.mutate()}
                disabled={logoutMutation.isPending}
                data-testid="button-logout"
                title="Sign out"
              >
                <LogOut className="h-5 w-5" />
              </Button>
            </div>
          </header>

          {/* Main Content */}
          <main className="flex-1 overflow-hidden">
            <CalculatorLogic>
              {({ state, updateField, calculate, results, isCalculating }) => (
                <>
                <ScrollArea className="h-full">
                  <div className="p-6">
                    {activeTab === 'designer' && (
                      <div className="space-y-6">
                        <div className="flex items-center justify-between">
                          <h2 className="text-2xl font-semibold">System Designer</h2>
                          <div className="flex items-center gap-2">
                            <Button
                              variant="outline"
                              onClick={() => window.print()}
                              disabled={!results}
                              className="flex items-center gap-2"
                              data-testid="button-generate-report"
                              title={results ? 'Generate a printable technical report (Save as PDF)' : 'Run a calculation first'}
                            >
                              <FileText className="h-4 w-4" />
                              Generate Report
                            </Button>
                            <Button
                              onClick={calculate}
                              disabled={isCalculating}
                              className="flex items-center gap-2"
                              data-testid="button-calculate"
                            >
                              <Play className="h-4 w-4" />
                              {isCalculating ? 'Calculating...' : 'Calculate System'}
                            </Button>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                          {/* Left Panel - Inputs */}
                          <div className="space-y-6">
                            <CustomerGridSelection
                              customerType={state.customerType}
                              gridConnection={state.gridConnection}
                              sector={state.sector}
                              onCustomerTypeChange={(customerType) => updateField('customerType', customerType)}
                              onGridConnectionChange={(gridConnection) => updateField('gridConnection', gridConnection)}
                              onSectorChange={(sector) => updateField('sector', sector)}
                            />

                            <MonthlyConsumptionInputs
                              consumption={state.consumption}
                              onChange={(consumption) => updateField('consumption', consumption)}
                            />
                            
                            <SystemConfiguration
                              efficiency={state.efficiency}
                              degradation={state.degradation}
                              tariffSupported={state.tariffSupported}
                              exportTariff={state.exportTariff}
                              pvSize={results?.annual_summary.pv_size}
                              inverterSize={results?.annual_summary.inverter_size}
                              customerType={state.customerType}
                              gridConnection={state.gridConnection}
                              industrialBassConfig={state.industrialBassConfig}
                              onEfficiencyChange={(efficiency) => updateField('efficiency', efficiency)}
                              onDegradationChange={(degradation) => updateField('degradation', degradation)}
                              onTariffSupportedChange={(tariffSupported) => updateField('tariffSupported', tariffSupported)}
                              onExportTariffChange={(exportTariff) => updateField('exportTariff', exportTariff)}
                              onIndustrialBassConfigChange={(industrialBassConfig) => updateField('industrialBassConfig', industrialBassConfig)}
                            />
                          </div>

                          {/* Right Panel - Live Preview */}
                          <div className="space-y-6">
                            {/* Gauges */}
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                              <CircularGauge
                                title="Power Generation"
                                value={results?.annual_summary.pv_size || 0}
                                max={1000}
                                unit="kWh"
                                variant="chart-1"
                              />
                              <CircularGauge
                                title="System Efficiency"
                                value={state.efficiency}
                                max={100}
                                unit="%"
                                variant="chart-2"
                              />
                              <CircularGauge
                                title="Annual Savings"
                                value={results?.annual_summary.annual_savings || 0}
                                max={5000}
                                unit="JD"
                                variant="chart-3"
                              />
                            </div>

                            {/* Time Period Parameters Section - Modular Design */}
                            <TimeParametersSection
                              customerType={state.customerType}
                              gridConnection={state.gridConnection}
                              detailedMonthly={state.detailedMonthly}
                              onDetailedMonthlyChange={(v) => updateField('detailedMonthly', v)}
                              // Consumption Period Factors
                              dayFactors={state.dayFactors}
                              eveningFactors={state.eveningFactors}
                              nightFactors={state.nightFactors}
                              // Industrial Period Factors  
                              period1Factors={state.period1Factors}
                              period2Factors={state.period2Factors}
                              period3Factors={state.period3Factors}
                              period4Factors={state.period4Factors}
                              // Solar Generation Factors - Residential
                              sunPeakFactors={state.sunPeakFactors}
                              sunMediumFactors={state.sunMediumFactors}
                              sunLowFactors={state.sunLowFactors}
                              // Solar Generation Factors - Industrial
                              sunPeriod1Factors={state.sunPeriod1Factors}
                              sunPeriod2Factors={state.sunPeriod2Factors}
                              sunPeriod3Factors={state.sunPeriod3Factors}
                              sunPeriod4Factors={state.sunPeriod4Factors}
                              // PV Self-Consumption Factors - Residential
                              pvConsumeDay={state.pvConsumeDay}
                              pvConsumeEvening={state.pvConsumeEvening}
                              pvConsumeNight={state.pvConsumeNight}
                              // PV Self-Consumption Factors - Industrial
                              pvConsumePeriod1={state.pvConsumePeriod1}
                              pvConsumePeriod2={state.pvConsumePeriod2}
                              pvConsumePeriod3={state.pvConsumePeriod3}
                              pvConsumePeriod4={state.pvConsumePeriod4}
                              // Update handler
                              updateField={updateField}
                            />


                          </div>
                        </div>
                      </div>
                    )}

                    {activeTab === 'pv-design' && (
                      <PVDesignPanel
                        state={state.pvDesign}
                        onChange={(pv) => updateField('pvDesign', pv)}
                      />
                    )}

                    {activeTab === 'dashboard' && (
                      <div className="space-y-6">
                        {results ? (
                          <div className="space-y-8">
                            {/* Original Dashboard Charts */}
                            <Dashboard results={results} />
                            
                            {/* Enhanced Results Summary */}
                            <BeforeAfterResults 
                              results={results}
                              customerType={state.customerType}
                              totalConsumption={Object.values(state.consumption).reduce((sum: number, val: any) => sum + val, 0)}
                            />
                          </div>
                        ) : (
                          <div className="text-center py-12">
                            <h2 className="text-2xl font-semibold mb-4">System Performance Dashboard</h2>
                            <p className="text-muted-foreground">
                              Configure your system parameters and click "Calculate System" to view comprehensive results.
                            </p>
                          </div>
                        )}
                      </div>
                    )}

                    {activeTab === 'analysis' && (
                      <AnalysisSection
                        customerType={state.customerType}
                        gridConnection={state.gridConnection}
                        results={results}
                        efficiency={state.efficiency}
                        degradation={state.degradation}
                        tariffSupported={state.tariffSupported}
                        exportTariff={state.exportTariff}
                        consumption={state.consumption}
                        industrialTariffs={state.industrialTariffs}
                      />
                    )}

                    {activeTab === 'comparison' && (
                      <ComparisonSection 
                        results={results}
                        customerType={state.customerType}
                      />
                    )}

                    {activeTab === 'help' && (
                      <HelpSection />
                    )}

                    {activeTab === 'users' && (
                      <UserManagement />
                    )}
                  </div>
                </ScrollArea>
                {/* Print-only technical report — hidden on screen, shown
                    only when the user triggers Export (window.print).
                    Mounted once at the root so it captures the latest
                    results regardless of which tab is active. */}
                <TechnicalReport
                  results={results}
                  customerType={state.customerType}
                  gridConnection={state.gridConnection}
                  consumption={state.consumption}
                  efficiency={state.efficiency}
                  degradation={state.degradation}
                />
                </>
              )}
            </CalculatorLogic>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}