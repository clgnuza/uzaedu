# Güncelleme ve bakım (canlı)

## Kod dağıtımı

1. Değişiklikleri `main`'e push edin.
2. `backend/tools/hetzner-deploy.ps1` veya sunucuda `scripts/deploy/server-deploy.sh` / süperadmin deploy paneli.

## Şema (SQL dosyaları)

Yalnızca gerekli dosyaları sunucuda tek tek çalıştırın:

```bash
cd /opt/uzaedu/backend
node tools/run-single-migration.js migrations/<dosya>.sql
```

`npm run migrate:sql` tüm klasörü alfabetik işler; üretimde genelde **kullanmayın** (tekrar/çakışma riski).

## "Güncelleniyor" / bakım ekranı

- **Web:** Süperadmin → Web ayarları → *Web geniş ayarları* → **Bakım modu** açın; `maintenance_message_html` ile metin (ör. "Sistem güncelleniyor…").
- Açıkken ziyaretçiler **`/bakim`** sayfasına yönlendirilir (`web-admin/src/middleware.ts`, `GET /content/web-extras`).
- **Önerilen sıra (uzun deploy):** bakımı aç → deploy/SQL → bakımı kapat.
- **Mobil:** ayrı bayrak `mobile_maintenance_*` (aynı panelde).

## API

PM2 reload sırasında API kısa kesilebilir; bakım modu yalnızca Next (web) trafiğini yönetir.
