import { ChangeEvent, useEffect, useState } from 'react';
import client from '../api/client';
import { getUser } from '../utils/auth';
import { FieldRecord, Tractor, WorkType } from '../types';

interface PendingReport {
  id: number;
  report_number: string;
  employee_name?: string;
  tractor_id?: number;
  field_id?: number;
  work_type_id?: number;
  user_id?: number;
  date: string;
  time_start: string;
  time_end: string;
  tractor_name: string;
  field_name: string;
  work_type: string;
  amount_ha?: number | string;
  fuel_liters?: number | string;
  fuel_date?: string;
  fuel_note?: string;
  status: string;
}

interface EditableReport extends PendingReport {
  notes?: string;
}

function calculateHours(timeStart: string, timeEnd: string) {
  return Math.max(
    0,
    (Number(timeEnd.slice(0, 2)) + Number(timeEnd.slice(3, 5)) / 60) -
      (Number(timeStart.slice(0, 2)) + Number(timeStart.slice(3, 5)) / 60)
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('cs-CZ').format(new Date(value));
}

function calculateFieldPercent(report: EditableReport | null, fields: FieldRecord[]) {
  if (!report?.field_id) return null;
  const field = fields.find((item) => Number(item.id) === Number(report.field_id));
  const fieldArea = Number(field?.area ?? 0);
  const reportArea = Number(report.amount_ha ?? 0);
  if (!fieldArea || !reportArea) return null;
  return Math.round((reportArea / fieldArea) * 100);
}

interface ApprovalDashboardProps {
  status?: 'pending' | 'approved';
}

const statusMeta = {
  pending: { title: 'Výkazy ke schválení', label: 'Ke schválení', className: 'status-orange', empty: 'Žádné výkazy ke schválení.' },
  approved: { title: 'Schválené výkazy', label: 'Schváleno', className: 'status-green', empty: 'Žádné schválené výkazy.' }
};

function ApprovalDashboard({ status = 'pending' }: ApprovalDashboardProps) {
  const [reports, setReports] = useState<PendingReport[]>([]);
  const [filteredReports, setFilteredReports] = useState<PendingReport[]>([]);
  const [tractors, setTractors] = useState<Tractor[]>([]);
  const [fields, setFields] = useState<FieldRecord[]>([]);
  const [workTypes, setWorkTypes] = useState<WorkType[]>([]);
  const [selectedReport, setSelectedReport] = useState<EditableReport | null>(null);
  const [employeeFilter, setEmployeeFilter] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [message, setMessage] = useState('');
  const user = getUser();

  const loadReports = async () => {
    try {
      const response = await client.get('/reports', { params: { status } });
      setReports(response.data as PendingReport[]);
    } catch (error) {
      console.error(error);
    }
  };

  useEffect(() => {
    setEmployeeFilter('all');
    setDateFrom('');
    setDateTo('');
    setMessage('');
    setSelectedReport(null);
    loadReports();
    Promise.allSettled([
      client.get('/tractors'),
      client.get('/fields'),
      client.get('/work-types')
    ]).then(([tractorResponse, fieldResponse, workTypeResponse]) => {
      if (tractorResponse.status === 'fulfilled') setTractors(tractorResponse.value.data);
      if (fieldResponse.status === 'fulfilled') setFields(fieldResponse.value.data);
      if (workTypeResponse.status === 'fulfilled') setWorkTypes(workTypeResponse.value.data);
    });
  }, [status]);

  useEffect(() => {
    setFilteredReports(reports.filter((report) => {
      const employee = report.employee_name ?? report.report_number;
      const reportDate = report.date.slice(0, 10);
      return (
        (employeeFilter === 'all' || employee === employeeFilter) &&
        (!dateFrom || reportDate >= dateFrom) &&
        (!dateTo || reportDate <= dateTo)
      );
    }));
  }, [dateFrom, dateTo, employeeFilter, reports]);

  const handleApproval = async (reportId: number) => {
    try {
      await client.post(`/approvals/${reportId}`, {
        status: 'approved',
        approver_id: user?.id ?? 2,
        comment: 'Schváleno'
      });
      setMessage('Výkaz schválen.');
      loadReports();
    } catch (error) {
      console.error(error);
      setMessage('Chyba při aktualizaci výkazu.');
    }
  };

  const employeeOptions = [...new Set(reports.map((report) => report.employee_name ?? report.report_number))]
    .sort((first, second) => first.localeCompare(second, 'cs'));
  const selectedFieldPercent = calculateFieldPercent(selectedReport, fields);

  const openReportDetail = async (reportId: number) => {
    try {
      const response = await client.get(`/reports/${reportId}`);
      const report = response.data as EditableReport;
      setSelectedReport({
        ...report,
        date: report.date.slice(0, 10),
        time_start: report.time_start.slice(0, 5),
        time_end: report.time_end.slice(0, 5)
      });
    } catch (error) {
      console.error(error);
      setMessage('Detail výkazu se nepodařilo načíst.');
    }
  };

  const updateSelectedReport = (changes: Partial<EditableReport>) => {
    setSelectedReport((current) => (current ? { ...current, ...changes } : current));
  };

  const handleDetailNumberChange = (field: 'tractor_id' | 'field_id' | 'work_type_id' | 'amount_ha' | 'fuel_liters') =>
    (event: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
      updateSelectedReport({ [field]: Number(event.target.value) } as Partial<EditableReport>);
    };

  const saveReportDetail = async () => {
    if (!selectedReport) return false;

    try {
      await client.put(`/reports/${selectedReport.id}`, {
        tractor_id: selectedReport.tractor_id,
        user_id: selectedReport.user_id ?? user?.id ?? 1,
        field_id: selectedReport.field_id,
        work_type_id: selectedReport.work_type_id,
        date: selectedReport.date,
        time_start: `${selectedReport.time_start.slice(0, 5)}:00`,
        time_end: `${selectedReport.time_end.slice(0, 5)}:00`,
        break_hours: 0,
        hours_worked: calculateHours(selectedReport.time_start, selectedReport.time_end),
        amount_ha: Number(selectedReport.amount_ha ?? 0),
        fuel_liters: 0,
        fuel_entry: Number(selectedReport.fuel_liters ?? 0) > 0 ? {
          date: selectedReport.fuel_date ?? selectedReport.date,
          tractor_id: selectedReport.tractor_id,
          user_id: selectedReport.user_id ?? user?.id ?? 1,
          liters: Number(selectedReport.fuel_liters ?? 0),
          note: selectedReport.fuel_note ?? ''
        } : undefined,
        notes: selectedReport.notes ?? ''
      });
      setMessage('Výkaz byl uložen.');
      loadReports();
      return true;
    } catch (error) {
      console.error(error);
      setMessage('Výkaz se nepodařilo uložit.');
      return false;
    }
  };

  const saveAndCloseReportDetail = async () => {
    const saved = await saveReportDetail();
    if (saved) setSelectedReport(null);
  };

  const handleDetailApproval = async () => {
    if (!selectedReport) return;
    const saved = await saveReportDetail();
    if (!saved) return;

    await handleApproval(selectedReport.id);
    setSelectedReport(null);
  };

  return (
    <div className="container">
      <div className="card">
        <div className="page-heading">
          <div>
            <p className="eyebrow">Webová aplikace - schvalování</p>
            <h1 className="page-title">{statusMeta[status].title}</h1>
          </div>
        </div>
        <div className="filter-bar filter-bar--compact-approval">
          <label>
            Zaměstnanec
            <select value={employeeFilter} onChange={(event) => setEmployeeFilter(event.target.value)}>
              <option value="all">Vše</option>
              {employeeOptions.map((employee) => (
                <option key={employee} value={employee}>{employee}</option>
              ))}
            </select>
          </label>
          <label>
            Datum od
            <input type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} />
          </label>
          <label>
            Datum do
            <input type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} />
          </label>
        </div>
        {message && <p className="form-message">{message}</p>}
        {filteredReports.length === 0 ? (
          <p className="empty-state">{statusMeta[status].empty}</p>
        ) : (
          <table className="approval-table">
            <thead>
              <tr>
                <th>Zaměstnanec</th>
                <th>Datum</th>
                <th>Činnost</th>
                <th>Čas</th>
                <th>Pozemek</th>
                <th>Stroj</th>
                <th>Ha</th>
                <th>Tankování</th>
                <th>Stav</th>
                <th>Akce</th>
              </tr>
            </thead>
            <tbody>
              {filteredReports.map((report) => (
                <tr key={report.id}>
                  <td data-label="Zaměstnanec">{report.employee_name ?? report.report_number}</td>
                  <td data-label="Datum">{formatDate(report.date)}</td>
                  <td data-label="Činnost">{report.work_type}</td>
                  <td data-label="Čas">{report.time_start.slice(0, 5)} h</td>
                  <td data-label="Pozemek">{report.field_name}</td>
                  <td data-label="Stroj">{report.tractor_name}</td>
                  <td data-label="Ha">{Number(report.amount_ha ?? 0).toFixed(2)}</td>
                  <td data-label="Tankování">{Number(report.fuel_liters ?? 0).toFixed(1)} l</td>
                  <td data-label="Stav"><span className={statusMeta[status].className}>{statusMeta[status].label}</span></td>
                  <td data-label="Akce">
                    <button className="edit-action" type="button" onClick={() => openReportDetail(report.id)}>{status === 'pending' ? 'Vyřešit' : 'Detail'}</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {selectedReport ? (
          <div className="modal-backdrop" role="presentation">
            <div className="modal-panel approval-detail-modal" role="dialog" aria-modal="true" aria-labelledby="reportDetailTitle">
              <div className="modal-heading">
                <div>
                  <p className="eyebrow">Detail výkazu</p>
                  <h2 id="reportDetailTitle">{selectedReport.report_number}</h2>
                </div>
                <button className="icon-action view" type="button" aria-label="Zavřít" onClick={() => setSelectedReport(null)}>×</button>
              </div>
              <div className="detail-grid">
                <label>Zaměstnanec<input value={selectedReport.employee_name ?? ''} disabled /></label>
                <label>Datum<input type="date" value={selectedReport.date} onChange={(event) => updateSelectedReport({ date: event.target.value })} /></label>
                <label>Od<input type="time" value={selectedReport.time_start} onChange={(event) => updateSelectedReport({ time_start: event.target.value })} /></label>
                <label>Do<input type="time" value={selectedReport.time_end} onChange={(event) => updateSelectedReport({ time_end: event.target.value })} /></label>
                <label>
                  Činnost
                  <select value={selectedReport.work_type_id ?? ''} onChange={handleDetailNumberChange('work_type_id')}>
                    {workTypes.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                  </select>
                </label>
                <label>
                  Pozemek
                  <select value={selectedReport.field_id ?? ''} onChange={handleDetailNumberChange('field_id')}>
                    {fields.map((item) => <option key={item.id} value={item.id}>{item.field_name} ({item.field_code})</option>)}
                  </select>
                </label>
                <label>
                  Stroj
                  <select value={selectedReport.tractor_id ?? ''} onChange={handleDetailNumberChange('tractor_id')}>
                    {tractors.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.tractor_code && item.tractor_code !== item.tractor_name ? `${item.tractor_name} (${item.tractor_code})` : item.tractor_name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Počet ha
                  <input type="number" min="0" step="0.01" value={selectedReport.amount_ha ?? 0} onChange={handleDetailNumberChange('amount_ha')} />
                  {selectedFieldPercent !== null ? <small className="field-hint field-hint--inline">Odpovídá cca {selectedFieldPercent} % výměry pozemku.</small> : null}
                </label>
                <label>Tankování PHM (l)<input type="number" min="0" step="0.1" value={selectedReport.fuel_liters ?? 0} onChange={handleDetailNumberChange('fuel_liters')} /></label>
                <label>Datum tankování<input type="date" value={(selectedReport.fuel_date ?? selectedReport.date).slice(0, 10)} onChange={(event) => updateSelectedReport({ fuel_date: event.target.value })} /></label>
                <label className="detail-grid__wide">Poznámka<textarea rows={4} value={selectedReport.notes ?? ''} onChange={(event) => updateSelectedReport({ notes: event.target.value })} /></label>
              </div>
              <div className="modal-actions">
                <button className="secondary" type="button" onClick={() => setSelectedReport(null)}>Zavřít</button>
                <button className="secondary" type="button" onClick={saveAndCloseReportDetail}>Uložit změny</button>
                {status === 'pending' ? (
                  <button className="primary approve-large" type="button" onClick={handleDetailApproval}>Schválit výkaz</button>
                ) : null}
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export default ApprovalDashboard;
