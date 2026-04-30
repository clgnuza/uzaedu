-- Kullanıcı yüklediği yıllık plan Excel'inden oluşan kazanım setleri
ALTER TABLE bilsem_outcome_set
  ADD COLUMN IF NOT EXISTS owner_user_id UUID NULL REFERENCES users(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_bilsem_outcome_set_owner_user
  ON bilsem_outcome_set (owner_user_id) WHERE owner_user_id IS NOT NULL;
