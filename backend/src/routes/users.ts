import { Router } from 'express';
import pool from '../config/database';
import { createLocalUser, getLocalUsers, updateLocalUser } from '../data/localAdminData';
import { auditInfo, requireAdmin } from '../utils/requestAuth';

const router = Router();

router.get('/', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT u.id, u.username, u.email, u.role, u.full_name, u.active,
        e.position, e.manager_name, d.name AS department_name,
        d.name AS scope_department,
        u.created_at, u.created_by, u.updated_at, u.updated_by, u.last_change
       FROM users u
       LEFT JOIN employees e ON u.employee_id = e.employee_id
       LEFT JOIN departments d ON e.home_department_id = d.department_id
       ORDER BY u.full_name, u.username`
    );
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
  const { username, email, role, full_name, active, position, department_name, scope_department } = req.body;
  try {
    await pool.query('BEGIN');
    const before = await pool.query(
      `SELECT u.*, e.position, d.name AS department_name
       FROM users u
       LEFT JOIN employees e ON u.employee_id = e.employee_id
       LEFT JOIN departments d ON e.home_department_id = d.department_id
       WHERE u.id = $1`,
      [req.params.id]
    );
    const result = await pool.query(
      `UPDATE users
       SET username = $1, email = $2, role = $3, full_name = $4, active = $5,
        updated_at = NOW(), updated_by = $6, last_change = 'Úprava záznamu'
       WHERE id = $7
       RETURNING id, username, email, role, full_name, active, created_at, created_by, updated_at, updated_by, last_change`,
      [username, email, role, full_name, active, auditInfo(req).userName || 'Systém', req.params.id]
    );
    if (result.rows.length === 0) {
      await pool.query('ROLLBACK');
      return res.status(404).json({ error: 'Uživatel nenalezen' });
    }
    if (position !== undefined || department_name || scope_department) {
      const department = department_name || scope_department;
      await pool.query(
        `UPDATE employees
         SET position = COALESCE($1, position),
           home_department_id = COALESCE((SELECT department_id FROM departments WHERE name = $2 LIMIT 1), home_department_id)
         WHERE employee_id = (SELECT employee_id FROM users WHERE id = $3)`,
        [position, department, req.params.id]
      );
    }
    await pool.query(
      `INSERT INTO audit_log (collection, record_id, action, changed_by, changed_by_id, before_data, after_data)
       VALUES ('users', $1, 'update', $2, $3, $4, $5)`,
      [
        req.params.id,
        auditInfo(req).userName || 'Systém',
        auditInfo(req).userId || null,
        JSON.stringify(before.rows[0] ?? null),
        JSON.stringify({ ...result.rows[0], position, department_name: department_name || scope_department })
      ]
    );
    await pool.query('COMMIT');
    res.json({ ...result.rows[0], position, department_name: department_name || scope_department, scope_department: department_name || scope_department });
  } catch (error) {
    await pool.query('ROLLBACK').catch(() => undefined);
    console.error(error);
    const user = updateLocalUser(Number(req.params.id), { username, email, role, full_name, active, position, department_name, scope_department }, auditInfo(req));
    if (!user) return res.status(404).json({ error: 'Uživatel nenalezen' });
    res.json(user);
  }
});

export default router;
