import { Router } from 'express';
import pool from '../config/database';
import { createLocalTractor, filterTractorsForServiceCenter, getLocalTractors, updateLocalTractor } from '../data/localAdminData';
import { writeAudit } from '../utils/audit';
import { auditInfo, requireAdmin } from '../utils/requestAuth';

const router = Router();

router.get('/', async (req, res) => {
  try {
    const serviceCenter = req.query.service_center ? String(req.query.service_center) : '';
    const role = req.header('x-user-role');
    const elevated = ['admin', 'reditel'].includes(String(role ?? '').toLocaleLowerCase('cs'));
    const params: string[] = [];
    const filters = ["status = 'active'"];

    if (serviceCenter) {
      params.push(serviceCenter);
      filters.push(
        elevated
          ? `(COALESCE(service_centers, ARRAY[]::text[]) @> ARRAY[$1]::text[] OR cardinality(COALESCE(service_centers, ARRAY[]::text[])) = 0)`
          : `COALESCE(service_centers, ARRAY[]::text[]) @> ARRAY[$1]::text[]`
      );
    }

    const result = await pool.query(
      `SELECT id, tractor_code, tractor_name, service_centers, vehicle_type, status, created_at, created_by, updated_at, updated_by, last_change
       FROM tractors
       WHERE ${filters.join(' AND ')}
       ORDER BY tractor_name, tractor_code`,
      params
    );
    res.json(result.rows.length > 0 ? result.rows : filterTractorsForServiceCenter(
      getLocalTractors(),
      serviceCenter,
      role
    ));
  } catch (error) {
    console.error(error);
    res.json(filterTractorsForServiceCenter(
      getLocalTractors(),
      req.query.service_center ? String(req.query.service_center) : '',
      req.header('x-user-role')
    ));
  }
});

router.post('/', async (req, res) => {
  if (!requireAdmin(req, res)) return;
  const { tractor_code, tractor_name, service_centers, vehicle_type, status } = req.body;
  try {
    const result = await pool.query(
      `INSERT INTO tractors (tractor_code, tractor_name, service_centers, vehicle_type, status, created_by, updated_by, last_change)
       VALUES ($1, $2, $3, $4, $5, $6, $6, 'Vytvoření záznamu')
       RETURNING id, tractor_code, tractor_name, service_centers, vehicle_type, status, created_at, created_by, updated_at, updated_by, last_change`,
      [tractor_code, tractor_name, service_centers || [], vehicle_type, status || 'active', auditInfo(req).userName || 'Systém']
    );
    await writeAudit(pool, 'tractors', Number(result.rows[0].id), 'create', null, result.rows[0], auditInfo(req));
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error(error);
    const tractor = createLocalTractor({
      tractor_code,
      tractor_name,
      service_centers: Array.isArray(service_centers) ? service_centers : [],
      vehicle_type,
      status: status || 'active'
    }, auditInfo(req));
    res.status(201).json(tractor);
  }
});

router.put('/:id', async (req, res) => {
  if (!requireAdmin(req, res)) return;
  const { tractor_code, tractor_name, service_centers, vehicle_type, status } = req.body;
  try {
    const before = await pool.query('SELECT * FROM tractors WHERE id = $1', [req.params.id]);
    const result = await pool.query(
      `UPDATE tractors
       SET tractor_code = $1, tractor_name = $2, service_centers = $3, vehicle_type = $4, status = $5,
        updated_at = NOW(), updated_by = $6, last_change = 'Úprava záznamu'
       WHERE id = $7
       RETURNING id, tractor_code, tractor_name, service_centers, vehicle_type, status, created_at, created_by, updated_at, updated_by, last_change`,
      [tractor_code, tractor_name, service_centers || [], vehicle_type, status, auditInfo(req).userName || 'Systém', req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Stroj nenalezen' });
    await writeAudit(pool, 'tractors', Number(req.params.id), 'update', before.rows[0] ?? null, result.rows[0], auditInfo(req));
    res.json(result.rows[0]);
  } catch (error) {
    console.error(error);
    const tractor = updateLocalTractor(Number(req.params.id), {
      tractor_code,
      tractor_name,
      service_centers: Array.isArray(service_centers) ? service_centers : [],
      vehicle_type,
      status
    }, auditInfo(req));
    if (!tractor) return res.status(404).json({ error: 'Stroj nenalezen' });
    res.json(tractor);
  }
});

export default router;
