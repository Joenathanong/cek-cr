# Cek Cost Ratio Ekspedisi

Web app untuk membandingkan ongkir, leadtime, dan cost ratio semua ekspedisi, baik per kiriman (individual) maupun massal dari file SAP (ZSDR007, ZSDR006, VA05, Stock).

Teknologi: Next.js 14 (hosting di Vercel gratis) dan PostgreSQL di Neon (gratis).

---

## 1. Siapkan database di Neon

1. Daftar di https://neon.tech, lalu buat **project baru**. Pilih region **AWS Asia Pacific (Singapore)**.
2. Di halaman project, klik **Connect**, aktifkan **Connection pooling**, lalu salin connection string-nya
   (formatnya `postgresql://...-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require`).
3. Buka menu **SQL Editor** di Neon:
   - buka file `db/schema.sql`, salin seluruh isinya, tempel di SQL Editor, lalu klik **Run**;
   - lakukan hal yang sama untuk file `db/seed.sql` (data awal rate card, distributor, kota, dan user admin).

   Cara lain, jika Node.js terpasang di komputer: `npm install`, lalu
   `DATABASE_URL="connection-string" npm run db:setup`.

> `schema.sql` menghapus tabel lama. Jalankan **hanya sekali** saat pertama kali setup.
>
> **Sudah memasang versi sebelumnya?** Jangan jalankan ulang `schema.sql`/`seed.sql`. Cukup jalankan `db/migrasi-v4.sql` di SQL Editor (aman, data tidak hilang, bisa dari versi mana pun), lalu deploy ulang kode terbaru.

## 2. Upload kode ke GitHub

1. Buat repository baru (**Private**) di https://github.com.
2. Klik **uploading an existing file**, lalu tarik seluruh isi folder ini (kecuali `node_modules` dan `.next` jika ada). Klik **Commit changes**.

## 3. Deploy di Vercel

1. Login ke https://vercel.com memakai akun GitHub, klik **Add New → Project**, lalu pilih repository tadi.
2. Buka **Environment Variables** dan isi dua variabel:

   | Name | Value |
   |---|---|
   | `DATABASE_URL` | connection string Neon dari langkah 1 |
   | `AUTH_SECRET` | teks acak minimal 32 karakter (misalnya dari https://generate-secret.vercel.app/32) |

3. Klik **Deploy**. Setelah selesai, Vercel memberikan alamat web, misalnya `https://cek-cost-ratio.vercel.app`.

## 4. Login pertama

- Username: `admin`
- Password: `Admin#2026`

Aplikasi langsung meminta ganti password. Setelah itu buat akun tim di menu **Kelola user**:

| Role | Hak akses |
|---|---|
| Admin | Semua menu, kelola user, log login |
| Purchasing | Ubah/upload rate, ekspedisi, armada |
| Admin WH | Ubah/upload distributor, kota, area, batas leadtime |
| Warehouse | Cek cost ratio dan riwayat (master data hanya lihat) |

## 5. Hal penting

- **Periksa file `master_data_awal.xlsx`** (sheet "Perlu Dicek"). Ada asumsi saat konversi rate card yang perlu dikonfirmasi. Perbaikan cukup lewat menu master data atau Upload Excel.
- **Jangan pasang layanan uptime monitor / ping otomatis** ke website ini, karena database Neon tidak bisa "tidur" dan kuota compute gratis bisa habis.
- Biarkan pengaturan compute Neon di ukuran terkecil (0,25 CU) dengan **scale to zero** aktif (bawaan Neon).
- Menu **Pengaturan** (Admin): nama PT, logo (tampil di halaman login & sidebar), judul & slogan login, batas cost ratio cek massal (awal 23%), dan interval pop up peringatan kota tanpa rate (awal 4 jam).
- Purchasing & Admin mendapat **pop up kota yang belum punya rate** saat login dan setiap interval yang diatur; jumlahnya juga tampil di menu Rate Ekspedisi.
- Hapus riwayat lama lewat menu **Riwayat → Arsip** (khusus admin) bila database mendekati batas 0,5 GB. Export dulu sebelum dihapus.

## 6. Cara kerja perhitungan

- **Jenis KG**: ongkir = harga × max(berat, minimum). Jika *Biaya Minimum* diisi, berlaku tarif bertingkat: biaya minimum untuk berat sampai *minimum*, lalu harga per kg untuk kelebihannya. Jika *Faktor Volumetrik* diisi, berat ditagih = max(berat aktual, m³ × faktor), sama dengan menagih yang terbesar antara tarif per kg dan per m³.
- **Jenis M3**: ongkir = harga × max(volume, minimum).
- **Jenis CARTER**: jumlah trip = pembulatan ke atas dari max(berat ÷ kapasitas kg, volume ÷ kapasitas m³) armada. Ongkir = trip × harga.
- *Biaya Tambahan* (tol, dokumen) ditambahkan per kiriman. Layanan yang melebihi *Maksimum* tidak dipakai.
- **Cost ratio** = ongkir ÷ value PO (exclude PPN) × 100%.
- **Rekomendasi** = cost ratio terendah yang leadtime maksimumnya tidak melebihi *Batas Leadtime* kota tujuan. Jika batas kosong, langsung dipilih yang termurah. Termurah dan Tercepat ditampilkan sebagai pembanding.
- **Rate berlaku**: untuk layanan yang sama, dipakai baris dengan *Berlaku Mulai* terbaru yang sudah lewat. Harga baru bisa dimasukkan lebih awal tanpa menimpa harga lama.

### Cek massal dari SAP

1. Upload ZSDR007, ZSDR006, VA05, dan Stock (4 file terpisah atau 1 file berisi 4 sheet). File dibaca di browser, tidak dikirim mentah ke server.
2. Begitu ZSDR007 terbaca, muncul pop up **List prioritas area**:
   - pilih **Berdasarkan Area** atau **Berdasarkan Kota**;
   - daftar diambil dari isi ZSDR007 (urut abjad). Jika kolom **City, ASM, AREA** di ZSDR007 terisi semua, daftar memakai kolom tersebut (mis. "JAKARTA GDV" terpisah dari "JAKARTA"). Jika ada yang kosong, daftar memakai kota & area dari master distributor;
   - urutan diubah dengan tarik-geser, tombol paling atas/bawah, ▲▼, atau ketik nomor urut; bisa juga export lalu upload Excel;
   - **Simpan template** menyimpan urutan untuk dipakai lagi. Saat template dipakai dan ada area/kota baru yang belum ada di template, area/kota tersebut muncul di kotak kuning dan harus ditempatkan dulu. Area/kota di template yang tidak muncul di file bulan ini tetap tersimpan di posisinya.
3. Stok dialokasikan: urutan prioritas → tanggal SO terlama → nomor SO. Urutan paling bawah mendapat sisa terakhir (bisa sebagian atau tidak sama sekali).
4. Harga per pcs dari VA05 dan berat/volume per pcs dari ZSDR006 (key: No. SO + Material) dikalikan qty yang dialokasikan, lalu semua SO ke distributor yang sama dijumlahkan menjadi satu kiriman dan dihitung ongkirnya.
5. Setelah proses selesai, list prioritas kosong kembali. Urutan yang dipakai tetap dicatat di hasil, Excel, dan Riwayat.
6. Tampilan **Cek CR** menunjukkan item SO per distributor (status stock ready / stock tipis / Stock Kosong, qty outstanding, qty dikirim, value, kg, m³) dan baris total berisi ekspedisi rekomendasi, ongkir, leadtime, dan cost ratio.
7. **Hitung ulang dengan batas CR** (Pengaturan, awal 23%):
   - distributor dengan CR di atas batas menjadi pemberi (CR tertinggi diproses dulu);
   - hanya material yang **dibutuhkan distributor lain** (yang belum kebagian) dialihkan;
   - penerima dipilih dari CR terendah setelah menerima barang (CR sama: urutan prioritas), dan hanya jika CR-nya tetap ≤ batas;
   - CR pemberi dihitung ulang: jika turun ke ≤ batas (barang lebih ringan atau ekspedisi berganti) tetap dikirim, jika masih di atas batas tidak dikirim dan stoknya kembali ke gudang;
   - pemberi tidak bisa menjadi penerima, sehingga tidak ada proses ganda;
   - distributor tanpa rate berstatus **Cek manual** dan tidak ikut pengalihan;
   - rekonsiliasi per material (stok = dikirim + ditahan + sisa gudang) wajib 0 selisih, jika tidak hasil dibatalkan;
   - kolom **Status Kirim**, **CR Awal**, dan **Alasan** menjelaskan setiap perubahan.
8. Download Excel berisi sheet **Cek CR**, **Ringkasan**, **Semua Opsi**, **Pengalihan Stok**, dan **Stok per Material** (rekonsiliasi).

### Barang yang ready belakangan

- Sheet STOCK cukup berisi **Material** dan **Sum of Available stock**. Kolom lain opsional.
- Kolom **Ket1** berisi "stock ready besok" → barang dianggap siap H+1 dari tanggal proses ("lusa" → H+2).
- Kolom opsional **Tanggal Ready** (tanggal) lebih diutamakan daripada Ket1, untuk barang yang ready di tanggal tertentu.
- Barang tersebut **tetap dialokasikan sesuai list prioritas dan tetap dihitung dalam kiriman & CR** (dikirim bersama), hanya ditandai di Cek CR (*Ready Besok …*), filter "Item ready belakangan", dan tab/sheet **Daftar SO** (kolom *Kesiapan Barang*: Ready hari ini / Sebagian ready … / Ready …) untuk diproses di SAP.
- Kolom S-Avail, Ket S-Avail, Status Produk, dan Pending By Avail-s di ZSDR007 **tidak perlu diisi**; semuanya dihitung sistem.

### Kirim hasil ke WhatsApp

Di hasil cek (individual, detail massal, riwayat) ada tombol **Kirim ke WhatsApp**:
- **HP**: gambar hasil cek dibuat otomatis dan menu bagikan terbuka; pilih WhatsApp lalu kontak.
- **Komputer**: gambar disalin ke clipboard dan WhatsApp Web terbuka; pilih kontak, tekan **Ctrl+V**, lalu kirim.
- Tombol **Download gambar** untuk menyimpan gambarnya.

## 7. Upload master data

- Gunakan tombol **Template** atau file hasil **Export Excel** sebagai format.
- Baris dengan kunci yang sama akan diperbarui, baris baru ditambahkan, dan data yang tidak ada di file **tidak dihapus**. Untuk menonaktifkan rate, isi kolom *Aktif* = Tidak.
- Jika ada satu baris salah, tidak ada data yang tersimpan, dan aplikasi menunjukkan nomor baris beserta masalahnya.
- Semua perubahan tercatat di **Log perubahan** (siapa, kapan, nilai lama → baru), dan kolom *Last change* di setiap data.

## Struktur folder

```
app/            halaman & API (Next.js App Router)
components/     komponen tampilan
lib/            perhitungan (calc.js), pengolahan SAP (sap.js), database, login
db/schema.sql   struktur tabel, trigger last change & log
db/seed.sql     data awal
scripts/        setup database lewat command line
```

## Menjalankan di komputer sendiri (opsional)

```
npm install
cp .env.example .env.local   # isi DATABASE_URL dan AUTH_SECRET
npm run dev                  # buka http://localhost:3000
```
