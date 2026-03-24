-- Çok günlü sınavda öğretmen hangi güne sabah bildirimi alacağını seçebilir.
-- NULL = her iki gün (mevcut davranış); set = sadece o gün.
ALTER TABLE exam_duty_assignments ADD COLUMN IF NOT EXISTS preferred_exam_date DATE;
