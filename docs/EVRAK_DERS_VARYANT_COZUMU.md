# Evrak Modülü – Ders Varyantları ve Ders Saati Çözümü

## Sorun

ÖğretmenEvrak benzeri yapıda:
- Aynı dersin alt bölümleri var (örn. Matematik - Maarif M. içinde A.L., F.L., S.B.L.)
- Bu varyantların haftalık ders saati farklı (örn. A.L. 4 saat, F.L. 2 saat)
- Evrak üretirken ve yıllık plan içeriğinde doğru ders saatinin kullanılması gerekiyor

## Çözüm: Ayrı Subject Kayıtları

Her varyant **ayrı bir `document_catalog` subject** olarak tanımlanır:

| Ders | Varyant | Code | Label |
|------|---------|------|-------|
| Matematik | A.L. | `matematik_maarif_al` | Matematik - Maarif M. (A.L.) |
| Matematik | F.L. | `matematik_maarif_fl` | Matematik - Maarif M. (F.L.) |
| Coğrafya | A.L. | `cografya_maarif_al` | Coğrafya - Maarif M. (A.L.) |
| Coğrafya | F.L. | `cografya_maarif_fl` | Coğrafya - Maarif M. (F.L.) |
| Coğrafya | S.B.L. | `cografya_maarif_sbl` | Coğrafya - Maarif M. (S.B.L.) |

### Avantajlar

1. **Ders saati:** `yillik_plan_icerik` tablosunda her `subject_code` için ayrı `ders_saati` tutulabilir.
2. **Merge:** Evrak üretirken seçilen subject_code doğrudan ilgili plan içeriğini ve ders saatini getirir.
3. **MEB import:** TYMM taslak planları varyant bazlı (örn. Coğrafya F.L. Excel) olduğundan, import sırasında `subject_code` eşlemesi yapılabilir.

### UI Görünümü

ÖğretmenEvrak’ta bazı dersler "parent-item" ile gruplanmış (tıklanınca alt liste açılır). Bizim yapıda:
- Tüm varyantlar **düz liste** olarak gösterilebilir (En basit)
- Veya frontend’de aynı etiket prefix’ine göre gruplanabilir (Matematik - Maarif M. altında A.L., F.L.)

## Veri Akışı

```
document_catalog (subject)  →  subject_code
         ↓
yillik_plan_icerik (subject_code, week_order, ders_saati, konu, ...)
         ↓
Evrak merge / Önizleme: subject_code ile doğru plan + ders_saati kullanılır
```

## Yeni Varyant Ekleme

1. `document-catalog.seed.ts` SUBJECTS_SEED’e yeni kayıt ekle (code, label, gradeMin, gradeMax, sectionFilter).
2. `yillik_plan_icerik` için bu subject_code ile plan verisi oluştur (admin CRUD veya MEB import).
3. Seed/migration çalıştır veya Ayarlar → Ders CRUD ile elle ekle.

## Alternatif: parent_code ile Gruplama (ileride)

`document_catalog`’a opsiyonel `parent_code` eklenebilir:
- `matematik_maarif_al` → parent: `matematik_maarif`
- Böylece UI’da "Matematik - Maarif M." başlığı altında A.L., F.L. gösterilebilir.
- Şu an buna gerek yok; düz liste yeterli.

---

*Kaynak: ÖğretmenEvrak örnek sayfası, MEB Maarif Modeli, CURSOR_SPEC.md*
