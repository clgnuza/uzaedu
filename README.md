# Öğretmen Pro – Proje Dokümanları

Bu klasör, projeye başlamadan önce hataları azaltmak ve Cursor/Copilot ile tutarlı geliştirme yapmak için kullanılan referans dokümanlarını içerir.

---

## Ürün ve Kapsam

| Dosya | İçerik |
|-------|--------|
| **CURSOR_SPEC.md** | Amaç, roller, SSOT, event-first, modül listesi, web/mobil kurallar, Cursor çalışma kuralı |
| **MODULE_RULES.md** | Modül bazlı detaylı kurallar (16 modül): amaç, roller, kurallar, kabul kriterleri |
| **MVP_SCOPE.md** | P0/P1/P2 kapsam listesi, 6 aylık geliştirme sırası |

---

## Yetki ve API

| Dosya | İçerik |
|-------|--------|
| **AUTHORITY_MATRIX.md** | Kim ne yapabilir: modül × rol × işlem, API endpoint erişimi, web route, mobil modül görünürlüğü |
| **API_CONTRACT.md** | Backend–Frontend sözleşmesi: endpoint listesi, sayfalama, hata formatı, request/response örnekleri |
| **ERROR_CODES.md** | Hata kodları, HTTP status, kullanıcı mesajları (Türkçe), client davranışı |

---

## Bildirim ve Veri

| Dosya | İçerik |
|-------|--------|
| **NOTIFICATION_MATRIX.md** | Olay → Inbox/Push, hedef kitle, push payload standardı, deep link (target_screen) listesi |
| **CORE_ENTITIES.md** | Core Backend entity'leri: User, School, Announcement, Duty, Wallet, Entitlement, vb. ve ilişkiler |

---

## Ortak Referanslar

| Dosya | İçerik |
|-------|--------|
| **GLOSSARY.md** | Terminoloji sözlüğü: Türkçe–kod eşlemesi (duyuru, nöbet, jeton, entitlement, vb.) |
| **ENV_EXAMPLE.md** | Ortam ve konfig: Backend, Web Admin, Flutter için .env taslakları; local/staging/production |

---

## Kit Entegrasyonu

| Dosya | İçerik |
|-------|--------|
| **KIT_KAYNAK_YOLLARI.md** | Orijinal kit klasörleri (Metronic + FlutKit); Cursor bu yollardan sadece gerekeni alır |
| **KIT_ENTEGRASYON_KURALLARI.md** | Metronic + FlutKit için zorunlu kurallar: klasör, API/auth, tema, deep link, yapılmayacaklar, güncelleme |
| **KIT_KULLANIM_REHBERI.md** | Kit'leri nasıl kullanacağınız (adımlar, Cursor referansları) |

## Kalite ve Süreç

| Dosya | İçerik |
|-------|--------|
| **SMOKE_TEST_CHECKLIST.md** | Her release öncesi kritik akış kontrol listesi |
| **BRANCH_STRATEGY.md** | main / develop / feature branch, tag, release, rollback |
| **CONTRIBUTING.md** | Yeni geliştirici ve ilk PR rehberi: spec, API güncellemesi, commit, branch |
| **AGENTS.md** | Cursor/çoklu agent: hangi bağlam backend / web-admin / Flutter için geçerli, hangi kurallar |
| **SETUP.md** | İlk çalıştırma: Backend, Web Admin, Flutter adımları (proje eklendikçe doldurulur) |
| **CHANGELOG.md** | Sürüm bazlı değişiklik listesi; release sırasında güncellenir |
| **SECURITY.md** | Gizlilik, scope, CORS, log; güvenlik açığı bildirimi |

---

## Cursor kuralları

Projede `.cursor/rules/` altında Cursor/AI için kurallar tanımlıdır; projeye başlamadan ve geliştirme sırasında tutarlılık ve hata azaltımı için kullanılır.

| Kural dosyası | Ne zaman |
|---------------|---------|
| **ogretmenpro-spec.mdc** | Her zaman (spec referansı, SSOT, scope, yapılmayacaklar) |
| **release-and-merge.mdc** | Her zaman (branch, smoke test, commit) |
| **backend-api-security.mdc** | Backend (`backend/**/*.ts`) üzerinde çalışırken |
| **web-admin-guards.mdc** | Web Admin (Metronic) üzerinde çalışırken |
| **flutter-mobil.mdc** | Flutter (`**/*.dart`) üzerinde çalışırken |

---

## Kullanım

- **Projeye ilk kez başlıyorsanız:** [BASLANGIC.md](BASLANGIC.md) – nereden başlanır, omurga sırası, ilk adımlar.
- Geliştirme sırasında belirsizlik olunca önce **CURSOR_SPEC** ve **MODULE_RULES**’a bakın.
- API tasarlarken **API_CONTRACT** ve **AUTHORITY_MATRIX**; bildirim tasarlarken **NOTIFICATION_MATRIX** kullanın.
- İsimlendirme için **GLOSSARY**; veri modeli için **CORE_ENTITIES** referans alın.
- Release öncesi **SMOKE_TEST_CHECKLIST** ve **BRANCH_STRATEGY** ile süreci takip edin.
