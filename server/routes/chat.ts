import { Router } from 'express';
import { pool } from '../db.js';
import { authenticate, AuthRequest } from '../middleware/auth.js';

const router = Router();

router.use(authenticate);

// Get user's chat groups
router.get('/groups', async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id;
    const role = req.user!.role;

    if (role === 'ADMIN') {
      // Admins can see all groups
      const result = await pool.query('SELECT id, name, true as is_active FROM user_groups ORDER BY name ASC');
      res.json(result.rows);
    } else {
      // Users see groups they are members of (active and inactive)
      const result = await pool.query(`
        SELECT g.id, g.name, cm.is_active 
        FROM user_groups g
        JOIN chat_memberships cm ON g.id = cm.group_id
        WHERE cm.user_id = $1
        ORDER BY g.name ASC
      `, [userId]);
      res.json(result.rows);
    }
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Get messages for a group (initial load)
router.get('/groups/:groupId/messages', async (req: AuthRequest, res) => {
  try {
    const { groupId } = req.params;
    const userId = req.user!.id;
    const role = req.user!.role;

    // Verify membership if not admin
    if (role !== 'ADMIN') {
      const membership = await pool.query(
        'SELECT 1 FROM chat_memberships WHERE user_id = $1 AND group_id = $2',
        [userId, groupId]
      );
      if (membership.rows.length === 0) {
        return res.status(403).json({ error: 'Not a member of this group' });
      }
    }

    const result = await pool.query(`
      SELECT m.*, u.username 
      FROM chat_messages m
      LEFT JOIN users u ON m.user_id = u.id
      WHERE m.group_id = $1
      ORDER BY m.created_at DESC
      LIMIT 50
    `, [groupId]);

    res.json(result.rows.reverse());
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Get members of a chat group
router.get('/groups/:groupId/members', async (req: AuthRequest, res) => {
  try {
    const { groupId } = req.params;
    const userId = req.user!.id;
    const role = req.user!.role;

    // Verify membership if not admin
    if (role !== 'ADMIN') {
      const membership = await pool.query(
        'SELECT 1 FROM chat_memberships WHERE user_id = $1 AND group_id = $2',
        [userId, groupId]
      );
      if (membership.rows.length === 0) {
        return res.status(403).json({ error: 'Not a member of this group' });
      }
    }

    const members = await pool.query(`
      SELECT u.id, u.username, u.full_name, cm.is_active
      FROM chat_memberships cm
      JOIN users u ON cm.user_id = u.id
      WHERE cm.group_id = $1
      ORDER BY cm.is_active DESC, u.username ASC
    `, [groupId]);

    res.json(members.rows);
  } catch (error) {
    console.error('Error fetching group members:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
