import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { pool } from '../db.js';
import { authenticate, AuthRequest } from '../middleware/auth.js';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'shsimo-secret-key-2026';

// Login
router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  
  try {
    const result = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
    const user = result.rows[0];

    if (!user) {
      // For prototype, if admin doesn't exist, create it on first login
      if (username === 'SHSIMO' && password === 'shsimo2026') {
        const hash = await bcrypt.hash(password, 10);
        const newAdmin = await pool.query(
          'INSERT INTO users (username, password, role) VALUES ($1, $2, $3) RETURNING *',
          ['SHSIMO', hash, 'ADMIN']
        );
        const adminUser = newAdmin.rows[0];
        const token = jwt.sign({ id: adminUser.id, username: adminUser.username, role: adminUser.role }, JWT_SECRET);
        return res.json({ token, user: { id: adminUser.id, username: adminUser.username, role: adminUser.role } });
      }
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    // Fallback for the dummy hash in init.sql
    if (!isMatch && !(username === 'SHSIMO' && password === 'shsimo2026' && user.password.startsWith('$2a$10$Xm.7.yN.8.Z.Z.Z.Z.Z.Z.Z.Z.Z.Z.Z.Z.Z.Z.Z.Z.Z.Z.Z.Z.Z.Z'))) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Update last login
    await pool.query('UPDATE users SET last_login_at = NOW() WHERE id = $1', [user.id]);

    const token = jwt.sign({ id: user.id, username: user.username, role: user.role }, JWT_SECRET);
    res.json({ token, user: { id: user.id, username: user.username, role: user.role } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Change Password
router.post('/change-password', authenticate, async (req: AuthRequest, res) => {
  const { oldPassword, newPassword } = req.body;
  const userId = req.user?.id;

  try {
    const result = await pool.query('SELECT * FROM users WHERE id = $1', [userId]);
    const user = result.rows[0];

    const isMatch = await bcrypt.compare(oldPassword, user.password);
    if (!isMatch) {
      return res.status(400).json({ error: 'Incorrect old password' });
    }

    const hash = await bcrypt.hash(newPassword, 10);
    await pool.query('UPDATE users SET password = $1 WHERE id = $2', [hash, userId]);

    res.json({ message: 'Password updated successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
