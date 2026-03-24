# CURSOR_SPEC — Öğretmen Platformu

Flutter + Metronic Next.js + Core Backend + WordPress + Firebase

> Bu doküman teknik implementasyon değil; Cursor/Copilot'un kod yazarken yanlış anlamasını engelleyen ürün + mimari sözleşmedir.

---

## 0) Amaç

Türkiye'de öğretmenlerin günlük iş yükünü azaltan, okul yönetimiyle uyumlu çalışan bir platform:

- **Flutter Mobil:** teacher (ana kullanıcı) + sınırlı admin görüntüleri
- **Web Admin:** Metronic + Next.js (React) ile superadmin + school_admin paneli
- **Core Backend:** tek gerçek kaynak (single source of truth)
- **WordPress:** içerik kaynağı (haber + sınav görevi + bazı parametre metinleri)
- **Firebase:** Auth + Push (FCM) + cihaz tokenları

---

## 1) Roller (değişmez)

### 1.1 Roller
- **superadmin:** Tüm okullar, tüm kullanıcılar, tüm modül politikaları
- **school_admin (müdür/idare):** Sadece kendi okulu (school_id scope)
- **teacher:** Sadece kendi verisi (user_id scope) + bağlı olduğu okulun yayınları

### 1.2 Hard Rule: Scope
- **teacher** → sadece user_id kapsamındaki kayıtları yönetir; başka öğretmenin verisini göremez
- **school_admin** → sadece school_id kapsamındaki kayıtları görür/yönetir
- **superadmin** → global görünüm

### 1.3 Kullanıcı durumu
- **active** / **passive** / **suspended**
- Passive kullanıcı giriş yapamaz; veri silinmez

---

## 2) Sistem Prensipleri (Hard Rules)

### 2.1 Single Source of Truth
Aşağıdaki iş verileri **Core Backend DB**'dedir:
- School, User, Role
- Announcements (Okul duyuruları)
- Duty/Nöbet planı + değişiklik logları
- Wallet (jeton) + Entitlements (haklar)
- Evrak şablonları + versiyonlar
- Ekders yarıyıl parametre setleri
- Kazanım setleri + teacher ilerlemesi
- Duyuru TV cihazları + TV ekran playlist görünümü
- Audit logs

### 2.2 WordPress = içerik kaynağı (kural motoru değil)
- WP genel haber üretir
- WP sınav görevi duyurusu üretir
- WP parametre metni sağlayabilir (örn. yarıyıl bilgilendirme)
- **Ama:** hedefleme/segmentasyon/bildirim kuralları WP'de yapılmaz; bildirim kararları Core Backend'dedir

### 2.3 Firebase rolü (sınırlı)
- Auth
- FCM push gönderimi
- cihaz token yönetimi
- (ops.) analytics  
Jeton, duyuru, nöbet, evrak vb. **Firebase veritabanında tutulmaz.**

---

## 3) Event-first Yaklaşım (sistemin omurgası)

Her kritik işlem bir **Event** üretir. Event şunlara dönüşür:
- Inbox kaydı (uygulama içi bildirim kutusu)
- gerekirse Push
- (ops.) raporlama sayaçları

### 3.1 Örnek event'ler
- announcement.created, announcement.updated
- duty.published, duty.changed, duty.reassigned
- wallet.earned, wallet.spent
- entitlement.granted, entitlement.used, entitlement.expired
- document.generated
- tv.device.paired, tv.device.offline

### 3.2 Push payload standardı (hard)
Her push en az şunları taşır:
- **event_type**
- **entity_id** (duyuru id / nöbet id / wp post id)
- **target_screen** (deep link hedefi)
- kısa **title** + **body**

---

## 4) Modüller Listesi (tam envanter)

### Mobil (Flutter) ana modüller
- Profil
- Haber (Okulum duyuruları + Genel WP)
- Sınav Görevi Takip (WP)
- Ek Ders / Ücret Hesaplama
- Evrak & Plan Üretimi (PDF/Word)
- Kazanım Cebimde
- Nöbet
- Optik Okuma
- Akıllı Tahta Kontrol
- Market (Jeton + Haklar)
- Ayarlar & Uygulama Sağlığı
- Okullar (Tanıtım Modülü)
- Duyuru TV (mobilde sadece bilgilendirme/izleme opsiyonel)

### Web (Metronic + Next.js) modüller
- Superadmin Panel
- School Admin Panel

---

## 5) WEB ADMIN (Metronic + Next.js) — Kurallar ve ekranlar

### 5.1 Menü (School Admin)
- Dashboard
- Okul Duyuruları
- Nöbet
- Duyuru TV
- Okullar Tanıtım (kendi okulu)
- Öğretmenler (liste)
- Ayarlar (sadece okul bazlı görünüm/opsiyon)

### 5.2 Menü (Superadmin)
- Dashboard (platform)
- Okullar (CRUD)
- Kullanıcılar (CRUD)
- Modüller / Feature Flags (okul bazlı aç/kapa)
- Market Politikası (jeton/hak katalog)
- Evrak Şablonları (versioning)
- Ekders Parametreleri (yarıyıl setleri)
- Kazanım Setleri
- Moderasyon (okul tanıtım içerikleri)
- Sistem Duyuruları (ops.)

### 5.3 Hard Rule: Route Guard
- Route bazında **allowedRoles** kontrolü
- school_admin ekranlarının tüm API çağrıları **school_id** ile scope'lanır
- superadmin harici /schools gibi ekranlar açılmaz

---

## 6) MOBİL (Flutter) — Kalite ve UX kuralları

- **Kritik ekranlar 2 saniye altında** açılmalı: Nöbetlerim, Okul duyuruları, Sınav görevi
- **Offline tolerans:** cache; ilk açılış veri yoksa net uyarı
- **Değişiklik şeffaflığı:** "değiştirildi" + "son güncelleme"
- **Tema:** Light varsayılan + Dark tam destek (semantic token ile)

---

## 7) MODÜL SPEC'LERİ (özet)

| Modül | Olmazsa olmaz | Olmayanlar |
|-------|----------------|------------|
| **Okul Duyuruları** | Liste+detay, okundu/okunmadı, önemli üstte, ek dosya (PDF), event+inbox+push | Yorumlaşma, emoji, chat |
| **Genel Haber (WP)** | Liste, detay, "webde aç"; push varsayılan kapalı, kategori bazlı açılabilir | WP edit, haber üretimi |
| **Sınav Görevi (WP)** | Kategori seçimi, feed (açık/yaklaşan/sonuç/geçmiş), detay, push+inbox+deep link, takvime ekle | Spam; zorunlu alan doğrulama WP'de |
| **Ek Ders** | Ay seçimi, dinamik kalemler, vergi dilimi, net/brüt+kalem dökümü, geçen ayı kopyala, yerel kayıt; parametre setleri yarıyıl versiyonlu, cache | Okul onayı, bordro |
| **Evrak & Plan** | Tür seç→form→önizleme→PDF/Word; template versioning; kopyala/düzenle | e-imza, okul onayı, server arşiv (MVP) |
| **Kazanım Cebimde** | Kazanım listesi, işlendi/kısmen/ertelendi, not+tarih, sınıf bazlı takip, ilerleme özeti | Öğrenci bazlı takip, not sistemi |
| **Nöbet** | Admin: excel şablon, taslak/yayın, gelmeyen işaretle, yerine görevlendir, log. Teacher: bugün, 7 gün, takvim, değiştirildi etiketi | Teacher kendi nöbetini değiştirme (MVP) |
| **Optik Okuma** | Sınav tanımla, okut, manuel düzeltme, sonuç listesi, soru bazlı doğru/yanlış | e-Okul entegrasyonu |
| **Akıllı Tahta** | Admin: okul bazlı aç/kapa, kim bağlanır. Güvenlik: tek bağlantı, otomatik kopma | Ders izleme, öğretmeni denetleme |
| **Market** | Wallet bakiye, geçmiş, entitlement, hak satın alma (jetonla); "haklarım" net | Jeton para değildir; destek yükü olmaması için net olmalı |
| **Okullar Tanıtım** | Tanıtım metni, vizyon/misyon, imkanlar, kapak+galeri (limitli), taslak/yayın, superadmin moderasyon | Medya şişmez: limit + thumb/medium + cache + lazy load |
| **Duyuru TV** | Device pairing code, cihaz listesi+status (online/offline), şablon seçimi, duyurularda show_tv bayrağı | TV içerik kaynağı değildir; kanaldır |

---

## 8) Geliştirme Sırası (önerilen)

**P0 omurga:**
- Identity/scope
- Event + Notifications + Inbox
- Okul duyuruları
- WP bridge (genel haber + sınav görevi)
- Duyuru TV cihaz yönetimi (MVP)

**Sonra değer üreten:** Ek ders, Evrak, Kazanım

**Sonra P1:** Nöbet, Optik, Akıllı tahta

**V2:** Reporting

---

## 9) Acceptance Criteria (genel)

- Scope ihlali yok: teacher başka teacher verisi göremez; school_admin başka okul verisine erişemez
- Kritik olaylar inbox'ta kalır
- Push tıklanınca doğru detaya gider
- WP içerikleri "webde aç" ile her zaman erişilebilir
- TV sadece show_tv içerik gösterir
- Medya limitleri ve cache ile sistem şişmez

---

## 10) Cursor/Copilot Çalışma Kuralı

- Bu dokümandaki **hard rule'lar ihlal edilmez.**
- Belirsiz noktada **soru sorulur.**
- Her modül için önce **ekranlar + event'ler + role izinleri** netleştirilir.
- **Metronic ve FlutKit** kullanırken **KIT_ENTEGRASYON_KURALLARI.md** kurallarına uyulur; kit demo mantığı production'a taşınmaz, API/auth/rol proje kodunda tutulur.

---

*Detaylı modül kuralları için: `MODULE_RULES.md`*  
*MVP kapsamı için: `MVP_SCOPE.md`*  
*Kit entegrasyonu için: `KIT_ENTEGRASYON_KURALLARI.md`*
