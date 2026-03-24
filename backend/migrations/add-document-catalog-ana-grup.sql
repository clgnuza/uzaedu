-- BİLSEM yetenek alanı (ana grup): subject için GENEL_YETENEK, RESIM, MUZIK, DIGERLERI
ALTER TABLE document_catalog ADD COLUMN IF NOT EXISTS ana_grup VARCHAR(32) NULL;
