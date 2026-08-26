import { ChangeEvent, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import client from '../api/client';
import { getUser } from '../utils/auth';
import { FieldRecord, Tractor, WorkType } from '../types';
import { formatCzechDate } from '../utils/format';

interface PendingReport {
  id: number;
  report_number: string;
  employee_name?: string;
  tractor_id?: number;
  field_id?: number;
  work_type_id?: number;
  user_id?: number;
  service_center?: string;
  date: string;
  time_start?: string | null;
  time_end?: string | null;
  tractor_name: string;
  field_name: string;
  work_type: string;
  hours_worked?: number | string;
  amount_ha?: number | string;
  fuel_liters?: number | string;
  fuel_date?: string;
  fuel_note?: string;
  field_entries?: FieldEntrySummary[] | string | null;
  notes?: string;
  status: string;
}

interface FieldEntrySummary {
  order?: number;
  field_id?: number;
  field_name?: string;
  field_code?: string;
  amount_ha?: number | string;
  processed_percent?: number | string;
}

interface EditableFieldEntry {
  id: number;
  field_id?: number;
  amount_ha: number;
  processed_percent: number;
  field_search: string;
}

function calculateHours(timeStart: string, timeEnd: string) {
  return Math.max(
    0,
    (Number(timeEnd.slice(0, 2)) + Number(timeEnd.slice(3, 5)) / 60) -
      (Number(timeStart.slice(0, 2)) + Number(timeStart.slice(3, 5)) / 60)
  );
}

function formatDate(value: string) {
  return formatCzechDate(value);
}

function normalizeTime(value?: string | null) {
  return value ? value.slice(0, 5) : '';
}

function timeToMinutes(value: string) {
  const [hours, minutes] = normalizeTime(value).split(':').map(Number);
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return 0;
  return hours * 60 + minutes;
}

function minutesToTime(minutes: number) {
  const safeMinutes = Math.max(0, Math.min(23 * 60 + 59, minutes));
  const hours = Math.floor(safeMinutes / 60);
  const restMinutes = safeMinutes % 60;
  return `${String(hours).padStart(2, '0')}:${String(restMinutes).padStart(2, '0')}`;
}

function addMinutesToTime(time: string, minutes: number) {
  return minutesToTime(timeToMinutes(time) + minutes);
}

function isEndAfterStart(start: string, end: string) {
  return timeToMinutes(end) > timeToMinutes(start);
}

function isAbsenceReport(report?: Pick<PendingReport, 'work_type'> | null) {
  return report ? ['Dovolená', 'Školení', 'Doktor'].includes(report.work_type) : false;
}

function displayTime(report: PendingReport) {
  if (isAbsenceReport(report)) return 'celý den';
  const start = normalizeTime(report.time_start);
  const end = normalizeTime(report.time_end);
  return start && end ? `${start}-${end} h` : '-';
}

function cleanDefaultNote(value?: string) {
  return value?.trim() === 'Práce proběhla bez závad.' ? '' : value;
}

function getFieldArea(fields: FieldRecord[], fieldId?: number) {
  const field = fields.find((item) => item.id === fieldId);
  return Number(field?.area ?? 0);
}

function calculateProcessedArea(fields: FieldRecord[], fieldId: number | undefined, processedPercent: number) {
  return Number((getFieldArea(fields, fieldId) * processedPercent / 100).toFixed(2));
}

function normalizeSearch(value: string) {
  return value.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLocaleLowerCase('cs-CZ').trim();
}

function fieldSearchText(field: FieldRecord) {
  return normalizeSearch(`${field.field_name} ${field.field_code} ${field.quadrant ?? ''} ${field.crop ?? ''}`);
}

function parseFieldEntries(report: PendingReport, fields: FieldRecord[]): EditableFieldEntry[] {
  let rawEntries: FieldEntrySummary[] = [];
  if (Array.isArray(report.field_entries)) {
    rawEntries = report.field_entries;
  } else if (typeof report.field_entries === 'string' && report.field_entries.trim()) {
    try {
      rawEntries = JSON.parse(report.field_entries) as FieldEntrySummary[];
    } catch {
      rawEntries = [];
    }
  }
  const entries = rawEntries
    .filter((entry) => entry.field_id)
    .map((entry, index) => ({
      id: Date.now() + index,
      field_id: Number(entry.field_id),
      amount_ha: Number(entry.amount_ha ?? calculateProcessedArea(fields, Number(entry.field_id), Number(entry.processed_percent ?? 100))),
      processed_percent: Number(entry.processed_percent ?? 100),
      field_search: ''
    }));
  if (entries.length > 0) return entries;
  if (report.field_id) {
    return [{
      id: Date.now(),
      field_id: report.field_id,
      amount_ha: Number(report.amount_ha ?? getFieldArea(fields, report.field_id)),
      processed_percent: 100,
      field_search: ''
    }];
  }
  return [{ id: Date.now(), field_id: undefined, amount_ha: 0, processed_percent: 100, field_search: '' }];
}

function getReportCenter(report: Pick<PendingReport, 'service_center' | 'notes'>) {
  const explicitCenter = String(report.service_center ?? '').trim();
  if (explicitCenter) return explicitCenter;
  const match = String(report.notes ?? '').match(/Středisko:\s*([^\n]+)/);
  return match?.[1]?.trim() ?? 'Rostlinná výroba';
}

function isScopedApprovalRole(role?: string) {
  return ['schvalovatel', 'specialista'].includes(String(role ?? '').toLocaleLowerCase('cs'));
}

function isHalfDayLeave(report: Pick<PendingReport, 'work_type' | 'hours_worked'> & { notes?: string }) {
  return report.work_type === 'Dovolená' && (Number(report.hours_worked ?? 0) === 4 || String(report.notes ?? '').includes('Půldenní dovolená: ano'));
}

function hasCompanionWorkReport(reports: PendingReport[], report: PendingReport) {
  const reportDate = String(report.date).slice(0, 10);
  return reports.some((item) =>
    item.id !== report.id &&
    String(item.date).slice(0, 10) === reportDate &&
    (item.employee_name ?? '') === (report.employee_name ?? '') &&
    !['Dovolená', 'Školení', 'Doktor'].includes(item.work_type)
  );
}

interface ApprovalDashboardProps {
  status?: 'pending' | 'approved';
}

const statusMeta = {
  pending: { title: 'Výkazy ke schválení', label: 'Ke schválení', className: 'status-orange', empty: 'Žádné výkazy ke schválení.' },
  approved: { title: 'Schválené výkazy', label: 'Schváleno', className: 'status-green', empty: 'Žádné schválené výkazy.' }
};

function ApprovalDashboard({ status = 'pending' }: ApprovalDashboardProps) {
  const [searchParams, setSearchParams] = useSearchParams();
  const [reports, setReports] = useState<PendingReport[]>([]);
  const [allReports, setAllReports] = useState<PendingReport[]>([]);
  const [filteredReports, setFilteredReports] = useState<PendingReport[]>([]);
  const [tractors, setTractors] = useState<Tractor[]>([]);
  const [fields, setFields] = useState<FieldRecord[]>([]);
  const [workTypes, setWorkTypes] = useState<WorkType[]>([]);
  const [selectedReport, setSelectedReport] = useState<PendingReport | null>(null);
  const [detailFieldEntries, setDetailFieldEntries] = useState<EditableFieldEntry[]>([]);
  const [employeeFilter, setEmployeeFilter] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [message, setMessage] = useState('');
  const user = getUser();
  const requestedReportId = searchParams.get('report');

  const loadReports = async () => {
    try {
      const [response, allResponse] = await Promise.all([
        client.get('/reports', { params: { status } }),
        client.get('/reports')
      ]);
      const filterForScope = (items: PendingReport[]) => {
        if (!isScopedApprovalRole(user?.role)) return items;
        const scope = user?.scope_department || user?.department_name;
        return items.filter((report) => (
          getReportCenter(report) === scope ||
          Number(report.user_id) === Number(user?.id) ||
          report.employee_name === user?.full_name
        ));
      };
      setReports(filterForScope(response.data as PendingReport[]));
      setAllReports(filterForScope(allResponse.data as PendingReport[]));
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
    if (!requestedReportId || fields.length === 0) return;
    openReportDetail(Number(requestedReportId));
    setSearchParams({}, { replace: true });
  }, [fields.length, requestedReportId, setSearchParams]);

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

  const openReportDetail = async (reportId: number) => {
    try {
      const response = await client.get(`/reports/${reportId}`);
      const report = response.data as PendingReport;
      setSelectedReport({
        ...report,
        date: report.date.slice(0, 10),
        time_start: normalizeTime(report.time_start),
        time_end: normalizeTime(report.time_end),
        notes: cleanDefaultNote(report.notes)
      });
      setDetailFieldEntries(parseFieldEntries(report, fields));
    } catch (error) {
      console.error(error);
      setMessage('Detail výkazu se nepodařilo načíst.');
    }
  };

  const updateSelectedReport = (changes: Partial<PendingReport>) => {
    setSelectedReport((current) => (current ? { ...current, ...changes } : current));
  };

  const updateDetailTimeStart = (value: string) => {
    setSelectedReport((current) => {
      if (!current) return current;
      const currentEnd = normalizeTime(current.time_end);
      return {
        ...current,
        time_start: value,
        time_end: isEndAfterStart(value, currentEnd) ? currentEnd : addMinutesToTime(value, 60)
      };
    });
  };

  const updateDetailTimeEnd = (value: string) => {
    if (!selectedReport) return;
    const start = normalizeTime(selectedReport.time_start);
    updateSelectedReport({ time_end: isEndAfterStart(start, value) ? value : addMinutesToTime(start, 60) });
  };

  const handleDetailNumberChange = (field: 'tractor_id' | 'work_type_id' | 'fuel_liters') =>
    (event: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
      updateSelectedReport({ [field]: Number(event.target.value) } as Partial<PendingReport>);
    };

  const updateDetailFieldEntry = (entryId: number, changes: Partial<EditableFieldEntry>) => {
    setDetailFieldEntries((entries) => entries.map((entry) => entry.id === entryId ? { ...entry, ...changes } : entry));
  };

  const getAvailableDetailFields = (currentEntryId: number) => {
    const selectedFieldIds = detailFieldEntries
      .filter((entry) => entry.id !== currentEntryId && entry.field_id !== undefined)
      .map((entry) => entry.field_id);
    return fields.filter((field) => !selectedFieldIds.includes(field.id));
  };

  const getVisibleDetailFields = (entry: EditableFieldEntry) => {
    const availableFields = getAvailableDetailFields(entry.id);
    const query = normalizeSearch(entry.field_search);
    const visibleFields = query
      ? availableFields.filter((field) => fieldSearchText(field).includes(query))
      : availableFields;
    const selectedField = fields.find((field) => field.id === entry.field_id);
    return selectedField && !visibleFields.some((field) => field.id === selectedField.id)
      ? [selectedField, ...visibleFields]
      : visibleFields;
  };

  const addDetailFieldEntry = () => {
    const firstField = getAvailableDetailFields(-1)[0];
    if (!firstField) return;
    setDetailFieldEntries((entries) => [...entries, {
      id: Date.now(),
      field_id: firstField.id,
      amount_ha: getFieldArea(fields, firstField.id),
      processed_percent: 100,
      field_search: ''
    }]);
  };

  const removeDetailFieldEntry = (entryId: number) => {
    setDetailFieldEntries((entries) => entries.filter((entry) => entry.id !== entryId));
  };

  const saveReportDetail = async () => {
    if (!selectedReport) return false;
    const absence = isAbsenceReport(selectedReport);
    const timeStart = normalizeTime(selectedReport.time_start);
    const timeEnd = normalizeTime(selectedReport.time_end);
    if (!absence && !isEndAfterStart(timeStart, timeEnd)) {
      const nextEnd = addMinutesToTime(timeStart, 60);
      updateSelectedReport({ time_end: nextEnd });
      setMessage(`Konec práce musí být po začátku. Nastavil jsem konec na ${nextEnd}.`);
      return false;
    }
    const selectedFields = absence ? [] : detailFieldEntries.filter((entry) => entry.field_id);
    const fieldSummary = selectedFields.map((entry, index) => {
      const field = fields.find((item) => item.id === entry.field_id);
      return {
        order: index + 1,
        field_id: entry.field_id,
        field_name: field?.field_name ?? '',
        field_code: field?.field_code ?? '',
        amount_ha: entry.amount_ha,
        processed_percent: entry.processed_percent
      };
    });
    const totalArea = fieldSummary.reduce((sum, entry) => sum + Number(entry.amount_ha || 0), 0);

    try {
      await client.put(`/reports/${selectedReport.id}`, {
        report_kind: absence ? (selectedReport.work_type === 'Dovolená' ? 'leave' : selectedReport.work_type === 'Doktor' ? 'doctor' : 'training') : 'work',
        tractor_id: selectedReport.tractor_id,
        user_id: selectedReport.user_id ?? user?.id ?? 1,
        field_id: fieldSummary[0]?.field_id ?? null,
        field_entries: fieldSummary,
        work_type_id: selectedReport.work_type_id,
        date: selectedReport.date,
        time_start: absence || !timeStart ? null : `${timeStart}:00`,
        time_end: absence || !timeEnd ? null : `${timeEnd}:00`,
        break_hours: 0,
        hours_worked: absence ? Number(selectedReport.hours_worked ?? 8) : calculateHours(timeStart, timeEnd),
        amount_ha: totalArea,
        fuel_liters: 0,
        fuel_entry: !absence && Number(selectedReport.fuel_liters ?? 0) > 0 ? {
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

  const handleDetailApproval = async () => {
    if (!selectedReport) return;
    if (isHalfDayLeave(selectedReport) && !hasCompanionWorkReport(allReports, selectedReport)) {
      setMessage('Půldenní dovolenou nelze schválit bez pracovní činnosti ve stejný den.');
      return;
    }
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
        <div className="segmented-control approval-status-tabs">
          <Link className={status === 'pending' ? 'active' : ''} to="/approvals">Ke schválení</Link>
          <Link className={status === 'approved' ? 'active' : ''} to="/approvals/approved">Schválené</Link>
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
          <table className="approval-table approval-table--mobile-compact">
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
                  <td className="mobile-hide" data-label="Čas">{displayTime(report)}</td>
                  <td className="mobile-hide" data-label="Pozemek">{report.field_name}</td>
                  <td className="mobile-hide" data-label="Stroj">{report.tractor_name}</td>
                  <td className="mobile-hide" data-label="Ha">{Number(report.amount_ha ?? 0).toFixed(2)}</td>
                  <td className="mobile-hide" data-label="Tankování">{Number(report.fuel_liters ?? 0).toFixed(1)} l</td>
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
          (() => {
            const absence = isAbsenceReport(selectedReport);
            return (
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
                <label className="detail-field">Zaměstnanec<input value={selectedReport.employee_name ?? ''} disabled /></label>
                <label className="detail-field">Datum<input type="date" value={selectedReport.date} onChange={(event) => updateSelectedReport({ date: event.target.value })} /></label>
                <label className="detail-field">Od<input type="time" value={normalizeTime(selectedReport.time_start)} disabled={absence} onChange={(event) => updateDetailTimeStart(event.target.value)} /></label>
                <label className="detail-field">Do<input type="time" min={normalizeTime(selectedReport.time_start)} value={normalizeTime(selectedReport.time_end)} disabled={absence} onChange={(event) => updateDetailTimeEnd(event.target.value)} /></label>
                <label className="detail-field">
                  Činnost
                  <select value={selectedReport.work_type_id ?? ''} onChange={handleDetailNumberChange('work_type_id')}>
                    {workTypes.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                  </select>
                </label>
                <div className="detail-field detail-grid__wide approval-fields-editor">
                  <div className="section-line">
                    <h3>Pozemky</h3>
                    <button type="button" className="secondary" disabled={absence || getAvailableDetailFields(-1).length === 0} onClick={addDetailFieldEntry}>Přidat pole</button>
                  </div>
                  {absence ? (
                    <p className="field-hint">Dovolená, školení a doktor pozemky nepotřebují.</p>
                  ) : (
                    <div className="repeat-list">
                      {detailFieldEntries.length === 0 ? (
                        <p className="field-hint">Ve výkazu není zadaný žádný pozemek.</p>
                      ) : null}
                      {detailFieldEntries.map((entry, index) => {
                        const visibleFields = getVisibleDetailFields(entry);
                        return (
                          <div className="repeat-row repeat-row--field" key={entry.id}>
                            <span className="row-number">{index + 1}</span>
                            <div className="field-row">
                              <label htmlFor={`approval-field-search-${entry.id}`}>Hledat pozemek</label>
                              <input
                                id={`approval-field-search-${entry.id}`}
                                type="search"
                                placeholder="Název nebo kód pole"
                                value={entry.field_search}
                                onChange={(event) => updateDetailFieldEntry(entry.id, { field_search: event.target.value })}
                              />
                              {entry.field_search ? (
                                <div className="field-search-results">
                                  {visibleFields.slice(0, 8).map((item) => (
                                    <button
                                      key={item.id}
                                      type="button"
                                      className={entry.field_id === item.id ? 'active' : ''}
                                      onClick={() => updateDetailFieldEntry(entry.id, {
                                        field_id: item.id,
                                        amount_ha: calculateProcessedArea(fields, item.id, entry.processed_percent),
                                        field_search: ''
                                      })}
                                    >
                                      <span>{item.field_name}</span>
                                      <small>{item.field_code}</small>
                                    </button>
                                  ))}
                                  {visibleFields.length === 0 ? <p>Žádný pozemek neodpovídá hledání.</p> : null}
                                </div>
                              ) : null}
                              <label htmlFor={`approval-field-${entry.id}`}>Pozemek</label>
                              <select
                                id={`approval-field-${entry.id}`}
                                value={entry.field_id ?? ''}
                                onChange={(event: ChangeEvent<HTMLSelectElement>) => {
                                  const fieldId = Number(event.target.value);
                                  updateDetailFieldEntry(entry.id, {
                                    field_id: fieldId,
                                    amount_ha: calculateProcessedArea(fields, fieldId, entry.processed_percent)
                                  });
                                }}
                              >
                                {visibleFields.length === 0 ? <option value="" disabled>Žádný pozemek neodpovídá hledání</option> : null}
                                {visibleFields.map((item) => <option key={item.id} value={item.id}>{item.field_name} ({item.field_code})</option>)}
                              </select>
                            </div>
                            <div className="field-row field-row--compact">
                              <label htmlFor={`approval-percent-${entry.id}`}>Zpracováno</label>
                              <select
                                id={`approval-percent-${entry.id}`}
                                value={entry.processed_percent}
                                onChange={(event: ChangeEvent<HTMLSelectElement>) => {
                                  const processedPercent = Number(event.target.value);
                                  updateDetailFieldEntry(entry.id, {
                                    processed_percent: processedPercent,
                                    amount_ha: calculateProcessedArea(fields, entry.field_id, processedPercent)
                                  });
                                }}
                              >
                                {[25, 50, 75, 100].map((option) => <option key={option} value={option}>{option} %</option>)}
                              </select>
                            </div>
                            <div className="field-row field-row--area">
                              <label>Výměra</label>
                              <strong>{entry.amount_ha.toFixed(2)} ha</strong>
                            </div>
                            <button type="button" className="danger repeat-remove" onClick={() => removeDetailFieldEntry(entry.id)}>Odebrat</button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
                <label className="detail-field">
                  Stroj
                  <select value={selectedReport.tractor_id ?? ''} disabled={absence} onChange={handleDetailNumberChange('tractor_id')}>
                    {absence ? <option value="">Bez stroje</option> : null}
                    {tractors.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.tractor_code && item.tractor_code !== item.tractor_name ? `${item.tractor_name} (${item.tractor_code})` : item.tractor_name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="detail-field detail-field--fuel-liters">Tankování PHM (l)<input type="number" min="0" step="0.1" value={selectedReport.fuel_liters ?? 0} disabled={absence} onChange={handleDetailNumberChange('fuel_liters')} /></label>
                <label className="detail-field detail-field--fuel-date">Datum tankování<input type="date" value={(selectedReport.fuel_date ?? selectedReport.date).slice(0, 10)} disabled={absence} onChange={(event) => updateSelectedReport({ fuel_date: event.target.value })} /></label>
                <label className="detail-field detail-grid__wide">Poznámka<textarea rows={4} value={selectedReport.notes ?? ''} onChange={(event) => updateSelectedReport({ notes: event.target.value })} /></label>
              </div>
              {status === 'pending' ? (
                <div className="modal-actions">
                  <button className="primary approve-large" type="button" onClick={handleDetailApproval}>Schválit výkaz</button>
                </div>
              ) : null}
            </div>
          </div>
            );
          })()
        ) : null}
      </div>
    </div>
  );
}

export default ApprovalDashboard;
