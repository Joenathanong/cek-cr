'use client';
import { useEffect, useMemo, useState } from 'react';
import { api, catatExport } from '@/lib/client';
import { parseAngka, parseDesimal, leadtimeText } from '@/lib/format';
import { tulisExcel, FMT } from '@/lib/excel';
import { MoneyInput, DecimalInput, Combobox } from '@/components/Inputs';
import ResultView from '@/components/ResultView';

export default function CekIndividual() {
  const [lk, setLk] = useState(null);
  const [gudangId, setGudangId] = useState('');
  const [kota, setKota] = useState('');
  const [kg, setKg] = useState('');
  const [m3, setM3] = useState('');
  const [dim, setDim] = useState({ p: '', l: '', t: '' });
  const [nilai, setNilai] = useState('');
  const [res, setRes] = useState(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api('/api/lookup').then((d) => { setLk(d); setGudangId(String(d.gudang[0]?.id || '')); }).catch((e) => setErr(e.message));
  }, []);

  const items = useMemo(() => {
    if (!lk) return [];
    const byKota = new Map();
    for (const d of lk.distributor) (byKota.get(d.kota_id) || byKota.set(d.kota_id, []).get(d.kota_id)).push(d);
    return lk.kota.map((k) => {
      const ds = byKota.get(k.id) || [];
      return {
        value: k.nama, label: k.nama, key: 'k' + k.id,
        sub: ds.length ? ds.map((d) => d.nama).join(', ').slice(0, 60) : k.alias ? `alias: ${k.alias}`.slice(0, 50) : '',
        search: [k.alias, ...ds.map((d) => d.nama + ' ' + d.kode)].join(' '),
      };
    });
  }, [lk]);

  function setDimensi(k, v) {
    const nd = { ...dim, [k]: v.replace(/[^\d.,]/g, '') };
    setDim(nd);
    const p = parseDesimal(nd.p), l = parseDesimal(nd.l), t = parseDesimal(nd.t);
    if (p && l && t) setM3(String(Math.round((p * l * t) / 1e6 * 10000) / 10000).replace('.', ','));
  }

  async function cek(e) {
    e.preventDefault();
    setErr(''); setBusy(true);
    try {
      const d = await api('/api/cek/individual', {
        method: 'POST',
        body: { gudangId: Number(gudangId), kota, kg: parseAngka(kg) || 0, m3: parseDesimal(m3) || 0, nilaiPo: parseAngka(nilai) || 0 },
      });
      setRes(d);
    } catch (e2) { setErr(e2.message); setRes(null); }
    setBusy(false);
  }

  function exportExcel() {
    const r = res;
    tulisExcel(`cek-cost-ratio-${r.kota.nama}-${new Date().toISOString().slice(0, 10)}.xlsx`, [{
      nama: 'Hasil',
      catatan: [
        `Kiriman: ${r.gudang.kode} → ${r.kota.nama}`,
        `Distributor: ${r.distributor.map((d) => `${d.kode} ${d.nama}`).join(', ') || '-'}`,
        `Berat: ${r.kg} kg, Volume: ${r.m3} m3, Value PO: Rp ${Math.round(r.nilaiPo).toLocaleString('id-ID')}`,
        `Rekomendasi: ${r.utama ? `${r.utama.ekspedisi} (${r.utama.layanan}), ongkir Rp ${r.utama.ongkir.toLocaleString('id-ID')}, CR ${r.utama.cr ?? '-'}%` : '-'}`,
      ],
      kolom: [
        { label: 'Ekspedisi', key: 'ekspedisi', width: 30 }, { label: 'Layanan', key: 'layanan', width: 18 },
        { label: 'Jenis', key: (o) => o.jenis + (o.armada ? ' ' + o.armada : '') }, { label: 'Dasar Hitung', key: 'dasar', width: 26 },
        { label: 'Ongkir (Rp)', key: 'ongkir', fmt: FMT.rp, width: 14 }, { label: 'Leadtime', key: (o) => leadtimeText(o.leadtime_min, o.leadtime_max), width: 14 },
        { label: 'Cost Ratio (%)', key: 'cr', fmt: FMT.angka }, { label: 'Rekomendasi', key: (o) => (r.utama && o.rate_id === r.utama.rate_id ? 'Ya' : '') },
        { label: 'Keterangan', key: 'keterangan', width: 40 },
      ],
      data: r.opsi,
    }]);
    catatExport('cek_individual', `Export hasil cek ${r.gudang.kode} → ${r.kota.nama}`);
  }

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Cek rekomendasi ekspedisi</h1>
          <p>Isi tujuan, berat atau volume, dan value PO. Sistem membandingkan semua layanan ekspedisi dan memilih cost ratio terendah.</p>
        </div>
      </div>

      <form className="panel" onSubmit={cek}>
        <div className="form-grid">
          <div className="field span-3">
            <label htmlFor="g">Gudang asal</label>
            <select id="g" className="input" value={gudangId} onChange={(e) => setGudangId(e.target.value)}>
              {lk?.gudang.map((g) => <option key={g.id} value={g.id}>{g.nama}</option>)}
            </select>
          </div>
          <div className="field span-5" style={{ gridColumn: 'span 5' }}>
            <label htmlFor="kota">Kota tujuan</label>
            <Combobox id="kota" value={kota} onChange={setKota} items={items} placeholder="Ketik nama kota atau distributor" />
          </div>
          <div className="field span-4">
            <label htmlFor="nilai">Total value PO (Rp)</label>
            <MoneyInput id="nilai" value={nilai} onChange={setNilai} placeholder="0" />
            <span className="hint">Exclude PPN</span>
          </div>
          <div className="field span-3">
            <label htmlFor="kg">Berat (kg)</label>
            <DecimalInput id="kg" value={kg} onChange={setKg} placeholder="0" />
            <span className="hint">Desimal pakai koma, mis. 12,5</span>
          </div>
          <div className="field span-3">
            <label htmlFor="m3">Volume (m³)</label>
            <DecimalInput id="m3" value={m3} onChange={setM3} placeholder="0" />
            <span className="hint">Isi langsung, atau hitung dari dimensi</span>
          </div>
          <fieldset className="field span-6" style={{ border: 0, padding: 0, margin: 0 }}>
            <legend className="lbl" style={{ fontSize: 13.5, fontWeight: 600, marginBottom: 5 }}>Dimensi untuk volume (cm, opsional)</legend>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
              <input className="input num" aria-label="Panjang (cm)" placeholder="Panjang" inputMode="decimal" value={dim.p} onChange={(e) => setDimensi('p', e.target.value)} />
              <input className="input num" aria-label="Lebar (cm)" placeholder="Lebar" inputMode="decimal" value={dim.l} onChange={(e) => setDimensi('l', e.target.value)} />
              <input className="input num" aria-label="Tinggi (cm)" placeholder="Tinggi" inputMode="decimal" value={dim.t} onChange={(e) => setDimensi('t', e.target.value)} />
            </div>
          </fieldset>
        </div>
        {err && <div className="alert err" role="alert">{err}</div>}
        <div className="actions" style={{ marginTop: 16 }}>
          <button className="btn" disabled={busy || !kota || (!kg && !m3)}>{busy ? 'Menghitung…' : 'Cek cost ratio'}</button>
          <button type="button" className="btn ghost" onClick={() => { setKota(''); setKg(''); setM3(''); setNilai(''); setDim({ p: '', l: '', t: '' }); setRes(null); setErr(''); }}>Kosongkan</button>
        </div>
      </form>

      {res && (
        <ResultView
          data={{ ...res, asal: res.gudang.kode, tujuan: res.kota.nama, batasLeadtime: res.batasLeadtime }}
          toolbar={<button className="btn ghost sm" onClick={exportExcel}>Download Excel</button>}
        />
      )}
    </div>
  );
}
