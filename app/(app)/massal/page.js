'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { api, catatExport } from '@/lib/client';
import { bacaWorkbook } from '@/lib/excel';
import { deteksi, prosesMassal, daftarPrioritas, LAPORAN, STATUS } from '@/lib/sap';
import { susunGrup, ringkasItem } from '@/lib/cekcr';
import { exportMassal } from '@/lib/massalExport';
import { realokasi, DIKIRIM } from '@/lib/realokasi';
import StatusPill from '@/components/StatusPill';
import { rupiah, angka, persen, leadtimeText } from '@/lib/format';
import DataTable from '@/components/DataTable';
import Modal from '@/components/Modal';
import ResultView from '@/components/ResultView';
import CekCrView from '@/components/CekCrView';
import PrioritasModal from '@/components/PrioritasModal';
import { useUser } from '@/components/Shell';

const lt = (o) => (o ? leadtimeText(o.leadtime_min, o.leadtime_max) : '-');
const tgl = () => new Date().toISOString().slice(0, 10);

export default function Massal() {
  const user = useUser();
  const [lk, setLk] = useState(null);
  const [prio, setPrio] = useState(null);          // urutan yang sudah dikonfirmasi untuk proses ini
  const [prioPakai, setPrioPakai] = useState(null);  // urutan yang dipakai pada hasil terakhir
  const [daftar, setDaftar] = useState(null);        // daftar area & kota dari ZSDR007
  const [bukaPrio, setBukaPrio] = useState(false);
  const [templates, setTemplates] = useState([]);
  const [files, setFiles] = useState([]);
  const [found, setFound] = useState({});
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
    api('/api/prioritas-template').then((d) => setTemplates(d.rows)).catch(() => {});
  }, []);

  const groups = useMemo(() => (proses && hasil ? susunGrup(proses.detail, hasil.hasil) : []), [proses, hasil]);

  async function tambahFile(list) {
    const arr = [...list].filter((f) => /\.(xlsx|xls|xlsm|csv)$/i.test(f.name));
    if (!arr.length) { setErr(['Pilih file Excel (.xlsx, .xls, .xlsm) atau .csv.']); return; }
    setErr([]); setHasil(null); setProses(null);
    try {
      const baru = [];
      for (const f of arr) {
        setStatus(`Membaca ${f.name}… (file besar bisa butuh beberapa detik)`);
        await new Promise((r) => setTimeout(r, 30));
        baru.push({ nama: f.name, wb: await bacaWorkbook(f) });
      }
      const all = [...files.filter((x) => !baru.some((b) => b.nama === x.nama)), ...baru];
      const fd = deteksi(all);
      setFiles(all); setFound(fd); setStatus('');
      // ZSDR007 terdeteksi (baru atau berganti) -> susun daftar prioritas & buka pop up
      if (fd.ZSDR007 && (!found.ZSDR007 || fd.ZSDR007.file !== found.ZSDR007.file || baru.some((b) => b.nama === fd.ZSDR007.file))) {
        const d = daftarPrioritas(fd, lk.distributor);
        if (d.error) { setErr(d.error); return; }
        setDaftar(d); setPrio(null); setBukaPrio(true);
      }
    } catch (e) {
      setStatus(''); setErr([`Gagal membaca file: ${e.message}`]);
    }
  }

  function reset() {
    setFiles([]); setFound({}); setHasil(null); setProses(null); setErr([]); setInfo([]); setStatus('');
    setDaftar(null); setPrio(null); setBukaPrio(false);
  }

  async function hitung() {
    setErr([]); setInfo([]); setHasil(null);
    if (!prio) { setBukaPrio(true); return; }
    setStatus('Mengalokasikan stok sesuai prioritas…');
    await new Promise((r) => setTimeout(r, 30));
    const p = prosesMassal(found, lk.distributor, { mode: prio.mode, urutan: prio.urutan });
    if (p.error) { setErr(p.error); setStatus(''); return; }
    try {
      // 1. ambil rate & batas CR, 2. hitung ulang + alihkan stok di browser, 3. simpan & hitung final di server
      setStatus('Menghitung cost ratio & mengalihkan stok dari distributor dengan CR di atas batas…');
      const kodes = [...new Set(p.detail.map((d) => d.kode))];
      const kx = await api('/api/cek/konteks', { method: 'POST', body: { gudangId: Number(gudangId), kodes } });
      const rates = new Map();
      for (const r of kx.rates) (rates.get(r.kota_id) || rates.set(r.kota_id, []).get(r.kota_id)).push(r);
      const ra = realokasi(p.detail, { dist: new Map(kx.dist.map((d) => [d.kode, d])), rates, batas: kx.batas });
      if (ra.errors.length) { setErr(['Hitung ulang dibatalkan karena stok tidak seimbang:', ...ra.errors.slice(0, 20)]); setStatus(''); return; }
      const rows = [...ra.dist.values()].filter((d) => d.qty > 0).map((d) => {
        const r0 = p.ringkasan.find((x) => x.kode === d.kode);
        return { kode: d.kode, nama: r0?.nama, kg: d.kg, m3: d.m3, nilaiPo: Math.round(d.nilaiPo), jumlahSo: r0?.jumlahSo,
          meta: { status: d.status, alasan: d.alasan, crAwal: d.crAwal, ekspAwal: d.ekspAwal, dikirim: DIKIRIM.has(d.status) } };
      });
      const kosong = [...ra.dist.values()].filter((d) => d.qty <= 0).length;
      const inf = [...p.info, ...(kosong ? [`${kosong} distributor tidak mendapat stok sama sekali, tidak dihitung ongkirnya.`] : [])];
      if (!rows.length) { setErr(['Tidak ada stok yang bisa dikirim untuk SO yang diupload.']); setStatus(''); return; }
      setStatus(`Menyimpan hasil ${rows.length} kiriman…`);
      const d = await api('/api/cek/massal', {
        method: 'POST',
        body: { gudangId: Number(gudangId), keterangan: ket || files.map((f) => f.nama).join(', '), rows, prioritas: prio, items: ringkasItem(ra.lines) },
      });
      setInfo(inf);
      setProses({ ...p, detail: ra.lines, stokMaterial: ra.rekon, transfers: ra.transfers, batas: ra.batas });
      setHasil(d); setTab('cekcr');
      setPrioPakai(prio);
      setPrio(null); // list prioritas kosong kembali setelah proses selesai
    } catch (e2) { setErr([e2.message]); }
    setStatus('');
  }

  const teksPrio = (x) => (x ? `${x.mode === 'KOTA' ? 'kota' : 'area'}${x.template ? ` (template ${x.template})` : ''}: ${x.urutan.map((k, i) => `${i + 1}. ${k}`).join(', ')}` : '-');

  function exportExcel() {
    const catatan = [
      `Cek cost ratio massal dari gudang ${hasil.gudang.kode}, proses #${hasil.runId}`,
      `Prioritas alokasi berdasarkan ${teksPrio(prioPakai)}`,
      `Batas cost ratio ${proses?.batas}%: distributor di atas batas tidak dikirim, material yang dibutuhkan dialihkan ke distributor lain.`,
      `Dibuat ${new Date().toLocaleString('id-ID')} oleh ${user?.username}`,
    ].filter(Boolean);
    exportMassal({
      namaFile: `cek-cr-massal-${hasil.gudang.kode}-${tgl()}.xlsx`, catatan, groups,
      hasil: hasil.hasil.map((h) => ({ ...h, area: h.area || groups.find((g) => g.kode === h.kode)?.area })),
      stokMaterial: proses?.stokMaterial, transfers: proses?.transfers,
    });
    catatExport('cek_massal', `Export hasil massal #${hasil.runId} (${hasil.hasil.length} kiriman)`);
  }

  const kirimRows = hasil ? hasil.hasil.filter((r) => !r.meta || r.meta.dikirim) : [];
  const total = hasil && kirimRows.reduce((a, r) => ({ nilai: a.nilai + r.nilaiPo, ongkir: a.ongkir + (r.utama?.ongkir || 0), kg: a.kg + r.kg }), { nilai: 0, ongkir: 0, kg: 0 });
  const hitungStatus = (st) => (hasil ? hasil.hasil.filter((r) => r.meta?.status === st).length : 0);
  const totalAlih = proses?.transfers?.reduce((s, t) => s + t.qty, 0) || 0;
  const selisih = proses?.stokMaterial?.reduce((s, x) => s + Math.abs(x.selisih), 0) || 0;
  const siap = Object.keys(LAPORAN).every((k) => found[k]);
  const tombolExport = <button className="btn sm" onClick={exportExcel}>Download Excel</button>;

  const kolomRingkasan = [
    { key: 'nama', label: 'Distributor', render: (r) => <><b style={{ fontWeight: 600 }}>{r.nama || '-'}</b><div className="small muted">{[r.kode, r.kota].filter(Boolean).join(', ')}</div></> },
    { key: 'status', label: 'Status', value: (r) => r.meta?.status, render: (r) => <StatusPill status={r.meta?.status || 'Dikirim'} /> },
    { key: 'crAwal', label: 'CR awal', num: true, value: (r) => r.meta?.crAwal, render: (r) => persen(r.meta?.crAwal) },
    { key: 'kg', label: 'KG', num: true, render: (r) => angka(r.kg) },
    { key: 'm3', label: 'M³', num: true, render: (r) => angka(r.m3, 3) },
    { key: 'nilaiPo', label: 'Value PO', num: true, render: (r) => rupiah(r.nilaiPo) },
    { key: 'eksp', label: 'Rekomendasi', value: (r) => r.utama?.ekspedisi, render: (r) => r.utama ? <>{r.utama.ekspedisi}<div className="small muted">{r.utama.layanan}, {lt(r.utama)}</div></> : <span className="pill err">{r.peringatan?.[0] || 'Tidak ada rate'}</span> },
    { key: 'ongkir', label: 'Ongkir', num: true, value: (r) => r.utama?.ongkir, render: (r) => rupiah(r.utama?.ongkir) },
    { key: 'cr', label: 'CR akhir', num: true, value: (r) => r.utama?.cr, render: (r) => <b style={{ fontWeight: 600 }}>{persen(r.utama?.cr)}</b> },
    { key: 'alasan', label: 'Alasan', sortable: false, value: (r) => r.meta?.alasan, render: (r) => <span className="small" style={{ display: 'block', minWidth: 260 }}>{r.meta?.alasan || ''}</span> },
    { key: 'aksi', label: '', sortable: false, render: (r) => <button className="btn ghost sm" onClick={() => setDetail(r)}>Detail</button> },
  ];

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Cek cost ratio massal</h1>
          <p>Upload export SAP (ZSDR007, ZSDR006, VA05, Stock), tentukan list prioritas area, lalu stok yang tipis dialokasikan sesuai urutan tersebut. Semua SO ke distributor yang sama dihitung sebagai satu kiriman, lengkap dengan item yang dikirim.</p>
        </div>
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
            <strong>Pilih atau tarik file SAP ke sini</strong>
            <span className="muted small">Boleh 4 file terpisah atau 1 file berisi 4 sheet. Jenis laporan dikenali dari nama kolomnya.</span>
            <input ref={inp} type="file" hidden multiple accept=".xlsx,.xls,.xlsm,.csv" data-testid="file-massal"
              onChange={(e) => { tambahFile(e.target.files); e.target.value = ''; }} />
          </div>
          <ul className="checklist">
            {Object.entries(LAPORAN).map(([k, L]) => (
              <li key={k} className={found[k] ? 'ok' : 'miss'}>
                <b style={{ fontWeight: 600 }}>{L.label}</b>
                <small>{found[k] ? `${found[k].file}, sheet ${found[k].sheet}` : 'Belum ada'}</small>
              </li>
            ))}
          </ul>
        </div>

        <div className="panel">
          <h3 className="panel-title">2. List prioritas area</h3>
          {!daftar ? (
            <p className="muted small">Muncul setelah file ZSDR007 diupload. Daftar area & kota diambil dari isi ZSDR007.</p>
          ) : prio ? (
            <>
              <p className="small" style={{ margin: 0 }}>
                Berdasarkan <b>{prio.mode === 'KOTA' ? 'kota' : 'area'}</b>, {prio.urutan.length} urutan{prio.template ? `, template "${prio.template}"` : ''}.
              </p>
              <ol className="prio-ringkas">
                {prio.urutan.slice(0, 12).map((k, i) => <li key={k}><b>{i + 1}</b>{k}</li>)}
                {prio.urutan.length > 12 && <li>… {prio.urutan.length - 12} lainnya</li>}
              </ol>
            </>
          ) : (
            <div className="alert warn" style={{ margin: 0 }}>Urutan prioritas belum ditentukan untuk proses ini.</div>
          )}
          {daftar && (
            <div className="actions" style={{ marginTop: 12 }}>
              <button className="btn ghost sm" onClick={() => setBukaPrio(true)}>{prio ? 'Ubah prioritas' : 'Atur prioritas'}</button>
            </div>
          )}
        </div>
      </div>

      {status && <div className="alert warn" role="status">{status}</div>}
      {err.length > 0 && <div className="alert err" role="alert">{err.length === 1 ? err[0] : <ul>{err.map((e) => <li key={e}>{e}</li>)}</ul>}</div>}
      <div className="actions" style={{ marginTop: 16 }}>
        <button className="btn" disabled={!siap || !!status || !lk || !prio} onClick={hitung}>Proses &amp; hitung</button>
        {files.length > 0 && <button className="btn ghost" onClick={reset}>Ganti file</button>}
        {siap && !prio && <span className="small muted">Tentukan list prioritas area dulu.</span>}
      </div>

      {hasil && (
        <section style={{ marginTop: 24 }} aria-label="Hasil">
          {info.map((i) => <div key={i} className="alert warn">{i}</div>)}
          <details className="small muted" style={{ margin: '4px 0 12px' }}>
            <summary style={{ cursor: 'pointer' }}>Prioritas yang dipakai: {prioPakai?.mode === 'KOTA' ? 'kota' : 'area'}{prioPakai?.template ? `, template "${prioPakai.template}"` : ''} ({prioPakai?.urutan.length} urutan)</summary>
            <p style={{ margin: '6px 0 0' }}>{teksPrio(prioPakai)}</p>
          </details>
          <div className="stats">
            <div><div className="k">Dikirim</div><div className="v">{kirimRows.length} distributor</div></div>
            <div><div className="k">Tidak dikirim (CR &gt; {proses?.batas}%)</div><div className="v" style={{ color: 'var(--danger)' }}>{hitungStatus('Tidak dikirim')}</div></div>
            <div><div className="k">Stok dialihkan</div><div className="v">{angka(totalAlih, 0)} pcs, {proses?.transfers?.length || 0} pengalihan</div></div>
            <div><div className="k">Cek manual (tanpa rate)</div><div className="v" style={{ color: 'var(--warn-ink)' }}>{hitungStatus('Cek manual')}</div></div>
            <div><div className="k">Total ongkir dikirim</div><div className="v">{rupiah(total.ongkir)}</div></div>
            <div><div className="k">CR keseluruhan</div><div className="v">{total.nilai ? persen((total.ongkir / total.nilai) * 100) : '-'}</div></div>
            <div className="good"><div className="k">Selisih stok</div><div className="v">{angka(selisih, 0)} pcs{selisih === 0 ? ', seimbang' : ''}</div></div>
          </div>
          <div className="tabs" role="tablist">
            {proses && <button role="tab" aria-selected={tab === 'cekcr'} onClick={() => setTab('cekcr')}>Cek CR (item per distributor)</button>}
            <button role="tab" aria-selected={tab === 'ringkasan'} onClick={() => setTab('ringkasan')}>Ringkasan & alasan</button>
            {proses && <button role="tab" aria-selected={tab === 'alih'} onClick={() => setTab('alih')}>Pengalihan stok ({proses.transfers.length})</button>}
            {proses && <button role="tab" aria-selected={tab === 'stok'} onClick={() => setTab('stok')}>Rekonsiliasi stok</button>}
          </div>
          {tab === 'cekcr' && proses && (
            <CekCrView groups={groups} toolbar={tombolExport}
              onDetail={(g) => setDetail({ ...g.hasil, area: g.area })} />
          )}
          {tab === 'ringkasan' && (
            <DataTable columns={kolomRingkasan} rows={hasil.hasil.map((r, i) => ({ ...r, id: i }))} defaultSize={50}
              initialSort={{ key: 'cr', dir: 'desc' }} toolbar={tombolExport} />
          )}
          {tab === 'alih' && proses && (
            <DataTable defaultSize={50} rows={proses.transfers.map((t, i) => ({ ...t, id: i }))} toolbar={tombolExport}
              empty="Tidak ada pengalihan: tidak ada distributor dengan CR di atas batas yang materialnya dibutuhkan distributor lain."
              columns={[
                { key: 'material', label: 'Material', render: (t) => <>{t.material}<div className="small muted">{t.deskripsi}</div></> },
                { key: 'qty', label: 'Qty', num: true, render: (t) => angka(t.qty, 0) },
                { key: 'dariKota', label: 'Dari', render: (t) => <>{t.dariKota}<div className="small muted">{t.dari}</div></> },
                { key: 'keKota', label: 'Ke', render: (t) => <>{t.keKota}<div className="small muted">{t.ke}</div></> },
                { key: 'crPenerimaSesudah', label: 'CR penerima', num: true, render: (t) => `${t.crPenerimaSebelum == null ? '-' : persen(t.crPenerimaSebelum)} → ${persen(t.crPenerimaSesudah)}` },
              ]} />
          )}
          {tab === 'stok' && proses && (
            <DataTable defaultSize={50} rows={proses.stokMaterial.map((d, i) => ({ ...d, id: i }))} toolbar={tombolExport}
              initialSort={{ key: 'keluar', dir: 'desc' }}
              columns={[
                { key: 'material', label: 'Material', render: (d) => <>{d.material}<div className="small muted">{d.deskripsi}</div></> },
                { key: 'stok', label: 'Stok', num: true, render: (d) => angka(d.stok, 0) },
                { key: 'order', label: 'Order', num: true, render: (d) => angka(d.order, 0) },
                { key: 'alokasiAwal', label: 'Alokasi awal', num: true, render: (d) => angka(d.alokasiAwal, 0) },
                { key: 'keluar', label: 'Dialihkan', num: true, render: (d) => angka(d.keluar, 0) },
                { key: 'dikirim', label: 'Dikirim', num: true, render: (d) => angka(d.dikirim, 0) },
                { key: 'ditahan', label: 'Ditahan', num: true, render: (d) => angka(d.ditahan, 0) },
                { key: 'sisa', label: 'Sisa gudang', num: true, render: (d) => angka(d.sisa, 0) },
                { key: 'selisih', label: 'Selisih', num: true, render: (d) => <b style={{ fontWeight: 600, color: d.selisih ? 'var(--danger)' : 'var(--ok)' }}>{angka(d.selisih, 0)}</b> },
                { key: 'statusStok', label: 'Status', render: (d) => <span className={'pill' + (d.statusStok === STATUS.KOSONG ? ' err' : d.statusStok === STATUS.TIPIS ? ' warn' : '')}>{d.statusStok}</span> },
              ]} />
          )}
        </section>
      )}

      {bukaPrio && daftar && (
        <PrioritasModal daftar={daftar} awal={prio} templates={templates} onTemplates={setTemplates}
          onConfirm={(x) => { setPrio(x); setBukaPrio(false); }} onClose={() => setBukaPrio(false)} />
      )}

      {detail && (
        <Modal title={detail.nama || detail.kota || 'Detail'} onClose={() => setDetail(null)} wide>
          <ResultView data={{ ...detail, asal: hasil.gudang.kode, tujuan: detail.kota || '-', distributor: detail.kode ? [{ kode: detail.kode, nama: detail.nama }] : [] }} />
        </Modal>
      )}
    </div>
  );
}
