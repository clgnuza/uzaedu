-- Mevcut okullarda modül listesi açıkça tanımlıysa DersDağıt'ı ekle (null = tüm modüller açık).
UPDATE schools
SET enabled_modules = enabled_modules || ARRAY['ders_dagit']::text[]
WHERE enabled_modules IS NOT NULL
  AND cardinality(enabled_modules) > 0
  AND NOT ('ders_dagit' = ANY(enabled_modules));
