# Canlı sunucu (Hetzner / uzaedu) güncelleme akışı

Copilot / tekrar kullanım için özet. **Kod sunucuya yalnızca GitHub `main` üzerinden gider** — yerelde commit edilmemiş değişiklikler canlıda görünmez.

## 1) Yerelde

1. `git status` — neyin gideceğini kontrol et.
2. `git add` / `git commit --trailer "Made-with: Cursor"` — anlamlı mesaj.
3. `git push origin main` — **zorunlu**; sunucu `git pull` ile burayı çeker.
4. `.env` dosyaları repoda yok (`.gitignore`); sırlar push edilmez.

## 2) Sunucu (sabitler)

| | |
|--|--|
| Repo kökü | `/opt/uzaedu` |
| Deploy betiği | `/opt/uzaedu/scripts/deploy/server-deploy.sh` |
| Süreçler | PM2: `uzaedu-api`, `uzaedu-web` |
| DNS | `api.uzaedu.com` → sunucu IPv4 (SSH hedefi: `nslookup api.uzaedu.com` ile A kaydı) |

## 3) SSH ile deploy (Windows / PowerShell)

Varsayılan anahtar: `%USERPROFILE%\.ssh\id_rsa_uzaedu`  
Kullanıcı: `root`.

```powershell
$env:DEPLOY_SSH_HOST = "<api.uzaedu.com'un çözdüğü IP>"
$env:DEPLOY_SSH_KEY  = "$env:USERPROFILE\.ssh\id_rsa_uzaedu"
$key = $env:DEPLOY_SSH_KEY
ssh -i $key -o BatchMode=yes -o StrictHostKeyChecking=accept-new -o ServerAliveInterval=30 `
  root@$($env:DEPLOY_SSH_HOST) "bash /opt/uzaedu/scripts/deploy/server-deploy.sh"
```

Beklenen satır: `[deploy] OK ... sha=<git-kısa-hash> ...`

## 4) Yaygın hata: `ENOTEMPTY` / `backend/dist`

`nest build` bazen eski `dist` alt klasörlerinde takılır. **Betikten önce** (sunucuda):

```bash
rm -rf /opt/uzaedu/backend/dist /opt/uzaedu/web-admin/.next
bash /opt/uzaedu/scripts/deploy/server-deploy.sh
```

## 5) Alternatif: Süper admin paneli

Canlı `backend/.env`: `DEPLOY_ENABLED=true`, `DEPLOY_SECRET`, `DEPLOY_SCRIPT_PATH` (yukarıdaki betik).  
Panel: “Sunucuyu güncelle” → `POST /api/deploy` (şifre + isteğe bağlı `DEPLOY_HEADER_TOKEN`).

## 6) Doğrulama

- Deploy çıktısı: `sha=` ile GitHub `main` son commit ile uyumlu olmalı.
- `GET https://api.uzaedu.com/api/health/deployment` — `git` (varsa `DEPLOY_GIT_SHA`).

## 7) Veri tabanı

`deploy-local-to-prod.ps1` SQL taşır; kod deploy’u değildir. Ayrıntı: `DEPLOY-LOCAL-TO-PROD.txt`.
