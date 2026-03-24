-- Ücretli brüt tarifesini kadrolu ile aynı yap (1 = tam tarife).
-- Önceki varsayılan 0.725 idi; 1 saat gündüz = 194,30 TL brüt.
-- Çalıştırma: psql -U postgres -d ogretmenpro -f migrations/ucretli-scale-resmi.sql

UPDATE extra_lesson_params
SET ucretli_unit_scale = 1
WHERE ucretli_unit_scale = 0.725 OR ucretli_unit_scale IS NULL;
