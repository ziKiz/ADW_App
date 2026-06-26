import { Router } from 'express';
import pool from '../config/database';
import { updateLocalReportStatus } from '../data/localReports';
import { writeAudit } from '../utils/audit';
import { requireAnyRole } from '../utils/requestAuth';

const router = Router();

router.get('/', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT a.id, a.status, a.comment, a.approved_at, r.report_number, r.status AS report_status,
        t.tractor_name, f.field_name, w.name AS work_type
      FROM approvals a
      LEFT JOIN reports r ON a.report_id = r.id
      LEFT JOIN tractors t ON r.tractor_id = t.id
      LEFT JOIN fields f ON r.field_id = f.id
      LEFT JOIN work_types w ON r.work_type_id = w.id
      ORDER BY a.approved_at DESC NULLS FIRST`
    );
    res.json(result.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Nepodařilo se načíst schválení' });
  }
});

router.post('/:id', async (req, res) => {
  if (!requireAnyRole(req, res, ['admin', 'reditel', 'schvalovatel', 'specialista'], 'Pouze oprávněný schvalovatel může měnit stav výkazu.')) return;
  try {
    const { status, comment, approver_id } = req.body;
    const reportId = Number(req.params.id);
    const before = await pool.query('SELECT * FROM reports WHERE id = $1', [reportId]);
    await pool.query('UPDATE reports SET status = $1, updated_at = NOW() WHERE id = $2', [status, reportId]);
    await pool.query(
      'INSERT INTO approvals (report_id, approver_id, status, comment, approved_at) VALUES ($1, $2, $3, $4, NOW())',
      [reportId, approver_id, status, comment]
    );
    await writeAudit(pool, 'reports', reportId, 'approval', before.rows[0] ?? null, { status, comment, approver_id }, {
      userId: req.header('x-user-id') || String(approver_id ?? ''),
      userName: req.header('x-user-name')
    });
    res.json({ message: 'Výkaz byl aktualizován', status });
  } catch (error) {
    console.error(error);
    const report = updateLocalReportStatus(Number(req.params.id), req.body.status);
    if (!report) {
      return res.status(404).json({ error: 'Výkaz nenalezen' });
    }
    res.json({ message: 'Výkaz byl aktualizován', status: report.status, local: true });
  }
});

export default router;
