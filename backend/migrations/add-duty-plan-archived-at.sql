-- Arşivlenen nöbet planları (takvim/operasyonel görünümden düşer; istatistikte isteğe bağlı dahil)
ALTER TABLE duty_plan ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ NULL;
CREATE INDEX IF NOT EXISTS idx_duty_plan_school_archived ON duty_plan (school_id, archived_at) WHERE deleted_at IS NULL;
