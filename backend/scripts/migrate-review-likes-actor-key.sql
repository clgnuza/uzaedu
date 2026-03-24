-- Mevcut school_review_likes tablosunu actor_key destekleyecek şekilde güncelle.
-- Sadece tabloda veri varsa çalıştırın. Yoksa TypeORM synchronize yeterlidir.

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'school_review_likes' AND column_name = 'user_id' AND is_nullable = 'NO')
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'school_review_likes' AND column_name = 'actor_key') THEN
    ALTER TABLE school_review_likes ADD COLUMN actor_key VARCHAR(256);
    UPDATE school_review_likes SET actor_key = 'u:' || user_id::text WHERE actor_key IS NULL;
    ALTER TABLE school_review_likes ALTER COLUMN actor_key SET NOT NULL;
    ALTER TABLE school_review_likes ALTER COLUMN user_id DROP NOT NULL;
    DROP INDEX IF EXISTS "UQ_school_review_likes_review_id_user_id";
    CREATE UNIQUE INDEX IF NOT EXISTS "UQ_school_review_likes_review_id_actor_key" ON school_review_likes (review_id, actor_key);
  END IF;
END $$;
