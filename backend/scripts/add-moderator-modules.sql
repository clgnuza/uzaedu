-- Moderator rolü için modül yetkileri – users tablosuna ekleme
-- TypeORM synchronize kullanmıyorsanız bu script'i çalıştırın.

ALTER TABLE users ADD COLUMN IF NOT EXISTS moderator_modules JSONB NULL;
