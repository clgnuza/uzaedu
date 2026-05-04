-- Kelebek sınav: sınıfın varsayılan bina ataması (yerleşim ekranı; FK uygulama katmanında doğrulanır)
ALTER TABLE school_classes ADD COLUMN IF NOT EXISTS butterfly_default_building_id uuid NULL;
