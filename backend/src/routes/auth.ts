import { Router } from 'express';
import pool from '../config/database';
const router = Router();

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const result = await pool.query('SELECT id, username, email, role, full_name FROM users WHERE email = $1 AND password_hash = $2', [email, password]);
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
