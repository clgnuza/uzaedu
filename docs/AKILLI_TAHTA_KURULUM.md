# Akıllı Tahta / Smartboard Modülü – Kurulum Rehberi

Mevcut NestJS sistemine uygun implementasyon planı. **İki uygulama seviyesi** tanımlı: MVP (basit) ve Tam (agent mimarisi).

---

## 0. İki Uygulama Yaklaşımı

| Özellik | MVP (Basit) | Tam (Agent Mimarisinde) |
|---------|-------------|-------------------------|
| **Kaynak** | CURSOR_SPEC, MODULE_RULES | GPT master prompt notları |
| **Senaryo** | Öğretmen telefondan tahtaya bağlanır; pairing_code + yetkili öğretmen | Tahta üzerinde agent yazılımı; policy, komut kuyruğu, HMAC auth |
| **Cihaz** | Basit pairing (kod ile eşleme) | Pairing token → credential → HMAC ile haberleşme |
| **Policy** | Yok | Kurallar yayınlama, versiyonlama, hash/ETag |
| **Komutlar** | Bağlan / kes | LOCK, REBOOT, PULL_POLICY, LOG_SNAPSHOT |
| **Teacher** | Bağlanma yetkisi | Unlock approve (challenge → permit JWT) |
| **Audit** | Mevcut AuditService | Mevcut + sb_audit_logs (ops.) |

**Not:** Tam mimari, kurumsal cihaz yönetimi (Intune benzeri) için uygundur. MVP, CURSOR_SPEC ile uyumlu basit akış içindir.

---

## 1. Repo Konvansiyonları (Uyum Zorunlu)

Uygulamadan önce mevcut yapı taranmalı:

| Konvansiyon | Değer |
|-------------|-------|
| ORM | **TypeORM** (Prisma yok) |
| Klasör yapısı | `backend/src/<kebab-module>/` (örn. `tv-devices`, `smart-board`) |
| API path | Küçük harf, tire: `/smart-board/*` |
| Entity | snake_case kolonlar, UUID PK |
| Auth | `JwtAuthGuard`, `RolesGuard`, `CurrentUser` |
| Scope | school_admin → `school_id` token'dan; client'tan override yok |
| Validation | `class-validator`, `class-transformer` |
| Audit | `AuditService.log({ action, userId, schoolId, ip, meta })` |
| Rate limit | `ThrottlerModule` (mevcut) |
| Swagger | Projede yok; eklenebilir (ops.) |
| E2E | Projede mevcut e2e yok; eklenebilir |

---

## 2. Veritabanı Şemaları

### 2.1 MVP (Basit) – `smart_board_*` tabloları

`backend/migrations/add-smart-board-tables.sql`:

```sql
CREATE TABLE IF NOT EXISTS smart_board_devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  pairing_code VARCHAR(16) NOT NULL,
  name VARCHAR(128) DEFAULT 'Akıllı Tahta',
  room_or_location VARCHAR(128),
  status VARCHAR(16) DEFAULT 'offline',
  last_seen_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(school_id, pairing_code)
);
CREATE INDEX IF NOT EXISTS idx_smart_board_devices_school ON smart_board_devices(school_id);

CREATE TABLE IF NOT EXISTS smart_board_authorized_teachers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(school_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_smart_board_auth_school ON smart_board_authorized_teachers(school_id);

CREATE TABLE IF NOT EXISTS smart_board_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id UUID NOT NULL REFERENCES smart_board_devices(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  connected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  disconnected_at TIMESTAMPTZ,
  last_heartbeat_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_smart_board_sessions_device ON smart_board_sessions(device_id);
```

---

### 2.2 Tam (Agent) – `sb_*` tabloları

`backend/migrations/add-smartboard-agent-tables.sql`:

```sql
-- sb_devices: Tahta cihazları (agent pair sonrası)
CREATE TABLE IF NOT EXISTS sb_devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  serial VARCHAR(128) NOT NULL,
  hostname VARCHAR(256),
  room VARCHAR(128),
  group_id VARCHAR(64),
  os VARCHAR(64),
  agent_version VARCHAR(32),
  last_seen TIMESTAMPTZ,
  status VARCHAR(16) DEFAULT 'ACTIVE',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(school_id, serial)
);
CREATE INDEX IF NOT EXISTS idx_sb_devices_school ON sb_devices(school_id);
CREATE INDEX IF NOT EXISTS idx_sb_devices_last_seen ON sb_devices(school_id, last_seen DESC);

-- sb_device_credentials: HMAC secret (pair sırasında bir kez dönülür)
CREATE TABLE IF NOT EXISTS sb_device_credentials (
  device_id UUID PRIMARY KEY REFERENCES sb_devices(id) ON DELETE CASCADE,
  secret_hash VARCHAR(255) NOT NULL,
  rotated_at TIMESTAMPTZ DEFAULT NOW()
);

-- sb_pairing_tokens: Tek kullanımlık, 10 dk geçerli
CREATE TABLE IF NOT EXISTS sb_pairing_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  token_hash VARCHAR(255) NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_by_user_id UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_sb_pairing_school_expires ON sb_pairing_tokens(school_id, expires_at);

-- sb_policies: Okul/cihaz kapsamlı kurallar
CREATE TABLE IF NOT EXISTS sb_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  scope VARCHAR(16) NOT NULL,
  scope_id UUID NOT NULL,
  version INT NOT NULL,
  hash VARCHAR(64) NOT NULL,
  rules_json JSONB NOT NULL,
  published_by_user_id UUID REFERENCES users(id),
  published_at TIMESTAMPTZ DEFAULT NOW(),
  reason TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sb_policies_scope ON sb_policies(scope, scope_id, version DESC);

-- sb_policy_applies: Cihazda policy uygulama durumu
CREATE TABLE IF NOT EXISTS sb_policy_applies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id UUID NOT NULL REFERENCES sb_devices(id) ON DELETE CASCADE,
  policy_version INT NOT NULL,
  status VARCHAR(16) NOT NULL,
  applied_at TIMESTAMPTZ DEFAULT NOW(),
  detail_json JSONB
);

-- sb_commands: Komut kuyruğu
CREATE TABLE IF NOT EXISTS sb_commands (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id UUID NOT NULL REFERENCES sb_devices(id) ON DELETE CASCADE,
  type VARCHAR(32) NOT NULL,
  payload_json JSONB,
  status VARCHAR(16) DEFAULT 'PENDING',
  created_by_user_id UUID REFERENCES users(id),
  reason TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_sb_commands_device_status ON sb_commands(device_id, status, created_at DESC);

-- sb_command_acks: Agent ACK kayıtları
CREATE TABLE IF NOT EXISTS sb_command_acks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  command_id UUID NOT NULL REFERENCES sb_commands(id) ON DELETE CASCADE,
  status VARCHAR(16) NOT NULL,
  ack_at TIMESTAMPTZ DEFAULT NOW(),
  detail_json JSONB
);

-- sb_audit_logs: Modüle özel audit (mevcut audit_logs alternatif)
CREATE TABLE IF NOT EXISTS sb_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID,
  actor_user_id UUID,
  actor_role VARCHAR(32),
  action VARCHAR(64) NOT NULL,
  target_type VARCHAR(32),
  target_id UUID,
  reason TEXT,
  ts TIMESTAMPTZ DEFAULT NOW(),
  detail_json JSONB
);
CREATE INDEX IF NOT EXISTS idx_sb_audit_school_ts ON sb_audit_logs(school_id, ts DESC);

-- sb_violations: İhlal kayıtları
CREATE TABLE IF NOT EXISTS sb_violations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  device_id UUID REFERENCES sb_devices(id) ON DELETE SET NULL,
  severity VARCHAR(16) NOT NULL,
  type VARCHAR(64),
  ts TIMESTAMPTZ DEFAULT NOW(),
  detail_json JSONB
);

-- sb_sessions: Teacher unlock oturumları
CREATE TABLE IF NOT EXISTS sb_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id UUID NOT NULL REFERENCES sb_devices(id) ON DELETE CASCADE,
  teacher_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  method VARCHAR(16),
  start_ts TIMESTAMPTZ DEFAULT NOW(),
  end_ts TIMESTAMPTZ
);
```

---

## 3. Modül Yapısı (Tam Agent Mimarisinde)

```
backend/src/smart-board/
├── smart-board.module.ts
├── common/
│   ├── constants.ts
│   ├── types.ts
│   ├── errors.ts
│   └── guards/
│       └── smart-board-school-scope.guard.ts
├── admin/
│   ├── controllers/
│   │   ├── sb-devices.admin.controller.ts
│   │   ├── sb-policies.admin.controller.ts
│   │   ├── sb-pairing.admin.controller.ts
│   │   └── sb-audit.admin.controller.ts
│   └── dto/
├── agent/
│   ├── controllers/
│   │   └── sb-agent.controller.ts
│   ├── dto/
│   └── auth/
│       ├── sb-device-auth.guard.ts
│       └── sb-hmac.util.ts
├── teacher/
│   ├── controllers/
│   │   └── sb-teacher.controller.ts
│   └── dto/
├── services/
│   ├── sb-devices.service.ts
│   ├── sb-policies.service.ts
│   ├── sb-pairing.service.ts
│   ├── sb-commands.service.ts
│   ├── sb-telemetry.service.ts
│   └── sb-audit.service.ts
└── entities/
    ├── sb-device.entity.ts
    ├── sb-device-credential.entity.ts
    ├── sb-pairing-token.entity.ts
    ├── sb-policy.entity.ts
    ├── sb-command.entity.ts
    ├── sb-command-ack.entity.ts
    ├── sb-audit-log.entity.ts
    ├── sb-violation.entity.ts
    └── sb-session.entity.ts
```

**MVP için:** Daha basit yapı (`tv-devices` benzeri): `smart-board.controller.ts`, `smart-board.service.ts`, `entities/`.

---

## 4. Guard ve RBAC

### SmartBoardSchoolScopeGuard
- **SUPERADMIN:** Tüm okullar
- **SCHOOL_ADMIN:** Sadece `req.user.school_id === params.schoolId` (token'dan; override yok)

Mevcut `RolesGuard` ve `@Roles()` ile birlikte kullanılır.

---

## 5. Admin API (JWT Auth)

Tüm path'ler `/smart-board/*` altında. `schoolId` school_admin için **her zaman token'dan**.

| Method | Path | Rol | Açıklama |
|--------|------|-----|----------|
| POST | `/smart-board/schools/:schoolId/pairing-token` | superadmin, school_admin | Pairing token oluştur; 10 dk geçerli, tek kullanım |
| GET | `/smart-board/schools/:schoolId/devices` | superadmin, school_admin | Cihaz listesi (page, pageSize, onlineOnly, room, groupId) |
| GET | `/smart-board/devices/:deviceId` | superadmin, school_admin | Cihaz detay |
| PATCH | `/smart-board/devices/:deviceId` | superadmin, school_admin | room, groupId, status güncelle |
| GET | `/smart-board/schools/:schoolId/policy` | superadmin, school_admin | Son okul policy + version |
| POST | `/smart-board/schools/:schoolId/policy` | superadmin, school_admin | Policy yayınla; **reason zorunlu** |
| POST | `/smart-board/devices/:deviceId/commands` | superadmin, school_admin | Komut gönder (type, payload?, **reason zorunlu**) |
| GET | `/smart-board/schools/:schoolId/audit` | superadmin, school_admin | Audit log listesi |
| GET | `/smart-board/schools/:schoolId/violations` | superadmin, school_admin | İhlal listesi |

**Online tanımı:** `last_seen` son 2 dakika içindeyse.

**Zorunlu reason:** `SMARTBOARD_PUBLISH_POLICY` ve `SMARTBOARD_DEVICE_COMMAND` işlemlerinde body'de `reason` boş string kabul edilmez.

---

## 6. Agent API (HMAC Auth)

### DeviceAuthGuard
Header doğrulama:
- `X-Device-Id`
- `X-Timestamp` (±120 sn; replay için)
- `X-Nonce` (Redis TTL 120 sn veya benzer – Redis yoksa in-memory/DB)
- `X-Body-SHA256`
- `Authorization: DeviceHmac <base64sig>`

**Canonical string:**
```
METHOD \n PATH_WITH_QUERY(sorted) \n TIMESTAMP \n NONCE \n BODY_SHA256 \n content-type \n
```

**Secret:** `sb_device_credentials.secret_hash` ile doğrulama (plaintext secret sadece pair yanıtında bir kez döner).

| Method | Path | Auth | Açıklama |
|--------|------|------|----------|
| POST | `/smart-board/agent/pair` | Public (pairing token ile) | Cihaz eşle; device + credential oluştur |
| POST | `/smart-board/agent/heartbeat` | HMAC | last_seen güncelle |
| GET | `/smart-board/agent/policy` | HMAC | Policy çek; If-None-Match (ETag=hash) desteği |
| POST | `/smart-board/agent/policy-ack` | HMAC | Policy uygulama ACK |
| GET | `/smart-board/agent/commands/pull` | HMAC | Bekleyen komutlar |
| POST | `/smart-board/agent/commands/ack` | HMAC | Komut ACK |
| POST | `/smart-board/agent/log-batch` | HMAC | events, violations batch |

---

## 7. Teacher API (Scaffold)

Flutter UI henüz yok; DTO ve endpoint iskeleti hazır olmalı.

| Method | Path | Rol | Açıklama |
|--------|------|-----|----------|
| POST | `/smart-board/teacher/unlock/approve` | teacher | Body: `{ challengeId }`; yanıt: `{ permitJwt }` |

**permitJwt:** 60 sn geçerli; `deviceId`, `teacherId`, `schoolId`, `exp`, `jti` içerir.

**Challenge storage:** Redis veya geçici tablo (placeholder).

---

## 8. Flutter Kontratları (Shared DTO)

Flutter gelene kadar sadece yapı:

- `ChallengeDTO` – Unlock challenge
- `ApproveUnlockRequestDTO` – `{ challengeId }`
- `PermitJWT` – Kısa ömürlü izin token açıklaması

Swagger tag: `SmartboardTeacher`

---

## 9. Mevcut Audit Entegrasyonu

Mevcut `AuditService` kullanılabilir:

```typescript
await this.auditService.log({
  action: 'SMARTBOARD_CREATE_PAIRING_TOKEN',
  userId: payload.userId,
  schoolId: payload.schoolId,
  meta: { schoolId },
});
await this.auditService.log({
  action: 'SMARTBOARD_PUBLISH_POLICY',
  userId: payload.userId,
  schoolId: payload.schoolId,
  meta: { version, reason },
});
await this.auditService.log({
  action: 'SMARTBOARD_DEVICE_COMMAND',
  userId: payload.userId,
  schoolId: payload.schoolId,
  meta: { deviceId, type, reason },
});
```

İstenirse ek olarak `sb_audit_logs` tablosu kullanılabilir.

---

## 10. enabled_modules Kontrolü

```typescript
function isModuleEnabled(school: { enabled_modules: string[] | null }): boolean {
  const mods = school.enabled_modules;
  return !mods || mods.length === 0 || mods.includes('smart_board');
}
```

Teacher yetkisi: `smart_board_authorized_teachers` (MVP) veya rol/scope (Tam).

---

## 11. Uygulama Sırası (Parça Parça)

### Parça 1: DB + Modül İskeleti + Guards
1. Migration(s) çalıştır (MVP veya Tam)
2. Entity'ler
3. SmartBoardModule, guards
4. app.module.ts'e ekle

### Parça 2: Admin API + Policy/Commands + Audit
1. Admin controller'lar
2. Pairing, devices, policy, commands
3. Audit entegrasyonu
4. Reason zorunluluğu enforce

### Parça 3: Agent API + HMAC + Tests + Docs
1. HMAC util + DeviceAuthGuard
2. Agent controller
3. Teacher approve scaffold
4. E2E test akışı (pairing → pair → heartbeat → policy publish → policy pull/ack → command create → command pull/ack)
5. `docs/smartboard-module.md`

---

## 12. Cursor Master Prompt Öncesi Talimat

Implementasyona başlamadan önce Cursor'a verilecek ek talimat:

> Before implementing, scan the repo for existing patterns: AuthGuard usage, Role enums, school scoping, audit logging, ORM choice, and testing framework. Then implement smartboard module matching those patterns.

---

## 13. Non-Goals (Açıkça Yapılmayacaklar)

- Flutter UI şimdilik yok
- Mevcut login/token akışlarına dokunulmaz
- Ağır OS kilidi (AppLocker/WDAC) yok
- Mikroservis eklenmez; mevcut monolit mimari korunur

---

## 14. Cursor Prompt Referansı

Implementasyon için Cursor'a verilecek prompt metni: **docs/AKILLI_TAHTA_CURSOR_PROMPT.md**

---

## 15. Referanslar

- **CURSOR_SPEC.md** – Modül listesi, spec tablosu
- **MODULE_RULES.md** – Bölüm 11: Akıllı Tahta Kontrol
- **AUTHORITY_MATRIX.md** – `GET/POST /smart-board/...` yetkileri
- **API_CONTRACT.md** – Endpoint dokümantasyonu güncellemesi
- **ERROR_CODES.md** – Yeni hata kodları

---

*GPT notları ile CURSOR_SPEC uyumlu hale getirilmiş; repo konvansiyonlarına göre uyarlanmıştır.*
