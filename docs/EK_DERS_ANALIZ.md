# Ek Ders Hesaplama Analizi

Bu doküman ek ders hesaplama kurallarını özetler. **Tüm birim ücretler katsayı, gösterge ve çarpanlardan hesaplanır; sabit TL değildir.**

**Kaynaklar:** 439 sayılı Kanun, 657 DMK 89, MEB Ek Ders Kararı (BKK), Mali ve Sosyal Haklar Genelgesi, GV Tebliği Seri 332, [hesaplama.net](https://ek-ders-ucreti.hesaplama.net/), [mebdenhaber.com](https://mebdenhaber.com).

---

## 0. Hesaplama Formülü (Resmi)

### Ana formül (tek kaynak)
```
Brüt (TL/saat) = Aylık Katsayı × Gösterge × Kalem Çarpanı
Brüt (TL)      = Saat × (Aylık Katsayı × Gösterge × Kalem Çarpanı)
```

| Parametre | Kaynak | 2026 Oca-Haz | Açıklama |
|-----------|--------|--------------|----------|
| **Aylık Katsayı** | Mali ve Sosyal Haklar Genelgesi | 1,387871 | 6 ayda bir güncellenir |
| **Gündüz göstergesi** | Bakanlar Kurulu Kararı (MEB Ek Ders) | 140 | Sabit |
| **Gece göstergesi** | Bakanlar Kurulu Kararı | 150 | Tatil, 18:00 sonrası, Cmt-Paz |
| **Kalem çarpanı** | MEB Ek Ders Kararı | 1; 1,25; 2 | Normal; özel eğitim; DYK |

### 2026 Ocak-Haziran lisans örnek
- Gündüz: 1,387871 × 140 × 1 = **194,30 TL/saat**
- Gece: 1,387871 × 150 × 1 = **208,18 TL/saat**
- Özel eğitim: × 1,25 → 242,88 / 260,23 TL
- DYK/Takviye: × 2 → 388,60 / 416,36 TL

### Özel çarpanlar
| Kalem türü | Çarpan | Açıklama |
|------------|--------|----------|
| Normal gündüz/gece | 1× | Katsayı × 140 veya × 150 |
| Özel eğitim (%25 fazla) | 1,25× | Tüm ek dersleri (nöbet dahil) %25 artırımlı |
| Takviye/DYK kursu | 2× | Destekleme ve Yetiştirme Kursu — saatlik 2 kat |
| İYEP | 1× | Normal ek ders tarifesi (gündüz/gece ayrımı var) |
| Nöbet, belleticilik, sınav, egzersiz, hizmet içi | Gündüz tarifesi | Gece-gündüz farkı **yok**; hepsi gündüz (140) üzerinden |

### Kalem kuralları özeti
- **Gündüz:** Hafta içi 18:00 öncesi, yüz yüze eğitim, planlama, staj, belleticilik, sınav vb.
- **Gece:** Hafta içi 18:00 sonrası, Cumartesi-Pazar, yarıyıl/yaz tatili.
- **Nöbet, belleticilik, sınav görevi, egzersiz, hizmet içi:** Gece-gündüz ayrımı yapılmaz; **gündüz birim ücreti** uygulanır.
- **Belleticilik:** Yatılı okullarda; her görev 4 saat, 24 saat nöbette +3 saat ek.
- **Sınav görevi:** Her komisyon üyeliği/gözcülük 5 saat ek ders.
- **Takviye (DYK):** Haftaiçi 18:00 öncesi = gündüz tarifesi × 2; sonrası/tatil = gece tarifesi × 2.

---

## 1. Bütçe Dönemi

| Dönem | Artış/Oran | Açıklama |
|-------|------------|----------|
| 2027 Temmuz-Aralık | %4 | Gelecek dönem |
| 2027 Ocak-Haziran | %5 | Gelecek dönem |
| 2026 Temmuz-Aralık | %7 | Güncel |
| 2026 Ocak-Haziran | %18,6 | Güncel |
| 2026 Ocak (14 Günlük Fark) | — | Kıst maaş farkı hesaplama |

- Her bütçe dönemi kendi katsayı setine sahiptir.
- `semester_code` formatı: `YYYY-1` (Ocak-Haziran) veya `YYYY-2` (Temmuz-Aralık).

---

## 2. Ünvan (Title)

| Ünvan | Açıklama |
|-------|----------|
| Profesör | Yükseköğretim |
| Doçent | Yükseköğretim |
| Doktor Öğretim Üyesi | Yükseköğretim |
| Öğretim Görevlisi ve Okutman | Yükseköğretim |
| Kadrolu Öğretmen | MEB |
| Sözleşmeli Öğretmen | MEB |
| Ücretli Öğretmen | MEB |

- Her ünvan için farklı birim ücret katsayıları/kalemi olabilir.
- Öğretmen Pro'da: superadmin her kalem için birim ücret (TL/saat) tanımlar; ünvan seçimi teacher tarafında hesaplama formunda yapılır.

---

## 3. Hesap Ayı / Muhasebe Ayı

- **Hesaplanacak ay:** Ocak–Haziran (ilk yarıyıl) veya Temmuz–Aralık (ikinci yarıyıl).
- **Muhasebeleştirilen ay:** MEB yazısına göre hesaplanacak ayı takip eden ay.
- Vergi istisnalarının doğru uygulanması için ay seçimi önemli.

---

## 4. Vergi İstisnaları ve Hesaplama (2026)

### Gelir Vergisi (GV)
- **Asgari ücret istisnası:** Brüt asgari ücretten SGK ve işsizlik düşüldükten sonra kalan tutara isabet eden ücret geliri vergiden muaf (GVK 23/18, Ücret İstisnası Tebliği).
- **Muhasebe sırası:** Maaş önce ödenirse, GV istisnasının bir kısmı maaşta kullanılır. Ek ders (takip eden ay) ödendiğinde **"GV İstisnası (Faydalanılan)"** = o ay maaştan yararlanılan istisna tutarı. Ek ders brütü üzerinden hesaplanan vergiden bu tutar düşülür; kalan vergi kesilir.
- **Max tutar (örnek):** ~4.211 TL — aylık istisnaya isabet eden vergi tutarı. Resmi tebliğ ile güncellenir.

### Damga Vergisi (DV)
- **İstisna matrahı:** Brüt asgari ücret = **33.030 TL** (2026). Bu tutara kadar olan ücret kısmı damga vergisinden istisna.
- **DV oranı:** Binde 7,59 (%0,759).
- **"DV İst. Uyg. Mat. (Faydalanılan)":** Maaş vb. ödemelerde zaten kullanılmış matrah. Ek ders için kalan = 33.030 − faydalanılan.

---

## 5. Öğrenim Durumu ve Birim Ücret (2026 Ocak-Haziran – Kadrolu/Sözleşmeli Lisans)

| Öğrenim | Gündüz (TL/saat) | Gece/Tatil (TL/saat) | Formül |
|---------|------------------|----------------------|--------|
| Lisans | 194,30 | 208,18 | Katsayı × 140 / × 150 |
| Yüksek Lisans | 207,90 | 222,75 | Ek gösterge farkı |
| Doktora | 233,16 | 249,82 | Ek gösterge farkı |
| Özel Eğitim (%25) | 242,88 | 260,23 | Lisans × 1,25 |
| Takviye (DYK) Lisans | 388,60 | 416,36 | 2×Lisans |
| Takviye (DYK) Y.Lisans | 402,21 | 430,93 | Lisans + Y.Lisans (additif formül) |

- Bu değerler resmi katsayılara göre hesaplanır; superadmin ayarlarından okunur.

---

## 6. Kalemler (Line Items)

### 6.1 Normal Ek Ders

| Kalem | Birim Ücret | Açıklama |
|-------|-------------|----------|
| Gündüz | Gündüz tarifesi (140) | Yüz yüze eğitim, işletmede staj, planlama, belleticilik, sınav vb. |
| Gece | Gece tarifesi (150) | Hafta içi 18:00 sonrası, yarıyıl/yaz tatili, Cumartesi-Pazar |
| Nöbet Görevi | Gündüz tarifesi | Gece-gündüz farkı **yok**; gündüz birim ücret uygulanır |
| Belleticilik | Gündüz tarifesi | 4 saat/görev; 24h nöbet +3 saat. Gece farkı yok |
| Sınav Görevi | Gündüz tarifesi | 5 saat/komisyon üyeliği veya gözcülük. Gece farkı yok |
| Egzersiz | Gündüz tarifesi | Egzersiz görevi |
| Hizmet İçi | Gündüz tarifesi | Hizmet içi eğitim |

### 6.2 Özel Eğitim (%25 Fazla)

| Kalem | Açıklama |
|-------|----------|
| %25 Fazla - Gündüz | Özel eğitim gündüz |
| %25 Fazla - Gece | Özel eğitim gece |
| %25 Fazla - Belleticilik | Özel eğitim belleticilik |
| %25 Fazla - Nöbet Görevi | Özel eğitim nöbet |

### 6.3 Takviye Kursu (DYK – Destekleme ve Yetiştirme)

| Kalem | Birim Ücret | Açıklama |
|-------|-------------|----------|
| Takviye Kursu - Gündüz | Normal gündüz × **2** | Hafta içi 18:00 öncesi (≈388 TL/saat 2026 Oca-Haz) |
| Takviye Kursu - Gece | Normal gece × **2** | Hafta içi 18:00 sonrası, tatil, hafta sonu (≈416 TL/saat) |

### 6.4 İYEP Görevi (İlkokullarda Yetiştirme Programı)

| Kalem | Birim Ücret | Açıklama |
|-------|-------------|----------|
| İYEP - Gündüz | Normal gündüz | Normal ek ders tarifesi |
| İYEP - Gece | Normal gece | Normal ek ders tarifesi |

### 6.5 Merkezi Sınav Görevi

**Formül:** Çoğu rol için Brüt = Katsayı × Gösterge. E-Sınav rolleri sabit brüt TL.

| Görev Ünvanı | Tür | Gösterge / Sabit | 2026 Oca-Haz Brüt (≈) |
|--------------|-----|------------------|------------------------|
| Bina Sınav Sorumlusu | Gösterge | 2000 | 2.775,74 TL |
| Bina Yöneticisi (Komisyon Başk.) | Gösterge | 1900 | 2.636,95 TL |
| Bina Yön. Yard. (Komisyon Üyesi) | Gösterge | 1700 | 2.359,38 TL |
| Salon Başkanı | Gösterge | 1650 | 2.289,99 TL |
| Gözetmen | Gösterge | 1600 | 2.220,59 TL |
| Yedek Gözetmen | Gösterge | 1200 | 1.665,45 TL |
| Yar. Engelli Gözetmen | Gösterge | 2000 | 2.775,74 TL |
| Cezaevi Salon Başkanı | Gösterge | 1650 | 2.289,99 TL |
| Cezaevi Gözetmen | Gösterge | 1600 | 2.220,59 TL |
| Salon Başkanı (E-Sınav) | Gösterge | 1300 | 1.804 TL |
| Gözetmen (E-Sınav) | Gösterge | 1200 | 1.665 TL |
| Salon Başkanı %20 (E-Sınav) | Gösterge | 1560 | 2.165 TL |
| Gözetmen %20 (E-Sınav) | Gösterge | 1440 | 1.999 TL |

- Gösterge rolleri bütçe dönemi katsayısına göre otomatik güncellenir.
- resmi uygulamada 4 görev slotu; öğretmen ayda en fazla 4 farklı merkezi sınav görevi alabilir.

---

## 7. Gelir Vergisi Oranları

| Matrah Dilimi | Oran |
|---------------|------|
| 0 - 190.000 TL | %15 |
| 190.000 - 400.000 TL | %20 |
| 400.000 - 1.500.000 TL | %27 |
| 1.500.000 - 5.300.000 TL | %35 |
| 5.300.000 TL üzeri | %40 |

- Öğretmen "Otomatik" seçerse geçen aylar vergi matrahı toplamına göre dilim belirlenir.
- Superadmin `tax_brackets` JSON ile bu dilimleri tanımlar.

---

## 8. Damga Vergisi

- Oran: %7,59 (yıllık güncelleme ile değişebilir).
- İstisna matrahı: 33.030 TL'ye kadar (2026).

---

## 9. Hesaplama Akışı (Detay)

### Adım 1: Brüt (her kalem)
- Saatlik: `Brüt = Saat × (Aylık Katsayı × Gösterge × Çarpan)` — gösterge 140 veya 150, çarpan 1 / 1,25 / 2.
- Sabit (merkezi sınav): Doğrudan TL tutar.
- Toplam brüt = tüm kalemlerin toplamı.

### Adım 2: Gelir Vergisi
- Hesaplanan vergi = Toplam brüt × vergi dilimi oranı (kademeli tarife uygulanır).
- **İstisna düşümü:** Hesaplanan vergi − GV istisna (faydalanılan) = Kesilecek GV. (Faydalanılan = maaş vb. ödemelerde kullanılmış kısım; max ~4.211 TL.)
- Negatif olursa kesinti yok; kalan istisna sonraki ödemeye devredilir.

### Adım 3: Damga Vergisi
- DV matrahı = Toplam brüt − DV istisna uygulanan matrah (max 33.030 TL).
- Kesilecek DV = DV matrahı × 7,59‰.

### Adım 4: Net
- Net = Brüt − GV − DV.

---

## 10. Tutarlılık Kontrolü

### 10.1 Birim Ücretler (2026 Oca-Haz, Lisans)

| Kalem | Bizim Hesaplanan | Resmi | Durum |
|-------|------------------|----------------|-------|
| Gündüz | 194,30 | 194,30 | ✓ Tutarlı |
| Gece | 208,18 | 208,18 | ✓ Tutarlı |
| Özel Eğitim Gündüz | 242,88 | 242,88 | ✓ Tutarlı |
| Özel Eğitim Gece | 260,23 | 260,23 | ✓ Tutarlı |
| Takviye Gündüz | 388,60 | 388,60 | ✓ Tutarlı |
| Takviye Gece | 416,36 | 416,36 | ✓ Tutarlı |
| Nöbet, Belleticilik, Sınav, Egzersiz, Hizmet İçi | 194,30 (gündüz) | Gündüz tarifesi | ✓ Tutarlı |
| İYEP Gündüz/Gece | 194,30 / 208,18 | Normal ek ders | ✓ Tutarlı |

**Formül:** `1,387871 × 140 = 194,30`, `1,387871 × 150 = 208,18` — resmi katsayı ile örtüşür.

### 10.2 Vergi Parametreleri

| Parametre | Bizim | Resmi | Durum |
|-----------|-------|--------|-------|
| GV İstisna max | 4.211,33 TL | 4.211,33 TL | ✓ Tutarlı |
| DV İstisna matrah max | 33.030 TL | 33.030 TL | ✓ Tutarlı |
| Damga vergisi oranı | 7,59‰ | 7,59‰ | ✓ Tutarlı |
| GV dilimleri | %15–%40 (190k, 400k, 1,5M, 5,3M) | Aynı | ✓ Tutarlı |

### 10.3 Kalem Eşlemesi

| Resmi kalem | Öğretmen Pro key | Not |
|--------------|------------------|-----|
| Gündüz | gunduz | ✓ |
| Gece, EDYGG - Gece | gece | EDYGG ayrı kalem değil, gece tarifesi |
| Nöbet Görevi | nobet | ✓ |
| Belleticilik | belleticilik | ✓ |
| Sınav Görevi | sinav_gorevi | ✓ |
| Egzersiz | egzersiz | ✓ |
| Hizmet İçi | hizmet_ici | ✓ |
| %25 Fazla - Gündüz | ozel_egitim_25_gunduz | ✓ |
| %25 Fazla - Gece | ozel_egitim_25_gece | ✓ |
| %25 Fazla - Belleticilik | ozel_egitim_25_belleticilik | ✓ |
| %25 Fazla - Nöbet Görevi | ozel_egitim_25_nobet | ✓ |
| Takviye Kursu - Gündüz | takviye_gunduz | ✓ |
| Takviye Kursu - Gece | takviye_gece | ✓ |
| İYEP - Gündüz / Gece | iyep_gunduz, iyep_gece | ✓ |

### 10.4 Farklar / Eksikler

- **EDYGG (Eğitim Dışı Yarıyıl/Gece Görevi):** resmi uygulamada "%25 Fazla - EDYGG - Gündüz/Gece" ayrı kalem; bizde gece/gündüz zaten ayrı; EDYGG muhtemelen aynı tarife — ek kalem gerekmez.
- **Merkezi sınav görevleri:** resmi uygulamada daha fazla rol (Cezaevi Salon Başkanı, E-Sınav varyantları vb.); bizde temel roller var. Yeni roller superadmin ile eklenebilir.
- **Ünvan (Lisans/Y.Lisans/Doktora):** resmi uygulama ünvan bazlı farklı gösterge kullanır; bizde şu an tek set (lisans). İleride `ExtraLessonParams` ünvan bazlı genişletilebilir.
- **GV kademeli tarife:** Gerçek hesaplamada matrah dilimlere göre kademeli vergi (ilk 190k %15, 190k–400k arası %20 …) uygulanır. Basit oran × matrah yerine kademeli hesaplama yapılmalı.

### 10.5 Sonuç

Birim ücret formülleri, vergi parametreleri ve kalem eşlemesi resmi referans ile **tutarlı**. Eksikler: EDYGG ayrımı (opsiyonel), merkezi sınav rol çeşitliliği, ünvan bazlı katsayılar, GV kademeli tarife uygulaması.

---

## 11. Öğretmen Pro Entegrasyonu

- **Backend:** `ExtraLessonParams` entity; `semester_code`, `line_items` (JSON), `tax_brackets`, `gv_exemption_max`, `dv_exemption_max`, `stamp_duty_rate`, `is_active`, `valid_from`, `valid_to`.
- **Superadmin:** Ek Ders Parametreleri sayfasında bütçe dönemleri CRUD, kalem birim ücretleri, vergi dilimleri, istisna limitleri.
- **Teacher:** Mobil/Flutter tarafında bu parametreleri çekerek hesaplama yapar; ay seçimi, saat girişi, vergi dilimi seçimi.

---

## 12. Hesaplama.net Karşılaştırması

[ek-ders-ucreti.hesaplama.net](https://ek-ders-ucreti.hesaplama.net/) referans alınarak parametre incelemesi.

### 12.1 Özellik Karşılaştırması

| Alan | Hesaplama.net | Öğretmen Pro |
|------|---------------|--------------|
| Hesaplama dönemi | Ay + Yıl (2013–2026) | Aktif parametre seti |
| Ünvan | MEB Kadrolu/Sözleşmeli/Ücretli; YÖK Profesör/Doçent/Öğr.Gör./Okutman | Tek set (Lisans) |
| Öğrenim durumu | Lisans / Y.Lisans / Doktora | Sadece Lisans |
| Statü | Ücretli, Emekli Ücretli, Uzman, Usta Öğretici | Yok |
| GV dilimi | %15–%35 veya Toplam Vergi Matrahı | %15–%40 (manuel) |
| Toplam vergi matrahı | Var (otomatik dilim) | Yok |

### 12.2 MEB Birim Ücretleri (2026, hesaplama.net)

| Görev | Gündüz | Gece | Öğretmen Pro |
|-------|--------|------|--------------|
| Lisans | 194,30 | 208,18 | ✓ |
| Y.Lisans | 207,90 | 222,75 | Eksik |
| Doktora | 233,16 | 249,82 | Eksik |
| Özel Eğitim | 242,88 | 260,23 | ✓ |
| Cezaevi Görevi | 242,88 | 260,23 | Özel eğitim ile aynı |
| Yetiştirme Kursu | 388,60 | 416,36 | ✓ |

### 12.3 Genişletme Önerileri

1. **Öğrenim:** Y.Lisans (207,90/222,75) ve Doktora (233,16/249,82) birim ücret setleri.
2. **Toplam vergi matrahı:** Geçen aylar toplamı ile otomatik dilim belirleme.
3. **Hesaplama dönemi:** Ay + yıl seçimi ile parametre seti eşlemesi.
4. **YÖK ünvanları:** Profesör/Doçent/Öğr.Gör./Okutman için ayrı tarife seti.

---

*Kaynaklar: [ek-ders-ucreti.hesaplama.net](https://ek-ders-ucreti.hesaplama.net/). Katsayılar resmi yayımlara göre güncellenir; kesin sonuç için kurumunuza danışınız.*
