import { Router } from 'express';
import { pool } from '../db.js';
import { authenticate, requireAdmin } from '../middleware/auth.js';

const router = Router();

router.use(authenticate);

// Get all activities
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT a.*, l.name as location_name
      FROM activities a
      LEFT JOIN locations l ON a.location_id = l.id
      ORDER BY a.created_at DESC
    `);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Create activity
router.post('/', requireAdmin, async (req, res) => {
  const { title, location_id, time_type, start_time, end_time, contact_info, notes } = req.body;
  try {
    const result = await pool.query(
      `INSERT INTO activities (title, location_id, time_type, start_time, end_time, contact_info, notes) 
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [title, location_id, time_type, start_time || null, end_time || null, contact_info, notes]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Update activity
router.put('/:id', requireAdmin, async (req, res) => {
  const { title, location_id, time_type, start_time, end_time, contact_info, notes } = req.body;
  try {
    const result = await pool.query(
      `UPDATE activities SET title = $1, location_id = $2, time_type = $3, start_time = $4, end_time = $5, contact_info = $6, notes = $7 
       WHERE id = $8 RETURNING *`,
      [title, location_id, time_type, start_time || null, end_time || null, contact_info, notes, req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Activity not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Delete activity
router.delete('/:id', requireAdmin, async (req, res) => {
  try {
    await pool.query('DELETE FROM activities WHERE id = $1', [req.params.id]);
    res.json({ message: 'Activity deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
