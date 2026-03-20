import { pool } from '../db.js';
import { v4 as uuidv4 } from 'uuid';
import { getIO } from '../socket.js';

export async function syncUserChatGroups(userId: string) {
  try {
    // 1. Get user's current user_group_id and username
    const userRes = await pool.query('SELECT user_group_id, username FROM users WHERE id = $1', [userId]);
    if (userRes.rows.length === 0) return;
    const userGroupId = userRes.rows[0].user_group_id;
    const username = userRes.rows[0].username;

    // 2. Get all groups to find ancestors
    const groupsRes = await pool.query('SELECT id, parent_id FROM user_groups');
    const groups = groupsRes.rows;
    const groupMap = new Map(groups.map(g => [g.id, g.parent_id]));

    const activeGroupIds = new Set<string>();
    let currentId = userGroupId;
    while (currentId) {
      activeGroupIds.add(currentId);
      currentId = groupMap.get(currentId);
    }

    // 3. Get current memberships
    const membershipsRes = await pool.query('SELECT group_id, is_active FROM chat_memberships WHERE user_id = $1', [userId]);
    const currentMemberships = membershipsRes.rows;
    const currentActive = new Set(currentMemberships.filter(m => m.is_active).map(m => m.group_id));
    const currentInactive = new Set(currentMemberships.filter(m => !m.is_active).map(m => m.group_id));

    // 4. Determine changes
    const toJoin = [...activeGroupIds].filter(id => !currentActive.has(id));
    const toLeave = [...currentActive].filter(id => !activeGroupIds.has(id));

    // 5. Apply changes
    for (const groupId of toJoin) {
      if (currentInactive.has(groupId)) {
        await pool.query('UPDATE chat_memberships SET is_active = true, left_at = NULL WHERE user_id = $1 AND group_id = $2', [userId, groupId]);
      } else {
        await pool.query('INSERT INTO chat_memberships (user_id, group_id) VALUES ($1, $2)', [userId, groupId]);
      }
      // Send system message
      const msgId = uuidv4();
      const content = 'joined the group';
      await pool.query(
        'INSERT INTO chat_messages (id, group_id, user_id, content, is_system) VALUES ($1, $2, $3, $4, true)',
        [msgId, groupId, userId, content]
      );
      const io = getIO();
      if (io) {
        io.to(`group_${groupId}`).emit('chat_message', { id: msgId, group_id: groupId, user_id: userId, username, content, is_system: true, created_at: new Date() });
      }
    }

    for (const groupId of toLeave) {
      await pool.query('UPDATE chat_memberships SET is_active = false, left_at = CURRENT_TIMESTAMP WHERE user_id = $1 AND group_id = $2', [userId, groupId]);
      // Send system message
      const msgId = uuidv4();
      const content = 'left the group';
      await pool.query(
        'INSERT INTO chat_messages (id, group_id, user_id, content, is_system) VALUES ($1, $2, $3, $4, true)',
        [msgId, groupId, userId, content]
      );
      const io = getIO();
      if (io) {
        io.to(`group_${groupId}`).emit('chat_message', { id: msgId, group_id: groupId, user_id: userId, username, content, is_system: true, created_at: new Date() });
      }
    }
  } catch (err) {
    console.error('Error syncing user chat groups:', err);
  }
}

export async function syncAllUsersChatGroups() {
  try {
    const usersRes = await pool.query('SELECT id FROM users');
    for (const user of usersRes.rows) {
      await syncUserChatGroups(user.id);
    }
  } catch (err) {
    console.error('Error syncing all users chat groups:', err);
  }
}
