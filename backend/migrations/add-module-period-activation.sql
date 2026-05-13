-- Modül kullanımı: UTC ay başına bir kez aylık tarife ile etkinleştirme (jeton/ek ders düşümü market_usage_ledger ile ayrıca kayıtlıdır)
CREATE TABLE IF NOT EXISTS module_period_activation (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  school_id UUID NULL REFERENCES schools (id) ON DELETE CASCADE,
  module_key VARCHAR(32) NOT NULL,
  period_month VARCHAR(7) NOT NULL,
  debit_target VARCHAR(8) NOT NULL CHECK (debit_target IN ('user', 'school')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_module_period_activation_user_month ON module_period_activation (user_id, period_month);
CREATE INDEX IF NOT EXISTS idx_module_period_activation_school_month ON module_period_activation (school_id, period_month) WHERE school_id IS NOT NULL;

-- Aynı (user, module_key, period_month) veya okul için yinelenen satırlar unique index'i engelleyebilir
DELETE FROM module_period_activation a
USING module_period_activation b
WHERE a.id > b.id
  AND a.debit_target = 'user'
  AND b.debit_target = 'user'
  AND a.user_id = b.user_id
  AND a.module_key = b.module_key
  AND a.period_month = b.period_month;

DELETE FROM module_period_activation a
USING module_period_activation b
WHERE a.id > b.id
  AND a.debit_target = 'school'
  AND b.debit_target = 'school'
  AND a.school_id IS NOT NULL
  AND b.school_id IS NOT NULL
  AND a.school_id = b.school_id
  AND a.module_key = b.module_key
  AND a.period_month = b.period_month;

CREATE UNIQUE INDEX IF NOT EXISTS uq_module_period_activation_user
  ON module_period_activation (user_id, module_key, period_month)
  WHERE debit_target = 'user';

CREATE UNIQUE INDEX IF NOT EXISTS uq_module_period_activation_school
  ON module_period_activation (school_id, module_key, period_month)
  WHERE debit_target = 'school' AND school_id IS NOT NULL;
