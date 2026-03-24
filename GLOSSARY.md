# Ortak Terminoloji Sözlüğü

Kod, API ve dokümanlarda tutarlı kullanım için terim eşlemesi.

---

## 1. Roller ve Kullanıcı

| Türkçe | Kod / API | Açıklama |
|--------|-----------|----------|
| Süper yönetici / Merkez yönetim | superadmin | Tüm sistem, tüm okullar |
| Okul yöneticisi / Müdür / İdare | school_admin | Tek okul kapsamı |
| Öğretmen | teacher | Ana kullanıcı; kendi verisi + okul yayınları |
| Kullanıcı | user | Sistemdeki hesap (her rol bir user) |

**Kod:** Rol sabitleri `superadmin`, `school_admin`, `teacher` (küçük harf, alt çizgi).

---

## 2. Okul ve Kurum

| Türkçe | Kod / API | Açıklama |
|--------|-----------|----------|
| Okul | school | Kurum (tek bir school_id) |
| Okul id | school_id | Her okula ait benzersiz id (UUID veya sayı) |
| Okul duyurusu | announcement | Okul admin tarafından yayınlanan duyuru |
| Okul tanıtımı | school_profile | Okulun tanıtım metni, galeri (Okullar Tanıtım modülü) |

---

## 3. Kimlik ve Erişim

| Türkçe | Kod / API | Açıklama |
|--------|-----------|----------|
| Kullanıcı id | user_id | Benzersiz kullanıcı id |
| Kapsam / Yetki alanı | scope | user_id (teacher) veya school_id (school_admin) |
| Aktif | active | Giriş yapabilir |
| Pasif | passive | Giriş yapamaz; veri silinmez |
| Askıda | suspended | Geçici kısıtlama |

---

## 4. Haber ve Duyuru

| Türkçe | Kod / API | Açıklama |
|--------|-----------|----------|
| Duyuru | announcement | Okul duyurusu (Core Backend) |
| Okulum | okulum | "Okul duyuruları" sekmesi / kaynağı |
| Genel haber | news | WordPress'ten gelen haber |
| Sınav görevi | exam_duty / examDuty | WP kaynaklı sınav görevi duyurusu |

---

## 5. Nöbet

| Türkçe | Kod / API | Açıklama |
|--------|-----------|----------|
| Nöbet | duty | Nöbet modülü / nöbet görevi |
| Nöbet planı | duty_plan / dutyPlan | Yayınlanmış veya taslak plan |
| Yerine görevlendirme | reassign | Bir nöbetin başka öğretmene atanması |
| Nöbet alanı | duty_area / dutyArea | Bahçe, kapı, koridor vb. |
| Nöbet slotu | duty_slot / dutySlot | Teneffüs / saat aralığı |

---

## 6. Market ve Ekonomi

| Türkçe | Kod / API | Açıklama |
|--------|-----------|----------|
| Jeton | coin / wallet | Uygulama içi sanal birim; para değil |
| Cüzdan | wallet | Kullanıcının jeton bakiyesi + işlemler |
| Hak | entitlement | Kullanım hakkı (sayısal veya süreli) |
| Hak kataloğu | catalog | Jetonla alınabilecek haklar |

---

## 7. Evrak ve Kazanım

| Türkçe | Kod / API | Açıklama |
|--------|-----------|----------|
| Evrak / Belge | document | Üretilen PDF/Word |
| Şablon | template / document_template | Evrak şablonu (sürümlü) |
| Kazanım | outcome | Müfredat kazanımı |
| Kazanım seti | outcome_set | Branş + sınıf bazlı kazanım listesi |
| İlerleme | progress | Öğretmenin işlendi/ertelendi işaretleri |

---

## 8. Ek Ders ve Parametre

| Türkçe | Kod / API | Açıklama |
|--------|-----------|----------|
| Ek ders | extra_lesson / extraLesson | Ek ders ücreti hesaplama modülü |
| Yarıyıl / Dönem | semester | 6 aylık parametre dönemi (örn. 2026-1) |
| Kalem | line_item / lineItem | Ek ders türü (normal ek ders, nöbet, kurs vb.) |
| Parametre seti | params / extra_lesson_params | Yarıyıla ait kalemler, birim ücretler, vergi |

---

## 9. Bildirim ve Olay

| Türkçe | Kod / API | Açıklama |
|--------|-----------|----------|
| Bildirim | notification | Tekil bildirim kaydı |
| Inbox | inbox / notifications | Uygulama içi bildirim kutusu |
| Olay / Event | event | Sistemde tetiklenen olay (event_type) |
| Push | push | FCM ile gönderilen bildirim |
| Hedef ekran | target_screen | Deep link hedefi (örn. haber/okulum/:id) |

---

## 10. Teknik Ortak Terimler

| Terim | Kullanım |
|-------|----------|
| entity_id | İlgili kaynağın id'si (duyuru, nöbet, post vb.) |
| event_type | announcement.created, duty.changed vb. |
| scope | Veri erişim kapsamı (user_id / school_id) |
| SSOT | Single Source of Truth; Core Backend |
| CRUD | Create, Read, Update, Delete |

---

## 11. Dosya ve Proje İsimlendirme (Öneri)

- **Backend:** snake_case (örn. `duty_plan`, `school_id`)
- **API path:** kebab-case veya camelCase (proje standardına göre; örn. `/exam-duties` veya `/examDuties`)
- **Flutter:** camelCase (Dart convention)
- **DB tablo:** snake_case (schools, users, announcements, duty_plans)

---

*Tüm spec dokümanlarında bu terimler aynı anlamda kullanılır. Yeni terim eklenince bu listeye eklenmeli.*
