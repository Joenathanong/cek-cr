const KELAS = {
  'Dikirim': 'pill',
  'Dikirim setelah dialihkan': 'pill ok',
  'Dikirim, menerima pengalihan': 'pill info',
  'Tidak dikirim': 'pill err',
  'Cek manual': 'pill warn',
  'Tidak dapat stok': 'pill off',
};
export default function StatusPill({ status }) {
  if (!status) return null;
  return <span className={KELAS[status] || 'pill'}>{status}</span>;
}
