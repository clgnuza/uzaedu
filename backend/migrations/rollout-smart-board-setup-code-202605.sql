-- Akıllı tahta okul kurulum kodu (canlı tek seferde)
-- Sıra: önce şema, sonra backfill

ALTER TABLE schools
  ADD COLUMN IF NOT EXISTS smart_board_setup_code VARCHAR(8);

CREATE UNIQUE INDEX IF NOT EXISTS idx_schools_smart_board_setup_code
  ON schools (smart_board_setup_code)
  WHERE smart_board_setup_code IS NOT NULL;

DO $$
DECLARE
  r RECORD;
  new_code TEXT;
  chars TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  i INT;
  tries INT;
  ok BOOLEAN;
BEGIN
  FOR r IN SELECT id FROM schools WHERE smart_board_setup_code IS NULL OR trim(smart_board_setup_code) = ''
  LOOP
    tries := 0;
    <<gen>>
    LOOP
      tries := tries + 1;
      new_code := '';
      FOR i IN 1..6 LOOP
        new_code := new_code || substr(chars, 1 + floor(random() * length(chars))::int, 1);
      END LOOP;
      ok := NOT EXISTS (SELECT 1 FROM schools s WHERE s.smart_board_setup_code = new_code AND s.id <> r.id);
      EXIT gen WHEN ok OR tries > 30;
    END LOOP;
    IF ok THEN
      UPDATE schools SET smart_board_setup_code = new_code WHERE id = r.id;
    END IF;
  END LOOP;
END $$;
