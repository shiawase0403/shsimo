import { Router } from 'express';
import { pool } from '../db.js';
import { authenticate, requireAdmin } from '../middleware/auth.js';

const router = Router();

router.use(authenticate);

// Get all groups
router.get('/', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM schedule_groups ORDER BY created_at ASC');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Create group
router.post('/', requireAdmin, async (req, res) => {
  const { name, color } = req.body;
  try {
    const result = await pool.query(
      'INSERT INTO schedule_groups (name, color) VALUES ($1, $2) RETURNING *',
      [name, color]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Update group
router.put('/:id', requireAdmin, async (req, res) => {
  const { name, color } = req.body;
  try {
    const result = await pool.query(
      'UPDATE schedule_groups SET name = $1, color = $2 WHERE id = $3 RETURNING *',
      [name, color, req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Group not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Delete group
router.delete('/:id', requireAdmin, async (req, res) => {
  try {
    await pool.query('DELETE FROM schedule_groups WHERE id = $1', [req.params.id]);
    res.json({ message: 'Group deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
