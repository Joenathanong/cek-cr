-- =====================================================================
-- Cek Cost Ratio Ekspedisi — skema database (PostgreSQL / Neon)
-- Jalankan sekali di Neon SQL Editor, lalu jalankan seed.sql.
-- Aman dijalankan ulang di database kosong. JANGAN jalankan ulang di
-- database yang sudah berisi data (DROP di bawah akan menghapusnya).
-- =====================================================================

DROP TABLE IF EXISTS pengaturan, cek_history, massal_run, audit_log, login_log, rate, armada,
  ekspedisi, distributor, area, kota, gudang, users CASCADE;
DROP FUNCTION IF EXISTS set_last_change() CASCADE;
DROP FUNCTION IF EXISTS audit_trigger() CASCADE;

-- ---------- Users & login ----------
CREATE TABLE users (
  id               serial PRIMARY KEY,
  username         text NOT NULL UNIQUE,
  nama             text NOT NULL,
  role             text NOT NULL CHECK (role IN ('admin','purchasing','admin_wh','warehouse')),
  password_hash    text NOT NULL,
  aktif            boolean NOT NULL DEFAULT true,
  must_change_password boolean NOT NULL DEFAULT true,
  failed_attempts  int NOT NULL DEFAULT 0,
  locked_until     timestamptz,
  last_login       timestamptz,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  updated_by       text
);

CREATE TABLE login_log (
  id         bigserial PRIMARY KEY,
  user_id    int,
  username   text NOT NULL,
  berhasil   boolean NOT NULL,
  keterangan text,
  ip         text,
  user_agent text,
  waktu      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX login_log_waktu_idx ON login_log (waktu DESC);

-- ---------- Master data ----------
CREATE TABLE gudang (
  id         serial PRIMARY KEY,
  kode       text NOT NULL UNIQUE,
  nama       text NOT NULL,
  plant      text,
  kota       text,
  default_massal boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by text
);

CREATE TABLE kota (
  id             serial PRIMARY KEY,
  nama           text NOT NULL UNIQUE,
  alias          text,              -- dipisah koma, mis. "YOGYA, JOGJA"
  provinsi       text,
  batas_leadtime numeric(6,2),      -- hari; kosong = tanpa batas
  prioritas      int,               -- urutan alokasi stok bila dasar prioritas = KOTA; kosong = paling akhir
  updated_at     timestamptz NOT NULL DEFAULT now(),
  updated_by     text
);

CREATE TABLE area (
  id         serial PRIMARY KEY,
  nama       text NOT NULL UNIQUE,
  prioritas  int NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by text
);

CREATE TABLE distributor (
  id         serial PRIMARY KEY,
  kode       text NOT NULL UNIQUE,
  nama       text NOT NULL,
  kota_id    int NOT NULL REFERENCES kota(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  area_id    int REFERENCES area(id) ON DELETE SET NULL,
  asm        text,
  aktif      boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by text
);
CREATE INDEX distributor_kota_idx ON distributor (kota_id);

CREATE TABLE ekspedisi (
  id         serial PRIMARY KEY,
  kode       text,
  nama       text NOT NULL UNIQUE,
  aktif      boolean NOT NULL DEFAULT true,
  keterangan text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by text
);

CREATE TABLE armada (
  id           serial PRIMARY KEY,
  nama         text NOT NULL UNIQUE,
  kapasitas_kg numeric(12,2),
  kapasitas_m3 numeric(12,3),
  keterangan   text,
  updated_at   timestamptz NOT NULL DEFAULT now(),
  updated_by   text
);

CREATE TABLE rate (
  id                serial PRIMARY KEY,
  ekspedisi_id      int NOT NULL REFERENCES ekspedisi(id) ON DELETE CASCADE,
  layanan           text NOT NULL DEFAULT 'REGULER',
  gudang_id         int NOT NULL REFERENCES gudang(id) ON DELETE RESTRICT,
  kota_id           int NOT NULL REFERENCES kota(id) ON DELETE RESTRICT,
  jenis             text NOT NULL CHECK (jenis IN ('KG','M3','CARTER')),
  armada_id         int REFERENCES armada(id) ON DELETE RESTRICT,
  minimum           numeric(14,3),
  maksimum          numeric(14,3),
  harga             numeric(16,2) NOT NULL CHECK (harga >= 0),
  biaya_minimum     numeric(16,2),   -- tarif bertingkat: flat sampai "minimum", lalu harga per satuan
  biaya_tambahan    numeric(16,2),   -- biaya tetap per kiriman (tol, dokumen, dll)
  faktor_volumetrik numeric(12,3),   -- hanya jenis KG: 1 m3 = X kg (tagih terbesar)
  leadtime_min      numeric(6,2),
  leadtime_max      numeric(6,2),
  berlaku_mulai     date NOT NULL DEFAULT CURRENT_DATE,
  aktif             boolean NOT NULL DEFAULT true,
  keterangan        text,
  updated_at        timestamptz NOT NULL DEFAULT now(),
  updated_by        text,
  CONSTRAINT rate_carter_armada CHECK (jenis <> 'CARTER' OR armada_id IS NOT NULL)
);
CREATE UNIQUE INDEX rate_unique_idx ON rate
  (ekspedisi_id, layanan, gudang_id, kota_id, jenis, COALESCE(armada_id, 0), berlaku_mulai);
CREATE INDEX rate_lookup_idx ON rate (gudang_id, kota_id);

-- ---------- Log & riwayat ----------
CREATE TABLE audit_log (
  id         bigserial PRIMARY KEY,
  tabel      text NOT NULL,
  record_id  text,
  aksi       text NOT NULL,          -- INSERT / UPDATE / DELETE / UPLOAD / EXPORT / USER
  data_lama  jsonb,
  data_baru  jsonb,
  keterangan text,
  user_id    int,
  username   text,
  waktu      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX audit_log_waktu_idx ON audit_log (waktu DESC);
CREATE INDEX audit_log_user_idx ON audit_log (username);

CREATE TABLE pengaturan (
  kunci      text PRIMARY KEY,
  nilai      text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by text
);
INSERT INTO pengaturan (kunci, nilai) VALUES ('dasar_prioritas', 'AREA');

CREATE TABLE massal_run (
  id                 bigserial PRIMARY KEY,
  user_id            int,
  username           text,
  gudang_kode        text,
  keterangan         text,
  jumlah_distributor int,
  total_nilai_po     numeric(18,2),
  total_ongkir       numeric(18,2),
  dasar_prioritas    text,
  items              jsonb,          -- item SO yang dialokasikan (untuk tampilan Cek CR di riwayat)
  created_at         timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE cek_history (
  id               bigserial PRIMARY KEY,
  run_id           bigint REFERENCES massal_run(id) ON DELETE CASCADE,
  tipe             text NOT NULL CHECK (tipe IN ('INDIVIDUAL','MASSAL')),
  user_id          int,
  username         text,
  gudang_kode      text,
  kota_nama        text,
  distributor_kode text,
  distributor_nama text,
  kg               numeric(16,3),
  m3               numeric(16,4),
  nilai_po         numeric(18,2),
  rekom_ekspedisi  text,
  rekom_layanan    text,
  rekom_ongkir     numeric(18,2),
  rekom_leadtime   text,
  rekom_cr         numeric(10,4),
  hasil            jsonb,
  created_at       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX cek_history_created_idx ON cek_history (created_at DESC);
CREATE INDEX cek_history_run_idx ON cek_history (run_id);

-- ---------- Trigger: kolom Last Change ----------
-- Aplikasi mengisi app.username lewat set_config(...) di setiap transaksi.
CREATE FUNCTION set_last_change() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'UPDATE'
     AND (to_jsonb(NEW) - 'updated_at' - 'updated_by') = (to_jsonb(OLD) - 'updated_at' - 'updated_by') THEN
    NEW.updated_at := OLD.updated_at;
    NEW.updated_by := OLD.updated_by;
    RETURN NEW;
  END IF;
  NEW.updated_at := now();
  NEW.updated_by := COALESCE(NULLIF(current_setting('app.username', true), ''), NEW.updated_by, 'system');
  RETURN NEW;
END $$ LANGUAGE plpgsql;

-- ---------- Trigger: log perubahan otomatis ----------
CREATE FUNCTION audit_trigger() RETURNS trigger AS $$
DECLARE
  v_uid int := NULLIF(current_setting('app.user_id', true), '')::int;
  v_user text := COALESCE(NULLIF(current_setting('app.username', true), ''), 'system');
  v_ket text := NULLIF(current_setting('app.keterangan', true), '');
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO audit_log (tabel, record_id, aksi, data_baru, keterangan, user_id, username)
    VALUES (TG_TABLE_NAME, NEW.id::text, 'INSERT', to_jsonb(NEW), v_ket, v_uid, v_user);
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    IF (to_jsonb(NEW) - 'updated_at' - 'updated_by') = (to_jsonb(OLD) - 'updated_at' - 'updated_by') THEN
      RETURN NEW;
    END IF;
    INSERT INTO audit_log (tabel, record_id, aksi, data_lama, data_baru, keterangan, user_id, username)
    VALUES (TG_TABLE_NAME, NEW.id::text, 'UPDATE', to_jsonb(OLD), to_jsonb(NEW), v_ket, v_uid, v_user);
    RETURN NEW;
  ELSE
    INSERT INTO audit_log (tabel, record_id, aksi, data_lama, keterangan, user_id, username)
    VALUES (TG_TABLE_NAME, OLD.id::text, 'DELETE', to_jsonb(OLD), v_ket, v_uid, v_user);
    RETURN OLD;
  END IF;
END $$ LANGUAGE plpgsql;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['gudang','kota','area','distributor','ekspedisi','armada','rate'] LOOP
    EXECUTE format('CREATE TRIGGER %I_last_change BEFORE INSERT OR UPDATE ON %I
                    FOR EACH ROW EXECUTE FUNCTION set_last_change()', t, t);
    EXECUTE format('CREATE TRIGGER %I_audit AFTER INSERT OR UPDATE OR DELETE ON %I
                    FOR EACH ROW EXECUTE FUNCTION audit_trigger()', t, t);
  END LOOP;
END $$;
