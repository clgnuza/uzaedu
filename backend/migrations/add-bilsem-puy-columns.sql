-- PÜY formatı sütunları: PDF yapısına uygun
-- BELİRLİ GÜN VE HAFTALAR, SOSYAL-DUYGUSAL, DEĞERLER, OKURYAZARLIK

ALTER TABLE bilsem_plan_template_content ADD COLUMN IF NOT EXISTS belirli_gun_hafta text;
ALTER TABLE bilsem_plan_template_content ADD COLUMN IF NOT EXISTS sosyal_duygusal text;
ALTER TABLE bilsem_plan_template_content ADD COLUMN IF NOT EXISTS degerler text;
ALTER TABLE bilsem_plan_template_content ADD COLUMN IF NOT EXISTS okuryazarlik text;
