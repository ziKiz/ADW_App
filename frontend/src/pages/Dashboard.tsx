import { CSSProperties, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import client from '../api/client';

interface ReportSummary {
  id: number;
  report_number: string;
  employee_name?: string;
  date: string;
  time_start: string;
  time_end: string;
  hours_worked?: number | string;
  amount_ha?: number | string;
  fuel_liters?: number | string;
  status: string;
  tractor_name: string;
  field_name: string;
  work_type: string;
}

interface AuditEntry {
  id: number;
  collection: string;
  record_id: number;
  action: string;
  changed_at: string;
  changed_by?: string;
}

function asNumber(value: number | string | undefined) {
  return Number(value ?? 0);
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('cs-CZ').format(new Date(value));
}

function formatTime(value: string) {
  return value?.slice(0, 5) ?? '';
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat('cs-CZ', {
    dateStyle: 'short',
    timeStyle: 'short'
  }).format(new Date(value));
}

function activityText(entry: AuditEntry) {
  const collectionNames: Record<string, string> = {
    fields: 'pozemek',
    tractors: 'stroj',
    users: 'organizaci',
    workTypes: 'činnost',
    reports: 'výkaz'
  };
  const actionNames: Record<string, string> = {
    create: 'vytvořil',
    update: 'upravil'
  };
  const actor = entry.changed_by || 'Systém';
  return `${actor} ${actionNames[entry.action] ?? entry.action} ${collectionNames[entry.collection] ?? entry.collection}`;
}

function calculateHours(timeStart: string, timeEnd: string) {
  return Math.max(
    0,
    (Number(timeEnd.slice(0, 2)) + Number(timeEnd.slice(3, 5)) / 60) -
      (Number(timeStart.slice(0, 2)) + Number(timeStart.slice(3, 5)) / 60)
  );
}

function isOverdue(report: ReportSummary) {
  const reportDate = new Date(`${report.date.slice(0, 10)}T12:00:00`);
  const today = new Date();
  today.setHours(12, 0, 0, 0);
  return (today.getTime() - reportDate.getTime()) / (24 * 60 * 60 * 1000) > 2;
}

function Dashboard() {
  const [reports, setReports] = useState<ReportSummary[]>([]);
  const [auditEntries, setAuditEntries] = useState<AuditEntry[]>([]);

  useEffect(() => {
    Promise.allSettled([
      client.get('/reports'),
      client.get('/audit?limit=30')
    ]).then(([reportsResponse, auditResponse]) => {
      if (reportsResponse.status === 'fulfilled') setReports(reportsResponse.value.data as ReportSummary[]);
      if (auditResponse.status === 'fulfilled') setAuditEntries(auditResponse.value.data as AuditEntry[]);
      if (reportsResponse.status === 'rejected') console.error(reportsResponse.reason);
      if (auditResponse.status === 'rejected') console.error(auditResponse.reason);
    });
  }, []);

  const pendingReports = useMemo(() => reports.filter((report) => report.status === 'pending'), [reports]);
  const overdueReports = useMemo(() => pendingReports.filter(isOverdue), [pendingReports]);
  const lastUpdated = useMemo(() => new Intl.DateTimeFormat('cs-CZ', {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(new Date()), [reports]);

  const suspiciousFuelReports = useMemo(() => pendingReports.filter((report) => {
    const amountHa = asNumber(report.amount_ha);
    if (amountHa <= 0) return false;
    return asNumber(report.fuel_liters) / amountHa > 11;
  }), [pendingReports]);

  const longShiftReports = useMemo(() => pendingReports.filter((report) =>
    calculateHours(report.time_start, report.time_end) > 10
  ), [pendingReports]);

  const employeeOptions = useMemo(() => [...new Set(reports.map((report) => report.employee_name).filter(Boolean) as string[])]
    .sort((first, second) => first.localeCompare(second, 'cs')), [reports]);

  const employeesWithoutTodayReport = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    const todayEmployees = new Set(reports.filter((report) => report.date.slice(0, 10) === today).map((report) => report.employee_name));
    return employeeOptions.filter((employee) => !todayEmployees.has(employee)).slice(0, 20);
  }, [employeeOptions, reports]);

  const machineFuel = useMemo(() => {
    const totals = new Map<string, { fuel: number; ha: number }>();
    for (const report of reports) {
      const current = totals.get(report.tractor_name) ?? { fuel: 0, ha: 0 };
      current.fuel += asNumber(report.fuel_liters);
      current.ha += asNumber(report.amount_ha);
      totals.set(report.tractor_name, current);
    }
    return [...totals.entries()]
      .map(([name, totalsValue]) => ({ name, value: totalsValue.ha > 0 ? totalsValue.fuel / totalsValue.ha : 0 }))
      .sort((first, second) => second.value - first.value)
      .slice(0, 20);
  }, [reports]);

  const recentActivity = useMemo(() => {
    if (auditEntries.length > 0) {
      return auditEntries.map((entry) => ({
        time: formatDateTime(entry.changed_at),
        text: activityText(entry)
      }));
    }
    return reports.slice(0, 20).map((report) => ({
      time: formatDate(report.date),
      text: `${report.employee_name ?? report.report_number} zadal výkaz ${report.work_type}`
    }));
  }, [auditEntries, reports]);

  const priorityReports = pendingReports.slice(0, 20);

  return (
    <div className="container approval-container">
      <section className="approval-workspace">
        <div className="page-heading">
          <div>
            <p className="eyebrow">Aktualizováno {lastUpdated}</p>
            <h1 className="page-title">Přehled vedoucího</h1>
          </div>
        </div>

        <div className="approval-metrics">
          <article className="approval-metric approval-metric--orange">
            <span className="approval-metric__icon">!</span>
            <div>
              <span>Ke schválení</span>
              <strong>{pendingReports.length}</strong>
            </div>
          </article>
          <article className="approval-metric approval-metric--red">
            <span className="approval-metric__icon">!</span>
            <div>
              <span>Po termínu</span>
              <strong>{overdueReports.length}</strong>
            </div>
          </article>
        </div>

        <section className="attention-panel">
          <h2>Na co si dát pozor</h2>
          <div className="attention-grid">
            <article><strong>{suspiciousFuelReports.length}</strong><span>výkazů má podezřelou spotřebu PHM</span></article>
            <article><strong>{longShiftReports.length}</strong><span>výkazů obsahuje směnu nad 10 hodin</span></article>
            <article><strong>{employeesWithoutTodayReport.length}</strong><span>zaměstnanci dnes ještě nemají výkaz</span></article>
          </div>
        </section>

        <section className="approval-table-panel">
          <div className="approval-panel-heading">
            <h2>Výkazy ke schválení</h2>
            {pendingReports.length > priorityReports.length ? <Link to="/approvals">Zobrazit vše ({pendingReports.length})</Link> : null}
          </div>
          {priorityReports.length === 0 ? (
            <p className="empty-state">Žádné výkazy ke schválení.</p>
          ) : (
            <div className="approval-table-scroll">
              <table className="approval-table">
                <thead>
                  <tr>
                    <th>Stav</th>
                    <th>Zaměstnanec</th>
                    <th>Datum</th>
                    <th>Činnost</th>
                    <th>Čas</th>
                    <th>Pozemek</th>
                    <th>Stroj</th>
                    <th>Výkon</th>
                    <th>Akce</th>
                  </tr>
                </thead>
                <tbody>
                  {priorityReports.map((report) => {
                    const overdue = isOverdue(report);
                    const fuelPerHa = asNumber(report.amount_ha) > 0 ? asNumber(report.fuel_liters) / asNumber(report.amount_ha) : 0;
                    return (
                      <tr key={report.id}>
                        <td data-label="Stav"><span className={overdue ? 'status-red' : 'status-orange'}>{overdue ? 'Po termínu' : 'Ke schválení'}</span></td>
                        <td data-label="Zaměstnanec">{report.employee_name ?? report.report_number}</td>
                        <td data-label="Datum">{formatDate(report.date)}</td>
                        <td data-label="Činnost">{report.work_type}</td>
                        <td data-label="Čas">{formatTime(report.time_start)}-{formatTime(report.time_end)}</td>
                        <td data-label="Pozemek">{report.field_name}</td>
                        <td data-label="Stroj">{report.tractor_name}</td>
                        <td data-label="Výkon">{asNumber(report.amount_ha).toFixed(1)} ha · {asNumber(report.fuel_liters).toFixed(0)} l · {fuelPerHa.toFixed(1)} l/ha</td>
                        <td data-label="Akce"><Link className="edit-action" to="/approvals">Otevřít</Link></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <div className="approval-bottom-grid">
          <section className="approval-small-panel">
            <h2>Kdo dnes chybí</h2>
            <div className="mini-list">
              <div className="small-panel-scroll">
                {(employeesWithoutTodayReport.length ? employeesWithoutTodayReport : employeeOptions.slice(0, 20)).map((employee) => (
                  <span key={employee}><b>{employee}</b><em>Nezadáno</em></span>
                ))}
              </div>
            </div>
          </section>
          <section className="approval-small-panel">
            <h2>Stroje a spotřeba PHM</h2>
            <div className="machine-bars">
              <div className="small-panel-scroll">
                {machineFuel.map((item) => (
                  <div key={item.name} className="machine-row">
                    <span>{item.name}</span>
                    <b><i style={{ width: `${Math.min(100, item.value * 8)}%` } as CSSProperties} /></b>
                    <strong>{item.value.toFixed(1)}</strong>
                  </div>
                ))}
              </div>
            </div>
          </section>
          <section className="approval-small-panel">
            <h2>Poslední aktivita</h2>
            <div className="activity-list">
              <div className="small-panel-scroll">
                {recentActivity.map((item) => (
                  <span key={`${item.time}-${item.text}`}><b>{item.time}</b>{item.text}</span>
                ))}
              </div>
            </div>
          </section>
        </div>
      </section>
    </div>
  );
}

export default Dashboard;
