# Hetzner / canlı sunucu (localhost ile aynı sözleşme)

- **API:** Nest `setGlobalPrefix('api')` → taban `https://api.uzaedu.com/api` (yerelde `http://localhost:4000/api`).
- **Web-admin build:** `NEXT_PUBLIC_API_BASE_URL`, `NEXT_PUBLIC_SITE_URL` — `scripts/deploy/server-deploy.sh` ve `build-and-pm2.sh` her build öncesi `web-admin/.env.production` yazar (değişkenler aşağıda).
- **Nginx:** Tam kurulum için repodaki `infra/nginx/uzaedu.conf` (HTTP→HTTPS, kök + admin + api). İlk bootstrap yalnızca HTTP proxy; certbot sonrası bu dosyayı kullanın.
- **Zamanlayıcılar:** Sınav görevi sync / bildirimleri Nest içinde (`@nestjs/schedule`). Ayrıca `cron` veya systemd timer gerekmez; PM2 ile çalışan API süreci yeterli. Tarih/saat mantığı kodda `Europe/Istanbul`.

## Ortam değişkenleri (canlı build)

İsteğe bağlı export (varsayılanlar uzaedu):

```bash
export DOMAIN_API=api.uzaedu.com
export DOMAIN_ADMIN=admin.uzaedu.com
```

`server-deploy.sh` ve `build-and-pm2.sh` şunu yazar:

```
NEXT_PUBLIC_API_BASE_URL=https://${DOMAIN_API}/api
NEXT_PUBLIC_SITE_URL=https://${DOMAIN_ADMIN}
```

## Akış

1. **İlk kurulum (root):** `bash scripts/hetzner/bootstrap.sh` — UFW, Node 20, PostgreSQL, repo `/opt/uzaedu`, `backend/.env` (TRUST_PROXY, JWT, DB). `OPENAI_API_KEY` opsiyonel (Optik / sınav görevi GPT — panel `app_config` da kullanılabilir).
2. **İlk build:** `INSTALL_DIR=/opt/uzaedu bash scripts/hetzner/build-and-pm2.sh` — `npm ci` + build, PM2. `NODE_ENV=production` yalnızca build sonrası.
3. **Günlük güncelleme:** `bash scripts/deploy/server-deploy.sh` — `git pull`, `npm ci`, build (web-admin `.env.production` dahil), `pm2 restart`. İsteğe bağlı `MIGRATE_ON_DEPLOY=1`.
4. **Veri:** `backend/tools/DEPLOY-LOCAL-TO-PROD.txt` (veya repodaki ilgili doküman).