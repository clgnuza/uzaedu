-- Planlama ilişkileri (aSc kart ilişkileri)
ALTER TABLE ders_dagit_rule_set
  ADD COLUMN IF NOT EXISTS planning_relations jsonb NOT NULL DEFAULT '[]'::jsonb;
