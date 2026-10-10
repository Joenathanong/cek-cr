'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ENTITIES, REF_LABEL } from '@/lib/entities';
import { api, catatExport } from '@/lib/client';
import { rupiah, angka, tanggalWaktu, parseAngka } from '@/lib/format';
import { bacaWorkbook, sheetKeObjek, tulisExcel, tanggalISO, normHeader, FMT } from '@/lib/excel';
import DataTable from '@/components/DataTable';
import Modal from '@/components/Modal';

function tampil(f, r) {
  const v = r[f.key];
  if (f.type === 'ref') return r[f.key + '_label'] ?? '-';
  if (f.type === 'bool') return v ? <span className="pill">Ya</span> : <span className="pill off">Tidak</span>;
  if (v == null || v === '') return '-';
  if (f.money) return rupiah(v);
  if (f.type === 'number' || f.type === 'int') return angka(v, 3);
  return String(v);
}

function nilaiExport(f, r) {
  if (f.type === 'ref') return r[f.key + '_label'] ?? null;
  if (f.type === 'bool') return r[f.key] ? 'Ya' : 'Tidak';
  return r[f.key] ?? null;
}

export default function MasterPage({ params }) {
  const name = params.entity;
  const e = ENTITIES[name];
  const [rows, setRows] = useState(null);
  const [canEdit, setCanEdit] = useState(false);
  const [lk, setLk] = useState(null);
  const [form, setForm] = useState(null); // {id?, values}
  const [upload, setUpload] = useState(false);
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');

  const load = useCallback(() => {
    api(`/api/master/${name}`).then((d) => { setRows(d.rows); setCanEdit(d.canEdit); }).catch((x) => setErr(x.message));
  }, [name]);
  useEffect(() => { if (e) { load(); api('/api/lookup').then(setLk).catch(() => {}); } }, [e, load]);

  const columns = useMemo(() => {
    if (!e) return [];
    const show = e.fields.filter((f) => !(name === 'rate' && ['biaya_minimum', 'faktor_volumetrik', 'keterangan'].includes(f.key)));
    const cols = show.map((f) => ({
      key: f.key, label: f.label.replace(' (Rp)', ''), num: f.type === 'number' || f.type === 'int',
      value: (r) => (f.type === 'ref' ? r[f.key + '_label'] : r[f.key]), render: (r) => tampil(f, r),
    }));
    cols.push({ key: 'updated_at', label: 'Last change', render: (r) => <span className="small">{tanggalWaktu(r.updated_at)}<div className="muted">{r.updated_by || '-'}</div></span> });
    if (canEdit) cols.unshift({
      key: '_aksi', label: '', sortable: false, render: (r) => (
        <div className="actions" style={{ flexWrap: 'nowrap' }}>
          <button className="btn ghost sm" onClick={() => setForm({ id: r.id, values: { ...r } })}>Ubah</button>
          <button className="btn danger sm" onClick={() => hapus(r)}>Hapus</button>
        </div>
      ),
    });
    return cols;
  }, [e, canEdit, name]);

  if (!e) return <p>Master data tidak ditemukan.</p>;

  async function hapus(r) {
    const label = r.nama || r.kode || `${r.ekspedisi_id_label} ${r.layanan} ${r.kota_id_label}`;
    if (!confirm(`Hapus "${label}"? Perubahan tercatat di log.`)) return;
    try { await api(`/api/master/${name}/${r.id}`, { method: 'DELETE' }); setMsg(`"${label}" dihapus.`); load(); }
    catch (x) { setErr(x.message); }
  }

  function exportExcel(template) {
    const kolom = e.fields.map((f) => ({
      label: f.label, key: (r) => (template ? r[f.key] : nilaiExport(f, r)), width: Math.max(12, f.label.length + 4),
      fmt: f.money ? FMT.rp : undefined,
    }));
    if (!template) kolom.push({ label: 'Terakhir Diubah', key: (r) => tanggalWaktu(r.updated_at), width: 20 }, { label: 'Diubah Oleh', key: 'updated_by' });
    const contoh = {};
    for (const f of e.fields) contoh[f.key] = f.example ?? (f.type === 'bool' ? 'Ya' : f.type === 'enum' ? f.options[0] : f.type === 'date' ? new Date().toISOString().slice(0, 10) : f.type === 'ref' ? '(nama sesuai master)' : '');
    tulisExcel(`${template ? 'template' : 'master'}-${name}-${new Date().toISOString().slice(0, 10)}.xlsx`, [
      { nama: e.label, kolom, data: template ? [contoh] : rows },
      {
        nama: 'Petunjuk',
        kolom: [{ label: 'Kolom', key: 'k', width: 26 }, { label: 'Wajib', key: 'w', width: 8 }, { label: 'Keterangan', key: 'h', width: 80 }],
        data: [
          ...e.fields.map((f) => ({
            k: f.label, w: f.required ? 'Ya' : '',
            h: [f.type === 'enum' ? `Pilihan: ${f.options.join(' / ')}` : '', f.type === 'bool' ? 'Ya / Tidak' : '',
              f.type === 'ref' ? `Harus sama dengan ${REF_LABEL[f.ref]} di master ${ENTITIES[f.ref].label}` : '', f.hint || ''].filter(Boolean).join('. '),
          })),
          { k: '', w: '', h: '' },
          { k: 'Cara upload', w: '', h: `Baris dengan kunci yang sama (${e.naturalKey.map((k) => e.fields.find((f) => f.key === k).label).join(', ')}) akan diperbarui; selain itu ditambahkan.` },
          { k: '', w: '', h: 'Jika ada satu baris salah, tidak ada data yang disimpan. Perbaiki baris yang disebutkan lalu upload ulang.' },
          { k: '', w: '', h: 'Kolom "Terakhir Diubah" dan "Diubah Oleh" hasil export diabaikan saat upload.' },
        ],
      },
    ]);
    if (!template) catatExport(e.table, `Export master ${e.label} (${rows.length} baris)`);
  }

  return (
    <div className="page">
      <div className="page-head">
        <div><h1>{e.label}</h1><p>{e.desc}</p></div>
      </div>
      {msg && <div className="alert ok" role="status">{msg}</div>}
      {err && <div className="alert err" role="alert">{err}</div>}
      {!rows ? <p className="muted">Memuat…</p> : (
        <DataTable columns={columns} rows={rows} defaultSize={25} nowrap
          toolbar={<div className="actions">
            {canEdit && <button className="btn sm" onClick={() => setForm({ values: Object.fromEntries(e.fields.map((f) => [f.key, f.default ?? (f.type === 'date' ? new Date().toISOString().slice(0, 10) : '')])) })}>Tambah</button>}
            {canEdit && <button className="btn ghost sm" onClick={() => setUpload(true)}>Upload Excel</button>}
            <button className="btn ghost sm" onClick={() => exportExcel(false)}>Export Excel</button>
            {canEdit && <button className="btn ghost sm" onClick={() => exportExcel(true)}>Template</button>}
          </div>} />
      )}
      {form && <FormModal e={e} name={name} lk={lk} form={form} onClose={() => setForm(null)}
        onSaved={(t) => { setForm(null); setMsg(t); setErr(''); load(); }} />}
      {upload && <UploadModal e={e} name={name} onClose={() => setUpload(false)}
        onDone={(t) => { setUpload(false); setMsg(t); setErr(''); load(); }} />}
    </div>
  );
}

function refOptions(lk, ref) {
  if (!lk) return [];
  const list = lk[ref] || [];
  return list.map((x) => ({ id: x.id, label: ref === 'gudang' ? `${x.kode} (${x.nama})` : x[REF_LABEL[ref]] }));
}

function FormModal({ e, name, lk, form, onClose, onSaved }) {
  const [v, setV] = useState(form.values);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k, x) => setV((o) => ({ ...o, [k]: x }));

  async function simpan(ev) {
    ev.preventDefault();
    setBusy(true); setErr('');
    const body = {};
    for (const f of e.fields) {
      let x = v[f.key];
      if ((f.type === 'number' || f.type === 'int') && x !== '' && x != null && typeof x !== 'number') {
        const t = String(x).trim();
        // koma = desimal; titik tunggal = desimal kecuali kolom rupiah
        x = t.includes(',') || (t.match(/\./g) || []).length > 1 || f.money ? parseAngka(t) : Number(t);
        if (x == null || isNaN(x)) { setErr(`${f.label} harus berupa angka`); setBusy(false); return; }
      }
      body[f.key] = x === '' ? null : x;
    }
    try {
      await api(form.id ? `/api/master/${name}/${form.id}` : `/api/master/${name}`, { method: form.id ? 'PUT' : 'POST', body });
      onSaved(form.id ? 'Perubahan disimpan.' : 'Data ditambahkan.');
    } catch (x) { setErr(x.message); setBusy(false); }
  }

  return (
    <Modal title={(form.id ? 'Ubah ' : 'Tambah ') + e.label.toLowerCase()} onClose={onClose} wide={e.fields.length > 8}>
      <form onSubmit={simpan}>
        <div className="form-grid">
          {e.fields.map((f) => {
            const id = 'f-' + f.key;
            const span = e.fields.length > 8 ? 'span-4' : 'span-6';
            if (name === 'rate' && f.key === 'armada_id' && v.jenis !== 'CARTER') return null;
            if (name === 'rate' && f.key === 'faktor_volumetrik' && v.jenis !== 'KG') return null;
            return (
              <div key={f.key} className={'field ' + (f.key === 'keterangan' || f.key === 'alias' ? 'span-12' : span)}>
                {f.type === 'bool' ? (
                  <label className="check" style={{ marginTop: 24 }}>
                    <input type="checkbox" checked={!!v[f.key]} onChange={(x) => set(f.key, x.target.checked)} /> {f.label}
                  </label>
                ) : (
                  <>
                    <label htmlFor={id}>{f.label}{f.required ? ' *' : ''}</label>
                    {f.type === 'ref' ? (
                      <select id={id} className="input" value={v[f.key] ?? ''} onChange={(x) => set(f.key, x.target.value ? Number(x.target.value) : '')}>
                        <option value="">Pilih…</option>
                        {refOptions(lk, f.ref).map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
                      </select>
                    ) : f.type === 'enum' ? (
                      <select id={id} className="input" value={v[f.key] ?? ''} onChange={(x) => set(f.key, x.target.value)}>
                        <option value="">Pilih…</option>
                        {f.options.map((o) => <option key={o}>{o}</option>)}
                      </select>
                    ) : (
                      <input id={id} className={'input' + (f.type === 'number' || f.type === 'int' ? ' num' : '')}
                        type={f.type === 'date' ? 'date' : 'text'} inputMode={f.type === 'number' || f.type === 'int' ? 'decimal' : undefined}
                        value={v[f.key] ?? ''} onChange={(x) => set(f.key, f.upper ? x.target.value.toUpperCase() : x.target.value)} />
                    )}
                    {f.hint && <span className="hint">{f.hint}</span>}
                  </>
                )}
              </div>
            );
          })}
        </div>
        {err && <div className="alert err" role="alert">{err}</div>}
        <div className="actions" style={{ marginTop: 16 }}>
          <button className="btn" disabled={busy}>{busy ? 'Menyimpan…' : 'Simpan'}</button>
          <button type="button" className="btn ghost" onClick={onClose}>Batal</button>
        </div>
      </form>
    </Modal>
  );
}

function UploadModal({ e, name, onClose, onDone }) {
  const [file, setFile] = useState(null);
  const [rows, setRows] = useState(null);
  const [res, setRes] = useState(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  async function pilih(f) {
    setErr(''); setRes(null); setRows(null); setFile(f);
    if (!f) return;
    try {
      const wb = await bacaWorkbook(f);
      const sheet = wb.SheetNames.find((s) => normHeader(s) === normHeader(e.label)) || wb.SheetNames[0];
      const { rows: raw, headers } = sheetKeObjek(wb.Sheets[sheet], e.fields.map((x) => x.label));
      const map = {};
      for (const h of headers) {
        const f2 = e.fields.find((x) => normHeader(x.label) === normHeader(h) || normHeader(x.key) === normHeader(h));
        if (f2) map[h] = f2;
      }
      const hilang = e.fields.filter((x) => x.required && !Object.values(map).includes(x)).map((x) => x.label);
      if (hilang.length) { setErr(`Kolom wajib tidak ditemukan: ${hilang.join(', ')}. Gunakan file template.`); return; }
      setRows(raw.map((r) => {
        const o = { __row: r.__row };
        for (const [h, f2] of Object.entries(map)) o[f2.key] = f2.type === 'date' ? tanggalISO(r[h]) : r[h];
        return o;
      }));
    } catch (x) { setErr('File tidak bisa dibaca: ' + x.message); }
  }

  async function kirim() {
    setBusy(true); setErr('');
    try {
      const d = await api(`/api/master/${name}/import`, { method: 'POST', body: { rows, fileName: file.name } });
      if (d.ok) onDone(`Upload selesai: ${d.baru} baris baru, ${d.diubah} diubah, ${d.tetap} tidak berubah.`);
      else setRes(d);
    } catch (x) { setErr(x.message); }
    setBusy(false);
  }

  return (
    <Modal title={`Upload ${e.label}`} onClose={onClose}>
      <p className="small muted" style={{ marginTop: 0 }}>
        Gunakan file dari tombol Template atau hasil Export. Baris dengan kunci yang sama diperbarui, sisanya ditambahkan. Data yang tidak ada di file tidak dihapus.
      </p>
      <input type="file" accept=".xlsx,.xls,.csv" className="input" style={{ paddingTop: 7 }} onChange={(x) => pilih(x.target.files[0])} />
      {rows && <p className="small">{rows.length} baris siap diupload dari <b>{file.name}</b>.</p>}
      {err && <div className="alert err" role="alert">{err}</div>}
      {res && !res.ok && (
        <div className="alert err" role="alert">
          Tidak ada data yang disimpan. {res.totalErrors} baris perlu diperbaiki:
          <div className="table-wrap" style={{ maxHeight: 260, overflowY: 'auto', marginTop: 8 }}>
            <table className="data"><thead><tr><th>Baris</th><th>Masalah</th></tr></thead>
              <tbody>{res.errors.map((x, i) => <tr key={i}><td>{x.baris}</td><td>{x.pesan}</td></tr>)}</tbody></table>
          </div>
        </div>
      )}
      <div className="actions" style={{ marginTop: 16 }}>
        <button className="btn" disabled={!rows?.length || busy} onClick={kirim}>{busy ? 'Mengupload…' : 'Upload'}</button>
        <button className="btn ghost" onClick={onClose}>Tutup</button>
      </div>
    </Modal>
  );
}
