-- Nöbet tebliği şablonları – okul bazlı düzenlenebilir metin
-- Çalıştırma: docker exec -i ogretmenpro-db psql -U postgres -d ogretmenpro < backend/migrations/add-duty-teblig-templates.sql
-- TypeORM synchronize kullanıyorsanız bu script gerekmez.

ALTER TABLE schools
  ADD COLUMN IF NOT EXISTS duty_teblig_duty_template TEXT,
  ADD COLUMN IF NOT EXISTS duty_teblig_coverage_template TEXT;
