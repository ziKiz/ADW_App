import fs from 'fs';
import path from 'path';
import { appendLocalAuditLog } from './localAdminData';

export interface LocalFuelEntryInput {
  report_id: number;
  date: string;
  tractor_id: number;
  user_id: number;
  liters: number;
  note?: string;
}

export interface LocalFuelEntry extends LocalFuelEntryInput {
  id: number;
  created_at: string;
  updated_at: string;
}

const localDataDir = path.resolve(__dirname, '../../local-data');
const fuelEntriesFile = path.join(localDataDir, 'fuel-entries.json');

function ensureLocalDataDir() {
  fs.mkdirSync(localDataDir, { recursive: true });
}

function writeFuelEntries(entries: LocalFuelEntry[]) {
  ensureLocalDataDir();
  fs.writeFileSync(fuelEntriesFile, `${JSON.stringify(entries, null, 2)}\n`, 'utf8');
}

export function readFuelEntries() {
  try {
    const raw = fs.readFileSync(fuelEntriesFile, 'utf8');
    return JSON.parse(raw) as LocalFuelEntry[];
  } catch {
    writeFuelEntries([]);
    return [];
  }
}

export function listFuelEntriesForReport(reportId: number) {
  return readFuelEntries().filter((entry) => Number(entry.report_id) === Number(reportId));
}

export function summarizeFuelEntries(reportId: number, legacyFuelLiters = 0) {
  const entries = listFuelEntriesForReport(reportId);
  const liters = entries.reduce((sum, entry) => sum + Number(entry.liters || 0), 0);
  return {
    fuel_entries: entries,
    fuel_liters: liters > 0 ? liters : Number(legacyFuelLiters || 0),
    fuel_date: entries[0]?.date,
    fuel_note: entries[0]?.note
  };
}

export function createLocalFuelEntry(input: LocalFuelEntryInput) {
  const entries = readFuelEntries();
  const now = new Date().toISOString();
  const entry: LocalFuelEntry = {
    ...input,
    id: entries.reduce((maxId, item) => Math.max(maxId, item.id), 0) + 1,
    liters: Number(input.liters || 0),
    created_at: now,
    updated_at: now
  };

  entries.push(entry);
  writeFuelEntries(entries);
  appendLocalAuditLog('fuel_entries', entry.id, 'create', null, entry, {
    userId: String(input.user_id),
    userName: `Uživatel ${input.user_id}`
  });
  return entry;
}

export function replaceLocalFuelEntryForReport(reportId: number, input?: Partial<LocalFuelEntryInput>) {
  const entries = readFuelEntries();
  const before = entries.filter((entry) => Number(entry.report_id) === Number(reportId));
  const remaining = entries.filter((entry) => Number(entry.report_id) !== Number(reportId));

  if (!input || Number(input.liters || 0) <= 0) {
    writeFuelEntries(remaining);
    return null;
  }

  const now = new Date().toISOString();
  const entry: LocalFuelEntry = {
    report_id: reportId,
    date: String(input.date),
    tractor_id: Number(input.tractor_id),
    user_id: Number(input.user_id),
    liters: Number(input.liters),
    note: input.note,
    id: entries.reduce((maxId, item) => Math.max(maxId, item.id), 0) + 1,
    created_at: now,
    updated_at: now
  };

  writeFuelEntries([...remaining, entry]);
  appendLocalAuditLog('fuel_entries', entry.id, before.length ? 'update' : 'create', before, entry, {
    userId: String(entry.user_id),
    userName: `Uživatel ${entry.user_id}`
  });
  return entry;
}
