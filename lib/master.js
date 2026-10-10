// Logika server untuk master data generik: list, simpan, hapus, upload Excel.
import { ENTITIES, REF_LABEL, normText } from './entities';
import { query, withUser } from './db';
import { parseAngka } from './format';
import { HttpError } from './auth';

export function getEntity(name) {
  const e = ENTITIES[name];
  if (!e) throw new HttpError(404, 'Master data tidak ditemukan');
  return e;
}

export async function listRows(name) {
  const e = getEntity(name);
  const joins = [], cols = ['t.*'];
  for (const f of e.fields.filter((f) => f.type === 'ref')) {
    const alias = `j_${f.key}`;
    joins.push(`LEFT JOIN ${ENTITIES[f.ref].table} ${alias} ON ${alias}.id = t.${f.key}`);
    cols.push(`${alias}.${REF_LABEL[f.ref]} AS ${f.key}_label`);
  }
  const sql = `SELECT * FROM (SELECT ${cols.join(', ')} FROM ${e.table} t ${joins.join(' ')}) s ORDER BY ${e.sort}, id`;
  return query(sql);
}

/** Peta label -> id untuk semua entitas yang dirujuk (kota juga lewat alias). */
export async function refMaps(e) {
  const maps = {};
  for (const f of e.fields.filter((f) => f.type === 'ref')) {
    if (maps[f.ref]) continue;
    const lbl = REF_LABEL[f.ref];
    const extra = f.ref === 'kota' ? ', alias' : f.ref === 'gudang' ? ', nama, plant' : f.ref === 'ekspedisi' ? ', kode' : '';
    const rows = await query(`SELECT id, ${lbl} AS label${extra} FROM ${ENTITIES[f.ref].table}`);
    const m = new Map();
    for (const r of rows) {
      m.set(normText(r.label), r.id);
      if (r.alias) for (const a of r.alias.split(',')) if (a.trim()) m.set(normText(a), r.id);
      if (r.plant) m.set(normText(r.plant), r.id);
      if (f.ref === 'gudang' && r.nama) m.set(normText(r.nama), r.id);
    }
    // nama kota resmi selalu menang atas alias
    for (const r of rows) m.set(normText(r.label), r.id);
    maps[f.ref] = m;
  }
  return maps;
}

const TRUE = ['YA', 'Y', 'TRUE', '1', 'AKTIF', 'YES'];
const FALSE = ['TIDAK', 'T', 'N', 'FALSE', '0', 'NONAKTIF', 'NO'];

function coerce(f, raw, mode, maps) {
  const empty = raw == null || (typeof raw === 'string' && raw.trim() === '');
  if (empty) {
    if (f.type === 'bool') return { v: f.default ?? false };
    if (f.required) return { err: `${f.label} wajib diisi` };
    return { v: null };
  }
  switch (f.type) {
    case 'text': {
      const s = String(raw).replace(/\s+/g, ' ').trim();
      return { v: f.upper ? s.toUpperCase() : s };
    }
    case 'number':
    case 'int': {
      const x = parseAngka(raw);
      if (x == null) return { err: `${f.label} harus berupa angka` };
      if (x < 0) return { err: `${f.label} tidak boleh negatif` };
      return { v: f.type === 'int' ? Math.round(x) : x };
    }
    case 'bool': {
      if (typeof raw === 'boolean') return { v: raw };
      const s = normText(raw);
      if (TRUE.includes(s)) return { v: true };
      if (FALSE.includes(s)) return { v: false };
      return { err: `${f.label} harus Ya / Tidak` };
    }
    case 'date': {
      const s = String(raw).trim().slice(0, 10);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(s) || isNaN(Date.parse(s))) return { err: `${f.label} harus format YYYY-MM-DD` };
      return { v: s };
    }
    case 'enum': {
      const s = normText(raw);
      if (!f.options.includes(s)) return { err: `${f.label} harus salah satu dari: ${f.options.join(', ')}` };
      return { v: s };
    }
    case 'ref': {
      if (mode === 'form') {
        const id = Number(raw);
        return Number.isInteger(id) && id > 0 ? { v: id } : { err: `${f.label} tidak valid` };
      }
      const id = maps[f.ref]?.get(normText(raw));
      if (!id) return { err: `${f.label} "${raw}" tidak ditemukan di master ${ENTITIES[f.ref].label}` };
      return { v: id };
    }
    default:
      return { v: raw };
  }
}

export function validateRow(name, e, raw, mode, maps) {
  const row = {}, errs = [];
  for (const f of e.fields) {
    const { v, err } = coerce(f, raw[f.key], mode, maps);
    if (err) errs.push(err); else row[f.key] = v;
  }
  if (name === 'rate' && !errs.length) {
    if (row.jenis === 'CARTER' && !row.armada_id) errs.push('Armada wajib diisi untuk jenis CARTER');
    if (row.jenis !== 'CARTER') row.armada_id = null;
    if (row.jenis !== 'KG') row.faktor_volumetrik = null;
    if (row.leadtime_min != null && row.leadtime_max != null && row.leadtime_min > row.leadtime_max)
      errs.push('Leadtime Min lebih besar dari Leadtime Max');
    if (row.minimum != null && row.maksimum != null && row.minimum > row.maksimum)
      errs.push('Minimum lebih besar dari Maksimum');
  }
  return { row, errs };
}

const keyOf = (e, r) => JSON.stringify(e.naturalKey.map((k) => (r[k] == null ? null : typeof r[k] === 'string' ? normText(r[k]) : r[k])));

function same(a, b) {
  if (a == null && b == null) return true;
  if (a == null || b == null) return false;
  if (typeof a === 'number' || typeof b === 'number') return Number(a) === Number(b);
  return String(a) === String(b);
}

export async function saveRow(user, name, body, id) {
  const e = getEntity(name);
  const { row, errs } = validateRow(name, e, body, 'form', {});
  if (errs.length) throw new HttpError(400, errs.join('. '));
  const cols = e.fields.map((f) => f.key);
  return withUser(user, async (q) => {
    if (id) {
      const set = cols.map((c, i) => `${c} = $${i + 1}`).join(', ');
      const rows = await q(`UPDATE ${e.table} SET ${set} WHERE id = $${cols.length + 1} RETURNING id`, [...cols.map((c) => row[c]), id]);
      if (!rows.length) throw new HttpError(404, 'Data tidak ditemukan');
      return rows[0];
    }
    const ph = cols.map((_, i) => `$${i + 1}`).join(', ');
    const rows = await q(`INSERT INTO ${e.table} (${cols.join(', ')}) VALUES (${ph}) RETURNING id`, cols.map((c) => row[c]));
    return rows[0];
  }, 'Edit di aplikasi');
}

export async function deleteRow(user, name, id) {
  const e = getEntity(name);
  await withUser(user, (q) => q(`DELETE FROM ${e.table} WHERE id = $1`, [id]), 'Hapus di aplikasi');
}

/**
 * Upload Excel: semua baris divalidasi dulu. Jika ada satu error, tidak ada yang disimpan.
 * Baris dengan kunci yang sama diperbarui, yang baru ditambahkan, yang tidak berubah dilewati.
 */
export async function importRows(user, name, rows, fileName) {
  const e = getEntity(name);
  if (!Array.isArray(rows) || !rows.length) throw new HttpError(400, 'File tidak berisi data.');
  if (rows.length > 20000) throw new HttpError(400, 'Maksimal 20.000 baris per upload.');
  const maps = await refMaps(e);
  const existing = await query(`SELECT * FROM ${e.table}`);
  const byKey = new Map(existing.map((r) => [keyOf(e, r), r]));
  const seen = new Map();
  const errors = [], inserts = [], updates = [];
  let unchanged = 0;

  rows.forEach((raw, i) => {
    const line = raw.__row || i + 2;
    const { row, errs } = validateRow(name, e, raw, 'import', maps);
    if (errs.length) { errors.push({ baris: line, pesan: errs.join('; ') }); return; }
    const k = keyOf(e, row);
    if (seen.has(k)) { errors.push({ baris: line, pesan: `Duplikat dengan baris ${seen.get(k)}` }); return; }
    seen.set(k, line);
    const old = byKey.get(k);
    if (!old) inserts.push(row);
    else if (e.fields.some((f) => !same(old[f.key], row[f.key]))) updates.push({ ...row, id: old.id });
    else unchanged++;
  });

  if (errors.length) return { ok: false, errors: errors.slice(0, 300), totalErrors: errors.length };

  const cols = e.fields.map((f) => f.key);
  await withUser(user, async (q) => {
    for (let i = 0; i < inserts.length; i += 2000) {
      await q(
        `INSERT INTO ${e.table} (${cols.join(', ')}) SELECT ${cols.join(', ')} FROM json_populate_recordset(NULL::${e.table}, $1)`,
        [JSON.stringify(inserts.slice(i, i + 2000))]
      );
    }
    for (let i = 0; i < updates.length; i += 2000) {
      await q(
        `UPDATE ${e.table} t SET ${cols.map((c) => `${c} = x.${c}`).join(', ')}
         FROM json_populate_recordset(NULL::${e.table}, $1) x WHERE t.id = x.id`,
        [JSON.stringify(updates.slice(i, i + 2000))]
      );
    }
    await q(
      `INSERT INTO audit_log (tabel, aksi, keterangan, data_baru, user_id, username) VALUES ($1,'UPLOAD',$2,$3,$4,$5)`,
      [e.table, `Upload ${fileName || 'Excel'}: ${inserts.length} baru, ${updates.length} diubah, ${unchanged} tetap`,
        JSON.stringify({ file: fileName, baru: inserts.length, diubah: updates.length, tetap: unchanged }), user.id, user.username]
    );
  }, `Upload ${fileName || 'Excel'}`);

  return { ok: true, baru: inserts.length, diubah: updates.length, tetap: unchanged };
}
