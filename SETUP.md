# İlk Çalıştırma – Öğretmen Pro

Backend, Web Admin ve Flutter projeleri eklendiğinde bu dosya adım adım doldurulacak. Şu an referans için iskelet.

---

## Ön koşullar

- Node.js (LTS önerilir)
- PostgreSQL (yerel veya Docker; proje kökünde `docker compose up -d`)
- Flutter SDK (mobil için)
- Firebase projesi (Auth + FCM); ENV_EXAMPLE.md’deki değişkenler

---

## 1. Core Backend

**1. Docker Desktop kurun** (henüz yoksa): [https://www.docker.com/products/docker-desktop/](https://www.docker.com/products/docker-desktop/) — kurulumdan sonra bilgisayarı yeniden başlatıp Docker’ın çalıştığından emin olun.

**2. PostgreSQL (Docker ile):**
```bash
# Proje kökünde (ogretmenpro)
docker compose up -d
```
- `backend/.env` içinde `DB_PASSWORD=postgres` olmalı (Docker ile uyumlu; zaten ayarlı).

**3. Backend:**
```bash
cd backend
# .env yoksa: cp .env.example .env  (Docker için .env'de DB_PASSWORD=postgres zaten ayarlı)
npm install
npm run start:dev
```

- **.env:** ENV_EXAMPLE.md / `backend/.env.example` — DB_*, CORS_ORIGINS; Firebase opsiyonel (yerelde Bearer &lt;user-id&gt; ile test edebilirsiniz).
- **4. Test (seed + /me):**
  - Backend çalışırken: `cd backend` → `.\scripts\test-seed-me.ps1`
  - veya elle: `curl -X POST http://localhost:4000/api/seed` → yanıttaki `userId` ile `curl -H "Authorization: Bearer <userId>" http://localhost:4000/api/me`
- Base URL: `http://localhost:4000`; API prefix: `/api` (örn. `/api/me`, `/api/schools`).
- Ayrıntı: `backend/README.md`.

---

## 2. Web Admin (Metronic + Next.js)

```bash
cd web-admin
cp .env.example .env.local
# NEXT_PUBLIC_API_BASE_URL=http://localhost:4000/api
npm install
npm run dev
```

- Tarayıcı: http://localhost:3000. Giriş: Backend seed ile alınan `userId` token olarak (yerel test).
- Metronic: KIT_KAYNAK_YOLLARI.md ve KIT_ENTEGRASYON_KURALLARI.md; `web-admin/README.md`.

---

## 3. Flutter (mobil)

```bash
# Henüz Flutter projesi yok; eklendiğinde örnek:
# flutter pub get
# flutter run --dart-define=API_BASE_URL=http://10.0.2.2:4000/api
```

- Android emulator: `10.0.2.2` = localhost. iOS simulator: `127.0.0.1`.
- `google-services.json` / `GoogleService-Info.plist` Firebase’den alınır; repo’ya commit edilmez (ci için ayrı yöntem).

---

## Sıra önerisi

1. Backend’i ayağa kaldır, `/me` veya health endpoint’i dene.
2. Web Admin’de giriş yap, token’ın backend’e gittiğini doğrula.
3. Flutter’da API base URL’i ayarla, giriş ve bir liste ekranını dene.

---

*Backend ve frontend projeleri eklendikçe bu sayfa güncellenecektir.*
