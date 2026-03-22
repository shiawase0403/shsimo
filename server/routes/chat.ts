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

// Get messages for a group (initial load and pagination)
router.get('/groups/:groupId/messages', async (req: AuthRequest, res) => {
  try {
    const { groupId } = req.params;
    const { before } = req.query;
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

    let query = `
      SELECT m.*, u.username, u.nickname,
             CASE 
               WHEN m.attachment_type = 'schedule' THEN s.id IS NOT NULL
               WHEN m.attachment_type = 'activity' THEN a.id IS NOT NULL
               ELSE true
             END as attachment_exists
      FROM chat_messages m
      LEFT JOIN users u ON m.user_id = u.id
      LEFT JOIN schedules s ON m.attachment_type = 'schedule' AND m.attachment_id = s.id
      LEFT JOIN activities a ON m.attachment_type = 'activity' AND m.attachment_id = a.id
      WHERE m.group_id = $1
    `;
    const params: any[] = [groupId];

    if (before) {
      query += ` AND m.created_at < $2`;
      params.push(before);
    }

    query += ` ORDER BY m.created_at DESC LIMIT 30`;

    const result = await pool.query(query, params);

    res.json(result.rows.reverse());
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Get unread counts for all groups
router.get('/unread', async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id;
    const role = req.user!.role;

    let query = `
      SELECT m.group_id, COUNT(m.id) as unread_count
      FROM chat_messages m
      LEFT JOIN chat_read_status crs ON m.group_id = crs.group_id AND crs.user_id = $1
      WHERE (crs.last_read_at IS NULL OR m.created_at > crs.last_read_at)
    `;
    
    if (role !== 'ADMIN') {
      query += ` AND m.group_id IN (SELECT group_id FROM chat_memberships WHERE user_id = $1 AND is_active = true)`;
    }

    query += ` GROUP BY m.group_id`;

    const result = await pool.query(query, [userId]);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Mark group as read
router.post('/groups/:groupId/read', async (req: AuthRequest, res) => {
  try {
    const { groupId } = req.params;
    const userId = req.user!.id;

    await pool.query(`
      INSERT INTO chat_read_status (user_id, group_id, last_read_at)
      VALUES ($1, $2, CURRENT_TIMESTAMP)
      ON CONFLICT (user_id, group_id) 
      DO UPDATE SET last_read_at = CURRENT_TIMESTAMP
    `, [userId, groupId]);

    res.json({ success: true });
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
      SELECT u.id, u.username, u.nickname, cm.is_active
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
