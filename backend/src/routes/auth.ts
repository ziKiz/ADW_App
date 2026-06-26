import { Router } from 'express';
import pool from '../config/database';
const router = Router();

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const result = await pool.query(
      `SELECT u.id, u.username, u.email, u.role, u.full_name,
        d.name AS department_name,
        d.name AS scope_department
       FROM users u
       LEFT JOIN employees e ON u.employee_id = e.employee_id
       LEFT JOIN departments d ON e.home_department_id = d.department_id
       WHERE u.email = $1 AND u.password_hash = $2`,
      [email, password]
    );
    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Neplatné přihlašovací údaje' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Chyba při přihlášení' });
  }
});

router.post('/register', (req, res) => {
  res.status(200).json({ message: 'Register endpoint not implemented yet' });
});

export default router;
