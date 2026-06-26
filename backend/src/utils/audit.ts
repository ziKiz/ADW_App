import { Pool } from 'pg';

interface AuditInfo {
  userId?: string | null;
  userName?: string | null;
}

export async function writeAudit(
  pool: Pool,
  collection: string,
  recordId: number,
  action: string,
  before: unknown,
  after: unknown,
  audit: AuditInfo
) {
  await pool.query(
    `INSERT INTO audit_log (collection, record_id, action, changed_by, changed_by_id, before_data, after_data)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [
      collection,
      recordId,
      action,
      audit.userName || 'Systém',
      audit.userId || null,
      JSON.stringify(before ?? null),
      JSON.stringify(after ?? null)
    ]
  );
}
