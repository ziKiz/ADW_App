import { Router } from 'express';
import pool from '../config/database';
import { canUseTractorInServiceCenter, isElevatedRole, normalizeServiceCenter } from '../data/localAdminData';
import { createLocalReport, getLocalReport, listLocalReports, updateLocalReport } from '../data/localReports';
import { writeAudit } from '../utils/audit';

const router = Router();

const tractorCenterError = 'Vybraný stroj nepatří do zvoleného střediska.';

async function canUseRequestedTractor(tractorId: number, serviceCenter: string | undefined, role: string | undefined) {
  const normalizedCenter = normalizeServiceCenter(serviceCenter);
  if (!tractorId || !normalizedCenter) return false;

  try {
    const result = await pool.query(
      `SELECT COALESCE(service_centers, ARRAY[]::text[]) AS service_centers
       FROM tractors
       WHERE id = $1 AND status = 'active'`,
      [tractorId]
    );
    if (result.rows.length > 0) {
      const centers = Array.isArray(result.rows[0].service_centers) ? result.rows[0].service_centers : [];
      return centers.includes(normalizedCenter) || (isElevatedRole(role) && centers.length === 0);
    }
  } catch {
    // Local fallback below covers demo/offline mode and older databases.
  }

  return canUseTractorInServiceCenter(tractorId, normalizedCenter, role);
}

router.get('/', async (req, res) => {
  try {
    const { status } = req.query;
    const filters: string[] = [];
    const values: Array<string> = [];
    let idx = 1;
    if (status) {
      filters.push(`r.status = $${idx++}`);
      values.push(String(status));
    }
    const whereClause = filters.length ? `WHERE ${filters.join(' AND ')}` : '';
    const result = await pool.query(
      `SELECT r.id, r.report_number, r.user_id, r.date, r.time_start, r.time_end, r.break_hours, r.hours_worked, r.amount_ha,
        COALESCE(fe.fuel_liters, r.fuel_liters, 0) AS fuel_liters, fe.fuel_date, fe.fuel_note, r.notes, r.status,
        COALESCE(u.full_name, u.username, 'Zaměstnanec') AS employee_name, t.tractor_name, f.field_name, w.name AS work_type
      FROM reports r
      LEFT JOIN (
        SELECT report_id, SUM(liters) AS fuel_liters, MIN(date) AS fuel_date, STRING_AGG(NULLIF(note, ''), '; ') AS fuel_note
        FROM fuel_entries
        GROUP BY report_id
      ) fe ON fe.report_id = r.id
      LEFT JOIN users u ON r.user_id = u.id
      LEFT JOIN tractors t ON r.tractor_id = t.id
      LEFT JOIN fields f ON r.field_id = f.id
      LEFT JOIN work_types w ON r.work_type_id = w.id
      ${whereClause}
      ORDER BY r.created_at DESC`,
      values
    );
    res.json(result.rows.length > 0 ? result.rows : listLocalReports(req.query.status ? String(req.query.status) : undefined));
  } catch (error) {
    console.error(error);
    res.json(listLocalReports(req.query.status ? String(req.query.status) : undefined));
  }
});

router.post('/', async (req, res) => {
  const {
    report_number,
    report_kind,
    tractor_id,
    user_id,
    employee_name,
    service_center,
    field_id,
    field_entries,
    work_type_id,
    date,
    time_start,
    time_end,
    break_hours,
    hours_worked,
    amount_ha,
    fuel_liters,
    fuel_entry,
    attachments,
    notes
  } = req.body;

  const isWorkReport = !report_kind || report_kind === 'work';

  if (isWorkReport && !await canUseRequestedTractor(Number(tractor_id), service_center, req.header('x-user-role'))) {
    return res.status(400).json({ error: tractorCenterError });
  }

  try {
    await pool.query('BEGIN');
    const result = await pool.query(
      `INSERT INTO reports (report_number, tractor_id, user_id, field_id, work_type_id, date, time_start, time_end, break_hours, hours_worked, amount_ha, fuel_liters, notes, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, 'pending') RETURNING id`,
      [report_number, isWorkReport ? tractor_id : null, user_id, isWorkReport ? field_id : null, work_type_id, date, time_start || null, time_end || null, break_hours || 0, hours_worked || 0, amount_ha || 0, 0, notes]
    );
    const reportId = result.rows[0].id;
    if (fuel_entry && Number(fuel_entry.liters || 0) > 0) {
      await pool.query(
        `INSERT INTO fuel_entries (report_id, date, tractor_id, user_id, liters, note)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          reportId,
          fuel_entry.date || date,
          fuel_entry.tractor_id || tractor_id,
          fuel_entry.user_id || user_id,
          Number(fuel_entry.liters || 0),
          fuel_entry.note || null
        ]
      );
    }
    await writeAudit(pool, 'reports', Number(reportId), 'create', null, req.body, {
      userId: req.header('x-user-id'),
      userName: req.header('x-user-name')
    });
    await pool.query('COMMIT');

    res.status(201).json({ id: reportId });
  } catch (error) {
    await pool.query('ROLLBACK').catch(() => undefined);
    console.error(error);
    const report = createLocalReport({
      report_number,
      report_kind: isWorkReport ? 'work' : report_kind,
      tractor_id: isWorkReport ? Number(tractor_id) : null,
      user_id: Number(user_id),
      employee_name,
      service_center,
      field_id: isWorkReport ? Number(field_id) : null,
      field_entries,
      work_type_id: Number(work_type_id),
      date,
      time_start,
      time_end,
      break_hours: Number(break_hours || 0),
      hours_worked: Number(hours_worked || 0),
      amount_ha: Number(amount_ha || 0),
      fuel_liters: Number(fuel_liters || 0),
      fuel_entry,
      attachments,
      notes
    });
    res.status(201).json({ id: report.id, local: true });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT r.*, COALESCE(fe.fuel_liters, r.fuel_liters, 0) AS fuel_liters, fe.fuel_date, fe.fuel_note,
        COALESCE(u.full_name, u.username, 'Zaměstnanec') AS employee_name,
        t.tractor_name, f.field_name, w.name AS work_type
      FROM reports r
      LEFT JOIN (
        SELECT report_id, SUM(liters) AS fuel_liters, MIN(date) AS fuel_date, STRING_AGG(NULLIF(note, ''), '; ') AS fuel_note
        FROM fuel_entries
        GROUP BY report_id
      ) fe ON fe.report_id = r.id
      LEFT JOIN users u ON r.user_id = u.id
      LEFT JOIN tractors t ON r.tractor_id = t.id
      LEFT JOIN fields f ON r.field_id = f.id
      LEFT JOIN work_types w ON r.work_type_id = w.id
      WHERE r.id = $1`,
      [req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Výkaz nenalezen' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error(error);
    const report = getLocalReport(Number(req.params.id));
    if (!report) {
      return res.status(404).json({ error: 'Výkaz nenalezen' });
    }
    res.json(report);
  }
});

router.put('/:id', async (req, res) => {
  const {
    tractor_id,
    report_kind,
    user_id,
    employee_name,
    service_center,
    field_id,
    field_entries,
    work_type_id,
    date,
    time_start,
    time_end,
    break_hours,
    hours_worked,
    amount_ha,
    fuel_liters,
    fuel_entry,
    attachments,
    notes
  } = req.body;

  const isWorkReport = !report_kind || report_kind === 'work';

  if (isWorkReport && !await canUseRequestedTractor(Number(tractor_id), service_center, req.header('x-user-role'))) {
    return res.status(400).json({ error: tractorCenterError });
  }

  try {
    await pool.query('BEGIN');
    const before = await pool.query('SELECT * FROM reports WHERE id = $1', [req.params.id]);
    const result = await pool.query(
      `UPDATE reports
      SET tractor_id = $1, user_id = $2, field_id = $3, work_type_id = $4, date = $5, time_start = $6,
        time_end = $7, break_hours = $8, hours_worked = $9, amount_ha = $10, fuel_liters = $11,
        notes = $12, updated_at = NOW()
      WHERE id = $13
      RETURNING id`,
      [isWorkReport ? tractor_id : null, user_id, isWorkReport ? field_id : null, work_type_id, date, time_start || null, time_end || null, break_hours || 0, hours_worked || 0, amount_ha || 0, 0, notes, req.params.id]
    );
    if (result.rows.length === 0) {
      await pool.query('ROLLBACK');
      return res.status(404).json({ error: 'Výkaz nenalezen' });
    }
    await pool.query('DELETE FROM fuel_entries WHERE report_id = $1', [req.params.id]);
    if (fuel_entry && Number(fuel_entry.liters || 0) > 0) {
      await pool.query(
        `INSERT INTO fuel_entries (report_id, date, tractor_id, user_id, liters, note)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          req.params.id,
          fuel_entry.date || date,
          fuel_entry.tractor_id || tractor_id,
          fuel_entry.user_id || user_id,
          Number(fuel_entry.liters || 0),
          fuel_entry.note || null
        ]
      );
    }
    await writeAudit(pool, 'reports', Number(req.params.id), 'update', before.rows[0] ?? null, req.body, {
      userId: req.header('x-user-id'),
      userName: req.header('x-user-name')
    });
    await pool.query('COMMIT');
    res.json({ id: result.rows[0].id, message: 'Výkaz byl uložen.' });
  } catch (error) {
    await pool.query('ROLLBACK').catch(() => undefined);
    console.error(error);
    const report = updateLocalReport(Number(req.params.id), {
      report_kind: isWorkReport ? 'work' : report_kind,
      tractor_id: isWorkReport ? Number(tractor_id) : null,
      user_id: Number(user_id),
      employee_name,
      service_center,
      field_id: isWorkReport ? Number(field_id) : null,
      field_entries,
      work_type_id: Number(work_type_id),
      date,
      time_start,
      time_end,
      break_hours: Number(break_hours || 0),
      hours_worked: Number(hours_worked || 0),
      amount_ha: Number(amount_ha || 0),
      fuel_liters: Number(fuel_liters || 0),
      fuel_entry,
      attachments,
      notes
    });
    if (!report) {
      return res.status(404).json({ error: 'Výkaz nenalezen' });
    }
    res.json({ id: report.id, message: 'Výkaz byl uložen.', local: true });
  }
});

export default router;
