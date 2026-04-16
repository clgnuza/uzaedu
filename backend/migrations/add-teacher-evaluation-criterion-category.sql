-- lesson = sınıf içi ders kriterleri, behavior = davranışlar
ALTER TABLE teacher_evaluation_criteria
  ADD COLUMN IF NOT EXISTS criterion_category varchar(16) NOT NULL DEFAULT 'lesson';

COMMENT ON COLUMN teacher_evaluation_criteria.criterion_category IS 'lesson | behavior';
