-- Gelmeyen/raporlu/izinli kayıtları + DutySlot.absent_type
-- Çalıştırma: psql -U postgres -d ogretmenpro -f migrations/add-duty-absence-and-absent-type.sql

-- Önceden eklenen devamsızlık (plan oluşturmada hariç tutulur)
CREATE TABLE IF NOT EXISTS duty_absence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id),
  date_from DATE NOT NULL,
  date_to DATE NOT NULL,
  absence_type VARCHAR(32) NOT NULL DEFAULT 'gelmeyen',
  note TEXT,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_duty_absence_school ON duty_absence(school_id);
CREATE INDEX IF NOT EXISTS idx_duty_absence_user ON duty_absence(user_id);
CREATE INDEX IF NOT EXISTS idx_duty_absence_dates ON duty_absence(date_from, date_to);

COMMENT ON TABLE duty_absence IS 'Öğretmen devamsızlığı: raporlu, izinli, gelmeyen. Plan oluşturma ve otomatik görevlendirmede hariç tutulur.';

-- DutySlot'a absent_type ekle (raporlu|izinli|gelmeyen)
ALTER TABLE duty_slot
  ADD COLUMN IF NOT EXISTS absent_type VARCHAR(32);

COMMENT ON COLUMN duty_slot.absent_type IS 'Gelmeyen işaretlendiğinde tip: raporlu, izinli, gelmeyen';
