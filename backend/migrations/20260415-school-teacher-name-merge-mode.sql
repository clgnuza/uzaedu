-- Öğretmen ada göre birleştirme: kapalı | otomatik (kayıtta) | manuel (panelden)
ALTER TABLE schools ADD COLUMN IF NOT EXISTS teacher_name_merge_mode varchar(16) NOT NULL DEFAULT 'none';
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'schools' AND column_name = 'merge_teacher_on_name_match'
  ) THEN
    UPDATE schools SET teacher_name_merge_mode = 'automatic' WHERE merge_teacher_on_name_match = true;
    ALTER TABLE schools DROP COLUMN IF EXISTS merge_teacher_on_name_match;
  END IF;
END $$;

COMMENT ON COLUMN schools.teacher_name_merge_mode IS 'none | automatic (web kaydında birleştir) | manual (yalnızca okul admin panel birleştirmesi)';
