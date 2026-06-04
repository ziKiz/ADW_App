import { Router } from 'express';
import pool from '../config/database';
import { createLocalField, getLocalFields, updateLocalField } from '../data/localAdminData';

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
    const result = await pool.query('SELECT id, field_code, field_name, quadrant, area, culture, crop, erosion, created_at, created_by, updated_at, updated_by, last_change FROM fields ORDER BY field_name, field_code');
    res.json(result.rows.length > 0 ? result.rows : getLocalFields());
  } catch (error) {
    console.error(error);
    res.json(getLocalFields());
  }
});

router.post('/', async (req, res) => {
  if (!requireAdmin(req, res)) return;
  const { field_code, field_name, area, culture, crop } = req.body;
  try {
    const result = await pool.query(
      `INSERT INTO fields (field_code, field_name, area, culture, crop, created_by, updated_by, last_change)
       VALUES ($1, $2, $3, $4, $5, $6, $6, 'Vytvoření záznamu')
       RETURNING id, field_code, field_name, quadrant, area, culture, crop, erosion, created_at, created_by, updated_at, updated_by, last_change`,
      [field_code, field_name, area, culture, crop, auditInfo(req).userName || 'Systém']
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error(error);
    const field = createLocalField({
      field_code,
      field_name,
      quadrant: null,
      area: Number(area || 0),
      culture,
      crop,
      erosion: null
    }, auditInfo(req));
    res.status(201).json(field);
  }
});

router.put('/:id', async (req, res) => {
  if (!requireAdmin(req, res)) return;
  const { field_code, field_name, area, culture, crop } = req.body;
  try {
    const result = await pool.query(
      `UPDATE fields
       SET field_code = $1, field_name = $2, area = $3, culture = $4, crop = $5,
        updated_at = NOW(), updated_by = $6, last_change = 'Úprava záznamu'
       WHERE id = $7
       RETURNING id, field_code, field_name, quadrant, area, culture, crop, erosion, created_at, created_by, updated_at, updated_by, last_change`,
      [field_code, field_name, area, culture, crop, auditInfo(req).userName || 'Systém', req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Pozemek nenalezen' });
    res.json(result.rows[0]);
  } catch (error) {
    console.error(error);
    const field = updateLocalField(Number(req.params.id), { field_code, field_name, area: Number(area || 0), culture, crop }, auditInfo(req));
    if (!field) return res.status(404).json({ error: 'Pozemek nenalezen' });
    res.json(field);
  }
});

export default router;
