# Yıllık Plan Örneği – Fen Lisesi Coğrafya

**Kaynak:** FEN LİSESİ COĞRAFYA DERSİ TASLAK YILLIK PLANLARI.xlsx  
**Kopya:** `backend/templates/ornek-yillik-plan-cografya.xlsx`

---

## 1. Dosya Yapısı

| Sayfa | İçerik | Satır | Sütun |
|-------|--------|-------|-------|
| 9.SINIF COĞRAFYA | 9. sınıf planı | 54 | 19 |
| 10..SINIF COĞRAFYA | 10. sınıf planı | 54 | 19 |
| 11.SINIF 2 SAAT | 11. sınıf 2 saatlik | 53 | 16 |
| 11.SINIF 4 SAAT | 11. sınıf 4 saatlik | 62 | 16 |
| 12.SINIF 2 SAAT | 12. sınıf 2 saatlik | 53 | 16 |
| 12.SINIF 4 SAAT | 12. sınıf 4 saatlik | 60 | 16 |

---

## 2. Sabit vs Değişken Alanlar

### Değişecek (her yıl / sınıfa göre)

| Konum | Şu anki değer | Placeholder önerisi |
|-------|----------------|---------------------|
| **A1** | 2025-2026 EĞİTİM ÖĞRETİM YILI FEN LİSELERİ 9. SINIF COĞRAFYA... | `{ogretim_yili}`, `{sinif}`, `{ders_adi}`, `{okul_turu}` |
| **B sütunu** (HAFTA) | "1. Hafta: 8-12 Eylül", "2. Hafta: 15-19 Eylül" | `{hafta_1_tarih}` ... `{hafta_36_tarih}` veya programatik güncelleme |
| Tatil satırları | "1. DÖNEM ARA TATİLİ: 10 - 14 Kasım" | `{ara_tatil_1}` vb. |

### Sabit (müfredat değişmedikçe)

- Sütun başlıkları (AY, HAFTA, DERS SAATİ, ÜNİTE, KONU, KAZANIM...)
- Ünite/Konu/Kazanım içerikleri
- Değerler, okuryazarlık, farklılaştırma metinleri

---

## 3. Hafta Tarihleri

MEB eğitim takvimine göre (ör. 2025-2026):

- **Ders başlangıç:** Eylül (ör. 8 Eylül 2025)
- **1. Hafta:** 8–12 Eylül  
- **2. Hafta:** 15–19 Eylül  
- ... (36 hafta)
- **1. Ara tatil:** 10–14 Kasım  
- **Yarıyıl tatili:** Ocak  
- **2. Ara tatil:** Nisan  

Tarihler her öğretim yılı için hesaplanıp B sütununa yazılmalı.

---

## 4. Önerilen Yaklaşım

### A) R2 + Placeholder (docxtemplater tarzı)

- Excel’e `{ogretim_yili}`, `{sinif}` vb. eklenir.
- docxtemplater’ın **ücretli xlsx modülü** Excel merge destekler.
- Hafta tarihleri için 36 ayrı placeholder (`{hafta_1}`, `{hafta_2}` ...) kullanılır.

### B) SheetJS ile programatik güncelleme (tercih edilebilir)

1. Şablon Excel R2’de saklanır (placeholdersız).
2. Backend: Öğretim yılı → MEB takviminden hafta tarihlerini hesaplar.
3. SheetJS ile Excel okunur, B sütunu ve ilgili tatil satırları güncellenir.
4. Başlık satırı (A1) `{ogretim_yili}` vb. ile doldurulur.
5. Yeni xlsx oluşturulup R2’ye yüklenir.

### C) Hibrit

- Başlık için basit merge: `{ogretim_yili}` – `{sinif}` – `{ders_adi}`.
- Hafta tarihleri için backend’de MEB takvim hesaplayıcı + SheetJS ile hücre güncelleme.

---

## 5. Örnek Hafta Hesaplama (MEB 2025-2026)

```
Ders başlangıç: 8 Eylül 2025 (Pazartesi)
1. Hafta:  8-12 Eylül
2. Hafta: 15-19 Eylül
3. Hafta: 22-26 Eylül
...
8. Hafta: 27-31 Ekim (Sınav)
1. Ara Tatil: 10-14 Kasım
...
```

Tatil haftaları MEB takviminden alınmalı; config veya ayrı tablo ile yönetilebilir.

---

## 6. Uygulama Adımları

1. **MEB takvim servisi:** Öğretim yılı → hafta tarihleri + tatiller.
2. **Excel işleyici:** SheetJS ile şablonu okuyup B sütununu ve A1’i güncelle.
3. **Şablon kaynağı:** Sınıf/ders/saat kombinasyonuna göre R2’den doğru sheet seç.
4. **Evrak akışı:** Öğretmen sınıf + ders + öğretim yılı seçer → "Üret" → merge edilmiş plan indirilir.
