-- Nöbet tebliği: Haftalık çizelge özelleştirilebilir metinleri (başlık, nöbetçi görevleri)
-- Çalıştırma: Get-Content backend/migrations/add-duty-teblig-haftalik-metin.sql | docker exec -i ogretmenpro-db psql -U postgres -d ogretmenpro

ALTER TABLE schools
  ADD COLUMN IF NOT EXISTS duty_teblig_haftalik_baslik VARCHAR(128),
  ADD COLUMN IF NOT EXISTS duty_teblig_haftalik_duty_duties_text TEXT;
