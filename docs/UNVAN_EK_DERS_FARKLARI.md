# Ünvan Bazlı Ek Ders Hesaplama Farkları

Bu doküman kadrolu, sözleşmeli ve ücretli öğretmenlerin ek ders hesaplamalarındaki resmi farkları özetler.

---

## 1. Birim Ücret (TL/saat)

| Ünvan | Gündüz (Lisans 2026) | Gece (Lisans 2026) | Kaynak |
|-------|---------------------|---------------------|--------|
| **Kadrolu** | 194,30 | 208,18 | Katsayı × 140 / × 150 |
| **Sözleşmeli** | 194,30 | 208,18 | Aynı (katsayı × gösterge) |
| **Ücretli** | 194,30 (varsayılan) / ~140,89 (MEB %72,5) | 208,18 / ~151 | `ucretli_unit_scale` parametresine göre |

**Ücretli öğretmen:** Varsayılan brüt kadrolu ile aynıdır (194,30 TL). Superadmin `ucretli_unit_scale` ile MEB %72,5 tarifesine geçilebilir (~140,89 TL).

---

## 2. Merkezi Sınav Görevi

| Ünvan | Merkezi sınav görevi |
|-------|----------------------|
| Kadrolu | ✓ Var |
| Sözleşmeli | ✓ Var |
| Ücretli | ✗ Yok |

Ücretli öğretmenler merkezi sınav görevlerine atanmaz; hesaplamada bu kalem gösterilmez.

---

## 3. Vergi ve Kesintiler

| Ünvan | GV/DV | Sigorta primi (SGK) |
|-------|-------|---------------------|
| Kadrolu | GV, DV (istisna uygulanır) | Kesilmez (memur rejimi) |
| Sözleşmeli | GV, DV (istisna uygulanır) | **Kesilir** (%14 işçi payı, 5510) |
| Ücretli | GV, DV (istisna uygulanır) | **Kesilir** (%14 işçi payı) |

**Sözleşmeli/Ücretli:** Ek ders brütünden SGK + İşsizlik işçi payı (%14) kesilir. Örnek: 194,30 TL brüt → 27,20 TL sigorta primi → Net 167,10 TL.

**Sözleşmeli:** Brüt birim ücret kadrolu ile aynıdır. Vergi kesintisi farkı, maaş ödemesinde kullanılan GV/DV istisnasından (gvUsed, dvUsed) kaynaklanır. Kullanıcı bu değerleri doğru girerek hesabı alır.

---

## 4. Ek Kurallar (Ücretli)

- **Öğrenim farkı yok:** MEB ücretli bordroda sadece 4 kalem (gündüz, gece, DYK gündüz, DYK gece); Lisans tarifesi × ucretliScale. Y.Lisans/Doktora farkı uygulanmaz.
- **DYK ücretli:** 2 × ücretli gündüz/gece (additif formül değil). Varsayılan: 1h DYK gündüz = 2 × 194,30 = 388,60 TL; MEB %72,5: 2 × 140,89 ≈ 281,78 TL.
- **Planlama saati:** Bazı kaynaklara göre ücretli öğretmenlerde "girilen ders saatinin yarısı kadar" planlama saati eklenir. Bu kural Öğretmen Pro'da henüz uygulanmıyor.

---

## 5. Öğretmen Pro Uygulaması

- **`computeResult` ücretli:** baseDay/baseNight = Lisans × ucretli_unit_scale (öğrenim yok). DYK = 2 × ücretli gündüz/gece.
- **Merkezi sınav:** Ücretli seçiliyken `centralExam` boş geçirilir; görev alanları gizlenir.
- **Parametreler:** `line_items`, `education_levels`, `sgk_employee_rate`, `ucretli_unit_scale` superadmin ayarlarından okunur.

---

## 6. Sözleşmeli Öğretmen Kesintileri (Öğrenim ve Diğer Verilere Göre)

| Veri | Etki |
|------|------|
| **Öğrenim durumu** | Lisans/Y.Lisans/Doktora farklı birim ücret (params.education_levels). Brüt toplam bu değerlere göre hesaplanır; tüm kesintiler brüt üzerinden. |
| **GV (Gelir Vergisi)** | Vergi dilimi (geçen aylar matrah + bu ay brüt), GV istisna (maaşta kullanılan), vergi dilimleri (params.tax_brackets). Kullanıcı gvUsed ve taxMatrah girer. |
| **DV (Damga Vergisi)** | Brüt matrah, DV istisna (params.dv_exemption_max), maaşta kullanılan (dvUsed). `dvMatrah = max(0, totalBrut - kalan_istisna)`. |
| **SGK+İşsizlik** | Sadece sözleşmeli ve ücretli için. `sgkKesinti = totalBrut × (sgk_employee_rate/100)`. Oran params'tan (%14 varsayılan). Kadrolu: 0. |
| **Brüt toplam** | Saat × birim ücret (öğrenim düzeyine göre) + merkezi sınav kalemleri. Sözleşmeli birim ücret kadrolu ile aynı (ünvan ölçeği 1). |

**Kontrol özeti:** Sözleşmeli için öğrenim durumu doğru birim ücreti belirler → brüt doğru → GV, DV, SGK brüt üzerinden doğru hesaplanır.

---

*Kaynaklar: MEB, mebhocam.com, MuhasebeTR, 439 sayılı Kanun, 657 DMK 89. madde.*
