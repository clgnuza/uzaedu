-- Okul değerlendirme: sınavlı + sınavsız yerleştirme taban puanları (son 4 yıl, süperadmin)
ALTER TABLE schools
  ADD COLUMN IF NOT EXISTS review_placement_dual_track boolean NOT NULL DEFAULT false;

ALTER TABLE schools
  ADD COLUMN IF NOT EXISTS review_placement_scores jsonb NULL;

COMMENT ON COLUMN schools.review_placement_dual_track IS 'Okul değerlendirme sayfasında LGS sınavlı/sınavsız puan kartı gösterilsin mi';
COMMENT ON COLUMN schools.review_placement_scores IS 'Yıllık taban puanları: [{year, with_exam, without_exam}], en fazla 4 kayıt';
