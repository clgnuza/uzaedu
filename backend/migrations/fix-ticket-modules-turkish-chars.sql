-- Destek modülleri: Türkçe karakter bozulması düzeltmesi (Nöbet, Akıllı Tahta, Ders Programı, Diğer)
-- Çalıştırma: psql -U postgres -d ogretmenpro -f migrations/fix-ticket-modules-turkish-chars.sql
-- veya: docker exec -i ogretmenpro-db psql -U postgres -d ogretmenpro < backend/migrations/fix-ticket-modules-turkish-chars.sql

UPDATE ticket_modules SET name = 'Genel' WHERE sort_order = 1;
UPDATE ticket_modules SET name = 'Evrak & Plan' WHERE sort_order = 2;
UPDATE ticket_modules SET name = 'Nöbet' WHERE sort_order = 3;
UPDATE ticket_modules SET name = 'Akıllı Tahta' WHERE sort_order = 4;
UPDATE ticket_modules SET name = 'Duyuru TV' WHERE sort_order = 5;
UPDATE ticket_modules SET name = 'Optik Okuma' WHERE sort_order = 6;
UPDATE ticket_modules SET name = 'Market' WHERE sort_order = 7;
UPDATE ticket_modules SET name = 'Ders Programı' WHERE sort_order = 8;
UPDATE ticket_modules SET name = 'Diğer' WHERE sort_order = 99;
