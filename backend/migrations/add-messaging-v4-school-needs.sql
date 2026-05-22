-- Okul ihtiyaçları: veli rehberi, RSVP, inbound yanıt, otomasyon
-- psql -d ogretmenpro -f add-messaging-v4-school-needs.sql

ALTER TABLE messaging_recipients
  ADD COLUMN IF NOT EXISTS rsvp_status VARCHAR(20);

CREATE TABLE IF NOT EXISTS messaging_veli_directory (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id       UUID NOT NULL,
  phone           VARCHAR(30) NOT NULL,
  contact_name    VARCHAR(255),
  student_name    VARCHAR(255),
  class_name      VARCHAR(50),
  student_number  VARCHAR(50),
  source          VARCHAR(30) DEFAULT 'import',
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_veli_dir_school_phone_student
  ON messaging_veli_directory(school_id, phone, COALESCE(student_number, ''));
CREATE INDEX IF NOT EXISTS idx_veli_dir_school_class ON messaging_veli_directory(school_id, class_name);

ALTER TABLE messaging_inbound_messages
  ADD COLUMN IF NOT EXISTS staff_reply TEXT,
  ADD COLUMN IF NOT EXISTS staff_replied_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS staff_user_id UUID;
