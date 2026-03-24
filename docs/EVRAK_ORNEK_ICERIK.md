# Evrak Örnek İçerik

Bu dokümanda evrak şablonları için örnek metin içerikleri yer alır. Word dosyasında `{placeholder}` formatında merge alanları kullanılır.

---

## 1. Veli Toplantı Tutanağı

**Dosya:** `backend/templates/veli-toplanti-tutanak.docx`  
**file_url:** `local:veli-toplanti-tutanak.docx`  
**Placeholder'lar:** okul_adi, il, ilce, mudur_adi, ogretim_yili, sinif, ogretmen_adi, tarih, veli_sayisi, gundem_maddeleri, alinan_kararlar

### Metin içeriği (örnek doldurulmuş)

```
VELİ TOPLANTI TUTANAĞI

OKUL BİLGİLERİ
Okul Adı: Atatürk İlkokulu
İl: Ankara
İlçe: Çankaya
Okul Müdürü: Ayşe Yılmaz
Öğretim Yılı: 2024-2025

TOPLANTI BİLGİLERİ
Sınıf: 3-A
Sınıf Öğretmeni: Mehmet Demir
Toplantı Tarihi: 14.02.2025
Katılımcı Veli Sayısı: 24

GÜNDEM MADDELERİ:
1. Tanışma ve hoş geldiniz
2. 2024-2025 Eğitim-öğretim yılı çalışma programı
3. Öğrenci davranışları ve sınıf kuralları
4. Sınav ve değerlendirme sistemi
5. Veli katılımı ve iş birliği

TOPLANTIDA ALINAN KARARLAR:
1. Veli toplantıları her dönem en az iki kez yapılacaktır.
2. Öğrenci gelişim takibi için aylık bilgilendirme yapılacaktır.
3. Sınıf annesi/babası seçildi: Fatma Kaya (anne), Ali Yıldız (baba).
4. Proje ödevleri için evde destek sağlanacaktır.

Bu tutanak 14.02.2025 tarihinde Atatürk İlkokulu okulunda gerçekleştirilen veli toplantısında alınan kararları içermektedir.
```

---

## 2. İzin Dilekçesi

**Dosya:** `backend/templates/izin-dilekcesi.docx`  
**Placeholder'lar:** okul_adi, il, ilce, mudur_adi, ogretmen_adi, tarih, izin_baslangic, izin_bitis, gun_sayisi, izin_nedeni

### Metin içeriği (örnek)

```
DİLEKÇE

Atatürk İlkokulu
Okul Müdürlüğüne
Ankara / Çankaya

İlgide yazılı sebeple 20.02.2025 - 22.02.2025 tarihleri arasında 3 gün izinli sayılmamı saygılarımla arz ederim.

İzin Nedeni: Ailevi zorunluluk (evlilik töreni)

Tarih: 14.02.2025

Mehmet Demir
Öğretmen
```

---

## 3. Form şeması örnekleri

### Veli Toplantı Tutanağı (form_schema)

```json
[
  { "key": "sinif", "label": "Sınıf", "type": "text", "required": true },
  { "key": "tarih", "label": "Toplantı Tarihi", "type": "text", "required": true },
  { "key": "gundem_maddeleri", "label": "Gündem Maddeleri", "type": "textarea", "required": true },
  { "key": "alinan_kararlar", "label": "Alınan Kararlar", "type": "textarea", "required": false },
  { "key": "veli_sayisi", "label": "Katılımcı Veli Sayısı", "type": "text", "required": false }
]
```

### İzin Dilekçesi (form_schema)

```json
[
  { "key": "izin_nedeni", "label": "İzin Nedeni", "type": "text", "required": true },
  { "key": "izin_baslangic", "label": "İzin Başlangıç Tarihi", "type": "text", "required": true },
  { "key": "izin_bitis", "label": "İzin Bitiş Tarihi", "type": "text", "required": true },
  { "key": "gun_sayisi", "label": "Gün Sayısı", "type": "text", "required": true }
]
```

---

## 4. Otomatik doldurulan alanlar (profil)

Sistem şu alanları kullanıcı/school verisinden otomatik doldurur:

| Placeholder | Kaynak |
|-------------|--------|
| ogretmen_adi | User.display_name |
| okul_adi | School.name |
| mudur_adi | School.principalName |
| il | School.city |
| ilce | School.district |
| ogretim_yili | Config (2024-2025) |
| tarih | Form veya bugün |

---

## 5. Yıllık Plan (Excel) – Merge

**Dosya:** R2 veya `backend/templates/ornek-yillik-plan-cografya.xlsx` (local fallback)  
**Placeholder'lar:** Şablon hücrelerine `{ogretim_yili}`, `{okul_adi}`, `{sinif}`, `{ders_adi}`, `{ogretmen_adi}`, `{mudur_adi}`, `{onay_tarihi}`, `{zumreler}` eklenir. Sadece bu placeholder'lar değiştirilir, **şablon yapısı (birleştirilmiş hücreler, formatlar) korunur**.

**Dosya yolları:** Örnek şablonlarda `file_url` (R2) ve `file_url_local` (yerel fallback) kullanılır. R2 başarısız olursa `file_url_local` denenir (örn. `local:ornek-yillik-plan-cografya.xlsx`).  
**Örnek şablon oluşturma:** `cd backend && npm run create-cografya-template` — `templates/ornek-yillik-plan-cografya.xlsx` oluşturulur.

Form alanları: `ogretim_yili`, `sinif`, `okul_adi`, `mudur_adi`, `onay_tarihi`, `zumreler` – Evrak sayfasında seçimlerle ve profilden önceden doldurulur.

### Başlık hücresi – Yapı ve dilbilgisi

**Başlık:** Okul adı hücrenin en üstünde **büyük harf** ve **ortalanmış** olmalı.

| Placeholder | Açıklama |
|-------------|----------|
| `{okul_adi_upper}` | Okul adı büyük harfle (ATATÜRK ANADOLU LİSESİ) – başlık için |
| `{baslik_bloku}` | Tek hücrede tam blok: üstte okul (büyük harf), altta Zümre Öğretmenleri, Müdür, Onay Tarihi |
| `{zumre_satiri}` | "Zümre Öğretmenleri: Ad1, Ad2" (boşsa boş) |
| `{mudur_satiri}` | "Müdür: Ad Soyad" |
| `{onay_tarihi_satiri}` | "Onay Tarihi: DD.MM.YYYY" |

**Şablon örneği – tek hücre:**
- Hücreye `{baslik_bloku}` yazın.
- Hücre biçimi: **Dikey hizalama** Üstte, **Yatay hizalama** Ortada.

**Alternatif – satır satır:**
```
{okul_adi_upper}

{zumre_satiri}
{mudur_satiri}
{onay_tarihi_satiri}
```
(Okul üstte büyük harf, altta dilbilgisine uygun etiketlerle zümre, müdür ve tarih.)

### Alt bölüm – İmza ve onay bloğu örneği

**Yapı:** Sol/orta zümre öğretmenleri imza alanları, sağda müdür onay bloğu.

| Alan | İçerik |
|------|--------|
| Zümre öğretmenleri (sol/orta) | Her sütunda noktalı imza çizgisi + `{ders_adi_ogretmeni}` (örn. Coğrafya Öğretmeni) |
| Onay bloğu (sağ) | Tarih + UYGUNDUR + imza çizgisi + Okul Müdürü |

**Placeholder'lar:**
| Placeholder | Açıklama |
|-------------|----------|
| `{ders_adi_ogretmeni}` | Ders adı + Öğretmeni (örn. Coğrafya Öğretmeni) |
| `{onay_tarihi_alt}` | Tarih DD / MM / YYYY formatında (08 / 09 / 2025) |
| `{mudur_adi}` | Müdür adı soyadı |

**Şablon yerleşimi örneği (Excel):**
```
[Sol]                    [Orta]                    [Orta]                    [Sağ]
....................     ....................     ....................     {onay_tarihi_alt}
{ders_adi_ogretmeni}     {ders_adi_ogretmeni}     {ders_adi_ogretmeni}     UYGUNDUR
                                                                          ....................
                                                                          Okul Müdürü
```

Zümre birden fazla öğretmense aynı etiket her sütunda tekrarlanır; imza alanları elle doldurulur. Merge sadece etiket (Coğrafya Öğretmeni vb.) ve tarihi doldurur.

## 6. Yeni şablon ekleme

1. Word'de `.docx` veya Excel'de `.xlsx` oluştur, `{alan_adi}` placeholder'ları ekle (opsiyonel)
2. `backend/templates/` altına koy veya R2'ye yükle
3. Admin panelde Evrak Şablonları → Yeni şablon
4. file_url: `local:dosya.docx` veya R2 key
5. Form + Merge ise `requires_merge: true` ve form_schema JSON ekle

## 7. Profesyonel evrak merge kütüphaneleri

Projede şu an kullanılanlar:
- **Word (.docx):** [docxtemplater](https://docxtemplater.com/) – `{placeholder}` değiştirme, loop/condition desteği
- **Excel (.xlsx):** [SheetJS (xlsx)](https://sheetjs.com/) – manuel hücre metni değiştirme

### Gelişmiş alternatifler

| Çözüm | Açıklama | Excel | Word |
|-------|----------|-------|------|
| **docxtemplater + xlsx-module** | Docxtemplater'ın Excel modülü; Word ile aynı `{tag}` sözdizimi, loop/condition | Evet | Evet |
| **docx** (npm) | Programatik Word oluşturma; template yerine kod ile yapı | Hayır | Evet |
| **ExcelJS** | Excel okuma/yazma, hücre formatı koruma, stil desteği | Evet | Hayır |
| **Pandoc** | Markdown/HTML → Word/PDF; şablon tabanlı değil | Dolaylı | Evet |

**Projede uygulanan (ücretsiz):** XLSX ZIP formatında olduğu için `PizZip` ile açılıp doğrudan `xl/sharedStrings.xml` ve `xl/worksheets/sheetN.xml` içinde `{placeholder}` değiştirmesi yapılıyor. Parse/serialize yerine sadece metin replace kullanıldığından merged cells, kolon genişliği, stiller korunur; kayma oluşmaz.

**Ücretli alternatif:** Excel için `docxtemplater-xlsx-module` (500€/yıl – One module planı); Word ile aynı API, loop/condition desteği.

## 8. Uygulanan akış (Ocak 2025)

- **Yerel şablon önceliği:** `fileUrlLocal` (`local:`) varsa ve `backend/templates/` altında dosya mevcutsa merge öncesi önce o kullanılır (placeholder'lar yerelde).
- **Placeholder formatları:** `{key}` ve `{{key}}` destekleniyor.
- **Önizleme:** Üret modalı içinde merge edilmiş tablo; otomatik yükleme; "Excel olarak indir" linki.
- **Dosya adı:** `9-Sinif-Cografya-Yillik-Plan-2024-2025.xlsx` formatında okunabilir isim.
