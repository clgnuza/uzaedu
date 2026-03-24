# Hazır Kit Kullanım Rehberi (Metronic + FlutKit)

Projede kullandığınız iki hazır kit: **Metronic** (Web Admin) ve **FlutKit** (Flutter). Bunları spec’e uygun ve hata riski az şekilde nasıl kullanacağınızın özeti.

> **Zorunlu kurallar:** Kit ile ilgili tüm teknik kurallar (klasör yapısı, API/auth, tema, deep link, yapılmayacaklar) **KIT_ENTEGRASYON_KURALLARI.md** dosyasında tanımlıdır. Önce o dosyaya uyun; bu rehber kullanım özeti ve Cursor referansları içerir.

---

## 1. Genel İlkeler

- **Kit = iskelet ve bileşenler.** İş kuralları, API çağrıları, rol/scope ve navigasyon sizin kodunuzda kalır.
- **Tema ve renkler** spec’e göre override edin (Light varsayılan, Dark tam destek; kurumsal lacivert/yeşil/turuncu).
- **Dokümanları referans alın:** CURSOR_SPEC, MODULE_RULES, AUTHORITY_MATRIX, GLOSSARY. Cursor’a “@ogretmenpro” veya ilgili dosyayı verin.

---

## 2. Metronic (Web Admin – Next.js + React)

### 2.1 Kurulum
- Metronic’in **Next.js** sürümünü kullanın (React tabanlı).
- Satın aldığınız paketten ilgili template’i indirin; dokümantasyonunda “Next.js” veya “React” kurulum adımları vardır.
- Genelde: template’i açın → `npm install` → `npm run dev` ile çalıştırın; port (örn. 3001) dokümana göre değişir.

### 2.2 Proje Yapısına Uyarlama
- **API base URL:** Tüm istekler **Core Backend**’e gitsin. Metronic’te örnek API çağrıları varsa bunları kendi endpoint’lerinizle değiştirin.
  - Öneri: `lib/api/client.ts` veya `services/api.ts` gibi tek bir yerde `fetch`/`axios` instance; base URL `.env`’den (`NEXT_PUBLIC_API_BASE_URL`).
- **Auth:** Giriş için Firebase Auth veya backend JWT kullanıyorsanız, Metronic’in demo auth’unu kaldırıp kendi login/logout ve token saklama mantığınızı bağlayın.
- **Rol bilgisi:** Giriş sonrası kullanıcı bilgisi (rol: superadmin | school_admin | teacher) ve gerekirse `school_id` backend’den veya token’dan alınsın; layout ve menü buna göre kısıtlansın.

### 2.3 Menü ve Route Guard
- **Menü:** AUTHORITY_MATRIX.md’deki “Web Admin – Route Erişimi” tablosuna göre:
  - **school_admin** sadece: Dashboard, Okul Duyuruları, Nöbet, Duyuru TV, Okullar Tanıtım (kendi), Öğretmenler, Ayarlar.
  - **superadmin** sadece: Dashboard, Okullar, Kullanıcılar, Modüller, Market Politikası, Evrak Şablonları, Ekders Parametreleri, Kazanım Setleri, Moderasyon, Sistem Duyuruları.
- Metronic menü yapısını (sidebar/nav config) bu role göre filtreleyin: `allowedRoles` veya benzeri bir kontrol.
- **Route guard:** Her admin sayfasında (veya layout’ta) kontrol: “Bu rol bu sayfaya girebilir mi?” Hayırsa 403 sayfasına veya dashboard’a yönlendir.
- **school_id scope:** School admin için tüm liste/create/update isteklerinde `school_id` backend’e gönderilsin; backend zaten token’dan doğrulayacak, client tarafında da “başka okul” seçimi olmasın.

### 2.4 Tema (Opsiyonel Ayar)
- Spec: sade, kurumsal; Light varsayılan.
- Metronic’in tema değişkenlerini (CSS variables veya theme config) override ederek kendi renklerinizi (lacivert, yeşil, turuncu) kullanabilirsiniz; zorunlu değil ama marka tutarlılığı için iyidir.

### 2.5 Kullanım Özeti
1. Metronic Next.js template’i kurun.
2. API client’ı kendi backend’inize ve ENV_EXAMPLE.md’ye göre ayarlayın.
3. Auth’u kendi sisteminize (Firebase/backend) bağlayın; rol + school_id alın.
4. Menüyü AUTHORITY_MATRIX’e göre role göre filtreleyin; route guard ekleyin.
5. Sayfa içeriklerini CURSOR_SPEC ve MODULE_RULES’taki ekranlara göre doldurun (duyuru CRUD, nöbet planı, okul CRUD vb.).

---

## 3. FlutKit (Flutter Mobil)

### 3.1 Kurulum
- FlutKit’i satın aldıysanız genelde bir Flutter projesi (veya modül seti) + Figma dosyası gelir.
- Mevcut projenize entegre edecekseniz: FlutKit’teki **sadece ihtiyacınız olan ekran/bileşenleri** (kart, liste, form, buton, app bar vb.) kendi projenize kopyalayın veya FlutKit’i paket/klasör olarak proje içine alın (dokümantasyonundaki yönteme uyun).

### 3.2 Tema ve Renk (Önemli)
- Spec: **Light varsayılan**, **Dark tam destek**; semantic token (backgroundPrimary, cardSurface, textPrimary, accentPrimary).
- FlutKit’in varsayılan temasını **override** edin:
  - `ThemeData` ile tek bir design system; Light ve Dark için ayrı renk setleri.
  - Renkler: arka plan (açık gri/kırık beyaz – light; koyu gri – dark), kart (beyaz / 1–2 ton açık), ana renk (lacivert/koyu mavi), vurgu (yeşil, turuncu).
- **Ayarlar** ekranında: Light / Dark / Sistemle aynı seçenekleri sunun; tercih cihazda saklansın.

### 3.3 Navigasyon ve Deep Link
- **target_screen** listesi NOTIFICATION_MATRIX.md’de tanımlı. Her değer (örn. `haber/okulum/:id`, `nobet/detay`) Flutter’da bir route’a karşılık gelmeli.
- Push veya Inbox’tan gelen `target_screen` + `entity_id` ile ilgili sayfayı açın; cold start’ta da aynı mantık çalışsın.
- FlutKit’in demo navigasyonunu kaldırıp kendi route tree’nizi (go_router veya Navigator 2.0) kullanın; kit sadece sayfa içi bileşenler (kart, liste, form) için kalsın.

### 3.4 Modül ve Veri
- Her modül (Haber, Nöbet, Ek Ders, Evrak, Market vb.) kendi ekranları ve state’i ile; **API_CONTRACT.md**’deki endpoint’lere istek atın.
- Scope: Teacher sadece kendi verisi; backend zaten filtreler, yine de client’ta “başka kullanıcı/okul” seçimi olmasın.
- Offline/cache: Spec’te geçen modüller için (duyuru listesi, ek ders parametreleri vb.) cache stratejisi uygulayın; FlutKit’in kendi state yönetimi varsa sizin API katmanınızla birleştirin.

### 3.5 Kullanım Özeti
1. FlutKit’i projeye ekleyin; sadece kullanacağınız bileşenleri/ekranları alın.
2. Tema: Light/Dark semantic token + spec renkleri; ThemeData ile merkezi yönetim.
3. Navigasyon: Kendi route yapınız; NOTIFICATION_MATRIX’teki target_screen’leri route’lara eşleyin.
4. Veri: Tek API client, MODULE_RULES ve API_CONTRACT’a göre; rol/scope backend’de, mobil sadece kendi ekranlarını doldursun.
5. Menü: Sadece kullanıcının yetkili olduğu modüller görünsün (okul bazlı feature flag varsa ona göre).

---

## 4. İki Kit Birlikte Nasıl Çalışır?

- **Metronic:** Sadece **Web Admin** (superadmin + school_admin). Giriş → rol → menü → her sayfa kendi API’sini çağırır; Core Backend tek kaynak.
- **FlutKit:** Sadece **mobil öğretmen uygulaması**. Aynı Core Backend’e bağlanır; farklı endpoint’ler (örn. teacher için `/me`, `/announcements`, `/duty/plans` vb.).
- **Ortak:** Auth (Firebase veya backend JWT), API base URL ortama göre (ENV_EXAMPLE), terminoloji (GLOSSARY) ve iş kuralları (MODULE_RULES, CURSOR_SPEC) iki tarafta da aynı kavramlarla uygulanır.

---

## 5. Cursor ile Kullanım

- Yeni özellik veya sayfa yazarken Cursor’a şunu söyleyin: “@ogretmenpro CURSOR_SPEC ve MODULE_RULES’a göre …” veya “@ogretmenpro AUTHORITY_MATRIX’e göre bu sayfaya sadece school_admin girsin.”
- API tasarlarken: “@ogretmenpro API_CONTRACT ve ERROR_CODES’a uygun şekilde …”
- Bildirim/deep link: “@ogretmenpro NOTIFICATION_MATRIX’teki target_screen’e göre …”
- İsimlendirme: “@ogretmenpro GLOSSARY’deki terimlere göre …”

Bu sayede kit’ler sadece UI iskeleti sağlar; iş kuralları ve dokümanlar tutarlı kalır.

---

## 6. Kontrol Listesi

**Metronic**
- [ ] Next.js template kuruldu; API base URL ve auth kendi sisteminize bağlandı.
- [ ] Menü AUTHORITY_MATRIX’e göre role göre kısıtlandı; route guard var.
- [ ] school_admin istekleri school_id ile; superadmin tüm okullar.

**FlutKit**
- [ ] Tema Light/Dark spec’e göre; semantic token + kurumsal renkler.
- [ ] Deep link (target_screen) NOTIFICATION_MATRIX ile eşlendi.
- [ ] API tek merkezden; MODULE_RULES ve API_CONTRACT’a uygun.
- [ ] Menüde sadece yetkili modüller görünüyor.

---

*CURSOR_SPEC, MODULE_RULES, AUTHORITY_MATRIX, NOTIFICATION_MATRIX, GLOSSARY ve ENV_EXAMPLE ile uyumludur.*
