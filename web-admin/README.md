# Öğretmen Pro – Web Admin

Next.js (App Router). Backend: `NEXT_PUBLIC_API_BASE_URL`. Auth: ileride Firebase; şu an yerel test için Bearer token (user id) localStorage'da.

## Çalıştırma

```bash
cp .env.example .env.local
# NEXT_PUBLIC_API_BASE_URL=http://localhost:4000/api
npm install
npm run dev
```

Tarayıcı: http://localhost:3000 → login. Yerel test: Backend `POST /api/seed` ile dönen `userId` değerini token olarak girin; dashboard'da GET /api/me ile profil görünür.

## Metronic entegrasyonu

- Kit kaynağı: **KIT_KAYNAK_YOLLARI.md** (örn. `C:\UzaMobil\hazirkit\metronic`).
- Kurallar: **KIT_ENTEGRASYON_KURALLARI.md** — layout/bileşenler kit'ten alınır; API, auth, rol, route guard **proje kodunda** kalır.
- Menü ve route: **AUTHORITY_MATRIX.md** "Web Admin – Route Erişimi" tablosuna göre; her sayfa için `allowedRoles` ve route guard zorunlu.

## Yapı

- `src/lib/api.ts` — Tek API client; base URL .env'den.
- `src/app/login` — Giriş (token placeholder).
- `src/app/dashboard` — Dashboard; /me ile profil.
- İleride: Metronic layout, Okullar/Duyurular/Nöbet menüleri, route guard rol kontrolü.
