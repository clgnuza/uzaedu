-- Mevcut okullarda modül listesi açıkça tanımlıysa DersDağıt'ı ekle (null = tüm modüller açık).
-- enabled_modules JSONB dizi (school.entity); text[] / cardinality kullanılmaz.
UPDATE schools
SET enabled_modules = enabled_modules || '["ders_dagit"]'::jsonb
WHERE enabled_modules IS NOT NULL
  AND jsonb_typeof(enabled_modules) = 'array'
  AND jsonb_array_length(enabled_modules) > 0
  AND NOT (enabled_modules @> '["ders_dagit"]'::jsonb);
