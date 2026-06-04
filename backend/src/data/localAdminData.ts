import fs from 'fs';
import path from 'path';
import { documentTractors, extractDocumentFields, fallbackWorkTypes } from './documentData';
import { departments, employees, organizationUsers, permissions, rolePermissions, roles, userRoles } from './organizationData';

const localDataDir = path.resolve(__dirname, '../../local-data');
const usersFile = path.join(localDataDir, 'users.json');
const fieldsFile = path.join(localDataDir, 'fields.json');
const tractorsFile = path.join(localDataDir, 'tractors.json');
const workTypesFile = path.join(localDataDir, 'work-types.json');
const auditLogFile = path.join(localDataDir, 'audit-log.json');

type AuditAction = 'create' | 'update';

interface AuditInfo {
  userId?: string;
  userName?: string;
}

interface LocalAuditMeta {
  created_at?: string;
  created_by?: string;
  updated_at?: string;
  updated_by?: string;
  last_change?: string;
}

type AnyRow = Record<string, any>;

export const fallbackUsers: Array<AnyRow & { id: number }> = organizationUsers();

interface LocalFieldRecord {
  id: number;
  field_code: string;
  field_name: string;
  quadrant: string | null;
  area: number | null;
  culture: string | null;
  crop: string | null;
  erosion: string | null;
  created_at?: string;
  created_by?: string;
  updated_at?: string;
  updated_by?: string;
  last_change?: string;
}

function ensureLocalDataDir() {
  fs.mkdirSync(localDataDir, { recursive: true });
}

function auditUser(audit?: AuditInfo) {
  return audit?.userName || (audit?.userId ? `Uživatel ${audit.userId}` : 'Systém');
}

function withInitialAudit<T extends AnyRow>(row: T, audit?: AuditInfo): T & LocalAuditMeta {
  const now = new Date().toISOString();
  const user = auditUser(audit);
  return {
    ...row,
    created_at: String(row.created_at ?? now),
    created_by: String(row.created_by ?? user),
    updated_at: String(row.updated_at ?? now),
    updated_by: String(row.updated_by ?? user),
    last_change: String(row.last_change ?? 'Vytvoření záznamu')
  };
}

function readLocal<T extends AnyRow>(filePath: string, fallback: T[]): Array<T & LocalAuditMeta> {
  try {
    const rows = JSON.parse(fs.readFileSync(filePath, 'utf8')) as T[];
    const normalized = rows.map((row) => withInitialAudit(row));
    if (JSON.stringify(rows) !== JSON.stringify(normalized)) {
      writeLocal(filePath, normalized);
    }
    return normalized;
  } catch {
    const rows = fallback.map((row) => withInitialAudit(row));
    writeLocal(filePath, rows);
    return rows;
  }
}

function writeLocal<T>(filePath: string, rows: T[]) {
  ensureLocalDataDir();
  fs.writeFileSync(filePath, `${JSON.stringify(rows, null, 2)}\n`, 'utf8');
}

function appendAuditLog(collection: string, recordId: number, action: AuditAction, before: unknown, after: unknown, audit?: AuditInfo) {
  const rows = readLocal<AnyRow>(auditLogFile, []);
  rows.push({
    id: rows.reduce((max, item) => Math.max(max, Number(item.id ?? 0)), 0) + 1,
    collection,
    record_id: recordId,
    action,
    changed_at: new Date().toISOString(),
    changed_by: auditUser(audit),
    changed_by_id: audit?.userId ?? null,
    before,
    after
  });
  writeLocal(auditLogFile, rows);
}

export function appendLocalAuditLog(collection: string, recordId: number, action: AuditAction, before: unknown, after: unknown, audit?: AuditInfo) {
  appendAuditLog(collection, recordId, action, before, after, audit);
}

function createLocal<T extends { id: number } & AnyRow>(filePath: string, fallback: T[], collection: string, input: Omit<T, 'id' | keyof LocalAuditMeta>, audit?: AuditInfo) {
  const rows = readLocal<T>(filePath, fallback);
  const now = new Date().toISOString();
  const user = auditUser(audit);
  const row = {
    ...input,
    id: rows.reduce((max, item) => Math.max(max, item.id), 0) + 1,
    created_at: now,
    created_by: user,
    updated_at: now,
    updated_by: user,
    last_change: 'Vytvoření záznamu'
  } as unknown as T & LocalAuditMeta;
  rows.push(row);
  writeLocal(filePath, rows);
  appendAuditLog(collection, row.id, 'create', null, row, audit);
  return row;
}

function updateLocal<T extends { id: number } & AnyRow>(filePath: string, fallback: T[], collection: string, id: number, changes: Partial<T>, audit?: AuditInfo) {
  const rows = readLocal<T>(filePath, fallback);
  const row = rows.find((item) => item.id === id);
  if (!row) return null;
  const before = { ...row };
  const now = new Date().toISOString();
  Object.assign(row, changes);
  Object.assign(row, {
    updated_at: now,
    updated_by: auditUser(audit),
    last_change: 'Úprava záznamu'
  });
  writeLocal(filePath, rows);
  appendAuditLog(collection, id, 'update', before, row, audit);
  return row;
}

export function getLocalUsers() {
  const rows = readLocal(usersFile, fallbackUsers);
  const legacyNames = new Set(['Tomáš Horák', 'Marek Svoboda', 'Zbyněk Kovář', 'Lukáš Novotný', 'Admin', 'Agronom', 'Ekonomka']);
  const hasLegacyDemoUsers = rows.some((row) => legacyNames.has(String(row.full_name ?? '')));
  const hasOrganizationUsers = rows.some((row) => row.full_name === 'Ing. Martina Novotná') && rows.some((row) => row.full_name === 'Ing. Petr Kuba');
  if (hasLegacyDemoUsers || !hasOrganizationUsers) {
    const seeded = fallbackUsers.map((row) => withInitialAudit(row, { userName: 'Import organizačního modelu' }));
    writeLocal(usersFile, seeded);
    appendAuditLog('users', 0, 'update', null, { imported: seeded.length, source: 'ADW Databazovy model.xlsx' }, { userName: 'Import organizačního modelu' });
    return seeded;
  }
  return rows;
}

export function createLocalUser(input: AnyRow, audit?: AuditInfo) {
  return createLocal(usersFile, fallbackUsers, 'users', input, audit);
}

export function updateLocalUser(id: number, changes: AnyRow, audit?: AuditInfo) {
  return updateLocal(usersFile, fallbackUsers, 'users', id, changes, audit);
}

export function getLocalFields() {
  const fallback: LocalFieldRecord[] = extractDocumentFields().map((field, index) => ({
    id: index + 1,
    field_code: field.code,
    field_name: field.name,
    quadrant: field.quadrant ?? null,
    area: field.area ?? null,
    culture: field.culture ?? null,
    crop: field.crop ?? null,
    erosion: field.erosion ?? null
  }));
  return readLocal(fieldsFile, fallback);
}

export function seedLocalFieldsFromDocuments(audit?: AuditInfo) {
  const user = auditUser(audit);
  const now = new Date().toISOString();
  const rows = extractDocumentFields().map((field, index) => ({
    id: index + 1,
    field_code: field.code,
    field_name: field.name,
    quadrant: field.quadrant ?? null,
    area: field.area ?? null,
    culture: field.culture ?? null,
    crop: field.crop ?? null,
    erosion: field.erosion ?? null,
    created_at: now,
    created_by: user,
    updated_at: now,
    updated_by: user,
    last_change: 'Import z Documents/Seznam poli.xlsx'
  }));
  writeLocal(fieldsFile, rows);
  appendAuditLog('fields', 0, 'update', null, { imported: rows.length, source: 'Documents/Seznam poli.xlsx' }, audit);
  return rows;
}

export function createLocalField(input: Omit<ReturnType<typeof getLocalFields>[number], 'id'>, audit?: AuditInfo) {
  return createLocal(fieldsFile, getLocalFields(), 'fields', input, audit);
}

export function updateLocalField(id: number, changes: Partial<ReturnType<typeof getLocalFields>[number]>, audit?: AuditInfo) {
  return updateLocal(fieldsFile, getLocalFields(), 'fields', id, changes, audit);
}

export function getLocalTractors() {
  const fallback = documentTractors.map((tractor, index) => ({
    id: index + 1,
    tractor_code: tractor.code,
    tractor_name: tractor.name,
    vehicle_type: 'traktor',
    status: 'active'
  }));
  return readLocal(tractorsFile, fallback);
}

export function seedLocalTractorsFromDocuments(audit?: AuditInfo) {
  const user = auditUser(audit);
  const now = new Date().toISOString();
  const rows = documentTractors.map((tractor, index) => ({
    id: index + 1,
    tractor_code: tractor.code,
    tractor_name: tractor.name,
    vehicle_type: 'traktor',
    status: 'active',
    created_at: now,
    created_by: user,
    updated_at: now,
    updated_by: user,
    last_change: 'Import z Documents/Seznam stroju.JPG'
  }));
  writeLocal(tractorsFile, rows);
  appendAuditLog('tractors', 0, 'update', null, { imported: rows.length, source: 'Documents/Seznam stroju.JPG' }, audit);
  return rows;
}

export function createLocalTractor(input: Omit<ReturnType<typeof getLocalTractors>[number], 'id'>, audit?: AuditInfo) {
  return createLocal(tractorsFile, getLocalTractors(), 'tractors', input, audit);
}

export function updateLocalTractor(id: number, changes: Partial<ReturnType<typeof getLocalTractors>[number]>, audit?: AuditInfo) {
  return updateLocal(tractorsFile, getLocalTractors(), 'tractors', id, changes, audit);
}

export function getLocalWorkTypes() {
  return readLocal(workTypesFile, fallbackWorkTypes);
}

export function createLocalWorkType(input: Omit<(typeof fallbackWorkTypes)[number], 'id'>, audit?: AuditInfo) {
  return createLocal(workTypesFile, fallbackWorkTypes, 'workTypes', input, audit);
}

export function updateLocalWorkType(id: number, changes: Partial<(typeof fallbackWorkTypes)[number]>, audit?: AuditInfo) {
  return updateLocal(workTypesFile, fallbackWorkTypes, 'workTypes', id, changes, audit);
}

export function getLocalDepartments() {
  return departments;
}

export function getLocalEmployees() {
  return employees;
}

export function getLocalRoles() {
  return roles;
}

export function getLocalPermissions() {
  return permissions;
}

export function getLocalRolePermissions() {
  return rolePermissions;
}

export function getLocalUserRoles() {
  return userRoles;
}

export function getLocalAuditLog(limit = 50) {
  return readLocal<AnyRow>(auditLogFile, [])
    .sort((first, second) => String(second.changed_at ?? '').localeCompare(String(first.changed_at ?? '')))
    .slice(0, limit);
}
