# Branch ve Sürüm Stratejisi

Git branch kullanımı ve release süreci; hangi kod nerede, nasıl birleşir, geri alma nasıl yapılır.

---

## 1. Ana Branch'ler

| Branch | Amaç | Kim push eder |
|--------|------|----------------|
| **main** (veya **production**) | Canlıda çalışan, kararlı kod. Sadece release sonrası güncellenir. | Yetkili; doğrudan commit yerine merge (PR) tercih edilir. |
| **develop** | Günlük entegrasyon; feature'lar buraya merge edilir. Staging ortamı bu branch'ten deploy alabilir. | Ekip. |

---

## 2. Feature / Fix Branch'leri

- **İsimlendirme:** `feature/kısa-açıklama` veya `fix/kısa-açıklama`  
  Örnek: `feature/nobet-plan-upload`, `fix/inbox-deeplink`, `feature/ek-ders-cache`
- **Nereden açılır:** `develop` (veya büyük özellikler için `main`'den de açılabilir; release branch mantığına göre).
- **Nereye merge:** Önce `develop`; release sırasında `develop` → `main`.
- **Merge sonrası:** Branch silinebilir (silinen branch politikası takım tercihine göre).

---

## 3. Akış Özeti

```
main     ----*--------*----------------*--------  (sadece release'ler)
              \      /                  \
develop        *----*----*----*----*-----*----*----  (günlük entegrasyon)
                    \   / \   /
feature/xxx          *--*   *--*                     (kısa ömürlü)
```

1. Yeni iş: `develop`'dan `feature/xxx` aç.
2. Geliştirme bitince: `feature/xxx` → `develop` (Pull Request + inceleme önerilir).
3. Staging testi: `develop` staging'e deploy.
4. Release: `develop` → `main` (PR + tag); sonra `main` production'a deploy.
5. Hotfix (acil canlı düzeltme): `main`'den `hotfix/xxx` aç → `main` ve `develop`'a merge.

---

## 4. Tag ve Sürüm Numarası

- **Semantic versioning önerisi:** `v1.0.0` (major.minor.patch)
  - **major:** Geriye dönük uyumsuz değişiklik.
  - **minor:** Yeni özellik, geriye dönük uyumlu.
  - **patch:** Hata düzeltmesi.
- **Tag:** Her production release'te `main` üzerinde tag: `v1.0.0`, `v1.1.0`.
- **Changelog:** `CHANGELOG.md` veya release notları; hangi tag'te ne değişti yazılır.

---

## 5. Rollback (Geri Alma)

- **Production’da sorun çıktığında:** Önceki stabil tag’e (örn. `v1.0.0`) dönüp o commit’ten tekrar deploy.
- **main** o tag’e resetlenmez; yeni bir `hotfix/rollback` veya doğrudan önceki tag’in deploy edilmesi yeterli.
- **Veritabanı migrasyonu** geri alınacaksa ayrı migration rollback planı gerekir; bu dokümanın kapsamı kod tarafıdır.

---

## 6. Proje Bazlı Notlar

- **Monorepo mu, ayrı repo mu:** Backend, Web Admin, Flutter ayrı repo ise her biri için aynı branch stratejisi uygulanabilir; release’ler koordine edilir (örn. API v2 çıkınca mobil ve web aynı sürümle uyumlu olmalı).
- **Flutter:** Store’a gönderilen sürüm numarası (version + build number) ile git tag eşleştirilirse hangi build’in hangi koda ait olduğu takip edilir.

---

## 7. Kontrol Listesi (Release Öncesi)

- [ ] `develop` üzerinde tüm planlanan feature’lar merge edilmiş.
- [ ] Smoke test (SMOKE_TEST_CHECKLIST.md) staging’de geçmiş.
- [ ] `develop` → `main` için PR açılmış; inceleme (varsa) tamamlanmış.
- [ ] `main` merge sonrası tag atılmış (örn. `v1.1.0`).
- [ ] Production deploy yapılmış; canlıda smoke kontrolü (en az giriş + kritik 1–2 akış).
- [ ] Changelog / release notları güncellenmiş.

---

*Takım büyüdükçe veya CI/CD eklenince bu strateji otomasyona (örn. PR zorunluluğu, otomatik deploy develop → staging) bağlanabilir.*
