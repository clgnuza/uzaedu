-- Okul kaydı: kurumsal e-posta doğrulama + süperadmin onay kuyruğu
ALTER TABLE users ADD COLUMN IF NOT EXISTS school_join_email_token VARCHAR(64) NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS school_join_email_token_expires_at TIMESTAMPTZ NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS school_join_email_verified_at TIMESTAMPTZ NULL;

COMMENT ON COLUMN users.school_join_email_token IS 'Okul birleşimi e-posta doğrulama (tek seferlik)';
COMMENT ON COLUMN users.school_join_email_token_expires_at IS 'Doğrulama bağlantısı son geçerlilik';
COMMENT ON COLUMN users.school_join_email_verified_at IS 'Kurumsal e-posta tıklanı doğrulandı';

-- Mevcut bekleyen başvurular: e-posta doğrulanmış sayılır (süperadmin kuyruğuna düşer)
UPDATE users
SET school_join_email_verified_at = COALESCE(school_join_email_verified_at, NOW())
WHERE role = 'teacher'
  AND school_id IS NOT NULL
  AND teacher_school_membership = 'pending';
