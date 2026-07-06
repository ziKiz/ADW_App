import { useEffect, useMemo, useState } from 'react';
import client from '../api/client';
import { serviceCenters } from '../utils/employeeContext';

interface ReportSummary {
  id: number;
  employee_name?: string;
  date: string;
  hours_worked?: number | string;
  amount_ha?: number | string;
  fuel_liters?: number | string;
  tractor_name: string;
  work_type: string;
  notes?: string;
}

function asNumber(value: number | string | undefined) {
  return Number(value ?? 0);
}

function getReportCenter(report: ReportSummary) {
  const match = String(report.notes ?? '').match(/Středisko:\s*([^\n]+)/);
  return match?.[1]?.trim() ?? 'Rostlinná výroba';
}

function topItems<T>(items: T[], key: (item: T) => string, limit = 3) {
  const counts = new Map<string, number>();
  for (const item of items) counts.set(key(item), (counts.get(key(item)) ?? 0) + 1);
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit);
}

function fuelForDays(reports: ReportSummary[], days: number) {
  const now = new Date();
  return reports
    .filter((report) => {
      const date = new Date(`${String(report.date).slice(0, 10)}T12:00:00`);
      return (now.getTime() - date.getTime()) / (24 * 60 * 60 * 1000) <= days;
    })
    .reduce((sum, report) => sum + asNumber(report.fuel_liters), 0);
}

function DirectorOverview() {
  const [reports, setReports] = useState<ReportSummary[]>([]);
  const [selectedCenter, setSelectedCenter] = useState(serviceCenters[0]);

  useEffect(() => {
    client.get('/reports')
      .then((response) => setReports(response.data as ReportSummary[]))
      .catch((error) => console.error(error));
  }, []);

  const centerReports = useMemo(() => reports.filter((report) => getReportCenter(report) === selectedCenter), [reports, selectedCenter]);
  const topWork = useMemo(() => topItems(centerReports, (report) => report.work_type || '-'), [centerReports]);
  const topMachine = useMemo(() => topItems(centerReports.filter((report) => report.tractor_name !== '-'), (report) => report.tractor_name || '-')[0], [centerReports]);
  const people = useMemo(() => {
    const rows = new Map<string, { count: number; hectares: number; hours: number }>();
    for (const report of centerReports) {
      const name = report.employee_name ?? 'Neznámý';
      const current = rows.get(name) ?? { count: 0, hectares: 0, hours: 0 };
      rows.set(name, {
        count: current.count + 1,
        hectares: current.hectares + asNumber(report.amount_ha),
        hours: current.hours + asNumber(report.hours_worked)
      });
    }
    return [...rows.entries()].sort((a, b) => b[1].hectares - a[1].hectares);
  }, [centerReports]);
  const hectares = centerReports.reduce((sum, report) => sum + asNumber(report.amount_ha), 0);
  const showHectares = selectedCenter === 'Rostlinná výroba';

  return (
    <div className="container approval-container">
      <section className="approval-workspace">
        <div className="page-heading">
          <div>
            <p className="eyebrow">Ředitelství</p>
            <h1 className="page-title">Přehled ředitelství</h1>
          </div>
        </div>

        <div className="segmented-control director-center-tabs">
          {serviceCenters.map((center) => (
            <button key={center} type="button" className={center === selectedCenter ? 'active' : ''} onClick={() => setSelectedCenter(center)}>
              {center}
            </button>
          ))}
        </div>

        <div className="approval-metrics">
          {showHectares ? (
            <article className="approval-metric approval-metric--green">
              <span className="approval-metric__icon">ha</span>
              <div><span>Hektary za období</span><strong>{hectares.toFixed(1)}</strong></div>
            </article>
          ) : null}
          <article className="approval-metric approval-metric--orange">
            <span className="approval-metric__icon">PHM</span>
            <div><span>PHM za 10 dní</span><strong>{fuelForDays(centerReports, 10).toFixed(0)} l</strong></div>
          </article>
          <article className="approval-metric approval-metric--orange">
            <span className="approval-metric__icon">PHM</span>
            <div><span>PHM za 30 dní</span><strong>{fuelForDays(centerReports, 30).toFixed(0)} l</strong></div>
          </article>
        </div>

        <div className="approval-bottom-grid">
          <section className="approval-small-panel">
            <h2>Tři nejpoužívanější práce</h2>
            <div className="mini-list">
              {topWork.map(([name, count]) => <span key={name}>{name} · {count}x</span>)}
            </div>
          </section>
          <section className="approval-small-panel">
            <h2>Nejpoužívanější stroj</h2>
            <div className="mini-list">
              <span>{topMachine ? `${topMachine[0]} · ${topMachine[1]}x` : 'Bez dat'}</span>
            </div>
          </section>
          <section className="approval-small-panel">
            <h2>Co dělají lidé</h2>
            <div className="mini-list">
              {people.slice(0, 12).map(([name, value]) => (
                <span key={name}>{name}: {value.count} výkazů{showHectares ? `, ${value.hectares.toFixed(1)} ha` : ''}, {value.hours.toFixed(1)} h</span>
              ))}
            </div>
          </section>
        </div>
      </section>
    </div>
  );
}

export default DirectorOverview;
