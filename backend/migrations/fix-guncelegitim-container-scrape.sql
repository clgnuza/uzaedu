-- Güncel Eğitim: #headline sadece SONDAKİKA (≈10 haber) içeriyor; asıl sınav görevi listesi
-- başka bir blokta. container_selector kaldırılarak tüm sayfadaki /haber/ linkleri taranır;
-- böylece "MEB'den Öğretmenlere 3 Oturum Yeni Sınav Görevi ve Ücretleri" (28219) gibi
-- listede olan ama #headline dışındaki duyurular da eklenir.
-- Çalıştırma: Get-Content -Encoding UTF8 backend/migrations/fix-guncelegitim-container-scrape.sql | docker exec -i ogretmenpro-db env PGCLIENTENCODING=UTF8 psql -U postgres -d ogretmenpro

UPDATE exam_duty_sync_sources
SET scrape_config = scrape_config - 'container_selector'
WHERE key = 'exam_duty_guncelegitim';
