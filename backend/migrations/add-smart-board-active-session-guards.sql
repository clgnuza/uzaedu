-- Akıllı tahta: aktif oturum çakışmalarını veritabanı seviyesinde engelle
-- Aynı anda tek cihazda tek aktif oturum, tek öğretmende tek aktif oturum

-- Eski/yarış kaynaklı olası mükerrer aktif cihaz oturumlarını kapat (en yeni kayıt kalsın)
WITH ranked_device AS (
  SELECT
    id,
    ROW_NUMBER() OVER (PARTITION BY device_id ORDER BY connected_at DESC, id DESC) AS rn
  FROM smart_board_sessions
  WHERE disconnected_at IS NULL
)
UPDATE smart_board_sessions s
SET disconnected_at = NOW()
FROM ranked_device r
WHERE s.id = r.id
  AND r.rn > 1;

-- Olası mükerrer aktif öğretmen oturumlarını kapat (en yeni kayıt kalsın)
WITH ranked_user AS (
  SELECT
    id,
    ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY connected_at DESC, id DESC) AS rn
  FROM smart_board_sessions
  WHERE disconnected_at IS NULL
)
UPDATE smart_board_sessions s
SET disconnected_at = NOW()
FROM ranked_user r
WHERE s.id = r.id
  AND r.rn > 1;

-- Aktif cihaz tekilliği
CREATE UNIQUE INDEX IF NOT EXISTS idx_smart_board_sessions_one_active_device
  ON smart_board_sessions(device_id)
  WHERE disconnected_at IS NULL;

-- Aktif öğretmen tekilliği
CREATE UNIQUE INDEX IF NOT EXISTS idx_smart_board_sessions_one_active_user
  ON smart_board_sessions(user_id)
  WHERE disconnected_at IS NULL;
