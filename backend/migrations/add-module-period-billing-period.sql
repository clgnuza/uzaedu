-- Aylık / yıllık etkinleştirme ayrımı: period_month = YYYY-MM (month) veya YYYY (year)
ALTER TABLE module_period_activation
  ADD COLUMN IF NOT EXISTS billing_period VARCHAR(5) NOT NULL DEFAULT 'month';

ALTER TABLE module_period_activation
  DROP CONSTRAINT IF EXISTS chk_module_period_billing_period;

ALTER TABLE module_period_activation
  ADD CONSTRAINT chk_module_period_billing_period CHECK (billing_period IN ('month', 'year'));

DROP INDEX IF EXISTS uq_module_period_activation_user;
DROP INDEX IF EXISTS uq_module_period_activation_school;

CREATE UNIQUE INDEX IF NOT EXISTS uq_module_period_activation_user
  ON module_period_activation (user_id, module_key, billing_period, period_month)
  WHERE debit_target = 'user';

CREATE UNIQUE INDEX IF NOT EXISTS uq_module_period_activation_school
  ON module_period_activation (school_id, module_key, billing_period, period_month)
  WHERE debit_target = 'school' AND school_id IS NOT NULL;
