const nf0 = new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 });
const nf2 = new Intl.NumberFormat('id-ID', { maximumFractionDigits: 2 });
const nf3 = new Intl.NumberFormat('id-ID', { maximumFractionDigits: 3 });

export const rupiah = (v) => (v == null || isNaN(v) ? '-' : 'Rp ' + nf0.format(Math.round(v)));
const nfCache = {};
const nfD = (d) => (nfCache[d] ||= new Intl.NumberFormat('id-ID', { maximumFractionDigits: d }));
export const angka = (v, d = 2) =>
  v == null || v === '' || isNaN(v) ? '-' : (d === 0 ? nf0 : d === 3 ? nf3 : d === 2 ? nf2 : nfD(d)).format(Number(v));
export const persen = (v) => (v == null || isNaN(v) ? '-' : nf2.format(v) + '%');

export function leadtimeText(min, max) {
  if (min == null && max == null) return '-';
  const a = min ?? max, b = max ?? min;
  return a === b ? `${angka(a)} Hari` : `${angka(a)} - ${angka(b)} Hari`;
}

// "1.000.000" / "1000000" / "1.250,5" -> number
export function parseAngka(s) {
  if (s == null) return null;
  if (typeof s === 'number') return isNaN(s) ? null : s;
  let t = String(s).trim().replace(/[^\d.,-]/g, '');
  if (!t) return null;
  if (t.includes(',')) t = t.replace(/\./g, '').replace(',', '.');
  else if (!/^-?0\./.test(t) && ((t.match(/\./g) || []).length > 1 || /\.\d{3}$/.test(t))) t = t.replace(/\./g, '');
  const n = Number(t);
  return isNaN(n) ? null : n;
}

// format saat mengetik: 1000000 -> 1.000.000
export function formatRibuan(raw) {
  const digits = String(raw ?? '').replace(/\D/g, '');
  if (!digits) return '';
  return nf0.format(Number(digits));
}

export function tanggalWaktu(v) {
  if (!v) return '-';
  const d = new Date(v);
  return d.toLocaleString('id-ID', {
    timeZone: 'Asia/Jakarta', day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

// desimal untuk m³: koma atau titik sebagai pemisah desimal
export function parseDesimal(s) {
  if (s == null || s === '') return null;
  let t = String(s).trim();
  if (t.includes(',')) t = t.replace(/\./g, '').replace(',', '.');
  const n = Number(t);
  return isNaN(n) ? null : n;
}
