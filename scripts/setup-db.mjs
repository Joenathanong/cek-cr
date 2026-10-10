// Membuat tabel & mengisi data awal ke database Neon.
// Pemakaian:  DATABASE_URL="postgresql://..." node scripts/setup-db.mjs
// Tambahkan --force untuk mengosongkan database yang sudah berisi data (HATI-HATI).
import fs from 'node:fs';
import path from 'node:path';
import pg from 'pg';

const url = process.env.DATABASE_URL;
if (!url) { console.error('Set DATABASE_URL terlebih dahulu.'); process.exit(1); }
const local = /localhost|127\.0\.0\.1/.test(url);
const client = new pg.Client({ connectionString: url, ssl: local ? false : { rejectUnauthorized: false } });
await client.connect();
const ada = (await client.query(`SELECT to_regclass('public.rate') AS t`)).rows[0].t;
if (ada && !process.argv.includes('--force')) {
  console.error('Database sudah berisi tabel aplikasi. Tidak ada yang diubah. Pakai --force jika memang ingin mengulang dari awal (semua data hilang).');
  process.exit(1);
}
const dir = path.join(path.dirname(new URL(import.meta.url).pathname), '..', 'db');
for (const f of ['schema.sql', 'seed.sql']) {
  process.stdout.write(`Menjalankan ${f}… `);
  await client.query(fs.readFileSync(path.join(dir, f), 'utf8'));
  console.log('selesai');
}
const n = (await client.query('SELECT (SELECT count(*) FROM rate) r, (SELECT count(*) FROM distributor) d, (SELECT count(*) FROM kota) k')).rows[0];
console.log(`Data awal: ${n.r} rate, ${n.d} distributor, ${n.k} kota.`);
console.log('Login pertama: username "admin", password "Admin#2026" (wajib diganti saat login).');
await client.end();
