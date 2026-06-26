import { CSSProperties, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import client from '../api/client';
import { getUser } from '../utils/auth';
import { vacationBalance } from '../utils/employeeContext';
import { formatCzechDate, formatCzechDateTime } from '../utils/format';
import { addNotice, addServiceTask, getNotices, getServiceTasks, NoticeItem, ServiceTask } from '../utils/localPanels';

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
  fuel_date?: string;
  notes?: string;
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
  return formatCzechDate(value);
}

function toIsoDate(date: Date) {
  const timezoneOffsetMs = date.getTimezoneOffset() * 60 * 1000;
  return new Date(date.getTime() - timezoneOffsetMs).toISOString().slice(0, 10);
}

function formatTime(value: string) {
  return value?.slice(0, 5) ?? '';
}

function formatDateTime(value: string) {
  return formatCzechDateTime(value);
}

function parseCzechDate(value: string) {
  const match = value.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
  if (!match) return null;
  return `${match[3]}-${match[2]}-${match[1]}`;
}

function getAbsenceRange(report: ReportSummary) {
  const noteRange = String(report.notes ?? '').match(/(?:Dovolená|Školení):\s*(\d{2}\.\d{2}\.\d{4})\s*až\s*(\d{2}\.\d{2}\.\d{4})/);
  const start = noteRange ? parseCzechDate(noteRange[1]) : String(report.date).slice(0, 10);
  const end = noteRange ? parseCzechDate(noteRange[2]) : String(report.date).slice(0, 10);
  return { start: start ?? String(report.date).slice(0, 10), end: end ?? String(report.date).slice(0, 10) };
}

function activityText(entry: AuditEntry) {
  const collectionNames: Record<string, string> = {
    fields: 'pozemek',
    tractors: 'stroj',
    users: 'organizaci',
    workTypes: 'činnost',
    reports: 'výkaz',
    fuel_entries: 'tankování PHM'
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

function getPreviousWeekdays(count: number) {
  const dates: string[] = [];
  const current = new Date();
  current.setHours(12, 0, 0, 0);
  current.setDate(current.getDate() - 1);
  while (dates.length < count) {
    const day = current.getDay();
    if (day !== 0 && day !== 6) dates.push(toIsoDate(current));
    current.setDate(current.getDate() - 1);
  }
  return dates;
}

function Dashboard() {
  const [reports, setReports] = useState<ReportSummary[]>([]);
  const [auditEntries, setAuditEntries] = useState<AuditEntry[]>([]);
  const [notices, setNotices] = useState<NoticeItem[]>(getNotices);
  const [serviceTasks, setServiceTasks] = useState<ServiceTask[]>(getServiceTasks);
  const [noticeTitle, setNoticeTitle] = useState('');
  const [noticeMessage, setNoticeMessage] = useState('');
  const [serviceMachine, setServiceMachine] = useState('');
  const [serviceDescription, setServiceDescription] = useState('');
  const [serviceAvailableFrom, setServiceAvailableFrom] = useState(toIsoDate(new Date()));
  const user = getUser();

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
  const lastUpdated = useMemo(() => formatCzechDateTime(new Date()), [reports]);

  const fuelReports = useMemo(() => pendingReports.filter((report) => asNumber(report.fuel_liters) > 0), [pendingReports]);

  const longShiftReports = useMemo(() => pendingReports.filter((report) =>
    calculateHours(report.time_start, report.time_end) > 10
  ), [pendingReports]);

  const machineFuel = useMemo(() => {
    const totals = new Map<string, number>();
    for (const report of reports) {
      totals.set(report.tractor_name, (totals.get(report.tractor_name) ?? 0) + asNumber(report.fuel_liters));
    }
    return [...totals.entries()]
      .map(([name, value]) => ({ name, value }))
      .sort((first, second) => second.value - first.value)
      .slice(0, 20);
  }, [reports]);

  const canManageNotices = user?.role === 'admin' || user?.role === 'reditel';
  const canManageService = user?.role === 'admin' || user?.role === 'schvalovatel';
  const canSeeFuelOverview = user?.role === 'admin' || user?.role === 'reditel';
  const canSeeActivity = user?.role === 'admin' || user?.role === 'reditel';
  const isTractorOperator = user?.role === 'traktorista' || user?.role === 'zamestnanec';

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
  const userAllReports = useMemo(
    () => reports.filter((r) => r.employee_name === user?.full_name),
    [reports, user?.full_name]
  );
  const userReports = useMemo(() => userAllReports.slice(0, 10), [userAllReports]);
  const userReportDates = useMemo(() => new Set(userAllReports.map((report) => String(report.date).slice(0, 10))), [userAllReports]);
  const missingWeekdays = useMemo(() => getPreviousWeekdays(7).filter((day) => !userReportDates.has(day)), [userReportDates]);
  const returnedReports = useMemo(() => userAllReports.filter((report) => report.status === 'rejected'), [userAllReports]);
  const absencesToday = useMemo(() => {
    const today = toIsoDate(new Date());
    return reports
      .filter((report) => ['Dovolená', 'Školení'].includes(report.work_type))
      .map((report) => ({ report, range: getAbsenceRange(report) }))
      .filter((item) => item.range.start <= today && item.range.end >= today)
      .sort((first, second) => String(first.report.employee_name ?? '').localeCompare(String(second.report.employee_name ?? ''), 'cs-CZ'));
  }, [reports]);
  const fuelOverview = useMemo(() => {
    const now = new Date();
    const sumForDays = (days: number) => reports
      .filter((report) => {
        const reportDate = new Date(`${String(report.fuel_date || report.date).slice(0, 10)}T12:00:00`);
        return (now.getTime() - reportDate.getTime()) / (24 * 60 * 60 * 1000) <= days;
      })
      .reduce((sum, report) => sum + asNumber(report.fuel_liters), 0);
    return [
      { label: '1 den', value: sumForDays(1) },
      { label: '2 dny', value: sumForDays(2) },
      { label: '3 dny', value: sumForDays(3) },
      { label: '7 dní', value: sumForDays(7) },
      { label: '10 dní', value: sumForDays(10) },
      { label: '30 dní', value: sumForDays(30) }
    ];
  }, [reports]);

  const submitNotice = () => {
    if (!noticeTitle.trim() || !noticeMessage.trim()) return;
    const item = addNotice({ title: noticeTitle.trim(), message: noticeMessage.trim(), author: user?.full_name ?? 'Admin' });
    setNotices((items) => [item, ...items]);
    setNoticeTitle('');
    setNoticeMessage('');
  };

  const submitServiceTask = () => {
    if (!serviceMachine.trim() || !serviceDescription.trim()) return;
    const item = addServiceTask({
      machine: serviceMachine.trim(),
      description: serviceDescription.trim(),
      available_from: serviceAvailableFrom,
      created_by: user?.full_name ?? 'Admin'
    });
    setServiceTasks((items) => [item, ...items].sort((a, b) => a.available_from.localeCompare(b.available_from)));
    setServiceMachine('');
    setServiceDescription('');
  };

  const NoticePanel = (
    <section className="attention-panel notice-panel">
      <div className="approval-panel-heading">
        <h2>Informační panel</h2>
      </div>
      {canManageNotices ? (
        <div className="notice-form">
          <input placeholder="Nadpis informace" value={noticeTitle} onChange={(event) => setNoticeTitle(event.target.value)} />
          <textarea placeholder="Text pro všechny uživatele" rows={3} value={noticeMessage} onChange={(event) => setNoticeMessage(event.target.value)} />
          <button type="button" className="primary" onClick={submitNotice}>Přidat informaci</button>
        </div>
      ) : null}
      <div className="notice-list">
        {notices.map((notice) => (
          <article key={notice.id}>
            <strong>{notice.title}</strong>
            <p>{notice.message}</p>
            <small>{notice.author} · {formatDateTime(notice.created_at)}</small>
          </article>
        ))}
      </div>
    </section>
  );

  const ServicePanel = (
    <section className="approval-small-panel service-task-panel">
      <div className="approval-panel-heading">
        <h2>Servisy strojů</h2>
      </div>
      {canManageService ? (
        <div className="service-task-form">
          <input placeholder="Stroj" value={serviceMachine} onChange={(event) => setServiceMachine(event.target.value)} />
          <input placeholder="Popis servisu" value={serviceDescription} onChange={(event) => setServiceDescription(event.target.value)} />
          <label>Dostupné od<input type="date" value={serviceAvailableFrom} onChange={(event) => setServiceAvailableFrom(event.target.value)} /></label>
          <button type="button" className="secondary" onClick={submitServiceTask}>Přidat servis</button>
        </div>
      ) : null}
      <div className="service-task-list">
        {serviceTasks.map((task) => (
          <article key={task.id}>
            <strong>{task.machine}</strong>
            <span>{task.description}</span>
            <small>Dostupné od {formatDate(task.available_from)}</small>
          </article>
        ))}
      </div>
    </section>
  );

  const AbsencePanel = (
    <section className="approval-small-panel">
      <h2>Kdo dnes chybí</h2>
      <div className="mini-list">
        {absencesToday.length === 0 ? (
          <p className="empty-state empty-state--compact">Dnes nikdo není na dovolené ani školení.</p>
        ) : (
          absencesToday.map(({ report, range }) => (
            <span key={`${report.id}-${range.start}`}>
              <b>{report.employee_name ?? 'Zaměstnanec'}</b>
              {report.work_type} {formatDate(range.start)}-{formatDate(range.end)}
            </span>
          ))
        )}
      </div>
    </section>
  );

  if (isTractorOperator) {
    return (
      <div className="container approval-container">
        <section className="approval-workspace">
          <div className="page-heading">
            <div>
              <p className="eyebrow">Aktualizováno {lastUpdated}</p>
              <h1 className="page-title">Můj přehled</h1>
            </div>
            <Link to="/report" className="primary">+ Nový výkaz</Link>
          </div>

          <div className="approval-metrics employee-metrics">
            <article className="approval-metric approval-metric--orange">
              <span className="approval-metric__icon">!</span>
              <div>
                <span>Chybí výkazy</span>
                <strong>{missingWeekdays.length}</strong>
              </div>
            </article>
            <article className="approval-metric approval-metric--red">
              <span className="approval-metric__icon">!</span>
              <div>
                <span>Vráceno k úpravě</span>
                <strong>{returnedReports.length}</strong>
              </div>
            </article>
            <article className="approval-metric approval-metric--green">
              <span className="approval-metric__icon">D</span>
              <div>
                <span>Dovolená k dispozici</span>
                <strong>{vacationBalance.daysRemaining}</strong>
                <small>platné k {formatDate(vacationBalance.validTo)}</small>
              </div>
            </article>
          </div>
          {NoticePanel}

          <section className="attention-panel employee-attention">
            <h2>Co je potřeba dořešit</h2>
            <div className="employee-alert-grid employee-alert-grid--single">
              <article>
                <strong>{missingWeekdays.length ? 'Doplnit výkaz' : 'Vše vyplněno'}</strong>
                <span>{missingWeekdays.length ? `Chybí: ${missingWeekdays.map(formatDate).join(', ')}` : 'Za poslední všední dny nechybí žádný výkaz.'}</span>
              </article>
            </div>
          </section>
          {AbsencePanel}
          {ServicePanel}

          <section className="approval-table-panel">
            <div className="approval-panel-heading">
              <h2>Moje poslední výkazy</h2>
            </div>
            {userReports.length === 0 ? (
              <p className="empty-state">Žádné výkazy zatím.</p>
            ) : (
              <div className="approval-table-scroll">
                <table className="approval-table">
                  <thead>
                    <tr>
                      <th>Datum</th>
                      <th>Činnost</th>
                      <th>Čas</th>
                      <th>Pozemek</th>
                      <th>Stroj</th>
                      <th>Výkon</th>
                    </tr>
                  </thead>
                  <tbody>
                    {userReports.map((report) => (
                      <tr key={report.id}>
                        <td data-label="Datum">{formatDate(report.date)}</td>
                        <td data-label="Činnost">{report.work_type}</td>
                        <td data-label="Čas">{formatTime(report.time_start)}-{formatTime(report.time_end)}</td>
                        <td data-label="Pozemek">{report.field_name}</td>
                        <td data-label="Stroj">{report.tractor_name}</td>
                        <td data-label="Výkon">{asNumber(report.amount_ha).toFixed(1)} ha</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </section>
      </div>
    );
  }

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
        {NoticePanel}

        <section className="attention-panel">
          <h2>Na co si dát pozor</h2>
          <div className="attention-grid">
            <article><strong>{fuelReports.length}</strong><span>výkazů obsahuje tankování PHM</span></article>
            <article><strong>{longShiftReports.length}</strong><span>výkazů obsahuje směnu nad 10 hodin</span></article>
            <article><strong>{absencesToday.length}</strong><span>lidí dnes na dovolené nebo školení</span></article>
          </div>
        </section>
        {canSeeFuelOverview ? (
          <section className="attention-panel">
            <h2>Tankování PHM</h2>
            <div className="fuel-overview-grid">
              {fuelOverview.map((item) => (
                <article key={item.label}>
                  <span>{item.label}</span>
                  <strong>{item.value.toFixed(0)} l</strong>
                </article>
              ))}
            </div>
          </section>
        ) : null}

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
                    return (
                      <tr key={report.id}>
                        <td data-label="Stav"><span className={overdue ? 'status-red' : 'status-orange'}>{overdue ? 'Po termínu' : 'Ke schválení'}</span></td>
                        <td data-label="Zaměstnanec">{report.employee_name ?? report.report_number}</td>
                        <td data-label="Datum">{formatDate(report.date)}</td>
                        <td data-label="Činnost">{report.work_type}</td>
                        <td data-label="Čas">{formatTime(report.time_start)}-{formatTime(report.time_end)}</td>
                        <td data-label="Pozemek">{report.field_name}</td>
                        <td data-label="Stroj">{report.tractor_name}</td>
                        <td data-label="Výkon">{asNumber(report.amount_ha).toFixed(1)} ha · tankování {asNumber(report.fuel_liters).toFixed(0)} l</td>
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
          {ServicePanel}
          {AbsencePanel}
          <section className="approval-small-panel">
            <h2>Tankování PHM podle strojů</h2>
            <div className="machine-bars">
              <div className="small-panel-scroll">
                {machineFuel.map((item) => (
                  <div key={item.name} className="machine-row">
                    <span>{item.name}</span>
                    <b><i style={{ width: `${Math.min(100, item.value / 8)}%` } as CSSProperties} /></b>
                    <strong>{item.value.toFixed(0)} l</strong>
                  </div>
                ))}
              </div>
            </div>
          </section>
          {canSeeActivity ? (
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
          ) : null}
        </div>
      </section>
    </div>
  );
}

export default Dashboard;
