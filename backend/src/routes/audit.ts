import { Router } from 'express';
import pool from '../config/database';
import { getLocalAuditLog } from '../data/localAdminData';

const router = Router();

router.get('/', async (req, res) => {
  const limit = Math.min(Number(req.query.limit ?? 50), 200);
  try {
    const result = await pool.query(
      `SELECT id, collection, record_id, action, changed_at, changed_by, changed_by_id, before_data, after_data
       FROM audit_log
       ORDER BY changed_at DESC
       LIMIT $1`,
      [limit]
    );
    res.json(result.rows.length > 0 ? result.rows : getLocalAuditLog(limit));
  } catch (error) {
    console.error(error);
    res.json(getLocalAuditLog(limit));
  }
});

export default router;
