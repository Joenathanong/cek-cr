'use client';
import DataTable from './DataTable';
import { rupiah, angka, persen, leadtimeText } from '@/lib/format';

const lt = (o) => leadtimeText(o.leadtime_min, o.leadtime_max);
const nama = (o) => `${o.ekspedisi} (${o.layanan})`;

export const OPSI_KOLOM = [
  { key: 'ekspedisi', label: 'Ekspedisi', render: (o) => <><b style={{ fontWeight: 600 }}>{o.ekspedisi}</b><div className="small muted">{o.layanan}</div></> },
  { key: 'jenis', label: 'Jenis', render: (o) => <span className="pill">{o.jenis}{o.armada ? ` ${o.armada}` : ''}</span> },
  { key: 'dasar', label: 'Dasar hitung', render: (o) => <span className="small">{o.dasar}</span> },
  { key: 'ongkir', label: 'Ongkir', num: true, render: (o) => rupiah(o.ongkir) },
  { key: 'leadtime_max', label: 'Leadtime', value: (o) => o.leadtime_max ?? o.leadtime_min, render: (o) => <span style={{ whiteSpace: 'nowrap' }}>{lt(o)}</span> },
  { key: 'cr', label: 'Cost Ratio', num: true, render: (o) => <b style={{ fontWeight: 600 }}>{persen(o.cr)}</b> },
  { key: 'catatan', label: 'Catatan', sortable: false, value: (o) => o.keterangan, render: (o) => (
    <span className="small">{!o.dalam_batas && <span className="pill warn">Melebihi batas leadtime</span>} {o.keterangan || ''}</span>
  ) },
];

/**
 * data: { asal, tujuan, distributor:[{kode,nama}], kg, m3, nilaiPo, opsi, ditolak, utama, termurah, tercepat, peringatan, batasLeadtime }
 */
export default function ResultView({ data, toolbar }) {
  const u = data.utama;
  const dist = (data.distributor || []).map((d) => d.nama).join(', ');
  return (
    <div>
      {data.peringatan?.map((p) => <div key={p} className="alert warn">{p}</div>)}
      <section className="waybill" aria-label="Hasil rekomendasi">
        <div className="tape">Rekomendasi</div>
        <div className="route">
          <span>{data.asal}</span><span className="arrow" aria-label="ke">→</span><span>{data.tujuan}</span>
          {dist && <span className="dist">Distributor: {dist}</span>}
        </div>
        <div className="cells">
          <div className="cell"><div className="k">Total berat</div><div className="v">{angka(data.kg)} kg</div></div>
          <div className="cell"><div className="k">Volume</div><div className="v">{angka(data.m3, 3)} m³</div></div>
          <div className="cell"><div className="k">Value PO</div><div className="v">{rupiah(data.nilaiPo)}</div></div>
          <div className="cell wide">
            <div className="k">Ekspedisi</div>
            <div className="v">{u ? nama(u) : 'Tidak ada'}</div>
            {u && <div className="small muted">{rupiah(u.ongkir)}, {lt(u)}</div>}
          </div>
          <div className="cell cr"><div className="k">Cost ratio</div><div className="v">{u ? persen(u.cr) : '-'}</div></div>
        </div>
        {(data.termurah || data.tercepat) && (
          <div className="alts">
            <div>Termurah: {data.termurah ? <><b>{nama(data.termurah)}</b>, {rupiah(data.termurah.ongkir)}, CR {persen(data.termurah.cr)}, {lt(data.termurah)}</> : '-'}</div>
            <div>Tercepat: {data.tercepat ? <><b>{nama(data.tercepat)}</b>, {lt(data.tercepat)}, {rupiah(data.tercepat.ongkir)}, CR {persen(data.tercepat.cr)}</> : '-'}</div>
          </div>
        )}
      </section>
      {data.batasLeadtime != null && <p className="small muted">Batas leadtime kota ini: {angka(data.batasLeadtime)} hari. Rekomendasi dipilih dari cost ratio terendah yang masih dalam batas.</p>}

      <DataTable columns={OPSI_KOLOM} rows={data.opsi || []} defaultSize={10} toolbar={toolbar}
        initialSort={{ key: 'cr', dir: 'asc' }}
        rowClass={(o) => (u && o.rate_id === u.rate_id ? 'best' : undefined)}
        empty="Belum ada rate ekspedisi untuk rute ini. Tambahkan di Master Data → Rate Ekspedisi." />

      {data.ditolak?.length > 0 && (
        <details className="reject">
          <summary>{data.ditolak.length} layanan tidak bisa dipakai untuk kiriman ini</summary>
          <div className="table-wrap" style={{ marginTop: 8 }}>
            <table className="data">
              <thead><tr><th>Ekspedisi</th><th>Layanan</th><th>Jenis</th><th>Alasan</th></tr></thead>
              <tbody>{data.ditolak.map((d, i) => (
                <tr key={i}><td>{d.ekspedisi}</td><td>{d.layanan}</td><td>{d.jenis}{d.armada ? ` ${d.armada}` : ''}</td><td>{d.alasan}</td></tr>
              ))}</tbody>
            </table>
          </div>
        </details>
      )}
    </div>
  );
}

/** Ubah opsi ringkas dari riwayat ([ekspedisi, layanan, jenis, armada, ongkir, cr, ltmin, ltmax, dasar]) ke objek. */
export function opsiDariRiwayat(arr = []) {
  return arr.map((a, i) => ({
    rate_id: i, ekspedisi: a[0], layanan: a[1], jenis: a[2], armada: a[3], ongkir: a[4], cr: a[5],
    leadtime_min: a[6], leadtime_max: a[7], dasar: a[8], dalam_batas: true,
  }));
}
