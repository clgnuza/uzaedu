# Kritik Akış Kontrol Listesi (Smoke Test)

Her release (staging veya production) öncesi bu liste üzerinden “açılıyor mu, veri geliyor mu, hata vermiyor mu?” kontrolü yapılır. Detaylı test senaryoları ve otomasyon bu listeyi genişletebilir.

---

## 1. Giriş ve Yetki

- [ ] **Teacher** ile giriş yapılabiliyor; ana sayfa / dashboard açılıyor.
- [ ] **School admin** ile giriş yapılabiliyor; admin menüsü (duyurular, nöbet, öğretmenler vb.) görünüyor.
- [ ] **Superadmin** ile giriş yapılabiliyor; okullar, kullanıcılar, modül ayarları görünüyor.
- [ ] Yanlış rol ile bir sayfaya doğrudan URL ile gidildiğinde erişim engelleniyor veya yönlendiriliyor (route guard).
- [ ] Çıkış yapılabiliyor; tekrar giriş gerekli.

---

## 2. Mobil (Flutter) – Kritik Ekranlar

- [ ] **Okul duyuruları** listesi 2 saniye civarında açılıyor; liste veya boş durum görünüyor.
- [ ] Bir duyuruya tıklanınca **detay** açılıyor; okundu işaretleniyor (varsa).
- [ ] **Genel haber** (WP) listesi açılıyor; bir habere tıklanınca detay ve "web'de aç" çalışıyor.
- [ ] **Sınav görevi** listesi açılıyor; detay ve tarihler görünüyor.
- [ ] **Nöbetlerim** (nöbet modülü açıksa) açılıyor; bugün / liste veya takvim görünüyor.
- [ ] **Ek ders** ekranı açılıyor; ay seçimi, kalemler (parametreler yüklüyse) görünüyor; hesaplama yapılabiliyor.
- [ ] **Evrak** türü seçilip form doldurulup önizleme / PDF veya Word alınabiliyor (hak varsa).
- [ ] **Kazanım** listesi açılıyor; işlendi/ertelendi işaretleme çalışıyor (varsa).
- [ ] **Market** ekranı açılıyor; bakiye ve haklar görünüyor.
- [ ] **Bildirimler (Inbox)** listesi açılıyor; bir bildirime tıklanınca ilgili detay ekranına gidiliyor.
- [ ] **Ayarlar** açılıyor; tema değişimi (Light/Dark) uygulanıyor.

---

## 3. Web Admin – Kritik Akışlar

- [ ] **Okul admin:** Okul duyurusu oluşturulup yayınlanabiliyor; hedef okul öğretmenleri listesi ile uyumlu.
- [ ] **Okul admin:** Nöbet planı yüklenebiliyor (veya taslak kaydedilebiliyor); yayınlandığında ilgili öğretmenlere bildirim gidiyor (veya Inbox’ta görünüyor).
- [ ] **Okul admin:** Yerine görevlendirme yapılabiliyor; atanan öğretmene bildirim / Inbox kaydı düşüyor.
- [ ] **Superadmin:** Okul eklenebiliyor, güncellenebiliyor; pasif edildiğinde ilgili kullanıcılar giriş yapamıyor (veya uygun mesaj alıyor).
- [ ] **Superadmin:** Kullanıcı / okul admin atama yapılabiliyor; rol değişince menü/erişim doğru güncelleniyor.
- [ ] **Okul admin:** TV ayarlarında "Tüm TV verilerini indir" butonu JSON dosyası indiriyor.
- [ ] **Okul admin:** Excel ile yüklenen her liste (yemek, nöbet, belirli gün vb.) için "Tümünü sil" ve (opsiyonel) "Tüm listeleri temizle" çalışıyor.
- [ ] **Okul admin:** TV ayarlarında "Canlı TV önizleme" açılıp Koridor/Öğretmenler sekmeleriyle iframe önizleme görüntüleniyor.

---

## 4. TV / Kapalı Devre (Kiosk)

- [ ] TV koridor sayfası (`/tv/corridor`) açılıyor; duyurular, slaytlar veya boş durum görünüyor.
- [ ] TV öğretmenler odası sayfası (`/tv/teachers`) açılıyor; hedef içerik görünüyor.
- [ ] Kiosk modu (`?kiosk=1`) ile "Tam ekrana geçmek için dokunun" overlay çıkıyor; dokununca tam ekran oluyor.
- [ ] Sekme geri gelince (visibilitychange) TV verisi otomatik yenileniyor.
- [ ] API hata durumunda "Bağlantı yeniden deneniyor… (1/3)" mesajı ve "Şimdi dene" butonu çalışıyor; 3 deneme sonra hata gösteriliyor.
- [ ] TV IP kısıtlaması açıkken sadece izinli IP’lerden erişim sağlanıyor; diğerleri 403 alıyor.

---

## 5. Audit ve Yedekleme

- [ ] Okul güncellendiğinde `school_updated` audit kaydı oluşuyor; ilgili alanlar loglanıyor.

---

## 6. Bildirim ve Push

- [ ] Okul duyurusu yayınlandığında ilgili öğretmenin **Inbox**’ında kayıt oluşuyor.
- [ ] Önemli duyuruda **push** gidiyor (cihazda bildirim açık ve test ortamında FCM çalışıyorsa).
- [ ] Push’a tıklanınca uygulama açılıp **doğru ekrana** (duyuru detayı vb.) gidiliyor.
- [ ] Sınav görevi / nöbet ile ilgili event’lerde Inbox kaydı oluşuyor; target_screen doğru.

---

## 7. Hata Durumları

- [ ] Yetkisiz bir API isteği (örn. başka okulun duyuruları) **403** veya uygun mesaj dönüyor.
- [ ] Olmayan bir kaynağa istek (örn. `/announcements/yanlis-id`) **404** veya uygun mesaj dönüyor.
- [ ] Token olmadan veya geçersiz token ile istek **401** dönüyor; mobil/web giriş ekranına yönlendiriyor.

---

## 8. Ortam Kontrolü

- [ ] Staging’de **staging** API ve (tercihen) staging Firebase kullanılıyor; production verisi etkilenmiyor.
- [ ] Production build’de **production** API URL’si kullanılıyor; debug/log seviyesi uygun.

---

## Kullanım Notu

- Her madde geçtiyse ✅ işaretlenir; geçmeyen maddeler release’i bloklayabilir veya risk olarak not edilir.
- Yeni kritik özellik eklendikçe bu listeye yeni madde eklenir.
- Otomasyon (E2E) eklenirse aynı akışlar test script’lerine taşınabilir.

---

*MODULE_RULES ve MVP_SCOPE ile uyumludur.*
