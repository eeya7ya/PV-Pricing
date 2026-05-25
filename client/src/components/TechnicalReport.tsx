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
import {
  electricalSLD,
  SingleLineDiagram,
  type ElectricalState,
} from '@/components/ElectricalDesign';

interface TechnicalReportProps {
  results: CalculationResults | undefined;
  customerType: CustomerType;
  gridConnection: GridConnection;
  consumption: MonthlyConsumption;
  efficiency: number;
  degradation: number;
  /** Electrical BoS design — used to render the single-line diagram. */
  electrical?: ElectricalState;
  /** System size (kWp DC) from PV Design — drives the SLD sizing. */
  targetKWp?: number;
}

/** Lightweight print-safe SVG line chart (canvas charts don't print reliably). */
function PrintLineChart({
  title,
  labels,
  series,
  height = 200,
}: {
  title: string;
  labels: string[];
  series: { name: string; color: string; data: number[] }[];
  height?: number;
}) {
  const width = 540;
  const pad = { l: 48, r: 14, t: 8, b: 26 };
  const plotW = width - pad.l - pad.r;
  const plotH = height - pad.t - pad.b;
  const maxV = Math.max(1, ...series.flatMap((s) => s.data));
  const n = labels.length;
  const xAt = (i: number) => pad.l + (n <= 1 ? plotW / 2 : (plotW * i) / (n - 1));
  const yAt = (v: number) => pad.t + plotH - (plotH * v) / maxV;
  const ticks = 4;

  return (
    <div className="tr-chart">
      <div className="tr-chart-title">{title}</div>
      <svg viewBox={`0 0 ${width} ${height}`} width="100%" preserveAspectRatio="xMidYMid meet">
        {Array.from({ length: ticks + 1 }).map((_, t) => {
          const v = (maxV * t) / ticks;
          const y = yAt(v);
          return (
            <g key={t}>
              <line x1={pad.l} y1={y} x2={width - pad.r} y2={y} stroke="#e5e5e5" strokeWidth={1} />
              <text x={pad.l - 6} y={y + 3} textAnchor="end" fontSize="8" fill="#666">{v.toFixed(0)}</text>
            </g>
          );
        })}
        {labels.map((lab, i) => (
          <text key={i} x={xAt(i)} y={height - pad.b + 14} textAnchor="middle" fontSize="8" fill="#666">{lab}</text>
        ))}
        {series.map((s, si) => {
          const d = s.data
            .map((v, i) => `${i === 0 ? 'M' : 'L'} ${xAt(i).toFixed(1)} ${yAt(v).toFixed(1)}`)
            .join(' ');
          return (
            <g key={si}>
              <path d={d} fill="none" stroke={s.color} strokeWidth={2} />
              {s.data.map((v, i) => (
                <circle key={i} cx={xAt(i)} cy={yAt(v)} r={2} fill={s.color} />
              ))}
            </g>
          );
        })}
      </svg>
      <div className="tr-chart-legend">
        {series.map((s, i) => (
          <span key={i} className="tr-legend-item">
            <span className="tr-legend-swatch" style={{ background: s.color }} /> {s.name}
          </span>
        ))}
      </div>
    </div>
  );
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
  electrical,
  targetKWp,
}: TechnicalReportProps) {
  if (!results) return null;
  const s = results.annual_summary as any;
  const months = results.monthly_data;
  const monthLabels = months.map((m) => m.month);
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
        <h1 className="tr-title">eSpark Solar — Technical Analysis Report</h1>
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
              <th>Sizing source</th>
              <td colSpan={3}>
                {s.pv_design_active
                  ? 'PV Design module (Jordan resource model — region × tilt × full loss chain)'
                  : 'Consumption-based default (X₂ = consumption ÷ 12 × mechanism cap)'}
              </td>
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

      {/* Performance charts */}
      <section className="tr-section tr-page-break">
        <h2>4. Performance Charts</h2>
        <div className="tr-chart-grid">
          <PrintLineChart
            title="Monthly PV generation (kWh)"
            labels={monthLabels}
            series={[{ name: 'Generation', color: '#f59e0b', data: months.map((m) => m.generation) }]}
          />
          <PrintLineChart
            title="Monthly bill — before vs after (JD)"
            labels={monthLabels}
            series={[
              { name: 'Before PV', color: '#dc2626', data: months.map((m) => m.bill_before) },
              { name: 'After PV', color: '#16a34a', data: months.map((m) => m.bill_after) },
            ]}
          />
        </div>
      </section>

      {/* Electrical single-line diagram */}
      {electrical && (
        <section className="tr-section">
          <h2>5. Electrical Single-Line Diagram</h2>
          <div className="tr-sld">
            <SingleLineDiagram {...electricalSLD(electrical, targetKWp && targetKWp > 0 ? targetKWp : 5)} responsive />
          </div>
          <p className="tr-note">
            String, cable and protection sizing per IEC 62548 / 60364. Verify against the actual
            datasheets and DISCO connection rules before procurement.
          </p>
        </section>
      )}

      {/* Monthly breakdown */}
      <section className="tr-section tr-page-break">
        <h2>6. Monthly Energy Balance &amp; Billing</h2>
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
        <h2>7. Regulatory References</h2>
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
