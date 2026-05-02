-- Sync kaynağındaki ham başlık (liste/RSS) — ikincil kaynakta birincil kaynakla mükerrer kontrolü
ALTER TABLE exam_duties ADD COLUMN IF NOT EXISTS source_list_headline VARCHAR(512);
COMMENT ON COLUMN exam_duties.source_list_headline IS 'Otomatik sync: kaynak sitedeki ham haber başlığı (çapraz kaynak dedup)';
