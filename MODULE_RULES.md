# Modül Bazlı Kurallar ve Listeler (MODULE_RULES)

Bu doküman CURSOR_SPEC ve ürün spec'leriyle uyumludur. Her modül için: amaç, roller, kurallar, event'ler ve kabul kriterleri tanımlanır.

---

## 0. Genel (Tüm Modüller)

### 0.1 Roller ve scope (değişmez)
| Rol | Scope | Görebildiği |
|-----|--------|-------------|
| superadmin | Global | Tüm okullar, kullanıcılar, modül politikaları |
| school_admin | school_id | Sadece kendi okulu |
| teacher | user_id | Sadece kendi verisi + kendi okulunun yayınları |

### 0.2 Kullanıcı durumu
- **active:** Giriş yapabilir.
- **passive:** Giriş yapamaz; veri silinmez.
- **suspended:** Askıda; politikaya göre kısıtlı.

### 0.3 SSOT
- İş verisi Core Backend DB'de. WordPress sadece içerik. Firebase: Auth + Push + token.

### 0.4 Event-first
- Kritik işlem → event → Inbox + (gerekirse) push. Payload: event_type, entity_id, target_screen, title, body.

---

## 1. Kimlik, Yetki ve Okul (Identity & Access)

**Amaç:** Rolleri ve scope'u yönetmek; yetkisiz erişimi engellemek.

**Roller:** superadmin | school_admin | teacher (sabit, tek rol/kullanıcı).

**Kurallar:**
- Teacher başka teacher verisi görmez.
- School_admin başka okul verisine erişmez.
- Yetkisiz route/API 401/403 veya yönlendirme.
- Yetki değişikliği anında geçerli.

**Superadmin:** Okul CRUD, limitler (öğretmen sayısı, modüller). Okul admin atama. Tüm kullanıcı CRUD.

**School_admin:** Kendi okulundaki öğretmen listesi; ekle/çıkar/pasif (yetkiye göre).

**Kabul:** Teacher sadece kendi verisi; admin sadece school_id; superadmin tümü; pasif giriş yapamaz.

---

## 2. Bildirim & Olay (Notifications & Events)

**Amaç:** Olayları push + Inbox ile doğru kitleye, tercihe göre iletmek.

**Kanallar:** Push (FCM), Inbox (uygulama içi).

**Olay türleri (örnek):** announcement.created/updated, duty.published/changed/reassigned, wallet.earned/spent, entitlement.granted/used/expired, document.generated, tv.device.paired/offline.

**Kurallar:**
- Her bildirim: kısa başlık+gövde, kaynak etiketi, tarih/saat.
- Push payload: event_type, entity_id, target_screen, title, body.
- Tıklanınca doğru modül/sekme/detay (deep link).
- Spam önleme: aynı türden kısa sürede gelenler birleştirilebilir.
- Kullanıcı tercihi: tür bazlı push aç/kapa (okul, genel haber, sınav görevi, nöbet, market); sessiz saatler (ops.).

**Inbox:** Okundu/okunmadı, tür filtresi, tıkla→detay. Geçmiş saklanır.

**Kabul:** Kritik olaylar inbox'ta; push tıklanınca doğru detaya gider; tercihler uygulanır.

---

## 3. Okul Duyuruları (Okulum)

**Amaç:** School_admin'in duyurularını öğretmene ulaştırmak.

**Kaynak:** Core Backend (school_admin oluşturur).

**Teacher (mobil):** Liste (en yeni→eski; önemli üstte), okundu/okunmadı, detay, ek dosya (PDF). Önemli→push.

**Kurallar:**
- Hedef sadece ilgili okul öğretmenleri.
- Yayınlanınca event + inbox + (önemliyse) push.
- Yorumlaşma, emoji, chat yok.

**Kabul:** Liste+detay, okundu, önemli sabit, ek dosya, event+inbox+push.

---

## 4. Genel Haber (WP)

**Amaç:** WordPress'ten genel haber feed'i; öğretmeni bilgilendirmek.

**Kaynak:** WordPress (içerik). Backend feed'i sunar; bildirim kuralları backend'de.

**Teacher:** Liste (başlık/özet/tarih/kategori), detay, "web'de aç". Push varsayılan kapalı; kullanıcı/kategori bazlı açılabilir.

**Kurallar:** WP edit/haber üretimi mobilde yok. Push kontrollü.

**Kabul:** Feed, detay, web'de aç, kategori filtre, tercihe bağlı push.

---

## 5. Sınav Görevi Takip (WP)

**Amaç:** Başvuru/son gün/sonuç hatırlatması; kategori bazlı takip.

**Kaynak:** WordPress + custom fields. Bildirim kuralları backend'de.

**Teacher:** Kategori seçimi (ÖSYM, MEB, AÖF vb.), feed (açık/yaklaşan/sonuç/geçmiş), detay (tarihler+resmi link), takvime ekle. Push+inbox+deep link.

**Kurallar:** Zorunlu alan doğrulama (WP); push payload: post_id, category, notification_type, title+özet; spam önleme (aynı olay tekrar gönderilmez).

**Kabul:** Kategori takip, feed, detay, push→detay, inbox, takvime ekle, doğrulama, payload standardı.

---

## 6. Ek Ders / Ücret Hesaplama

**Amaç:** Aylık tahmini net ek ders hesabı; bilgilendirme (bordro değil).

**Kaynak:** Parametreler WP veya backend'den; yarıyıl bazlı. Cache + offline destek.

**Teacher:** Ay seçimi, dinamik kalemler (saat girişi), vergi dilimi, net/brüt+kalem dökümü, geçen ayı kopyala, varsayılan şablon, yerel kayıt.

**Kurallar:** Parametre setleri yarıyıl bazlı versiyonlanır; cache'lenir. Okul onayı, bordro, SGK/damga detayı yok.

**Kabul:** Ay seçimi, kalemler, vergi, net/brüt, geçen ay kopyala, yerel kayıt, parametre cache.

---

## 7. Evrak & Plan Üretimi

**Amaç:** Şablon+form→PDF/Word; hızlı evrak üretimi.

**Kaynak:** Şablonlar backend'de; sürümler korunur.

**Teacher:** Tür seç→form (profil otomatik)→önizleme→PDF/Word. Kopyala/düzenle.

**Kurallar:** Şablon versioning; güncelleme eskileri bozmaz. Okul onayı, e-imza, sunucu arşivi (MVP) yok.

**Market:** Üretim hakkı (entitlement) varsa düşülür; yoksa markete yönlendirme. Event+inbox.

**Kabul:** Tür seç, form, önizleme, çıktı, şablon sürümü, profil otomatik, hak kontrolü.

---

## 8. Kazanım Cebimde

**Amaç:** Sınıf/branş kazanımlarını işaretleme ve not; ilerleme özeti.

**Kaynak:** Kazanım setleri backend'de (superadmin). Öğretmen ilerlemesi kendi verisi.

**Teacher:** Kazanım listesi, işlendi/kısmen/ertelendi, not+tarih, sınıf bazlı takip, ilerleme özeti.

**Kurallar:** Öğrenci bazlı takip, not sistemi, okul raporu yok. Offline işaretleme desteklenir.

**Kabul:** Liste, durum işaretleme, not, sınıf bazlı, ilerleme özeti.

---

## 9. Nöbet

**Amaç:** İdarenin plan yayınlaması ve değişiklik; öğretmenin görüntülemesi.

**School_admin:** Excel şablon yükleme, önizleme/hata listesi, taslak/yayın, "bugün" operasyonu, gelmeyen işaretleme, yerine görevlendir (uygun liste+onay), değişiklik logu.

**Teacher:** Bugünkü nöbet, 7 gün, takvim, liste; "değiştirildi" etiketi, son güncelleme zamanı. Event: duty.published, duty.changed, duty.reassigned → inbox+push.

**Kurallar:** Öğretmen kendi nöbetini değiştirmez (MVP). Plan tek kaynak; eski planlar arşivde.

**Kabul:** Admin plan yükleme/yayın, yerine görevlendir, log; teacher görüntüleme, değişiklik etiketi, bildirim.

---

## 10. Optik Okuma

**Amaç:** Kamera ile optik okuma, sonuç, temel analiz.

**Teacher:** Sınav tanımla (soru+şık+anahtar), okut, manuel düzeltme, sonuç listesi, soru bazlı doğru/yanlış.

**Kurallar:** e-Okul entegrasyonu yok. Offline okuma sonuçları cihazda; senkron (varsa) sonra.

**Kabul:** Tanım, okutma, düzeltme, sonuç, basit analiz.

---

## 11. Akıllı Tahta Kontrol

**Amaç:** Öğretmen kontrol; admin yetkilendirme ve güvenlik.

**School_admin:** Okul bazlı modül aç/kapa, kim bağlanır. "Bugün kim bağlandı" özeti.

**Teacher:** Bağlan, temel kontrol (ileri/geri, ses, kilit). Tek bağlantı; otomatik kopma.

**Kurallar:** Ders izleme, öğretmeni denetleme yok. Aynı tahtaya tek öğretmen.

**Kabul:** Admin aç/kapa, yetkilendirme; teacher bağlanma+kontrol; tek bağlantı, kopma.

---

## 12. Market (Jeton + Haklar)

**Amaç:** Jeton kazan/harca; kullanım haklarını yönet.

**Teacher:** Wallet bakiye, geçmiş (kazanım/harcama), entitlement (sayısal/süreli), hak satın alma (jetonla). "Haklarım" net gösterilir.

**Kurallar:** Jeton para değildir. Fiziksel ürün, kargo, zorunlu ödeme yok. Reklam zorlayıcı değil.

**Superadmin:** Jeton/kampanya politikası, paket yönetimi.

**Kabul:** Bakiye, geçmiş, entitlement görünür, satın alma→hak artar, event+inbox.

---

## 13. Okullar Tanıtım

**Amaç:** Okulların tanıtımı; öğretmenin bilgi edinmesi.

**School_admin:** Tanıtım metni, vizyon/misyon, imkanlar, kapak+galeri (limitli). Taslak/yayın, önizleme.

**Superadmin:** Moderasyon (hide). Medya limitleri; thumb/medium, cache, lazy load.

**Kabul:** Tanıtım içerik, galeri limiti, moderasyon, performans.

---

## 14. Duyuru TV

**Amaç:** Okul içi TV'de duyuru/akış (digital signage).

**Admin:** Cihaz eşleme (pairing code), cihaz listesi, status (online/offline), şablon (pano/akış). Duyurularda show_tv bayrağı.

**Kurallar:** TV içerik kaynağı değil; kanal. İçerik Core/duyurulardan gelir.

**Kabul:** Pairing, cihaz listesi, status, show_tv içerik.

---

## 15. Raporlama (V2)

**Amaç:** Rol bazlı özet; denetim değil, dashboard.

**Teacher:** Son 7/30 gün kullanım, "en son işlemler".

**School_admin:** Aktif öğretmen, duyuru okunma özeti. Kişisel içerik detayı yok.

**Superadmin:** DAU/WAU, modül trendi, market özeti. Mahremiyet korunur.

**Kabul:** Rol bazlı kartlar/listeler, detaya link, kişisel içerik açılmaz.

---

## 16. Okul Değerlendirme (School Reviews)

**Amaç:** Öğretmenlerin okullara değerlendirme, yorum ve soru yazması; school_admin'ın kendi okuluna ait raporu görmesi.

**Kaynak:** Core Backend (SchoolReview, SchoolQuestion, SchoolQuestionAnswer). Modül ayarları app_config'de.

**Teacher / School_admin:** Okul listesi (filtre: il, ilçe, tür, arama), okul detay (ortalama puan, istatistik), değerlendirme oluştur/güncelle/sil, soru sor, soruya cevap ver.

**School_admin:** Kendi okuluna ait rapor (ortalama puan, yorum sayısı, soru sayısı, son değerlendirmeler, son sorular). Yorumları silemez/düzenleyemez (tarafsızlık).

**Superadmin:** Modül aç/kapa, puan aralığı (1-5), moderasyon modu (otomatik / onay sonrası), soru özelliği aç/kapa, sorular moderasyondan geçsin.

**Kurallar:**
- Modül kapalıyken okul listesi ve değerlendirme erişilemez.
- Bir kullanıcı bir okula sadece bir değerlendirme yapabilir (güncelleme serbest).
- School_admin scope: rapor sadece token'dan gelen school_id; override yok.
- Moderasyon: pending → superadmin onayı → approved. hidden = gizlendi.

**Event (ops.):** Yeni değerlendirme/soru → school_admin'a Inbox özeti (ileride eklenebilir).

**Kabul:** Liste, detay, CRUD, rapor, modül ayarları, scope uyumu.

---

## 17. Ayarlar & Uygulama Sağlığı

**Amaç:** Tercih, cache, sürüm, geri bildirim.

**Teacher:** Bildirim tercihleri kısa yol, tema (Light/Dark/Sistem), cache temizle, sürüm bilgisi, sorun bildir, çıkış.

**Kurallar:** Karmaşık teknik ayar, geliştirici modu yok. Offline/online durumu net.

**Kabul:** Tercihler, tema, cache, sürüm, sorun bildir, çıkış.
