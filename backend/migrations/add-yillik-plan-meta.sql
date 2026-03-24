-- Yıllık plan meta tablosu – tablo altı not (hafta bağımsız)
-- Çalıştırma: psql -U postgres -d ogretmenpro -f migrations/add-yillik-plan-meta.sql
-- TypeORM synchronize kullanıyorsanız bu script gerekmez.

CREATE TABLE IF NOT EXISTS yillik_plan_meta (
  plan_key VARCHAR(64) PRIMARY KEY,
  tablo_alti_not TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

COMMENT ON TABLE yillik_plan_meta IS 'Yıllık plan tablo altı notu – ders/sınıf/yıl bazlı (subject_code|grade|academic_year)';
