-- Site Haritası modülü – superadmin şablon, school_admin ekle/çıkar
-- Çalıştırma: psql -U postgres -d ogretmenpro -f migrations/add-site-map.sql

CREATE TABLE IF NOT EXISTS site_map_item (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id UUID REFERENCES site_map_item(id) ON DELETE CASCADE,
  title VARCHAR(150) NOT NULL,
  path VARCHAR(255),
  description TEXT,
  sort_order INT DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_site_map_item_parent ON site_map_item(parent_id);
CREATE INDEX IF NOT EXISTS idx_site_map_item_sort ON site_map_item(sort_order);

COMMENT ON TABLE site_map_item IS 'Site haritası global şablon – superadmin yönetir';

-- Okul bazlı override (gizlenen öğe IDleri + özel eklenen öğeler)
ALTER TABLE schools
  ADD COLUMN IF NOT EXISTS site_map_overrides JSONB DEFAULT NULL;

COMMENT ON COLUMN schools.site_map_overrides IS 'Site haritası okul özelleştirmesi: { hiddenIds: uuid[], customItems: [{ id, parentId?, title, path, description?, sortOrder }] }';
