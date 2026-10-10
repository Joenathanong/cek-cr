'use client';
import { useMemo, useState } from 'react';
import { Combobox } from './Inputs';

/**
 * Atur dasar prioritas alokasi stok.
 * value: { mode: 'AREA'|'KOTA', area: [{id,nama}], kota: [{id,nama}] }  (keduanya sudah terurut)
 * semuaKota: [{id,nama}]
 */
export default function PrioritasEditor({ value, onChange, semuaKota, readOnly }) {
  const [cari, setCari] = useState('');
  const set = (patch) => onChange({ ...value, ...patch });
  const pindah = (key, i, arah) => {
    const arr = [...value[key]];
    const j = i + arah;
    if (j < 0 || j >= arr.length) return;
    [arr[i], arr[j]] = [arr[j], arr[i]];
    set({ [key]: arr });
  };
  const dipilih = new Set(value.kota.map((k) => k.id));
  const saran = useMemo(() => semuaKota.filter((k) => !dipilih.has(k.id)).map((k) => ({ value: k.nama, label: k.nama, key: 'k' + k.id, id: k.id })),
    [semuaKota, value.kota]); // eslint-disable-line react-hooks/exhaustive-deps
  const list = value.mode === 'KOTA' ? value.kota : value.area;
  const key = value.mode === 'KOTA' ? 'kota' : 'area';

  return (
    <div className="prio">
      <div className="form-grid" style={{ alignItems: 'end' }}>
        <div className="field span-6">
          <label htmlFor="dasar">Dasar prioritas</label>
          <select id="dasar" className="input" value={value.mode} disabled={readOnly} onChange={(e) => set({ mode: e.target.value })}>
            <option value="AREA">Area</option>
            <option value="KOTA">Kota pilihan</option>
          </select>
        </div>
        {value.mode === 'KOTA' && !readOnly && (
          <div className="field span-6">
            <label htmlFor="tambah-kota">Tambah kota</label>
            <Combobox id="tambah-kota" value={cari} onChange={setCari} items={saran} placeholder="Ketik lalu pilih kota"
              onPick={(it) => { set({ kota: [...value.kota, { id: it.id, nama: it.label }] }); setCari(''); }} />
          </div>
        )}
      </div>
      <p className="small muted" style={{ margin: '10px 0' }}>
        {value.mode === 'KOTA'
          ? 'Stok yang tipis dialokasikan ke kota nomor 1 lebih dulu, lalu nomor 2, dan seterusnya. Kota yang tidak dipilih mendapat sisa stok paling akhir. Area tidak dipakai.'
          : 'Stok yang tipis dialokasikan ke area nomor 1 lebih dulu. Dalam area yang sama, SO dengan tanggal terlama didahulukan.'}
      </p>
      {list.length === 0 ? (
        <p className="empty" style={{ padding: 14, border: '1px dashed var(--line-strong)', borderRadius: 6 }}>
          {value.mode === 'KOTA' ? 'Belum ada kota dipilih. Semua kota diperlakukan sama, urut tanggal SO.' : 'Belum ada area.'}
        </p>
      ) : (
        <ol className="prio-list">
          {list.map((x, i) => (
            <li key={x.id}>
              <span className="no">{i + 1}</span><span className="nm">{x.nama}</span>
              {!readOnly && (
                <span className="actions" style={{ gap: 4 }}>
                  <button type="button" className="btn ghost sm" aria-label={`Naikkan ${x.nama}`} disabled={i === 0} onClick={() => pindah(key, i, -1)}>▲</button>
                  <button type="button" className="btn ghost sm" aria-label={`Turunkan ${x.nama}`} disabled={i === list.length - 1} onClick={() => pindah(key, i, 1)}>▼</button>
                  {key === 'kota' && <button type="button" className="btn danger sm" aria-label={`Hapus ${x.nama}`} onClick={() => set({ kota: value.kota.filter((k) => k.id !== x.id) })}>✕</button>}
                </span>
              )}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

export function dariApi(d) {
  return {
    mode: d.mode,
    area: d.area.map((a) => ({ id: a.id, nama: a.nama })),
    kota: d.kota.filter((k) => k.prioritas != null).map((k) => ({ id: k.id, nama: k.nama })),
  };
}
