// Mesin perhitungan ongkir & cost ratio. Murni (tanpa DB) supaya mudah dites.
import { angka } from './format';

const n = (v) => (v == null || v === '' ? null : Number(v));
const r2 = (v) => Math.round(v * 1000) / 1000;

function tarif(q, min, harga, biayaMin) {
  if (biayaMin != null) {
    const m = min || 0;
    return q <= m ? biayaMin : biayaMin + (q - m) * harga;
  }
  return harga * Math.max(q, min || 0);
}

/**
 * Hitung satu baris rate.
 * @returns {{ok:true, ongkir, dasar, ...} | {ok:false, alasan}}
 */
export function hitungRate(rate, { kg = 0, m3 = 0 }) {
  const harga = n(rate.harga), min = n(rate.minimum), max = n(rate.maksimum);
  const bMin = n(rate.biaya_minimum), bTambah = n(rate.biaya_tambahan) || 0;
  kg = Number(kg) || 0; m3 = Number(m3) || 0;
  let ongkir, dasar, qty;

  if (rate.jenis === 'KG') {
    const faktor = n(rate.faktor_volumetrik);
    const volKg = faktor && m3 > 0 ? m3 * faktor : null;
    qty = Math.max(kg, volKg || 0);
    if (qty <= 0) return { ok: false, alasan: faktor ? 'Berat & volume belum diisi' : 'Berat belum diisi' };
    if (max != null && qty > max) return { ok: false, alasan: `Melebihi maksimum ${angka(max)} kg` };
    const qTagih = bMin != null ? qty : Math.max(qty, min || 0);
    ongkir = tarif(qty, min, harga, bMin);
    dasar = `${angka(r2(qTagih))} kg${volKg && volKg > kg ? ' (volumetrik)' : ''}`
      + (min && qty < min ? ` (min. ${angka(min)} kg)` : '');
  } else if (rate.jenis === 'M3') {
    qty = m3;
    if (qty <= 0) return { ok: false, alasan: 'Volume (m³) belum diisi' };
    if (max != null && qty > max) return { ok: false, alasan: `Melebihi maksimum ${angka(max)} m³` };
    ongkir = tarif(qty, min, harga, bMin);
    dasar = `${angka(Math.max(qty, bMin != null ? 0 : min || 0), 3)} m³` + (min && qty < min ? ` (min. ${angka(min)} m³)` : '');
  } else if (rate.jenis === 'CARTER') {
    const capKg = n(rate.kapasitas_kg), capM3 = n(rate.kapasitas_m3);
    if (kg <= 0 && m3 <= 0) return { ok: false, alasan: 'Berat / volume belum diisi' };
    let trip = 1;
    if (capKg && kg > 0) trip = Math.max(trip, Math.ceil(kg / capKg - 1e-9));
    if (capM3 && m3 > 0) trip = Math.max(trip, Math.ceil(m3 / capM3 - 1e-9));
    if (min) trip = Math.max(trip, Math.ceil(min));
    if (max != null && trip > max) return { ok: false, alasan: `Butuh ${trip} trip, maksimum ${angka(max)}` };
    qty = trip;
    ongkir = trip * harga;
    dasar = `${trip} trip ${rate.armada || ''}`.trim();
  } else {
    return { ok: false, alasan: 'Jenis perhitungan tidak dikenal' };
  }
  if (bTambah) dasar += ` + biaya tambahan`;
  return { ok: true, ongkir: Math.round(ongkir + bTambah), dasar, qty };
}

/**
 * Hitung semua rate untuk satu kiriman dan pilih rekomendasi.
 * input: { kg, m3, nilaiPo, batasLeadtime }
 */
export function hitungKiriman(rates, input) {
  const nilaiPo = Number(input.nilaiPo) || 0;
  const batas = input.batasLeadtime == null || input.batasLeadtime === '' ? null : Number(input.batasLeadtime);
  const opsi = [], ditolak = [];
  for (const r of rates) {
    const h = hitungRate(r, input);
    const base = {
      rate_id: r.id, ekspedisi: r.ekspedisi, layanan: r.layanan, jenis: r.jenis, armada: r.armada || null,
      leadtime_min: n(r.leadtime_min), leadtime_max: n(r.leadtime_max), keterangan: r.keterangan || null,
    };
    if (!h.ok) { ditolak.push({ ...base, alasan: h.alasan }); continue; }
    const cr = nilaiPo > 0 ? (h.ongkir / nilaiPo) * 100 : null;
    const lt = base.leadtime_max ?? base.leadtime_min;
    opsi.push({
      ...base, ongkir: h.ongkir, dasar: h.dasar, cr: cr == null ? null : Math.round(cr * 100) / 100,
      dalam_batas: batas == null || lt == null || lt <= batas,
    });
  }
  const byCost = (a, b) => a.ongkir - b.ongkir || lt(a) - lt(b) || a.ekspedisi.localeCompare(b.ekspedisi);
  opsi.sort(byCost);

  const termurah = opsi[0] || null;
  const denganLt = opsi.filter((o) => o.leadtime_max != null || o.leadtime_min != null);
  const tercepat = denganLt.length ? [...denganLt].sort((a, b) => lt(a) - lt(b) || a.ongkir - b.ongkir)[0] : null;
  const dalam = opsi.filter((o) => o.dalam_batas);
  let utama = dalam[0] || null;
  const peringatan = [];
  if (!opsi.length) peringatan.push('Tidak ada layanan ekspedisi yang bisa dihitung untuk rute ini.');
  else if (!utama) {
    utama = termurah;
    peringatan.push(`Tidak ada layanan dengan leadtime ≤ ${angka(batas)} hari. Rekomendasi memakai yang termurah.`);
  }
  if (nilaiPo <= 0 && opsi.length) peringatan.push('Value PO kosong, cost ratio tidak dapat dihitung.');
  return { opsi, ditolak, utama, termurah, tercepat, peringatan, batasLeadtime: batas };
}

function lt(o) {
  const v = o.leadtime_max ?? o.leadtime_min;
  return v == null ? 9999 : v;
}
