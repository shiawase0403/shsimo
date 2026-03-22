import { Router } from 'express';
import { pool } from '../db.js';
import { authenticate, requireAdmin } from '../middleware/auth.js';

const router = Router();

router.use(authenticate);

// Get all locations (Hierarchical)
router.get('/', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM locations ORDER BY created_at ASC');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Create location
router.post('/', requireAdmin, async (req, res) => {
  const { name, parent_id, latitude, longitude } = req.body;
  try {
    const result = await pool.query(
      'INSERT INTO locations (name, parent_id, latitude, longitude) VALUES ($1, $2, $3, $4) RETURNING *',
      [name, parent_id || null, latitude || null, longitude || null]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Update location
router.put('/:id', requireAdmin, async (req, res) => {
  const { name, parent_id, latitude, longitude } = req.body;
  try {
    const result = await pool.query(
      'UPDATE locations SET name = $1, parent_id = $2, latitude = $3, longitude = $4 WHERE id = $5 RETURNING *',
      [name, parent_id || null, latitude || null, longitude || null, req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Location not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Delete location
router.delete('/:id', requireAdmin, async (req, res) => {
  const { id } = req.params;
  try {
    // Check if it has children
    const children = await pool.query('SELECT id FROM locations WHERE parent_id = $1 LIMIT 1', [id]);
    if (children.rows.length > 0) {
      return res.status(400).json({ error: 'Cannot delete location with sub-locations' });
    }

    // Check if it has schedules
    const schedules = await pool.query('SELECT id FROM schedules WHERE location_id = $1 LIMIT 1', [id]);
    if (schedules.rows.length > 0) {
      return res.status(400).json({ error: 'Cannot delete location with associated schedules' });
    }

    // Check if it has activities
    const activities = await pool.query('SELECT id FROM activities WHERE location_id = $1 LIMIT 1', [id]);
    if (activities.rows.length > 0) {
      return res.status(400).json({ error: 'Cannot delete location with associated activities' });
    }

    await pool.query('DELETE FROM locations WHERE id = $1', [id]);
    res.json({ message: 'Location deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Future Proofing: GPS Location sharing
// router.post('/share-location', ...)

export default router;
