-- Sınav görevi otomatik sync kaynakları
CREATE TABLE IF NOT EXISTS exam_duty_sync_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key VARCHAR(64) NOT NULL UNIQUE,
  label VARCHAR(128) NOT NULL,
  category_slug VARCHAR(32) NOT NULL,
  rss_url VARCHAR(1024),
  base_url VARCHAR(512),
  scrape_config JSONB,
  title_keywords TEXT,
  is_active BOOLEAN DEFAULT true,
  last_synced_at TIMESTAMPTZ,
  last_result_created INT DEFAULT 0,
  last_result_skipped INT DEFAULT 0,
  last_result_error TEXT,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

COMMENT ON TABLE exam_duty_sync_sources IS 'RSS/scrape kaynakları – sınav görevi duyuruları otomatik çekilir';

-- Varsayılan kaynak: add-exam-duty-sources-all-categories.sql ile Güncel Eğitim agregatörü eklenir (MEB Personel GM kaldırıldı – genel personel RSS, sınav görevi nadir)
