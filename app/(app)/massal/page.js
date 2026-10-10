'use client';
import { useEffect, useRef, useState } from 'react';
import { api, catatExport } from '@/lib/client';
import { bacaWorkbook, sheetKeObjek, tulisExcel, FMT } from '@/lib/excel';
import { deteksi, prosesMassal, LAPORAN } from '@/lib/sap';
import { rupiah, angka, persen, leadtimeText, parseAngka, parseDesimal } from '@/lib/format';
import DataTable from '@/components/DataTable';
import Modal from '@/components/Modal';
import ResultView from '@/components/ResultView';

const TEMPLATE_KOLOM = ['Referensi', 'Kode Distributor', 'Kota Tujuan', 'Berat (kg)', 'Volume (m3)', 'Value PO (Rp)'];
const lt = (o) => (o ? leadtimeText(o.leadtime_min, o.leadtime_max) : '-');

function unduhTemplateMassal() {
  tulisExcel('template-cek-massal.xlsx', [
    {
      nama: 'Data',
      kolom: TEMPLATE_KOLOM.map((k) => ({ label: k, key: k, width: 20 })),
      data: [
        { Referensi: 'PO-001', 'Kode Distributor': '1010000187', 'Kota Tujuan': '', 'Berat (kg)': 100, 'Volume (m3)': 0.35, 'Value PO (Rp)': 5000000 },
        { Referensi: 'PO-002', 'Kode Distributor': '', 'Kota Tujuan': 'PONTIANAK', 'Berat (kg)': 250, 'Volume (m3)': '', 'Value PO (Rp)': 12500000 },
      ],
    },
    {
      nama: 'Petunjuk',
      kolom: [{ label: 'Petunjuk pengisian', key: 'p', width: 100 }],
      data: [
        'Satu baris = satu kiriman. Hapus 2 baris contoh sebelum upload.',
        'Isi Kode Distributor ATAU Kota Tujuan. Jika kode diisi, kota diambil dari master distributor.',
        'Berat dalam kg, volume dalam m3. Minimal salah satu diisi.',
        'Value PO dalam rupiah, exclude PPN, tanpa titik/koma pemisah ribuan.',
        'Gudang asal dipilih di halaman upload.',
      ].map((p) => ({ p })),
    },
  ]);
}

export default function Massal() {
  const [lk, setLk] = useState(null);
  const [mode, setMode] = useState('sap');
  const [files, setFiles] = useState([]); // [{nama, wb}]
  const [found, setFound] = useState({});
  const [tpl, setTpl] = useState(null); // {nama, rows}
  const [gudangId, setGudangId] = useState('');
  const [ket, setKet] = useState('');
  const [status, setStatus] = useState('');
  const [err, setErr] = useState([]);
  const [info, setInfo] = useState([]);
  const [hasil, setHasil] = useState(null);
  const [proses, setProses] = useState(null);
  const [tab, setTab] = useState('ringkasan');
  const [detail, setDetail] = useState(null);
  const [over, setOver] = useState(false);
  const inp = useRef(null);

  useEffect(() => {
    api('/api/lookup').then((d) => {
      setLk(d);
      const def = d.gudang.find((g) => g.default_massal) || d.gudang[0];
      setGudangId(String(def?.id || ''));
    }).catch((e) => setErr([e.message]));
  }, []);

  async function tambahFile(list) {
    const arr = [...list].filter((f) => /\.(xlsx|xls|xlsm|csv)$/i.test(f.name));
    if (!arr.length) return;
    setErr([]); setHasil(null);
    try {
      if (mode === 'template') {
        setStatus(`Membaca ${arr[0].name}…`);
        const wb = await bacaWorkbook(arr[0]);
        const { rows } = sheetKeObjek(wb.Sheets[wb.SheetNames[0]], TEMPLATE_KOLOM);
        setTpl({ nama: arr[0].name, rows });
        setStatus('');
        return;
      }
      const baru = [];
      for (const f of arr) {
        setStatus(`Membaca ${f.name}… (file besar bisa butuh beberapa detik)`);
        await new Promise((r) => setTimeout(r, 30));
        baru.push({ nama: f.name, wb: await bacaWorkbook(f) });
      }
      const all = [...files.filter((x) => !baru.some((b) => b.nama === x.nama)), ...baru];
      setFiles(all);
      setFound(deteksi(all));
      setStatus('');
    } catch (e) {
      setStatus(''); setErr([`Gagal membaca file: ${e.message}`]);
    }
  }

  function reset() {
    setFiles([]); setFound({}); setTpl(null); setHasil(null); setProses(null); setErr([]); setInfo([]); setStatus('');
  }

  async function hitung() {
    setErr([]); setInfo([]); setHasil(null);
    let rows, p = null;
    if (mode === 'sap') {
      setStatus('Mengalokasikan stok & menjumlahkan per distributor…');
      await new Promise((r) => setTimeout(r, 30));
      p = prosesMassal(found, lk.distributor);
      if (p.error) { setErr(p.error); setStatus(''); return; }
      rows = p.ringkasan.filter((r) => r.qtyAlokasi > 0).map((r) => ({ kode: r.kode, nama: r.nama, kg: r.kg, m3: r.m3, nilaiPo: r.nilaiPo, jumlahSo: r.jumlahSo }));
      const nol = p.ringkasan.filter((r) => r.qtyAlokasi === 0).length;
      setInfo([...p.info, ...(nol ? [`${nol} distributor tidak mendapat stok sama sekali, tidak dihitung ongkirnya.`] : [])]);
      setProses(p);
    } else {
      const e = [];
      rows = (tpl?.rows || []).map((r) => ({
        ref: r['Referensi'] ? String(r['Referensi']) : null,
        kode: r['Kode Distributor'] ? String(r['Kode Distributor']).trim() : '',
        kota: r['Kota Tujuan'] ? String(r['Kota Tujuan']).trim() : '',
        kg: parseAngka(r['Berat (kg)']) || 0, m3: parseDesimal(r['Volume (m3)']) || 0, nilaiPo: parseAngka(r['Value PO (Rp)']) || 0,
        __row: r.__row,
      }));
      rows.forEach((r) => { if (!r.kode && !r.kota) e.push(`Baris ${r.__row}: isi Kode Distributor atau Kota Tujuan.`); });
      if (e.length) { setErr(e.slice(0, 50)); return; }
      setProses(null);
    }
    if (!rows.length) { setErr(['Tidak ada kiriman yang bisa dihitung (semua stok kosong atau file kosong).']); setStatus(''); return; }
    setStatus(`Menghitung ongkir untuk ${rows.length} kiriman…`);
    try {
      const d = await api('/api/cek/massal', {
        method: 'POST',
        body: { gudangId: Number(gudangId), keterangan: ket || (mode === 'sap' ? files.map((f) => f.nama).join(', ') : tpl?.nama), rows },
      });
      setHasil(d); setTab('ringkasan');
    } catch (e2) { setErr([e2.message]); }
    setStatus('');
  }

  function exportExcel() {
    const h = hasil.hasil;
    const sheets = [
      {
        nama: 'Ringkasan',
        catatan: [`Cek cost ratio massal dari gudang ${hasil.gudang.kode}`, `Dibuat ${new Date().toLocaleString('id-ID')}`],
        kolom: [
          ...(mode === 'template' ? [{ label: 'Referensi', key: 'ref' }] : []),
          { label: 'Kode Distributor', key: 'kode', width: 14 }, { label: 'Distributor', key: 'nama', width: 34 },
          { label: 'Kota', key: 'kota', width: 16 }, { label: 'Area', key: 'area' },
          { label: 'Jumlah SO', key: 'jumlahSo' },
          { label: 'Total KG', key: 'kg', fmt: FMT.angka }, { label: 'Total M3', key: 'm3', fmt: FMT.m3 },
          { label: 'Value PO (Rp)', key: 'nilaiPo', fmt: FMT.rp, width: 15 },
          { label: 'Ekspedisi Rekomendasi', key: (r) => r.utama?.ekspedisi, width: 30 },
          { label: 'Layanan', key: (r) => r.utama?.layanan, width: 16 },
          { label: 'Jenis', key: (r) => r.utama && r.utama.jenis + (r.utama.armada ? ' ' + r.utama.armada : '') },
          { label: 'Ongkir (Rp)', key: (r) => r.utama?.ongkir, fmt: FMT.rp, width: 14 },
          { label: 'Leadtime', key: (r) => r.utama && lt(r.utama), width: 13 },
          { label: 'Cost Ratio (%)', key: (r) => r.utama?.cr, fmt: FMT.angka },
          { label: 'Termurah', key: (r) => r.termurah && `${r.termurah.ekspedisi} (${r.termurah.layanan})`, width: 30 },
          { label: 'Ongkir Termurah', key: (r) => r.termurah?.ongkir, fmt: FMT.rp },
          { label: 'Tercepat', key: (r) => r.tercepat && `${r.tercepat.ekspedisi} (${r.tercepat.layanan})`, width: 30 },
          { label: 'Leadtime Tercepat', key: (r) => r.tercepat && lt(r.tercepat) },
          { label: 'Ongkir Tercepat', key: (r) => r.tercepat?.ongkir, fmt: FMT.rp },
          { label: 'Catatan', key: (r) => (r.peringatan || []).join(' '), width: 50 },
        ],
        data: h,
      },
      {
        nama: 'Semua Opsi',
        kolom: [
          { label: 'Kode Distributor', key: 'kode' }, { label: 'Distributor', key: 'nama', width: 30 }, { label: 'Kota', key: 'kota' },
          { label: 'Ekspedisi', key: 'ekspedisi', width: 30 }, { label: 'Layanan', key: 'layanan' }, { label: 'Jenis', key: 'jenis' },
          { label: 'Armada', key: 'armada' }, { label: 'Dasar Hitung', key: 'dasar', width: 24 },
          { label: 'Ongkir (Rp)', key: 'ongkir', fmt: FMT.rp }, { label: 'Leadtime', key: (o) => lt(o) },
          { label: 'Cost Ratio (%)', key: 'cr', fmt: FMT.angka }, { label: 'Rekomendasi', key: 'rek' },
        ],
        data: h.flatMap((r) => (r.opsi || []).map((o) => ({ ...o, kode: r.kode, nama: r.nama, kota: r.kota, rek: r.utama && o.rate_id === r.utama.rate_id ? 'Ya' : '' }))),
      },
    ];
    if (proses) {
      sheets.push({
        nama: 'Alokasi SO',
        kolom: [
          { label: 'No. SO', key: 'doc' }, { label: 'Item', key: 'item' }, { label: 'Customer Reference', key: 'ref', width: 30 },
          { label: 'Kode Distributor', key: 'kode' }, { label: 'Distributor', key: 'namaSap', width: 30 }, { label: 'Area', key: 'area' },
          { label: 'Prioritas', key: (d) => (d.prioritas === 9999 ? '' : d.prioritas) },
          { label: 'Material', key: 'material' }, { label: 'Deskripsi', key: 'deskripsi', width: 34 },
          { label: 'Qty Outstanding', key: 'qty' }, { label: 'Qty Dialokasikan', key: 'alokasi' }, { label: 'Qty Kurang', key: 'kurang' },
          { label: 'Status', key: 'status' }, { label: 'Harga/PC', key: 'hargaPc', fmt: FMT.angka },
          { label: 'Value (Rp)', key: 'nilai', fmt: FMT.rp }, { label: 'KG', key: 'kg', fmt: FMT.angka }, { label: 'M3', key: 'm3', fmt: FMT.m3 },
        ],
        data: proses.detail,
      });
    }
    tulisExcel(`cek-massal-${hasil.gudang.kode}-${new Date().toISOString().slice(0, 10)}.xlsx`, sheets);
    catatExport('cek_massal', `Export hasil massal #${hasil.runId} (${h.length} distributor)`);
  }

  const total = hasil && hasil.hasil.reduce((a, r) => ({ nilai: a.nilai + r.nilaiPo, ongkir: a.ongkir + (r.utama?.ongkir || 0), kg: a.kg + r.kg }), { nilai: 0, ongkir: 0, kg: 0 });
  const siap = mode === 'sap' ? Object.keys(LAPORAN).every((k) => found[k]) : !!tpl?.rows?.length;

  const kolomRingkasan = [
    ...(mode === 'template' ? [{ key: 'ref', label: 'Ref' }] : []),
    { key: 'nama', label: 'Distributor', render: (r) => <><b style={{ fontWeight: 600 }}>{r.nama || '-'}</b><div className="small muted">{r.kode} {r.kota}</div></> },
    { key: 'kg', label: 'KG', num: true, render: (r) => angka(r.kg) },
    { key: 'm3', label: 'M³', num: true, render: (r) => angka(r.m3, 3) },
    { key: 'nilaiPo', label: 'Value PO', num: true, render: (r) => rupiah(r.nilaiPo) },
    { key: 'eksp', label: 'Rekomendasi', value: (r) => r.utama?.ekspedisi, render: (r) => r.utama ? <>{r.utama.ekspedisi}<div className="small muted">{r.utama.layanan}, {lt(r.utama)}</div></> : <span className="pill err">{r.peringatan?.[0] || 'Tidak ada rate'}</span> },
    { key: 'ongkir', label: 'Ongkir', num: true, value: (r) => r.utama?.ongkir, render: (r) => rupiah(r.utama?.ongkir) },
    { key: 'cr', label: 'CR', num: true, value: (r) => r.utama?.cr, render: (r) => <b style={{ fontWeight: 600 }}>{persen(r.utama?.cr)}</b> },
    { key: 'aksi', label: '', sortable: false, render: (r) => <button className="btn ghost sm" onClick={() => setDetail(r)}>Detail</button> },
  ];

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Cek cost ratio massal</h1>
          <p>Upload export SAP (ZSDR007, ZSDR006, VA05, Stock). Stok dialokasikan sesuai prioritas area, lalu semua SO ke distributor yang sama dihitung sebagai satu kiriman.</p>
        </div>
      </div>

      <div className="tabs" role="tablist">
        <button role="tab" aria-selected={mode === 'sap'} onClick={() => { setMode('sap'); reset(); }}>Dari file SAP</button>
        <button role="tab" aria-selected={mode === 'template'} onClick={() => { setMode('template'); reset(); }}>Dari template Excel</button>
      </div>

      <div className="panel">
        <div className="form-grid" style={{ marginBottom: 16 }}>
          <div className="field span-4">
            <label htmlFor="g">Gudang asal</label>
            <select id="g" className="input" value={gudangId} onChange={(e) => setGudangId(e.target.value)}>
              {lk?.gudang.map((g) => <option key={g.id} value={g.id}>{g.nama}{g.plant ? ` (plant ${g.plant})` : ''}</option>)}
            </select>
          </div>
          <div className="field span-8" style={{ gridColumn: 'span 8' }}>
            <label htmlFor="ket">Keterangan (opsional)</label>
            <input id="ket" className="input" value={ket} onChange={(e) => setKet(e.target.value)} placeholder="mis. OS September 2026 minggu 4" />
          </div>
        </div>

        <div className={'drop' + (over ? ' over' : '')} role="button" tabIndex={0}
          onClick={() => inp.current.click()} onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && inp.current.click()}
          onDragOver={(e) => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)}
          onDrop={(e) => { e.preventDefault(); setOver(false); tambahFile(e.dataTransfer.files); }}>
          <strong>{mode === 'sap' ? 'Pilih atau tarik file SAP ke sini' : 'Pilih atau tarik file template ke sini'}</strong>
          <span className="muted small">
            {mode === 'sap' ? 'Boleh 4 file terpisah atau 1 file berisi 4 sheet. Jenis laporan dikenali dari nama kolomnya.' : 'Format .xlsx sesuai template.'}
          </span>
          <input ref={inp} type="file" hidden multiple={mode === 'sap'} accept=".xlsx,.xls,.xlsm,.csv"
            onChange={(e) => { tambahFile(e.target.files); e.target.value = ''; }} />
        </div>

        {mode === 'sap' ? (
          <ul className="checklist">
            {Object.entries(LAPORAN).map(([k, L]) => (
              <li key={k} className={found[k] ? 'ok' : 'miss'}>
                <b style={{ fontWeight: 600 }}>{L.label}</b>
                <small>{found[k] ? `${found[k].file}, sheet ${found[k].sheet}` : 'Belum ada'}</small>
              </li>
            ))}
          </ul>
        ) : (
          <p className="small" style={{ marginTop: 12 }}>
            {tpl ? <>File <b>{tpl.nama}</b>: {tpl.rows.length} baris.</> : 'Belum ada file.'}{' '}
            <button className="btn link" onClick={unduhTemplateMassal}>Download template</button>
          </p>
        )}

        {status && <div className="alert warn" role="status">{status}</div>}
        {err.length > 0 && <div className="alert err" role="alert">{err.length === 1 ? err[0] : <ul>{err.map((e) => <li key={e}>{e}</li>)}</ul>}</div>}

        <div className="actions" style={{ marginTop: 16 }}>
          <button className="btn" disabled={!siap || !!status || !lk} onClick={hitung}>Proses &amp; hitung</button>
          {(files.length > 0 || tpl) && <button className="btn ghost" onClick={reset}>Ganti file</button>}
        </div>
      </div>

      {hasil && (
        <div style={{ marginTop: 22 }}>
          {info.map((i) => <div key={i} className="alert warn">{i}</div>)}
          <div className="stats">
            <div><div className="k">Kiriman</div><div className="v">{hasil.hasil.length}</div></div>
            <div><div className="k">Total berat</div><div className="v">{angka(total.kg)} kg</div></div>
            <div><div className="k">Total value PO</div><div className="v">{rupiah(total.nilai)}</div></div>
            <div><div className="k">Total ongkir rekomendasi</div><div className="v">{rupiah(total.ongkir)}</div></div>
            <div><div className="k">Cost ratio keseluruhan</div><div className="v">{total.nilai ? persen((total.ongkir / total.nilai) * 100) : '-'}</div></div>
          </div>
          {proses && (
            <div className="tabs" role="tablist">
              <button role="tab" aria-selected={tab === 'ringkasan'} onClick={() => setTab('ringkasan')}>Per distributor</button>
              <button role="tab" aria-selected={tab === 'alokasi'} onClick={() => setTab('alokasi')}>Alokasi SO ({proses.detail.length})</button>
            </div>
          )}
          {tab === 'ringkasan' || !proses ? (
            <DataTable columns={kolomRingkasan} rows={hasil.hasil.map((r, i) => ({ ...r, id: i }))} defaultSize={50}
              initialSort={{ key: 'cr', dir: 'desc' }}
              toolbar={<button className="btn ghost sm" onClick={exportExcel}>Download Excel</button>} />
          ) : (
            <DataTable defaultSize={50} rows={proses.detail.map((d, i) => ({ ...d, id: i }))}
              toolbar={<button className="btn ghost sm" onClick={exportExcel}>Download Excel</button>}
              columns={[
                { key: 'doc', label: 'No. SO' }, { key: 'namaSap', label: 'Distributor' }, { key: 'area', label: 'Area' },
                { key: 'material', label: 'Material', render: (d) => <>{d.material}<div className="small muted">{d.deskripsi}</div></> },
                { key: 'qty', label: 'Outstanding', num: true, render: (d) => angka(d.qty, 0) },
                { key: 'alokasi', label: 'Dialokasikan', num: true, render: (d) => angka(d.alokasi, 0) },
                { key: 'status', label: 'Status', render: (d) => <span className={'pill' + (d.status === 'Stok kosong' ? ' err' : d.status === 'Sebagian' ? ' warn' : '')}>{d.status}</span> },
                { key: 'nilai', label: 'Value', num: true, render: (d) => rupiah(d.nilai) },
                { key: 'kg', label: 'KG', num: true, render: (d) => angka(d.kg) },
              ]} />
          )}
        </div>
      )}

      {detail && (
        <Modal title={detail.nama || detail.kota || 'Detail'} onClose={() => setDetail(null)} wide>
          <ResultView data={{ ...detail, asal: hasil.gudang.kode, tujuan: detail.kota || '-', distributor: detail.kode ? [{ kode: detail.kode, nama: detail.nama }] : [] }} />
        </Modal>
      )}
    </div>
  );
}
