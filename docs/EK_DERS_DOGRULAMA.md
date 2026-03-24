# Ek Ders Hesaplama Doğrulama Dokümanı

Bu doküman Öğretmen Pro `extra-lesson-calc` sonuçlarının doğrulama senaryolarını ve formülleri içerir. **Öncelik: Sonuçların kesin doğruluğu.**

---

## 1. Giriş Alanları ve Eşleme

| Alan | Öğretmen Pro | Parametre / Not |
|------|--------------|------------------|
| Bütçe Dönemi Seçimi | Bütçe dönemi dropdown | `params` (superadmin tarafından tanımlı) |
| Ünvan Seçimi | Ünvan (Kadrolu/Sözleşmeli/Ücretli) | Ücretli: birim ücret ~%72.5; merkezi sınav gizli. Kadrolu/sözleşmeli aynı tarife. |
| Hes. Ay / Muh. Ay | Yok | Vergi istisna ayı için kullanılıyor |
| **GV İstisnası (Faydalanılan)** | GV istisna faydalanılan (TL) | Max 4.211,33 TL; maaşta kullanılan |
| **DV İst. Uyg. Mat. (Faydalanılan)** | DV istisna matrah faydalanılan (TL) | Max 33.030 TL; maaşta kullanılan matrah |
| En Son Öğrenim Durumu | Öğrenim durumu | Lisans / Y.Lisans / Doktora |
| Gündüz, Gece, Nöbet, Belleticilik, Sınav, Egzersiz, Hizmet İçi | Saatlik kalemler | `params.line_items` |
| %25 Fazla - Gündüz/Gece/Belleticilik/Nöbet | Özel eğitim kalemleri | `ozel_egitim_25_*` |
| Takviye Kursu - Gündüz/Gece | DYK Gündüz/Gece | `takviye_gunduz`, `takviye_gece` |
| İYEP - Gündüz/Gece | İYEP kalemleri | `iyep_gunduz`, `iyep_gece` |
| Merkezi Sınav [1–4] | Merkezi sınav görevi 1–4 | `central_exam_roles` |
| Gelir Vergisi Oranı | Gelir vergisi dilimi | %15–%40 veya Otomatik |
| Geçen Aylar Vergi Mat. Top. | Toplam vergi matrahı (geçen aylar) | Otomatik dilim için |

---

## 2. Birim Ücretler (2026 Ocak-Haziran, Lisans)

**Formül:** `Tutar = floor(1,387871 × Gösterge × 100) / 100` — kuruş bazında aşağı

| Kalem | Gösterge | Beklenen (TL/saat) | Öğretmen Pro | Durum |
|-------|----------|-------------------|--------------|-------|
| Gündüz | 140 | 194,30 | params'tan | ✓ |
| Gece | 150 | 208,18 | params'tan | ✓ |
| Nöbet | 140 | 194,30 | gündüz tarifesi | ✓ |
| Belleticilik | 140 | 194,30 | gündüz tarifesi | ✓ |
| Sınav Görevi | 140 | 194,30 | gündüz tarifesi | ✓ |
| Egzersiz | 140 | 194,30 | gündüz tarifesi | ✓ |
| Hizmet İçi | 140 | 194,30 | gündüz tarifesi | ✓ |
| %25 Gündüz | 175 | 242,88 | params'tan | ✓ |
| %25 Gece | 187,5 | 260,23 | params'tan | ✓ |
| %25 Nöbet | 187,5 | 260,23 | params'tan | ✓ |
| %25 Belleticilik | 175 | 242,88 | params'tan | ✓ |
| DYK Gündüz | 280 | 388,60 | params'tan | ✓ |
| DYK Gece | 300 | 416,36 | params'tan | ✓ |
| İYEP Gündüz | 140 | 194,30 | params'tan | ✓ |
| İYEP Gece | 150 | 208,18 | params'tan | ✓ |

---

## 3. Vergi Formülleri (MEB Uyumu)

### 3.1 Gelir Vergisi (GV)

**Resmi mantık:**
- Hesaplanan vergi = Ek ders brütü × vergi dilimi oranı
- **GV İstisna (Faydalanılan):** Maaş vb. ödemelerde zaten kullanılmış istisna (max 4.211,33 TL)
- Kalan istisna = 4.211,33 − Faydalanılan
- Kesilecek GV = max(0, Hesaplanan vergi − Kalan istisna)

**Doğru formül:**
```ts
remainingGvExempt = Math.max(0, gv_exemption_max - gvUsed);
gvKesinti = Math.max(0, taxOnBrut - remainingGvExempt);
```

### 3.2 Damga Vergisi (DV)

**Resmi mantık:**
- DV istisna matrahı = 33.030 TL (brüt asgari ücret)
- DV İst. Uyg. Mat. (Faydalanılan) = Maaşta kullanılmış matrah
- Kalan istisna = 33.030 − Faydalanılan
- DV matrahı = max(0, Ek ders brütü − Kalan istisna)
- DV kesintisi = DV matrahı × 7,59‰

### 3.3 Vergi Dilimi (Otomatik)

"Geçen Aylar Vergi Matrahı Toplamı" girilince dilim otomatik belirlenir. Dilim, **(Geçen aylar matrahı + Bu ay ek ders brütü)** toplamına göre belirlenmeli.

---

## 4. Test Senaryoları

### Senaryo A: Sadece Gündüz Saat (Lisans, sıfır istisna)
Gündüz 10 saat, GV/DV faydalanılan 0 → Brüt 1.943 TL, Net 1.943 TL.

### Senaryo B: GV İstisna Düşümü
Gündüz 20 saat, GV faydalanılan 3.000 TL → gvKesinti 0. GV faydalanılan 4.000 TL → gvKesinti 371,57 TL.

### Senaryo C: DV İstisna Düşümü
Brüt ~15k, DV faydalanılan 20k → DV kesintisi ~14,94 TL.

### Senaryo D: Vergi Dilimi
Geçen aylar 185k + brüt 20k → Toplam 205k → %20 dilimi → GV 4.000 TL.

### Senaryo E: Merkezi Sınav
Brüt = Katsayı × Gösterge. Bina Sınav Sorumlusu 2000 → 2.775,74 TL; Gözetmen 1600 → 2.220,59 TL.

---

## 5. Kod Kontrol Listesi

| Kontrol | Durum | Dosya / Satır | Not |
|---------|-------|---------------|-----|
| GV formülü: remainingExempt kullan | ✓ | computeResult | `gvKesinti = taxOnBrut - (gvMax - gvUsed)` |
| DV formülü | ✓ | computeResult | `remainingDvExempt = dvMax - dvUsed` |
| Vergi dilimi: geçen aylar + brüt | ✓ | computeResult | Otomatik modda `getTaxRateFromMatrah(taxMatrah + totalBrut)` |
| Kesintiler (GV, DV, SGK) yukarı | ✓ | computeResult | `round2Up` (ceil): 29,1452 → 29,15 TL |
| Birim ücret ölçekleme (Y.Lisans/Doktora) | ✓ | getUnitPrice | scaleDay/scaleNight |
| Merkezi sınav gösterge × katsayı | ✓ | computeResult | `role.indicator` varsa |
| Damga oranı 7,59‰ | ✓ | stamp_duty_rate / 1000 |

---

## 6. Otomatik Doğrulama Scripti

```bash
cd web-admin && npx tsx scripts/ek-ders-verify.ts
```

---

## 7. Manuel Doğrulama Adımları

1. Resmi hesaplama aracında aynı bütçe dönemi, ünvan ve öğrenim durumunu seçin.
2. Aynı saatleri girin (gündüz, gece, nöbet vb.).
3. Aynı GV/DV faydalanılan değerlerini girin.
4. Vergi dilimini aynı yapın (veya Otomatik + aynı geçen aylar matrahı).
5. HESAPLA'ya basın.
6. Öğretmen Pro'da brüt, GV kesintisi, DV kesintisi ve net tutarları karşılaştırın.
7. Fark varsa bu dokümandaki formüllere ve senaryolara göre kontrol edin.

---

*Son güncelleme: HESAPLAMA_KURALLARI_GUNCELLEME.md, MEB_BORDRO_ANALIZ.md, EK_DERS_ANALIZ.md ile uyumlu.*
