// Hitung ulang cost ratio massal: stok dari distributor dengan CR di atas batas dialihkan
// ke distributor lain yang membutuhkan material itu, selama CR penerima tetap di bawah batas.
// Murni (tanpa DB/DOM) supaya bisa diuji.
import { hitungKiriman } from './calc';
import { STATUS } from './sap';

export const ST = {
  KIRIM: 'Dikirim',
  KIRIM_ALIH: 'Dikirim setelah dialihkan',
  MENERIMA: 'Dikirim, menerima pengalihan',
  TIDAK: 'Tidak dikirim',
  MANUAL: 'Cek manual',
  KOSONG: 'Tidak dapat stok',
};
export const DIKIRIM = new Set([ST.KIRIM, ST.KIRIM_ALIH, ST.MENERIMA]);

const r2 = (v) => Math.round(v * 100) / 100;
const pct = (v) => (v == null ? '-' : `${String(r2(v)).replace('.', ',')}%`);
const nama = (o) => (o ? `${o.ekspedisi} (${o.layanan})` : '-');

/**
 * @param detail   baris hasil prosesMassal().detail (sudah berisi alokasi awal)
 * @param ctx      { dist: Map(kode -> {kota_id, kota, batas_leadtime}), rates: Map(kota_id -> rate[]), batas: angka % }
 * @returns { lines, dist: Map(kode -> ringkasan), transfers, rekon, errors, batas }
 */
export function realokasi(detail, ctx) {
  const T = Number(ctx.batas) || 23;
  const lines = detail.map((l, i) => ({ ...l, i, alokasiAwal: l.alokasi, masuk: 0, keluar: 0, catatan: [] }));
  const byKode = new Map();
  for (const l of lines) (byKode.get(l.kode) || byKode.set(l.kode, []).get(l.kode)).push(l);

  const labelKota = (kode) => {
    const l = byKode.get(kode)?.[0];
    return (l && (l.kotaSap || l.kota)) || ctx.dist.get(kode)?.kota || kode;
  };
  const rateOf = (kode) => {
    const d = ctx.dist.get(kode);
    if (!d) return null;
    const r = ctx.rates.get(d.kota_id);
    return r && r.length ? r : null;
  };
  // hitung kiriman satu distributor; tambahan = [{line, q}] untuk proyeksi
  const nilai = (kode, tambahan = []) => {
    let kg = 0, m3 = 0, po = 0, qty = 0;
    for (const l of byKode.get(kode) || []) {
      kg += l.alokasi * (l.kgPc || 0); m3 += l.alokasi * (l.m3Pc || 0); po += l.alokasi * (l.hargaPc || 0); qty += l.alokasi;
    }
    for (const t of tambahan) {
      kg += t.q * (t.line.kgPc || 0); m3 += t.q * (t.line.m3Pc || 0); po += t.q * (t.line.hargaPc || 0); qty += t.q;
    }
    if (qty <= 0) return { qty: 0, kg: 0, m3: 0, po: 0, h: null, cr: null };
    const rates = rateOf(kode);
    if (!rates) return { qty, kg, m3, po, h: null, cr: null, manual: true };
    const h = hitungKiriman(rates, { kg, m3, nilaiPo: po, batasLeadtime: ctx.dist.get(kode)?.batas_leadtime });
    return { qty, kg, m3, po, h, cr: h.utama?.cr ?? null };
  };

  const kodes = [...byKode.keys()];
  const awal = new Map(kodes.map((k) => [k, nilai(k)]));
  const manual = new Set(kodes.filter((k) => !rateOf(k)));
  // pemberi: CR awal di atas batas, CR tertinggi dulu
  const donors = kodes.filter((k) => !manual.has(k) && awal.get(k).cr != null && awal.get(k).cr > T)
    .sort((a, b) => awal.get(b).cr - awal.get(a).cr);
  const donorSet = new Set(donors);
  const transfers = [];

  for (const D of donors) {
    const myLines = byKode.get(D).filter((l) => l.alokasi > 0);
    for (const src of myLines) {
      let sisa = src.alokasi;
      while (sisa > 0) {
        // calon penerima: distributor lain (bukan pemberi, bukan cek manual) yang masih kurang material ini
        const butuh = new Map();
        for (const l of lines) {
          if (l.material !== src.material || l.kode === D || donorSet.has(l.kode) || manual.has(l.kode)) continue;
          if (l.qty - l.alokasi <= 0) continue;
          (butuh.get(l.kode) || butuh.set(l.kode, []).get(l.kode)).push(l);
        }
        if (!butuh.size) break;
        let best = null;
        for (const [kode, ls] of butuh) {
          let rem = sisa; const plan = [];
          for (const l of ls) { if (rem <= 0) break; const q = Math.min(rem, l.qty - l.alokasi); if (q > 0) { plan.push({ line: l, q }); rem -= q; } }
          if (!plan.length) continue;
          const sebelum = byKode.get(kode).some((l) => l.alokasi > 0) ? nilai(kode).cr : null;
          const p = nilai(kode, plan);
          if (p.cr == null || p.cr > T) continue;
          const prio = Math.min(...ls.map((l) => l.prioritas ?? 9999));
          const cand = { kode, plan, cr: p.cr, sebelum, prio, total: plan.reduce((s, x) => s + x.q, 0) };
          if (!best || cand.cr < best.cr || (cand.cr === best.cr && (cand.prio < best.prio || (cand.prio === best.prio && cand.kode < best.kode)))) best = cand;
        }
        if (!best) break;
        for (const { line, q } of best.plan) { line.alokasi += q; line.masuk += q; line.catatan.push(`+${q} dari ${labelKota(D)}`); }
        src.alokasi -= best.total; src.keluar += best.total; src.catatan.push(`-${best.total} ke ${labelKota(best.kode)}`);
        transfers.push({ material: src.material, deskripsi: src.deskripsi, qty: best.total, dari: D, ke: best.kode,
          dariKota: labelKota(D), keKota: labelKota(best.kode), doc: src.doc, crPenerimaSebelum: best.sebelum, crPenerimaSesudah: best.cr });
        sisa -= best.total;
      }
    }
  }

  // status, CR akhir, dan alasan per distributor
  const dist = new Map();
  for (const k of kodes) {
    const a = awal.get(k), z = nilai(k);
    const ls = byKode.get(k);
    const keluar = transfers.filter((t) => t.dari === k), masuk = transfers.filter((t) => t.ke === k);
    const kota = labelKota(k);
    let status, alasan = '';
    if (z.qty <= 0 && a.qty <= 0) { status = ST.KOSONG; alasan = 'Tidak mendapat stok (semua item Stock Kosong).'; }
    else if (manual.has(k)) {
      status = ST.MANUAL;
      alasan = ctx.dist.get(k) ? `Belum ada rate ekspedisi ke ${ctx.dist.get(k).kota}. Cek manual oleh Purchasing; tidak ikut pengalihan.`
        : 'Kode distributor belum terdaftar di master distributor. Cek manual; tidak ikut pengalihan.';
    } else if (donorSet.has(k)) {
      const ringkasMat = gabung(keluar, 'material');
      const tujuan = [...new Set(keluar.map((t) => t.keKota))].join(', ');
      const ganti = a.h?.utama && z.h?.utama && nama(a.h.utama) !== nama(z.h.utama) ? `, ekspedisi berganti dari ${nama(a.h.utama)} ke ${nama(z.h.utama)}` : '';
      const awalTxt = `CR ${kota} sebelumnya ${pct(a.cr)} (> ${pct(T)}).`;
      if (z.cr != null && z.cr <= T) {
        status = ST.KIRIM_ALIH;
        alasan = `${awalTxt} Material ${ringkasMat} dialihkan ke ${tujuan} karena CR kota tersebut masih di bawah ${pct(T)}. CR ${kota} saat ini ${pct(z.cr)}${ganti}. Tetap dikirim.`;
      } else if (keluar.length) {
        status = ST.TIDAK;
        alasan = `${awalTxt} Material ${ringkasMat} dialihkan ke ${tujuan} karena CR kota tersebut masih di bawah ${pct(T)}. Sisa kiriman CR ${pct(z.cr)}, masih di atas batas, tidak dikirim; sisa stok kembali ke gudang.`;
      } else {
        status = ST.TIDAK;
        alasan = `${awalTxt} Materialnya tidak dibutuhkan distributor lain dengan CR di bawah batas, tidak dikirim; stok kembali ke gudang.`;
      }
    } else if (masuk.length) {
      status = ST.MENERIMA;
      const asal = [...new Set(masuk.map((t) => t.dariKota))].join(', ');
      alasan = `Menerima ${gabung(masuk, 'material')} dari ${asal}. CR berubah dari ${a.qty > 0 ? pct(a.cr) : '- (sebelumnya tidak dapat stok)'} menjadi ${pct(z.cr)}.`;
    } else {
      status = ST.KIRIM;
    }
    const dikirim = DIKIRIM.has(status);
    for (const l of ls) {
      l.dikirim = dikirim ? l.alokasi : 0;
      if (status === ST.TIDAK && l.alokasi > 0) l.catatan.push('Tidak dikirim');
      if (status === ST.MANUAL && l.alokasi > 0) l.catatan.push('Ditahan (cek manual)');
      l.statusProduk = l.alokasi <= 0 ? STATUS.KOSONG : l.alokasi < l.qty ? STATUS.TIPIS : STATUS.READY;
      l.status = l.statusProduk;
      l.nilai = l.dikirim * (l.hargaPc || 0); l.nilaiPpn = l.nilai * 1.11;
      l.kg = l.dikirim * (l.kgPc || 0); l.m3 = l.dikirim * (l.m3Pc || 0);
      l.pendingAvail = l.pendingValue != null && l.qty ? (l.pendingValue / l.qty) * l.dikirim : null;
      l.pengalihan = l.catatan.join('; ');
      l.statusKirim = status;
    }
    dist.set(k, {
      kode: k, kota, status, dikirim, alasan,
      crAwal: a.cr, ekspAwal: a.h?.utama ? nama(a.h.utama) : null, ongkirAwal: a.h?.utama?.ongkir ?? null,
      crAkhir: z.cr, akhir: z,
      qty: z.qty, kg: z.kg, m3: z.m3, nilaiPo: z.po,
    });
  }

  // rekonsiliasi stok per material: stok = dikirim + ditahan (cek manual) + sisa gudang
  const rekon = new Map();
  for (const l of lines) {
    const x = rekon.get(l.material) || { material: l.material, deskripsi: l.deskripsi, stok: l.stokAwal ?? 0, order: 0, alokasiAwal: 0, alokasiAkhir: 0, dikirim: 0, ditahan: 0, masuk: 0, keluar: 0 };
    x.order += l.qty; x.alokasiAwal += l.alokasiAwal; x.alokasiAkhir += l.alokasi; x.dikirim += l.dikirim;
    if (l.statusKirim === ST.MANUAL) x.ditahan += l.alokasi;
    x.masuk += l.masuk; x.keluar += l.keluar;
    rekon.set(l.material, x);
  }
  const errors = [];
  for (const l of lines) {
    if (l.alokasi < 0 || l.alokasi > l.qty) errors.push(`SO ${l.doc} material ${l.material}: alokasi ${l.alokasi} di luar batas 0..${l.qty}`);
  }
  const rekonList = [...rekon.values()].map((x) => {
    const sisa = x.stok - x.dikirim - x.ditahan;
    const selisih = x.stok - (x.dikirim + x.ditahan + sisa);
    if (x.alokasiAwal !== x.alokasiAkhir) errors.push(`Material ${x.material}: total alokasi berubah ${x.alokasiAwal} → ${x.alokasiAkhir}`);
    if (x.masuk !== x.keluar) errors.push(`Material ${x.material}: pengalihan masuk ${x.masuk} ≠ keluar ${x.keluar}`);
    if (x.alokasiAkhir > x.stok) errors.push(`Material ${x.material}: alokasi ${x.alokasiAkhir} melebihi stok ${x.stok}`);
    if (sisa < 0) errors.push(`Material ${x.material}: sisa stok negatif (${sisa})`);
    return { ...x, sisa, selisih, kurang: x.order - x.alokasiAkhir,
      statusStok: x.alokasiAkhir === 0 ? STATUS.KOSONG : x.alokasiAkhir < x.order ? STATUS.TIPIS : STATUS.READY };
  }).sort((a, b) => a.material.localeCompare(b.material));

  return { lines, dist, transfers, rekon: rekonList, errors, batas: T };
}

function gabung(list, key) {
  const m = new Map();
  for (const t of list) m.set(t[key], (m.get(t[key]) || 0) + t.qty);
  return [...m.entries()].map(([k, q]) => `${k} (${q} pcs)`).join(', ');
}
