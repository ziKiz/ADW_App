import { Router } from 'express';
import pool from '../config/database';
import { listLocalReports } from '../data/localReports';

const router = Router();
const headers = ['Číslo výkazu', 'Datum', 'Od', 'Do', 'Pauza', 'Hodiny', 'Počet ha', 'Tankování PHM (l)', 'Datum tankování', 'Stroj tankování', 'Traktor práce', 'Pole', 'Typ práce', 'Poznámka'];

function formatDate(value: unknown) {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === 'string') return value.slice(0, 10);
  return '';
}

function buildCsv(rows: Array<Record<string, any>>) {
  const csvRows = rows.map((row) => [
    row.report_number,
    formatDate(row.date),
    row.time_start,
    row.time_end,
    row.break_hours,
    row.hours_worked,
    row.amount_ha,
    row.fuel_liters,
    formatDate(row.fuel_date),
    row.fuel_tractor_name || row.tractor_name,
    row.tractor_name,
    row.field_name,
    row.work_type,
    row.notes?.replace(/\n/g, ' ')
  ]);

  return [headers, ...csvRows]
    .map((row) => row.map((cell) => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(','))
    .join('\r\n');
}

function sendCsv(res: any, rows: Array<Record<string, any>>) {
  res.header('Content-Type', 'text/csv; charset=utf-8');
  res.header('Content-Disposition', 'attachment; filename="adw_reports.csv"');
  res.send(`\uFEFF${buildCsv(rows)}`);
}

router.get('/csv', async (req, res) => {
  const status = typeof req.query.status === 'string' ? req.query.status : 'approved';

  try {
    const result = await pool.query(
      `SELECT r.report_number, r.date, r.time_start, r.time_end, r.break_hours, r.hours_worked, r.amount_ha,
        COALESCE(fe.fuel_liters, r.fuel_liters, 0) AS fuel_liters, fe.fuel_date, ft.tractor_name AS fuel_tractor_name,
        t.tractor_name, f.field_name, w.name AS work_type, r.notes
      FROM reports r
      LEFT JOIN (
        SELECT report_id, SUM(liters) AS fuel_liters, MIN(date) AS fuel_date, MIN(tractor_id) AS fuel_tractor_id
        FROM fuel_entries
        GROUP BY report_id
      ) fe ON fe.report_id = r.id
      LEFT JOIN tractors ft ON fe.fuel_tractor_id = ft.id
      LEFT JOIN tractors t ON r.tractor_id = t.id
      LEFT JOIN fields f ON r.field_id = f.id
      LEFT JOIN work_types w ON r.work_type_id = w.id
      WHERE r.status = $1
      ORDER BY r.date DESC`,
      [status]
    );

    sendCsv(res, result.rows.length > 0 ? result.rows as Array<Record<string, any>> : listLocalReports(status));
  } catch (error) {
    console.error(error);
    sendCsv(res, listLocalReports(status));
  }
});

export default router;
