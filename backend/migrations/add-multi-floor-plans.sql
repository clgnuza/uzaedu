-- Akıllı Tahta: Birden fazla kat planı desteği
-- Çalıştırma: Get-Content backend/migrations/add-multi-floor-plans.sql | docker exec -i ogretmenpro-db psql -U postgres -d ogretmenpro

-- Çoklu kat planları JSONB: [{ label: "Zemin Kat", url: "..." }, ...]
ALTER TABLE schools
  ADD COLUMN IF NOT EXISTS smart_board_floor_plans JSONB DEFAULT '[]'::jsonb;

COMMENT ON COLUMN schools.smart_board_floor_plans IS 'Akıllı Tahta kat planları. [{ label, url }]. Eski smart_board_floor_plan_url varsa ilk eleman oraya taşınır.';

-- Mevcut tek planı yeni alana taşı
UPDATE schools
SET smart_board_floor_plans = jsonb_build_array(jsonb_build_object('label', 'Kat Planı', 'url', smart_board_floor_plan_url))
WHERE smart_board_floor_plan_url IS NOT NULL
  AND smart_board_floor_plan_url <> ''
  AND (smart_board_floor_plans IS NULL OR smart_board_floor_plans = '[]'::jsonb);

-- Cihazın hangi kat planında olduğu (0 = ilk plan)
ALTER TABLE smart_board_devices
  ADD COLUMN IF NOT EXISTS plan_floor_index INTEGER DEFAULT 0;

COMMENT ON COLUMN smart_board_devices.plan_floor_index IS 'Kat planı indeksi (0-based). Cihaz bu plan üzerinde konumlanır.';
