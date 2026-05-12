-- Yolluk modülü (6245 özet parametreleri + okul hesapları)
CREATE TABLE IF NOT EXISTS yolluk_global_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fiscal_year int NOT NULL UNIQUE,
  default_daily_tl decimal(12, 2) NOT NULL,
  km_daily_fraction decimal(8, 5) NOT NULL DEFAULT 0.05,
  memur_fixed_multiplier int NOT NULL DEFAULT 20,
  aile_per_multiplier int NOT NULL DEFAULT 10,
  aile_fixed_cap_multiplier int NOT NULL DEFAULT 40,
  rules_version varchar(64) NOT NULL DEFAULT '6245-summary-1',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS yolluk_calculation (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES schools (id) ON DELETE CASCADE,
  teacher_user_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  kind varchar(16) NOT NULL,
  status varchar(16) NOT NULL DEFAULT 'draft',
  title varchar(256),
  inputs jsonb NOT NULL,
  result jsonb NOT NULL,
  rules_snapshot jsonb NOT NULL,
  created_by_user_id uuid NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
  finalized_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_yolluk_calc_school_created ON yolluk_calculation (school_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_yolluk_calc_teacher_created ON yolluk_calculation (teacher_user_id, created_at DESC);

INSERT INTO yolluk_global_settings (
  fiscal_year,
  default_daily_tl,
  km_daily_fraction,
  memur_fixed_multiplier,
  aile_per_multiplier,
  aile_fixed_cap_multiplier,
  rules_version
)
SELECT 2026, 80.00, 0.05, 20, 10, 40, '6245-summary-1'
WHERE NOT EXISTS (SELECT 1 FROM yolluk_global_settings WHERE fiscal_year = 2026);
