import pg from 'pg';
import { config } from './config.js';

const { Pool } = pg;

const pool = new Pool(config.database);

// Handle pool errors to prevent crashes
pool.on('error', (err) => {
  console.error('Unexpected database pool error:', err);
});

export default pool;

/**
 * Execute a query with automatic connection handling
 * @param {string} text - SQL query
 * @param {any[]} params - Query parameters
 * @returns {Promise<pg.QueryResult>}
 */
export async function query(text, params) {
  const start = Date.now();
  const result = await pool.query(text, params);
  const duration = Date.now() - start;
  
  if (config.nodeEnv === 'development') {
    console.log('Executed query', { text: text.substring(0, 50), duration, rows: result.rowCount });
  }
  
  return result;
}

/**
 * Get a client from the pool for transactions
 * @returns {Promise<pg.PoolClient>}
 */
export async function getClient() {
  return pool.connect();
}
