-- school_classes / school_subjects: öğretmen kişisel kayıtları (owner_user_id), okulsuz öğretmen için school_id NULL
ALTER TABLE school_classes ALTER COLUMN school_id DROP NOT NULL;
ALTER TABLE school_subjects ALTER COLUMN school_id DROP NOT NULL;

ALTER TABLE school_classes ADD COLUMN IF NOT EXISTS owner_user_id uuid NULL REFERENCES users (id) ON DELETE CASCADE;
ALTER TABLE school_subjects ADD COLUMN IF NOT EXISTS owner_user_id uuid NULL REFERENCES users (id) ON DELETE CASCADE;
