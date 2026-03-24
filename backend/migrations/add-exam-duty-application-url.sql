-- Başvuru linki (sınava göre; Kaynak URL'den ayrı, başvuru yapılacak adres)
ALTER TABLE exam_duties ADD COLUMN IF NOT EXISTS application_url VARCHAR(1024);
