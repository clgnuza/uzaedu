-- Esnek Haber/Duyuru modülü – content_channels, content_sources, channel_sources, content_items
-- Çalıştırma: Get-Content backend/migrations/add-content-module.sql | docker exec -i ogretmenpro-db psql -U postgres -d ogretmenpro

CREATE TABLE IF NOT EXISTS content_channels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key VARCHAR(64) NOT NULL UNIQUE,
  label VARCHAR(128) NOT NULL,
  sort_order INT DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_content_channels_key ON content_channels(key);
CREATE INDEX IF NOT EXISTS idx_content_channels_active ON content_channels(is_active);

CREATE TABLE IF NOT EXISTS content_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key VARCHAR(64) NOT NULL UNIQUE,
  label VARCHAR(128) NOT NULL,
  base_url VARCHAR(512),
  rss_url VARCHAR(512),
  scrape_config JSONB,
  sync_interval_minutes INT DEFAULT 120,
  last_synced_at TIMESTAMP WITH TIME ZONE,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_content_sources_key ON content_sources(key);
CREATE INDEX IF NOT EXISTS idx_content_sources_active ON content_sources(is_active);

CREATE TABLE IF NOT EXISTS channel_sources (
  channel_id UUID NOT NULL REFERENCES content_channels(id) ON DELETE CASCADE,
  source_id UUID NOT NULL REFERENCES content_sources(id) ON DELETE CASCADE,
  PRIMARY KEY (channel_id, source_id)
);

CREATE INDEX IF NOT EXISTS idx_channel_sources_channel ON channel_sources(channel_id);
CREATE INDEX IF NOT EXISTS idx_channel_sources_source ON channel_sources(source_id);

CREATE TABLE IF NOT EXISTS content_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id UUID NOT NULL REFERENCES content_sources(id) ON DELETE CASCADE,
  content_type VARCHAR(64) DEFAULT 'announcement',
  title VARCHAR(512) NOT NULL,
  summary TEXT,
  source_url VARCHAR(1024) NOT NULL,
  published_at TIMESTAMP WITH TIME ZONE,
  is_active BOOLEAN DEFAULT true,
  city_filter VARCHAR(100),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_content_items_source ON content_items(source_id);
CREATE INDEX IF NOT EXISTS idx_content_items_type ON content_items(content_type);
CREATE INDEX IF NOT EXISTS idx_content_items_published ON content_items(published_at);
CREATE INDEX IF NOT EXISTS idx_content_items_active ON content_items(is_active);
CREATE INDEX IF NOT EXISTS idx_content_items_city ON content_items(city_filter);

COMMENT ON TABLE content_channels IS 'Kanallar: MEB Duyuruları, Yarışmalar, Eğitim Duyuruları vb.';
COMMENT ON TABLE content_sources IS 'Kaynaklar: Personel GM, TEGM, OGM, TEKNOFEST vb.';
COMMENT ON TABLE channel_sources IS 'Kanal–Kaynak N:N ilişkisi';
COMMENT ON TABLE content_items IS 'Tekil içerikler (haber, duyuru, yarışma vb.)';
