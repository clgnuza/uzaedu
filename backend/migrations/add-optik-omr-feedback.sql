CREATE TABLE IF NOT EXISTS optik_omr_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID NOT NULL,
  scan_result_id UUID NULL,
  user_id UUID NOT NULL,
  question INT NOT NULL,
  detected_label VARCHAR(8) NOT NULL,
  corrected_label VARCHAR(8) NOT NULL,
  student_code VARCHAR(32) NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_optik_omr_feedback_template ON optik_omr_feedback (template_id);
