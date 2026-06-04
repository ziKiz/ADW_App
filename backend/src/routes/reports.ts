import { Router } from 'express';
import pool from '../config/database';
import { createLocalReport, getLocalReport, listLocalReports, updateLocalReport } from '../data/localReports';

const router = Router();

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
      `SELECT r.id, r.report_number, r.date, r.time_start, r.time_end, r.break_hours, r.hours_worked, r.amount_ha, r.fuel_liters, r.notes, r.status,
        COALESCE(u.full_name, u.username, 'Zaměstnanec') AS employee_name, t.tractor_name, f.field_name, w.name AS work_type
      FROM reports r
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
    tractor_id,
    user_id,
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
    attachments,
    notes
  } = req.body;

  try {
    const result = await pool.query(
      `INSERT INTO reports (report_number, tractor_id, user_id, field_id, work_type_id, date, time_start, time_end, break_hours, hours_worked, amount_ha, fuel_liters, notes, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, 'pending') RETURNING id`,
      [report_number, tractor_id, user_id, field_id, work_type_id, date, time_start, time_end, break_hours, hours_worked, amount_ha, fuel_liters, notes]
    );

    res.status(201).json({ id: result.rows[0].id });
  } catch (error) {
    console.error(error);
    const report = createLocalReport({
      report_number,
      tractor_id: Number(tractor_id),
      user_id: Number(user_id),
      service_center,
      field_id: Number(field_id),
      field_entries,
      work_type_id: Number(work_type_id),
      date,
      time_start,
      time_end,
      break_hours: Number(break_hours || 0),
      hours_worked: Number(hours_worked || 0),
      amount_ha: Number(amount_ha || 0),
      fuel_liters: Number(fuel_liters || 0),
      attachments,
      notes
    });
    res.status(201).json({ id: report.id, local: true });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT r.*, COALESCE(u.full_name, u.username, 'Zaměstnanec') AS employee_name,
        t.tractor_name, f.field_name, w.name AS work_type
      FROM reports r
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
    user_id,
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
    attachments,
    notes
  } = req.body;

  try {
    const result = await pool.query(
      `UPDATE reports
      SET tractor_id = $1, user_id = $2, field_id = $3, work_type_id = $4, date = $5, time_start = $6,
        time_end = $7, break_hours = $8, hours_worked = $9, amount_ha = $10, fuel_liters = $11,
        notes = $12, updated_at = NOW()
      WHERE id = $13
      RETURNING id`,
      [tractor_id, user_id, field_id, work_type_id, date, time_start, time_end, break_hours, hours_worked, amount_ha, fuel_liters, notes, req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Výkaz nenalezen' });
    }
    res.json({ id: result.rows[0].id, message: 'Výkaz byl uložen.' });
  } catch (error) {
    console.error(error);
    const report = updateLocalReport(Number(req.params.id), {
      tractor_id: Number(tractor_id),
      user_id: Number(user_id),
      service_center,
      field_id: Number(field_id),
      field_entries,
      work_type_id: Number(work_type_id),
      date,
      time_start,
      time_end,
      break_hours: Number(break_hours || 0),
      hours_worked: Number(hours_worked || 0),
      amount_ha: Number(amount_ha || 0),
      fuel_liters: Number(fuel_liters || 0),
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
