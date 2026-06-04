# Cloudflare — uzaedu.com

Site zaten turuncu bulut (proxy) arkasında. `/_next/static` ve `.css/.js` gibi dosyalar çoğu zaman `cf-cache-status: HIT` döner.

## Otomatik (API)

1. [API token](https://dash.cloudflare.com/profile/api-tokens) → şablon *Edit zone cache* veya özel: Zone Read + Cache Rules Edit.
2. PowerShell:

```powershell
$env:CLOUDFLARE_API_TOKEN = "<token>"
Set-Location c:\UzaMobil\ogretmenpro
.\infra\cloudflare\apply-static-cache-rules.ps1
```

## Manuel (panel)

**Caching → Cache Rules → Create rule**

| Sıra | If | Then |
|------|-----|------|
| 1 | Hostname equals `api.uzaedu.com` | Bypass cache |
| 2 | URI Path starts with `/_next/static/` | Eligible for cache, Edge TTL 1 month |
| 3 | URI Path extension is one of `css`, `js`, `mjs`, `png`, … | Eligible for cache, Edge TTL 1 month |

HTML (`/`, `/moduller`) **cache’lenmesin** — oturum ve ISR ile karışır.

**Web Analytics:** CF panelde otomatik snippet **kapalı**; token `NEXT_PUBLIC_CF_WEB_ANALYTICS_TOKEN` ile layout’ta yüklenir.
