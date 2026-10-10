'use client';
import { tulisExcel, FMT } from './excel';
import { KOLOM_CEKCR, barisCekCr } from './cekcr';
import { leadtimeText } from './format';

const lt = (o) => (o ? leadtimeText(o.leadtime_min, o.leadtime_max) : null);

export const KOLOM_RINGKASAN = [
  { label: 'Referensi', key: 'ref' },
  { label: 'Kode Distributor', key: 'kode', width: 14 }, { label: 'Distributor', key: 'nama', width: 34 },
  { label: 'Kota', key: 'kota', width: 16 }, { label: 'Area', key: 'area' },
  { label: 'Jumlah SO', key: 'jumlahSo' },
  { label: 'Status Kirim', key: (r) => r.meta?.status || 'Dikirim', width: 24 },
  { label: 'CR Awal (%)', key: (r) => r.meta?.crAwal ?? null, fmt: FMT.angka },
  { label: 'Ekspedisi Awal', key: (r) => r.meta?.ekspAwal ?? null, width: 30 },
  { label: 'Total KG', key: 'kg', fmt: FMT.angka }, { label: 'Total M3', key: 'm3', fmt: FMT.m3 },
  { label: 'Value PO (Rp)', key: 'nilaiPo', fmt: FMT.rp, width: 15 },
  { label: 'Ekspedisi Rekomendasi', key: (r) => r.utama?.ekspedisi, width: 30 },
  { label: 'Layanan', key: (r) => r.utama && r.utama.layanan + (r.utama.armada ? ' ' + r.utama.armada : ''), width: 16 },
  { label: 'Ongkir (Rp)', key: (r) => r.utama?.ongkir, fmt: FMT.rp, width: 14 },
  { label: 'Leadtime', key: (r) => lt(r.utama), width: 13 },
  { label: 'Cost Ratio (%)', key: (r) => r.utama?.cr, fmt: FMT.angka },
  { label: 'Termurah', key: (r) => r.termurah && `${r.termurah.ekspedisi} (${r.termurah.layanan})`, width: 30 },
  { label: 'Ongkir Termurah', key: (r) => r.termurah?.ongkir, fmt: FMT.rp },
  { label: 'Tercepat', key: (r) => r.tercepat && `${r.tercepat.ekspedisi} (${r.tercepat.layanan})`, width: 30 },
  { label: 'Leadtime Tercepat', key: (r) => lt(r.tercepat) },
  { label: 'Ongkir Tercepat', key: (r) => r.tercepat?.ongkir, fmt: FMT.rp },
  { label: 'Alasan', key: (r) => r.meta?.alasan || null, width: 80 },
  { label: 'Catatan', key: (r) => (r.peringatan || []).join(' '), width: 40 },
];

export function exportMassal({ namaFile, catatan = [], groups, hasil, stokMaterial, transfers, denganRef }) {
  const sheets = [];
  if (groups?.length) {
    sheets.push({ nama: 'Cek CR', catatan, kolom: KOLOM_CEKCR.map((k) => ({ label: k.label, fmt: k.fmt, width: k.width })), data: barisCekCr(groups) });
  }
  sheets.push({ nama: 'Ringkasan', catatan, kolom: KOLOM_RINGKASAN.filter((k) => denganRef || k.key !== 'ref'), data: hasil });
  const opsi = hasil.flatMap((r) => (r.opsi || []).filter((o) => typeof o === 'object' && !Array.isArray(o))
    .map((o) => ({ ...o, kode: r.kode, nama: r.nama, kota: r.kota, rek: r.utama && o.rate_id === r.utama.rate_id ? 'Ya' : '' })));
  if (opsi.length) {
    sheets.push({
      nama: 'Semua Opsi',
      kolom: [
        { label: 'Kode Distributor', key: 'kode' }, { label: 'Distributor', key: 'nama', width: 30 }, { label: 'Kota', key: 'kota' },
        { label: 'Ekspedisi', key: 'ekspedisi', width: 30 }, { label: 'Layanan', key: 'layanan' }, { label: 'Jenis', key: 'jenis' },
        { label: 'Armada', key: 'armada' }, { label: 'Dasar Hitung', key: 'dasar', width: 24 },
        { label: 'Ongkir (Rp)', key: 'ongkir', fmt: FMT.rp }, { label: 'Leadtime', key: (o) => lt(o) },
        { label: 'Cost Ratio (%)', key: 'cr', fmt: FMT.angka }, { label: 'Rekomendasi', key: 'rek' },
      ],
      data: opsi,
    });
  }
  if (transfers?.length) {
    sheets.push({
      nama: 'Pengalihan Stok',
      kolom: [
        { label: 'Material', key: 'material' }, { label: 'Deskripsi', key: 'deskripsi', width: 36 }, { label: 'Qty', key: 'qty', fmt: FMT.rp },
        { label: 'Dari Kode', key: 'dari' }, { label: 'Dari Kota', key: 'dariKota', width: 18 },
        { label: 'Ke Kode', key: 'ke' }, { label: 'Ke Kota', key: 'keKota', width: 18 },
        { label: 'CR Penerima Sebelum (%)', key: 'crPenerimaSebelum', fmt: FMT.angka }, { label: 'CR Penerima Sesudah (%)', key: 'crPenerimaSesudah', fmt: FMT.angka },
      ],
      data: transfers,
    });
  }
  if (stokMaterial?.length) {
    sheets.push({
      nama: 'Stok per Material',
      kolom: [
        { label: 'Material', key: 'material' }, { label: 'Deskripsi', key: 'deskripsi', width: 36 },
        { label: 'Stok Tersedia', key: 'stok', fmt: FMT.rp }, { label: 'Total Order', key: 'order', fmt: FMT.rp },
        { label: 'Alokasi Awal', key: 'alokasiAwal', fmt: FMT.rp }, { label: 'Dialihkan', key: 'keluar', fmt: FMT.rp },
        { label: 'Dikirim', key: 'dikirim', fmt: FMT.rp }, { label: 'Ditahan (Cek Manual)', key: 'ditahan', fmt: FMT.rp },
        { label: 'Sisa Gudang', key: 'sisa', fmt: FMT.rp }, { label: 'Selisih', key: 'selisih', fmt: FMT.rp },
        { label: 'Kurang', key: 'kurang', fmt: FMT.rp }, { label: 'Status', key: 'statusStok' },
      ],
      data: stokMaterial,
    });
  }
  tulisExcel(namaFile, sheets);
}
