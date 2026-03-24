-- Sınav günü sabah hatırlatması: öğretmenin "görev çıktı" işaretlediği sınavlar
CREATE TABLE IF NOT EXISTS exam_duty_assignments (
  exam_duty_id UUID NOT NULL,
  user_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  PRIMARY KEY (exam_duty_id, user_id),
  FOREIGN KEY (exam_duty_id) REFERENCES exam_duties(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Onay günü ve sınav günü sabah hatırlatma tercihleri
ALTER TABLE exam_duty_preferences ADD COLUMN IF NOT EXISTS pref_approval_day BOOLEAN DEFAULT true;
ALTER TABLE exam_duty_preferences ADD COLUMN IF NOT EXISTS pref_exam_day_morning BOOLEAN DEFAULT true;
