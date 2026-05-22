-- Webhook iletim durumu + gelen mesajlar + iletişim defteri
-- psql -d ogretmenpro -f add-messaging-v3-webhook.sql

ALTER TABLE messaging_recipients
  ADD COLUMN IF NOT EXISTS provider_message_id VARCHAR(128),
  ADD COLUMN IF NOT EXISTS delivery_status VARCHAR(20),
  ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS read_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_msg_recipient_provider_msg
  ON messaging_recipients(provider_message_id)
  WHERE provider_message_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS messaging_delivery_events (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id           UUID NOT NULL,
  campaign_id         UUID REFERENCES messaging_campaigns(id) ON DELETE SET NULL,
  recipient_id        UUID REFERENCES messaging_recipients(id) ON DELETE SET NULL,
  provider            VARCHAR(20) NOT NULL,
  external_message_id VARCHAR(128),
  status              VARCHAR(20) NOT NULL,
  raw_payload         JSONB DEFAULT '{}',
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_msg_delivery_school ON messaging_delivery_events(school_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_msg_delivery_ext ON messaging_delivery_events(external_message_id);

CREATE TABLE IF NOT EXISTS messaging_inbound_messages (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id           UUID NOT NULL,
  phone               VARCHAR(30) NOT NULL,
  sender_name         VARCHAR(255),
  body                TEXT,
  provider            VARCHAR(20) NOT NULL DEFAULT 'meta',
  external_message_id VARCHAR(128),
  message_type        VARCHAR(20) DEFAULT 'text',
  raw_payload         JSONB DEFAULT '{}',
  received_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_msg_inbound_school_phone ON messaging_inbound_messages(school_id, phone, received_at DESC);
