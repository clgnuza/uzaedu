-- Kanal sıralaması: MEB(0), Haberler(1), Eğitim(2), İl(3), Yarışmalar(4)
-- Çalıştırma: psql veya docker exec -i ... < bu dosya

UPDATE content_channels SET sort_order = 0, updated_at = NOW() WHERE key = 'meb_duyurulari';
UPDATE content_channels SET sort_order = 1, updated_at = NOW() WHERE key = 'haberler';
UPDATE content_channels SET sort_order = 2, updated_at = NOW() WHERE key = 'egitim_duyurulari';
UPDATE content_channels SET sort_order = 3, updated_at = NOW() WHERE key = 'il_duyurulari';
UPDATE content_channels SET sort_order = 4, updated_at = NOW() WHERE key = 'yarismalar';
