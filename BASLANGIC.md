# Nereden Başlamalıyım? – Öğretmen Pro

MVP’ye göre önerilen başlangıç sırası ve ilk adımlar.

---

## 1. Hangi sırayla? (Omurga önce)

Spec’e göre **önce omurga**, sonra modüller:

| Aşama | İçerik | Neden önce? |
|-------|--------|--------------|
| **1. Omurga (1–2 ay)** | A + B + C | Kimlik ve scope olmadan hiçbir modül güvenli çalışmaz; bildirim ve duyuru tüm modüllere bağlanır. |
| 2 | E + F (Evrak, Ek ders) | Değer üreten modüller |
| 3 | G + D (Kazanım, Market) | |
| 4 | H (Nöbet) | P1 |
| 5 | Stabilizasyon, yayın | |

**Yani başlangıç noktası:** **A (Kimlik) → B (Bildirim) → C (Duyuru/Haber)**.

---

## 2. Somut başlangıç adımları

### Adım 1: Backend iskeleti

- `backend/` klasöründe Core Backend projesini oluştur (NestJS, Laravel vb. tercihinize göre).
- Veritabanı: PostgreSQL. Migrations ile şema (CORE_ENTITIES.md’deki User, School, Role mantığı).
- `.env` taslağı: ENV_EXAMPLE.md’ye göre (DB, JWT, Firebase, WP, CORS). SETUP.md’yi güncelle.

### Adım 2: Kimlik ve scope (A)

- **User, School** tabloları; rol: `superadmin | school_admin | teacher`.
- **Auth:** Firebase ID token doğrulama veya backend JWT. Her istekte token’dan `user_id`, `role`, `school_id` (teacher/admin için) çıkar.
- **Scope kuralı:** school_admin için tüm sorgular `school_id` ile filtrelenir (token’dan); teacher için `user_id`. Client’tan gelen school_id/user_id **kullanılmaz**.
- **İlk endpoint’ler:** `GET /me`, `GET /schools` (superadmin), `GET /users` (superadmin / school_admin kendi okulu). API_CONTRACT ve AUTHORITY_MATRIX’e uy.

### Adım 3: Bildirim altyapısı (B)

- **Event üretimi:** Kritik işlem sonrası event (örn. `announcement.created`). NOTIFICATION_MATRIX’e göre hangi olayın kime gideceği.
- **Inbox:** Notification tablosu; `GET /notifications`, `PATCH .../read`, `PATCH .../read-all`. Sayfalama.
- **Push:** FCM entegrasyonu; payload’da `event_type`, `entity_id`, `target_screen`, `title`, `body`.
- **Tercihler:** NotificationPreference (tür bazlı push aç/kapa).

### Adım 4: Duyuru ve haber (C)

- **Okul duyurusu (Announcement):** school_admin oluşturur; hedef okul. Yayınlanınca event + Inbox + (önemliyse) push. `GET/POST /announcements`, `GET /announcements/:id`, `PATCH .../read`.
- **WP genel haber:** Backend’de WP API’den feed; `GET /news` (sayfalı). Mobilde “web’de aç”.
- **WP sınav görevi:** `GET /exam-duties`, `GET /exam-duties/:id`; event + push + inbox kuralları NOTIFICATION_MATRIX’e göre.

Bu dört adım bittiğinde **omurga** ayakta olur; sonra E, F, G, D modüllerine geçebilirsin.

---

## 3. Web Admin ve Flutter ne zaman?

- **Web Admin:** Backend’de `/me`, `/schools`, `/users` ve (isteğe bağlı) `/announcements` çalışır hale gelince Metronic iskeletini açıp login + route guard + bu endpoint’lere bağlamak mantıklı. KIT_ENTEGRASYON_KURALLARI’na uy.
- **Flutter:** Omurga (en azından auth + Inbox + okul duyuruları) hazır olduktan sonra; ilk ekranlar giriş, Inbox, “Okulum” duyuru listesi. NOTIFICATION_MATRIX’teki `target_screen` ile deep link bağlanır.

Yani: **Önce backend omurga (A→B→C), sonra Web Admin iskeleti, ardından Flutter iskeleti** en mantıklı sıra.

---

## 4. İlk gün kontrol listesi

- [ ] Backend projesi `backend/` altında oluşturuldu
- [ ] .env taslağı (ENV_EXAMPLE) kopyalandı, DB/Firebase placeholder’lar doldurulacak
- [ ] User, School (ve gerekirse Role) için migration
- [ ] Token doğrulama (Firebase veya JWT) ve `user_id` / `role` / `school_id` çıkarma
- [ ] `GET /me` çalışıyor ve scope kuralı dokümante (AUTHORITY_MATRIX ile uyumlu)
- [ ] API_CONTRACT.md’de yaptığın endpoint’ler işaretli / güncel

Bu rehber MVP_SCOPE.md ve CURSOR_SPEC.md ile uyumludur. Detay için MODULE_RULES.md (modül bazlı kurallar) ve CONTRIBUTING.md (ilk PR, commit, branch) kullan.
