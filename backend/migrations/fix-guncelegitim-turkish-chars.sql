-- Türkçe karakter düzeltmesi (encoding bağımsız, Unicode escape kullanır)
-- Çalıştırma: docker exec -i ogretmenpro-db psql -U postgres -d ogretmenpro -f - < backend/migrations/fix-guncelegitim-turkish-chars.sql
-- veya: Get-Content -Encoding UTF8 ... | docker exec -i ogretmenpro-db env PGCLIENTENCODING=UTF8 psql ...

UPDATE exam_duty_sync_sources
SET
  label = E'G\u00FCncel E\u011Fitim (Agregat\u00F6r)',
  title_keywords = E's\u0131nav,g\u00F6rev,g\u00F6zetmen,ba\u015Fvuru,\u00D6SYM,MEB,A\u00D6F,LGS,a\u00E7\u0131k \u00F6\u011Fretim'
WHERE key = 'exam_duty_guncelegitim';
