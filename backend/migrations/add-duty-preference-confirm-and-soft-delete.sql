-- Tercih onayı (admin_confirmed_at) + plan/slot soft delete
-- Çalıştırma: docker exec -i ogretmenpro-db psql -U postgres -d ogretmenpro < backend/migrations/add-duty-preference-confirm-and-soft-delete.sql

-- Tercih onayı: admin dikkate aldı işareti
ALTER TABLE duty_preference
  ADD COLUMN IF NOT EXISTS admin_confirmed_at TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS admin_confirmed_by UUID NULL;

-- Plan ve slot soft delete (istatistikler korunur)
ALTER TABLE duty_plan
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ NULL;

ALTER TABLE duty_slot
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ NULL;

COMMENT ON COLUMN duty_preference.admin_confirmed_at IS 'Okul admin tercihi dikkate aldı';
COMMENT ON COLUMN duty_plan.deleted_at IS 'Soft delete – listede gösterilmez, istatistikte sayılır';
COMMENT ON COLUMN duty_slot.deleted_at IS 'Soft delete – listede gösterilmez, istatistikte sayılır';
