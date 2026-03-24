# Test Raporu – Öğretmen Pro

**Tarih:** 2026-02-09  
**Ortam:** Windows, Docker (PostgreSQL), Backend (NestJS), Web Admin (Next.js)

---

## Backend API Testleri

| # | Endpoint | Beklenen | Sonuç |
|---|----------|----------|--------|
| 1 | GET /api/health | 200, status: ok | ✅ |
| 2 | POST /api/seed | 200, userId + message | ✅ (mevcut kullanıcı döndü) |
| 3 | GET /api/me (Bearer) | 200, profil | ✅ |
| 4 | GET /api/schools | 200, sayfalı liste | ✅ |
| 5 | GET /api/users | 200, sayfalı liste | ✅ |
| 6 | GET /api/announcements (superadmin) | 403 Forbidden | ✅ (rol kuralı) |
| 7 | POST /api/schools | 201, yeni okul | ✅ |
| 8 | GET /api/schools (2 okul) | total: 2 | ✅ |
| 9 | PATCH /api/me | 200, display_name güncellendi | ✅ |
| 10 | GET /api/me (güncel) | display_name güncel | ✅ |
| 11 | GET /api/schools/:id | 200, okul detayı | ✅ |
| 12 | GET /api/me (tokensız) | 401 Unauthorized | ✅ |

---

## Script Testi

- `.\scripts\test-seed-me.ps1` — ✅ OK (seed + /me)

---

## Web Admin

- `npm run build` — ✅ Derlendi (/, /login, /dashboard)

---

## Özet

- Backend PostgreSQL ile çalışıyor; scope ve roller (superadmin, 403/401) doğru.
- Web Admin build başarılı.
- Test token (yerel): `440c123c-499e-4644-899e-6e9257252e52`
