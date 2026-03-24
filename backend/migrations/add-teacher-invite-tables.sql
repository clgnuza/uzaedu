-- Öğretmen davet kodu ve kullanım kayıtları (PostgreSQL)
CREATE TABLE IF NOT EXISTS teacher_invite_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inviter_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  code VARCHAR(16) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_teacher_invite_codes_inviter UNIQUE (inviter_user_id),
  CONSTRAINT uq_teacher_invite_codes_code UNIQUE (code)
);

CREATE INDEX IF NOT EXISTS idx_teacher_invite_codes_code ON teacher_invite_codes (code);

CREATE TABLE IF NOT EXISTS teacher_invite_redemptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invite_code_id UUID NOT NULL REFERENCES teacher_invite_codes(id) ON DELETE CASCADE,
  invitee_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  invitee_jeton NUMERIC(14,6) NOT NULL DEFAULT 0,
  inviter_jeton NUMERIC(14,6) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_teacher_invite_redemptions_invitee UNIQUE (invitee_user_id)
);

CREATE INDEX IF NOT EXISTS idx_teacher_invite_redemptions_code_created
  ON teacher_invite_redemptions (invite_code_id, created_at DESC);
