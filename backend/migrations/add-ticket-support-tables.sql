-- Destek/Ticket sistemi – tablolar ve seed
-- Çalıştırma: psql -U postgres -d ogretmenpro -f migrations/add-ticket-support-tables.sql
-- Spec: docs/DESTEK_TICKET_SPEC.md

-- 1) Modül yönetimi
CREATE TABLE IF NOT EXISTS ticket_modules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(64) NOT NULL,
  icon_key VARCHAR(32) DEFAULT 'help-circle',
  target_availability VARCHAR(24) NOT NULL CHECK (target_availability IN ('SCHOOL_ONLY', 'PLATFORM_ONLY', 'BOTH')),
  is_active BOOLEAN DEFAULT true,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
COMMENT ON TABLE ticket_modules IS 'Destek talebi modül kategorileri (genel, evrak, nöbet vb.)';

-- 2) Ana ticket tablosu (self-ref için önce tablo tanımı, sonra FK eklenebilir)
CREATE TABLE IF NOT EXISTS tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_number VARCHAR(32) NOT NULL UNIQUE,
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  target_type VARCHAR(24) NOT NULL CHECK (target_type IN ('SCHOOL_SUPPORT', 'PLATFORM_SUPPORT')),
  module_id UUID NOT NULL REFERENCES ticket_modules(id),
  issue_type VARCHAR(24) NOT NULL CHECK (issue_type IN ('BUG', 'QUESTION', 'REQUEST', 'IMPROVEMENT')),
  priority VARCHAR(16) NOT NULL DEFAULT 'MEDIUM' CHECK (priority IN ('LOW', 'MEDIUM', 'HIGH', 'URGENT')),
  status VARCHAR(24) NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'IN_PROGRESS', 'WAITING_REQUESTER', 'RESOLVED', 'CLOSED')),
  subject VARCHAR(512) NOT NULL,
  requester_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_by_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  assigned_to_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  last_activity_at TIMESTAMPTZ DEFAULT NOW(),
  resolved_at TIMESTAMPTZ,
  closed_at TIMESTAMPTZ,
  escalated_from_ticket_id UUID,
  escalated_to_ticket_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_tickets_escalated_from') THEN
    ALTER TABLE tickets ADD CONSTRAINT fk_tickets_escalated_from FOREIGN KEY (escalated_from_ticket_id) REFERENCES tickets(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_tickets_escalated_to') THEN
    ALTER TABLE tickets ADD CONSTRAINT fk_tickets_escalated_to FOREIGN KEY (escalated_to_ticket_id) REFERENCES tickets(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_tickets_school_target_status ON tickets(school_id, target_type, status, last_activity_at DESC);
CREATE INDEX IF NOT EXISTS idx_tickets_assigned ON tickets(assigned_to_user_id, status) WHERE assigned_to_user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tickets_requester ON tickets(requester_user_id, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_tickets_number ON tickets(ticket_number);
COMMENT ON TABLE tickets IS 'Destek talepleri – okul içi ve platform kuyrukları';

-- 3) Mesajlar
CREATE TABLE IF NOT EXISTS ticket_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  author_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  message_type VARCHAR(24) NOT NULL CHECK (message_type IN ('PUBLIC', 'INTERNAL_NOTE')),
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_ticket_messages_ticket ON ticket_messages(ticket_id, created_at ASC);
COMMENT ON TABLE ticket_messages IS 'Destek talebi mesajları – PUBLIC (requester görür) ve INTERNAL_NOTE';

-- 4) Ek dosyalar
CREATE TABLE IF NOT EXISTS ticket_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_message_id UUID NOT NULL REFERENCES ticket_messages(id) ON DELETE CASCADE,
  storage_key VARCHAR(512) NOT NULL,
  filename VARCHAR(256) NOT NULL,
  mime_type VARCHAR(64) NOT NULL,
  size_bytes INT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_ticket_attachments_message ON ticket_attachments(ticket_message_id);
COMMENT ON TABLE ticket_attachments IS 'Mesaj ek dosyaları – R2 key ile';

-- 5) Audit events
CREATE TABLE IF NOT EXISTS ticket_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  actor_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  event_type VARCHAR(48) NOT NULL,
  payload_json JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_ticket_events_ticket ON ticket_events(ticket_id, created_at DESC);
COMMENT ON TABLE ticket_events IS 'Destek talebi olayları (status_changed, assigned, escalated vb.)';

-- 6) Seed: ticket_modules (idempotent – sadece boşsa)
INSERT INTO ticket_modules (name, icon_key, target_availability, sort_order)
SELECT * FROM (VALUES
  ('Genel', 'help-circle', 'BOTH', 1),
  ('Evrak & Plan', 'file-text', 'BOTH', 2),
  ('Nöbet', 'calendar-clock', 'SCHOOL_ONLY', 3),
  ('Akıllı Tahta', 'monitor', 'SCHOOL_ONLY', 4),
  ('Duyuru TV', 'tv', 'SCHOOL_ONLY', 5),
  ('Optik Okuma', 'scan-line', 'BOTH', 6),
  ('Market', 'shopping-bag', 'BOTH', 7),
  ('Ders Programı', 'book-open', 'SCHOOL_ONLY', 8),
  ('Diğer', 'more-horizontal', 'BOTH', 99)
) AS v(name, icon_key, target_availability, sort_order)
WHERE NOT EXISTS (SELECT 1 FROM ticket_modules LIMIT 1);
