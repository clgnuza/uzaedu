-- Başvuru Onay Son Gün alanı (başvurunun onaylanması için son gün)
ALTER TABLE exam_duties ADD COLUMN IF NOT EXISTS application_approval_end TIMESTAMP WITH TIME ZONE;
