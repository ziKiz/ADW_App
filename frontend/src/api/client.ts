import axios from 'axios';
import type { AxiosResponse, InternalAxiosRequestConfig } from 'axios';
import { getUser } from '../utils/auth';

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:4000/api';
const demoDataBase = `${import.meta.env.BASE_URL}demo-data`;
const storedReportsKey = 'adw_demo_reports';
const storedFuelEntriesKey = 'adw_demo_fuel_entries';
const storedUsersKey = 'adw_demo_users';
const storedAuditKey = 'adw_demo_audit';

const client = axios.create({
  baseURL: API_BASE,
  headers: {
    'Content-Type': 'application/json'
  }
});

async function loadDemoJson<T>(fileName: string): Promise<T> {
  const response = await fetch(`${demoDataBase}/${fileName}`);
  if (!response.ok) throw new Error(`Demo data ${fileName} nelze načíst.`);
  return response.json() as Promise<T>;
}

function responseFromDemo<T>(config: InternalAxiosRequestConfig, data: T): AxiosResponse<T> {
  return {
    data,
    status: 200,
    statusText: 'OK',
    headers: {},
    config
  };
}

function normalizeEndpoint(url = '') {
  const raw = url.startsWith('http') ? new URL(url).pathname : url;
  return raw.replace(/^\/api/, '').replace(/^\//, '').split('?')[0];
}

function getStoredJson<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const value = window.localStorage.getItem(key);
    return value ? JSON.parse(value) as T : fallback;
  } catch {
    return fallback;
  }
}

function setStoredJson(key: string, value: unknown) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(key, JSON.stringify(value));
}

function csvCell(value: unknown) {
  return `"${String(value ?? '').replace(/"/g, '""')}"`;
}

function buildReportsCsv(reports: any[]) {
  const headers = ['Číslo výkazu', 'Datum', 'Od', 'Do', 'Pauza', 'Hodiny', 'Počet ha', 'Tankování PHM (l)', 'Datum tankování', 'Stroj tankování', 'Traktor práce', 'Pole', 'Typ práce', 'Poznámka'];
  const rows = reports.map((report) => [
    report.report_number,
    String(report.date ?? '').slice(0, 10),
    report.time_start,
    report.time_end,
    report.break_hours,
    report.hours_worked,
    report.amount_ha,
    report.fuel_liters,
    report.fuel_date ? String(report.fuel_date).slice(0, 10) : '',
    report.tractor_name,
    report.tractor_name,
    report.field_name,
    report.work_type,
    String(report.notes ?? '').replace(/\n/g, ' ')
  ]);
  return [headers, ...rows].map((row) => row.map(csvCell).join(',')).join('\r\n');
}

function getReportCenter(report: any) {
  const match = String(report.notes ?? '').match(/Středisko:\s*([^\n]+)/);
  return match?.[1]?.trim() ?? 'Rostlinná výroba';
}

function appendDemoAudit(collection: string, recordId: number, action: string, before: unknown, after: unknown) {
  const audit = getStoredJson<any[]>(storedAuditKey, []);
  audit.push({
    id: audit.reduce((max, item) => Math.max(max, Number(item.id || 0)), 0) + 10000,
    collection,
    record_id: recordId,
    action,
    changed_at: new Date().toISOString(),
    changed_by: getUser()?.full_name ?? 'Demo uživatel',
    changed_by_id: getUser()?.id ?? null,
    before,
    after
  });
  setStoredJson(storedAuditKey, audit);
}

function normalizeServiceCenter(value?: string) {
  if (value === 'Bioplynová stanice') return 'BPS';
  if (value === 'Mini Mlékárna') return 'Mini mlékárna';
  return String(value ?? '').trim();
}

function isElevatedRole(role?: string) {
  return ['admin', 'reditel'].includes(String(role ?? '').toLocaleLowerCase('cs'));
}

function filterTractorsForServiceCenter(tractors: any[], serviceCenter?: string, role?: string) {
  const normalizedCenter = normalizeServiceCenter(serviceCenter);
  if (!normalizedCenter) return tractors;
  const elevated = isElevatedRole(role);
  return tractors.filter((tractor) => {
    const centers = Array.isArray(tractor.service_centers) ? tractor.service_centers : [];
    return centers.includes(normalizedCenter) || (elevated && centers.length === 0);
  });
}

function decorateReports(reports: any[], fields: any[], tractors: any[], workTypes: any[], fuelEntries: any[]) {
  return reports.map((report) => {
    const field = fields.find((item) => Number(item.id) === Number(report.field_id));
    const tractor = tractors.find((item) => Number(item.id) === Number(report.tractor_id));
    const workType = workTypes.find((item) => Number(item.id) === Number(report.work_type_id));
    const reportFuelEntries = fuelEntries.filter((item) => Number(item.report_id) === Number(report.id));
    const fuelLiters = reportFuelEntries.reduce((sum, item) => sum + Number(item.liters || 0), 0);
    return {
      ...report,
      fuel_entries: reportFuelEntries,
      fuel_liters: fuelLiters > 0 ? fuelLiters : Number(report.fuel_liters || 0),
      fuel_date: reportFuelEntries[0]?.date,
      fuel_note: reportFuelEntries[0]?.note,
      field_name: report.field_name ?? field?.field_name ?? (report.field_id ? `Pole ${report.field_id}` : '-'),
      tractor_name: report.tractor_name ?? tractor?.tractor_name ?? (report.tractor_id ? `Stroj ${report.tractor_id}` : '-'),
      work_type: report.work_type ?? workType?.name ?? `Činnost ${report.work_type_id}`
    };
  });
}

async function getDemoReports() {
  const [reports, fields, tractors, workTypes, fuelEntries] = await Promise.all([
    loadDemoJson<any[]>('reports.json'),
    loadDemoJson<any[]>('fields.json'),
    loadDemoJson<any[]>('tractors.json'),
    loadDemoJson<any[]>('work-types.json'),
    loadDemoJson<any[]>('fuel-entries.json').catch(() => [])
  ]);
  const storedReports = getStoredJson<any[]>(storedReportsKey, []);
  const storedFuelEntries = getStoredJson<any[]>(storedFuelEntriesKey, []);
  return decorateReports([...reports, ...storedReports], fields, tractors, workTypes, [...fuelEntries, ...storedFuelEntries])
    .sort((first, second) => String(second.created_at ?? '').localeCompare(String(first.created_at ?? '')));
}

async function getDemoUsers() {
  const users = await loadDemoJson<any[]>('users.json');
  const storedUsers = getStoredJson<any[]>(storedUsersKey, []);
  return users.map((user) => storedUsers.find((item) => Number(item.id) === Number(user.id)) ?? user);
}

async function createDemoReport(config: InternalAxiosRequestConfig) {
  const body = typeof config.data === 'string' ? JSON.parse(config.data) : config.data;
  const tractors = await loadDemoJson<any[]>('tractors.json');
  const allowedTractors = filterTractorsForServiceCenter(tractors, body.service_center, getUser()?.role);
  if ((!body.report_kind || body.report_kind === 'work') && !allowedTractors.some((tractor) => Number(tractor.id) === Number(body.tractor_id))) {
    throw new Error('Vybraný stroj nepatří do zvoleného střediska.');
  }
  const existingReports = await getDemoReports();
  const storedReports = getStoredJson<any[]>(storedReportsKey, []);
  const storedFuelEntries = getStoredJson<any[]>(storedFuelEntriesKey, []);
  const now = new Date().toISOString();
  const id = existingReports.reduce((maxId, report) => Math.max(maxId, Number(report.id || 0)), 0) + 1;
  const report = {
    ...body,
    id,
    fuel_liters: 0,
    status: 'pending',
    created_at: now,
    updated_at: now
  };

  storedReports.push(report);
  if (body.fuel_entry && Number(body.fuel_entry.liters || 0) > 0) {
    storedFuelEntries.push({
      ...body.fuel_entry,
      id: storedFuelEntries.reduce((maxId, entry) => Math.max(maxId, Number(entry.id || 0)), 0) + 10000,
      report_id: id,
      created_at: now,
      updated_at: now
    });
  }

  setStoredJson(storedReportsKey, storedReports);
  setStoredJson(storedFuelEntriesKey, storedFuelEntries);
  appendDemoAudit('reports', id, 'create', null, report);
  return responseFromDemo(config, { id, local: true });
}

async function updateDemoUser(config: InternalAxiosRequestConfig) {
  const body = typeof config.data === 'string' ? JSON.parse(config.data) : config.data;
  const id = Number(normalizeEndpoint(config.url).split('/')[1]);
  const users = await getDemoUsers();
  const existing = users.find((item) => Number(item.id) === id);
  if (!existing) throw new Error('Uživatel nenalezen');
  const updated = {
    ...existing,
    ...body,
    id,
    updated_at: new Date().toISOString(),
    updated_by: getUser()?.full_name ?? 'Demo uživatel',
    last_change: 'Úprava organizace'
  };
  const storedUsers = getStoredJson<any[]>(storedUsersKey, []).filter((item) => Number(item.id) !== id);
  storedUsers.push(updated);
  setStoredJson(storedUsersKey, storedUsers);
  appendDemoAudit('users', id, 'update', existing, updated);
  return responseFromDemo(config, updated);
}

async function getDemoDataForRequest(config: InternalAxiosRequestConfig) {
  if ((config.method ?? 'get').toLowerCase() !== 'get') return null;
  const endpoint = normalizeEndpoint(config.url);

  if (endpoint === 'fields') {
    return responseFromDemo(config, await loadDemoJson('fields.json'));
  }
  if (endpoint === 'tractors') {
    const tractors = await loadDemoJson<any[]>('tractors.json');
    return responseFromDemo(config, filterTractorsForServiceCenter(
      tractors,
      (config.params as any)?.service_center,
      getUser()?.role
    ));
  }
  if (endpoint === 'users') {
    return responseFromDemo(config, await getDemoUsers());
  }
  if (endpoint === 'work-types') {
    return responseFromDemo(config, await loadDemoJson('work-types.json'));
  }
  if (endpoint === 'audit') {
    const audit = [...await loadDemoJson<any[]>('audit-log.json'), ...getStoredJson<any[]>(storedAuditKey, [])];
    const limit = Number((config.params as any)?.limit ?? 50);
    return responseFromDemo(config, audit
      .sort((first, second) => String(second.changed_at ?? '').localeCompare(String(first.changed_at ?? '')))
      .slice(0, limit));
  }
  if (endpoint === 'organization') {
    const users = await loadDemoJson<any[]>('users.json');
    return responseFromDemo(config, {
      departments: [],
      employees: users,
      roles: [],
      permissions: [],
      role_permissions: [],
      user_roles: []
    });
  }
  if (endpoint === 'export/csv') {
    const status = (config.params as any)?.status ?? 'approved';
    const center = (config.params as any)?.center ?? 'all';
    const reports = (await getDemoReports()).filter((report) => (
      report.status === status &&
      (center === 'all' || getReportCenter(report) === center)
    ));
    const csv = `\uFEFF${buildReportsCsv(reports)}`;
    const data = config.responseType === 'blob' ? new Blob([csv], { type: 'text/csv;charset=utf-8' }) : csv;
    return responseFromDemo(config, data);
  }
  if (endpoint === 'reports' || endpoint.startsWith('reports/')) {
    const decoratedReports = await getDemoReports();
    if (endpoint.startsWith('reports/')) {
      const id = Number(endpoint.split('/')[1]);
      return responseFromDemo(config, decoratedReports.find((report) => Number(report.id) === id) ?? null);
    }
    const status = (config.params as any)?.status;
    return responseFromDemo(config, status ? decoratedReports.filter((report) => report.status === status) : decoratedReports);
  }

  return null;
}

client.interceptors.request.use((config) => {
  const user = getUser();
  if (user) {
    config.headers['x-user-role'] = user.role;
    config.headers['x-user-id'] = String(user.id);
    config.headers['x-user-name'] = user.full_name || user.username || user.email;
  }
  return config;
});

client.interceptors.response.use(
  (response) => response,
  async (error) => {
    const config = error.config as InternalAxiosRequestConfig | undefined;
    if (!config) throw error;
    const endpoint = normalizeEndpoint(config.url);
    if ((config.method ?? 'get').toLowerCase() === 'post' && endpoint === 'reports') {
      return createDemoReport(config);
    }
    if ((config.method ?? '').toLowerCase() === 'put' && endpoint.startsWith('users/')) {
      return updateDemoUser(config);
    }
    const demoResponse = await getDemoDataForRequest(config);
    if (demoResponse) return demoResponse;
    throw error;
  }
);

export default client;
