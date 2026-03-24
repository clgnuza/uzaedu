-- Güncel Eğitim: Önceden ~15 ana sınav haberini (#headline / SONDAKİKA) kontrol ediyordu.
-- container_selector kaldırılınca tüm sayfa taranıp aday sayısı 45'e çıktı (23 eklenen, 22 atlanan).
-- Eski davranışa dön: sadece #headline ile ~10-15 ana haber taranır.
-- Not: #headline dışındaki "asıl liste"deki bazı duyurular (örn. sadece listede olan MEB 3 oturum)
-- bu ayarla gelmez; gerekirse list_url ile ikinci bir kaynak eklenebilir.
-- Çalıştırma: Get-Content -Encoding UTF8 backend/migrations/restore-guncelegitim-headline-only.sql | docker exec -i ogretmenpro-db env PGCLIENTENCODING=UTF8 psql -U postgres -d ogretmenpro

UPDATE exam_duty_sync_sources
SET scrape_config = scrape_config || '{"container_selector": "#headline"}'::jsonb
WHERE key = 'exam_duty_guncelegitim';
