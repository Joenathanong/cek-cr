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
| Admin WH | Ubah/upload distributor, kota, prioritas area, batas leadtime |
| Warehouse | Cek cost ratio dan riwayat (master data hanya lihat) |

## 5. Hal penting

- **Periksa file `master_data_awal.xlsx`** (sheet "Perlu Dicek"). Ada asumsi saat konversi rate card yang perlu dikonfirmasi. Perbaikan cukup lewat menu master data atau Upload Excel.
- **Jangan pasang layanan uptime monitor / ping otomatis** ke website ini, karena database Neon tidak bisa "tidur" dan kuota compute gratis bisa habis.
- Biarkan pengaturan compute Neon di ukuran terkecil (0,25 CU) dengan **scale to zero** aktif (bawaan Neon).
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

1. File dibaca di browser, tidak dikirim mentah ke server.
2. Stok tersedia (sheet Stock) dialokasikan ke baris ZSDR007 berdasarkan urutan: prioritas area distributor → tanggal SO terlama → nomor SO.
3. Harga per pcs dari VA05 dan berat/volume per pcs dari ZSDR006 (key: No. SO + Material) dikalikan qty yang dialokasikan.
4. Semua SO ke distributor yang sama dijumlahkan menjadi satu kiriman, lalu dihitung seperti cek individual.
5. Hasil bisa di-download (sheet Ringkasan, Semua Opsi, Alokasi SO).

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
