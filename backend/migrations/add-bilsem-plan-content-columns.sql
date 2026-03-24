-- AÇIKLAMALAR, DERS İÇİ ETKİNLİK, KULLANILAN MATERYALLER, SÜREÇ BİLEŞENLERİ
ALTER TABLE bilsem_plan_template_content ADD COLUMN IF NOT EXISTS ders_ici_etkinlik text;
ALTER TABLE bilsem_plan_template_content ADD COLUMN IF NOT EXISTS surec_bilesenleri text;
