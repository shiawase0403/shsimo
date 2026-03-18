import { Router } from 'express';
import { pool } from '../db.js';
import { authenticate, requireAdmin } from '../middleware/auth.js';

const router = Router();

router.use(authenticate);

// Get all schedules
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT s.*, l.name as location_name, g.name as group_name, g.color as group_color
      FROM schedules s
      LEFT JOIN locations l ON s.location_id = l.id
      LEFT JOIN schedule_groups g ON s.group_id = g.id
      ORDER BY s.start_time ASC
    `);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Create schedule
router.post('/', requireAdmin, async (req, res) => {
  const { title, location_id, group_id, start_time, end_time, contact_info, notes } = req.body;
  try {
    const result = await pool.query(
      `INSERT INTO schedules (title, location_id, group_id, start_time, end_time, contact_info, notes) 
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [title, location_id, group_id || null, start_time, end_time, contact_info, notes]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Update schedule
router.put('/:id', requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { title, location_id, group_id, start_time, end_time, contact_info, notes } = req.body;
  try {
    const result = await pool.query(
      `UPDATE schedules 
       SET title = $1, location_id = $2, group_id = $3, start_time = $4, end_time = $5, contact_info = $6, notes = $7
       WHERE id = $8 RETURNING *`,
      [title, location_id, group_id || null, start_time, end_time, contact_info, notes, id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Delete schedule
router.delete('/:id', requireAdmin, async (req, res) => {
  try {
    await pool.query('DELETE FROM schedules WHERE id = $1', [req.params.id]);
    res.json({ message: 'Schedule deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Future Proofing: Directed schedules
// router.post('/:id/assign', ...)

export default router;
