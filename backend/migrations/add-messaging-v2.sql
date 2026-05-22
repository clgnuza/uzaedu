-- Mesaj Merkezi v2: şablonlar, opt-out, onay, zamanlama, veli tercihleri
-- psql -d ogretmenpro -f add-messaging-v2.sql

CREATE TABLE IF NOT EXISTS messaging_templates (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id   UUID NOT NULL,
  campaign_type VARCHAR(40) NOT NULL DEFAULT 'toplu_mesaj',
  title       VARCHAR(120) NOT NULL,
  body        TEXT NOT NULL,
  variables   TEXT,
  is_system   BOOLEAN NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_msg_tpl_school ON messaging_templates(school_id);

CREATE TABLE IF NOT EXISTS messaging_opt_outs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id   UUID NOT NULL,
  phone       VARCHAR(30) NOT NULL,
  reason      VARCHAR(255),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_msg_opt_out_school_phone ON messaging_opt_outs(school_id, phone);

CREATE TABLE IF NOT EXISTS messaging_contact_preferences (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id   UUID NOT NULL,
  phone       VARCHAR(30) NOT NULL,
  name        VARCHAR(255),
  preferred_channel VARCHAR(10) DEFAULT 'whatsapp',
  no_sms      BOOLEAN NOT NULL DEFAULT false,
  no_whatsapp BOOLEAN NOT NULL DEFAULT false,
  quiet_hours_note VARCHAR(255),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_msg_contact_pref_phone ON messaging_contact_preferences(school_id, phone);

ALTER TABLE messaging_campaigns
  ADD COLUMN IF NOT EXISTS scheduled_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS approval_status VARCHAR(20) NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS approved_by UUID,
  ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_msg_campaign_scheduled ON messaging_campaigns(scheduled_at)
  WHERE scheduled_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_msg_campaign_approval ON messaging_campaigns(approval_status);
