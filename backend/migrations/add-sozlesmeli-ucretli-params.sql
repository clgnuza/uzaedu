-- Sözleşmeli/Ücretli parametreleri: extra_lesson_params tablosuna sütun ekleme
-- Sözleşmeli ve ücretli öğretmenler için SGK oranı ve ücretli birim ücret ölçeği.
-- Çalıştırma: psql -U postgres -d ogretmenpro -f migrations/add-sozlesmeli-ucretli-params.sql

ALTER TABLE extra_lesson_params
  ADD COLUMN IF NOT EXISTS sgk_employee_rate decimal(5,2) DEFAULT 14,
  ADD COLUMN IF NOT EXISTS ucretli_unit_scale decimal(6,4) DEFAULT 1;

-- Mevcut kayıtları güncelle (null ise). ucretli_unit_scale: 1 = kadrolu ile aynı.
UPDATE extra_lesson_params
SET sgk_employee_rate = COALESCE(sgk_employee_rate, 14),
    ucretli_unit_scale = COALESCE(ucretli_unit_scale, 1)
WHERE sgk_employee_rate IS NULL OR ucretli_unit_scale IS NULL;
