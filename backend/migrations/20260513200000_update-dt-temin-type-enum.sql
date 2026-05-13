-- Migration: update-dt-temin-type-enum

-- Güncelle dt_files scope sütununu kaldır, temin_type uzunluğunu artır
ALTER TABLE dt_files 
  ALTER COLUMN temin_type TYPE VARCHAR(20),
  DROP COLUMN scope;

-- Temin type enum: 22a_mal, 22b_hizmet, 22c_yapim, 22d_dig_isler, 22e_danismanlik, 22f_kirala, 22g_isletme
-- Data migration (mevcut verileri koruduğumuz var mı diye) - bu ortamda yeni başlıyoruz olması çok muhtemel
