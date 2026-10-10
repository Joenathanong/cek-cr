// Koneksi PostgreSQL (Neon). Hanya dipakai di server.
import pg from 'pg';

pg.types.setTypeParser(1700, (v) => (v == null ? null : parseFloat(v))); // numeric
pg.types.setTypeParser(20, (v) => (v == null ? null : parseInt(v, 10))); // int8
pg.types.setTypeParser(1082, (v) => v); // date -> 'YYYY-MM-DD'

const g = globalThis;
if (!g.__pgPool) {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL belum diatur');
  const local = /localhost|127\.0\.0\.1/.test(process.env.DATABASE_URL);
  g.__pgPool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: local ? false : { rejectUnauthorized: false },
    max: 3,
    // koneksi cepat ditutup supaya compute Neon bisa "tidur" dan hemat CU-hour
    idleTimeoutMillis: 5000,
  });
}
export const pool = g.__pgPool;

export async function query(text, params) {
  const res = await pool.query(text, params);
  return res.rows;
}

/**
 * Jalankan beberapa query dalam satu transaksi, dengan identitas user
 * supaya trigger Last Change & log perubahan tahu siapa yang mengubah.
 */
export async function withUser(user, fn, keterangan) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(
      `SELECT set_config('app.user_id', $1, true), set_config('app.username', $2, true), set_config('app.keterangan', $3, true)`,
      [String(user?.id ?? ''), user?.username ?? 'system', keterangan ?? '']
    );
    const q = async (text, params) => (await client.query(text, params)).rows;
    const out = await fn(q);
    await client.query('COMMIT');
    return out;
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    throw e;
  } finally {
    client.release();
  }
}

export async function catatLog(user, { tabel, aksi, keterangan, data_baru = null }) {
  await query(
    `INSERT INTO audit_log (tabel, aksi, keterangan, data_baru, user_id, username) VALUES ($1,$2,$3,$4,$5,$6)`,
    [tabel, aksi, keterangan, data_baru ? JSON.stringify(data_baru) : null, user?.id ?? null, user?.username ?? 'system']
  );
}
