-- Nöbet takas talebi ve tercih tabloları
-- Çalıştırma: psql -U postgres -d ogretmenpro -f migrations/add-duty-swap-preference.sql
-- TypeORM synchronize kullanıyorsanız bu script gerekmez.

CREATE TABLE IF NOT EXISTS duty_swap_request (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  duty_slot_id UUID NOT NULL REFERENCES duty_slot(id) ON DELETE CASCADE,
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  requested_by_user_id UUID NOT NULL REFERENCES users(id),
  proposed_user_id UUID NOT NULL REFERENCES users(id),
  status VARCHAR(32) DEFAULT 'pending',
  admin_note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_duty_swap_request_school ON duty_swap_request(school_id);
CREATE INDEX IF NOT EXISTS idx_duty_swap_request_status ON duty_swap_request(status);

CREATE TABLE IF NOT EXISTS duty_preference (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id),
  date DATE NOT NULL,
  status VARCHAR(32) DEFAULT 'unavailable',
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(school_id, user_id, date)
);
CREATE INDEX IF NOT EXISTS idx_duty_preference_school ON duty_preference(school_id);
CREATE INDEX IF NOT EXISTS idx_duty_preference_user_date ON duty_preference(user_id, date);

COMMENT ON TABLE duty_swap_request IS 'Nöbet takas talebi – öğretmen takas istemesi, admin onayı';
COMMENT ON TABLE duty_preference IS 'Nöbet tercihi – plan öncesi müsait/isteksiz günler';
