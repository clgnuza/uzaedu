-- Kurum türüne göre akademik takvim şablon öğeleri (null = tüm kurumlar)
ALTER TABLE academic_calendar_item
  ADD COLUMN IF NOT EXISTS school_types jsonb NULL;

COMMENT ON COLUMN academic_calendar_item.school_types IS 'SchoolType[] JSON; NULL veya [] = tüm kurumlar';
