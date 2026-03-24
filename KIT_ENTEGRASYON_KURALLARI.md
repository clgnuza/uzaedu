# Kit Entegrasyon Kuralları (Metronic + FlutKit)

Bu doküman, Metronic (Web Admin) ve FlutKit (Flutter) ile **sonradan sıkıntı yaşamamak** için uyulması gereken kuralları tanımlar. Cursor ve ekip bu kurallara göre geliştirme yapar.

---

## 0. Genel Kurallar (İki Kit İçin Geçerli)

- **Kit = sadece UI bileşenleri ve layout.** İş kuralları, API, rol/scope, state ve navigasyon **her zaman proje kodunda** tutulur; kit demo mantığı production’a taşınmaz.
- **Spec öncelikli.** CURSOR_SPEC, MODULE_RULES ve AUTHORITY_MATRIX ile çakışan kit varsayılanları **override** edilir; kit spec’e uydurulur.
- **Ortak terminoloji:** GLOSSARY.md’deki terimler kullanılır (duyuru, nöbet, jeton, school_id, user_id, vb.).
- **Kit güncellemesi:** Kit’in yeni sürümü alındığında, önce ayrı branch’te test edilir; tema ve entegrasyon noktaları dokümante edilir; breaking change varsa bu dosya güncellenir.

### 0.1 Kit kaynak yolları (orijinaller)

Orijinal kit dosyaları aşağıdaki yollarda tutulur. Cursor veya ekip kit'ten bileşen alırken **sadece gerekenleri** bu yollardan okur; tüm kit projeye kopyalanmaz.

- **Metronic (Web Admin):** `C:\UzaMobil\hazirkit\metronic`
- **FlutKit (Flutter):** `C:\UzaMobil\hazirkit\flutkit`

Detay: **KIT_KAYNAK_YOLLARI.md**

---

## 1. Metronic (Web Admin – Next.js) Entegrasyon Kuralları

### 1.1 Klasör ve Dosya Yapısı (Zorunlu)

- **Proje kökü:** `web-admin/` veya `admin-panel/` gibi tek bir kök; Metronic template bu kökün içinde açılır.
- **Kendi kodunuz kit’ten ayrılsın:**
  - `src/lib/` veya `lib/`: API client, auth helper, constants (API base URL, roller).
  - `src/services/` veya `services/`: Backend çağrıları (duyuru, nöbet, okul, kullanıcı).
  - `src/hooks/`: useAuth, useSchoolId, useRole gibi hook’lar; **rol ve school_id buradan** gelir, Metronic’in demo auth’u kullanılmaz.
  - `src/guards/` veya `src/middleware/`: Route guard (allowedRoles kontrolü); AUTHORITY_MATRIX’e göre.
- **Metronic’e dokunmayın:** Metronic’in kendi theme/layout bileşenleri mümkün olduğunca **override** veya **wrap** ile özelleştirilir; core dosyaları doğrudan değiştirmeyin. Kendi bileşenleriniz `src/components/` altında olsun.

### 1.2 API ve Auth (Zorunlu)

- **Tek API client:** Tüm backend istekleri tek bir client üzerinden (axios/fetch instance); base URL **sadece** `.env` / `NEXT_PUBLIC_API_BASE_URL`’den okunur. Metronic demo API URL’leri kullanılmaz.
- **Auth:** Giriş/çıkış ve token yönetimi proje kodunda; Firebase Auth veya Core Backend JWT. Metronic’in demo login/register sayfaları **kaldırılıp** kendi login sayfanız bağlanır.
- **Her istekte:** Token header’da (Bearer); school_admin isteklerinde backend zaten `school_id`’yi token/session’dan alır — client’ta başka okul seçimi **yok**.

### 1.3 Menü ve Route (Zorunlu)

- **Menü içeriği:** AUTHORITY_MATRIX.md “Web Admin – Route Erişimi” tablosundan türetilir. Menü config’te her item için `allowedRoles: ['superadmin']` veya `['school_admin']` tanımlı olsun; render sırasında kullanıcı rolüne göre filtre uygulanır.
- **Route guard:** Her admin layout veya sayfa girişinde: “Kullanıcı rolü bu sayfaya yetkili mi?” Değilse 403 veya dashboard’a yönlendir. Guard, `useRole()` veya benzeri tek kaynaktan beslenir.
- **Yeni sayfa eklerken:** Önce AUTHORITY_MATRIX’e ekleyin; sonra menü + guard’ı güncelleyin.

### 1.4 Tema ve Stil (Önerilen)

- Renk değişikliği: Metronic’in CSS variables veya theme config dosyasını **kopyalayıp** proje klasöründe override edin; orijinal theme dosyasını doğrudan değiştirmeyin (güncelleme sırasında üzerine yazılmasın).
- Spec: Light varsayılan, kurumsal (lacivert/yeşil/turuncu). Dark mode Metronic destekliyorsa aynı kurallara uyulur.

### 1.5 Yapılmayacaklar (Metronic)

- Metronic demo sayfalarındaki sahte API çağrıları veya mock data production’da **kullanılmaz**.
- Başka okulun verisini gösterecek bir “school seçici” school_admin için **eklenmez** (scope ihlali).
- Rol kontrolü sadece menüde değil, **mutlaka** sayfa/route seviyesinde de (guard) yapılır.
- Kit’in kendi state yönetimi (varsa) global iş kuralları için **kullanılmaz**; proje kendi state’ini (Context/Zustand/React Query vb.) kullanır.

---

## 2. FlutKit (Flutter) Entegrasyon Kuralları

### 2.1 Klasör ve Dosya Yapısı (Zorunlu)

- **Proje kökü:** Flutter proje kökü (örn. `mobile/` veya `flutter_app/`). FlutKit bileşenleri `lib/vendor/flutkit/` veya `lib/ui/kit/` gibi **tek bir alt ağaçta** toplansın; kendi ekranlarınız `lib/screens/`, `lib/features/` gibi ayrı dizinde olsun.
- **Ayrım net olsun:**
  - `lib/core/`: API client, auth, constants, theme (AppTheme — sizin override’larınız).
  - `lib/features/` veya `lib/screens/`: Haber, Nöbet, Ek Ders, Evrak, Market vb. — **her modül kendi klasörü** (MODULE_RULES’taki modül listesiyle uyumlu).
  - `lib/routes/`: Route tanımları ve **deep link** eşlemesi (NOTIFICATION_MATRIX’teki target_screen).
  - FlutKit’ten alınan widget’lar sadece `lib/ui/kit/` (veya vendor) altında; ekran mantığı ve state **kendi kodunuzda**.

### 2.2 Tema (Zorunlu)

- **Tek ThemeData kaynağı:** Uygulama tek bir `ThemeData` yapısı kullanır; Light ve Dark için iki set renk. FlutKit’in tema dosyaları **kopyalanıp** projede `lib/core/theme/` altında override edilir; orijinal FlutKit tema dosyasına doğrudan dokunulmaz.
- **Semantic isimler:** `backgroundPrimary`, `cardSurface`, `textPrimary`, `accentPrimary`, `textSecondary` vb. kullanılır; renkler bu token’lardan gelir. CURSOR_SPEC’teki “Light varsayılan + Dark tam destek” kuralına uyulur.
- **Kullanıcı tercihi:** Ayarlar’da Light / Dark / Sistemle aynı; tercih saklanır ve uygulama başlarken uygulanır.

### 2.3 Navigasyon ve Deep Link (Zorunlu)

- **Route listesi:** NOTIFICATION_MATRIX.md’deki “Deep Link / target_screen Listesi” **tek doğruluk kaynağı**. Yeni target_screen eklenirse önce NOTIFICATION_MATRIX güncellenir, sonra Flutter’da route eklenir.
- **Push/Inbox yönlendirme:** Gelen `target_screen` + `entity_id` parse edilir; bilinmeyen değer için varsayılan (örn. ana sayfa veya Inbox) kullanılır. Cold start’ta da aynı mantık çalışır.
- **go_router veya Navigator 2.0:** Tercih projeye göre; önemli olan target_screen → route eşlemesinin tek yerde (örn. route map veya switch) tutulması.

### 2.4 API ve State (Zorunlu)

- **Tek API client:** Base URL ortama göre (dart-define veya config); tüm istekler bu client üzerinden. API_CONTRACT ve ERROR_CODES’a uygun hata işleme (401 → giriş ekranı, 403 → mesaj, vb.).
- **State:** Bloc, Provider, Riverpod vb. proje tercihi; **kit’in kendi state’i** iş kuralı veya API verisi için kullanılmaz. Kit sadece görsel bileşen (kart, liste, form alanı).
- **Scope:** Teacher sadece kendi verisi; backend filtreler. Client’ta “başka kullanıcı” seçimi olmaz.

### 2.5 Modül Görünürlüğü (Zorunlu)

- **Menü / bottom nav:** Görünen modüller AUTHORITY_MATRIX “Mobil Modül Görünürlüğü” ve (varsa) okul bazlı feature flag ile belirlenir. Kapalı modül hem menüde gizlenir hem doğrudan route ile açılamaz (veya “Modül kapalı” mesajı).

### 2.6 Yapılmayacaklar (FlutKit)

- FlutKit demo ekranları veya demo navigasyonu production’da **kullanılmaz**; sadece ihtiyaç duyulan widget’lar projeye alınır.
- Tema renkleri **hard-coded** olmaz; her zaman theme token’dan (Theme.of(context) veya extension) okunur.
- Kit’in kendi API veya auth katmanı **kullanılmaz**; proje kendi `core/` katmanını kullanır.
- target_screen değeri **uydurulmaz**; sadece NOTIFICATION_MATRIX’te tanımlı değerler kullanılır.

---

## 3. İki Kit Arası Tutarlılık

- **Backend tek kaynak.** Hem Web Admin hem Flutter aynı Core Backend’e bağlanır; aynı endpoint’ler (rol bazlı), aynı hata kodları (ERROR_CODES), aynı terminoloji (GLOSSARY).
- **Olay ve bildirim:** Event türleri ve target_screen listesi NOTIFICATION_MATRIX’te ortak; backend push atarken bu listeye uyar, Flutter sadece bu listeyi parse eder.
- **Yeni özellik:** Önce CURSOR_SPEC / MODULE_RULES / AUTHORITY_MATRIX / API_CONTRACT güncellenir; sonra Metronic veya Flutter tarafında geliştirme yapılır. Önce kit’te “demo gibi” yapıp sonra spec’e uydurmak **yasak** (teknik borç birikir).

---

## 4. Kit Güncellemesi (Sürüm Yükseltme)

- **Metronic/FlutKit yeni sürüm** alındığında:
  1. Ayrı branch’te (örn. `chore/kit-update-metronic-2026`) deneyin.
  2. Değişen dosya listesini not edin; override ettiğiniz dosyalar yeni sürümde nasıl etkileniyor kontrol edin.
  3. Tema, route guard, API client gibi **proje koduna** dokunulmamalı; sadece kit bileşenleri güncellenir.
  4. Smoke test (SMOKE_TEST_CHECKLIST) çalıştırın; sorun yoksa merge.
  5. Bu dokümana “Son kit güncellemesi: Metronic vX, FlutKit vY (tarih)” notu ekleyin.

---

## 5. Kontrol Listesi (Yeni Geliştirici veya Cursor İçin)

**Web Admin (Metronic) eklerken:**
- [ ] Yeni sayfa AUTHORITY_MATRIX’te tanımlı mı? Hangi rol?
- [ ] API çağrısı API_CONTRACT’taki endpoint’ten mi? Base URL env’den mi?
- [ ] Menüde rol filtresi ve sayfada route guard var mı?
- [ ] school_id client’ta yanlışlıkla override edilmiyor mu?

**Flutter (FlutKit) eklerken:**
- [ ] Yeni ekran NOTIFICATION_MATRIX’teki target_screen ile eşleşiyor mu (bildirimden gelecekse)?
- [ ] Renkler theme token’dan mı alınıyor?
- [ ] API çağrısı proje API client’ından mı? Hata kodu işleniyor mu?
- [ ] Modül, kullanıcı rolüne ve feature flag’e göre görünür mü?

**Ortak:**
- [ ] Terimler GLOSSARY’e uygun mu?
- [ ] Yeni event veya target_screen ekleniyorsa NOTIFICATION_MATRIX güncellendi mi?

---

*Bu kurallar CURSOR_SPEC, MODULE_RULES, AUTHORITY_MATRIX, NOTIFICATION_MATRIX, API_CONTRACT, ERROR_CODES ve GLOSSARY ile uyumludur. İhlal edilmemesi, sonradan sıkıntı yaşanmaması için kritiktir.*
