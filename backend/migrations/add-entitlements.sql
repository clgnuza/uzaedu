-- Kullanıcı hakları (evrak_uretim, optik_okuma vb.)
CREATE TABLE IF NOT EXISTS entitlements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  entitlement_type VARCHAR(64) NOT NULL,
  quantity INT NOT NULL DEFAULT 0,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, entitlement_type)
);

CREATE INDEX IF NOT EXISTS idx_entitlements_user_type ON entitlements(user_id, entitlement_type);
