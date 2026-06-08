import axios from 'axios';
import type { AxiosResponse, InternalAxiosRequestConfig } from 'axios';
import { getUser } from '../utils/auth';

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:4000/api';
const demoDataBase = `${import.meta.env.BASE_URL}demo-data`;

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

function decorateReports(reports: any[], fields: any[], tractors: any[], workTypes: any[]) {
  return reports.map((report) => {
    const field = fields.find((item) => Number(item.id) === Number(report.field_id));
    const tractor = tractors.find((item) => Number(item.id) === Number(report.tractor_id));
    const workType = workTypes.find((item) => Number(item.id) === Number(report.work_type_id));
    return {
      ...report,
      field_name: report.field_name ?? field?.field_name ?? `Pole ${report.field_id}`,
      tractor_name: report.tractor_name ?? tractor?.tractor_name ?? `Stroj ${report.tractor_id}`,
      work_type: report.work_type ?? workType?.name ?? `Činnost ${report.work_type_id}`
    };
  });
}

async function getDemoDataForRequest(config: InternalAxiosRequestConfig) {
  if ((config.method ?? 'get').toLowerCase() !== 'get') return null;
  const endpoint = normalizeEndpoint(config.url);

  if (endpoint === 'fields') {
    return responseFromDemo(config, await loadDemoJson('fields.json'));
  }
  if (endpoint === 'tractors') {
    return responseFromDemo(config, await loadDemoJson('tractors.json'));
  }
  if (endpoint === 'users') {
    return responseFromDemo(config, await loadDemoJson('users.json'));
  }
  if (endpoint === 'work-types') {
    return responseFromDemo(config, await loadDemoJson('work-types.json'));
  }
  if (endpoint === 'audit') {
    const audit = await loadDemoJson<any[]>('audit-log.json');
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
  if (endpoint === 'reports' || endpoint.startsWith('reports/')) {
    const [reports, fields, tractors, workTypes] = await Promise.all([
      loadDemoJson<any[]>('reports.json'),
      loadDemoJson<any[]>('fields.json'),
      loadDemoJson<any[]>('tractors.json'),
      loadDemoJson<any[]>('work-types.json')
    ]);
    const decoratedReports = decorateReports(reports, fields, tractors, workTypes)
      .sort((first, second) => String(second.created_at ?? '').localeCompare(String(first.created_at ?? '')));
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
    const demoResponse = await getDemoDataForRequest(config);
    if (demoResponse) return demoResponse;
    throw error;
  }
);

export default client;
