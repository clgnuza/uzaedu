# Ders Programı ve Nöbet Modülü – Yapılacaklar Notları

**Tarih:** 2026-02-18  
**Son güncelleme:** 2026-02-18 (Web/mobil araştırma ve kullanıcı yorumları eklendi)  
**Kaynak:** CURSOR_SPEC.md, MODULE_RULES.md, CORE_ENTITIES.md, API_CONTRACT.md, NOTIFICATION_MATRIX.md, mevcut implementasyon, ağ araştırması (NöbetPulse, NobetNet, Nobetplani, Egitimhane, Deputy, TimeForge, Red Rover, MEB Ortaöğretim Yönetmeliği)

---

## 0. Web ve Mobil Nöbet Uygulamaları Araştırması

### 0.1 Türkiye Pazarı – Rakip Özellikler

| Uygulama | Hedef kitle | Öne çıkan özellikler |
|----------|-------------|----------------------|
| **NöbetPulse** | Sağlık | Kullanıcı istekleri sisteme girer, adil dağılım; gün aşırı nöbet minimizasyonu; servis arkadaşı dengesi; çoklu liste; yetki devri |
| **NobetNet** | Sağlık, kamu, güvenlik | Yapay zeka ile otomatik dağılım; personel tercihleri (istekli/isteksiz/nötr); gelişmiş mesai planları; PDF/Excel çıktı; kurallar (kıdem, birlikte çalışma) |
| **Nobetplani** | Genel | Ücretsiz; Excel personel yükleme; hafta içi/sonu dengeleme; izin takibi; Cuma-Perşembe dengelemesi |
| **Nobetyonetim.net** | Genel | Otomatik dağılım; adil nöbet atama |
| **Egitimhane (öğretmen nöbet)** | Okullar | Sabit/hareketli nöbet günleri; nöbet yerleri dönerli/sabit; 10-15 sn’de hazırlama; 34.000+ indirme |

### 0.2 Uluslararası – Shift Swap / Roster Uygulamaları

| Uygulama | Özellikler |
|----------|------------|
| **Deputy, TimeForge, 7shifts** | Mobil swap talebi; eşleşme; yönetici onay; push bildirim |
| **Tanda** | Vardiya takası; yorgunluk yönetimi; fazla mesai uyarısı |
| **RosterElf** | Otomatik skill/uygunluk kontrolü; tek tık onay |
| **Red Rover** | K-12 okullar; absence management; bordro entegrasyonu |
| **Schoolites** | Öğretmen uygulaması (4,8★); zaman çizelgesi, yerine geçen güncellemeleri |

### 0.3 Kullanıcı Yorumları ve Şikayetleri (Derleme)

**Egitimhane – Öğretmen Nöbet Programı (34K indirme):**
- "Veri kopyalarken şifre istiyor. Şifre nedir?"
- "Win7 uyumluluk sorunu var, program çalışmıyor"
- "Nöbet dağıt dediğimde hata veriyor"
- "Yönetici olarak çalıştırmayı deneyiniz" (geliştirici cevabı)

**Genel sektör şikayetleri:**
- Manuel Excel işlemi zaman alıcı; her değişiklikte yeniden liste
- Nöbet değişimi için telefon/WhatsApp; kayıt tutulmuyor
- Tatil/izin/rapor ile nöbet çakışması; manuel düzeltme
- Adaletsiz dağılım hissi; şeffaflık yok
- Uygulamalarda reklam, yavaşlık, offline çalışmama

**Öğretmen sendika/mevzuat bağlamı:**
- Haftada 3 saat ek ders; fazla nöbet için ek ücret yok
- Fiziksel/mental yorgunluk; dinlenme zamanı çalınıyor
- MEB Ortaöğretim Yönetmeliği Madde 91: Nöbet esasları (dersi az günde nöbet, hamile/engelli muafiyet, öğle arası dönüşümlü)

### 0.4 Kullanıcı İstekleri (Özet)

1. **Şeffaflık:** Kim, ne zaman, nerede nöbetçi – herkes görebilsin
2. **Adil dağılım:** Ders saati az günde nöbet (MEB kuralı); gün aşırı dengeleme
3. **Tercih/istek:** Personel uygun/isteksiz günlerini girebilsin
4. **Değişim/takas:** Nöbet değiştirme talebi + onay süreci; mesajlaşma yok
5. **İzin/rapor entegrasyonu:** Raporlu/izinli öğretmene nöbet atanmasın
6. **Mobil erişim:** Bugünkü nöbet, push ile hatırlatma
7. **Offline/cache:** Zayıf ağda da plan görünsün (CURSOR_SPEC: 2 sn altında açılma)
8. **Excel giriş/çıkış:** Mevcut Excel’den import; PDF/Excel çıktı
9. **Nöbet alanları:** Koridor, bahçe, giriş – okula özel tanımlar
10. **Muafiyet kuralları:** Hamile, engelli, 20/25 yıl – MEB uyumlu

---

## 1. Ders Programı (Timetable)

### 1.1 Mevcut Durum

| Bileşen | Durum | Not |
|---------|-------|-----|
| **Standalone modül** | ❌ Yok | CURSOR_SPEC ve MODULE_RULES'da ana modül listesinde yok |
| **Duyuru TV içinde** | ✅ Var | `school.tv_timetable_schedule` (JSON) – sadece TV ekranı için |
| **Web-admin TV sayfası** | ✅ Var | Ders programı grid düzenleme, Excel yükleme/indirme |
| **Backend API** | Kısmen | Okul `UpdateSchoolDto` ile tv_timetable_schedule güncellenir; ayrı endpoint yok |

### 1.2 Ders Programı (TV) Veri Yapısı

`tv_timetable_schedule` JSON formatı:

```json
{
  "lesson_times": [{ "num": 1, "start": "08:30", "end": "09:10" }, ...],
  "class_sections": ["1A", "1B", "1C", ...],
  "entries": [
    { "day": 1, "lesson": 1, "class": "1A", "subject": "Matematik" },
    ...
  ]
}
```

- `day`: 1=Pazartesi … 5=Cuma
- `lesson`: 1, 2, 3 … ders saati numarası
- TV'de: Program slaytı + "Şu An Derste" bar (anlık ders gösterimi)

### 1.3 Öğretmen Tarafı Ders Programı (Olası Geliştirme)

- **Kazanım Cepte referansı:** "Ders programı oluşturma, çizelge, çıktı" (KAZANIM_SETLERI_ARASTIRMA_OZET.md)
- Öğretmenin **kendi derslerini** görmesi için ayrı bir modül spec'te tanımlı değil
- İleride eklenebilecekler:
  - Okul ders programından öğretmen filtresi (branş/sınıf)
  - Mobil: "Bugün derslerim", haftalık grid
  - Çıktı (PDF/Excel)

### 1.4 Ders Programı – Kısa Özet

- Şu an: **Sadece Duyuru TV’de** kullanılıyor; okul geneli ders çizelgesi.
- Bağımsız "Ders Programı" modülü **planlanmamış**; gerekirse eklenebilir.
- TV tarafı eksiksiz: Web-admin’de grid/Excel; TV ekranında program + Şu An Derste.

---

## 2. Nöbet Modülü

### 2.1 Mevcut Durum

| Bileşen | Durum | Not |
|---------|-------|-----|
| **Backend duty modülü** | ❌ Yok | `backend/src/duty/` klasörü yok |
| **DB entity (DutyPlan, DutySlot, DutyLog)** | ❌ Yok | Migration/entity bekleniyor |
| **API endpoints** | Sadece sözleşmede | API_CONTRACT.md’de tanımlı; implement yok |
| **Web-admin /duty** | Placeholder | Sadece açıklama metni; işlev yok |
| **Duyuru TV nöbet** | ✅ Var | `tv_duty_schedule` – sadece TV ekranında basit liste |
| **Modül aç/kapa** | ✅ Var | `school.enabled_modules` içinde `duty` anahtarı |

### 2.2 Veri Modeli (CORE_ENTITIES)

**DutyPlan**
- id, school_id, version, status (draft | published), published_at, created_by, created_at
- 1 DutyPlan → çok DutySlot

**DutySlot**
- id, duty_plan_id, date, slot_name (veya slot_id), area_name (veya area_id)
- user_id (atanan öğretmen), reassigned_from_user_id (ops.), note
- created_at, updated_at

**DutyLog**
- id, school_id, action, duty_slot_id, old_user_id, new_user_id, performed_by, created_at

### 2.3 API Sözleşmesi (API_CONTRACT)

| Method | Path | Açıklama | Roles |
|--------|------|----------|--------|
| GET | `/duty/plans` | Aktif plan; teacher: sadece kendi nöbetleri | teacher, school_admin |
| POST | `/duty/plans/upload` | Excel ile plan yükle (taslak) | school_admin |
| POST | `/duty/plans/:id/publish` | Plan yayınla | school_admin |
| POST | `/duty/reassign` | Yerine görevlendir | school_admin |
| GET | `/duty/logs` | Değişiklik logları | school_admin |

### 2.4 School_admin Yapılacakları (MODULE_RULES §9)

1. **Excel şablon yükleme** – Plan verisini Excel’den içe aktarma
2. **Önizleme / hata listesi** – Parse sonrası önizleme ve hata satırları
3. **Taslak / yayın** – Plan taslak veya yayınlanmış durumda
4. **"Bugün" operasyonu** – Bugünkü nöbetler için işlemler (gelmeyen vb.)
5. **Gelmeyen işaretleme** – Nöbetçi gelmediyse işaretleme
6. **Yerine görevlendir** – Uygun öğretmen listesi + onay ile değiştirme
7. **Değişiklik logu** – Tüm değişikliklerin görüntülenmesi

### 2.5 Teacher Yapılacakları

1. **Bugünkü nöbet** – Bugün nöbetçi mi, nerede
2. **7 gün** – Önümüzdeki 7 günlük nöbet listesi
3. **Takvim** – Takvim görünümünde nöbetler
4. **Liste** – Tüm nöbetler listesi
5. **"Değiştirildi" etiketi** – Son değişiklik sonrası vurgu
6. **Son güncelleme zamanı** – Plan güncelleme bilgisi

### 2.6 Event ve Bildirim (NOTIFICATION_MATRIX)

| event_type | Açıklama | Inbox | Push | Hedef |
|------------|----------|-------|------|-------|
| duty.published | Plan yayınlandı | ✅ | ✅ | Planladaki öğretmenler |
| duty.changed | Plan değişti | ✅ | ✅ | Aynı |
| duty.reassigned | Yerine görevlendirildi | ✅ | ✅ | Yerine atanan öğretmen |

**target_screen:** `nobet` | `nobet/detay?id={entity_id}`

### 2.7 Kurallar (değişmez)

- Öğretmen **kendi nöbetini değiştirmez** (MVP).
- Plan tek kaynak; eski planlar arşivde.
- Scope: school_admin → sadece `school_id` kapsamındaki planlar.

### 2.8 Excel Şablon Formatı (Tahmini)

Excel yükleme için beklenen kolonlar (API/implement detayına bağlı):

- Tarih (date)
- Slot / Saat (slot_name veya slot_id)
- Alan (area_name veya area_id)
- Öğretmen (user_id veya email / isim → eşleştirme)
- Not (ops.)

Parse sırasında: okul öğretmenleri ile eşleştirme, hata satırları listesi.

### 2.9 MVP Önceliği

- **MVP_SCOPE:** P1 – "Çok Önemli (MVP'ye alınabilir)"
- Geliştirme sırası önerisi: Ay 5 (Nöbet).

---

## 2A. Araştırma Sonuçlarına Göre Modül Çözümleri

Ağ araştırması ve kullanıcı yorumlarına dayalı olarak Öğretmen Pro nöbet modülünde nasıl çözüm üretilebileceği:

| Kullanıcı ihtiyacı / Şikayet | Çözüm önerisi |
|------------------------------|---------------|
| Excel’den import; mevcut formatlara uyum | Şablon indir + esnek kolon eşleme (tarih, alan, öğretmen); hata satırları listesi |
| Şeffaflık, adil dağılım hissi | Tüm plan yayınlanınca görünür; DutyLog ile değişiklik geçmişi; "son güncelleme" zamanı |
| Nöbet değiştirme (takas) + onay | MVP’de teacher değiştirmez; school_admin "yerine görevlendir" ile atar. V2: teacher swap talebi → admin onay |
| İzin/rapor çakışması | V2: izin/rapor modülü varsa nöbet atarken uyarı; veya manuel "bu tarihe nöbet atama" işaretleme |
| Mobil erişim, hızlı açılış | CURSOR_SPEC: kritik ekran 2 sn altında; cache; offline plan görüntüleme (read-only) |
| Push hatırlatma | duty.published, duty.changed, duty.reassigned; ek: duty.reminder (nöbetten X saat önce, ops.) |
| Nöbet alanları (koridor, bahçe, giriş) | `duty_area` tablosu veya DutySlot.area_name; okul bazlı özelleştirilebilir alan listesi |
| MEB muafiyet kuralları | V2: user.meta veya ayrı tablo (hamile, engelli, 20/25 yıl); plan oluştururken bu öğretmenlere atama yapma uyarısı |
| Sabit / hareketli nöbet günleri | V2: öğretmen bazlı "sabit gün" (örn. her Pazartesi) veya "dönerli"; dağılım algoritması |
| Tercih/istek (uygun/isteksiz gün) | V2: duty_preference tablosu; plan oluşturma öncesi istek alımı (NöbetPulse benzeri) |
| PDF/Excel çıktı | Yayınlanmış planı PDF/Excel indir; okul zümresi veya MEB dosyası için uygun format |
| Reklam, yavaşlık | Proje kendi uygulaması; reklam yok; API cache, CDN ile performans |
| Win/uyumluluk | Web + mobil (Flutter); masaüstü Excel yerine web Excel import; platform bağımsız |

---

## 2B. Genişletilmiş Veri Modeli Önerileri (V2)

Mevcut CORE_ENTITIES’e eklenebilecek alanlar:

**DutyPlan:**
- `period_start`, `period_end` – plan dönemi (ay/yarıyıl)
- `academic_year` – öğretim yılı

**DutySlot:**
- `slot_start_time`, `slot_end_time` – nöbet saati (MEB: ilk ders -30 dk … son ders +30 dk)
- `is_reassigned` – yerine görevlendirme mi
- `absent_marked_at` – gelmeyen işaretlendi mi (school_admin)

**DutyArea (yeni):**
- id, school_id, name (Koridor, Bahçe, Giriş, 1. Kat…), sort_order

**DutyPreference (V2 – öğretmen tercihi):**
- id, user_id, duty_plan_id (veya period), date, status (available | unavailable | prefer), note

**DutySwapRequest (V2 – takas talebi):**
- id, duty_slot_id, requested_by_user_id, proposed_user_id, status (pending | approved | rejected), admin_note

---

## 3. Özet Tablo – Yapılacaklar (Genişletilmiş)

### 3.1 MVP (P1) – Zorunlu

| Alan | Yapılacak | Öncelik |
|------|-----------|---------|
| **Nöbet – Backend** | duty_plan, duty_slot, duty_log entity + migration; DutyModule, Service, Controller | Yüksek |
| **Nöbet – API** | GET /duty/plans, POST /duty/plans/upload, POST /duty/plans/:id/publish, POST /duty/reassign, GET /duty/logs | Yüksek |
| **Nöbet – Web-admin** | Excel yükleme (şablon indir + kolon eşleme), önizleme, hata listesi, taslak/yayın, yerine görevlendir, log sayfası, PDF/Excel indir | Yüksek |
| **Nöbet – Mobil** | Bugün, 7 gün, takvim, liste; "değiştirildi" etiketi; son güncelleme; 2 sn altında açılış + cache (Flutter) | Yüksek |
| **Nöbet – Event** | duty.published, duty.changed, duty.reassigned → Inbox + Push | Yüksek |
| **Nöbet alanları** | duty_area tablosu veya area_name; Koridor, Bahçe, Giriş vb. okul bazlı tanımlanabilir alanlar | Orta |
| **Nöbet saati** | slot_start_time, slot_end_time (MEB: ilk ders -30dk … son ders +30dk) | Orta |
| **Gelmeyen işaretleme** | DutySlot.absent_marked_at; school_admin "gelmedi" işaretleyebilir; log’a yazılır | Orta |

### 3.2 V2 – İyileştirmeler (Araştırma çıktıları)

| Alan | Yapılacak | Kaynak |
|------|-----------|--------|
| **Teacher swap talebi** | Öğretmen "nöbetimi değiştirmek istiyorum" talebi → school_admin onay/red; DutySwapRequest | Deputy, 7shifts, kullanıcı isteği |
| **Tercih/istek toplama** | Plan öncesi öğretmenler uygun/isteksiz gün girer; DutyPreference; dağılımda dikkate alınır | NöbetPulse, NobetNet |
| **Nöbet hatırlatma** | duty.reminder event – nöbetten X saat önce push (ayarlanabilir) | Genel istek |
| **İzin/rapor uyarısı** | Nöbet atarken raporlu/izinli öğretmene atama uyarısı (modül varsa) | Nobetplani, GoActiveX |
| **MEB muafiyet** | Hamile, engelli, 20/25 yıl – plan oluştururken uyarı veya otomatik hariç tutma | MEB Madde 91 |
| **Sabit/dönerli gün** | Öğretmen bazlı sabit gün (örn. her Pzt) veya dönerli dağılım | Egitimhane |
| **Plan dönemi** | period_start, period_end, academic_year; aylık/yarıyıllık plan | NobetNet, Nobetplani |

### 3.3 Ders programı (Opsiyonel)

| Alan | Yapılacak | Öncelik |
|------|-----------|---------|
| **Ders programı** | TV tarafı tamam. İstenirse: öğretmen kendi dersleri (branş/sınıf filtresi), mobil "Bugün derslerim", PDF/Excel çıktı | Düşük |

### 3.4 Teknik Hedefler (Araştırma çıktıları)

| Hedef | Açıklama |
|-------|----------|
| **Platform bağımsız** | Web + Flutter mobil; masaüstü Excel programı yerine web Excel import – Win/Mac/Linux uyumlu |
| **Reklam yok** | Proje kendi uygulaması; üçüncü taraf reklam kullanılmaz |
| **Performans** | API cache; CDN; mobilde plan cache; zayıf ağda read-only plan görüntüleme |
| **Şablon esnekliği** | Excel kolon eşleme (idareci kendi formatını map edebilir); birden fazla şablon seçeneği |

---

## 4. Nobetyonetim.net Referans – Menü ve Sayfa Yapısı

Örnek uygulama sayfasından çıkarılan menü ve tablo yapısı; web-admin Nöbet modülü tasarımı için referans.

### 4.1 Ana Menü Yapısı (Nobetyonetim.net)

| Menü öğesi | Path / Açıklama |
|------------|-----------------|
| **Nöbetçiler** | Ana liste – günlük nöbetçi tablosu |
| **Gelmeyen Ekle** | Raporlu/izinli/gelmeyen öğretmen işaretleme (vurgulu/kırmızı) |
| **Görev Verilenler** | Yerine görevlendirilen öğretmenler listesi |
| **Okul adı** (dropdown) | Aşağıdaki ayarlar |

**Okul dropdown alt menüsü:**
| Menü öğesi | Açıklama |
|------------|----------|
| Öğretmen Ayarları | Öğretmen listesi, muafiyet vb. |
| Görev Verilenler (Yeni) | Yerine görevlendirme ekranı |
| Okul Ayarları | Okul genel ayarları |
| Toplam Görevlendirme | Öğretmen başına nöbet sayısı özeti |
| Nöbet Yerleri | Koridor, Bahçe, Giriş vb. alan CRUD |
| Ek Ders Puantaj | Ek ders hesaplama entegrasyonu |
| Nöbetçi Günü Öneri | Otomatik öneri sistemi |
| **Ders Programı Yükle** | Excel ile ders programı import |
| Dijital Pano İşlemleri | Duyuru Ekle, Ders Saatleri, Dijital Pano linki |

### 4.2 Ana Sayfa (Günlük Nöbetçi Tablosu)

**Başlık alanı:**
- Tarih + gün adı (örn. "18 Şubat - Çarşamba Günü Nöbetçileri")
- **Önceki Gün** / **Sonraki Gün** navigasyon
- **Yazdır** butonu

**Tablo yapısı:**

| Nöbetçi | Konum | 1.Ders | 2.Ders | 3.Ders | ... | 8.Ders |
|---------|-------|--------|--------|--------|-----|--------|
| Öğretmen adı | Nöbet alanı | Ders varsa: sınıf-ders | boş = nöbet | ... | ... | ... |

**Mantık:**
- **Konum:** Nöbet yerı (Zemin Kat ve 1. Kat, Bahçe, Giriş vb.) – boş olabilir
- **Ders sütunları:** Hücre **boş** = öğretmen o saatte nöbetçi; **dolu** = o saatte dersi var (örn. "7/E - SOSYAL BİL.")
- Ders programı entegrasyonu ile hangi saatte kimin nöbet (boş) / kimin ders (dolu) olduğu hesaplanır

**Görsel:** Yeşil başlık alanı; tablo `table-bordered table-striped`; yazdırma için `genis` font sınıfı.

### 4.3 Öğretmen Pro’ya Uyarlama

**Menü eşlemesi (web-admin `/duty` altında):**

| Nobetyonetim | Öğretmen Pro route | Not |
|--------------|--------------------|-----|
| Nöbetçiler | `/duty` veya `/duty/liste` | Ana günlük tablo |
| Gelmeyen Ekle | `/duty/gelmeyen` | Gelmeyen/raporlu/izinli işaretleme |
| Görev Verilenler | `/duty/gorevlendirilen` | Yerine görevlendirme listesi |
| Öğretmen Ayarları | `/teachers` (mevcut) veya `/duty/ogretmenler` | Okul öğretmenleri – nöbet muafiyeti alanı |
| Nöbet Yerleri | `/duty/yerler` | duty_area CRUD |
| Ders Programı Yükle | TV sayfasında mevcut; nöbet ile entegre | tv_timetable_schedule + nöbet dağılımı |
| Toplam Görevlendirme | `/duty/ozet` | Öğretmen başına nöbet sayısı raporu |

**Tablo veri kaynağı:**
- `duty_slot`: date, user_id, area_name, slot (ders saati aralığı)
- Ders programı: `tv_timetable_schedule` veya ayrı teacher_timetable → öğretmenin hangi saatte dersi var hesaplanır
- Hücre: ders varsa "sınıf - ders"; yoksa boş (nöbet)

**Yazdırma:** `window.print()` ile tablo + başlık; `@media print` ile gereksiz UI gizlenir.

---

## 5. Referans Dosyalar

**Proje içi:**
- `CURSOR_SPEC.md` – Modül listesi, Nöbet spec
- `MODULE_RULES.md` §9 – Nöbet kuralları
- `CORE_ENTITIES.md` §4 – DutyPlan, DutySlot, DutyLog
- `API_CONTRACT.md` §2.7 – Nöbet endpoint’leri
- `NOTIFICATION_MATRIX.md` – duty event’leri, target_screen
- `AUTHORITY_MATRIX.md` – Nöbet rol yetkileri
- `web-admin/src/app/(admin)/duty/page.tsx` – Mevcut placeholder
- `web-admin/src/app/(admin)/tv/page.tsx` – Ders programı (tv_timetable) + nöbet (tv_duty) TV ayarları

**Dış kaynaklar (araştırma):**
- **Nobetyonetim.net** – Referans: menü (Nöbetçiler, Gelmeyen, Görev Verilenler, Nöbet Yerleri, Ders Programı Yükle, Toplam Görevlendirme); günlük tablo (Nöbetçi | Konum | 1.–8. Ders); boş hücre = nöbet, dolu = ders
- NöbetPulse (nobetpulse.com) – Sağlık nöbet planlama
- NobetNet (nobetnet.com) – Yapay zeka nöbet listesi
- Nobetplani.com – Ücretsiz nöbet planlama
- Egitimhane – Öğretmen Nöbet Programı (egitimhane.com)
- MEB Ortaöğretim Kurumları Yönetmeliği Madde 91 – Nöbet esasları
- Deputy, TimeForge, 7shifts – Shift swap / roster uygulamaları
