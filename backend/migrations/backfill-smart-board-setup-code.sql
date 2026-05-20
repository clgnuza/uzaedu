-- Mevcut okullara kurulum kodu (smart_board modülü açık veya tüm okullar — kod yoksa üret)
-- Not: Üretim için rastgele 6 karakter; çakışma nadirdir.

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
