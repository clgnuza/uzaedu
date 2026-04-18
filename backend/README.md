# Uzaedu Öğretmen – Core Backend

NestJS + TypeORM + PostgreSQL. API sözleşmesi: proje kökündeki `API_CONTRACT.md` ve `AUTHORITY_MATRIX.md`.

## Hızlı başlangıç

1. **Ortam:** `cp .env.example .env` — PostgreSQL ve (opsiyonel) Firebase bilgilerini doldur.
2. **Veritabanı:** PostgreSQL’de `ogretmenpro` veritabanını oluştur.
3. **Bağımlılıklar:** `npm install`
4. **Çalıştırma:** `npm run start:dev`
5. **İlk kullanıcı (yerel):**  
   `POST http://localhost:4000/api/seed`  
   Yanıttaki `userId` ile:  
   `Authorization: Bearer <userId>`  
   sonra `GET http://localhost:4000/api/me`  
   Otomatik test: `.\scripts\test-seed-me.ps1` (PowerShell) veya `sh scripts/test-seed-me.sh`

## Endpoint’ler

### A – Kimlik

| Method | Path | Açıklama | Auth |
|--------|------|----------|------|
| GET | /api/health | Sağlık kontrolü | Hayır |
| POST | /api/seed | İlk kullanıcı + okul (sadece local) | Hayır |
| GET | /api/me | Giriş yapan kullanıcı | Bearer |
| PATCH | /api/me | Kendi profil | Bearer |
| GET | /api/schools | Okul listesi (sayfalı) | superadmin, school_admin |
| POST | /api/schools | Okul oluştur | superadmin |
| GET | /api/schools/:id | Okul detay | superadmin, school_admin (kendi) |
| PATCH | /api/schools/:id | Okul güncelle | superadmin |
| GET | /api/users | Kullanıcı listesi | superadmin, school_admin |
| POST | /api/users | Kullanıcı oluştur | superadmin, school_admin |
| GET | /api/users/:id | Kullanıcı detay | Rol + scope |
| PATCH | /api/users/:id | Kullanıcı güncelle | superadmin, school_admin (scope) |

### B – Bildirim (Inbox)
| Method | Path | Açıklama | Auth |
|--------|------|----------|------|
| GET | /api/notifications | Inbox listesi (sayfalı, event_type filtresi) | teacher |
| PATCH | /api/notifications/:id/read | Okundu işaretle | teacher |
| PATCH | /api/notifications/read-all | Hepsini okundu yap | teacher |
| GET | /api/notification-preferences | Tercihler | teacher |
| PATCH | /api/notification-preferences | Tercih güncelle | teacher |

### C – Okul Duyuruları
| Method | Path | Açıklama | Auth |
|--------|------|----------|------|
| GET | /api/announcements | Duyuru listesi (scope: okul) | teacher, school_admin |
| POST | /api/announcements | Duyuru oluştur | school_admin |
| GET | /api/announcements/:id | Duyuru detay | teacher, school_admin |
| PATCH | /api/announcements/:id/read | Okundu işaretle | teacher |

## Auth

- **Production:** Firebase ID token — header: `Authorization: Bearer <firebase-id-token>`. Kullanıcıların `firebase_uid` alanı Firebase UID ile eşleşmeli.
- **Yerel (Firebase yok):** `Authorization: Bearer <user-uuid>` — sadece `APP_ENV=local` ve seed sonrası dönen user id.

## Proje yapısı

- `src/config/` — env, Firebase init
- `src/common/` — filter (hata formatı), guard (auth, roles), decorator (CurrentUser, Roles), pagination
- `src/auth/` — Firebase strategy, AuthGuard
- `src/me/` — GET/PATCH /me
- `src/users/` — User entity, CRUD, scope
- `src/schools/` — School entity, CRUD, scope
- `src/seed/` — Yerel ilk kullanıcı + okul
- `src/health/` — Health check

Sonraki aşamalar: Duyuru yayınlanınca event + Inbox kaydı (NOTIFICATION_MATRIX); WP haber/sınav görevi feed’leri.
