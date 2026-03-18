import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

// Configured connection pool for high concurrency
// 150 concurrent reads, 10 concurrent writes -> max 160 connections
export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 160, // Max number of clients in the pool
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

export async function testDbConnection() {
  if (!process.env.DATABASE_URL) {
    console.warn('DATABASE_URL is not set. Database connection will fail.');
    return;
  }
  try {
    const client = await pool.connect();
    console.log('Successfully connected to PostgreSQL database.');
    client.release();
  } catch (err) {
    console.error('Failed to connect to PostgreSQL database:', err);
  }
}
