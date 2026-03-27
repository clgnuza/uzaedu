-- Plana göre log sorgusu + yayın/slot işlemlerinde plan bağlantısı
ALTER TABLE duty_log ADD COLUMN IF NOT EXISTS duty_plan_id uuid NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'duty_log_duty_plan_id_fkey'
  ) THEN
    ALTER TABLE duty_log
      ADD CONSTRAINT duty_log_duty_plan_id_fkey
      FOREIGN KEY (duty_plan_id) REFERENCES duty_plan(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_duty_log_duty_plan_id ON duty_log(duty_plan_id);

UPDATE duty_log l
SET duty_plan_id = s.duty_plan_id
FROM duty_slot s
WHERE l.duty_slot_id = s.id AND l.duty_plan_id IS NULL;
