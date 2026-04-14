-- Mesaj Grupları ve Kampanya Dosya Eki
-- Çalıştırma: psql -d ogretmenpro -f add-messaging-groups.sql

-- 1. Kişi grupları
CREATE TABLE IF NOT EXISTS messaging_contact_groups (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id  UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  name       VARCHAR(255) NOT NULL,
  description TEXT,
  member_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_msg_cg_school ON messaging_contact_groups(school_id);

-- 2. Grup üyeleri
CREATE TABLE IF NOT EXISTS messaging_group_members (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id     UUID NOT NULL REFERENCES messaging_contact_groups(id) ON DELETE CASCADE,
  name         VARCHAR(255),
  phone        VARCHAR(30) NOT NULL,
  extra_data   JSONB NOT NULL DEFAULT '{}',  -- {studentName, className, ...}
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (group_id, phone)
);
CREATE INDEX IF NOT EXISTS idx_msg_gm_group ON messaging_group_members(group_id);

-- 3. Kampanyalara dosya eki sütunu ekle (yoksa)
ALTER TABLE messaging_campaigns
  ADD COLUMN IF NOT EXISTS attachment_path TEXT,
  ADD COLUMN IF NOT EXISTS attachment_name VARCHAR(255),
  ADD COLUMN IF NOT EXISTS send_to_group_id UUID REFERENCES messaging_contact_groups(id) ON DELETE SET NULL;
