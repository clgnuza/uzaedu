# Akıllı Tahta – Cursor Master Prompt

Bu dosya, modülü implement etmek için Cursor'a verilebilecek master prompt metnidir. Tek seferde veya 3 parçada kullanılabilir.

---

## Ön Talimat (Her Zaman Ekle)

```
Before implementing, scan the repo for existing patterns: AuthGuard usage, Role enums, school scoping, audit logging, ORM choice, and testing framework. Then implement smartboard module matching those patterns.
```

---

## Master Prompt (Tam Metin)

```
Context:
We have a working NestJS system with SuperAdmin, SchoolAdmin, Teacher roles and authentication. JWT includes school_id. Add a NEW MODULE Smartboard (interactive board lock/agent management) without touching existing auth. Flutter mobile app later; for now create only API contracts/DTOs and scaffolding.

High-level goals:
- Add /smart-board module: admin endpoints, agent endpoints, teacher approve scaffold
- Reuse existing auth/roles and school scoping (school_id from token, no override)
- New DB tables with prefix sb_ (do NOT modify users/schools)
- RBAC + school scoping
- Device auth for agent: HMAC canonical signature + timestamp/nonce replay protection
- Policy publish + versioning + hash/ETag
- Command queue with agent pull/ack
- Audit logging (integrate with existing AuditService; action types: SMARTBOARD_CREATE_PAIRING_TOKEN, SMARTBOARD_PUBLISH_POLICY, SMARTBOARD_DEVICE_COMMAND)
- class-validator DTOs, structured errors

Non-goals:
- No Flutter UI now
- No login/token flow changes
- No microservices

Implementation:
- ORM: TypeORM (repo uses it)
- Folder: backend/src/smart-board/ (kebab-case, like tv-devices)
- API path: /smart-board/*
- Tables: sb_devices, sb_device_credentials, sb_pairing_tokens, sb_policies, sb_policy_applies, sb_commands, sb_command_acks, sb_audit_logs, sb_violations, sb_sessions
- Reason MANDATORY: SMARTBOARD_PUBLISH_POLICY and SMARTBOARD_DEVICE_COMMAND must require reason in body (non-empty string)
- Use JwtAuthGuard, RolesGuard, CurrentUser; scope school_admin by token school_id
```

---

## Parça 1: DB + Modül İskeleti + Guards

```
Implement Part 1 of Smartboard module:
1. Run migration for sb_* tables (see docs/AKILLI_TAHTA_KURULUM.md section 2.2)
2. Create entities in backend/src/smart-board/entities/
3. Create SmartBoardModule, wire into AppModule
4. Implement SmartBoardSchoolScopeGuard (SUPERADMIN: all, SCHOOL_ADMIN: token.school_id === params.schoolId)
5. Use existing RolesGuard, JwtAuthGuard, CurrentUser
```

---

## Parça 2: Admin API + Policy/Commands + Audit

```
Implement Part 2 of Smartboard module:
1. Admin controllers: pairing-token, devices CRUD, policy get/publish, commands, audit, violations
2. All under /smart-board/schools/:schoolId/... or /smart-board/devices/:deviceId/...
3. POST policy: require reason in body
4. POST commands: require reason in body
5. Integrate with existing AuditService.log() for actions
6. Online = last_seen within 2 minutes
```

---

## Parça 3: Agent API + HMAC + Teacher Scaffold + Docs

```
Implement Part 3 of Smartboard module:
1. Agent auth: DeviceAuthGuard with HMAC, X-Timestamp (±120s), X-Nonce (replay protection; use in-memory Map if no Redis)
2. Agent endpoints: pair, heartbeat, policy (GET with If-None-Match), policy-ack, commands/pull, commands/ack, log-batch
3. Teacher: POST /smart-board/teacher/unlock/approve with { challengeId } → { permitJwt }; scaffold only
4. Create docs/smartboard-module.md: API overview, HMAC rules, policy schema, operational notes
5. Add e2e test flow if repo has test setup: pairing → agent pair → heartbeat → policy publish → policy pull/ack → command create → command pull/ack
```

---

## Flutter Kontrat (Şimdilik Sadece Yapı)

```
For Flutter (later): Add to shared DTO area or document in Swagger:
- ChallengeDTO
- ApproveUnlockRequestDTO: { challengeId }
- PermitJWT: short-lived (60s), deviceId, teacherId, schoolId, exp, jti
Swagger tag: SmartboardTeacher
```

---

## Zorunlu Kural (Koda Enforce Et)

```
SMARTBOARD_PUBLISH_POLICY ve SMARTBOARD_DEVICE_COMMAND işlemlerinde request body'de reason zorunlu (boş string kabul edilmez). DTO'da @IsNotEmpty() veya benzeri ile doğrula.
```
