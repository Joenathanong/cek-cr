'use client';
// fetch ke API dengan penanganan sesi habis
export async function api(path, opts = {}) {
  const res = await fetch(path, {
    ...opts,
    headers: { 'Content-Type': 'application/json', ...(opts.headers || {}) },
    body: opts.body && typeof opts.body !== 'string' ? JSON.stringify(opts.body) : opts.body,
    cache: 'no-store',
  });
  if (res.status === 401 && typeof window !== 'undefined' && !path.startsWith('/api/auth/login')) {
    window.location.href = '/login?next=' + encodeURIComponent(window.location.pathname);
    throw new Error('Sesi berakhir');
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok && res.status !== 422) throw new Error(data.error || `Gagal (${res.status})`);
  return data;
}

export function catatExport(tabel, keterangan) {
  api('/api/log/event', { method: 'POST', body: { tabel, keterangan } }).catch(() => {});
}
