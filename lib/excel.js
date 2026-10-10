'use client';
// Baca & tulis Excel di browser (SheetJS). File diolah di perangkat user, tidak dikirim mentah ke server.
import * as XLSX from 'xlsx';

export { normHeader } from './excel-norm';
import { normHeader } from './excel-norm';

export async function bacaWorkbook(file) {
  const buf = await file.arrayBuffer();
  return XLSX.read(buf, { type: 'array', cellDates: true });
}

/**
 * Ubah sheet jadi array objek. Baris header dicari otomatis di 15 baris pertama:
 * baris yang paling banyak cocok dengan daftar header yang diharapkan.
 */
export function sheetKeObjek(ws, expected = []) {
  const aoa = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: null, blankrows: false });
  const want = new Set(expected.map(normHeader));
  let hIdx = 0, best = -1;
  for (let i = 0; i < Math.min(15, aoa.length); i++) {
    const score = (aoa[i] || []).filter((c) => want.has(normHeader(c))).length;
    if (score > best) { best = score; hIdx = i; }
  }
  const headers = (aoa[hIdx] || []).map((h) => String(h ?? '').trim());
  const rows = [];
  for (let i = hIdx + 1; i < aoa.length; i++) {
    const r = aoa[i];
    if (!r || r.every((c) => c == null || c === '')) continue;
    const o = { __row: i + 1 };
    headers.forEach((h, j) => { if (h) o[h] = r[j]; });
    rows.push(o);
  }
  return { headers, rows, headerRow: hIdx + 1 };
}

export function tanggalISO(v) {
  if (v == null || v === '') return null;
  if (v instanceof Date) {
    const d = new Date(v.getTime() - v.getTimezoneOffset() * 60000);
    return d.toISOString().slice(0, 10);
  }
  if (typeof v === 'number') {
    const p = XLSX.SSF.parse_date_code(v);
    if (p) return `${p.y}-${String(p.m).padStart(2, '0')}-${String(p.d).padStart(2, '0')}`;
  }
  const s = String(v).trim();
  const m = s.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/);
  if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  return s.slice(0, 10);
}

/**
 * sheets: [{ nama, kolom: [{ label, key, width?, fmt? }], data: [obj], catatan?: [string] }]
 */
export function tulisExcel(namaFile, sheets) {
  const wb = XLSX.utils.book_new();
  for (const s of sheets) {
    const aoa = [];
    if (s.catatan?.length) { s.catatan.forEach((c) => aoa.push([c])); aoa.push([]); }
    aoa.push(s.kolom.map((k) => k.label));
    for (const d of s.data) aoa.push(s.kolom.map((k, i) => (Array.isArray(d) ? d[i] : typeof k.key === 'function' ? k.key(d) : d[k.key]) ?? null));
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws['!cols'] = s.kolom.map((k) => ({ wch: k.width || Math.max(10, Math.min(40, String(k.label).length + 2)) }));
    const start = s.catatan?.length ? s.catatan.length + 1 : 0;
    s.kolom.forEach((k, ci) => {
      if (!k.fmt) return;
      for (let ri = start + 1; ri < aoa.length; ri++) {
        const cell = ws[XLSX.utils.encode_cell({ r: ri, c: ci })];
        if (cell && cell.t === 'n') cell.z = k.fmt;
      }
    });
    if (s.data.length) ws['!autofilter'] = { ref: XLSX.utils.encode_range({ s: { r: start, c: 0 }, e: { r: aoa.length - 1, c: s.kolom.length - 1 } }) };
    XLSX.utils.book_append_sheet(wb, ws, s.nama.slice(0, 31));
  }
  XLSX.writeFile(wb, namaFile, { compression: true });
}

export { FMT } from './excel-fmt';
