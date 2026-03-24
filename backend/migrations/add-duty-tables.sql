-- Nöbet modülü – duty_plan, duty_slot, duty_log, duty_area
-- Çalıştırma: psql -U postgres -d ogretmenpro -f migrations/add-duty-tables.sql

CREATE TABLE IF NOT EXISTS duty_area (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  name VARCHAR(128) NOT NULL,
  sort_order INT DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_duty_area_school ON duty_area(school_id);

CREATE TABLE IF NOT EXISTS duty_plan (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  version VARCHAR(64),
  status VARCHAR(32) DEFAULT 'draft',
  published_at TIMESTAMPTZ,
  period_start DATE,
  period_end DATE,
  academic_year VARCHAR(16),
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_duty_plan_school ON duty_plan(school_id);
CREATE INDEX IF NOT EXISTS idx_duty_plan_status ON duty_plan(status);

CREATE TABLE IF NOT EXISTS duty_slot (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  duty_plan_id UUID NOT NULL REFERENCES duty_plan(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  slot_name VARCHAR(64),
  area_name VARCHAR(128),
  user_id UUID NOT NULL REFERENCES users(id),
  reassigned_from_user_id UUID REFERENCES users(id),
  note TEXT,
  absent_marked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_duty_slot_plan ON duty_slot(duty_plan_id);
CREATE INDEX IF NOT EXISTS idx_duty_slot_date ON duty_slot(date);
CREATE INDEX IF NOT EXISTS idx_duty_slot_user ON duty_slot(user_id);

CREATE TABLE IF NOT EXISTS duty_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  action VARCHAR(32) NOT NULL,
  duty_slot_id UUID REFERENCES duty_slot(id),
  old_user_id UUID REFERENCES users(id),
  new_user_id UUID REFERENCES users(id),
  performed_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_duty_log_school ON duty_log(school_id);

COMMENT ON TABLE duty_plan IS 'Nöbet planı – taslak veya yayınlanmış';
COMMENT ON TABLE duty_slot IS 'Tek nöbet ataması – tarih, alan, öğretmen';
COMMENT ON TABLE duty_log IS 'Nöbet değişiklik geçmişi';
COMMENT ON TABLE duty_area IS 'Nöbet yerleri – Koridor, Bahçe, Giriş vb.';
