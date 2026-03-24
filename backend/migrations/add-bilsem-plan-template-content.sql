-- BİLSEM plan şablonu haftalık içerik tablosu
-- Çalıştırma: Get-Content -Encoding UTF8 backend/migrations/add-bilsem-plan-template-content.sql | docker exec -i ogretmenpro-db env PGCLIENTENCODING=UTF8 psql -U postgres -d ogretmenpro

ALTER TABLE bilsem_plan_template ADD COLUMN IF NOT EXISTS content_type varchar(16) DEFAULT 'static';
ALTER TABLE bilsem_plan_template ADD COLUMN IF NOT EXISTS requires_merge boolean DEFAULT false;
ALTER TABLE bilsem_plan_template ADD COLUMN IF NOT EXISTS form_schema jsonb;

CREATE TABLE IF NOT EXISTS bilsem_plan_template_content (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bilsem_plan_template_id uuid NOT NULL REFERENCES bilsem_plan_template(id) ON DELETE CASCADE,
  work_calendar_id uuid NOT NULL REFERENCES work_calendar(id) ON DELETE CASCADE,
  modul varchar(256),
  kazanimlar text,
  aciklama text,
  konu_etkinlik text,
  materyal text,
  degerlendirme text,
  ders_saati int DEFAULT 0,
  disiplin_alani varchar(256),
  sort_order int DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(bilsem_plan_template_id, work_calendar_id)
);

CREATE INDEX IF NOT EXISTS idx_bilsem_plan_template_content_template ON bilsem_plan_template_content(bilsem_plan_template_id);
CREATE INDEX IF NOT EXISTS idx_bilsem_plan_template_content_week ON bilsem_plan_template_content(work_calendar_id);
