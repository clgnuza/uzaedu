# MEB Ek Ders Bordro Dosyaları Analizi

Bu doküman MEB tarafından yayımlanan resmi ek ders hesaplama bordro şablonlarının yapısını ve hesaplama kurallarını özetler.

**İncelenen dosyalar (05.01.2026 tarihli):**
- `12140731_4bsozlesmeliogretmenekdershesaplamabordrosu20260105.xlsm` — 4/B Sözleşmeli Öğretmen
- `12140648_ucretliogretmenekdershesaplamabordrosu20260105.xlsm` — Ücretli Öğretmen

---

## 1. Genel Yapı

### 4/B Sözleşmeli Bordro

| Sayfa | Açıklama |
|-------|----------|
| BİLGİ GİRİŞİ | Kimlik, görev yeri, mezuniyet, iban, icra kesintisi |
| EK DERS Veri Girişi | Saat girişleri (gündüz, gece, %25 gündüz, %25 gece, …) |
| EK DERS BORDROSU | Yazdırılabilir bordro özeti |
| BANKA LİSTESİ, BES LİSTESİ, KESİNTİ LİSTESİ, SGK LİSTESİ | Yardımcı listeler |
| ÖDEME EMRİ BELGESİ, RAPOR | Çıktı belgeleri |
| **EK DERS Ücret Hesaplama** | Ana hesaplama mantığı |
| **KATSAYILAR** | Katsayılar, göstergeler, vergi dilimleri |

### Ücretli Bordro

| Sayfa | Açıklama |
|-------|----------|
| Benzer BİLGİ / Veri Girişi / Bordro sayfaları | |
| **KATSAYILAR** | Ücretli için sadece 4 kalem: Gündüz, Gece, DYK Gündüz, DYK Gece |
| GELİR VERGİSİ Matrah Takibi | Aylık vergi matrah takip |
| BORDRO (Bireysel) | Bireysel bordro özeti |

---

## 2. KATSAYILAR Sayfası — Ortak Parametreler

### 2.1 Temel Değerler (2026)

| Parametre | Hücre | Değer | Açıklama |
|-----------|-------|-------|----------|
| **Memur Maaş Katsayısı** | F2 | **1,387871** | Mali ve Sosyal Haklar Genelgesi |
| **Brüt Asgari Ücret** | F3 | **33.030 TL** | Damga vergisi istisna matrahı |
| SGK Prim Matrahı | F4 | =F3 | |
| SGK İşçi Primi | F5 | =ROUND(F4×0,14;2) | %14 |
| İşsizlik Sigorta Primi | F6 | =ROUND(F4×0,01;2) | %1 |
| Net Asgari Ücret | F7 | F3 − (F5+F6) | |
| Gelir Vergisi Matrahı | F10 | =F7 | |
| **Damga Vergisi Oranı** | F12 | **0,00759** | Binde 7,59 |

### 2.2 Gelir Vergisi Dilimleri

| Oran | Matrah üst limit |
|------|------------------|
| %15 | 190.000 TL |
| %20 | 400.000 TL |
| %27 | 1.500.000 TL |
| %35 | … |
| %40 | … |

---

## 3. 4/B Sözleşmeli — Ek Ders Kalemleri ve Göstergeler

**Formül:** `Tutar (TL/saat) = ROUND(Katsayı × Gösterge, 2)`  
Katsayı = 1,387871 (F2)

### 3.1 Öğrenim Durumuna Göre Göstergeler

| Kalem | Lisans | Y. Lisans | Doktora | Formül |
|-------|--------|-----------|----------|--------|
| **Gündüz** | 140 | 149,8 | 168 | C×F2 |
| **Gece** | 150 | 160,5 | 180 | C×F2 |
| **%25 Fazla Gündüz** | 175 | 187,25 | 210 | C×F2 |
| **%25 Fazla Gece** | 187,5 | 200,625 | 225 | C×F2 |
| Sınav Görevi | 140 | 140 | 140 | Gündüz tarifesi |
| Egzersiz | 140 | 140 | 140 | |
| Hizmet İçi | 140 | 140 | 140 | |
| Nöbet Ücreti | 140 | 140 | 140 | |
| Nöbet %25 Fazla | 175 | 175 | 175 | |
| Belleticilik | 140 | 140 | 140 | |
| Belleticilik %25 Fazla | 175 | 175 | 175 | |
| İYEP Gündüz | 140 | 149,8 | 168 | |
| İYEP Gece/Hafta Sonu | 150 | 160,5 | 180 | |
| İYEP %25 Gündüz | 175 | 175 | 175 | |
| İYEP %25 Gece | 187,5 | 187,5 | 187,5 | |
| **DYK Gündüz** | 280 | 289,8 | 308 | 140 + gündüz gösterge (additif) |
| **DYK Hafta Sonu/Gece** | 300 | 310,5 | 330 | 150 + gece gösterge (additif) |

**DYK formülü:** Tutar = Lisans birim ücret + Seçili öğrenim birim ücret (ör. Y.Lisans DYK gündüz = 194,30 + 207,90 = 402,21 TL).

### 3.2 2026 Ocak-Haziran Lisans Örnek Tutarlar

| Kalem | Gösterge | Tutar (TL/saat) |
|-------|----------|-----------------|
| Gündüz | 140 | 194,30 |
| Gece | 150 | 208,18 |
| %25 Gündüz | 175 | 242,88 |
| %25 Gece | 187,5 | 260,23 |
| Sınav, Egzersiz, Hizmet İçi, Nöbet, Belleticilik | 140 | 194,30 |
| Nöbet %25, Belleticilik %25 | 175 | 242,88 |
| DYK Gündüz | 280 | 388,60 |
| DYK Gece/H.S. | 300 | 416,36 |
| İYEP Gündüz | 140 | 194,30 |
| İYEP Gece | 150 | 208,18 |

### 3.3 Merkezi Sınav Görevi (gösterge bazlı)

| Görev | Gösterge | Formül |
|-------|----------|--------|
| Komisyon Başkanı | 1900 | ROUND(F2×1900, 2) |
| Komisyon Üyesi | 1700 | ROUND(F2×1700, 2) |
| Salon Başkanı | 1650 | ROUND(F2×1650, 2) |
| Gözetmen | 1600 | ROUND(F2×1600, 2) |
| Yedek Gözetmen | 1200 | ROUND(F2×1200, 2) |
| Yrd. Engelli Gözetmen | 2000 | ROUND(F2×2000, 2) |

**2026 örnek:** Komisyon Başkanı ≈ 2.637 TL, Gözetmen ≈ 2.221 TL

### 3.4 Veri Girişi Sütunları (EK DERS Veri Girişi)

| Sütun | Açıklama |
|-------|----------|
| A | Sıra No |
| B | T.C. Kimlik No |
| C | Adı Soyadı |
| D | Görev Yeri |
| E | Gündüz Saat |
| F | Gece Saat |
| G | %25 Gündüz Saat |
| H | %25 Gece Saat |
| … | (diğer kalemler devam eder, toplam ~W’ye kadar) |
| X | Toplam saat (SUM) |

---

## 4. Ücretli Öğretmen — Özet

### 4.1 Sadece 4 Ana Kalem — Öğrenim Farkı Yok

| Kalem | Kadrolu (Lisans) | Ücretli (~%72,5) |
|-------|------------------|-----------------|
| Gündüz | 194,30 | ~140,89 |
| Gece / H.S. | 208,18 | ~150,93 |
| DYK (Gündüz) | 388,60 | ~281,74 (2×140,89) |
| DYK (Gece/H.S.) | 416,36 | ~301,86 (2×150,93) |

**Formül:** Ücretli = Kadrolu Lisans × ucretli_unit_scale (params). DYK = 2 × ücretli gündüz/gece. Y.Lisans/Doktora farkı uygulanmaz.

### 4.2 Veri Girişi Sütunları

| Sütun | Açıklama |
|-------|----------|
| E | Gündüz Saat |
| F | Gece Saat |
| G | DYK (Gündüz) Saat |
| H | DYK (Gece) Saat |
| J | Toplam Saat |

Ücretli bordroda **%25 özel eğitim**, **nöbet, belleticilik, egzersiz, hizmet içi, sınav görevi** gibi ayrı kalemler yok; sadece bu 4 kalem kullanılıyor.

---

## 5. Öğretmen Pro ile Uyum

### 5.1 Zaten Uyumlu Olanlar

- Katsayı 1,387871
- Gündüz 140, Gece 150
- Lisans / Y.Lisans / Doktora gösterge farkları
- %25 fazla (özel eğitim): 175 / 187,5
- DYK: 280 / 300 (2×gündüz / 2×gece)
- Vergi dilimleri, DV oranı, GV/DV istisna mantığı

### 5.2 Dikkat Edilecek Noktalar

1. **Merkezi sınav tutarları:** Bordroda gösterge bazlı (ör. 1900, 1700, 1650…); Öğretmen Pro’da sabit TL kullanılıyor olabilir. Gösterge × Katsayı ile uyumlu hale getirilebilir.
2. **Ücretli öğretmen:** Sadece 4 kalem (gündüz, gece, DYK gündüz, DYK gece) — ücretli seçildiğinde diğer kalemler gizlenebilir veya 0 sabitlenebilir.
3. **Bina Sınav Sorumlusu:** Bordro KATSAYILAR sayfasında yok; mevcut Öğretmen Pro sabit tutarları (ör. 3500 TL) MEB’in farklı bir düzenlemesine dayanıyor olabilir.
4. **Yrd. Engelli Gözetmen:** Gösterge 2000 → ≈ 2.776 TL; Öğretmen Pro’da bu rol tanımlı mı kontrol edilmeli.

---

## 6. Referans

- MEB Ek Ders Hesaplama Bordrosu (4/B Sözleşmeli) — 05.01.2026
- MEB Ek Ders Hesaplama Bordrosu (Ücretli) — 05.01.2026
- EK_DERS_ANALIZ.md (mevcut proje dokümanı)
