import { Router } from 'express';
import pool from '../config/database';
import { createLocalUser, getLocalUsers, updateLocalUser } from '../data/localAdminData';

const router = Router();

function requireAdmin(req: any, res: any) {
  const role = String(req.header('x-user-role') ?? '').toLowerCase();
  if (role !== 'admin') {
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
    const result = await pool.query('SELECT id, username, email, role, full_name, active, created_at, created_by, updated_at, updated_by, last_change FROM users ORDER BY full_name, username');
    res.json(result.rows.length > 0 ? result.rows : getLocalUsers());
  } catch (error) {
    console.error(error);
    res.json(getLocalUsers());
  }
});

router.post('/', async (req, res) => {
  if (!requireAdmin(req, res)) return;
  const { username, email, role, full_name, active } = req.body;
  try {
    const result = await pool.query(
      `INSERT INTO users (username, email, password_hash, role, full_name, active, created_by, updated_by, last_change)
       VALUES ($1, $2, 'changeme', $3, $4, $5, $6, $6, 'Vytvoření záznamu')
       RETURNING id, username, email, role, full_name, active, created_at, created_by, updated_at, updated_by, last_change`,
      [username, email, role, full_name, active ?? true, auditInfo(req).userName || 'Systém']
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error(error);
    const user = createLocalUser({ username, email, role, full_name, active: active ?? true }, auditInfo(req));
    res.status(201).json(user);
  }
});

router.put('/:id', async (req, res) => {
  if (!requireAdmin(req, res)) return;
  const { username, email, role, full_name, active } = req.body;
  try {
    const result = await pool.query(
      `UPDATE users
       SET username = $1, email = $2, role = $3, full_name = $4, active = $5,
        updated_at = NOW(), updated_by = $6, last_change = 'Úprava záznamu'
       WHERE id = $7
       RETURNING id, username, email, role, full_name, active, created_at, created_by, updated_at, updated_by, last_change`,
      [username, email, role, full_name, active, auditInfo(req).userName || 'Systém', req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Uživatel nenalezen' });
    res.json(result.rows[0]);
  } catch (error) {
    console.error(error);
    const user = updateLocalUser(Number(req.params.id), { username, email, role, full_name, active }, auditInfo(req));
    if (!user) return res.status(404).json({ error: 'Uživatel nenalezen' });
    res.json(user);
  }
});

export default router;
