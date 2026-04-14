ALTER TABLE schools
  ADD COLUMN IF NOT EXISTS merge_teacher_on_name_match boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN schools.merge_teacher_on_name_match IS 'Öğretmen kaydında, okulun önceden eklediği (şifresiz) kayıtla aynı adı birleştir';
