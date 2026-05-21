ALTER TABLE schools
  ADD COLUMN IF NOT EXISTS smart_board_lunch_duyuru_grace_minutes INT NOT NULL DEFAULT 10;

ALTER TABLE schools
  ADD COLUMN IF NOT EXISTS smart_board_end_of_day_close_grace_minutes INT NOT NULL DEFAULT 10;

COMMENT ON COLUMN schools.smart_board_lunch_duyuru_grace_minutes IS 'Öğle arası başladıktan (önceki ders bitişi) X dk sonra oturum kapanır, tahta duyuru modunda kalır.';
COMMENT ON COLUMN schools.smart_board_end_of_day_close_grace_minutes IS 'Son ders bitişinden X dk sonra oturum kapanır ve tahta tam kapatılır (offline).';
