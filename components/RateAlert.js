'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';

/** Peringatan kota tanpa rate: muncul saat login lalu setiap N jam (diatur di Pengaturan). */
export default function RateAlert({ data, username, onRefresh }) {
  const key = `ccr.rateAlert.${username}`;
  const [tampil, setTampil] = useState(false);
  const ms = Math.max(0.25, Number(data.intervalJam) || 4) * 3600 * 1000;

  useEffect(() => {
    const cek = () => {
      let last = 0;
      try { last = Number(localStorage.getItem(key)) || 0; } catch {}
      // sesi login baru selalu menampilkan peringatan
      let sesi = null;
      try { sesi = sessionStorage.getItem(key); } catch {}
      if (!sesi || Date.now() - last >= ms) { setTampil(true); onRefresh?.(); }
    };
    cek();
    const t = setInterval(cek, 5 * 60 * 1000);
    return () => clearInterval(t);
  }, [key, ms]); // eslint-disable-line react-hooks/exhaustive-deps

  function nanti() {
    try { localStorage.setItem(key, String(Date.now())); sessionStorage.setItem(key, '1'); } catch {}
    setTampil(false);
  }
  if (!tampil) return null;
  return (
    <div className="rate-alert" role="alertdialog" aria-label="Kota belum punya rate">
      <h3>{data.kota.length} kota belum punya rate ekspedisi<button className="x" onClick={nanti} aria-label="Tutup">×</button></h3>
      <p className="small" style={{ margin: '6px 0 0' }}>
        Distributor di kota berikut tidak bisa dihitung cost ratio-nya dari gudang {data.gudang}, sehingga di cek massal statusnya <b>Cek manual</b>.
      </p>
      <ul>{data.kota.map((k) => <li key={k.nama}><b>{k.nama}</b> <span className="muted">{k.distributor}</span></li>)}</ul>
      <div className="actions">
        <Link className="btn sm" href="/master/rate" onClick={nanti}>Lengkapi rate</Link>
        <button className="btn ghost sm" onClick={nanti}>Ingatkan {data.intervalJam} jam lagi</button>
      </div>
    </div>
  );
}
