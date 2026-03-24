# İletişim ve Destek Modülü – Tasarım ve Kurulum Notu

Bu doküman, Öğretmen Pro platformuna "İletişim ve Destek" modülünün eklenmesi için ön analiz ve önerilen mimariyi içerir.

**→ Tam uygulama spesifikasyonu:** `docs/DESTEK_TICKET_SPEC.md` (PRD + DB/API/UI/RBAC, Cursor prompt dahil)

---

## 1. Proje Özeti

| Bileşen | Teknoloji | Konum |
|---------|-----------|-------|
| Backend | NestJS, TypeORM, PostgreSQL | `backend/src/` |
| Web Admin | Next.js, Metronic/Mosaic | `web-admin/` |
| Mobil | Flutter | (varsa) |
| Veri Kaynağı | Core Backend DB (SSOT) | — |

**Modül ekleme kuralları:** `.cursor/rules/backend-module-addition.mdc`  
**Yetki matrisi:** `AUTHORITY_MATRIX.md`  
**API sözleşmesi:** `API_CONTRACT.md`

---

## 2. Mevcut İlgili Özellikler

- **MODULE_RULES.md §17 (Ayarlar & Uygulama Sağlığı):** "sorun bildir" – Teacher’ın sorun bildirimi (henüz detay belirsiz).
- **admin-messages:** Sistem mesajı gönderimi (superadmin → okullar); mevcut modül.
- **notifications (Inbox):** Uygulama içi bildirim; event-first mimari.
- **announcements:** Okul duyuruları; chat/yorum yok.

---

## 3. İletişim ve Destek Modülü Kapsam Önerisi

### 3.1 Amaç

- Kullanıcıların (teacher, school_admin) platformla ilgili soru, öneri ve sorun bildirmesi.
- Superadmin/destek ekibinin talepleri listelemesi, yanıtlaması ve takip etmesi.

### 3.2 Önerilen Özellikler (MVP)

| Özellik | Açıklama | Rol |
|---------|----------|-----|
| Destek talebi oluşturma | Konu, kategori, mesaj, varsa ek dosya | teacher, school_admin |
| Talep listesi | Kendi taleplerim (filtre: durum, kategori) | teacher, school_admin |
| Talep detayı | Mesaj geçmişi, yanıt ekleme | teacher, school_admin |
| Destek paneli | Tüm talepler, filtre, atama, yanıt | superadmin, moderator |
| Kategori yönetimi | Talep kategorileri (opsiyonel) | superadmin |

### 3.3 Veri Modeli (Öneri)

```
support_ticket
  - id (UUID)
  - user_id (FK → users)
  - school_id (FK → schools, nullable; school_admin için dolu)
  - category (enum: genel, teknik, evrak, nobet, diger)
  - subject (string)
  - status (enum: open, in_progress, answered, closed)
  - created_at, updated_at

support_ticket_message
  - id (UUID)
  - ticket_id (FK → support_ticket)
  - user_id (FK → users; yazan kişi)
  - body (text)
  - is_staff_reply (boolean; destek ekibi yanıtı mı)
  - created_at
```

### 3.4 API Endpoint Önerileri

| Method | Path | Açıklama | Rol |
|--------|------|----------|-----|
| GET | `/support/tickets` | Taleplerim listesi | teacher, school_admin |
| POST | `/support/tickets` | Yeni talep oluştur | teacher, school_admin |
| GET | `/support/tickets/:id` | Talep detay + mesajlar | teacher, school_admin (kendi), superadmin |
| PATCH | `/support/tickets/:id` | Durum güncelle (örn. kapandı) | teacher, school_admin (kendi) |
| POST | `/support/tickets/:id/messages` | Mesaj ekle (yanıt) | teacher, school_admin (kendi), superadmin |
| GET | `/support/tickets` (admin) | Tüm talepler (filtre: status, category, school_id) | superadmin, moderator |
| PATCH | `/support/tickets/:id` (admin) | Durum/atama güncelle | superadmin, moderator |

**Scope:**

- **teacher:** Sadece kendi talepleri (`user_id` token’dan).
- **school_admin:** Kendi okulundaki kullanıcıların talepleri veya sadece kendi talepleri (tercih: önce kendi talepleri).
- **superadmin / moderator:** Tüm talepler.

---

## 4. Okul Bazlı Modül Açma (Opsiyonel)

- `school.enabled_modules` JSONB’ye `support` eklenebilir.
- Bu durumda teacher/school_admin için modül okulda açıksa erişilebilir.

---

## 5. Uygulama Adımları (backend-module-addition.mdc ile uyumlu)

1. **Migration:**  
   `backend/migrations/add-support-tables.sql`  
   - `support_ticket`, `support_ticket_message` tabloları  
   - `CREATE INDEX` (user_id, status), (school_id, created_at)

2. **Entities:**  
   `backend/src/support/entities/`  
   - `support-ticket.entity.ts`, `support-ticket-message.entity.ts`

3. **Module:**  
   `backend/src/support/support.module.ts`

4. **Service + Controller:**  
   - `SupportService`: CRUD, scope kontrolü, mesaj ekleme  
   - `SupportController`: teacher/school_admin endpoint’leri  
   - `SupportAdminController` (ops.): superadmin/moderator endpoint’leri

5. **app.module.ts:** SupportModule import

6. **Dokümanlar:**  
   - `API_CONTRACT.md` – endpoint tablosu  
   - `AUTHORITY_MATRIX.md` – modül + rol matrisi  
   - `MODULE_RULES.md` – modül kuralları bölümü

7. **Web-admin:**  
   - Menü: İletişim & Destek / Destek Taleplerim  
   - Sayfa: `/support`, `/support/[id]`  
   - `config/menu.ts`, `ROUTE_ROLES`, `ROUTE_MODULES` güncellemesi

8. **Moderator:**  
   - `moderator_modules`: `support` eklenirse moderator destek panelini kullanabilir.

---

## 6. Event ve Bildirim (Opsiyonel)

- Yeni talep → superadmin/moderator’a Inbox özeti (`support.ticket.created`).
- Yanıt geldi → talep sahibine Inbox + push (`support.ticket.replied`).

---

## 7. Kullanıcı Deneyimi Notları

- **Teacher:** Ayarlar > Sorun Bildir ile aynı akışa bağlanabilir veya tek “Destek Talepleri” ekranı sunulabilir.
- **School_admin:** Hem kendi talepleri hem (opsiyonel) okul öğretmenlerinin taleplerini görebilir.
- **Superadmin:** Tüm talepleri filtreleyip yanıtlayabilir; kategori/okul bazlı raporlama.

---

## 8. Alternatif Kapsamlar

| Kapsam | Açıklama |
|--------|----------|
| **Minimal** | Sadece “sorun bildir” formu → e-posta veya basit tablo kaydı; yanıt e-posta ile |
| **Orta (önerilen)** | Ticket + mesaj geçmişi, web-admin paneli |
| **Geniş** | + Kategori CRUD, SLA, atama, FAQ, chatbot entegrasyonu |

---

## 9. Sonraki Adımlar

1. Kapsam onayı: Minimal / Orta / Geniş  
2. Okul bazlı modül açma: Evet / Hayır  
3. Moderator erişimi: Evet / Hayır  
4. Migration ve entity’lerle backend geliştirme  
5. Web-admin sayfaları ve menü entegrasyonu

---

*Bu doküman Cursor/Agent tarafından oluşturulmuştur. Modül geliştirirken bu özet ve `backend-module-addition.mdc` kurallarına uyulmalıdır.*
