# Yıllık Plan İçeriği Oluşturma – Pratik Yol

Çalışma takvimi ve ders içeriğine göre plan içeriği oluşturma için pratik akış önerisi.

---

## 1. Mevcut Durum

- **work_calendar:** Öğretim yılına göre hafta listesi (week_order, ay, hafta_label, is_tatil)
- **yillik_plan_icerik:** Ders/sınıf/yıl bazlı hafta satırları (ünite, konu, kazanım, ders_saati)
- **Sorun:** Her hafta için tek tek kayıt ekleniyor; çalışma takvimindeki haftalar ile ilişki elle kuruluyor

---

## 2. Pratik Akış Önerisi

### 2.1 Akış sırası (önerilen)

```
1. Çalışma Takvimi dolu mu? → Hayır ise önce doldur (MEB takvimi / elle)
2. Ders + Sınıf + Yıl seç → "Eksik haftaları iskelet oluştur"
3. Oluşan boş satırları tek tek düzenle (ünite, konu, kazanım)
   veya
4. (İleride) GPT taslak → düzenle → kaydet
   veya
5. (İleride) Excel import
```

### 2.2 Temel adımlar

| Adım | Ne yapılır | Kim |
|------|------------|-----|
| 1 | Çalışma takvimini doldur (36 hafta, ay, tatil) | Superadmin |
| 2 | Yıllık Plan İçerikleri → Ders, sınıf, yıl seç | Superadmin |
| 3 | "Çalışma takviminden iskelet oluştur" | Superadmin |
| 4 | Eksik haftalar için boş satırlar otomatik eklenir (tatil haftaları ders_saati=0, tatil_label) | Sistem |
| 5 | Satırları düzenle (ünite, konu, kazanım) | Superadmin |

---

## 3. Önerilen Özellikler

### 3.1 Eksik haftaları iskelet oluştur (öncelik 1)

**Davranış:**
- Ders + sınıf + yıl seçili
- Backend: `work_calendar` ile o yılın haftalarını al
- `yillik_plan_icerik` içinde bu ders/sınıf/yıl için hangi week_order'lar eksik bul
- "X hafta eksik. İskelet oluştur" butonu
- Tıklandığında eksik week_order'lar için boş kayıt oluştur
- Tatil haftaları: `ders_saati=0`, `belirli_gun_haftalar` veya `konu` = tatil_label

**API:**
```
POST /yillik-plan-icerik/seed-from-calendar
Body: { subject_code, subject_label, grade, section?, academic_year }
Response: { created: number, skipped: number, week_orders: number[] }
```

### 3.2 Hafta seçici (formda) (öncelik 2)

**Davranış:**
- Yeni kayıt eklerken `week_order` sayı yerine dropdown
- `work_calendar`’dan o yılın haftaları çekilir
- Seçenekler: "1. Hafta: 8-12 Eylül", "2. Hafta: 15-19 Eylül" … (tatil haftaları "(Tatil)" ile işaretli)
- Kullanıcı okunabilir hafta seçer, backend week_order gönderilir

**API:** Mevcut `GET /work-calendar?academic_year=X` kullanılır.

### 3.3 Eksik hafta uyarısı (öncelik 3)

**Davranış:**
- Liste yüklendiğinde: "Bu ders için 36 haftadan 12'si eksik" uyarısı
- "Eksikleri oluştur" linki → 3.1 ile aynı akış

### 3.4 GPT taslak (Faz 3 – doc’ta mevcut)

- MEB müfredat + ders + sınıf → haftalık konu/kazanım taslağı
- Superadmin düzenleyip kaydeder

### 3.5 Excel toplu import (ileride)

- Şablon: Hafta, Ünite, Konu, Kazanım, Ders saati
- work_calendar ile hafta eşlemesi

---

## 4. Veri Uyumu Kuralları

1. **Hafta kaynağı:** `work_calendar` tek kaynak; `yillik_plan_icerik.week_order` buradaki `week_order` ile eşleşmeli
2. **Tatil haftaları:** `work_calendar.is_tatil=true` olanlar için plan satırı oluşturulabilir (ders_saati=0, tatil etiketi) veya atlanabilir (evrak merge’de boş)
3. **Öğretim yılı:** Filtre ve iskelet için `academic_year` zorunlu; takvim o yıla ait olmalı

---

## 5. Uygulama Sırası

| # | Özellik | Efor | Etki |
|---|---------|------|------|
| 1 | `POST /yillik-plan-icerik/seed-from-calendar` | Orta | Yüksek |
| 2 | UI: "İskelet oluştur" butonu + eksik hafta sayısı | Düşük | Yüksek |
| 3 | Form: Hafta dropdown (work_calendar kaynaklı) | Düşük | Orta |
| 4 | Eksik hafta uyarı banner’ı | Düşük | Orta |

---

## 6. Özet

- Önce **çalışma takvimi** doldurulur
- **İskelet oluştur** ile eksik haftalar tek seferde eklenir
- **Hafta dropdown** ile form daha okunabilir olur
- Sonrasında satırlar tek tek düzenlenir veya GPT/Excel ile desteklenir
