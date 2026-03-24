-- PÜY yıllık plan sütunları: bilsem_outcome_item
-- Çalıştırma: Get-Content -Encoding UTF8 backend/migrations/add-bilsem-outcome-item-puy-columns.sql | docker exec -i ogretmenpro-db env PGCLIENTENCODING=UTF8 psql -U postgres -d ogretmenpro
--
-- AY, HAFTA, DERS SAATİ, KONU, SÜREÇ BİLEŞENLERİ, ÖLÇME VE DEĞERLENDİRME,
-- SOSYAL DUYGUSAL, DEĞERLER, OKURYAZARLIK, BELİRLİ GÜN VE HAFTALAR, PROGRAMLAR ARASI

ALTER TABLE bilsem_outcome_item ADD COLUMN IF NOT EXISTS ay varchar(32);
ALTER TABLE bilsem_outcome_item ADD COLUMN IF NOT EXISTS ders_saati int DEFAULT 2;
ALTER TABLE bilsem_outcome_item ADD COLUMN IF NOT EXISTS konu text;
ALTER TABLE bilsem_outcome_item ADD COLUMN IF NOT EXISTS surec_bilesenleri text;
ALTER TABLE bilsem_outcome_item ADD COLUMN IF NOT EXISTS olcme_degerlendirme text;
ALTER TABLE bilsem_outcome_item ADD COLUMN IF NOT EXISTS sosyal_duygusal text;
ALTER TABLE bilsem_outcome_item ADD COLUMN IF NOT EXISTS degerler text;
ALTER TABLE bilsem_outcome_item ADD COLUMN IF NOT EXISTS okuryazarlik text;
ALTER TABLE bilsem_outcome_item ADD COLUMN IF NOT EXISTS belirli_gun_hafta text;
ALTER TABLE bilsem_outcome_item ADD COLUMN IF NOT EXISTS programlar_arasi text;
