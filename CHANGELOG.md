# Changelog

Önemli değişiklikler bu dosyada listelenir. Sürüm numarası BRANCH_STRATEGY.md (semver) ile uyumludur.

---

## [Unreleased]

### Eklenen
- Proje dokümanları (CURSOR_SPEC, MODULE_RULES, API_CONTRACT, AUTHORITY_MATRIX, vb.)
- .cursor/rules (ogretmenpro-spec, backend-api-security, web-admin-guards, flutter-mobil, release-and-merge)
- CONTRIBUTING.md, AGENTS.md, SETUP.md, CHANGELOG.md
- .editorconfig, .gitignore taslağı
- **Backend:** İstatistik API (GET /api/stats), kayıt (POST /api/auth/register), şifre unuttum (POST /api/auth/forgot-password), Firebase token (POST /api/auth/firebase-token), profil şifre değiştirme (PATCH /api/me/password)
- **Web-admin:** Kayıt ve şifre unuttum sayfaları; login’de Google/Apple/Telefon girişi (Firebase client); ortak UI bileşenleri (Alert, LoadingSpinner, EmptyState, Skeleton); dashboard hızlı aksiyonlar ve skeleton; sidebar/header UX; erişilebilirlik (içeriğe atla, 403 sayfası)
- **YAPILANLAR.md:** Oturum özeti ve yarın devam noktası

### Değişen
- Teacher rolü: Dashboard ve Profil erişimi; menü ve route guard güncellendi
- Okullar, Kullanıcılar, Duyurular sayfaları Card tabanlı demo1 uyumlu yapıya geçirildi
- Admin layout: geçiş gecikmesi kaldırıldı, main min-height, skip link

---

## Sürüm formatı

- **Eklenen:** Yeni özellik veya doküman.
- **Değişen:** Mevcut davranış/doküman güncellemesi.
- **Kaldırılan:** Kullanımdan kalkan.
- **Düzeltilen:** Hata veya tutarsızlık giderildi.

Release sırasında `[Unreleased]` altındaki maddeler ilgili sürüm altına taşınır (örn. `## [1.0.0] - 2026-xx-xx`).
