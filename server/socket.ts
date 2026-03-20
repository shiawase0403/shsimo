import { Server as SocketIOServer, Socket } from 'socket.io';
import { Server as HTTPServer } from 'http';
import jwt from 'jsonwebtoken';
import { pool } from './db.js';
import { v4 as uuidv4 } from 'uuid';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

let ioInstance: SocketIOServer | null = null;

export function getIO() {
  return ioInstance;
}

function getOnlineCount(room: string) {
  const sockets = ioInstance?.sockets.adapter.rooms.get(room);
  if (!sockets) return 0;
  let count = 0;
  for (const socketId of sockets) {
    const socket = ioInstance?.sockets.sockets.get(socketId);
    if (socket && socket.data.user?.role !== 'ADMIN') {
      count++;
    }
  }
  return count;
}

export function setupSocketIO(server: HTTPServer) {
  const io = new SocketIOServer(server, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST']
    }
  });

  ioInstance = io;

  // Middleware for authentication
  io.use((socket, next) => {
    const token = socket.handshake.auth.token;
    if (!token) {
      return next(new Error('Authentication error: No token provided'));
    }
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as { id: string, role: string };
      socket.data.user = decoded;
      next();
    } catch (err) {
      next(new Error('Authentication error: Invalid token'));
    }
  });

  io.on('connection', async (socket: Socket) => {
    const user = socket.data.user;
    
    // Join groups
    try {
      if (user.role === 'ADMIN') {
        // Admin joins a special room or all group rooms
        // We can just query all groups and join them
        const groupsRes = await pool.query('SELECT id FROM user_groups');
        groupsRes.rows.forEach(g => {
          const room = `group_${g.id}`;
          socket.join(room);
          io.to(room).emit('online_count', {
            group_id: g.id,
            count: getOnlineCount(room)
          });
        });
      } else {
        // User joins their active groups
        const membershipsRes = await pool.query(
          'SELECT group_id FROM chat_memberships WHERE user_id = $1 AND is_active = true',
          [user.id]
        );
        membershipsRes.rows.forEach(m => {
          const room = `group_${m.group_id}`;
          socket.join(room);
          io.to(room).emit('online_count', {
            group_id: m.group_id,
            count: getOnlineCount(room)
          });
        });
      }
    } catch (err) {
      console.error('Error joining groups:', err);
    }

    // Handle incoming messages
    socket.on('send_message', async (data, callback) => {
      const { id, group_id, content } = data;
      
      try {
        // Verify user has access to this group
        if (user.role !== 'ADMIN') {
          const membership = await pool.query(
            'SELECT is_active FROM chat_memberships WHERE user_id = $1 AND group_id = $2',
            [user.id, group_id]
          );
          if (membership.rows.length === 0 || !membership.rows[0].is_active) {
            if (callback) callback({ error: 'Not a member of this group' });
            return;
          }
        }

        const is_admin = user.role === 'ADMIN';

        // Write to DB
        const result = await pool.query(
          'INSERT INTO chat_messages (id, group_id, user_id, content, is_admin) VALUES ($1, $2, $3, $4, $5) RETURNING created_at',
          [id, group_id, user.id, content, is_admin]
        );

        const created_at = result.rows[0].created_at;

        // Broadcast to group
        io.to(`group_${group_id}`).emit('chat_message', {
          id,
          group_id,
          user_id: user.id,
          username: user.username,
          content,
          created_at,
          is_system: false,
          is_admin
        });

        // Send ACK to sender
        if (callback) callback({ success: true, created_at });

      } catch (err) {
        console.error('Error sending message:', err);
        if (callback) callback({ error: 'Server error' });
      }
    });

    // Handle reconnect sync
    socket.on('sync_messages', async (data, callback) => {
      const { last_message_time } = data;
      try {
        let query = '';
        let params: any[] = [];
        
        if (user.role === 'ADMIN') {
          query = `
            SELECT m.*, u.username, u.role
            FROM chat_messages m
            LEFT JOIN users u ON m.user_id = u.id
            WHERE m.created_at > $1
            ORDER BY m.created_at ASC
          `;
          params = [last_message_time];
        } else {
          query = `
            SELECT m.*, u.username, u.role
            FROM chat_messages m
            LEFT JOIN users u ON m.user_id = u.id
            JOIN chat_memberships cm ON m.group_id = cm.group_id
            WHERE cm.user_id = $1 AND m.created_at > $2
            ORDER BY m.created_at ASC
          `;
          params = [user.id, last_message_time];
        }

        const result = await pool.query(query, params);
        if (callback) callback({ messages: result.rows });
      } catch (err) {
        console.error('Error syncing messages:', err);
        if (callback) callback({ error: 'Server error' });
      }
    });

    socket.on('disconnecting', () => {
      socket.rooms.forEach(room => {
        if (room.startsWith('group_')) {
          const groupId = room.replace('group_', '');
          // Calculate count after this socket leaves
          let count = getOnlineCount(room);
          if (user.role !== 'ADMIN') {
            count = Math.max(0, count - 1);
          }
          io.to(room).emit('online_count', {
            group_id: groupId,
            count
          });
        }
      });
    });

    socket.on('disconnect', () => {
      // Handle disconnect if needed
    });
  });

  return io;
}
