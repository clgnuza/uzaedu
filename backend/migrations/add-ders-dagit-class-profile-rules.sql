-- Sınıf profili bazlı kural setleri (boş = okul varsayılanı)
ALTER TABLE ders_dagit_class_profile
  ADD COLUMN IF NOT EXISTS rules jsonb;
