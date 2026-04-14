-- Mesaj Gönderme Modülü tabloları
-- Çalıştırma: psql -d ogretmenpro -f add-messaging-module.sql

-- 1. WhatsApp / mesaj ayarları (okul başına)
CREATE TABLE IF NOT EXISTS messaging_settings (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id    UUID NOT NULL UNIQUE REFERENCES schools(id) ON DELETE CASCADE,
  provider     VARCHAR(30) NOT NULL DEFAULT 'mock',  -- mock | meta | twilio | netgsm | custom
  api_key      TEXT,
  api_secret   TEXT,
  phone_number_id TEXT,   -- Meta: phone_number_id
  from_number  VARCHAR(30),                          -- Twilio/Netgsm: gönderici numara
  api_endpoint TEXT,                                 -- custom provider endpoint
  is_active    BOOLEAN NOT NULL DEFAULT FALSE,
  extra_config JSONB NOT NULL DEFAULT '{}',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Mesaj kampanyaları
CREATE TABLE IF NOT EXISTS messaging_campaigns (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id    UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  created_by   UUID REFERENCES users(id) ON DELETE SET NULL,
  type         VARCHAR(40) NOT NULL,
  -- tipleri: toplu_mesaj | ek_ders | maas | devamsizlik | devamsizlik_mektup | karne | izin
  title        VARCHAR(255) NOT NULL,
  status       VARCHAR(20) NOT NULL DEFAULT 'draft',
  -- draft | preview | sending | completed | failed | cancelled
  total_count  INTEGER NOT NULL DEFAULT 0,
  sent_count   INTEGER NOT NULL DEFAULT 0,
  failed_count INTEGER NOT NULL DEFAULT 0,
  file_path    TEXT,        -- yüklenen Excel/PDF dosyası
  metadata     JSONB NOT NULL DEFAULT '{}',
  -- örn: { date, messageTemplate, pagesPerStudent, ... }
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_messaging_campaigns_school ON messaging_campaigns(school_id);
CREATE INDEX IF NOT EXISTS idx_messaging_campaigns_status ON messaging_campaigns(status);

-- 3. Mesaj alıcıları
CREATE TABLE IF NOT EXISTS messaging_recipients (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id     UUID NOT NULL REFERENCES messaging_campaigns(id) ON DELETE CASCADE,
  recipient_name  VARCHAR(255),   -- veli / öğretmen adı
  phone           VARCHAR(30),    -- WhatsApp telefon (+90...)
  student_name    VARCHAR(255),   -- öğrenci adı (veli mesajlarında)
  student_number  VARCHAR(50),    -- öğrenci numarası
  class_name      VARCHAR(50),
  message_text    TEXT,           -- gönderilecek mesaj metni
  file_path       TEXT,           -- kişiye özel PDF dosyası
  status          VARCHAR(20) NOT NULL DEFAULT 'pending',
  -- pending | sent | failed | skipped
  sent_at         TIMESTAMPTZ,
  error_msg       TEXT,
  sort_order      INTEGER NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_messaging_recipients_campaign ON messaging_recipients(campaign_id);
CREATE INDEX IF NOT EXISTS idx_messaging_recipients_status   ON messaging_recipients(status);
