-- Akademik Takvim – hafta bazlı şablon (Defterdoldur tarzı)
-- Belirli Gün ve Haftalar + Öğretmen İşleri pill'leri
-- Çalıştırma: psql -U postgres -d ogretmenpro -f migrations/add-academic-calendar.sql

CREATE TABLE IF NOT EXISTS academic_calendar_week (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  academic_year VARCHAR(16) NOT NULL,
  week_number INT NOT NULL,
  title VARCHAR(255),
  date_start DATE,
  date_end DATE,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(academic_year, week_number)
);

CREATE TABLE IF NOT EXISTS academic_calendar_item (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  week_id UUID NOT NULL REFERENCES academic_calendar_week(id) ON DELETE CASCADE,
  item_type VARCHAR(32) NOT NULL CHECK (item_type IN ('belirli_gun_hafta', 'ogretmen_isleri')),
  title VARCHAR(150) NOT NULL,
  path VARCHAR(255),
  icon_key VARCHAR(64),
  sort_order INT DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_academic_calendar_week_year ON academic_calendar_week(academic_year);
CREATE INDEX IF NOT EXISTS idx_academic_calendar_item_week ON academic_calendar_item(week_id);

-- Okul özelleştirmesi: gizlenen item id'leri + özel eklenen item'lar
ALTER TABLE schools
  ADD COLUMN IF NOT EXISTS academic_calendar_overrides JSONB DEFAULT NULL;

COMMENT ON COLUMN schools.academic_calendar_overrides IS 'Akademik takvim okul özelleştirmesi: { hiddenItemIds: uuid[], customItems: [{ weekId, type, title, path?, sortOrder }] }';
