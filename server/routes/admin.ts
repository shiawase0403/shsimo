import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { pool } from '../db.js';
import { authenticate, requireAdmin } from '../middleware/auth.js';

const router = Router();

router.use(authenticate, requireAdmin);

// Get all users
router.get('/users', async (req, res) => {
  try {
    const result = await pool.query('SELECT id, username, role, last_login_at, created_at FROM users WHERE role = $1', ['USER']);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Create user
router.post('/users', async (req, res) => {
  const { username, password } = req.body;
  try {
    const hash = await bcrypt.hash(password, 10);
    const result = await pool.query(
      'INSERT INTO users (username, password, role) VALUES ($1, $2, $3) RETURNING id, username, role',
      [username, hash, 'USER']
    );
    res.json(result.rows[0]);
  } catch (err: any) {
    if (err.code === '23505') { // unique violation
      return res.status(400).json({ error: 'Username already exists' });
    }
    res.status(500).json({ error: 'Server error' });
  }
});

// Update user
router.put('/users/:id', async (req, res) => {
  const { username, password } = req.body;
  try {
    let result;
    if (password) {
      const hash = await bcrypt.hash(password, 10);
      result = await pool.query(
        'UPDATE users SET username = $1, password = $2 WHERE id = $3 AND role = $4 RETURNING id, username, role',
        [username, hash, req.params.id, 'USER']
      );
    } else {
      result = await pool.query(
        'UPDATE users SET username = $1 WHERE id = $2 AND role = $3 RETURNING id, username, role',
        [username, req.params.id, 'USER']
      );
    }
    if (result.rows.length === 0) return res.status(404).json({ error: 'User not found' });
    res.json(result.rows[0]);
  } catch (err: any) {
    if (err.code === '23505') {
      return res.status(400).json({ error: 'Username already exists' });
    }
    res.status(500).json({ error: 'Server error' });
  }
});

// Delete user
router.delete('/users/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM users WHERE id = $1 AND role = $2', [req.params.id, 'USER']);
    res.json({ message: 'User deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Future Proofing: User Groups
// router.post('/groups', ...)
// router.post('/users/:id/group', ...)

export default router;
