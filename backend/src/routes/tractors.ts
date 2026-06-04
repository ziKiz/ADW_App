import { Router } from 'express';
import pool from '../config/database';
import { createLocalTractor, getLocalTractors, updateLocalTractor } from '../data/localAdminData';

const router = Router();

function requireAdmin(req: any, res: any) {
  if (req.header('x-user-role') !== 'admin') {
    res.status(403).json({ error: 'Pouze administrátor může upravovat databázi.' });
    return false;
  }
  return true;
}

function auditInfo(req: any) {
  return {
    userId: req.header('x-user-id'),
    userName: req.header('x-user-name')
  };
}

router.get('/', async (req, res) => {
  try {
    const result = await pool.query("SELECT id, tractor_code, tractor_name, vehicle_type, status, created_at, created_by, updated_at, updated_by, last_change FROM tractors WHERE status = 'active' ORDER BY tractor_name, tractor_code");
    res.json(result.rows.length > 0 ? result.rows : getLocalTractors());
  } catch (error) {
    console.error(error);
    res.json(getLocalTractors());
  }
});

router.post('/', async (req, res) => {
  if (!requireAdmin(req, res)) return;
  const { tractor_code, tractor_name, vehicle_type, status } = req.body;
  try {
    const result = await pool.query(
      `INSERT INTO tractors (tractor_code, tractor_name, vehicle_type, status, created_by, updated_by, last_change)
       VALUES ($1, $2, $3, $4, $5, $5, 'Vytvoření záznamu')
       RETURNING id, tractor_code, tractor_name, vehicle_type, status, created_at, created_by, updated_at, updated_by, last_change`,
      [tractor_code, tractor_name, vehicle_type, status || 'active', auditInfo(req).userName || 'Systém']
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error(error);
    const tractor = createLocalTractor({
      tractor_code,
      tractor_name,
      vehicle_type,
      status: status || 'active'
    }, auditInfo(req));
    res.status(201).json(tractor);
  }
});

router.put('/:id', async (req, res) => {
  if (!requireAdmin(req, res)) return;
  const { tractor_code, tractor_name, vehicle_type, status } = req.body;
  try {
    const result = await pool.query(
      `UPDATE tractors
       SET tractor_code = $1, tractor_name = $2, vehicle_type = $3, status = $4,
        updated_at = NOW(), updated_by = $5, last_change = 'Úprava záznamu'
       WHERE id = $6
       RETURNING id, tractor_code, tractor_name, vehicle_type, status, created_at, created_by, updated_at, updated_by, last_change`,
      [tractor_code, tractor_name, vehicle_type, status, auditInfo(req).userName || 'Systém', req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Stroj nenalezen' });
    res.json(result.rows[0]);
  } catch (error) {
    console.error(error);
    const tractor = updateLocalTractor(Number(req.params.id), { tractor_code, tractor_name, vehicle_type, status }, auditInfo(req));
    if (!tractor) return res.status(404).json({ error: 'Stroj nenalezen' });
    res.json(tractor);
  }
});

export default router;
