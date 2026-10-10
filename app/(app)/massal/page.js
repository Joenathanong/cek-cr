'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { api, catatExport } from '@/lib/client';
import { bacaWorkbook, sheetKeObjek, tulisExcel } from '@/lib/excel';
import { deteksi, prosesMassal, LAPORAN, STATUS } from '@/lib/sap';
import { susunGrup, ringkasItem } from '@/lib/cekcr';
import { exportMassal } from '@/lib/massalExport';
import { rupiah, angka, persen, leadtimeText, parseAngka, parseDesimal } from '@/lib/format';
import { MENU_ACCESS } from '@/lib/entities';
import DataTable from '@/components/DataTable';
import Modal from '@/components/Modal';
import ResultView from '@/components/ResultView';
import CekCrView from '@/components/CekCrView';
import PrioritasEditor, { dariApi } from '@/components/PrioritasEditor';
import { useUser } from '@/components/Shell';

const TEMPLATE_KOLOM = ['Referensi', 'Kode Distributor', 'Kota Tujuan', 'Berat (kg)', 'Volume (m3)', 'Value PO (Rp)'];
const lt = (o) => (o ? leadtimeText(o.leadtime_min, o.leadtime_max) : '-');
const tgl = () => new Date().toISOString().slice(0, 10);

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
  const user = useUser();
  const [lk, setLk] = useState(null);
  const [prio, setPrio] = useState(null);
  const [prioApi, setPrioApi] = useState(null);
  const [prioMsg, setPrioMsg] = useState('');
  const [mode, setMode] = useState('sap');
  const [files, setFiles] = useState([]);
  const [found, setFound] = useState({});
  const [tpl, setTpl] = useState(null);
  const [gudangId, setGudangId] = useState('');
  const [ket, setKet] = useState('');
  const [status, setStatus] = useState('');
  const [err, setErr] = useState([]);
  const [info, setInfo] = useState([]);
  const [hasil, setHasil] = useState(null);
  const [proses, setProses] = useState(null);
  const [tab, setTab] = useState('cekcr');
  const [detail, setDetail] = useState(null);
  const [over, setOver] = useState(false);
  const inp = useRef(null);

  useEffect(() => {
    api('/api/lookup').then((d) => {
      setLk(d);
      const def = d.gudang.find((g) => g.default_massal) || d.gudang[0];
      setGudangId(String(def?.id || ''));
    }).catch((e) => setErr([e.message]));
    api('/api/prioritas').then((d) => { setPrioApi(d); setPrio(dariApi(d)); }).catch(() => {});
  }, []);

  const groups = useMemo(() => (proses && hasil ? susunGrup(proses.detail, hasil.hasil) : []), [proses, hasil]);

  async function tambahFile(list) {
    const arr = [...list].filter((f) => /\.(xlsx|xls|xlsm|csv)$/i.test(f.name));
    if (!arr.length) { setErr(['Pilih file Excel (.xlsx, .xls, .xlsm) atau .csv.']); return; }
    setErr([]); setHasil(null); setProses(null);
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

  async function simpanPrioritas() {
    setPrioMsg('');
    try {
      const x = await api('/api/prioritas', { method: 'PUT', body: { mode: prio.mode, area: prio.area.map((a) => a.id), kota: prio.kota.map((k) => k.id) } });
      setPrioApi({ ...prioApi, ...x }); setPrioMsg('Disimpan sebagai pengaturan bawaan.');
    } catch (e) { setPrioMsg(e.message); }
  }

  async function hitung() {
    setErr([]); setInfo([]); setHasil(null);
    let rows, p = null;
    if (mode === 'sap') {
      setStatus('Mengalokasikan stok sesuai prioritas & menjumlahkan per distributor…');
      await new Promise((r) => setTimeout(r, 30));
      p = prosesMassal(found, lk.distributor, {
        dasar: prio?.mode, urutanKota: prio?.kota.map((k) => k.nama), urutanArea: prio?.area.map((a) => a.nama),
      });
      if (p.error) { setErr(p.error); setStatus(''); return; }
      rows = p.ringkasan.filter((r) => r.qtyAlokasi > 0).map((r) => ({ kode: r.kode, nama: r.nama, kg: r.kg, m3: r.m3, nilaiPo: r.nilaiPo, jumlahSo: r.jumlahSo }));
      const nol = p.ringkasan.filter((r) => r.qtyAlokasi === 0).length;
      setInfo([...p.info, ...(nol ? [`${nol} distributor tidak mendapat stok sama sekali (semua item Stock Kosong), tidak dihitung ongkirnya.`] : [])]);
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
    }
    if (!rows.length) { setErr(['Tidak ada kiriman yang bisa dihitung (semua stok kosong atau file kosong).']); setStatus(''); return; }
    setStatus(`Menghitung ongkir untuk ${rows.length} kiriman…`);
    try {
      const d = await api('/api/cek/massal', {
        method: 'POST',
        body: {
          gudangId: Number(gudangId), keterangan: ket || (mode === 'sap' ? files.map((f) => f.nama).join(', ') : tpl?.nama), rows,
          dasarPrioritas: mode === 'sap' ? prio?.mode : null, items: p ? ringkasItem(p.detail) : null,
        },
      });
      setProses(p); setHasil(d); setTab(p ? 'cekcr' : 'ringkasan');
    } catch (e2) { setErr([e2.message]); }
    setStatus('');
  }

  function exportExcel() {
    const catatan = [
      `Cek cost ratio massal dari gudang ${hasil.gudang.kode}, proses #${hasil.runId}`,
      proses ? `Prioritas alokasi: ${prio.mode === 'KOTA' ? 'kota (' + (prio.kota.map((k) => k.nama).join(', ') || 'tidak ada') + ')' : 'area (' + prio.area.map((a) => a.nama).join(', ') + ')'}` : '',
      `Dibuat ${new Date().toLocaleString('id-ID')} oleh ${user?.username}`,
    ].filter(Boolean);
    exportMassal({
      namaFile: `cek-cr-massal-${hasil.gudang.kode}-${tgl()}.xlsx`, catatan, groups,
      hasil: hasil.hasil.map((h) => ({ ...h, area: h.area || groups.find((g) => g.kode === h.kode)?.area })),
      stokMaterial: proses?.stokMaterial, denganRef: mode === 'template',
    });
    catatExport('cek_massal', `Export hasil massal #${hasil.runId} (${hasil.hasil.length} kiriman)`);
  }

  const total = hasil && hasil.hasil.reduce((a, r) => ({ nilai: a.nilai + r.nilaiPo, ongkir: a.ongkir + (r.utama?.ongkir || 0), kg: a.kg + r.kg }), { nilai: 0, ongkir: 0, kg: 0 });
  const siap = mode === 'sap' ? Object.keys(LAPORAN).every((k) => found[k]) : !!tpl?.rows?.length;
  const bisaEditPrio = user && MENU_ACCESS.prioritasEdit.includes(user.role);
  const tombolExport = <button className="btn sm" onClick={exportExcel}>Download Excel</button>;

  const kolomRingkasan = [
    ...(mode === 'template' ? [{ key: 'ref', label: 'Ref' }] : []),
    { key: 'nama', label: 'Distributor', render: (r) => <><b style={{ fontWeight: 600 }}>{r.nama || '-'}</b><div className="small muted">{[r.kode, r.kota].filter(Boolean).join(', ')}</div></> },
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
          <p>Upload export SAP (ZSDR007, ZSDR006, VA05, Stock). Stok yang tipis dialokasikan sesuai prioritas, lalu semua SO ke distributor yang sama dihitung sebagai satu kiriman, lengkap dengan item yang dikirim.</p>
        </div>
      </div>

      <div className="tabs" role="tablist">
        <button role="tab" aria-selected={mode === 'sap'} onClick={() => { setMode('sap'); reset(); }}>Dari file SAP</button>
        <button role="tab" aria-selected={mode === 'template'} onClick={() => { setMode('template'); reset(); }}>Dari template Excel</button>
      </div>

      <div className="grid-2">
        <div className="panel">
          <h3 className="panel-title">1. File</h3>
          <div className="form-grid" style={{ marginBottom: 16 }}>
            <div className="field span-6">
              <label htmlFor="g">Gudang asal</label>
              <select id="g" className="input" value={gudangId} onChange={(e) => setGudangId(e.target.value)}>
                {lk?.gudang.map((g) => <option key={g.id} value={g.id}>{g.nama}{g.plant ? ` (plant ${g.plant})` : ''}</option>)}
              </select>
            </div>
            <div className="field span-6">
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
            <input ref={inp} type="file" hidden multiple={mode === 'sap'} accept=".xlsx,.xls,.xlsm,.csv" data-testid="file-massal"
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
        </div>

        {mode === 'sap' && (
          <div className="panel">
            <h3 className="panel-title">2. Prioritas alokasi stok</h3>
            {prio ? (
              <>
                <PrioritasEditor value={prio} onChange={setPrio} semuaKota={prioApi.kota} />
                <div className="actions" style={{ marginTop: 12 }}>
                  {bisaEditPrio && <button className="btn ghost sm" onClick={simpanPrioritas}>Simpan sebagai bawaan</button>}
                  <button className="btn ghost sm" onClick={() => setPrio(dariApi(prioApi))}>Kembalikan ke bawaan</button>
                  {prioMsg && <span className="small muted">{prioMsg}</span>}
                </div>
              </>
            ) : <p className="muted">Memuat…</p>}
          </div>
        )}
      </div>

      {status && <div className="alert warn" role="status">{status}</div>}
      {err.length > 0 && <div className="alert err" role="alert">{err.length === 1 ? err[0] : <ul>{err.map((e) => <li key={e}>{e}</li>)}</ul>}</div>}
      <div className="actions" style={{ marginTop: 16 }}>
        <button className="btn" disabled={!siap || !!status || !lk} onClick={hitung}>Proses &amp; hitung</button>
        {(files.length > 0 || tpl) && <button className="btn ghost" onClick={reset}>Ganti file</button>}
      </div>

      {hasil && (
        <section style={{ marginTop: 24 }} aria-label="Hasil">
          {info.map((i) => <div key={i} className="alert warn">{i}</div>)}
          <div className="stats">
            <div><div className="k">Kiriman</div><div className="v">{hasil.hasil.length}</div></div>
            {proses && <div><div className="k">Item dikirim</div><div className="v">{proses.detail.filter((d) => d.alokasi > 0).length} / {proses.detail.length}</div></div>}
            <div><div className="k">Total berat</div><div className="v">{angka(total.kg)} kg</div></div>
            <div><div className="k">Total value PO</div><div className="v">{rupiah(total.nilai)}</div></div>
            <div><div className="k">Total ongkir rekomendasi</div><div className="v">{rupiah(total.ongkir)}</div></div>
            <div><div className="k">Cost ratio keseluruhan</div><div className="v">{total.nilai ? persen((total.ongkir / total.nilai) * 100) : '-'}</div></div>
          </div>
          <div className="tabs" role="tablist">
            {proses && <button role="tab" aria-selected={tab === 'cekcr'} onClick={() => setTab('cekcr')}>Cek CR (item per distributor)</button>}
            <button role="tab" aria-selected={tab === 'ringkasan'} onClick={() => setTab('ringkasan')}>Ringkasan per distributor</button>
            {proses && <button role="tab" aria-selected={tab === 'stok'} onClick={() => setTab('stok')}>Stok per material</button>}
          </div>
          {tab === 'cekcr' && proses && (
            <CekCrView groups={groups} toolbar={tombolExport}
              onDetail={(g) => setDetail({ ...g.hasil, area: g.area })} />
          )}
          {tab === 'ringkasan' && (
            <DataTable columns={kolomRingkasan} rows={hasil.hasil.map((r, i) => ({ ...r, id: i }))} defaultSize={50}
              initialSort={{ key: 'cr', dir: 'desc' }} toolbar={tombolExport} />
          )}
          {tab === 'stok' && proses && (
            <DataTable defaultSize={50} rows={proses.stokMaterial.map((d, i) => ({ ...d, id: i }))} toolbar={tombolExport}
              initialSort={{ key: 'kurang', dir: 'desc' }}
              columns={[
                { key: 'material', label: 'Material', render: (d) => <>{d.material}<div className="small muted">{d.deskripsi}</div></> },
                { key: 'stok', label: 'Stok tersedia', num: true, render: (d) => angka(d.stok, 0) },
                { key: 'order', label: 'Total order', num: true, render: (d) => angka(d.order, 0) },
                { key: 'alokasi', label: 'Dialokasikan', num: true, render: (d) => angka(d.alokasi, 0) },
                { key: 'kurang', label: 'Kurang', num: true, render: (d) => angka(d.kurang, 0) },
                { key: 'jumlahSo', label: 'Baris SO', num: true },
                { key: 'status', label: 'Status', render: (d) => <span className={'pill' + (d.status === STATUS.KOSONG ? ' err' : d.status === STATUS.TIPIS ? ' warn' : '')}>{d.status}</span> },
              ]} />
          )}
        </section>
      )}

      {detail && (
        <Modal title={detail.nama || detail.kota || 'Detail'} onClose={() => setDetail(null)} wide>
          <ResultView data={{ ...detail, asal: hasil.gudang.kode, tujuan: detail.kota || '-', distributor: detail.kode ? [{ kode: detail.kode, nama: detail.nama }] : [] }} />
        </Modal>
      )}
    </div>
  );
}
