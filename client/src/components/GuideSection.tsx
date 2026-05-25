// User guide — plain-language "how to use the app" walkthrough.
// (Distinct from the Help tab, which documents the calculation equations.)

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  SlidersHorizontal, BarChart3, Play, FileText, Save, Compass,
  Users, Sun, Zap, HelpCircle, type LucideIcon,
} from 'lucide-react';

interface GuideSectionProps {
  onStartTour?: () => void;
}

function GuideStep({ n, icon: Icon, title, children }: { n: number; icon: LucideIcon; title: string; children: React.ReactNode }) {
  return (
    <li className="flex gap-4">
      <div className="flex-none flex flex-col items-center">
        <span className="h-9 w-9 rounded-full bg-orange-500/15 text-orange-500 font-bold grid place-items-center">{n}</span>
      </div>
      <div className="space-y-1.5 min-w-0 flex-1 pb-2">
        <div className="flex items-center gap-2 font-semibold">
          <Icon className="h-4 w-4 text-orange-400" /> {title}
        </div>
        <div className="text-sm text-muted-foreground space-y-1.5">{children}</div>
      </div>
    </li>
  );
}

export default function GuideSection({ onStartTour }: GuideSectionProps) {
  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-2xl font-semibold mb-1">How to use this app</h2>
          <p className="text-sm text-muted-foreground">
            A quick, plain-language walkthrough. Follow the steps in order — the whole
            study takes a couple of minutes.
          </p>
        </div>
        {onStartTour && (
          <Button onClick={onStartTour} className="flex items-center gap-2" data-testid="button-start-tour">
            <Compass className="h-4 w-4" /> Take the interactive tour
          </Button>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">The 5-step workflow</CardTitle>
        </CardHeader>
        <CardContent>
          <ol className="space-y-5 list-none m-0 p-0">
            <GuideStep n={1} icon={SlidersHorizontal} title="Open the Inputs tab and describe the customer">
              <p>
                In <strong>Inputs</strong>, first pick the <strong>Customer type</strong> (Residential,
                Commercial, Industrial, …) and the <strong>Grid connection</strong> (Net billing,
                Wheeling, Zero export, Buy-all sell-all, or Legacy net metering). These two choices
                drive how the bill and savings are calculated.
              </p>
            </GuideStep>

            <GuideStep n={2} icon={Sun} title="Enter the monthly electricity consumption">
              <p>
                Type each month’s usage (in kWh) into <strong>Monthly Consumption</strong>. This is
                usually taken straight from the customer’s electricity bills. If you only have a yearly
                figure, divide it across the months as best you can.
              </p>
            </GuideStep>

            <GuideStep n={3} icon={Zap} title="(Optional) Fine-tune the system & PV design">
              <p>
                Adjust <strong>System Configuration</strong> (efficiency, export tariff) and the
                time-of-use factors if needed — the defaults are sensible. For a sizing/yield estimate,
                open the <strong>PV Design</strong> and <strong>Electrical &amp; BoS</strong> sections.
              </p>
            </GuideStep>

            <GuideStep n={4} icon={Play} title="Click “Calculate System”">
              <p>
                Hit the <strong>Calculate System</strong> button (top-right of the Inputs/Results
                header). The app computes the before/after bills, savings, export revenue and payback.
              </p>
            </GuideStep>

            <GuideStep n={5} icon={BarChart3} title="Review the Results">
              <p>
                Switch to the <strong>Results</strong> tab to see performance gauges, monthly
                breakdowns, PV yield and the electrical sizing. Use the sub-tabs (Performance, PV Yield,
                Electrical &amp; BoS, Comparison) to drill in.
              </p>
            </GuideStep>
          </ol>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Saving &amp; sharing your work</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-4 list-none m-0 p-0">
            <GuideStep n={6} icon={Save} title="Save the study case (Google sign-in)">
              <p>
                Click <strong>Save Case</strong> in the header (or open the <strong>Saved Cases</strong>
                tab), give it a name, and save. When you sign in with Google your cases are stored to
                your account, so you’ll see your <strong>previous study cases</strong> on any device.
                Open one any time to restore all its inputs and results.
              </p>
              <p className="text-xs">
                <Badge variant="outline" className="text-xs mr-1">Note</Badge>
                Guest sessions can’t be saved — sign in with Google to keep your work.
              </p>
            </GuideStep>

            <GuideStep n={7} icon={FileText} title="Generate a printable report">
              <p>
                After calculating, click <strong>Generate Report</strong> to produce a clean,
                printable technical report. In the print dialog, choose <em>Save as PDF</em> to share it
                with the customer.
              </p>
            </GuideStep>
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="py-4 text-sm text-muted-foreground space-y-2">
          <div className="flex items-center gap-2 font-medium text-foreground">
            <HelpCircle className="h-4 w-4 text-orange-400" /> Need the math behind it?
          </div>
          <p>
            The <strong>Help</strong> tab documents every equation, default and tariff rule
            (EMRC 2025 / Bylaw 58/2024) used in the calculations.
          </p>
          <p className="flex items-center gap-2">
            <Users className="h-4 w-4 text-orange-400" />
            Admins also get a <strong>User Management</strong> tab to manage accounts.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
