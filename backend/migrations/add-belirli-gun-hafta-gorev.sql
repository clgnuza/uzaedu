-- Belirli Gün ve Haftalar – öğretmen görevlendirmesi
-- Okul idaresi academic_calendar_item (belirli_gun_hafta) öğelerine öğretmen atar.
-- Çalıştırma: psql -U postgres -d ogretmenpro -f migrations/add-belirli-gun-hafta-gorev.sql

CREATE TABLE IF NOT EXISTS belirli_gun_hafta_gorev (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  academic_calendar_item_id UUID NOT NULL REFERENCES academic_calendar_item(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  gorev_tipi VARCHAR(32) DEFAULT 'sorumlu' CHECK (gorev_tipi IN ('sorumlu', 'yardimci')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  UNIQUE(school_id, academic_calendar_item_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_bghg_school ON belirli_gun_hafta_gorev(school_id);
CREATE INDEX IF NOT EXISTS idx_bghg_item ON belirli_gun_hafta_gorev(academic_calendar_item_id);
CREATE INDEX IF NOT EXISTS idx_bghg_user ON belirli_gun_hafta_gorev(user_id);

COMMENT ON TABLE belirli_gun_hafta_gorev IS 'Belirli Gün ve Haftalar etkinliklerine okul bazlı öğretmen görevlendirmesi';
