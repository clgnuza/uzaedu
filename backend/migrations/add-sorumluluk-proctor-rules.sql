-- Sorumluluk sınav grubu: gözcü atama kuralları (okul yöneticisi ayarlar)
ALTER TABLE sorumluluk_groups
  ADD COLUMN IF NOT EXISTS proctor_rules JSONB;
