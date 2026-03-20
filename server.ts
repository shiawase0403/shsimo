import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { createServer as createViteServer } from 'vite';
import authRoutes from './server/routes/auth.js';
import adminRoutes from './server/routes/admin.js';
import scheduleRoutes from './server/routes/schedule.js';
import locationRoutes from './server/routes/location.js';
import activityRoutes from './server/routes/activity.js';
import groupRoutes from './server/routes/group.js';
import chatRoutes from './server/routes/chat.js';
import { testDbConnection, pool } from './server/db.js';
import fs from 'fs';
import path from 'path';
import { createServer } from 'http';
import { setupSocketIO } from './server/socket.js';
import { syncAllUsersChatGroups } from './server/services/chat.js';

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 54321;
  const httpServer = createServer(app);
  
  setupSocketIO(httpServer);

  app.use(cors());
  app.use(express.json());

  // Test DB and run init.sql
  try {
    await testDbConnection();
    const initSqlPath = path.join(process.cwd(), 'init.sql');
    if (fs.existsSync(initSqlPath)) {
      const initSql = fs.readFileSync(initSqlPath, 'utf8');
      await pool.query(initSql);
      console.log('Database initialized successfully.');
      
      // Sync chat groups on startup
      await syncAllUsersChatGroups();
    }
  } catch (err) {
    console.error('Database initialization failed:', err);
  }

  // API Routes
  app.use('/api/auth', authRoutes);
  app.use('/api/admin', adminRoutes);
  app.use('/api/schedules', scheduleRoutes);
  app.use('/api/locations', locationRoutes);
  app.use('/api/activities', activityRoutes);
  app.use('/api/groups', groupRoutes);
  app.use('/api/chat', chatRoutes);

  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok' });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    // Production static serving
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
