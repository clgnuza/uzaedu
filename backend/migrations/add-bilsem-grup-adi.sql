-- BİLSEM yönergesine göre sınıf yerine grup mantığı
-- Çalıştırma: Get-Content -Encoding UTF8 backend/migrations/add-bilsem-grup-adi.sql | docker exec -i ogretmenpro-db env PGCLIENTENCODING=UTF8 psql -U postgres -d ogretmenpro

-- bilsem_outcome_set: grup_adi ekle, grade nullable
ALTER TABLE bilsem_outcome_set ADD COLUMN IF NOT EXISTS grup_adi VARCHAR(64) NULL;
ALTER TABLE bilsem_outcome_set ALTER COLUMN grade DROP NOT NULL;

-- bilsem_generated_plan: grup_adi ekle, grade nullable
ALTER TABLE bilsem_generated_plan ADD COLUMN IF NOT EXISTS grup_adi VARCHAR(64) NULL;
ALTER TABLE bilsem_generated_plan ALTER COLUMN grade DROP NOT NULL;

-- Mevcut verilerde grade varsa grup_adi'ye çevir (opsiyonel)
UPDATE bilsem_outcome_set SET grup_adi = grade::text || '. Sınıf' WHERE grup_adi IS NULL AND grade IS NOT NULL;
UPDATE bilsem_generated_plan SET grup_adi = grade::text || '. Sınıf' WHERE grup_adi IS NULL AND grade IS NOT NULL;
