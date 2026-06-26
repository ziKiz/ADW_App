import { Router } from 'express';
import pool from '../config/database';
import { createLocalWorkType, getLocalWorkTypes, updateLocalWorkType } from '../data/localAdminData';
import { fallbackWorkTypes } from '../data/documentData';
import { writeAudit } from '../utils/audit';
import { auditInfo, requireAdmin } from '../utils/requestAuth';

const router = Router();

async function ensureCoreWorkTypes() {
  for (const item of fallbackWorkTypes) {
    await pool.query(
      `INSERT INTO work_types (name, description, created_by, updated_by, last_change)
       SELECT $1, $2, 'Systém', 'Systém', 'Základní číselník'
       WHERE NOT EXISTS (SELECT 1 FROM work_types WHERE name = $1)`,
      [item.name, item.description]
    );
  }
}

router.get('/', async (req, res) => {
  try {
    await ensureCoreWorkTypes();
    const result = await pool.query('SELECT id, name, description, created_at, created_by, updated_at, updated_by, last_change FROM work_types ORDER BY id');
    res.json(result.rows.length > 0 ? result.rows : getLocalWorkTypes());
  } catch (error) {
    console.error(error);
    res.json(getLocalWorkTypes());
  }
});

router.post('/', async (req, res) => {
  if (!requireAdmin(req, res)) return;
  const { name, description } = req.body;
  try {
    const result = await pool.query(
      `INSERT INTO work_types (name, description, created_by, updated_by, last_change)
       VALUES ($1, $2, $3, $3, 'Vytvoření záznamu')
       RETURNING id, name, description, created_at, created_by, updated_at, updated_by, last_change`,
      [name, description, auditInfo(req).userName || 'Systém']
    );
    await writeAudit(pool, 'workTypes', Number(result.rows[0].id), 'create', null, result.rows[0], auditInfo(req));
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error(error);
    const workType = createLocalWorkType({ name, description }, auditInfo(req));
    res.status(201).json(workType);
  }
});

router.put('/:id', async (req, res) => {
  if (!requireAdmin(req, res)) return;
  const { name, description } = req.body;
  try {
    const before = await pool.query('SELECT * FROM work_types WHERE id = $1', [req.params.id]);
    const result = await pool.query(
      `UPDATE work_types
       SET name = $1, description = $2, updated_at = NOW(), updated_by = $3, last_change = 'Úprava záznamu'
       WHERE id = $4
       RETURNING id, name, description, created_at, created_by, updated_at, updated_by, last_change`,
      [name, description, auditInfo(req).userName || 'Systém', req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Činnost nenalezena' });
    await writeAudit(pool, 'workTypes', Number(req.params.id), 'update', before.rows[0] ?? null, result.rows[0], auditInfo(req));
    res.json(result.rows[0]);
  } catch (error) {
    console.error(error);
    const workType = updateLocalWorkType(Number(req.params.id), { name, description }, auditInfo(req));
    if (!workType) return res.status(404).json({ error: 'Činnost nenalezena' });
    res.json(workType);
  }
});

export default router;
