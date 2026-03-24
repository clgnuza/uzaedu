-- Önce bu dosyayı çalıştırın; sonra backend (TypeORM synchronize açıksa DROP/ADD hatası olmaz).
-- yillik_plan_icerik: BİLSEM satırları (curriculum_model = 'bilsem'); NULL = MEB / kazanım
ALTER TABLE yillik_plan_icerik ADD COLUMN IF NOT EXISTS curriculum_model varchar(32) NULL;

-- plan_key: ALTER TYPE (TypeORM'un uzunluk değişiminde sütunu düşürüp NOT NULL eklemesinden kaçınır)
ALTER TABLE yillik_plan_meta ALTER COLUMN plan_key TYPE varchar(128) USING plan_key::varchar(128);
