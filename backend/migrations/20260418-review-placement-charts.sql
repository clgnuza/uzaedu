-- Okul değerlendirme: LGS/OBP çok serili infografik (v2 JSON)
ALTER TABLE schools
  ADD COLUMN IF NOT EXISTS review_placement_charts jsonb NULL;

COMMENT ON COLUMN schools.review_placement_charts IS 'v2: {v:2, lgs?, obp?} — alan/program bazlı grafikler; boşsa yalnızca review_placement_scores kullanılır';
