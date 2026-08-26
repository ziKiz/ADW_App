import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import client from '../api/client';
import { getUser } from '../utils/auth';
import { getUserServiceCenter } from '../utils/employeeContext';
import { formatCzechDate, formatCzechDateTime } from '../utils/format';
import { NoticeItem, ServiceTask } from '../utils/localPanels';

interface ReportSummary {
  id: number;
  report_number: string;
  employee_name?: string;
  date: string;
  time_start?: string;
  time_end?: string;
  hours_worked?: number | string;
  amount_ha?: number | string;
  fuel_liters?: number | string;
  fuel_date?: string;
  notes?: string;
  report_kind?: string;
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

function formatTime(value?: string) {
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
  const noteRange = String(report.notes ?? '').match(/(?:Dovolená|Školení|Doktor):\s*(\d{2}\.\d{2}\.\d{4})\s*(?:až\s*)?(\d{2}\.\d{2}\.\d{4})?/);
  const start = noteRange ? parseCzechDate(noteRange[1]) : String(report.date).slice(0, 10);
  const end = noteRange?.[2] ? parseCzechDate(noteRange[2]) : String(report.date).slice(0, 10);
  return { start: start ?? String(report.date).slice(0, 10), end: end ?? String(report.date).slice(0, 10) };
}

function activityText(entry: AuditEntry) {
  const collectionNames: Record<string, string> = {
    fields: 'pozemek',
    tractors: 'stroj',
    users: 'organizaci',
    workTypes: 'činnost',
    reports: 'výkaz',
    fuel_entries: 'tankování PHM',
    notices: 'informaci na panelu',
    machine_service_tasks: 'servis stroje'
  };
  const actionNames: Record<string, string> = {
    create: 'vytvořil',
    update: 'upravil',
    archive: 'archivoval',
    approval: 'schválil',
    submit: 'odeslal',
    save: 'uložil'
  };
  const actor = entry.changed_by || 'Systém';
  return `${actor} ${actionNames[entry.action] ?? entry.action} ${collectionNames[entry.collection] ?? entry.collection}`;
}

function calculateHours(timeStart?: string, timeEnd?: string) {
  if (!timeStart || !timeEnd) return 0;
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

function getReportCenter(report: Pick<ReportSummary, 'notes'>) {
  const match = String(report.notes ?? '').match(/Středisko:\s*([^\n]+)/);
  return match?.[1]?.trim() ?? 'Rostlinná výroba';
}

function isAbsenceReport(report: Pick<ReportSummary, 'work_type'>) {
  return ['Dovolená', 'Školení', 'Doktor'].includes(report.work_type);
}

function isScopedApprovalRole(role?: string) {
  return ['schvalovatel', 'specialista'].includes(String(role ?? '').toLocaleLowerCase('cs'));
}

function displayReportTime(report: ReportSummary) {
  if (isAbsenceReport(report)) return 'celý den';
  const start = formatTime(report.time_start);
  const end = formatTime(report.time_end);
  return start && end ? `${start}-${end}` : '-';
}

function displayReportPerformance(report: ReportSummary) {
  if (isAbsenceReport(report)) return '-';
  return `${asNumber(report.amount_ha).toFixed(1)} ha`;
}

function canReadAudit(role?: string) {
  return ['admin', 'reditel'].includes(String(role ?? '').toLocaleLowerCase('cs'));
}

function Dashboard() {
  const [reports, setReports] = useState<ReportSummary[]>([]);
  const [auditEntries, setAuditEntries] = useState<AuditEntry[]>([]);
  const [notices, setNotices] = useState<NoticeItem[]>([]);
  const [serviceTasks, setServiceTasks] = useState<ServiceTask[]>([]);
  const [noticeTitle, setNoticeTitle] = useState('');
  const [noticeMessage, setNoticeMessage] = useState('');
  const [serviceMachine, setServiceMachine] = useState('');
  const [serviceDescription, setServiceDescription] = useState('');
  const [panelMessage, setPanelMessage] = useState('');
  const [selectedUserReport, setSelectedUserReport] = useState<ReportSummary | null>(null);
  const user = getUser();
  const showAuditFeed = canReadAudit(user?.role);

  useEffect(() => {
    Promise.allSettled([
      client.get('/reports'),
      showAuditFeed ? client.get('/audit?limit=30') : Promise.resolve({ data: [] }),
      client.get('/notices'),
      client.get('/service-tasks')
    ]).then(([reportsResponse, auditResponse, noticesResponse, serviceTasksResponse]) => {
      if (reportsResponse.status === 'fulfilled') setReports(reportsResponse.value.data as ReportSummary[]);
      if (auditResponse.status === 'fulfilled') setAuditEntries(auditResponse.value.data as AuditEntry[]);
      if (noticesResponse.status === 'fulfilled') setNotices(noticesResponse.value.data as NoticeItem[]);
      if (serviceTasksResponse.status === 'fulfilled') setServiceTasks(serviceTasksResponse.value.data as ServiceTask[]);
      if (reportsResponse.status === 'rejected') console.error(reportsResponse.reason);
      if (showAuditFeed && auditResponse.status === 'rejected') console.error(auditResponse.reason);
      if (noticesResponse.status === 'rejected') console.error(noticesResponse.reason);
      if (serviceTasksResponse.status === 'rejected') console.error(serviceTasksResponse.reason);
    });
  }, [showAuditFeed]);

  const userServiceCenter = getUserServiceCenter(user);
  const visibleReports = useMemo(() => {
    if (!isScopedApprovalRole(user?.role)) return reports;
    return reports.filter((report) => (
      getReportCenter(report) === userServiceCenter ||
      report.employee_name === user?.full_name
    ));
  }, [reports, user?.full_name, user?.role, userServiceCenter]);
  const pendingReports = useMemo(() => visibleReports.filter((report) => report.status === 'pending'), [visibleReports]);
  const overdueReports = useMemo(() => pendingReports.filter(isOverdue), [pendingReports]);
  const lastUpdated = useMemo(() => formatCzechDateTime(new Date()), [reports]);

  const fuelReports = useMemo(() => pendingReports.filter((report) => asNumber(report.fuel_liters) > 0), [pendingReports]);

  const longShiftReports = useMemo(() => pendingReports.filter((report) =>
    calculateHours(report.time_start, report.time_end) > 10
  ), [pendingReports]);

  const fuelSourceReports = useMemo(() => {
    if (user?.role === 'schvalovatel' || user?.role === 'specialista') {
      return visibleReports.filter((report) => getReportCenter(report) === userServiceCenter);
    }
    return visibleReports;
  }, [user?.role, userServiceCenter, visibleReports]);

  const machineFuel = useMemo(() => {
    const totals = new Map<string, number>();
    for (const report of fuelSourceReports) {
      totals.set(report.tractor_name, (totals.get(report.tractor_name) ?? 0) + asNumber(report.fuel_liters));
    }
    return [...totals.entries()]
      .map(([name, value]) => ({ name, value }))
      .sort((first, second) => second.value - first.value)
      .slice(0, 20);
  }, [fuelSourceReports]);

  const canManageNotices = user?.role === 'admin' || user?.role === 'reditel';
  const canArchiveNotices = user?.role === 'admin';
  const canManageService = user?.role === 'admin' || user?.role === 'schvalovatel';
  const canSeeFuelOverview = ['admin', 'reditel', 'schvalovatel', 'specialista'].includes(user?.role ?? '');
  const canSeeActivity = user?.role === 'admin' || user?.role === 'reditel';
  const isTractorOperator = user?.role === 'traktorista' || user?.role === 'zamestnanec';

  const recentActivity = useMemo(() => {
    if (auditEntries.length > 0) {
      return auditEntries.map((entry) => ({
        key: `audit-${entry.id}`,
        time: formatDateTime(entry.changed_at),
        text: activityText(entry)
      }));
    }
    return visibleReports.slice(0, 20).map((report) => ({
      key: `report-${report.id}`,
      time: formatDate(report.date),
      text: `${report.employee_name ?? report.report_number} zadal výkaz ${report.work_type}`
    }));
  }, [auditEntries, visibleReports]);

  const priorityReports = pendingReports.slice(0, 20);
  const userAllReports = useMemo(
    () => visibleReports.filter((r) => r.employee_name === user?.full_name),
    [user?.full_name, visibleReports]
  );
  const userReports = useMemo(() => userAllReports.slice(0, 10), [userAllReports]);
  const userReportDates = useMemo(() => new Set(userAllReports.map((report) => String(report.date).slice(0, 10))), [userAllReports]);
  const missingWeekdays = useMemo(() => getPreviousWeekdays(7).filter((day) => !userReportDates.has(day)), [userReportDates]);
  const returnedReports = useMemo(() => userAllReports.filter((report) => report.status === 'rejected'), [userAllReports]);
  const needsAttentionCount = missingWeekdays.length + returnedReports.length;
  const absencesToday = useMemo(() => {
    const today = toIsoDate(new Date());
    return visibleReports
      .filter((report) => ['Dovolená', 'Školení', 'Doktor'].includes(report.work_type))
      .map((report) => ({ report, range: getAbsenceRange(report) }))
      .filter((item) => item.range.start <= today && item.range.end >= today)
      .sort((first, second) => String(first.report.employee_name ?? '').localeCompare(String(second.report.employee_name ?? ''), 'cs-CZ'));
  }, [visibleReports]);
  const fuelOverview = useMemo(() => {
    const now = new Date();
    const sumForDays = (days: number) => fuelSourceReports
      .filter((report) => {
        const reportDate = new Date(`${String(report.fuel_date || report.date).slice(0, 10)}T12:00:00`);
        return (now.getTime() - reportDate.getTime()) / (24 * 60 * 60 * 1000) <= days;
      })
      .reduce((sum, report) => sum + asNumber(report.fuel_liters), 0);
    return [
      { label: userServiceCenter, value: sumForDays(7) }
    ];
  }, [fuelSourceReports, userServiceCenter]);

  const submitNotice = async () => {
    if (!noticeTitle.trim() || !noticeMessage.trim()) {
      setPanelMessage('Vyplňte nadpis i text informace.');
      return;
    }
    try {
      setPanelMessage('Ukládám informaci...');
      const response = await client.post('/notices', { title: noticeTitle.trim(), message: noticeMessage.trim(), author: user?.full_name ?? 'Admin' });
      const item = response.data as NoticeItem;
      setNotices((items) => [item, ...items]);
      if (showAuditFeed) {
        client.get('/audit?limit=30').then((response) => setAuditEntries(response.data as AuditEntry[])).catch((error) => console.error(error));
      }
      setNoticeTitle('');
      setNoticeMessage('');
      setPanelMessage('Informace byla přidána.');
    } catch (error) {
      console.error(error);
      setPanelMessage('Informaci se nepodařilo přidat.');
    }
  };

  const archiveNotice = async (id: number) => {
    try {
      await client.post(`/notices/${id}/archive`);
      setNotices((items) => items.filter((item) => item.id !== id));
      if (showAuditFeed) {
        client.get('/audit?limit=30').then((response) => setAuditEntries(response.data as AuditEntry[])).catch((error) => console.error(error));
      }
      setPanelMessage('Informace byla archivována.');
    } catch (error) {
      console.error(error);
      setPanelMessage('Informaci se nepodařilo archivovat.');
    }
  };

  const submitServiceTask = async () => {
    if (!serviceMachine.trim() || !serviceDescription.trim()) {
      setPanelMessage('Vyplňte stroj i popis servisu.');
      return;
    }
    try {
      setPanelMessage('Ukládám servis...');
      const response = await client.post('/service-tasks', {
        machine: serviceMachine.trim(),
        description: serviceDescription.trim(),
        created_by: user?.full_name ?? 'Admin'
      });
      const item = response.data as ServiceTask;
      setServiceTasks((items) => [item, ...items]);
      setServiceMachine('');
      setServiceDescription('');
      setPanelMessage('Servis byl přidán.');
    } catch (error) {
      console.error(error);
      setPanelMessage('Servis se nepodařilo přidat.');
    }
  };

  const archiveService = async (id: number) => {
    try {
      await client.post(`/service-tasks/${id}/archive`);
      setServiceTasks((items) => items.filter((item) => item.id !== id));
      setPanelMessage('Servis byl archivován.');
    } catch (error) {
      console.error(error);
      setPanelMessage('Servis se nepodařilo archivovat.');
    }
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
      {panelMessage ? <p className="form-message form-message--info">{panelMessage}</p> : null}
      <div className="notice-list">
        {notices.map((notice) => (
          <article key={notice.id}>
            <strong>{notice.title}</strong>
            <p>{notice.message}</p>
            <small>{notice.author} · {formatDateTime(notice.created_at)}</small>
            {canArchiveNotices ? (
              <button type="button" className="edit-action service-archive-action" onClick={() => archiveNotice(notice.id)}>Smazat</button>
            ) : null}
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
          <button type="button" className="secondary" onClick={submitServiceTask}>Přidat servis</button>
        </div>
      ) : null}
      <div className="service-task-list">
        {serviceTasks.map((task) => (
          <article key={task.id}>
            <strong>{task.machine}</strong>
            <span>{task.description}</span>
            {user?.role === 'admin' ? (
              <button type="button" className="edit-action service-archive-action" onClick={() => archiveService(task.id)}>Archivovat</button>
            ) : null}
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
          <p className="empty-state empty-state--compact">Dnes nikdo není na dovolené, školení ani u doktora.</p>
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

          <section className="attention-panel employee-attention employee-attention--summary">
            <div>
              <h2>{needsAttentionCount ? 'Vyžaduje pozornost' : 'Vše v pořádku'}</h2>
              <p>
                {needsAttentionCount
                  ? [
                      missingWeekdays.length ? `Chybí výkazy: ${missingWeekdays.map(formatDate).join(', ')}` : '',
                      returnedReports.length ? `Vráceno k úpravě: ${returnedReports.length}` : ''
                    ].filter(Boolean).join(' · ')
                  : 'Za poslední všední dny nechybí žádný výkaz a nic není vráceno k úpravě.'}
              </p>
            </div>
            <strong>{needsAttentionCount}</strong>
          </section>
          {NoticePanel}
          {ServicePanel}

          <section className="approval-table-panel">
            <div className="approval-panel-heading">
              <h2>Moje poslední výkazy</h2>
            </div>
            {userReports.length === 0 ? (
              <p className="empty-state">Žádné výkazy zatím.</p>
            ) : (
              <div className="approval-table-scroll">
                <table className="approval-table approval-table--mobile-compact approval-table--employee-recent">
                  <thead>
                  <tr>
                    <th>Datum</th>
                    <th>Činnost</th>
                    <th>Čas</th>
                    <th>Pozemek</th>
                    <th>Stroj</th>
                    <th>Výkon</th>
                    <th>Detail</th>
                  </tr>
                  </thead>
                  <tbody>
                    {userReports.map((report) => (
                      <tr key={report.id}>
                        <td data-label="Datum">{formatDate(report.date)}</td>
                        <td data-label="Činnost">{report.work_type}</td>
                        <td className="mobile-hide" data-label="Čas">{displayReportTime(report)}</td>
                        <td className="mobile-hide" data-label="Pozemek">{isAbsenceReport(report) ? '-' : report.field_name}</td>
                        <td className="mobile-hide" data-label="Stroj">{isAbsenceReport(report) ? '-' : report.tractor_name}</td>
                        <td data-label="Výkon">{displayReportPerformance(report)}</td>
                        <td data-label="Detail"><button className="edit-action" type="button" onClick={() => setSelectedUserReport(report)}>Detail</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
          {selectedUserReport ? (
            <div className="modal-backdrop" role="presentation">
              <div className="modal-panel approval-detail-modal" role="dialog" aria-modal="true" aria-labelledby="userReportDetailTitle">
                <div className="modal-heading">
                  <div>
                    <p className="eyebrow">Náhled výkazu</p>
                    <h2 id="userReportDetailTitle">{selectedUserReport.report_number}</h2>
                  </div>
                  <button className="icon-action view" type="button" aria-label="Zavřít" onClick={() => setSelectedUserReport(null)}>×</button>
                </div>
                <div className="readonly-detail-grid">
                  <div><span>Datum</span><strong>{formatDate(selectedUserReport.date)}</strong></div>
                  <div><span>Činnost</span><strong>{selectedUserReport.work_type}</strong></div>
                  <div><span>Čas</span><strong>{displayReportTime(selectedUserReport)}</strong></div>
                  <div><span>Stav</span><strong>{selectedUserReport.status}</strong></div>
                  <div><span>Pozemek</span><strong>{isAbsenceReport(selectedUserReport) ? '-' : selectedUserReport.field_name}</strong></div>
                  <div><span>Stroj</span><strong>{isAbsenceReport(selectedUserReport) ? '-' : selectedUserReport.tractor_name}</strong></div>
                  <div><span>Výkon</span><strong>{displayReportPerformance(selectedUserReport)}</strong></div>
                  <div><span>Tankování</span><strong>{asNumber(selectedUserReport.fuel_liters).toFixed(1)} l</strong></div>
                  <div className="readonly-detail-grid__wide"><span>Poznámka</span><p>{selectedUserReport.notes || '-'}</p></div>
                </div>
              </div>
            </div>
          ) : null}
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
              <span>Výkazy ke schválení</span>
              <strong>{pendingReports.length}</strong>
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
                  <span>{item.label} za 7 dní</span>
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
              <table className="approval-table approval-table--mobile-compact approval-table--approval-summary">
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
                        <td className="mobile-hide" data-label="Čas">{formatTime(report.time_start)}-{formatTime(report.time_end)}</td>
                        <td className="mobile-hide" data-label="Pozemek">{report.field_name}</td>
                        <td className="mobile-hide" data-label="Stroj">{report.tractor_name}</td>
                        <td className="mobile-hide" data-label="Výkon">{isAbsenceReport(report) ? '-' : `${asNumber(report.amount_ha).toFixed(1)} ha · tankování ${asNumber(report.fuel_liters).toFixed(0)} l`}</td>
                        <td data-label="Akce"><Link className="edit-action" to={`/approvals?report=${report.id}`}>Otevřít</Link></td>
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
          {canSeeFuelOverview ? (
            <section className="approval-small-panel">
              <h2>Tankování PHM podle strojů</h2>
              <div className="machine-fuel-list small-panel-scroll">
                {machineFuel.length === 0 ? (
                  <p className="empty-state empty-state--compact">Žádné tankování PHM v aktuálním přehledu.</p>
                ) : (
                  machineFuel.map((item) => (
                    <div key={item.name} className="machine-fuel-row">
                      <span>{item.name}</span>
                      <strong>{item.value.toFixed(0)} l</strong>
                    </div>
                  ))
                )}
              </div>
            </section>
          ) : null}
          {canSeeActivity ? (
          <section className="approval-small-panel">
            <h2>Poslední aktivita</h2>
            <div className="activity-list">
              <div className="small-panel-scroll">
                {recentActivity.map((item) => (
                  <span key={item.key}><b>{item.time}</b>{item.text}</span>
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
