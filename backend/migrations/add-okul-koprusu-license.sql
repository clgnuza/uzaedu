-- Okul köprüsü aktivasyon kodu (jsonb)
ALTER TABLE schools
  ADD COLUMN IF NOT EXISTS okul_koprusu_license jsonb NULL;
