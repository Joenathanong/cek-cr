// Konfigurasi master data. Dipakai bersama oleh server (API) dan browser (form, upload, export).
// Tipe kolom: text | number | int | bool | date | enum | ref

export const ROLES = {
  admin: 'Admin',
  purchasing: 'Purchasing',
  admin_wh: 'Admin WH',
  warehouse: 'Warehouse',
};

const ALL = ['admin', 'purchasing', 'admin_wh', 'warehouse'];

export const ENTITIES = {
  rate: {
    table: 'rate',
    label: 'Rate Ekspedisi',
    desc: 'Tarif tiap layanan ekspedisi per rute. Satu baris = satu layanan.',
    view: ALL,
    edit: ['admin', 'purchasing'],
    naturalKey: ['ekspedisi_id', 'layanan', 'gudang_id', 'kota_id', 'jenis', 'armada_id', 'berlaku_mulai'],
    sort: 'ekspedisi_id_label, gudang_id_label, kota_id_label, layanan',
    fields: [
      { key: 'ekspedisi_id', label: 'Ekspedisi', type: 'ref', ref: 'ekspedisi', required: true },
      { key: 'layanan', label: 'Layanan', type: 'text', required: true, upper: true, example: 'REGULER' },
      { key: 'gudang_id', label: 'Gudang Asal', type: 'ref', ref: 'gudang', required: true },
      { key: 'kota_id', label: 'Kota Tujuan', type: 'ref', ref: 'kota', required: true },
      { key: 'jenis', label: 'Jenis Perhitungan', type: 'enum', options: ['KG', 'M3', 'CARTER'], required: true },
      { key: 'armada_id', label: 'Armada', type: 'ref', ref: 'armada', hint: 'Wajib untuk CARTER' },
      { key: 'minimum', label: 'Minimum', type: 'number', hint: 'kg / m³ / trip sesuai jenis' },
      { key: 'maksimum', label: 'Maksimum', type: 'number', hint: 'kg / m³ / trip sesuai jenis' },
      { key: 'harga', label: 'Harga (Rp)', type: 'number', required: true, money: true, hint: 'per kg / per m³ / per trip' },
      { key: 'biaya_minimum', label: 'Biaya Minimum (Rp)', type: 'number', money: true, hint: 'Isi jika tarif flat sampai berat minimum' },
      { key: 'biaya_tambahan', label: 'Biaya Tambahan (Rp)', type: 'number', money: true, hint: 'Biaya tetap per kiriman: tol, dokumen' },
      { key: 'faktor_volumetrik', label: 'Faktor Volumetrik (kg/m³)', type: 'number', hint: 'Hanya jenis KG. 1 m³ = X kg, ditagih terbesar' },
      { key: 'leadtime_min', label: 'Leadtime Min (hari)', type: 'number' },
      { key: 'leadtime_max', label: 'Leadtime Max (hari)', type: 'number' },
      { key: 'berlaku_mulai', label: 'Berlaku Mulai', type: 'date', required: true, hint: 'Format YYYY-MM-DD' },
      { key: 'aktif', label: 'Aktif', type: 'bool', default: true },
      { key: 'keterangan', label: 'Keterangan', type: 'text' },
    ],
  },
  ekspedisi: {
    table: 'ekspedisi',
    label: 'Ekspedisi',
    desc: 'Daftar vendor ekspedisi. Ekspedisi nonaktif tidak ikut dihitung.',
    view: ALL,
    edit: ['admin', 'purchasing'],
    naturalKey: ['nama'],
    sort: 'nama',
    fields: [
      { key: 'kode', label: 'Kode Vendor', type: 'text' },
      { key: 'nama', label: 'Nama Ekspedisi', type: 'text', required: true, upper: true },
      { key: 'aktif', label: 'Aktif', type: 'bool', default: true },
      { key: 'keterangan', label: 'Keterangan', type: 'text' },
    ],
  },
  armada: {
    table: 'armada',
    label: 'Armada',
    desc: 'Jenis mobil untuk layanan carter. Kapasitas dipakai untuk menghitung jumlah trip.',
    view: ['admin', 'purchasing', 'admin_wh'],
    edit: ['admin', 'purchasing'],
    naturalKey: ['nama'],
    sort: 'nama',
    fields: [
      { key: 'nama', label: 'Nama Armada', type: 'text', required: true, upper: true, example: 'CDD' },
      { key: 'kapasitas_kg', label: 'Kapasitas (kg)', type: 'number' },
      { key: 'kapasitas_m3', label: 'Kapasitas (m³)', type: 'number' },
      { key: 'keterangan', label: 'Keterangan', type: 'text' },
    ],
  },
  distributor: {
    table: 'distributor',
    label: 'Distributor',
    desc: 'Kode distributor SAP, kota, dan area. Rate mengikuti kota distributor.',
    view: ALL,
    edit: ['admin', 'admin_wh'],
    naturalKey: ['kode'],
    sort: 'kota_id_label, nama',
    fields: [
      { key: 'kode', label: 'Kode Distributor', type: 'text', required: true, example: '1010000187' },
      { key: 'nama', label: 'Nama Distributor', type: 'text', required: true, upper: true },
      { key: 'kota_id', label: 'Kota', type: 'ref', ref: 'kota', required: true },
      { key: 'area_id', label: 'Area', type: 'ref', ref: 'area' },
      { key: 'asm', label: 'ASM', type: 'text', upper: true },
      { key: 'aktif', label: 'Aktif', type: 'bool', default: true },
    ],
  },
  kota: {
    table: 'kota',
    label: 'Kota',
    desc: 'Nama kota baku. Alias membantu pencarian dan pencocokan saat upload.',
    view: ALL,
    edit: ['admin', 'admin_wh'],
    naturalKey: ['nama'],
    sort: 'nama',
    fields: [
      { key: 'nama', label: 'Nama Kota', type: 'text', required: true, upper: true },
      { key: 'alias', label: 'Alias', type: 'text', upper: true, hint: 'Pisahkan dengan koma, mis. YOGYA, JOGJA' },
      { key: 'provinsi', label: 'Provinsi', type: 'text', upper: true },
      { key: 'batas_leadtime', label: 'Batas Leadtime (hari)', type: 'number', hint: 'Kosong = tanpa batas' },
    ],
  },
  area: {
    table: 'area',
    label: 'Area',
    desc: 'Daftar area distributor. Urutan prioritas alokasi stok diatur saat cek massal.',
    view: ALL,
    edit: ['admin', 'admin_wh'],
    naturalKey: ['nama'],
    sort: 'nama',
    fields: [
      { key: 'nama', label: 'Area', type: 'text', required: true, upper: true },
    ],
  },
  gudang: {
    table: 'gudang',
    label: 'Gudang Asal',
    desc: 'Gudang pengirim. Gudang default dipakai untuk cek massal.',
    view: ALL,
    edit: ['admin'],
    naturalKey: ['kode'],
    sort: 'kode',
    fields: [
      { key: 'kode', label: 'Kode Gudang', type: 'text', required: true, upper: true },
      { key: 'nama', label: 'Nama Gudang', type: 'text', required: true },
      { key: 'plant', label: 'Plant SAP', type: 'text' },
      { key: 'kota', label: 'Kota', type: 'text', upper: true },
      { key: 'default_massal', label: 'Default Cek Massal', type: 'bool', default: false },
    ],
  },
};

// kolom yang dipakai sebagai label saat entitas dirujuk dari tabel lain
export const REF_LABEL = {
  ekspedisi: 'nama',
  gudang: 'kode',
  kota: 'nama',
  armada: 'nama',
  area: 'nama',
};

export const MASTER_ORDER = ['rate', 'ekspedisi', 'armada', 'distributor', 'kota', 'area', 'gudang'];

export function canView(entity, role) {
  return !!ENTITIES[entity] && ENTITIES[entity].view.includes(role);
}
export function canEdit(entity, role) {
  return !!ENTITIES[entity] && ENTITIES[entity].edit.includes(role);
}

export function normText(s) {
  return String(s ?? '').replace(/\s+/g, ' ').trim().toUpperCase();
}

// Menu yang boleh diakses tiap role (dipakai sidebar & middleware)
export const MENU_ACCESS = {
  log: ['admin', 'purchasing', 'admin_wh'],
  users: ['admin'],
  pengaturan: ['admin'],
  peringatanRate: ['admin', 'purchasing'],
  loginlog: ['admin'],
};
