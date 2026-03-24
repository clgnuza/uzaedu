-- BİLSEM document_catalog etiketlerini UTF-8 Türkçe ile günceller (PowerShell/psql yanlış encoding sonrası düzeltme).
-- Çalıştırma: dosyayı UTF-8 olarak kaydedin; psql: PGCLIENTENCODING=UTF8 veya Get-Content -Encoding UTF8 ... | docker exec -i ... psql

UPDATE document_catalog SET label = 'Sınıf Öğretmenliği' WHERE category = 'subject' AND code = 'bilsem_sinif_ogretmenligi';
UPDATE document_catalog SET label = 'Fen ve Teknoloji' WHERE category = 'subject' AND code = 'bilsem_fen_teknik';
UPDATE document_catalog SET label = 'İlköğretim Matematik' WHERE category = 'subject' AND code = 'bilsem_ilkogretim_matematik';
UPDATE document_catalog SET label = 'Rehberlik' WHERE category = 'subject' AND code = 'bilsem_rehberlik';
UPDATE document_catalog SET label = 'Sosyal Bilgiler' WHERE category = 'subject' AND code = 'bilsem_sosyal_bilgiler';
UPDATE document_catalog SET label = 'Teknoloji ve Tasarım' WHERE category = 'subject' AND code = 'bilsem_teknoloji_tasarim';
UPDATE document_catalog SET label = 'Türkçe' WHERE category = 'subject' AND code = 'bilsem_turkce';
UPDATE document_catalog SET label = 'Yabancı Dil' WHERE category = 'subject' AND code = 'bilsem_yabanci_dil';
UPDATE document_catalog SET label = 'Bilişim Teknolojileri ve Yazılım' WHERE category = 'subject' AND code = 'bilsem_bil_tek_yazilim';
UPDATE document_catalog SET label = 'Görsel Sanatlar' WHERE category = 'subject' AND code = 'bilsem_gorsel_sanatlar';
UPDATE document_catalog SET label = 'Müzik' WHERE category = 'subject' AND code = 'bilsem_muzik';
UPDATE document_catalog SET label = 'Türk Dili ve Edebiyatı' WHERE category = 'subject' AND code = 'bilsem_turk_dili_edebiyati';
UPDATE document_catalog SET label = 'Biyoloji' WHERE category = 'subject' AND code = 'bilsem_biyoloji';
UPDATE document_catalog SET label = 'Coğrafya' WHERE category = 'subject' AND code = 'bilsem_cografya';
UPDATE document_catalog SET label = 'Felsefe' WHERE category = 'subject' AND code = 'bilsem_felsefe';
UPDATE document_catalog SET label = 'Fizik' WHERE category = 'subject' AND code = 'bilsem_fizik';
UPDATE document_catalog SET label = 'Kimya' WHERE category = 'subject' AND code = 'bilsem_kimya';
UPDATE document_catalog SET label = 'Lise Matematik' WHERE category = 'subject' AND code = 'bilsem_lise_matematik';
UPDATE document_catalog SET label = 'Tarih' WHERE category = 'subject' AND code = 'bilsem_tarih';
UPDATE document_catalog SET label = 'Resim (Görsel Sanatlar Alanı)' WHERE category = 'subject' AND code = 'bilsem_resim';
UPDATE document_catalog SET label = 'Müzik (Müzik Alanı)' WHERE category = 'subject' AND code = 'bilsem_muzik_alan';
