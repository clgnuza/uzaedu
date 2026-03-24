# Evrak Modülü Entegrasyon Analizi

**Hedef:** ÖğretmenEvrak benzeri evrak hazırlama ve indirme özelliklerini ÖğretmenPro modülüne entegre etmek.

**Kaynak:** [ÖğretmenEvrak](https://ogretmenevrak.com/), [app.ogretmenevrak.com](https://app.ogretmenevrak.com/), web araştırması.

---

## 1. ÖğretmenEvrak Özellik Özeti

### 1.1 İki Ana Özellik

| Özellik | Açıklama | Platform | Akış |
|---------|----------|----------|------|
| **İndirme (Download)** | Hazır şablon kataloğu → seçim → giriş → doğrudan dosya indir | Web (ogretmenevrak.com) | Katalog → Filtre (sınıf, ders, tür) → Giriş zorunlu → İndir |
| **Evrak Hazırlama (Form Fill)** | Form doldurma → otomatik merge (okul adı, müdür, eğitim yılı) → belge üret → e-posta veya indir | Mobil + Web App (app.ogretmenevrak.com) | Form girişi → Sistem otomatik doldurur → Belge üret → Mail/indir |

### 1.2 ÖğretmenEvrak Otomatik Doldurma

Mobil uygulamada öğretmen bilgilerini girdikten sonra sistem şunları **otomatik** yerleştirir:
- Okul adı
- Müdür adı
- Güncel eğitim-öğretim yılı
- (Muhtemelen) Öğretmen adı, branş

**Çıktı:** "Size özel" belge; saniyeler içinde e-posta veya indirme.

---

## 2. Evrak Kategorileri ve Hiyerarşi (Tam Envanter)

### 2.1 Planlar

| Plan Türü | URL Örneği | Seçim Hiyerarşisi | Çıktı Format |
|-----------|------------|-------------------|--------------|
| Yıllık Plan | /yillik_plan/5-sinif_6/turkce-maarif-m_1627 | Sınıf → Bölüm (Ders/Seçmeli/İHO) → Ders | Word/Excel, Maarif M. |
| Günlük Plan | /gunluk_plan/5-sinif_6 | Sınıf → Bölüm → Ders (haftalık paket) | Word |
| Egzersiz Planları | — | Kulüp/tür seçimi | Word/Excel |
| İYEP Planları | — | Türkçe / Matematik | Modül planları |
| BEP Planları | — | Dosya / Plan Yeni/Eski / Kaba Form | Word/Excel |

### 2.2 Zümre Evrakları

```
Okul Türü: Okul Öncesi | İlkokul | Ortaokul | Lise | Mesem | Özel Eğitim | Ortaokul Seçmeli | Lise Seçmeli
    └── Zümre Türü: Sene Başı | Sene Sonu | Birinci Dönem Ara | İkinci Dönem Başı | İkinci Dönem Ara | Eski Zümreler
        └── Zümre Dersi: 1. Sınıf | 2. Sınıf | ... | İngilizce | Din Kültürü | Birleştirilmiş Sınıf (1-2, 3-4)
```

**Örnek:** İlkokul → Sene Başı → 1. Sınıf → İndir (giriş gerekli)

### 2.3 Diğer Evraklar

| Kategori | Alt Kategoriler |
|----------|-----------------|
| 2025-2026 İş Takvimi | İş takvimi |
| Belirli Gün ve Haftalar | Takvim |
| Dilekçe Örnekleri | Genel Dilekçeler, İzin Dilekçeleri, Sendika Dilekçeleri |
| Mevzuatlar | Yasal metinler |
| Öğretmen Dosyası | Kişisel evrak |
| Pano Çalışmaları ve Boyama Etkinlikleri | Görsel materyal |
| Performans Proje Formları | Değerlendirme |
| Sınav Analizleri | Analiz şablonları |
| Şök Tutanakları | Toplantı |
| İdari Evraklar | İdare evrakları |
| Kulüp Pano Görselleri | Görsel |
| Yıl Sonu - Dönem Sonu Evrakları | Kapanış evrakları |

**İzin Dilekçeleri alt örnekleri:**
- Askerlik Ücretsiz İzin, Babalık İzni, Doğum Sonrası Ücretsiz İzin
- Evlilik İzni 1/2, Refakat İzni, Süt İzni 1.5/3 saatlik
- (Her biri ayrı indirilebilir evrak)

### 2.4 Ek Özellikler (app.ogretmenevrak.com)

- **Sınıf İşlemleri:** Öğrenci listesi, veli bilgileri
- **Ödev Kontrol:** Ödev takip formu
- **Performans Proje:** Kriter özelleştirme, puanlama, çıktı
- **Rehberlik Araçları:** Rehberlik formları
- **Veli telefon listeleri, boy-kilo takip, nöbet listeleri** (mobil)

---

## 3. ÖğretmenPro Mevcut Veri Modeli

### 3.1 Kullanılabilir Profil Verileri

| Kaynak | Alan | Evrak Merge İçin |
|--------|------|------------------|
| **User** | display_name, email | Öğretmen adı |
| **User** | teacher_branch, teacher_phone, teacher_title | Branş, ünvan |
| **User** | school_id | Okul eşlemesi |
| **School** | name, city, district | Okul adı, il, ilçe |
| **School** | — | **Eksik: müdür adı** |

### 3.2 Eksik Veriler (Evrak İçin)

| Alan | Kullanım | Öneri |
|------|----------|-------|
| Müdür adı | Zümre, tutanak, dilekçe | School entity: `principal_name` (nullable) |
| Öğretim yılı | Tüm evraklar | Config veya hesaplama: `academicYear` ("2024-2025") |
| Sınıf adı | Plan, zümre | Form'dan veya SchoolClass |

---

## 4. Teknik Entegrasyon Gereksinimleri

### 4.1 Evrak Türü (type) + Hiyerarşi

```
document_templates tablosu:
- type: yillik_plan | gunluk_plan | egzersiz_plan | iyep_plan | bep_plan | zumre | kulup_evrak | veli_toplanti_tutanak | aday_ogretmen_dosyasi | rehberlik_raporu | dilekce | diger
- sub_type: zumre için sene_basi | sene_sonu | birinci_donem_ara | ... ; bep için dosya | plan_yeni | plan_eski | kaba_form ; iyep için turkce | matematik
- school_type: ilkokul | ortaokul | lise | okul_oncesi | mesem | ozel_egitim | ortaokul_secmeli | lise_secmeli (zümre)
- grade: 1-12 (planlar)
- section: ders | secmeli | iho (planlar)
- subject_code, subject_label (planlar)
- academic_year: "2024-2025"
- curriculum_model: maarif_m | eski
```

### 4.2 İndirme Akışı (Basit)

```
GET /document-templates?type=...&grade=...&section=...&subject_code=...&school_type=...&sub_type=...
→ Filtrelenmiş şablon listesi

GET /document-templates/:id/download
→ Auth kontrolü
→ Entitlement kontrolü (evrak_uretim)
→ R2'den dosya URL (signed veya public) dön
→ (Ops.) Entitlement düş, event: document.downloaded
```

**Alternatif:** Hazır dosya doğrudan `file_url` ile; merge gerektirmeyen şablonlar için.

### 4.3 Evrak Hazırlama Akışı (Form + Merge)

```
POST /documents/generate
Body: {
  template_id: string,
  form_data: {
    sinif?: string,           // "5-A" veya "1. Sınıf"
    ders_adi?: string,
    ogretim_yili?: string,    // "2024-2025"
    hafta?: number,
    ek_metin?: string,
    tarih?: string,
    // ... şablona özel alanlar
  },
  format: 'docx' | 'pdf'
}

Backend:
1. Auth + Entitlement kontrolü
2. User + School + (form_data) → merge_data
3. Template'teki placeholder'ları doldur (docx-template, docxtemplater vb.)
4. R2'ye yükle veya geçici URL üret
5. Entitlement düş, event: document.generated
6. Response: { download_url, expires_at }
```

### 4.4 Word Şablon Placeholder Standardı

ÖğretmenEvrak benzeri merge için önerilen placeholder sözdizimi:

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
```

**Araç:** `docxtemplater`, `docx-templates` (Node.js) veya `python-docx-template`.

### 4.5 Depolama (R2)

- **Şablonlar:** `document-templates/{template_id}/v{version}.docx`
- **Üretilen evraklar (ops.):** Geçici URL, 1 saat expiry; MVP'de sunucu arşivi yok

---

## 5. Zorluklar ve Dikkat Edilecekler

### 5.1 Şablon Yönetimi

| Sorun | Önlem |
|-------|-------|
| Word formatı bozulması | Placeholder sadece basit metin; karmaşık tablo/sütun yapısından kaçın |
| MEB müfredat güncellemesi | academic_year + curriculum_model ile versiyonlama; eski şablonlar kalır |
| Sınıf bazlı ders farkları | grade + subject_code eşlemesi; config tablosu veya JSON |
| Şablon sayısı (yüzlerce) | Admin toplu yükleme; slug/code ile gruplama |

### 5.2 Form ve Merge

| Sorun | Önlem |
|-------|-------|
| Müdür adı eksik | School'a principal_name ekle; boşsa form'da manuel giriş |
| Öğretim yılı | Config veya mevcut tarihten hesapla (Eylül–Haziran) |
| Özelleştirilebilir alan sayısı | Şablon bazlı form_schema (JSON); dinamik form render |
| Büyük dosya üretimi | Async job + webhook/polling; veya senkron (kısa süreli) |

### 5.3 Entitlement ve Market

| Sorun | Önlem |
|-------|-------|
| İndirme vs üretim farkı | İndirme: 1 hak; Üretim: 1 hak (aynı entitlement_type: evrak_uretim) |
| Ücretsiz kotası | Yeni kullanıcıya default entitlement (örn. 10 adet) |
| Jeton/hak bitince | 402 ENTITLEMENT_REQUIRED; markete yönlendir |

### 5.4 UI/UX

| Sorun | Önlem |
|-------|-------|
| Çok seviyeli filtre karmaşıklığı | Adım adım wizard; her adımda sonraki seçenekler filtrelenir |
| Mobil form doldurma | Kısa form; profil verileri önceden dolu |
| Offline | MVP'de online only; ileride cache şablon listesi |

---

## 6. Veri Modeli Önerisi (Güncellenmiş)

### 6.1 DocumentTemplate Entity

```ts
@Entity('document_templates')
class DocumentTemplate {
  id: string;
  type: DocumentTemplateType;
  subType?: string | null;           // zumre: sene_basi, bep: plan_yeni, iyep: turkce
  schoolType?: string | null;        // zümre: ilkokul, ortaokul, lise, ...
  grade?: number | null;             // 1-12
  section?: string | null;           // ders, secmeli, iho
  subjectCode?: string | null;
  subjectLabel?: string | null;
  curriculumModel?: string | null;   // maarif_m, eski
  academicYear?: string | null;     // 2024-2025
  version: string;
  fileUrl: string;
  fileFormat: 'docx' | 'xlsx' | 'pdf';
  /** Merge gerektiriyor mu? true ise POST /documents/generate kullanılır */
  requiresMerge: boolean;
  /** Placeholder listesi (ops.); form_schema ile eşleşir */
  mergeFields?: string[] | null;     // ['ogretmen_adi','okul_adi','mudur_adi',...]
  /** Dinamik form şeması (JSON); requiresMerge true ise */
  formSchema?: object | null;
  isActive: boolean;
  sortOrder?: number | null;
  createdAt: Date;
}
```

### 6.2 School Entity Eklentisi

```ts
// School entity'ye eklenecek
@Column({ name: 'principal_name', type: 'varchar', length: 128, nullable: true })
principalName: string | null;
```

### 6.3 DocumentTemplateCategory (Opsiyonel)

Çok sayıda şablon için gruplama:

```ts
@Entity('document_template_categories')
class DocumentTemplateCategory {
  id: string;
  slug: string;           // zumre, yillik_plan, dilekce, ...
  label: string;
  parentId?: string | null;  // Hiyerarşi (Dilekçe → İzin Dilekçeleri)
  sortOrder: number;
}
```

---

## 7. API Önerisi (Genişletilmiş)

| Method | Path | Açıklama |
|--------|------|----------|
| GET | `/document-templates` | Filtre: type, sub_type, school_type, grade, section, subject_code, academic_year, active_only. Teacher: kendi okuluna uygun. |
| GET | `/document-templates/categories` | Kategori ağacı (opsiyonel) |
| GET | `/document-templates/:id` | Tek şablon detay (form_schema dahil) |
| GET | `/document-templates/:id/download` | Direkt indir (requiresMerge false ise). Auth + entitlement. |
| POST | `/documents/generate` | Form + merge ile üret. Auth + entitlement. Body: template_id, form_data, format. |
| GET/POST/PATCH | `/document-templates` (admin) | CRUD. Moderator: document_templates modülü. |

---

## 8. Uygulama Fazları

### Faz 1 – MVP (İndirme Odaklı)
- [ ] DocumentTemplate entity (type, grade, section, subjectCode, subjectLabel, version, fileUrl, fileFormat, isActive)
- [ ] GET /document-templates (filtre)
- [ ] GET /document-templates/:id/download (auth + entitlement)
- [ ] Admin CRUD + R2 yükleme
- [ ] School.principalName (opsiyonel, boş bırakılabilir)
- [ ] Teacher UI: Plan türü → Sınıf → Ders → İndir
- [ ] Zümre: Okul türü → Zümre türü → Ders → İndir

### Faz 2 – Evrak Hazırlama (Form + Merge)
- [ ] requiresMerge, mergeFields, formSchema alanları
- [ ] docxtemplater (veya benzeri) entegrasyonu
- [ ] POST /documents/generate
- [ ] Profil + form_data merge
- [ ] Dilekçe, veli toplantı tutanağı gibi form-ağır evraklar

### Faz 3 – Genişletme
- [ ] Diğer evraklar (iş takvimi, performans proje, sınav analizi)
- [ ] Kategori/hiyerarşi (document_template_categories)
- [ ] E-posta ile gönderim (opsiyonel)
- [ ] Öğretim yılı otomatik seçimi
- [ ] app.ogretmenevrak.com benzeri ek modüller (sınıf işlemleri, ödev kontrol vb. – ayrı modül)

---

## 9. Özet Karşılaştırma

| Özellik | ÖğretmenEvrak | ÖğretmenPro Planı |
|---------|---------------|-------------------|
| İndirme | Giriş → Katalog → İndir | Auth + Entitlement → İndir |
| Form + Merge | Mobil: Form → Okul/müdür/yıl auto → Mail | Profil + form_data → Backend merge → download_url |
| Katalog yapısı | Plan: Sınıf→Bölüm→Ders; Zümre: Okul→Zümre→Ders; Diğer: Kategori→Alt | DocumentTemplate filtrelerle aynı mantık |
| Müdür adı | Kullanıcı girer, saklanır | School.principalName (yeni alan) |
| Öğretim yılı | Güncel (sistem) | academic_year, config veya hesaplama |
| Entitlement | Premium paket | evrak_uretim (sayısal), market/jeton |
| Platform | Web + Mobil | Flutter + Web-admin (teacher için Flutter öncelikli) |

---

*Bu analiz EVRAK_ENTEGRASYON_ANALIZ.md olarak projeye eklendi. Implementasyon öncesi CORE_ENTITIES, API_CONTRACT ve migration planı bu dokümana göre güncellenmelidir.*
