-- Okul ders programı: status = 'archived' (yeni yayınlanan programla çakışan eski yayınlar arşivlenir).
-- Kolon zaten VARCHAR; ek şema gerekmez.
COMMENT ON COLUMN school_timetable_plan.status IS 'draft | published | archived';
