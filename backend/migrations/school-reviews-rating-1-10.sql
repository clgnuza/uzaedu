-- Okul değerlendirme: genel puan üst sınırı ve kriter puanları 1–10.
-- Mevcut app_config'ta 5 ise 10'a yükseltir; kriter satırlarında max_score 5 ise 10 yapar.

UPDATE app_config
SET value = '10'
WHERE key = 'school_reviews_rating_max'
  AND (value IS NULL OR TRIM(value) = '' OR TRIM(value) = '5');

UPDATE school_review_criteria
SET min_score = 1, max_score = 10
WHERE max_score IS NOT NULL AND max_score < 10;
