-- Okul kurulum kodu: tahta ilk açılışta cihaz eşleme (minimum idare uğraşı)
ALTER TABLE schools
  ADD COLUMN IF NOT EXISTS smart_board_setup_code VARCHAR(8);

CREATE UNIQUE INDEX IF NOT EXISTS idx_schools_smart_board_setup_code
  ON schools (smart_board_setup_code)
  WHERE smart_board_setup_code IS NOT NULL;

COMMENT ON COLUMN schools.smart_board_setup_code IS 'Akıllı tahta saha kurulumu: 6-8 karakter okul kodu (QR/etiket)';
