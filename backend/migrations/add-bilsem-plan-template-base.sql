-- BİLSEM plan şablon kök tablosu (add-bilsem-plan-template-content.sql öncesinde çalışmalı)
CREATE TABLE IF NOT EXISTS bilsem_plan_template (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
