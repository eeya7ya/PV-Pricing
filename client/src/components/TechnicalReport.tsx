/**
 * Print-only technical report.
 *
 * Always present in the DOM but hidden on screen via the
 * `.technical-report-print` rule in `index.css`. When the user clicks
 * the "Export Technical Report" button, `window.print()` flips into print
 * media — the rest of the app is hidden and only this report renders, with
 * the eSpark Engineering logo centered in the page header.
 *
 * Saves as PDF via the browser's native "Save as PDF" print destination.
 */

import type {
  CalculationResults,
  CustomerType,
  GridConnection,
  MonthlyConsumption,
} from '@shared/schema';

interface TechnicalReportProps {
  results: CalculationResults | undefined;
  customerType: CustomerType;
  gridConnection: GridConnection;
  consumption: MonthlyConsumption;
  efficiency: number;
  degradation: number;
}

function fmt(n: number | undefined | null, digits = 2): string {
  if (n == null || !Number.isFinite(n)) return '—';
  return n.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

function fmt0(n: number | undefined | null): string {
  return fmt(n, 0);
}

export default function TechnicalReport({
  results,
  customerType,
  gridConnection,
  consumption,
  efficiency,
  degradation,
}: TechnicalReportProps) {
  if (!results) return null;
  const s = results.annual_summary as any;
  const months = results.monthly_data;
  const reportDate = new Date().toLocaleDateString('en-GB', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
  const totalConsumption = Object.values(consumption).reduce(
    (sum: number, v: any) => sum + Number(v || 0),
    0,
  );

  return (
    <div className="technical-report-print">
      {/* Header: logo centered */}
      <header className="tr-header">
        <img src="/espark-logo.png" alt="eSpark Engineering" className="tr-logo" />
        <h1 className="tr-title">Solar PV Technical Analysis Report</h1>
        <div className="tr-subtitle">
          Jordan EMRC 2025 Tariff Guide &middot; Bylaw 58/2024 Net-Billing
        </div>
        <div className="tr-meta">Generated {reportDate}</div>
      </header>

      {/* Project configuration */}
      <section className="tr-section">
        <h2>1. Project Configuration</h2>
        <table className="tr-kv">
          <tbody>
            <tr>
              <th>Customer type</th><td>{customerType}</td>
              <th>Grid connection</th><td>{gridConnection}</td>
            </tr>
            <tr>
              <th>Resolved sector</th><td>{s.sector_label ?? s.sector ?? '—'}</td>
              <th>Mechanism</th><td>{s.net_billing_mechanism ?? '—'}</td>
            </tr>
            <tr>
              <th>System efficiency</th><td>{fmt(efficiency, 1)} %</td>
              <th>Annual degradation</th><td>{fmt(degradation, 2)} %/year</td>
            </tr>
            <tr>
              <th>Annual consumption</th><td>{fmt0(totalConsumption)} kWh</td>
              <th>Eligibility status</th><td>{s.eligibility_status ?? '—'}</td>
            </tr>
          </tbody>
        </table>
      </section>

      {/* System sizing */}
      <section className="tr-section">
        <h2>2. PV System Sizing</h2>
        <table className="tr-kv">
          <tbody>
            <tr>
              <th>Target monthly generation (X₂)</th><td>{fmt(s.pv_size)} kWh/month</td>
              <th>Annual generation</th><td>{fmt0(s.annual_generation)} kWh/year</td>
            </tr>
            <tr>
              <th>Inverter (kWac)</th><td>{fmt(s.inverter_size)} kWac</td>
              <th>PV array (kWp DC)</th><td>{fmt(s.kwp_dc)} kWp</td>
            </tr>
            <tr>
              <th>DC : AC ratio</th><td>{fmt(s.dc_ac_ratio)}</td>
              <th>Specific yield</th>
              <td>{fmt0(s.specific_yield_kwh_per_kwp_year)} kWh/kWp·year</td>
            </tr>
            <tr>
              <th>Inverter cap</th>
              <td>
                {s.inverter_cap_kwac != null
                  ? `${fmt(s.inverter_cap_kwac)} kWac${s.inverter_cap_binding ? ' (binding)' : ''}`
                  : '—'}
              </td>
              <th>Mechanism gen cap</th>
              <td>{fmt(s.mechanism_cap_fraction * 100, 0)} % of annual consumption</td>
            </tr>
            <tr>
              <th>Loses residential subsidy</th>
              <td>{s.loses_residential_subsidy ? 'Yes (inverter &gt; trigger)' : 'No'}</td>
              <th colSpan={2}></th>
            </tr>
          </tbody>
        </table>
      </section>

      {/* Annual financials */}
      <section className="tr-section">
        <h2>3. Annual Financial Summary</h2>
        <table className="tr-kv">
          <tbody>
            <tr>
              <th>Cost before PV</th><td>{fmt(s.cost_before)} JD</td>
              <th>Cost after PV</th><td>{fmt(s.cost_after)} JD</td>
            </tr>
            <tr>
              <th>Annual savings</th><td className="tr-emph">{fmt(s.annual_savings)} JD</td>
              <th>Export revenue</th><td>{fmt(s.export_revenue)} JD</td>
            </tr>
            <tr>
              <th>Effective export tariff</th>
              <td>{fmt(s.export_tariff, 3)} JD/kWh</td>
              <th>Grid service fee</th>
              <td>
                {fmt(s.grid_service_fee_jd_per_month)} JD/mo &middot;{' '}
                {fmt(s.grid_service_fee_jd_annual)} JD/year
              </td>
            </tr>
            <tr>
              <th>Self-consumption</th><td>{fmt0(s.total_self_consumption)} kWh</td>
              <th>Grid export</th><td>{fmt0(s.total_export)} kWh</td>
            </tr>
            <tr>
              <th>Net-billing savings</th>
              <td>{fmt(s.net_billing_savings ?? 0)} JD</td>
              <th>Final credit balance</th>
              <td>{fmt(s.final_credit_balance ?? 0)} JD</td>
            </tr>
            <tr>
              <th>Annual reset policy</th>
              <td>{s.annual_reset_policy ?? '—'}</td>
              <th>Forfeited / cashed-out credit</th>
              <td>
                {fmt(s.forfeited_credit_jd ?? 0)} / {fmt(s.cashed_out_credit_jd ?? 0)} JD
              </td>
            </tr>
          </tbody>
        </table>
      </section>

      {/* Monthly breakdown */}
      <section className="tr-section tr-page-break">
        <h2>4. Monthly Energy Balance &amp; Billing</h2>
        <table className="tr-monthly">
          <thead>
            <tr>
              <th>Month</th>
              <th>Cons (kWh)</th>
              <th>Gen (kWh)</th>
              <th>Self-cons</th>
              <th>Export</th>
              <th>Import</th>
              <th>Bill before</th>
              <th>Bill after</th>
              <th>Savings</th>
              <th>Credit bal.</th>
            </tr>
          </thead>
          <tbody>
            {months.map((m) => (
              <tr key={m.month}>
                <td>{m.month}</td>
                <td>{fmt0(m.consumption)}</td>
                <td>{fmt0(m.generation)}</td>
                <td>{fmt0(m.self_consumption)}</td>
                <td>{fmt0(m.export)}</td>
                <td>{fmt0(m.import)}</td>
                <td>{fmt(m.bill_before)}</td>
                <td>{fmt(m.bill_after)}</td>
                <td>{fmt(m.savings)}</td>
                <td>{fmt(m.running_credit_balance ?? 0)}</td>
              </tr>
            ))}
            <tr className="tr-totals">
              <td>Total</td>
              <td>{fmt0(months.reduce((a, m) => a + m.consumption, 0))}</td>
              <td>{fmt0(months.reduce((a, m) => a + m.generation, 0))}</td>
              <td>{fmt0(months.reduce((a, m) => a + m.self_consumption, 0))}</td>
              <td>{fmt0(months.reduce((a, m) => a + m.export, 0))}</td>
              <td>{fmt0(months.reduce((a, m) => a + m.import, 0))}</td>
              <td>{fmt(months.reduce((a, m) => a + m.bill_before, 0))}</td>
              <td>{fmt(months.reduce((a, m) => a + m.bill_after, 0))}</td>
              <td>{fmt(months.reduce((a, m) => a + m.savings, 0))}</td>
              <td>—</td>
            </tr>
          </tbody>
        </table>
      </section>

      {/* Methodology references */}
      <section className="tr-section">
        <h2>5. Regulatory References</h2>
        <ul className="tr-refs">
          <li>EMRC Tariff Guide 2025 (effective 1 January 2025; Arabic prevails).</li>
          <li>NEPCO bilingual schedule.</li>
          <li>Bylaw No. 58 of 2024 (Official Gazette 19 August 2024) — net-billing economics.</li>
          <li>Law No. 12 of 2024 — REEEL amendment establishing the 1 June 2024 grandfathering hinge.</li>
          <li>EMRC Chairman public statement (19 August 2024) — residential 3.6 / 10 kWac inverter caps.</li>
        </ul>
      </section>

      <footer className="tr-footer">
        <span>eSpark Engineering &middot; Solar PV Pricing &amp; Analysis</span>
        <span className="tr-pageno">Page <span className="tr-pn"></span></span>
      </footer>
    </div>
  );
}
