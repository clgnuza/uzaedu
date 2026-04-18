-- Okul değerlendirme: rapor okundu bilgisi + içerik yazarı ceza (strike / site ban)
ALTER TABLE school_content_reports
  ADD COLUMN IF NOT EXISTS admin_seen_at TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS admin_seen_by UUID NULL REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS school_reviews_strike_count INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS school_reviews_site_ban_until TIMESTAMPTZ NULL;
