ALTER TABLE ders_dagit_availability_submission
  ADD COLUMN IF NOT EXISTS approved_periods JSONB NULL;

COMMENT ON COLUMN ders_dagit_availability_submission.approved_periods IS
  'İdarenin programa işlediği uygunluk kısıtları (kısmi veya tam onay).';
