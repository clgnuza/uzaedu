-- Öğretmen profil alanları – users tablosuna ekleme
-- TypeORM synchronize kullanmıyorsanız bu script'i çalıştırın.

ALTER TABLE users ADD COLUMN IF NOT EXISTS teacher_branch VARCHAR(100) NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS teacher_phone VARCHAR(32) NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS teacher_title VARCHAR(64) NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url VARCHAR(512) NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS teacher_subject_ids JSONB NULL;
