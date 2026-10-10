-- Jalankan HANYA jika database sudah dibuat dengan versi sebelumnya (v1).
-- Aman dijalankan lebih dari sekali. Data yang ada tidak dihapus.
ALTER TABLE kota ADD COLUMN IF NOT EXISTS prioritas int;
ALTER TABLE distributor ADD COLUMN IF NOT EXISTS asm text;
ALTER TABLE massal_run ADD COLUMN IF NOT EXISTS dasar_prioritas text;
ALTER TABLE massal_run ADD COLUMN IF NOT EXISTS items jsonb;
CREATE TABLE IF NOT EXISTS pengaturan (
  kunci      text PRIMARY KEY,
  nilai      text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by text
);
INSERT INTO pengaturan (kunci, nilai) VALUES ('dasar_prioritas', 'AREA') ON CONFLICT (kunci) DO NOTHING;
