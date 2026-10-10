-- Jalankan HANYA jika database sudah dibuat dengan versi sebelumnya (v1, v2, atau v3).
-- Aman dijalankan lebih dari sekali. Data yang ada tidak dihapus.
ALTER TABLE distributor ADD COLUMN IF NOT EXISTS asm text;
ALTER TABLE massal_run ADD COLUMN IF NOT EXISTS dasar_prioritas text;
ALTER TABLE massal_run ADD COLUMN IF NOT EXISTS prioritas jsonb;
ALTER TABLE massal_run ADD COLUMN IF NOT EXISTS items jsonb;
-- prioritas kini diatur per proses di cek massal, kolom lama tidak dipakai lagi
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'area' AND column_name = 'prioritas') THEN
    ALTER TABLE area ALTER COLUMN prioritas DROP NOT NULL;
  END IF;
END $$;
-- tabel pengaturan versi lama (kunci dasar_prioritas) tidak dipakai lagi
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'pengaturan')
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'pengaturan' AND column_name = 'updated_at') THEN
    DROP TABLE pengaturan;
  END IF;
END $$;
CREATE TABLE IF NOT EXISTS pengaturan (
  kunci      text PRIMARY KEY,
  nilai      text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by text
);
DELETE FROM pengaturan WHERE kunci = 'dasar_prioritas';
INSERT INTO pengaturan (kunci, nilai) VALUES
  ('nama_pt', 'PT Gloria Origita Cosmetics'),
  ('logo', NULL),
  ('login_judul', 'Pilih armada dengan angka, bukan tebakan.'),
  ('login_slogan', 'Bandingkan ongkir, leadtime, dan cost ratio semua ekspedisi untuk setiap kiriman dari gudang Bogor, Bandung, dan Sidoarjo.'),
  ('batas_cr', '23'),
  ('interval_peringatan_jam', '4')
ON CONFLICT (kunci) DO NOTHING;
CREATE TABLE IF NOT EXISTS prioritas_template (
  id         serial PRIMARY KEY,
  nama       text NOT NULL,
  mode       text NOT NULL CHECK (mode IN ('AREA','KOTA')),
  urutan     jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by text,
  UNIQUE (nama, mode)
);
DROP TRIGGER IF EXISTS prioritas_template_last_change ON prioritas_template;
DROP TRIGGER IF EXISTS prioritas_template_audit ON prioritas_template;
CREATE TRIGGER prioritas_template_last_change BEFORE INSERT OR UPDATE ON prioritas_template FOR EACH ROW EXECUTE FUNCTION set_last_change();
CREATE TRIGGER prioritas_template_audit AFTER INSERT OR UPDATE OR DELETE ON prioritas_template FOR EACH ROW EXECUTE FUNCTION audit_trigger();
