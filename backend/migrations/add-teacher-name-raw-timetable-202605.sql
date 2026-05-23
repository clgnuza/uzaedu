-- e-Okul import: eşleşmemiş öğretmen adı (plan + teacher_timetable)
ALTER TABLE school_timetable_plan_entry
  ADD COLUMN IF NOT EXISTS teacher_name_raw VARCHAR(160);

ALTER TABLE teacher_timetable
  ADD COLUMN IF NOT EXISTS teacher_name_raw VARCHAR(160);

-- Plan girdisi user_id olmadan da tutulabilsin (eşleştirme beklerken)
ALTER TABLE school_timetable_plan_entry
  ALTER COLUMN user_id DROP NOT NULL;
