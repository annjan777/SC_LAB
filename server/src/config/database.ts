import pg, { PoolClient } from 'pg';
import dotenv from 'dotenv';
dotenv.config();

// Override default DATE parser (OID 1082) so pg returns raw 'YYYY-MM-DD' strings instead of local Date objects
pg.types.setTypeParser(1082, (val) => val);

const { Pool } = pg;
const useSsl = process.env.DB_SSL === 'true';

function createPool() {
  const p = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME || 'sclab',
    user: process.env.DB_USER || process.env.USER || 'postgres',
    password: process.env.DB_PASSWORD !== undefined ? process.env.DB_PASSWORD : '',
    ssl: useSsl ? { rejectUnauthorized: false } : false,
    max: 50,
    idleTimeoutMillis: 30000,
  });
  p.on('error', (err) => {
    console.error('Unexpected error on idle DB client:', err);
  });
  return p;
}

// Exported as `let` (a live ES module binding) rather than `const` so the admin data-restore
// flow can close and replace it — pg_restore needs the pool's connections closed first so it
// can drop/recreate objects without lock conflicts.
export let pool = createPool();

// Closes all pooled connections. Call before running pg_restore against this database.
export async function closePoolForRestore(): Promise<void> {
  await pool.end();
}

// Opens a fresh pool after a restore completes (the old one was ended and can't be reused).
export function reopenPool(): void {
  pool = createPool();
}

export async function query(text: string, params?: any[]) {
  const result = await pool.query(text, params);
  return result;
}

export async function transaction<T>(callback: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
