import { useEffect, useMemo, useState } from 'react';
import client from '../api/client';
import { formatCzechDateTime } from '../utils/format';

interface AuditEntry {
  id: number;
  collection: string;
  record_id: number;
  action: string;
  changed_at: string;
  changed_by?: string;
  before_data?: unknown;
  after_data?: unknown;
  before?: unknown;
  after?: unknown;
}

const collectionLabels: Record<string, string> = {
  notices: 'Informace',
  machine_service_tasks: 'Servis',
  reports: 'Výkaz',
  fuel_entries: 'Tankování PHM',
  users: 'Uživatel',
  fields: 'Pozemek',
  tractors: 'Stroj',
  attachments: 'Přípojné zařízení',
  work_types: 'Typ práce',
  contacts: 'Kontakt'
};

const actionLabels: Record<string, string> = {
  create: 'Vytvořeno',
  update: 'Upraveno',
  delete: 'Smazáno',
  archive: 'Archivováno',
  approval: 'Schváleno',
  submit: 'Odesláno',
  save: 'Uloženo'
};

function readPayload(value: unknown) {
  if (!value) return null;
  if (typeof value === 'string') {
    try {
      return JSON.parse(value) as Record<string, unknown>;
    } catch {
      return { text: value };
    }
  }
  return value as Record<string, unknown>;
}

function preferredPayload(entry: AuditEntry) {
  return readPayload(entry.after_data ?? entry.after) ?? readPayload(entry.before_data ?? entry.before) ?? {};
}

function recordTitle(entry: AuditEntry) {
  const payload = preferredPayload(entry);
  return String(
    payload.title ??
    payload.machine ??
    payload.report_number ??
    payload.full_name ??
    payload.field_name ??
    payload.tractor_name ??
    payload.attachment_name ??
    payload.name ??
    `Záznam ${entry.record_id}`
  );
}

function recordDescription(entry: AuditEntry) {
  const payload = preferredPayload(entry);
  const parts = [
    payload.message,
    payload.description,
    payload.notes,
    payload.created_at ? `Od: ${formatCzechDateTime(String(payload.created_at))}` : '',
    payload.archived_at ? `Do: ${formatCzechDateTime(String(payload.archived_at))}` : '',
    payload.date ? `Datum: ${String(payload.date).slice(0, 10)}` : '',
    payload.time_start && payload.time_end ? `Čas: ${String(payload.time_start).slice(0, 5)}-${String(payload.time_end).slice(0, 5)}` : '',
    payload.liters ? `PHM: ${payload.liters} l` : ''
  ].filter(Boolean);
  return parts.length ? parts.join(' · ') : 'Bez detailního popisu.';
}

function ArchiveView() {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [collectionFilter, setCollectionFilter] = useState('all');
  const [message, setMessage] = useState('');

  useEffect(() => {
    client.get('/audit', { params: { limit: 300 } })
      .then((response) => setEntries(response.data as AuditEntry[]))
      .catch((error) => {
        console.error(error);
        setMessage('Archiv se nepodařilo načíst.');
      });
  }, []);

  const collections = useMemo(() => [...new Set(entries.map((entry) => entry.collection))].sort(), [entries]);
  const filteredEntries = collectionFilter === 'all'
    ? entries
    : entries.filter((entry) => entry.collection === collectionFilter);

  return (
    <div className="container approval-container">
      <div className="card">
        <div className="page-heading">
          <div>
            <p className="eyebrow">Admin</p>
            <h1 className="page-title">Archiv aktivit</h1>
          </div>
        </div>
        <div className="filter-bar filter-bar--compact">
          <label>
            Typ záznamu
            <select value={collectionFilter} onChange={(event) => setCollectionFilter(event.target.value)}>
              <option value="all">Vše</option>
              {collections.map((collection) => (
                <option key={collection} value={collection}>{collectionLabels[collection] ?? collection}</option>
              ))}
            </select>
          </label>
        </div>
        {message ? <p className="form-message form-message--error">{message}</p> : null}
        {filteredEntries.length === 0 ? (
          <p className="empty-state">Archiv zatím neobsahuje žádné aktivity.</p>
        ) : (
          <div className="archive-list">
            {filteredEntries.map((entry) => (
              <article key={entry.id} className="archive-item">
                <div>
                  <span>{collectionLabels[entry.collection] ?? entry.collection} · {actionLabels[entry.action] ?? entry.action}</span>
                  <strong>{recordTitle(entry)}</strong>
                  <p>{recordDescription(entry)}</p>
                </div>
                <small>{formatCzechDateTime(entry.changed_at)} · {entry.changed_by || 'Systém'}</small>
              </article>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default ArchiveView;
