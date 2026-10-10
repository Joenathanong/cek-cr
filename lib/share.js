'use client';
// Bagikan hasil cek sebagai gambar: HP -> menu bagikan (WhatsApp), komputer -> salin gambar + buka WhatsApp Web.
import { toBlob } from 'html-to-image';

async function buatGambar(node) {
  const opsi = { pixelRatio: 2, backgroundColor: '#ffffff', cacheBust: true, filter: (n) => !(n.classList && n.classList.contains('no-capture')) };
  try { return await toBlob(node, opsi); } catch { return await toBlob(node, { ...opsi, skipFonts: true }); }
}

const isMobile = () => typeof navigator !== 'undefined' && /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

/**
 * @returns {Promise<'shared'|'copied'|'downloaded'|'cancelled'>}
 */
export async function bagikanWhatsApp(node, teks, namaFile = 'hasil-cek-cost-ratio.png') {
  if (isMobile() && navigator.canShare) {
    const blob = await buatGambar(node);
    const file = new File([blob], namaFile, { type: 'image/png' });
    if (navigator.canShare({ files: [file] })) {
      try { await navigator.share({ files: [file], text: teks }); return 'shared'; }
      catch (e) { if (e?.name === 'AbortError') return 'cancelled'; }
    }
  }
  // komputer: buka tab WhatsApp dulu (harus langsung saat klik), lalu salin gambar ke clipboard
  const tab = window.open('about:blank', '_blank');
  let hasil = 'copied';
  try {
    const blobPromise = buatGambar(node);
    if (!navigator.clipboard?.write || typeof ClipboardItem === 'undefined') throw new Error('clipboard');
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': blobPromise })]);
  } catch {
    const blob = await buatGambar(node);
    unduh(blob, namaFile);
    hasil = 'downloaded';
  }
  const url = `https://web.whatsapp.com/send?text=${encodeURIComponent(teks)}`;
  if (tab) tab.location.href = url; else window.open(url, '_blank');
  return hasil;
}

export async function unduhGambar(node, namaFile = 'hasil-cek-cost-ratio.png') {
  unduh(await buatGambar(node), namaFile);
}

function unduh(blob, namaFile) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = namaFile;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
