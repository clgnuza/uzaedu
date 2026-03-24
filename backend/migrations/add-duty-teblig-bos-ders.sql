-- Nöbet tebliği: Boş ders görevlendirme metinleri (düzenlenebilir paragraf, konu, nöbetçi müdür yardımcısı)
-- Çalıştırma: Get-Content backend/migrations/add-duty-teblig-bos-ders.sql | docker exec -i ogretmenpro-db psql -U postgres -d ogretmenpro

ALTER TABLE schools
  ADD COLUMN IF NOT EXISTS duty_teblig_bos_ders_paragraf TEXT,
  ADD COLUMN IF NOT EXISTS duty_teblig_bos_ders_konu VARCHAR(128),
  ADD COLUMN IF NOT EXISTS duty_teblig_deputy_principal_name VARCHAR(128);
