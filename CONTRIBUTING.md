# Katkıda Bulunma – Öğretmen Pro

Yeni geliştirici veya ilk PR öncesi kısa rehber.

---

## İlk adımlar

1. **Spec’i oku:** [CURSOR_SPEC.md](CURSOR_SPEC.md) ve [MODULE_RULES.md](MODULE_RULES.md). Roller (superadmin / school_admin / teacher) ve scope (user_id / school_id) burada.
2. **Terminoloji:** [GLOSSARY.md](GLOSSARY.md) – kod ve API’de tutarlı isim kullanımı.
3. **Yetki:** [AUTHORITY_MATRIX.md](AUTHORITY_MATRIX.md) – kim hangi endpoint’e ve sayfaya erişir.
4. **Cursor kuralları:** `.cursor/rules/` – Cursor açıkken ilgili kural dosyaları otomatik devreye girer; [README.md](README.md)#cursor-kuralları.

---

## Geliştirme sırasında

- **API değişikliği:** Yeni veya değişen endpoint → [API_CONTRACT.md](API_CONTRACT.md) ve [AUTHORITY_MATRIX.md](AUTHORITY_MATRIX.md) güncellenir.
- **Yeni hata kodu:** [ERROR_CODES.md](ERROR_CODES.md) listesine eklenir; Türkçe `message` verilir.
- **Yeni bildirim / deep link:** [NOTIFICATION_MATRIX.md](NOTIFICATION_MATRIX.md) (event_type, target_screen) güncellenir.
- **Scope:** school_admin için `school_id` yalnızca backend’de token’dan alınır; client’tan override kabul edilmez. Teacher başka öğretmen verisi görmez.

---

## Commit ve PR

- **Commit mesajı:** Kısa ve anlamlı. Örn. `feat: duyuru okundu işaretleme`, `fix: school_id scope kontrolü`, `config: 2026-1 yarıyıl parametreleri`.
- **Branch:** [BRANCH_STRATEGY.md](BRANCH_STRATEGY.md) – feature branch’ler develop’dan açılır.
- **Release öncesi:** [SMOKE_TEST_CHECKLIST.md](SMOKE_TEST_CHECKLIST.md) ile kritik akışlar çalıştırılır.

---

## Soru veya belirsizlik

Önce CURSOR_SPEC ve MODULE_RULES’a bakın; yoksa ekip veya proje sahibiyle netleştirin.
