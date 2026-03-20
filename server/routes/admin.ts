import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { pool } from '../db.js';
import { authenticate, requireAdmin } from '../middleware/auth.js';
import { syncUserChatGroups, syncAllUsersChatGroups } from '../services/chat.js';

const router = Router();

router.use(authenticate, requireAdmin);

// Get all users
router.get('/users', async (req, res) => {
  try {
    const result = await pool.query('SELECT id, username, role, last_login_at, created_at, user_group_id FROM users WHERE role = $1', ['USER']);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Create user
router.post('/users', async (req, res) => {
  const { username, password, user_group_id } = req.body;
  try {
    const hash = await bcrypt.hash(password, 10);
    const result = await pool.query(
      'INSERT INTO users (username, password, role, user_group_id) VALUES ($1, $2, $3, $4) RETURNING id, username, role, user_group_id',
      [username, hash, 'USER', user_group_id || null]
    );
    await syncUserChatGroups(result.rows[0].id);
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
  const { username, password, user_group_id } = req.body;
  try {
    let result;
    if (password) {
      const hash = await bcrypt.hash(password, 10);
      result = await pool.query(
        'UPDATE users SET username = $1, password = $2, user_group_id = $3 WHERE id = $4 AND role = $5 RETURNING id, username, role, user_group_id',
        [username, hash, user_group_id || null, req.params.id, 'USER']
      );
    } else {
      result = await pool.query(
        'UPDATE users SET username = $1, user_group_id = $2 WHERE id = $3 AND role = $4 RETURNING id, username, role, user_group_id',
        [username, user_group_id || null, req.params.id, 'USER']
      );
    }
    if (result.rows.length === 0) return res.status(404).json({ error: 'User not found' });
    await syncUserChatGroups(req.params.id);
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

// User Groups
router.get('/user-groups', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM user_groups ORDER BY created_at ASC');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/user-groups', async (req, res) => {
  const { name, parent_id, userIds } = req.body;
  try {
    const result = await pool.query(
      'INSERT INTO user_groups (name, parent_id) VALUES ($1, $2) RETURNING *',
      [name, parent_id || null]
    );
    const newGroup = result.rows[0];
    
    if (userIds && Array.isArray(userIds) && userIds.length > 0) {
      await pool.query('UPDATE users SET user_group_id = $1 WHERE id = ANY($2::uuid[])', [newGroup.id, userIds]);
    }
    
    await syncAllUsersChatGroups();
    res.json(newGroup);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.put('/user-groups/:id', async (req, res) => {
  const { name, parent_id, userIds } = req.body;
  try {
    // Prevent circular reference (simple check: parent_id != id)
    if (parent_id === req.params.id) {
      return res.status(400).json({ error: 'A group cannot be its own parent' });
    }
    const result = await pool.query(
      'UPDATE user_groups SET name = $1, parent_id = $2 WHERE id = $3 RETURNING *',
      [name, parent_id || null, req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'User group not found' });
    
    // Update users
    if (userIds && Array.isArray(userIds)) {
      if (userIds.length > 0) {
        await pool.query('UPDATE users SET user_group_id = NULL WHERE user_group_id = $1 AND id != ALL($2::uuid[])', [req.params.id, userIds]);
        await pool.query('UPDATE users SET user_group_id = $1 WHERE id = ANY($2::uuid[])', [req.params.id, userIds]);
      } else {
        await pool.query('UPDATE users SET user_group_id = NULL WHERE user_group_id = $1', [req.params.id]);
      }
    }
    
    await syncAllUsersChatGroups();
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/user-groups/:id/users', async (req, res) => {
  const { userIds } = req.body; // Array of user IDs to set to this group
  try {
    // First, remove this group from any users that currently have it but aren't in the new list
    if (userIds && userIds.length > 0) {
      await pool.query('UPDATE users SET user_group_id = NULL WHERE user_group_id = $1 AND id != ALL($2::uuid[])', [req.params.id, userIds]);
      await pool.query('UPDATE users SET user_group_id = $1 WHERE id = ANY($2::uuid[])', [req.params.id, userIds]);
    } else {
      await pool.query('UPDATE users SET user_group_id = NULL WHERE user_group_id = $1', [req.params.id]);
    }
    await syncAllUsersChatGroups();
    res.json({ message: 'Users updated' });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.delete('/user-groups/:id', async (req, res) => {
  try {
    // Check if it has children
    const children = await pool.query('SELECT id FROM user_groups WHERE parent_id = $1', [req.params.id]);
    if (children.rows.length > 0) {
      return res.status(400).json({ error: 'Cannot delete a group that has sub-groups' });
    }
    
    // Delete the group (users' user_group_id will be set to NULL due to ON DELETE SET NULL)
    const result = await pool.query('DELETE FROM user_groups WHERE id = $1 RETURNING *', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'User group not found' });
    
    await syncAllUsersChatGroups();
    res.json({ message: 'User group deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
