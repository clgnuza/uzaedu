# Ortam ve Konfigürasyon Taslağı (.env Örnekleri)

Hassas değerler (gerçek key, şifre) bu dosyada **asla** commit edilmez. Her ortam (local, staging, production) için ayrı değerler kullanılır.

---

## 1. Core Backend (NestJS / Laravel vb.)

Proje kökünde `.env` veya `backend/.env`; aşağıdaki örnek `.env.example` olarak tutulur.

```env
# Ortam
APP_ENV=local
APP_DEBUG=true
APP_URL=http://localhost:3000

# Veritabanı (PostgreSQL)
DB_CONNECTION=pgsql
DB_HOST=127.0.0.1
DB_PORT=5432
DB_DATABASE=ogretmenpro
DB_USERNAME=
DB_PASSWORD=

# Firebase Admin SDK (push + auth doğrulama)
FIREBASE_PROJECT_ID=
FIREBASE_CLIENT_EMAIL=
FIREBASE_PRIVATE_KEY=
# veya tek satırda JSON key dosya yolu:
# GOOGLE_APPLICATION_CREDENTIALS=./firebase-admin-key.json

# JWT / oturum (backend kendi token üretiyorsa)
JWT_SECRET=
JWT_EXPIRE=86400

# WordPress (içerik kaynağı)
WP_BASE_URL=https://example.com
WP_API_PATH=/wp-json
WP_AUTH_USER=
WP_AUTH_PASSWORD=

# CORS (Web Admin ve mobil için izin verilen origin)
CORS_ORIGINS=http://localhost:3001,https://admin.ogretmenpro.com

# Rate limit (opsiyonel)
RATE_LIMIT_PER_MINUTE=100

# Log
LOG_LEVEL=debug
```

**Not:** Staging ve production'da `APP_DEBUG=false`, `APP_ENV=staging` veya `production`. Production'da ayrı DB ve ayrı Firebase projesi önerilir.

---

## 2. Web Admin (Next.js + Metronic)

Proje kökünde `.env.local` (gitignore'da olmalı). Örnek `.env.example`:

```env
# API (Core Backend)
NEXT_PUBLIC_API_BASE_URL=http://localhost:4000/api
# Staging: https://api-staging.ogretmenpro.com
# Production: https://api.ogretmenpro.com

# Firebase (client tarafı; admin panel girişi Firebase Auth kullanıyorsa)
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=
```

---

## 3. Flutter (Mobil)

Flutter'da hassas değerler `--dart-define` veya config dosyası ile verilir. Örnek: `lib/config/env.dart` (şablon; gerçek değerler commit edilmez) veya `flutter_dotenv` ile `.env`:

```env
# API (Core Backend)
API_BASE_URL=http://10.0.2.2:4000/api
# Android emulator: 10.0.2.2 = localhost
# iOS simulator: 127.0.0.1
# Canlı: https://api.ogretmenpro.com

# Firebase (Flutter Firebase plugin ile; google-services.json / GoogleService-Info.plist ayrıca eklenir)
# Bu dosyada sadece opsiyonel override'lar (örn. farklı proje) tutulabilir.
```

**Flutter'da ortam seçimi örneği:**
- `flutter run --dart-define=API_BASE_URL=http://localhost:4000/api`
- veya `flavors`: dev, staging, prod için ayrı `main_*.dart` ve config.

---

## 4. Ortamlar Özeti

| Ortam | Amaç | Backend URL (örnek) | DB | Firebase |
|-------|------|---------------------|-----|----------|
| local | Geliştirme | http://localhost:4000 | Yerel PostgreSQL | Geliştirme projesi |
| staging | Test / QA | https://api-staging.ogretmenpro.com | Staging DB | Staging projesi |
| production | Canlı | https://api.ogretmenpro.com | Prod DB | Prod projesi |

- Her ortamda **ayrı** Firebase projesi kullanmak (en azından staging ≠ production) önerilir; böylece test push'ları canlı kullanıcılara gitmez.
- `.env`, `.env.local`, `*.env` (hassas içeren) dosyaları `.gitignore`'da olmalı; sadece `.env.example` veya bu dokümandaki gibi şablonlar repo'da tutulur.

---

## 5. Kontrol Listesi

- [ ] Backend `.env.example` repo'da var; geliştirici kopyalayıp `.env` yapıyor
- [ ] Web Admin için `NEXT_PUBLIC_*` dışında secret tutulmuyor (client'ta açığa çıkar)
- [ ] Flutter'da API URL ortama göre (dev/staging/prod) seçiliyor
- [ ] Staging ve production için ayrı DB + ayrı Firebase projesi tanımlı
- [ ] Hassas dosyalar `.gitignore`'da

---

*Implementasyon sırasında proje yapısına göre dosya adları (örn. `backend/.env.example`) güncellenebilir.*
