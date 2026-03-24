-- BİLSEM Ek-1 Program Uygulama Tablosu – Genel Zihinsel Yetenek alanına göre dersler
-- Sadece mevcut değilse ekle (code unique kontrolü)
INSERT INTO document_catalog (category, code, label, grade_min, grade_max, section_filter, ana_grup, sort_order, is_active)
SELECT 'subject', 'bilsem_sinif_ogretmenligi', 'Sınıf Öğretmenliği', NULL, NULL, NULL, 'GENEL_YETENEK', 3001, true
WHERE NOT EXISTS (SELECT 1 FROM document_catalog WHERE category = 'subject' AND code = 'bilsem_sinif_ogretmenligi');
INSERT INTO document_catalog (category, code, label, grade_min, grade_max, section_filter, ana_grup, sort_order, is_active)
SELECT 'subject', 'bilsem_fen_teknik', 'Fen ve Teknoloji', NULL, NULL, NULL, 'GENEL_YETENEK', 3002, true
WHERE NOT EXISTS (SELECT 1 FROM document_catalog WHERE category = 'subject' AND code = 'bilsem_fen_teknik');
INSERT INTO document_catalog (category, code, label, grade_min, grade_max, section_filter, ana_grup, sort_order, is_active)
SELECT 'subject', 'bilsem_ilkogretim_matematik', 'İlköğretim Matematik', NULL, NULL, NULL, 'GENEL_YETENEK', 3003, true
WHERE NOT EXISTS (SELECT 1 FROM document_catalog WHERE category = 'subject' AND code = 'bilsem_ilkogretim_matematik');
INSERT INTO document_catalog (category, code, label, grade_min, grade_max, section_filter, ana_grup, sort_order, is_active)
SELECT 'subject', 'bilsem_rehberlik', 'Rehberlik', NULL, NULL, NULL, 'GENEL_YETENEK', 3004, true
WHERE NOT EXISTS (SELECT 1 FROM document_catalog WHERE category = 'subject' AND code = 'bilsem_rehberlik');
INSERT INTO document_catalog (category, code, label, grade_min, grade_max, section_filter, ana_grup, sort_order, is_active)
SELECT 'subject', 'bilsem_sosyal_bilgiler', 'Sosyal Bilgiler', NULL, NULL, NULL, 'GENEL_YETENEK', 3005, true
WHERE NOT EXISTS (SELECT 1 FROM document_catalog WHERE category = 'subject' AND code = 'bilsem_sosyal_bilgiler');
INSERT INTO document_catalog (category, code, label, grade_min, grade_max, section_filter, ana_grup, sort_order, is_active)
SELECT 'subject', 'bilsem_teknoloji_tasarim', 'Teknoloji ve Tasarım', NULL, NULL, NULL, 'GENEL_YETENEK', 3006, true
WHERE NOT EXISTS (SELECT 1 FROM document_catalog WHERE category = 'subject' AND code = 'bilsem_teknoloji_tasarim');
INSERT INTO document_catalog (category, code, label, grade_min, grade_max, section_filter, ana_grup, sort_order, is_active)
SELECT 'subject', 'bilsem_turkce', 'Türkçe', NULL, NULL, NULL, 'GENEL_YETENEK', 3007, true
WHERE NOT EXISTS (SELECT 1 FROM document_catalog WHERE category = 'subject' AND code = 'bilsem_turkce');
INSERT INTO document_catalog (category, code, label, grade_min, grade_max, section_filter, ana_grup, sort_order, is_active)
SELECT 'subject', 'bilsem_yabanci_dil', 'Yabancı Dil', NULL, NULL, NULL, 'GENEL_YETENEK', 3008, true
WHERE NOT EXISTS (SELECT 1 FROM document_catalog WHERE category = 'subject' AND code = 'bilsem_yabanci_dil');
INSERT INTO document_catalog (category, code, label, grade_min, grade_max, section_filter, ana_grup, sort_order, is_active)
SELECT 'subject', 'bilsem_bil_tek_yazilim', 'Bilişim Teknolojileri ve Yazılım', NULL, NULL, NULL, 'GENEL_YETENEK', 3009, true
WHERE NOT EXISTS (SELECT 1 FROM document_catalog WHERE category = 'subject' AND code = 'bilsem_bil_tek_yazilim');
INSERT INTO document_catalog (category, code, label, grade_min, grade_max, section_filter, ana_grup, sort_order, is_active)
SELECT 'subject', 'bilsem_gorsel_sanatlar', 'Görsel Sanatlar', NULL, NULL, NULL, 'GENEL_YETENEK', 3010, true
WHERE NOT EXISTS (SELECT 1 FROM document_catalog WHERE category = 'subject' AND code = 'bilsem_gorsel_sanatlar');
INSERT INTO document_catalog (category, code, label, grade_min, grade_max, section_filter, ana_grup, sort_order, is_active)
SELECT 'subject', 'bilsem_muzik', 'Müzik', NULL, NULL, NULL, 'GENEL_YETENEK', 3011, true
WHERE NOT EXISTS (SELECT 1 FROM document_catalog WHERE category = 'subject' AND code = 'bilsem_muzik');
INSERT INTO document_catalog (category, code, label, grade_min, grade_max, section_filter, ana_grup, sort_order, is_active)
SELECT 'subject', 'bilsem_turk_dili_edebiyati', 'Türk Dili ve Edebiyatı', NULL, NULL, NULL, 'GENEL_YETENEK', 3012, true
WHERE NOT EXISTS (SELECT 1 FROM document_catalog WHERE category = 'subject' AND code = 'bilsem_turk_dili_edebiyati');
INSERT INTO document_catalog (category, code, label, grade_min, grade_max, section_filter, ana_grup, sort_order, is_active)
SELECT 'subject', 'bilsem_biyoloji', 'Biyoloji', NULL, NULL, NULL, 'GENEL_YETENEK', 3013, true
WHERE NOT EXISTS (SELECT 1 FROM document_catalog WHERE category = 'subject' AND code = 'bilsem_biyoloji');
INSERT INTO document_catalog (category, code, label, grade_min, grade_max, section_filter, ana_grup, sort_order, is_active)
SELECT 'subject', 'bilsem_cografya', 'Coğrafya', NULL, NULL, NULL, 'GENEL_YETENEK', 3014, true
WHERE NOT EXISTS (SELECT 1 FROM document_catalog WHERE category = 'subject' AND code = 'bilsem_cografya');
INSERT INTO document_catalog (category, code, label, grade_min, grade_max, section_filter, ana_grup, sort_order, is_active)
SELECT 'subject', 'bilsem_felsefe', 'Felsefe', NULL, NULL, NULL, 'GENEL_YETENEK', 3015, true
WHERE NOT EXISTS (SELECT 1 FROM document_catalog WHERE category = 'subject' AND code = 'bilsem_felsefe');
INSERT INTO document_catalog (category, code, label, grade_min, grade_max, section_filter, ana_grup, sort_order, is_active)
SELECT 'subject', 'bilsem_fizik', 'Fizik', NULL, NULL, NULL, 'GENEL_YETENEK', 3016, true
WHERE NOT EXISTS (SELECT 1 FROM document_catalog WHERE category = 'subject' AND code = 'bilsem_fizik');
INSERT INTO document_catalog (category, code, label, grade_min, grade_max, section_filter, ana_grup, sort_order, is_active)
SELECT 'subject', 'bilsem_kimya', 'Kimya', NULL, NULL, NULL, 'GENEL_YETENEK', 3017, true
WHERE NOT EXISTS (SELECT 1 FROM document_catalog WHERE category = 'subject' AND code = 'bilsem_kimya');
INSERT INTO document_catalog (category, code, label, grade_min, grade_max, section_filter, ana_grup, sort_order, is_active)
SELECT 'subject', 'bilsem_lise_matematik', 'Lise Matematik', NULL, NULL, NULL, 'GENEL_YETENEK', 3018, true
WHERE NOT EXISTS (SELECT 1 FROM document_catalog WHERE category = 'subject' AND code = 'bilsem_lise_matematik');
INSERT INTO document_catalog (category, code, label, grade_min, grade_max, section_filter, ana_grup, sort_order, is_active)
SELECT 'subject', 'bilsem_tarih', 'Tarih', NULL, NULL, NULL, 'GENEL_YETENEK', 3019, true
WHERE NOT EXISTS (SELECT 1 FROM document_catalog WHERE category = 'subject' AND code = 'bilsem_tarih');
INSERT INTO document_catalog (category, code, label, grade_min, grade_max, section_filter, ana_grup, sort_order, is_active)
SELECT 'subject', 'bilsem_resim', 'Resim (Görsel Sanatlar Alanı)', NULL, NULL, NULL, 'RESIM', 3020, true
WHERE NOT EXISTS (SELECT 1 FROM document_catalog WHERE category = 'subject' AND code = 'bilsem_resim');
INSERT INTO document_catalog (category, code, label, grade_min, grade_max, section_filter, ana_grup, sort_order, is_active)
SELECT 'subject', 'bilsem_muzik_alan', 'Müzik (Müzik Alanı)', NULL, NULL, NULL, 'MUZIK', 3021, true
WHERE NOT EXISTS (SELECT 1 FROM document_catalog WHERE category = 'subject' AND code = 'bilsem_muzik_alan');
