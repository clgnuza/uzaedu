-- classes-subjects API: TypeORM alanları ile DB uyumu
ALTER TABLE school_classes ADD COLUMN IF NOT EXISTS owner_user_id uuid NULL;
ALTER TABLE school_classes ADD COLUMN IF NOT EXISTS butterfly_default_building_id uuid NULL;
ALTER TABLE school_subjects ADD COLUMN IF NOT EXISTS owner_user_id uuid NULL;
