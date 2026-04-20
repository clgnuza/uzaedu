-- Sync sonrası kaynak sayfadaki konum (slayt sırası / liste / yeniden kontrol)
ALTER TABLE exam_duties ADD COLUMN IF NOT EXISTS source_list_section VARCHAR(16);
ALTER TABLE exam_duties ADD COLUMN IF NOT EXISTS source_section_order INT;
ALTER TABLE exam_duties ADD COLUMN IF NOT EXISTS source_slider_pool_size INT;

COMMENT ON COLUMN exam_duties.source_list_section IS 'scrape: slider | list | recheck';
COMMENT ON COLUMN exam_duties.source_section_order IS 'Bölüm içi 0 tabanlı sıra (slayt: üstten 0=1. slayt)';
COMMENT ON COLUMN exam_duties.source_slider_pool_size IS 'Sync anında slayt havuzundaki öğe sayısı (örn. 15)';
