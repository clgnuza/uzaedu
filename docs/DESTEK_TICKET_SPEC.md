# Destek/Talep (Ticket) Sistemi – Tam Spec (PRD + Teknik Tasarım)

Bu doküman, Öğretmen Pro platformuna eklenecek Destek/Ticket sisteminin **ürün gereksinimlerini (PRD)** ve **teknik tasarımını (DB/API/UI/RBAC)** tanımlar. Cursor’a veya kod ekibine “bu spes’e göre uçtan uca geliştir” denerek doğrudan implementasyona geçilebilir.

**Referans:** `docs/ILETISIM_DESTEK_MODULU.md` (önceki özet), `AUTHORITY_MATRIX.md`, `API_CONTRACT.md`, `.cursor/rules/backend-module-addition.mdc`

---

## 0) Amaç ve kapsam

Okul yönetim web uygulaması içinde çalışan bir Destek/Talep (Ticket) Sistemi:

- **Öğretmenler ve okul yöneticileri:** Okul içi destek talebi açma, takip etme
- **Platform ekibi (superadmin):** Platform desteği kuyruğunu yönetme
- **Öncelik:** Kullanım kolaylığı, hızlı işlem, tek destek personeli ile yönetilebilir inbox deneyimi

---

## 1) Rol eşlemesi (Spec → Proje)

Spec’teki roller Öğretmen Pro’daki mevcut rollere şöyle map edilir:

| Spec rolü | Proje rolü | Not |
|-----------|------------|-----|
| TEACHER | `teacher` | Aynı |
| SCHOOL_ADMIN | `school_admin` | Aynı |
| SCHOOL_SUPERADMIN | `school_admin` | Projede ayrı rol yok; okul admin aynı yetkileri kullanır |
| MODERATOR | `moderator` | `moderator_modules` ile sınırlı (support eklenir) |
| PLATFORM_SUPERADMIN | `superadmin` | Aynı |

**Sonuç:** `teacher`, `school_admin`, `moderator`, `superadmin` kullanılır. `school_admin` hem SCHOOL_ADMIN hem SCHOOL_SUPERADMIN yetkilerine sahiptir.

---

## 2) Ticket hedefi (target_type) ve kuyruk kuralları

| target_type | Açıklama | Kim açar? | Kim görür/yönetir? |
|-------------|----------|-----------|---------------------|
| **SCHOOL_SUPPORT** | Okul içi destek | teacher, school_admin | school_admin, moderator (kendi okulu) |
| **PLATFORM_SUPPORT** | Platform desteği | school_admin | superadmin |

**Kurallar:**

- Öğretmen **sadece** `SCHOOL_SUPPORT` açar; platforma direkt ticket açamaz.
- Okul admin hem okul içi hem `PLATFORM_SUPPORT` açabilir.
- Okul admin/superadmin okul içi ticket’ı **eskalasyon** ile platforma taşıyabilir.

---

## 3) Yetki matrisi (RBAC özeti)

| İşlem | teacher | school_admin | moderator (support) | superadmin |
|-------|---------|--------------|---------------------|------------|
| Ticket açma (SCHOOL_SUPPORT) | ✅ (sadece kendi okulu) | ✅ | — | — |
| Ticket açma (PLATFORM_SUPPORT) | ❌ | ✅ | ❌ | ✅ |
| Listeleme: kendi ticketları | ✅ | ✅ | — | — |
| Listeleme: okul ticketları (SCHOOL_SUPPORT) | ❌ | ✅ | ✅ | ✅ (read-only ops.) |
| Listeleme: platform ticketları (PLATFORM_SUPPORT) | ❌ | ✅ (kendi okulu) | ❌ | ✅ |
| Mesaj yazma (PUBLIC) | Kendi ticketlarında | Okul ticketlarında | Okul ticketlarında | Tüm ticketlarda |
| Mesaj yazma (INTERNAL_NOTE) | ❌ | ✅ | ✅ | ✅ |
| Durum değiştirme | (ops.) Resolved işaretleyebilir | ✅ | ✅ | ✅ |
| Atama yapma | ❌ | ✅ (admin/moderator’a) | (ops.) Kendine | ✅ |
| Eskalasyon | ❌ | ✅ | ❌ | — |
| Modül CRUD | ❌ | ❌ | ❌ | ✅ |

---

## 4) Veri modeli (tablolar)

### 4.1 `ticket_modules`

Modül yönetimi (superadmin). Sorunun ilgili olduğu modül.

```sql
CREATE TABLE IF NOT EXISTS ticket_modules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(64) NOT NULL,
  icon_key VARCHAR(32) DEFAULT 'help-circle',
  target_availability VARCHAR(24) NOT NULL CHECK (target_availability IN ('SCHOOL_ONLY', 'PLATFORM_ONLY', 'BOTH')),
  is_active BOOLEAN DEFAULT true,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Seed (örnek modüller):** genel, evrak, nöbet, akıllı-tahta, duyuru-tv, optik, market, diger

### 4.2 `tickets`

```sql
CREATE TABLE IF NOT EXISTS tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_number VARCHAR(32) NOT NULL UNIQUE,
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  target_type VARCHAR(24) NOT NULL CHECK (target_type IN ('SCHOOL_SUPPORT', 'PLATFORM_SUPPORT')),
  module_id UUID NOT NULL REFERENCES ticket_modules(id),
  issue_type VARCHAR(24) NOT NULL CHECK (issue_type IN ('BUG', 'QUESTION', 'REQUEST', 'IMPROVEMENT')),
  priority VARCHAR(16) NOT NULL DEFAULT 'MEDIUM' CHECK (priority IN ('LOW', 'MEDIUM', 'HIGH', 'URGENT')),
  status VARCHAR(24) NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'IN_PROGRESS', 'WAITING_REQUESTER', 'RESOLVED', 'CLOSED')),
  subject VARCHAR(512) NOT NULL,
  requester_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_by_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  assigned_to_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  last_activity_at TIMESTAMPTZ DEFAULT NOW(),
  resolved_at TIMESTAMPTZ,
  closed_at TIMESTAMPTZ,
  escalated_from_ticket_id UUID REFERENCES tickets(id) ON DELETE SET NULL,
  escalated_to_ticket_id UUID REFERENCES tickets(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tickets_school_target_status ON tickets(school_id, target_type, status, last_activity_at DESC);
CREATE INDEX IF NOT EXISTS idx_tickets_assigned ON tickets(assigned_to_user_id, status) WHERE assigned_to_user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tickets_requester ON tickets(requester_user_id, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_tickets_number ON tickets(ticket_number);

COMMENT ON TABLE tickets IS 'Destek talepleri – okul içi ve platform kuyrukları';
```

### 4.3 `ticket_messages`

```sql
CREATE TABLE IF NOT EXISTS ticket_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  author_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  message_type VARCHAR(24) NOT NULL CHECK (message_type IN ('PUBLIC', 'INTERNAL_NOTE')),
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ticket_messages_ticket ON ticket_messages(ticket_id, created_at ASC);
```

### 4.4 `ticket_attachments`

```sql
CREATE TABLE IF NOT EXISTS ticket_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_message_id UUID NOT NULL REFERENCES ticket_messages(id) ON DELETE CASCADE,
  storage_key VARCHAR(512) NOT NULL,
  filename VARCHAR(256) NOT NULL,
  mime_type VARCHAR(64) NOT NULL,
  size_bytes INT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ticket_attachments_message ON ticket_attachments(ticket_message_id);
```

### 4.5 `ticket_events` (audit)

```sql
CREATE TABLE IF NOT EXISTS ticket_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  actor_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  event_type VARCHAR(48) NOT NULL,
  payload_json JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ticket_events_ticket ON ticket_events(ticket_id, created_at DESC);
```

**event_type örnekleri:** `status_changed`, `assigned`, `escalated`, `priority_changed`, `module_changed`, `message_added`

---

## 5) ticket_number formatı

`TCK-{YEAR}-{SEQ}` (örn. TCK-2026-000001)

- Yıl + sıra numarası (platform genelinde tekil)
- Backend: yıl için `EXTRACT(YEAR FROM NOW())`, sıra için `MAX(ticket_number)` parse veya ayrı sequence tablosu

---

## 6) Mesaj tipleri ve görünürlük

| message_type | Görünürlük |
|--------------|------------|
| **PUBLIC** | Requester + tüm yetkili destek rollerine açık |
| **INTERNAL_NOTE** | Sadece destek rollerine (school_admin, moderator, superadmin). Requester asla görmez |

---

## 7) Durum akışı ve iş kuralları

| Durum | Açıklama |
|-------|----------|
| **OPEN** | Yeni açıldı |
| **IN_PROGRESS** | Destek işleme aldı |
| **WAITING_REQUESTER** | Kullanıcıdan bilgi bekleniyor |
| **RESOLVED** | Çözüm verildi |
| **CLOSED** | Kapatıldı (opsiyonel: 7 gün sessizlik sonrası otomatik) |

**Kurallar:**

- `WAITING_REQUESTER` iken requester mesaj yazarsa → otomatik `IN_PROGRESS`
- `RESOLVED` iken requester mesaj yazarsa → otomatik `IN_PROGRESS` (reopen)
- `CLOSED` ticket’a mesaj yazılırsa → engelle veya otomatik reopen (tercih: reopen)
- Public mesaj eklenince `last_activity_at` güncellenir

---

## 8) Atama kuralları

| target_type | Varsayılan atama |
|-------------|------------------|
| SCHOOL_SUPPORT | school_admin (okulun ilk admin’i veya rastgele biri) |
| PLATFORM_SUPPORT | superadmin (tek kişi; ileride queue/round-robin) |

---

## 9) Eskalasyon (okul → platform)

**Tercih: Clone + Link**

1. Okul ticket’ı `SCHOOL_SUPPORT` olarak kalır
2. Yeni `PLATFORM_SUPPORT` ticket oluşturulur
3. `escalated_from_ticket_id` (platform ticket) = okul ticket id
4. `escalated_to_ticket_id` (okul ticket) = platform ticket id
5. Platform ticket’a otomatik “Eskalasyon özeti” mesajı eklenir (önceki mesajlar + kritik bilgiler)

---

## 10) API taslağı (REST)

Tüm endpoint’ler JwtAuthGuard + RolesGuard + scope ile korunacak.

### 10.1 Ticket

| Method | Path | Body/Query | Rol | Açıklama |
|--------|------|------------|-----|----------|
| POST | `/tickets` | target_type, module_id, issue_type, priority, subject, description, attachment_keys[] | teacher, school_admin | Yeni ticket (teacher sadece SCHOOL_SUPPORT) |
| GET | `/tickets` | target_type?, status?, module_id?, priority?, assigned_to?, school_id?, q?, page, limit | teacher, school_admin, moderator, superadmin | Liste (scope’a göre filtrelenir) |
| GET | `/tickets/:id` | — | role+scope | Detay + mesajlar (INTERNAL_NOTE requester’a gösterilmez) |
| PATCH | `/tickets/:id` | status?, assigned_to_user_id?, priority?, module_id? | role+scope | Güncelle (yetkiye göre) |
| POST | `/tickets/:id/escalate` | reason (zorunlu), extra_info? | school_admin | Eskalasyon → platform ticket |

### 10.2 Mesajlar

| Method | Path | Body | Rol | Açıklama |
|--------|------|------|-----|----------|
| POST | `/tickets/:id/messages` | message_type, body, attachment_keys[] | role+scope | Mesaj ekle |
| GET | `/tickets/:id/messages` | page, limit | role+scope | Mesaj listesi (requester için INTERNAL_NOTE filtrelenir) |

### 10.3 Modüller

| Method | Path | Rol | Açıklama |
|--------|------|-----|----------|
| GET | `/ticket-modules` | teacher, school_admin, moderator, superadmin | Modül listesi (target_availability’a göre filtrelenebilir) |
| POST | `/ticket-modules` | superadmin | Modül oluştur |
| PATCH | `/ticket-modules/:id` | superadmin | Modül güncelle |

### 10.4 Dosya yükleme

- `POST /upload/presign` mevcut; `purpose` listesine `ticket_attachment` eklenir
- İzin: `image/*`, `application/pdf`, `application/vnd.openxmlformats-*` (docx, xlsx)
- Max size: app_config’ten (örn. 10 MB)
- Presign sonrası frontend `attachment_keys[]` ile ticket/message oluştururken gönderir; backend `ticket_attachments` tablosuna kaydeder

---

## 11) Bildirimler (Inbox)

`NotificationsService.createInboxEntry` kullanılır.

| Olay | event_type | Hedef | title/body |
|------|------------|-------|------------|
| Yeni ticket (okul kuyruğu) | `support.ticket.created` | Okul admin(ler) | "Yeni destek talebi: {subject}" |
| Platforma eskale | `support.ticket.escalated` | superadmin | "Okul X'den platforma eskale edildi" |
| Public mesaj (destek yanıtı) | `support.ticket.replied` | requester | "Talebinize yanıt verildi" |
| Atandım | `support.ticket.assigned` | assigned_to | "Size yeni destek talebi atandı" |

**target_screen:** `support/tickets/{id}` veya `support/{id}`

---

## 12) UI/UX ekranları (Web-admin)

### 12.1 Öğretmen

| Sayfa | Yol | İçerik |
|-------|-----|--------|
| Taleplerim | `/support` | Liste: subject, status badge, modül, last_activity_at. "Yeni Talep" CTA |
| Yeni Talep | Modal veya `/support/new` | Modül (ikonlu grid), sorun tipi, öncelik, konu, açıklama, dosya |
| Detay | `/support/[id]` | Chat akışı, mesaj yazma + dosya, durum görüntüleme (ops. "Çözüldü" işaretle) |

### 12.2 Okul Admin / Moderator

| Sayfa | Yol | İçerik |
|-------|-----|--------|
| Okul Destek Inbox | `/support/inbox` | Sol: filtreler (Atanmamış, Benim, Open, Waiting vb.). Orta: konuşma. Sağ: metadata (status, atama, öncelik). Aksiyonlar: durum, ata, iç not, eskale et |
| Platforma Eskale Et | Modal | Sebep/özet (zorunlu), ek bilgi |

### 12.3 Superadmin (Platform Destek)

| Sayfa | Yol | İçerik |
|-------|-----|--------|
| Platform Support Inbox | `/support/platform` | Sıralama: Unassigned > last_activity. Filtre: okul, modül, durum, öncelik. 3 kolon: liste | konuşma | metadata+aksiyonlar |

### 12.4 Tasarım notları

- Inbox: email client gibi (sol liste, orta konuşma, sağ metadata)
- Modül seçimi: ikonlu grid veya aramalı dropdown
- Status/priority badge’leri sade
- Aksiyonlar sağ panelde gruplanmış

---

## 13) Migration dosyası

`backend/migrations/add-ticket-support-tables.sql` oluşturulacak; yukarıdaki CREATE TABLE + INDEX + seed (ticket_modules) içerecek.

---

## 14) Backend modül yapısı

```
backend/src/
  tickets/                          # veya support/
    tickets.module.ts
    tickets.service.ts
    tickets.controller.ts            # teacher, school_admin, moderator
    tickets-platform.controller.ts  # superadmin (ops. ayrı)
    ticket-modules.controller.ts
    entities/
      ticket.entity.ts
      ticket-message.entity.ts
      ticket-attachment.entity.ts
      ticket-event.entity.ts
      ticket-module.entity.ts
    dto/
      create-ticket.dto.ts
      update-ticket.dto.ts
      create-ticket-message.dto.ts
      list-tickets.dto.ts
```

---

## 15) Menü ve route (config/menu.ts)

| Menü başlığı | path | allowedRoles | requiredModule (moderator) |
|--------------|------|--------------|----------------------------|
| Destek Taleplerim | `/support` | teacher, school_admin | — |
| Okul Destek Inbox | `/support/inbox` | school_admin, moderator | support |
| Platform Destek | `/support/platform` | superadmin | — |

`ROUTE_ROLES`, `ROUTE_SCHOOL_MODULES` (support okul modülü ise), `ROUTE_MODULES` (support) güncellenir.

---

## 16) Moderator modülü

`MODERATOR_MODULES` ve `ModeratorModuleKey` type’a `'support'` eklenir.

---

## 17) Okul bazlı modül (opsiyonel)

`school.enabled_modules` JSONB’ye `support` eklenebilir. Teacher/school_admin için modül okulda açıksa erişilebilir.

---

## 18) Kabul kriterleri (Acceptance Criteria)

- [ ] Öğretmen 2 dakikadan kısa sürede yeni ticket açabilmeli
- [ ] Öğretmen yalnızca kendi ticketlarını görmeli (IDOR test)
- [ ] Okul admin kendi okulundaki tüm ticketları görebilmeli, moderator’e atayabilmeli
- [ ] Eskalasyon: platform inbox’ta yeni ticket, karşılıklı link
- [ ] Platform superadmin tüm platform ticketlarını filtreleyip yönetebilmeli
- [ ] Public mesaj → last_activity_at güncellenmeli
- [ ] Internal note öğretmene asla görünmemeli
- [ ] Dosya ekleri güvenli (whitelist, limit), sadece yetkililer indirebilmeli

---

## 19) Uygulama sırası (MVP)

1. DB migration + tablolar + ticket_modules seed
2. Entities + DTO + tickets module
3. RBAC: ticket read/write policy, scope kontrolü
4. Ticket create/list/detail API
5. Message thread + attachment (presign + confirm)
6. Okul inbox UI (2 kolon) + platform inbox UI (3 kolon)
7. Assignment + status update + audit events
8. Eskalasyon (clone+link) + modal
9. Inbox bildirimleri (createInboxEntry)
10. QA: scope, IDOR, rol testleri

---

## 20) ERROR_CODES eklemeleri

| code | message |
|------|---------|
| TICKET_NOT_FOUND | İstediğiniz talep bulunamadı. |
| TICKET_SCOPE_VIOLATION | Bu talebe erişim yetkiniz yok. |
| TICKET_TARGET_FORBIDDEN | Öğretmenler yalnızca okul içi destek talebi açabilir. |
| TICKET_ESCALATION_REASON_REQUIRED | Eskalasyon sebebi zorunludur. |
| TICKET_ALREADY_CLOSED | Bu talep kapatılmış. |

---

---

## 21) Cursor’a verilecek prompt (kopyala-yapıştır)

```
docs/DESTEK_TICKET_SPEC.md dosyasındaki Destek/Ticket sistemi spesifikasyonuna göre uçtan uca geliştirme yap:

1. Migration: backend/migrations/add-ticket-support-tables.sql zaten var; gerekirse düzelt.
2. Backend: backend/src/tickets/ modülü – entities, DTO, service, controller(s). RBAC ve scope kurallarına uy.
3. Upload: purpose listesine ticket_attachment ekle (upload.controller PresignDto).
4. Notifications: support.ticket.created, support.ticket.replied, support.ticket.escalated, support.ticket.assigned için createInboxEntry.
5. API_CONTRACT.md, AUTHORITY_MATRIX.md, ERROR_CODES.md, MODERATOR_MODULES güncelle.
6. Web-admin: /support, /support/inbox, /support/platform sayfaları; config/menu.ts, ROUTE_ROLES, ROUTE_MODULES.
7. UI: Inbox email-client tarzı (sol liste, orta konuşma, sağ metadata).

Proje kuralları: .cursor/rules/backend-module-addition.mdc, web-admin-guards.mdc.
```

---

*Bu spec Cursor’a veya kod ekibine verilerek uçtan uca implementasyon yapılabilir. Proje kuralları: `backend-module-addition.mdc`, `API_CONTRACT.md`, `AUTHORITY_MATRIX.md` güncellenecektir.*
