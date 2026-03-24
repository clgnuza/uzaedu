# Ders Programı Plan Tasarımı – Başlangıç/Bitiş Tarihi ve Yayınlama

**Hedef:** Ders programına geçerlilik tarihleri ekleme, çakışma önleme, yayınlama bildirimi.

---

## 1. Mevcut Durum

| Özellik | Durum |
|---------|-------|
| teacher_timetable | Flat tablo: school_id, user_id, day_of_week, lesson_num, class_section, subject. Tarih yok. |
| Excel yükleme | Anında tüm kayıtları siler, yeni kayıtları ekler. Taslak/yayın ayrımı yok. |
| Nöbet entegrasyonu | duty.service teacher_timetable'dan okur (getByDate, getLessonCountByDayForUsers). |
| Bildirim | timetable.published yok; duty.published mevcut (Nöbet modülü). |

---

## 2. Önerilen Veri Modeli

### 2.1 Yeni Entity: school_timetable_plan

Nöbet `DutyPlan` modeline benzer yapı:

```sql
CREATE TABLE school_timetable_plan (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES school(id) ON DELETE CASCADE,
  name VARCHAR(128),           -- "2025-2026 1. Dönem", "Şubat Planı"
  valid_from DATE NOT NULL,    -- Geçerlilik başlangıç (örn. 2025-09-15)
  valid_until DATE NOT NULL,   -- Geçerlilik bitiş (örn. 2026-01-23)
  status VARCHAR(32) DEFAULT 'draft',  -- draft | published
  published_at TIMESTAMPTZ,
  created_by UUID REFERENCES "user"(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  academic_year VARCHAR(16)    -- "2025-2026"
);
```

### 2.2 teacher_timetable'a plan_id Ekleme

```sql
ALTER TABLE teacher_timetable
  ADD COLUMN plan_id UUID REFERENCES school_timetable_plan(id) ON DELETE CASCADE;
```

- `plan_id IS NULL` → Eski model (geriye uyumluluk)
- `plan_id` dolu → Hangi plana ait

**Alternatif:** Ayrı tablo `school_timetable_plan_entry` (plan_id, user_id, day_of_week, lesson_num, class_section, subject). Bu durumda `teacher_timetable` sadece "aktif" planın kopyası olarak tutulabilir (nöbet/duty sorguları değişmez).

### 2.3 Tercih Edilen Yol

- **Plan entry tablosu** kullanmak daha temiz:
  - `school_timetable_plan_entry` (plan_id, user_id, day_of_week, lesson_num, class_section, subject)
  - `teacher_timetable` → Sadece **aktif** planın verisi (publish sırasında kopyalanır)
  - Böylece duty/getByDate/getByMe akışı değişmez; sadece upload → publish adımı eklenir.

---

## 3. Çakışma Önleme (Overlap Check)

Yayınlama sırasında, nöbet modülündeki mantıkla benzer:

```typescript
// valid_from, valid_until ile çakışan plan var mı?
const conflict = await planRepo
  .createQueryBuilder('p')
  .where('p.school_id = :schoolId', { schoolId })
  .andWhere('p.status = :status', { status: 'published' })
  .andWhere('p.id != :id', { id: planId })
  .andWhere('p.valid_from <= :end', { end: validUntil })
  .andWhere('p.valid_until >= :start', { start: validFrom })
  .getOne();

if (conflict) {
  throw new BadRequestException({
    code: 'TIMETABLE_PLAN_OVERLAP',
    message: `Bu tarih aralığı başka bir programla çakışıyor: ${conflict.name} (${conflict.valid_from} – ${conflict.valid_until}). Bitiş tarihini düzenleyin veya mevcut programı sonlandırın.`,
  });
}
```

- Aynı okulda, iki farklı planın `[valid_from, valid_until]` aralıkları kesişmemeli.
- Bitiş tarihi düzenleme: Plan yayınlandıktan sonra `valid_until` güncellenebilir; yine overlap kontrolü yapılır.

---

## 4. Yayınlama Akışı

```
1. Admin Excel yükler → Taslak plan oluştur (status=draft)
2. Admin "Bitiş tarihi" seçer (varsayılan: dönem sonu, örn. 31 Ocak)
3. Admin "Yayınla" der
4. Overlap kontrolü
5. teacher_timetable temizlenir (veya plan_id ile filtre), yeni entries eklenir
6. Plan status=published, published_at=now
7. Okuldaki tüm öğretmenlere Inbox + Push: timetable.published
```

### 4.1 Geriye Uyumluluk

- Plan sistemi olmadan da çalışsın:
  - `school_timetable_plan` boşsa → Eski akış (upload doğrudan teacher_timetable'a)
  - Plan varsa → Taslak oluştur, yayınlama zorunlu

Veya başta her zaman plan kullan:
- Upload → Taslak plan + entries
- Yayınla → Aktif hale gelir
- valid_from = bugün, valid_until = admin seçimi (varsayılan: akademik yıl sonu)

---

## 5. Bildirim (timetable.published)

### 5.1 NOTIFICATION_MATRIX Güncellemesi

| event_type | Açıklama | Inbox | Push | Hedef |
|------------|----------|-------|------|-------|
| timetable.published | Ders programı yayınlandı | ✅ | ✅ | Okuldaki tüm öğretmenler |

### 5.2 target_screen

- `ders-programi` veya `ders-programi/me`

### 5.3 Örnek Payload

```typescript
await notificationsService.createInboxEntry({
  user_id: teacherId,
  event_type: 'timetable.published',
  entity_id: plan.id,
  target_screen: 'ders-programi',
  title: 'Ders programı güncellendi',
  body: `Okul ders programınız yayınlandı (${valid_from} – ${valid_until}). Programınızı görüntüleyin.`,
});
```

---

## 6. UI/UX Tasarım Önerileri

### 6.1 Excel Yükle Sayfası (Admin)

**Mevcut:** Yükle → Anında aktif.

**Yeni akış:**
1. Excel Yükle butonu → Dosya seç
2. Yükleme sonrası **Taslak önizleme** kartı:
   - Öğretmen sayısı, toplam ders
   - **Başlangıç tarihi** (varsayılan: bugün)
   - **Bitiş tarihi** (date picker; varsayılan: cari dönem sonu, örn. 31 Ocak)
3. **"Yayınla"** butonu → Overlap kontrolü → Yayınla → Bildirim

### 6.2 Program Listesi (Admin)

- Yayınlanmış planlar listesi: Ad, Geçerlilik (başlangıç–bitiş), Durum
- Bitiş tarihini düzenle (sadece gelecek planlar)
- Geçmiş planlar salt okunur

### 6.3 Öğretmen Görünümü

- Ana sayfa tarih bazlı: Bugün hangi plan geçerliyse o gösterilir.
- Plan yoksa veya tarih aralığı dışındaysa: "Bu tarih için program tanımlı değil" mesajı.

---

## 7. Uygulama Adımları

| Sıra | Görev | Zorluk |
|------|-------|--------|
| 1 | Migration: school_timetable_plan, school_timetable_plan_entry | Orta |
| 2 | teacher_timetable plan_id (veya plan_entry kullan) | Orta |
| 3 | Upload → Taslak plan oluştur (anında yayınlama kaldır) | Orta |
| 4 | PATCH publish endpoint: valid_from, valid_until, overlap check | Orta |
| 5 | getBySchool/getByMe: Tarih bazlı plan seçimi | Düşük |
| 6 | timetable.published bildirimi (Inbox + Push) | Düşük |
| 7 | NOTIFICATION_MATRIX, API_CONTRACT, target_screen güncellemesi | Düşük |
| 8 | Frontend: Excel yükle sonrası tarih seçici + Yayınla | Orta |
| 9 | Frontend: Plan listesi, bitiş tarihi düzenleme | Orta |

---

## 8. Nöbet/Duty Etkisi

- duty.service `getByDate`, `getLessonCountByDayForUsers` teacher_timetable kullanıyor.
- Plan modeliyle: teacher_timetable sadece **aktif** planın verisini tutacak (publish sırasında güncellenir).
- Sorgular değişmez; sadece "aktif veri" plana göre doldurulur.

---

## 9. Karar Notları

- **Geriye uyumluluk:** İlk kurulumda plan yoksa, upload doğrudan teacher_timetable'a yazılabilir (plan_id=null). Sonra plan özelliği açıldığında migrate edilir.
- **Bitiş tarihi düzenleme:** Sadece published planlarda, valid_until gelecekteyse izin ver. Overlap kontrolü tekrarlanır.
- **Tasarım:** Mosaic/Duty sayfalarıyla tutarlı (kartlar, stepper, date picker, onay modal).
