import fs from 'fs';
import path from 'path';
import { documentTractors, extractDocumentFields, fallbackWorkTypes } from './documentData';
import { appendLocalAuditLog } from './localAdminData';
import { departments, employees } from './organizationData';

export interface LocalReportInput {
  report_number: string;
  tractor_id: number;
  user_id: number;
  employee_name?: string;
  service_center?: string;
  field_id: number;
  field_entries?: Array<Record<string, unknown>>;
  work_type_id: number;
  date: string;
  time_start: string;
  time_end: string;
  break_hours: number;
  hours_worked: number;
  amount_ha: number;
  fuel_liters: number;
  attachments?: Array<Record<string, unknown>>;
  notes?: string;
}

export interface LocalReport extends LocalReportInput {
  id: number;
  status: string;
  created_at: string;
  updated_at: string;
}

const localDataDir = path.resolve(__dirname, '../../local-data');
const reportsFile = path.join(localDataDir, 'reports.json');

function ensureLocalDataDir() {
  fs.mkdirSync(localDataDir, { recursive: true });
}

const reportEmployees = employees.filter((employee) => employee.position.startsWith('Zaměstnanec'));
const demoEmployees = reportEmployees.map((employee) => employee.full_name);
const reportDepartments = departments.filter((department) => department.department_id !== 1);

const demoNotes = [
  'Práce proběhla bez závad.',
  'Dobré podmínky, pole suché.',
  'Mírně podmáčený okraj pozemku.',
  'Kontrola stroje po směně.',
  'Doplněno PHM na konci směny.'
];

const demoDateRange = {
  start: '2026-04-01',
  end: '2026-05-31'
};

function toIsoDate(date: Date) {
  const timezoneOffsetMs = date.getTimezoneOffset() * 60 * 1000;
  return new Date(date.getTime() - timezoneOffsetMs).toISOString().slice(0, 10);
}

function getDemoDates() {
  const dates: string[] = [];
  const current = new Date(`${demoDateRange.start}T12:00:00`);
  const end = new Date(`${demoDateRange.end}T12:00:00`);

  while (current <= end) {
    const day = current.getDay();
    if (day !== 0) {
      dates.push(toIsoDate(current));
    }
    current.setDate(current.getDate() + 1);
  }

  return dates;
}

function isAprilOrMay2026(date: string) {
  return date >= demoDateRange.start && date <= demoDateRange.end;
}

function createDemoReports(): LocalReport[] {
  const fieldsCount = Math.max(extractDocumentFields().length, 1);
  const statuses = ['pending', 'approved', 'approved', 'approved', 'rejected'];
  const demoDates = getDemoDates();
  const reportCount = 120;

  return Array.from({ length: reportCount }, (_, index) => {
    const startHour = 6 + (index % 4);
    const duration = 6.5 + (index % 4) * 0.5;
    const endHour = startHour + Math.floor(duration);
    const endMinutes = duration % 1 === 0 ? '00' : '30';
    const breakHours = index % 3 === 0 ? 0.5 : index % 5 === 0 ? 0.25 : 0;
    const hoursWorked = Math.max(0, duration - breakHours);
    const date = demoDates[index % demoDates.length];

    return {
      id: index + 1,
      report_number: `DEMO-2026-${String(index + 1).padStart(4, '0')}`,
      tractor_id: (index % documentTractors.length) + 1,
      user_id: reportEmployees[index % reportEmployees.length]?.employee_id ?? 1,
      employee_name: demoEmployees[index % demoEmployees.length],
      service_center: reportEmployees[index % reportEmployees.length]?.home_department ?? reportDepartments[index % reportDepartments.length]?.name ?? 'Rostlinná výroba',
      field_id: ((index * 13) % fieldsCount) + 1,
      work_type_id: (index % fallbackWorkTypes.length) + 1,
      date,
      time_start: `${String(startHour).padStart(2, '0')}:00:00`,
      time_end: `${String(endHour).padStart(2, '0')}:${endMinutes}:00`,
      break_hours: breakHours,
      hours_worked: Number(hoursWorked.toFixed(2)),
      amount_ha: Number((4.5 + (index % 9) * 1.35 + (index % 3) * 0.4).toFixed(2)),
      fuel_liters: Number((38 + (index % 11) * 7.5 + (index % 4) * 3).toFixed(1)),
      notes: demoNotes[index % demoNotes.length],
      status: statuses[index % statuses.length],
      created_at: `${date}T12:00:00.000Z`,
      updated_at: `${date}T12:00:00.000Z`
    };
  });
}

function normalizeReport(report: LocalReport, index: number): LocalReport {
  return {
    ...report,
    employee_name: report.employee_name ?? demoEmployees[index % demoEmployees.length],
    amount_ha: Number(report.amount_ha ?? (5 + (index % 8) * 1.15).toFixed(2)),
    fuel_liters: Number(report.fuel_liters ?? (42 + (index % 9) * 6.8).toFixed(1))
  };
}

function readReports(): LocalReport[] {
  try {
    const raw = fs.readFileSync(reportsFile, 'utf8');
    const reports = (JSON.parse(raw) as LocalReport[]).map(normalizeReport);
    const legacyDemoOnly = reports.length > 0
      && reports.every((report) => report.report_number.startsWith('DEMO-'))
      && !reports.some((report) => isAprilOrMay2026(report.date));
    if (legacyDemoOnly) {
      const demoReports = createDemoReports();
      writeReports(demoReports);
      return demoReports;
    }

    const legacyEmployeeNames = new Set(['Tomáš Horák', 'Marek Svoboda', 'Zbyněk Kovář', 'Lukáš Novotný', 'Jan Veselý', 'Martin Procházka', 'Radek Černý', 'Pavel Němec', 'Michal Král']);
    if (reports.some((report) => legacyEmployeeNames.has(String(report.employee_name ?? '')))) {
      const demoReports = createDemoReports();
      writeReports(demoReports);
      return demoReports;
    }

    const minimumDemoReports = 120;
    if (reports.length >= minimumDemoReports && reports.some((report) => isAprilOrMay2026(report.date))) {
      return reports;
    }

    const maxId = reports.reduce((max, report) => Math.max(max, report.id), 0);
    const existingNumbers = new Set(reports.map((report) => report.report_number));
    const missingReports = createDemoReports()
      .filter((report) => !existingNumbers.has(report.report_number))
      .slice(0, minimumDemoReports - reports.length)
      .map((report, index) => ({
        ...report,
        id: maxId + index + 1
      }));
    const filledReports = [...reports, ...missingReports];
    writeReports(filledReports);
    return filledReports;
  } catch {
    // The local demo database is created lazily when no database is available.
  }

  const demoReports = createDemoReports();
  writeReports(demoReports);
  return demoReports;
}

function writeReports(reports: LocalReport[]) {
  ensureLocalDataDir();
  fs.writeFileSync(reportsFile, `${JSON.stringify(reports, null, 2)}\n`, 'utf8');
}

function decorateReport(report: LocalReport) {
  const tractor = documentTractors[report.tractor_id - 1];
  const field = extractDocumentFields()[report.field_id - 1];
  const workType = fallbackWorkTypes.find((item) => item.id === report.work_type_id);

  return {
    ...report,
    employee_name: report.employee_name ?? `Zaměstnanec ${report.user_id}`,
    tractor_name: tractor?.name ?? `Traktor ${report.tractor_id}`,
    field_name: field?.name ?? `Pole ${report.field_id}`,
    work_type: workType?.name ?? `Práce ${report.work_type_id}`
  };
}

export function listLocalReports(status?: string) {
  return readReports()
    .filter((report) => (status ? report.status === status : true))
    .sort((first, second) => second.created_at.localeCompare(first.created_at))
    .map(decorateReport);
}

export function seedLocalReports() {
  const demoReports = createDemoReports();
  writeReports(demoReports);
  return demoReports;
}

export function createLocalReport(input: LocalReportInput) {
  const reports = readReports();
  const now = new Date().toISOString();
  const report: LocalReport = {
    ...input,
    id: reports.reduce((maxId, item) => Math.max(maxId, item.id), 0) + 1,
    status: 'pending',
    created_at: now,
    updated_at: now
  };

  reports.push(report);
  writeReports(reports);
  appendLocalAuditLog('reports', report.id, 'create', null, report, {
    userId: String(input.user_id),
    userName: report.employee_name ?? `Zaměstnanec ${input.user_id}`
  });
  return report;
}

export function getLocalReport(id: number) {
  const report = readReports().find((item) => item.id === id);
  return report ? decorateReport(report) : null;
}

export function updateLocalReportStatus(id: number, status: string) {
  const reports = readReports();
  const report = reports.find((item) => item.id === id);
  if (!report) return null;
  const before = { ...report };

  report.status = status;
  report.updated_at = new Date().toISOString();
  writeReports(reports);
  appendLocalAuditLog('reports', id, 'update', before, report, {
    userId: String(report.user_id),
    userName: report.employee_name ?? `Zaměstnanec ${report.user_id}`
  });
  return decorateReport(report);
}

export function updateLocalReport(id: number, input: Partial<LocalReportInput>) {
  const reports = readReports();
  const report = reports.find((item) => item.id === id);
  if (!report) return null;
  const before = { ...report };

  Object.assign(report, {
    ...input,
    tractor_id: input.tractor_id !== undefined ? Number(input.tractor_id) : report.tractor_id,
    user_id: input.user_id !== undefined ? Number(input.user_id) : report.user_id,
    field_id: input.field_id !== undefined ? Number(input.field_id) : report.field_id,
    work_type_id: input.work_type_id !== undefined ? Number(input.work_type_id) : report.work_type_id,
    break_hours: input.break_hours !== undefined ? Number(input.break_hours) : report.break_hours,
    hours_worked: input.hours_worked !== undefined ? Number(input.hours_worked) : report.hours_worked,
    amount_ha: input.amount_ha !== undefined ? Number(input.amount_ha) : report.amount_ha,
    fuel_liters: input.fuel_liters !== undefined ? Number(input.fuel_liters) : report.fuel_liters,
    updated_at: new Date().toISOString()
  });
  writeReports(reports);
  appendLocalAuditLog('reports', id, 'update', before, report, {
    userId: String(report.user_id),
    userName: report.employee_name ?? `Zaměstnanec ${report.user_id}`
  });
  return decorateReport(report);
}
