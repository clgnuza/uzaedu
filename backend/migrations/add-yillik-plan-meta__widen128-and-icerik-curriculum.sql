-- yillik_plan_icerik: BİLSEM satırları (curriculum_model = 'bilsem'); NULL = MEB / kazanım
-- add-yillik-plan-meta.sql sonrası (dosya adı sıralaması: meta.sql < meta__…)
ALTER TABLE yillik_plan_icerik ADD COLUMN IF NOT EXISTS curriculum_model varchar(32) NULL;

ALTER TABLE yillik_plan_meta ALTER COLUMN plan_key TYPE varchar(128) USING plan_key::varchar(128);
