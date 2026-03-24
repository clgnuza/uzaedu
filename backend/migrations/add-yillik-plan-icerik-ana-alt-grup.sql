-- BİLSEM yönergesine göre sınıf yerine ana grup + alt gruplar (Ek-1 Program Uygulama Tablosu)
-- UYUM, DESTEK-1, DESTEK-2, BYF-1, BYF-2, ÖYG, PROJE

ALTER TABLE yillik_plan_icerik ADD COLUMN IF NOT EXISTS ana_grup VARCHAR(64) NULL;
ALTER TABLE yillik_plan_icerik ADD COLUMN IF NOT EXISTS alt_grup VARCHAR(64) NULL;
ALTER TABLE yillik_plan_icerik ALTER COLUMN grade DROP NOT NULL;

COMMENT ON COLUMN yillik_plan_icerik.ana_grup IS 'BİLSEM program aşaması: UYUM, DESTEK-1, DESTEK-2, BYF-1, BYF-2, ÖYG, PROJE';
COMMENT ON COLUMN yillik_plan_icerik.alt_grup IS 'BİLSEM alt grup (opsiyonel): A, B, Grup 1 vb.';
