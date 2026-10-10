'use client';
import { useMemo, useRef, useState } from 'react';
import Modal from './Modal';
import { api, catatExport } from '@/lib/client';
import { tulisExcel, bacaWorkbook, sheetKeObjek, normHeader } from '@/lib/excel';

const LABEL = { AREA: 'Area', KOTA: 'Kota' };

/** Gabungkan urutan baru dengan template lama: item lama yang tidak ada di data sekarang tetap disimpan di posisi relatifnya. */
export function gabungUrutan(lama = [], baru = []) {
  const out = [...baru];
  let jangkar = -1;
  for (const k of lama) {
    const i = out.indexOf(k);
    if (i >= 0) { jangkar = i; continue; }
    out.splice(jangkar + 1, 0, k);
    jangkar += 1;
  }
  return out;
}

function terapkan(keys, urutan) {
  const ada = new Set(keys);
  const urut = urutan.map((k) => String(k).toUpperCase()).filter((k, i, a) => ada.has(k) && a.indexOf(k) === i);
  const s = new Set(urut);
  return { urut, baru: keys.filter((k) => !s.has(k)) };
}

/**
 * daftar: { sumber, AREA: [{key, jumlahSo, area, dist, jumlahDist}], KOTA: [...] }
 * templates: [{id, nama, mode, urutan}]
 */
export default function PrioritasModal({ daftar, awal, templates, onTemplates, onConfirm, onClose }) {
  const [mode, setMode] = useState(awal?.mode || 'AREA');
  const [state, setState] = useState(() => ({
    AREA: awal?.mode === 'AREA' ? terapkan(daftar.AREA.map((x) => x.key), awal.urutan) : { urut: daftar.AREA.map((x) => x.key), baru: [] },
    KOTA: awal?.mode === 'KOTA' ? terapkan(daftar.KOTA.map((x) => x.key), awal.urutan) : { urut: daftar.KOTA.map((x) => x.key), baru: [] },
  }));
  const [tplId, setTplId] = useState('');
  const [namaTpl, setNamaTpl] = useState(awal?.template || '');
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [posisi, setPosisi] = useState({});
  const drag = useRef(null);
  const [over, setOver] = useState(null);
  const fileRef = useRef(null);

  const info = useMemo(() => new Map(daftar[mode].map((x) => [x.key, x])), [daftar, mode]);
  const { urut, baru } = state[mode];
  const tplMode = templates.filter((t) => t.mode === mode);
  const setMine = (patch) => setState((s) => ({ ...s, [mode]: { ...s[mode], ...patch } }));

  function pindah(dari, ke) {
    const arr = [...urut];
    const [x] = arr.splice(dari, 1);
    arr.splice(Math.max(0, Math.min(ke, arr.length)), 0, x);
    setMine({ urut: arr });
  }
  function sisipkan(k, ke) {
    const arr = [...urut];
    arr.splice(Math.max(0, Math.min(ke, arr.length)), 0, k);
    setMine({ urut: arr, baru: baru.filter((b) => b !== k) });
    setPosisi((p) => ({ ...p, [k]: '' }));
  }
  function nomorKe(i, v) {
    const n = parseInt(v, 10);
    if (!n || n - 1 === i) return;
    pindah(i, n - 1);
  }

  function pakaiTemplate() {
    const t = templates.find((x) => String(x.id) === String(tplId));
    if (!t) return;
    const r = terapkan(daftar[mode].map((x) => x.key), t.urutan);
    setMine(r);
    setNamaTpl(t.nama);
    setErr('');
    setMsg(r.baru.length
      ? `Template "${t.nama}" dipakai. Ada ${r.baru.length} ${LABEL[mode].toLowerCase()} baru yang belum ada di template, tentukan urutannya di kotak kuning.`
      : `Template "${t.nama}" dipakai.`);
  }

  async function simpanTemplate() {
    setErr(''); setMsg('');
    const nama = namaTpl.trim();
    if (!nama) { setErr('Isi nama template.'); return; }
    if (baru.length) { setErr(`Tentukan dulu urutan ${baru.length} ${LABEL[mode].toLowerCase()} baru.`); return; }
    const lama = templates.find((t) => t.mode === mode && t.nama.toUpperCase() === nama.toUpperCase());
    if (lama && !confirm(`Template "${lama.nama}" sudah ada. Timpa dengan urutan sekarang?`)) return;
    try {
      const t = await api('/api/prioritas-template', { method: 'POST', body: { nama, mode, urutan: gabungUrutan(lama?.urutan, urut) } });
      onTemplates([...templates.filter((x) => x.id !== t.id), t]);
      setTplId(String(t.id));
      setMsg(`Template "${t.nama}" disimpan. Bisa dipakai lagi di pengecekan berikutnya.`);
    } catch (e) { setErr(e.message); }
  }

  async function hapusTemplate() {
    const t = templates.find((x) => String(x.id) === String(tplId));
    if (!t || !confirm(`Hapus template "${t.nama}"?`)) return;
    try {
      await api(`/api/prioritas-template/${t.id}`, { method: 'DELETE' });
      onTemplates(templates.filter((x) => x.id !== t.id)); setTplId(''); setMsg(`Template "${t.nama}" dihapus.`);
    } catch (e) { setErr(e.message); }
  }

  function exportExcel() {
    tulisExcel(`prioritas-${mode.toLowerCase()}-${new Date().toISOString().slice(0, 10)}.xlsx`, [{
      nama: 'Prioritas',
      kolom: [
        { label: 'No', key: 'no', width: 6 }, { label: LABEL[mode], key: 'key', width: 24 },
        { label: 'Baris SO', key: 'jumlahSo' }, { label: 'Area', key: 'area', width: 14 }, { label: 'Distributor', key: 'dist', width: 60 },
      ],
      data: [...urut, ...baru].map((k, i) => ({ ...info.get(k), no: i < urut.length ? i + 1 : null })),
    }]);
    catatExport('prioritas_template', `Export urutan prioritas ${LABEL[mode].toLowerCase()}`);
  }

  async function uploadExcel(f) {
    setErr(''); setMsg('');
    try {
      const wb = await bacaWorkbook(f);
      const { rows, headers } = sheetKeObjek(wb.Sheets[wb.SheetNames[0]], ['No', LABEL[mode]]);
      const kol = headers.find((h) => normHeader(h) === normHeader(LABEL[mode])) || headers.find((h) => /area|kota|city/i.test(h));
      if (!kol) { setErr(`Kolom "${LABEL[mode]}" tidak ditemukan di file.`); return; }
      const noKol = headers.find((h) => normHeader(h) === 'no');
      const list = rows.filter((r) => r[kol]).map((r, i) => ({ k: String(r[kol]).trim().toUpperCase(), n: noKol && r[noKol] !== '' && r[noKol] != null ? Number(r[noKol]) : 1e6 + i }))
        .sort((a, b) => a.n - b.n).map((x) => x.k);
      const r = terapkan(daftar[mode].map((x) => x.key), list);
      setMine(r);
      setMsg(`Urutan dari ${f.name} dipakai.${r.baru.length ? ` ${r.baru.length} ${LABEL[mode].toLowerCase()} tidak ada di file, tentukan urutannya di kotak kuning.` : ''}`);
    } catch (e) { setErr('File tidak bisa dibaca: ' + e.message); }
  }

  const sub = (k) => {
    const x = info.get(k);
    if (!x) return '';
    return mode === 'KOTA' ? [x.area, x.dist].filter(Boolean).join(', ') : `${x.jumlahDist} distributor`;
  };

  return (
    <Modal title="List prioritas area" onClose={onClose} wide>
      <p className="small muted" style={{ marginTop: 0 }}>
        Saat stok tidak cukup, urutan nomor 1 mendapat stok lebih dulu, lalu nomor 2, dan seterusnya. Urutan paling bawah mendapat sisa terakhir, bisa sebagian atau tidak sama sekali.
        Dalam urutan yang sama, SO dengan tanggal terlama didahulukan.{' '}
        {daftar.sumber === 'SAP'
          ? 'Daftar diambil dari kolom City / AREA di ZSDR007.'
          : 'Kolom City / ASM / AREA di ZSDR007 tidak terisi semua, jadi daftar diambil dari kota & area di master distributor.'}
      </p>

      <div className="prio-bar">
        <div className="field">
          <label htmlFor="mode-prio">Berdasarkan</label>
          <select id="mode-prio" className="input" value={mode} onChange={(e) => { setMode(e.target.value); setTplId(''); setMsg(''); setErr(''); }}>
            <option value="AREA">Area ({daftar.AREA.length})</option>
            <option value="KOTA">Kota ({daftar.KOTA.length})</option>
          </select>
        </div>
        <div className="field">
          <label htmlFor="tpl">Template tersimpan</label>
          <div className="actions" style={{ flexWrap: 'nowrap' }}>
            <select id="tpl" className="input" value={tplId} onChange={(e) => setTplId(e.target.value)}>
              <option value="">{tplMode.length ? 'Pilih template…' : 'Belum ada template'}</option>
              {tplMode.map((t) => <option key={t.id} value={t.id}>{t.nama}</option>)}
            </select>
            <button type="button" className="btn ghost" disabled={!tplId} onClick={pakaiTemplate}>Pakai</button>
            <button type="button" className="btn danger" disabled={!tplId} onClick={hapusTemplate} aria-label="Hapus template">Hapus</button>
          </div>
        </div>
        <div className="field">
          <label htmlFor="nama-tpl">Simpan urutan ini sebagai template</label>
          <div className="actions" style={{ flexWrap: 'nowrap' }}>
            <input id="nama-tpl" className="input" value={namaTpl} onChange={(e) => setNamaTpl(e.target.value)} placeholder="mis. Prioritas reguler" />
            <button type="button" className="btn ghost" onClick={simpanTemplate}>Simpan template</button>
          </div>
        </div>
      </div>

      <div className="actions" style={{ margin: '10px 0' }}>
        <button type="button" className="btn ghost sm" onClick={() => { setMine({ urut: [...urut, ...baru].sort(), baru: [] }); setMsg('Diurutkan sesuai abjad.'); }}>Urutkan abjad</button>
        <button type="button" className="btn ghost sm" onClick={exportExcel}>Export Excel</button>
        <button type="button" className="btn ghost sm" onClick={() => fileRef.current.click()}>Upload Excel</button>
        <input ref={fileRef} type="file" hidden accept=".xlsx,.xls,.csv" data-testid="file-prioritas" onChange={(e) => { if (e.target.files[0]) uploadExcel(e.target.files[0]); e.target.value = ''; }} />
        <span className="small muted">Tarik baris untuk memindah, atau ketik nomor urut lalu Enter.</span>
      </div>
      {msg && <div className="alert ok" role="status">{msg}</div>}
      {err && <div className="alert err" role="alert">{err}</div>}

      {baru.length > 0 && (
        <div className="baru-box">
          <b>{LABEL[mode]} baru, belum ada di urutan ({baru.length})</b>
          <p className="small" style={{ margin: '2px 0 8px' }}>Tentukan masuk ke urutan berapa. Urutan tidak bisa dipakai sebelum semua ditempatkan.</p>
          <ul>
            {baru.map((k) => (
              <li key={k}>
                <span className="nm">{k}<small>{sub(k)}</small></span>
                <span className="actions" style={{ gap: 6, flexWrap: 'nowrap' }}>
                  <input className="input num" style={{ width: 80, height: 32 }} inputMode="numeric" aria-label={`Nomor urut untuk ${k}`}
                    placeholder="No." value={posisi[k] || ''} onChange={(e) => setPosisi({ ...posisi, [k]: e.target.value.replace(/\D/g, '') })}
                    onKeyDown={(e) => e.key === 'Enter' && posisi[k] && sisipkan(k, Number(posisi[k]) - 1)} />
                  <button type="button" className="btn ghost sm" disabled={!posisi[k]} onClick={() => sisipkan(k, Number(posisi[k]) - 1)}>Masukkan</button>
                  <button type="button" className="btn ghost sm" onClick={() => sisipkan(k, 0)}>Paling atas</button>
                  <button type="button" className="btn ghost sm" onClick={() => sisipkan(k, urut.length)}>Paling bawah</button>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <ol className="prio-list big">
        {urut.map((k, i) => (
          <li key={k} draggable
            className={over === i ? 'over' : undefined}
            onDragStart={(e) => { drag.current = i; e.dataTransfer.effectAllowed = 'move'; }}
            onDragOver={(e) => { e.preventDefault(); setOver(i); }}
            onDragLeave={() => setOver((o) => (o === i ? null : o))}
            onDrop={(e) => { e.preventDefault(); setOver(null); if (drag.current != null && drag.current !== i) pindah(drag.current, i); drag.current = null; }}>
            <span className="grip" aria-hidden="true">⋮⋮</span>
            <input className="no-input" inputMode="numeric" aria-label={`Nomor urut ${k}`} defaultValue={i + 1} key={k + i}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); nomorKe(i, e.currentTarget.value); } }}
              onBlur={(e) => nomorKe(i, e.currentTarget.value)} />
            <span className="nm">{k}<small>{sub(k)}</small></span>
            <span className="small muted so">{info.get(k)?.jumlahSo} SO</span>
            <span className="actions" style={{ gap: 4, flexWrap: 'nowrap' }}>
              <button type="button" className="btn ghost sm" title="Ke paling atas" aria-label={`${k} ke paling atas`} disabled={i === 0} onClick={() => pindah(i, 0)}>⤒</button>
              <button type="button" className="btn ghost sm" aria-label={`Naikkan ${k}`} disabled={i === 0} onClick={() => pindah(i, i - 1)}>▲</button>
              <button type="button" className="btn ghost sm" aria-label={`Turunkan ${k}`} disabled={i === urut.length - 1} onClick={() => pindah(i, i + 1)}>▼</button>
              <button type="button" className="btn ghost sm" title="Ke paling bawah" aria-label={`${k} ke paling bawah`} disabled={i === urut.length - 1} onClick={() => pindah(i, urut.length - 1)}>⤓</button>
            </span>
          </li>
        ))}
      </ol>

      <div className="actions modal-foot">
        <button type="button" className="btn" disabled={baru.length > 0}
          onClick={() => onConfirm({ mode, urutan: urut, sumber: daftar.sumber, template: namaTpl.trim() || null })}>
          Pakai urutan ini
        </button>
        <button type="button" className="btn ghost" onClick={onClose}>Tutup</button>
        {baru.length > 0 && <span className="small muted">Tempatkan dulu {baru.length} {LABEL[mode].toLowerCase()} baru.</span>}
      </div>
    </Modal>
  );
}
