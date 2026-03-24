# Evrak Üretim ve Kullanıcıya Sunma Yolu

## 1. Mevcut Durum

| Bileşen | Durum | Açıklama |
|---------|--------|----------|
| `document_templates` | ✅ | Şablon CRUD, filtre (type, grade, section, subject, school_type) |
| `document_catalog` | ✅ | Evrak türleri, okul türleri, bölümler, dersler (ÖğretmenEvrak tam başlıklar) |
| GET /document-templates | ✅ | Filtrelenmiş liste |
| GET /document-templates/:id/download | ✅ | Signed URL ile indirme |
| /evrak (web-admin) | ✅ | Wizard: Planlar / Zümre / Diğer → filtre → liste → indir |
| Entitlement (evrak_uretim) | 🔲 | İleride jeton/hak kontrolü eklenecek |

**Şu anki akış:** Admin şablon ekler → Öğretmen katalogdan seçer (tür, sınıf, ders vb.) → Eşleşen şablonları listeler → İndir.

---

## 2. İki Ana Yol

ÖğretmenEvrak’ta olduğu gibi iki farklı evrak sunumu var:

### 2.1 Statik İndirme (Hazır Şablon)

```
Kullanıcı: Filtreleri seçer (plan türü, sınıf, ders)
    → Sistem: Eşleşen şablonları listeler
    → Kullanıcı: "İndir" tıklar
    → Backend: R2’den signed URL döner
    → Dosya indirilir (değişiklik yok)
```

**Uygun evraklar:** Yıllık plan, günlük plan, zümre tutanağı (hazır), egzersiz planı, İYEP/BEP modül şablonları, iş takvimi, belirli gün ve haftalar.

**Durum:** ✅ Mevcut, çalışıyor.

---

### 2.2 Dinamik Üretim (Form + Merge)

```
Kullanıcı: Şablonu seçer
    → Sistem: Form gösterir (sinif, ders_adi, tarih, ek_metin vb.)
    → Profil verileri otomatik doldurulur (ad, okul, müdür, öğretim yılı)
    → Kullanıcı: Eksik alanları doldurur, "Üret" tıklar
    → Backend: docxtemplater ile Word’te {{placeholder}} doldurur
    → Geçici URL üretilir, kullanıcı indirir
```

**Uygun evraklar:** Dilekçe, veli toplantı tutanağı, aday öğretmen dosyası, rehberlik raporu, özelleştirilebilir zümre metinleri.

**Durum:** 🔲 Henüz yok. `requiresMerge`, `mergeFields`, `formSchema` + `POST /documents/generate` gerekiyor.

---

## 3. Önerilen Fazlı Yol

### Faz 1 – MVP (Mevcut, Genişlet)

- [ ] **Katalog zenginleştirme:** Mevcut `document_catalog` seed’i ÖğretmenEvrak’a göre tamamlandı.
- [ ] **Flutter / mobil:** `/evrak` benzeri ekran; katalog tabanlı filtre → liste → indirme.
- [ ] **Entitlement (ops.):** İndirme öncesi `evrak_uretim` hakkı kontrolü; yoksa markete yönlendirme.

### Faz 2 – Form + Merge (Evrak Hazırlama)

- [ ] **Entity:** `DocumentTemplate`’e `requiresMerge`, `mergeFields`, `formSchema` (JSON) alanları.
- [ ] **Backend:** `docxtemplater` (veya `docx-templates`) ile Word merge.
- [ ] **Profil otomatik doldurma:** User + School → `{{ogretmen_adi}}`, `{{okul_adi}}`, `{{mudur_adi}}`, `{{ogretim_yili}}`.
- [ ] **API:** `POST /documents/generate` → `{ template_id, form_data, format }` → `{ download_url, expires_at }`.
- [ ] **School.principalName:** Müdür adı için (zümre, tutanak, dilekçe).
- [ ] **UI:** Form ekranı; merge gerektiren şablonlarda "Üret" butonu.

### Faz 3 – Genişletme

- [ ] Ek evraklar: performans proje formları, sınav analizleri, şök tutanakları.
- [ ] Üretilen evrak arşivi (ops.): Kullanıcı bazlı geçmiş.
- [ ] PDF çıktı seçeneği (Word’ten dönüşüm).

---

## 4. Merge Placeholder Standardı

Word şablonlarında kullanılacak placeholder’lar:

```
{{ogretmen_adi}}
{{okul_adi}}
{{mudur_adi}}
{{il}}
{{ilce}}
{{ogretim_yili}}
{{sinif}}
{{ders_adi}}
{{hafta}}
{{tarih}}
{{ek_metin}}
```

**Profil kaynakları:**

| Placeholder | Kaynak |
|-------------|--------|
| ogretmen_adi | User.display_name |
| okul_adi | School.name |
| mudur_adi | School.principalName (eklenecek) |
| il, ilce | School.city, School.district |
| ogretim_yili | Config veya tarihten hesaplanan (2024-2025) |
| sinif, ders_adi, hafta, tarih, ek_metin | Form’dan (form_data) |

---

## 5. Kısa Özet

| Aşama | Ne | Ne Zaman |
|-------|-----|----------|
| Şu an | Statik indirme | ✅ Çalışıyor |
| Kısa vade | Mobil / web-admin evrak ekranı, entitlement | Faz 1 |
| Orta vade | Form + merge, dilekçe/tutanak üretimi | Faz 2 |
| Uzun vade | Geniş evrak envanteri, arşiv | Faz 3 |

Detaylı entegrasyon: `EVRAK_ENTEGRASYON_ANALIZ.md`, plan yapısı: `EVRAK_PLANLAR_ANALIZ.md`.
