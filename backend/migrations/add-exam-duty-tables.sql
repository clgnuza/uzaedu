-- Sınav görevi modülü – exam_duties, exam_duty_preferences, exam_duty_notification_log
-- Çalıştırma: Get-Content backend/migrations/add-exam-duty-tables.sql | docker exec -i ogretmenpro-db psql -U postgres -d ogretmenpro

CREATE TABLE IF NOT EXISTS exam_duties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(512) NOT NULL,
  category_slug VARCHAR(32) NOT NULL,
  summary TEXT,
  body TEXT,
  source_url VARCHAR(1024),
  application_start TIMESTAMP WITH TIME ZONE,
  application_end TIMESTAMP WITH TIME ZONE,
  result_date TIMESTAMP WITH TIME ZONE,
  exam_date TIMESTAMP WITH TIME ZONE,
  exam_date_end TIMESTAMP WITH TIME ZONE,
  status VARCHAR(32) NOT NULL DEFAULT 'draft',
  created_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  published_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_exam_duties_category ON exam_duties(category_slug);
CREATE INDEX IF NOT EXISTS idx_exam_duties_status ON exam_duties(status);
CREATE INDEX IF NOT EXISTS idx_exam_duties_published ON exam_duties(published_at);
CREATE INDEX IF NOT EXISTS idx_exam_duties_exam_date ON exam_duties(exam_date);
CREATE INDEX IF NOT EXISTS idx_exam_duties_application_end ON exam_duties(application_end);

COMMENT ON TABLE exam_duties IS 'Sınav görevi duyuruları – superadmin yönetir';

CREATE TABLE IF NOT EXISTS exam_duty_preferences (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  category_slug VARCHAR(32) NOT NULL,
  pref_publish BOOLEAN DEFAULT true,
  pref_deadline BOOLEAN DEFAULT true,
  pref_exam_minus_1d BOOLEAN DEFAULT true,
  pref_exam_plus_1d BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  PRIMARY KEY (user_id, category_slug)
);

CREATE INDEX IF NOT EXISTS idx_exam_duty_prefs_user ON exam_duty_preferences(user_id);
CREATE INDEX IF NOT EXISTS idx_exam_duty_prefs_category ON exam_duty_preferences(category_slug);

COMMENT ON TABLE exam_duty_preferences IS 'Öğretmen sınav görevi kategori ve zaman tercihleri';

CREATE TABLE IF NOT EXISTS exam_duty_notification_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_duty_id UUID NOT NULL REFERENCES exam_duties(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reason VARCHAR(32) NOT NULL,
  sent_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_exam_duty_log_exam ON exam_duty_notification_log(exam_duty_id);
CREATE INDEX IF NOT EXISTS idx_exam_duty_log_user ON exam_duty_notification_log(user_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_exam_duty_log_dedupe
  ON exam_duty_notification_log(exam_duty_id, user_id, reason);

COMMENT ON TABLE exam_duty_notification_log IS 'Sınav görevi bildirim gönderim geçmişi – spam önleme';
