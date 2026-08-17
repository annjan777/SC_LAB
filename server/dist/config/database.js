import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();
// Override default DATE parser (OID 1082) so pg returns raw 'YYYY-MM-DD' strings instead of local Date objects
pg.types.setTypeParser(1082, (val) => val);
const { Pool } = pg;
const useSsl = process.env.DB_SSL === 'true';
export const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME || 'sclab',
    user: process.env.DB_USER || process.env.USER || 'postgres',
    password: process.env.DB_PASSWORD !== undefined ? process.env.DB_PASSWORD : '',
    ssl: useSsl ? { rejectUnauthorized: false } : false,
    max: 50,
    idleTimeoutMillis: 30000,
});
pool.on('error', (err) => {
    console.error('Unexpected error on idle DB client:', err);
});
export async function query(text, params) {
    const result = await pool.query(text, params);
    return result;
}
export async function transaction(callback) {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const result = await callback(client);
        await client.query('COMMIT');
        return result;
    }
    catch (err) {
        await client.query('ROLLBACK');
        throw err;
    }
    finally {
        client.release();
    }
}
