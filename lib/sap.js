// Pengolahan file SAP (ZSDR007, ZSDR006, VA05, Stock) untuk cek cost ratio massal.
// Berjalan di browser. Hasil akhirnya: total kg, m3 dan nilai PO (exclude PPN) per distributor.
import * as XLSX from 'xlsx';
import { normHeader } from './excel-norm';

// Header per laporan (nama kolom dari export SAP). Beberapa nama alternatif diterima.
export const LAPORAN = {
  ZSDR007: {
    label: 'ZSDR007 (SO outstanding)',
    ciri: ['qtydiff', 'docnumber'],
    kolom: {
      doc: ['Doc. Number', 'Sales Document'], customer: ['Customer', 'Sold-to party'], nama: ['Name', 'Sold To Name'],
      material: ['Material'], deskripsi: ['Material description'], qty: ['Qty Diff'], tanggal: ['Document Date'],
      item: ['Item (SD)', 'Item'], ref: ['Customer Reference'], tipe: ['Description'], pending: ['Pending Value'],
      asm: ['ASM'], kota: ['City'], area: ['AREA'],
    },
    wajib: ['doc', 'customer', 'material', 'qty'],
  },
  ZSDR006: {
    label: 'ZSDR006 (berat & volume)',
    ciri: ['sototalweights'],
    wajib: ['doc', 'material', 'qty', 'berat', 'volume'],
    kolom: {
      doc: ['Sales Document'], material: ['Material'], qty: ['Order Quantity'],
      berat: ['SO Total Weights'], satuanBerat: ['Weight unit'], volume: ['SO Total Volumes'], satuanVolume: ['Volume unit'],
    },
  },
  VA05: {
    label: 'VA05 (harga)',
    ciri: ['netvalueitem'],
    kolom: { doc: ['Sales Document'], material: ['Material'], qty: ['Order Quantity (Item)', 'Order Quantity'], nilai: ['Net Value (Item)', 'Net Value'] },
    wajib: ['doc', 'material', 'qty', 'nilai'],
  },
  STOCK: {
    label: 'Stock',
    ciri: ['sumofavailablestock'],
    alt: ['availablestock'],
    kolom: { material: ['Material'], stok: ['Sum of Available stock', 'Available stock', 'Available Stock'] },
    wajib: ['material', 'stok'],
  },
};

const docKey = (v) => {
  const s = String(v ?? '').trim();
  return /^\d+$/.test(s) ? String(Number(s)) : s.toUpperCase();
};
const matKey = (v) => String(v ?? '').trim().toUpperCase();
const num = (v) => {
  if (typeof v === 'number') return v;
  if (v == null || v === '') return 0;
  const n = Number(String(v).replace(/,/g, ''));
  return isNaN(n) ? 0 : n;
};
const tgl = (v) => (v instanceof Date ? v.getTime() : typeof v === 'number' ? v * 86400000 : Date.parse(v) || 0);

/** Cari sheet & baris header yang cocok dengan ciri laporan. */
export function deteksi(workbooks) {
  const found = {};
  for (const { nama: file, wb } of workbooks) {
    for (const sn of wb.SheetNames) {
      const ws = wb.Sheets[sn];
      const aoa = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: null, blankrows: false, range: 0 }).slice(0, 15);
      for (let i = 0; i < aoa.length; i++) {
        const hs = new Set((aoa[i] || []).map(normHeader));
        for (const [kode, L] of Object.entries(LAPORAN)) {
          if (found[kode]) continue;
          const ok = L.ciri.every((c) => hs.has(c)) || (L.alt && L.alt.every((c) => hs.has(c)) && hs.has('material') && !hs.has('qtydiff'));
          if (ok) found[kode] = { file, sheet: sn, ws, headerIdx: i };
        }
      }
    }
  }
  return found;
}

function baca(found, kode) {
  const { ws, headerIdx } = found;
  const aoa = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: null, blankrows: false });
  const hdr = (aoa[headerIdx] || []).map(normHeader);
  const idx = {}, hilang = [];
  for (const [k, alts] of Object.entries(LAPORAN[kode].kolom)) {
    const i = alts.map(normHeader).map((a) => hdr.indexOf(a)).find((x) => x >= 0);
    if (i != null) idx[k] = i;
    else if (!LAPORAN[kode].wajib || LAPORAN[kode].wajib.includes(k)) hilang.push(alts[0]);
  }
  const rows = [];
  for (let r = headerIdx + 1; r < aoa.length; r++) {
    const a = aoa[r];
    if (!a) continue;
    const o = {};
    for (const [k, i] of Object.entries(idx)) o[k] = a[i];
    rows.push(o);
  }
  return { rows, hilang };
}

const kgFaktor = (u) => ({ KG: 1, G: 0.001, GR: 0.001, TO: 1000, TON: 1000, LB: 0.4536 }[matKey(u)] ?? 1);
const m3Faktor = (u) => ({ M3: 1, CCM: 1e-6, CM3: 1e-6, DM3: 0.001, L: 0.001 }[matKey(u)] ?? 1);

export const STATUS = { READY: 'stock ready', TIPIS: 'stock tipis', KOSONG: 'Stock Kosong' };

const up = (v) => (v == null ? '' : String(v).trim().toUpperCase());
const terisi = (v) => { const t = up(v); return !!t && !t.startsWith('#') && t !== '0'; };

/** Baris SO outstanding dari ZSDR007, dilengkapi data master distributor. */
function barisZsdr(found, distributor) {
  const { rows, hilang } = baca(found.ZSDR007, 'ZSDR007');
  if (hilang.length) return { error: [`${LAPORAN.ZSDR007.label}: kolom tidak ditemukan: ${hilang.join(', ')}`] };
  const dMap = new Map(distributor.map((d) => [String(d.kode), d]));
  const lines = rows.filter((r) => r.doc && r.material && num(r.qty) > 0).map((r) => {
    const kode = docKey(r.customer);
    const d = dMap.get(kode);
    return {
      doc: docKey(r.doc), item: num(r.item), kode, namaSap: r.nama ? String(r.nama).trim() : '',
      nama: d?.nama || (r.nama ? String(r.nama).trim() : ''),
      material: matKey(r.material), deskripsi: r.deskripsi || '', qty: num(r.qty), t: tgl(r.tanggal),
      tanggal: r.tanggal instanceof Date ? r.tanggal.toISOString().slice(0, 10) : r.tanggal ?? null,
      ref: r.ref || '', tipe: r.tipe || '', pendingValue: r.pending == null ? null : num(r.pending),
      kota: d?.kota || up(r.kota) || null, area: d?.area || up(r.area) || null, asm: d?.asm || (r.asm ? String(r.asm).trim() : null),
      kotaSap: up(r.kota), areaSap: up(r.area), asmSap: up(r.asm), terdaftar: !!d,
    };
  });
  // Kolom lookup City, ASM, AREA di ZSDR007 terisi semua -> pakai kolom tersebut (opsi b); jika tidak -> master distributor (opsi a)
  const sumber = lines.length && lines.every((l) => terisi(l.kotaSap) && terisi(l.areaSap) && terisi(l.asmSap)) ? 'SAP' : 'MASTER';
  return { lines, sumber };
}

export function kunciPrioritas(l, mode, sumber) {
  if (mode === 'KOTA') return (sumber === 'SAP' ? l.kotaSap : l.kota) || `KODE ${l.kode}`;
  return (sumber === 'SAP' ? l.areaSap : l.area) || 'TANPA AREA';
}

/**
 * Daftar area & kota yang ada di ZSDR007 (urut abjad) untuk pop up prioritas.
 * @returns {{ sumber, AREA: [{key, jumlahSo, info}], KOTA: [...] } | {error}}
 */
export function daftarPrioritas(found, distributor) {
  if (!found.ZSDR007) return { error: ['ZSDR007 belum ada.'] };
  const z = barisZsdr(found, distributor);
  if (z.error) return z;
  const out = { sumber: z.sumber };
  for (const mode of ['AREA', 'KOTA']) {
    const m = new Map();
    for (const l of z.lines) {
      const k = kunciPrioritas(l, mode, z.sumber);
      const x = m.get(k) || { key: k, jumlahSo: 0, dist: new Set(), area: new Set() };
      x.jumlahSo += 1; x.dist.add(l.nama || l.kode); if (l.area || l.areaSap) x.area.add(z.sumber === 'SAP' ? l.areaSap : l.area);
      m.set(k, x);
    }
    out[mode] = [...m.values()].sort((a, b) => a.key.localeCompare(b.key)).map((x) => ({
      key: x.key, jumlahSo: x.jumlahSo,
      area: [...x.area].filter(Boolean).join(', '), dist: [...x.dist].join(', '), jumlahDist: x.dist.size,
    }));
  }
  return out;
}

/**
 * @param found hasil deteksi()
 * @param distributor [{kode, nama, kota, area, asm}] dari master
 * @param opsi { mode: 'AREA' | 'KOTA', urutan: [key berurutan] }
 */
export function prosesMassal(found, distributor, opsi = {}) {
  const masalah = [];
  for (const k of Object.keys(LAPORAN)) if (!found[k]) masalah.push(`File ${LAPORAN[k].label} belum dipilih / tidak dikenali.`);
  if (masalah.length) return { error: masalah };

  const data = {};
  for (const k of ['ZSDR006', 'VA05', 'STOCK']) {
    const { rows, hilang } = baca(found[k], k);
    if (hilang.length) masalah.push(`${LAPORAN[k].label}: kolom tidak ditemukan: ${hilang.join(', ')}`);
    data[k] = rows;
  }
  const z = barisZsdr(found, distributor);
  if (z.error) masalah.push(...z.error);
  if (masalah.length) return { error: masalah };
  const mode = opsi.mode === 'KOTA' ? 'KOTA' : 'AREA';
  const rank = new Map((opsi.urutan || []).map((k, i) => [String(k).toUpperCase(), i + 1]));

  // Stok tersedia per material
  const stok = new Map();
  for (const r of data.STOCK) {
    const m = matKey(r.material);
    if (m) stok.set(m, (stok.get(m) || 0) + num(r.stok));
  }
  // Harga per PC (exclude PPN) dari VA05
  const va = new Map();
  for (const r of data.VA05) {
    const k = docKey(r.doc) + '|' + matKey(r.material);
    const x = va.get(k) || { q: 0, v: 0 };
    x.q += num(r.qty); x.v += num(r.nilai); va.set(k, x);
  }
  // Berat & volume per PC dari ZSDR006
  const z6 = new Map();
  for (const r of data.ZSDR006) {
    const k = docKey(r.doc) + '|' + matKey(r.material);
    const x = z6.get(k) || { q: 0, kg: 0, m3: 0 };
    x.q += num(r.qty);
    x.kg += num(r.berat) * kgFaktor(r.satuanBerat);
    x.m3 += num(r.volume) * m3Faktor(r.satuanVolume);
    z6.set(k, x);
  }

  // urut: prioritas (area atau kota) -> tanggal dokumen -> no. SO -> item
  const lines = z.lines.map((l) => {
    const kunci = kunciPrioritas(l, mode, z.sumber);
    return { ...l, kunci, prioritas: rank.get(kunci) ?? 9999 };
  }).sort((a, b) => a.prioritas - b.prioritas || a.t - b.t || (a.doc < b.doc ? -1 : a.doc > b.doc ? 1 : 0) || a.item - b.item);

  const sisa = new Map(stok);
  const detail = [];
  let tanpaHarga = 0, tanpaBerat = 0;
  for (const l of lines) {
    const ada = sisa.get(l.material) || 0;
    const alok = Math.max(0, Math.min(l.qty, ada));
    sisa.set(l.material, ada - alok);
    const k = l.doc + '|' + l.material;
    const h = va.get(k), w = z6.get(k);
    const hargaPc = h && h.q ? h.v / h.q : null;
    const kgPc = w && w.q ? w.kg / w.q : null;
    const m3Pc = w && w.q ? w.m3 / w.q : null;
    if (alok > 0 && hargaPc == null) tanpaHarga++;
    if (alok > 0 && kgPc == null) tanpaBerat++;
    const pendingAvail = l.pendingValue != null && l.qty ? (l.pendingValue / l.qty) * alok : null;
    const nilai = alok * (hargaPc || 0);
    detail.push({
      ...l, alokasi: alok, kurang: l.qty - alok, hargaPc, kgPc, m3Pc, pendingAvail, stokAwal: stok.get(l.material) || 0,
      nilai, nilaiPpn: nilai * 1.11, kg: alok * (kgPc || 0), m3: alok * (m3Pc || 0),
      status: alok === 0 ? STATUS.KOSONG : alok < l.qty ? STATUS.TIPIS : STATUS.READY,
    });
  }

  // Jumlahkan per distributor (semua SO ke distributor yang sama digabung)
  const agg = new Map();
  for (const d of detail) {
    const a = agg.get(d.kode) || { kode: d.kode, nama: d.nama, kota: d.kota, asm: d.asm, prioritas: d.prioritas, kunci: d.kunci,
      area: d.area, terdaftar: d.terdaftar, kg: 0, m3: 0, nilaiPo: 0, qtyOrder: 0, qtyAlokasi: 0, so: new Set() };
    a.kg += d.kg; a.m3 += d.m3; a.nilaiPo += d.nilai; a.qtyOrder += d.qty; a.qtyAlokasi += d.alokasi;
    if (d.alokasi > 0) a.so.add(d.doc);
    agg.set(d.kode, a);
  }
  const ringkasan = [...agg.values()].map((a) => ({
    ...a, jumlahSo: a.so.size, so: [...a.so].join(', '),
    kg: Math.round(a.kg * 1000) / 1000, m3: Math.round(a.m3 * 10000) / 10000, nilaiPo: Math.round(a.nilaiPo),
  }));

  // rekap stok per material: stok, total order, dialokasikan, sisa
  const rekap = new Map();
  for (const d of detail) {
    const x = rekap.get(d.material) || { material: d.material, deskripsi: d.deskripsi, stok: stok.get(d.material) || 0, order: 0, alokasi: 0, jumlahSo: 0 };
    x.order += d.qty; x.alokasi += d.alokasi; x.jumlahSo += 1; rekap.set(d.material, x);
  }
  const stokMaterial = [...rekap.values()].map((x) => ({
    ...x, sisa: x.stok - x.alokasi, kurang: x.order - x.alokasi,
    status: x.alokasi === 0 ? STATUS.KOSONG : x.alokasi < x.order ? STATUS.TIPIS : STATUS.READY,
  })).sort((a, b) => a.material.localeCompare(b.material));

  const info = [];
  if (tanpaHarga) info.push(`${tanpaHarga} baris SO tidak ditemukan harganya di VA05 (nilai dihitung 0).`);
  if (tanpaBerat) info.push(`${tanpaBerat} baris SO tidak ditemukan berat/volumenya di ZSDR006 (berat dihitung 0).`);
  const belum = ringkasan.filter((r) => !r.terdaftar);
  if (belum.length) info.push(`${belum.length} kode distributor belum terdaftar di master: ${belum.map((b) => b.kode).join(', ')}.`);

  return {
    ringkasan, detail, info, stokMaterial,
    mode, sumber: z.sumber, statistik: { barisSo: lines.length, material: stok.size, distributor: ringkasan.length },
  };
}
