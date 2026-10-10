// Susunan tampilan & export "Cek CR": item SO per distributor + baris total berisi rekomendasi ekspedisi.
import { leadtimeText } from './format';
import { FMT } from './excel-fmt';

/**
 * detail: baris hasil prosesMassal().detail
 * hasil: array hasil hitung server (per kode distributor)
 */
export function susunGrup(detail, hasil = []) {
  const hMap = new Map(hasil.map((h) => [String(h.kode), h]));
  const g = new Map();
  for (const d of detail) {
    let x = g.get(d.kode);
    if (!x) {
      x = { kode: d.kode, nama: d.nama, kota: d.kota, kotaLabel: d.kotaSap || d.kota, kunci: d.kunci, area: d.area, asm: d.asm, prioritas: d.prioritas, items: [],
        total: { qty: 0, pending: 0, alokasi: 0, pendingAvail: 0, nilai: 0, nilaiPpn: 0, kg: 0, m3: 0 } };
      g.set(d.kode, x);
    }
    x.items.push(d);
    const t = x.total;
    t.qty += d.qty; t.pending += d.pendingValue || 0; t.alokasi += d.dikirim ?? d.alokasi; t.pendingAvail += d.pendingAvail || 0;
    t.alokasiAwal = (t.alokasiAwal || 0) + (d.alokasiAwal ?? d.alokasi);
    t.nilai += d.nilai; t.nilaiPpn += d.nilaiPpn; t.kg += d.kg; t.m3 += d.m3;
  }
  const out = [...g.values()].map((x) => ({ ...x, hasil: hMap.get(String(x.kode)) || null }));
  out.sort((a, b) => (a.prioritas ?? 9999) - (b.prioritas ?? 9999) || String(a.area || '').localeCompare(String(b.area || ''))
    || String(a.kota || '').localeCompare(String(b.kota || '')) || String(a.nama || '').localeCompare(String(b.nama || '')));
  return out;
}

export function ketTotal(grp) {
  const h = grp.hasil;
  if (h?.meta && !h.meta.dikirim) return h.meta.status;
  if (grp.total.alokasi <= 0) return 'Tidak ada stok untuk dikirim';
  if (!h) return 'Belum dihitung';
  if (!h.utama) return h.peringatan?.[0] || 'Tidak ada rate ekspedisi';
  return '';
}

const u = (g) => g.hasil?.utama;
export const KOLOM_CEKCR = [
  { label: 'Prioritas', item: (d) => (d.prioritas === 9999 ? '' : d.prioritas), total: () => null, width: 9 },
  { label: 'Dasar Prioritas', item: (d) => d.kunci, total: () => null, width: 16 },
  { label: 'Area', item: (d) => d.area, total: () => null },
  { label: 'ASM', item: (d) => d.asm, total: () => null, width: 18 },
  { label: 'Kota', item: (d) => d.kotaSap || d.kota, total: (g) => `${g.kotaLabel || g.nama} Total`, width: 18 },
  { label: 'Customer Reference', item: (d) => d.ref, total: () => null, width: 30 },
  { label: 'No. SO', item: (d) => d.doc, total: () => null, width: 12 },
  { label: 'Tanggal SO', item: (d) => d.tanggal, total: () => null, width: 11 },
  { label: 'Tipe SO', item: (d) => d.tipe, total: () => null, width: 20 },
  { label: 'Kode Distributor', item: (d) => d.kode, total: (g) => g.kode, width: 13 },
  { label: 'Distributor', item: (d) => d.nama, total: (g) => g.nama, width: 32 },
  { label: 'Status Produk', item: (d) => d.status, total: () => null, width: 12 },
  { label: 'Material', item: (d) => d.material, total: () => null, width: 12 },
  { label: 'Deskripsi Material', item: (d) => d.deskripsi, total: () => null, width: 36 },
  { label: 'Qty Outstanding', item: (d) => d.qty, total: (g) => g.total.qty, fmt: FMT.rp },
  { label: 'Pending Value', item: (d) => d.pendingValue, total: (g) => g.total.pending, fmt: FMT.rp, width: 14 },
  { label: 'Qty Alokasi Awal', item: (d) => d.alokasiAwal ?? d.alokasi, total: (g) => g.total.alokasiAwal, fmt: FMT.rp },
  { label: 'Pengalihan', item: (d) => d.pengalihan || null, total: () => null, width: 28 },
  { label: 'Qty Dikirim (S-Avail)', item: (d) => d.dikirim ?? d.alokasi, total: (g) => g.total.alokasi, fmt: FMT.rp },
  { label: 'Pending By Avail-S', item: (d) => d.pendingAvail, total: (g) => g.total.pendingAvail, fmt: FMT.rp, width: 14 },
  { label: 'Value VA05 (N)', item: (d) => d.nilai, total: (g) => g.total.nilai, fmt: FMT.rp, width: 14 },
  { label: 'Value VA05 (N x 1,11)', item: (d) => d.nilaiPpn, total: (g) => g.total.nilaiPpn, fmt: FMT.rp, width: 14 },
  { label: 'Total KG', item: (d) => d.kg, total: (g) => g.total.kg, fmt: FMT.angka },
  { label: 'Total M3', item: (d) => d.m3, total: (g) => g.total.m3, fmt: FMT.m3 },
  { label: 'Status Kirim', item: () => null, total: (g) => g.hasil?.meta?.status || (g.total.alokasi > 0 ? 'Dikirim' : null), width: 22 },
  { label: 'CR Awal (%)', item: () => null, total: (g) => g.hasil?.meta?.crAwal ?? null, fmt: FMT.angka },
  { label: 'Ekspedisi', item: () => null, total: (g) => u(g)?.ekspedisi, width: 30 },
  { label: 'Layanan', item: () => null, total: (g) => u(g) && `${u(g).layanan}${u(g).armada ? ' ' + u(g).armada : ''}`, width: 16 },
  { label: 'Ongkir (Rp)', item: () => null, total: (g) => u(g)?.ongkir, fmt: FMT.rp, width: 13 },
  { label: 'Leadtime', item: () => null, total: (g) => u(g) && leadtimeText(u(g).leadtime_min, u(g).leadtime_max), width: 12 },
  { label: 'Cost Ratio (%)', item: () => null, total: (g) => u(g)?.cr, fmt: FMT.angka },
  { label: 'Alasan / Catatan', item: () => null, total: (g) => g.hasil?.meta?.alasan || ketTotal(g) || (g.hasil?.peringatan || []).join(' '), width: 70 },
];

/** Baris untuk export: item lalu baris total per distributor. */
export function barisCekCr(groups, { hanyaDikirim = false } = {}) {
  const rows = [];
  for (const g of groups) {
    for (const d of g.items) {
      if (hanyaDikirim && d.alokasi <= 0) continue;
      rows.push(KOLOM_CEKCR.map((k) => k.item(d)));
    }
    rows.push(KOLOM_CEKCR.map((k) => k.total(g)));
  }
  return rows;
}

/** Ringkas item untuk disimpan di riwayat. */
export function ringkasItem(detail) {
  return detail.map((d) => ({
    kode: d.kode, nama: d.nama, kota: d.kota, kotaSap: d.kotaSap, kunci: d.kunci, area: d.area, asm: d.asm, prioritas: d.prioritas, ref: d.ref, doc: d.doc,
    tanggal: d.tanggal, tipe: d.tipe, status: d.status, material: d.material, deskripsi: d.deskripsi, qty: d.qty,
    pendingValue: d.pendingValue, alokasi: d.alokasi, alokasiAwal: d.alokasiAwal ?? d.alokasi, dikirim: d.dikirim ?? d.alokasi,
    pengalihan: d.pengalihan || null, statusKirim: d.statusKirim || null, pendingAvail: d.pendingAvail, nilai: Math.round(d.nilai * 100) / 100,
    nilaiPpn: Math.round(d.nilaiPpn * 100) / 100, kg: Math.round(d.kg * 1000) / 1000, m3: Math.round(d.m3 * 10000) / 10000,
  }));
}
