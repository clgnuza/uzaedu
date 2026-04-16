-- E-posta+şifre girişinde OTP zorunluluğu (varsayılan: açık)
ALTER TABLE users ADD COLUMN IF NOT EXISTS login_otp_required boolean NOT NULL DEFAULT true;
UPDATE users SET login_otp_required = true WHERE login_otp_required IS NULL;
