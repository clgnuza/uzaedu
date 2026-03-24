# Hesaplama Kuralları Güncelleme Analizi

Bu doküman, MEB bordro dosyaları ve resmi analiziyle mevcut Öğretmen Pro hesaplama mantığının karşılaştırmasını ve güncellenmesi gereken noktaları içerir.

**Referanslar:** MEB_BORDRO_ANALIZ.md, EK_DERS_ANALIZ.md, MEB bordro xlsm (05.01.2026)

---

## Özet: Güncellenecek Alanlar

| Alan | Öncelik | Durum | Öneri |
|------|---------|-------|-------|
| DV istisna formülü | **Yüksek** | Yanlış | `dvMatrah = totalBrut - (dv_max - dvUsed)` olmalı |
| Merkezi sınav tutarları | **Yüksek** | Sabit TL, bordro gösterge bazlı | Gösterge × Katsayı ile güncelle |
| Merkezi sınav roller | Orta | Bina Sınav Sorumlusu bordroda yok; Yrd. Engelli eksik | Bina Sorumlusu araştır; Yrd. Engelli ekle |
| Ücretli öğretmen kalem seti | Orta | Tüm kalemler gösteriliyor | Ücretli seçilince sadece 4 kalem göster |
| Öğrenim gösterge farkları | Düşük | Sadece Lisans (140/150) parametre | Y.Lisans/Doktora farklı göstergeler (149,8/168 vb.) |
| İYEP %25 kalemleri | Düşük | Yok | MEB bordroda İYEP %25 var; isteğe bağlı eklenebilir |

---

## 1. Damga Vergisi (DV) İstisna Formülü — KRİTİK HATA

### Resmi mantık (MEB / resmi)

- **DV istisna matrahı:** 33.030 TL (brüt asgari ücret) — bu tutara kadar ücret damga vergisinden istisna.
- **"Faydalanılan" (dvUsed):** Maaş vb. diğer ödemelerde **zaten kullanılmış** istisna matrahı.
- **Ek ders için kalan istisna:** 33.030 − faydalanılan
- **DV matrahı (ek ders):** Ek ders brütü − kalan istisna = Ek ders brütü − (33.030 − faydalanılan)

### Mevcut kod (extra-lesson-calc)

```ts
const dvMatrah = Math.max(0, totalBrut - dvUsed);
```

Burada `dvUsed` doğrudan brütten düşülüyor. Kullanıcıya "faydalanılan" (maaşta kullanılan) soruluyorsa, formül hatalı.

### Doğru formül

```
kalan_istisna = dv_exemption_max - dvUsed   // örn. 33030 - 20000 = 13030
dvMatrah = max(0, totalBrut - kalan_istisna)
         = max(0, totalBrut - dv_exemption_max + dvUsed)
```

**Örnek:** Maaşta 20.000 TL istisna kullanıldı (dvUsed=20000). Ek ders brüt 15.000 TL.
- Kalan istisna = 33.030 − 20.000 = 13.030 TL  
- DV matrahı = 15.000 − 13.030 = **1.970 TL**  
- DV kesintisi = 1.970 × 0,00759 ≈ 14,94 TL  

### Yapılacak değişiklik

`extra-lesson-calc/page.tsx` içinde:

```ts
// Mevcut (YANLIŞ):
const dvMatrah = Math.max(0, totalBrut - dvUsed);

// Olması gereken:
const dvMax = parseNum(params.dv_exemption_max);
const remainingExempt = Math.max(0, dvMax - dvUsed);
const dvMatrah = Math.max(0, totalBrut - remainingExempt);
```

---

## 2. Merkezi Sınav Tutarları — Gösterge Bazlı Olmalı

### MEB bordro (KATSAYILAR)

Formül: `Tutar = ROUND(Katsayı × Gösterge, 2)` — saat değil, **gösterge** bazlı tek seferlik ödeme.

| Görev | Gösterge | 2026 Tutar (1,387871 × gösterge) |
|-------|----------|----------------------------------|
| Komisyon Başkanı | 1900 | 2.637,95 TL |
| Komisyon Üyesi | 1700 | 2.359,38 TL |
| Salon Başkanı | 1650 | 2.289,99 TL |
| Gözetmen | 1600 | 2.220,59 TL |
| Yedek Gözetmen | 1200 | 1.665,45 TL |
| Yrd. Engelli Gözetmen | 2000 | 2.775,74 TL |

### Mevcut Öğretmen Pro (sabit TL)

| Görev | Tutar |
|-------|-------|
| Bina Sınav Sorumlusu | 3.500 |
| Komisyon Başkanı | 2.500 |
| Komisyon Üyesi | 2.300 |
| Salon Başkanı | 2.200 |
| Gözetmen | 2.100 |
| Yedek Gözetmen | 1.600 |

### Farklar

1. **Bina Sınav Sorumlusu:** MEB bordroda bu rol yok. Ayrı Resmi Gazete / genelge ile tanımlı olabilir; kaynak kontrolü gerekir.
2. **Diğer roller:** Bordroda gösterge × katsayı ile hesaplanıyor; bizim sabit tutarlar genelde düşük.
3. **Yrd. Engelli Gözetmen:** Bordroda var (gösterge 2000), bizde yok.

### Öneri

**Seçenek A (önerilen):** Merkezi sınav rolleri `indicator` (gösterge) ile tanımlansın; hesaplama: `coeff × indicator`.

- Entity: `CentralExamRole` içine `indicator?: number` ekle.
- `indicator` varsa: `fixed_amount = ROUND(coeff × indicator, 2)`
- `indicator` yoksa: Mevcut `fixed_amount` kullan (Bina Sınav Sorumlusu gibi özel roller için).

**Seçenek B:** Sabit tutarları bordro ile hizalayacak şekilde güncelle (2.638, 2.359, 2.290, 2.221, 1.665) ve Yrd. Engelli Gözetmen ekle.

---

## 3. Ücretli Öğretmen — Kalem Seti

### MEB ücretli bordro

Sadece **4 kalem** kullanılıyor:

1. Gündüz (140)
2. Gece / H.S. (150)
3. DYK Gündüz (280)
4. DYK Gece (300)

Nöbet, belleticilik, egzersiz, hizmet içi, %25 özel eğitim ayrı kalem olarak yok.

### Mevcut durum

Ünvan seçimi (Kadrolu / Sözleşmeli / Ücretli) UI'da var ama hesaplamayı değiştirmiyor; tüm kalemler herkese gösteriliyor.

### Öneri

- Ünvan = "Ücretli" seçildiğinde:
  - Sadece gündüz, gece, DYK gündüz, DYK gece alanları gösterilsin.
  - Diğer kalemler gizlensin veya 0 kabul edilsin.

---

## 4. Öğrenim Durumu — Gösterge Farkları

### MEB bordro

Öğrenim durumuna göre **farklı göstergeler**:

| Kalem | Lisans | Y.Lisans | Doktora |
|-------|--------|----------|---------|
| Gündüz | 140 | 149,8 | 168 |
| Gece | 150 | 160,5 | 180 |
| %25 Gündüz | 175 | 187,25 | 210 |
| %25 Gece | 187,5 | 200,625 | 225 |
| Sınav, Nöbet, Belleticilik vb. | 140 | 140 | 140 |
| DYK Gündüz | 280 | 289,8 | 308 |
| DYK Gece | 300 | 310,5 | 330 |

### Mevcut Öğretmen Pro

`education_levels` ile sabit birim ücretler kullanılıyor:

- Lisans: 194,30 / 208,18
- Y.Lisans: 207,90 / 222,75
- Doktora: 233,16 / 249,82

Bu değerler katsayı × gösterge ile uyumlu; yani matematik doğru. Ancak:

- %25 ve DYK kalemlerinde Y.Lisans/Doktora için farklı göstergeler (187,25, 289,8 vb.) bordroda var.
- Bizde tüm kalemler Lisans (140/150) üzerinden hesaplanıp, sadece `education_level` ile ölçekleniyor olabilir.

### Kontrol

Frontend `getUnitPrice`:

```ts
const scaleDay = baseDay / 194.3;
const scaleNight = baseNight / 208.18;
// param varsa: param * scale; yoksa: baseDay/baseNight * mult
```

Y.Lisans seçildiğinde baseDay=207,9, baseNight=222,75.  
Örn. %25 Gündüz: param 242,88 (Lisans) → 242,88 × (207,9/194,3) = 259,68 TL.  
Bordroda Y.Lisans %25 Gündüz: 187,25 × 1,387871 = 259,72 TL. **Yaklaşık uyumlu.**

DYK Gündüz Y.Lisans: bizde 388,6 × (207,9/194,3) = 415,68 TL; bordro 289,8 × 1,387871 = 401,84 TL. **Fark var.**

Neden: Bordroda Y.Lisans DYK göstergesi 289,8 (Lisans 280’in doğrusal ölçeklemesi değil, kendi gösterge seti).

### Öneri

- **Kısa vadede:** Mevcut `education_levels` birim ücretleri ve ölçekleme kabul edilebilir; bordro ile küçük farklar olabilir.
- **Uzun vadede:** `education_levels` için kalem bazlı göstergeler (örn. `indicators: { gunduz, gece, dyk_gunduz, dyk_gece }`) eklenebilir; hesaplama formüle dayalı yapılır.

---

## 5. İYEP %25 Kalemleri

MEB bordroda İYEP için %25 fazla kalemler de var:

- İYEP %25 Gündüz: gösterge 175
- İYEP %25 Gece: gösterge 187,5

Bunlar özel eğitim %25’ten farklı bir uygulama. İsteğe bağlı olarak eklenebilir.

---

## 6. Stamp Duty (Damga Vergisi) Oranı

- Bordro: 0,00759 (binde 7,59)
- Bizde: `stamp_duty_rate` 7,59 olarak tutulup `parseNum(...)/1000` ile 0,00759 elde ediliyor. **Doğru.**

---

## 7. Vergi Dilimleri

Bordro: %15→190k, %20→400k, %27→1,5M, %35, %40  
Mevcut: Aynı. **Uyumlu.**

---

## 8. Uygulama Öncelik Sırası

1. **DV istisna formülünü düzelt** (extra-lesson-calc, computeResult).
2. **Merkezi sınav:** Gösterge bazlı hesaplama veya tutarları bordro ile güncelle; Yrd. Engelli Gözetmen ekle.
3. **Ücretli öğretmen:** Ünvan = Ücretli iken yalnızca 4 kalemi göster.
4. **İYEP %25 ve detaylı öğrenim göstergeleri:** İkinci aşama iyileştirmeler.

---

## Ek: Ek Ders Parametreleri Tablosu Referansı (resmi)

| Kalem | Gösterge | Açıklama |
|-------|----------|----------|
| Gündüz | 140 | Temel gündüz tarifesi |
| Gece | 150 | Temel gece tarifesi |
| Gündüz %25 | 175 | 140×1,25 |
| Nöbet | 140 | Gündüz tarifesi |
| Nöbet %25 | **187,5** | 150×1,25 (gece bazı) |
| EYG Gündüz Gör. / %25 | 140 / 175 | Özel eğitim gündüz |
| EYG Gece Gör. / %25 | 150 / 187,5 | Özel eğitim gece |
| Destek Odası %25 | 175 | 140×1,25 |
| Evde Eğitim %25 | 175 | 140×1,25 |
| Belleticilik / %25 | 140 / 175 | |
| Egzersiz, Hizmetiçi | 140 | |
| İYEP Gündüz/Gece | 140 / 150 | |
| DYK Gündüz / Gece | 280 / 300 | 2× gündüz/gece |
| SG (Bina Yön.) | 1900 | Merkezi sınav sabit |
| SG (Bin. Yön. Yrd.) | 1700 | |
| SG (Salon Başk.) | 1650 | |
| SG (Gözetmen) | 1600 | |
| SG (Yed. Göz.) | 1200 | |
| SG (Yar.Eng.Gz.) | 2000 | |

---

## Ek: Merkezi Sınav Gösterge Önerisi

Entity ve serviste `CentralExamRole`:

```ts
// Önerilen yapı (indicator opsiyonel; yoksa fixed_amount kullanılır)
type CentralExamRole = {
  key: string;
  label: string;
  fixed_amount?: number;   // Sabit TL (Bina Sorumlusu gibi)
  indicator?: number;      // Gösterge (varsa coeff × indicator)
};
```

Varsayılan roller (gösterge bazlı):

| key | label | indicator |
|-----|-------|-----------|
| komisyon_baskani | Komisyon Başkanı | 1900 |
| komisyon_uyesi | Komisyon Üyesi | 1700 |
| salon_baskani | Salon Başkanı | 1650 |
| gozetmen | Gözetmen | 1600 |
| yedek_gozetmen | Yedek Gözetmen | 1200 |
| yrd_engelli_gozetmen | Yrd. Engelli Gözetmen | 2000 |
| bina_sinav_sorumlusu | Bina Sınav Sorumlusu | (fixed_amount: ayrı kaynak) |
