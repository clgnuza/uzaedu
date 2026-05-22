-- Faz 6-9: Horarium divisions — alt şubeler

ALTER TABLE ders_dagit_group
  ADD COLUMN IF NOT EXISTS member_sections JSONB NOT NULL DEFAULT '[]';

COMMENT ON COLUMN ders_dagit_group.parallel_mode IS 'parallel_rooms | subgroups | teacher_multi_class';
COMMENT ON COLUMN ders_dagit_group.member_sections IS 'Alt şubeler örn. ["5A-A","5A-B"]';
