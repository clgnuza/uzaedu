-- BİLSEM: plan sınıfı (1–12) grup modelinde kullanılmıyor; boş bırakılabilir.
ALTER TABLE bilsem_plan_submission
  ALTER COLUMN plan_grade DROP NOT NULL;
