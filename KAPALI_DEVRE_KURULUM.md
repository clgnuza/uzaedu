# Öğretmen Pro – Kapalı Devre ve Hibrit Kurulum

Backend, Web Admin ve TV ekranlarının **okul içi ağda** veya **hibrit** (Web Admin online, TV’ler yerel) çalıştırılması için rehber.

---

## Hibrit Kurulum (Web Admin Online, TV’ler Okul Ağında)

**Senaryo:** Web Admin bulutta çalışsın (ayarlar her yerden yapılabilsin), 2 TV kanalı (koridor + öğretmenler odası) ise okul içi ağda, aynı LAN’da çalışsın.

### A) TV cihazları internete çıkabiliyorsa (en basit)

- Web Admin + Backend → bulutta (örn. `https://admin.ogretmenpro.com`, `https://api.ogretmenpro.com`)
- 2 TV ekranı → okul ağındaki bilgisayar/tablet’te tarayıcı açılır

**TV adresleri:**
- Koridor: `https://admin.ogretmenpro.com/tv/corridor?school_id=XXX`
- Öğretmenler odası: `https://admin.ogretmenpro.com/tv/teachers?school_id=XXX`

Her iki TV de okul ağındadır; sayfa ve veri buluttan gelir. İkisi de aynı ağda çalışır.

### B) TV cihazları internete çıkmıyorsa (tam kapalı devre)

Bu durumda TV verisi yerelde olmalı:
- Okul sunucusunda **sadece Backend** çalışır (veri yerelde)
- Web Admin bulutta kalır → ayarlar online yapılır, veri Backend’e yazılır
- **Sorun:** Buluttaki Web Admin, okul içi Backend’e erişemez (farklı ağlar)

Bu yüzden tam kapalı devrede:
- **Ya** her şey yerelde (Backend + Web Admin + TV)
- **Ya da** TV’ler internet erişimine sahip olmalı (Hibrit A)

### Özet tablo

| Bileşen | Bulutta | Okul ağında |
|---------|---------|-------------|
| Web Admin | ✅ Yönetim her yerden | — |
| Backend | ✅ | — |
| 2 TV kanalı | — | ✅ Koridor + öğretmenler odası aynı LAN’da |

**Sonuç:** Evet, 2 TV kanalı aynı okul ağında çalışabilir; ikisi de buluttaki TV sayfasını açarsa (Hibrit A) aynı ağda, aynı veri kaynağına bağlı çalışırlar.

---

# Kapalı Devre (Tamamen Okul İçi Ağ) Kurulum

Backend, Web Admin ve TV ekranlarının **okul içi ağda** çalıştırılması için adım adım rehber. Veri okul dışına çıkmaz (KVK/güvenlik için uygun).

---

## 1. Genel Bakış

| Bileşen | Port | Açıklama |
|---------|------|----------|
| PostgreSQL | 5432 | Veritabanı (Docker veya kurulum) |
| Backend (NestJS) | 4000 | API sunucusu |
| Web Admin (Next.js) | 3000 | Yönetim paneli + TV sayfası |

**Gereksinimler:**
- Okul sunucusu (Windows veya Linux)
- Node.js 18+ (LTS önerilir)
- Docker (PostgreSQL için) veya kurulu PostgreSQL
- Sabit yerel IP (örn. `192.168.1.100`)

---

## 2. Sunucu IP’si ve Ağ

1. Sunucuya sabit IP atayın (örnek: `192.168.1.100`)
2. TV cihazları ve yönetim bilgisayarları aynı ağda olmalı
3. **İnternet**: Kapalı devrede gerekmez; ancak:
   - Hava durumu → Open-Meteo API kullanır (internet gerekir)
   - RSS / Günün sözü → Harici URL kullanıyorsa internet gerekir
   - **Tam kapalı devre** için Ayarlar’da bu alanları boş bırakın

---

## 3. Kurulum Adımları

### 3.1 PostgreSQL

**Docker ile (önerilen):**
```bash
cd c:\UzaMobil\ogretmenpro
docker compose up -d
```

**veya** PostgreSQL kurulu ise: `ogretmenpro` veritabanı oluşturun.

---

### 3.2 Backend

```bash
cd backend
cp .env.example .env
```

**`.env` düzenleyin** (okul sunucusu IP’si `192.168.1.100` kabul edildi):

```env
APP_ENV=production
APP_DEBUG=false
APP_PORT=4000
APP_URL=http://192.168.1.100:4000

DB_HOST=127.0.0.1
DB_PORT=5432
DB_DATABASE=ogretmenpro
DB_USERNAME=postgres
DB_PASSWORD=postgres

# CORS: Web Admin erişecek adresler (sunucu + diğer bilgisayarlar)
CORS_ORIGINS=http://192.168.1.100:3000,http://localhost:3000

# Firebase (Web Admin giriş için – kapalı devrede opsiyonel)
# Boş bırakırsanız yerel Bearer token test yöntemi kullanılır
FIREBASE_PROJECT_ID=
FIREBASE_CLIENT_EMAIL=
FIREBASE_PRIVATE_KEY=
```

**Migration ve başlatma:**
```bash
npm install
npm run migration:run
npm run build
npm run start:prod
```

Backend artık `http://192.168.1.100:4000/api` üzerinden erişilebilir olmalı.

---

### 3.3 Web Admin

```bash
cd web-admin
cp .env.example .env.local
```

**`.env.local` düzenleyin** (Backend’in adresi):

```env
# Okul sunucusundaki Backend API
NEXT_PUBLIC_API_BASE_URL=http://192.168.1.100:4000/api

# Firebase (giriş için – kapalı devrede boş bırakılabilir)
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=
```

**Build ve başlatma:**
```bash
npm install
npm run build
npm run start
```

Web Admin artık `http://192.168.1.100:3000` üzerinden erişilebilir.

---

### 3.4 Backend’i Dinleyecek Şekilde Ayarlama (Ağ Üzerinden Erişim)

Varsayılan olarak NestJS `0.0.0.0` üzerinden dinler; farklı bir makineden bağlanırken sorun olmaz.

Windows’ta güvenlik duvarı kuralı ekleyebilirsiniz:
```powershell
netsh advfirewall firewall add rule name="OgretmenPro Backend" dir=in action=allow protocol=tcp localport=4000
netsh advfirewall firewall add rule name="OgretmenPro Web Admin" dir=in action=allow protocol=tcp localport=3000
```

---

## 4. TV Ekranlarını Açma

Koridor veya öğretmenler odasındaki bilgisayar/tablet’te tarayıcı açın:

- **Koridor:** `http://192.168.1.100:3000/tv/corridor`
- **Öğretmenler odası:** `http://192.168.1.100:3000/tv/teachers`
- **Okul ID ile:** `http://192.168.1.100:3000/tv/corridor?school_id=XXX`

Tam ekran: `F11` veya tarayıcı tam ekran modu. **Kiosk modu:** URL'ye `&kiosk=1` ekleyin (örn. `.../tv/corridor?school_id=XXX&kiosk=1`); açılışta "Tam ekrana geçmek için dokunun" overlay çıkar, dokununca tam ekran olur. Ekran uyandığında veri otomatik yenilenir.

---

## 5. Tam Kapalı Devre (İnternet Yok)

| Özellik | İnternet Gerekli mi? | Kapalı Devrede |
|---------|----------------------|-----------------|
| Duyurular, slaytlar | Hayır | ✅ Çalışır |
| TV yayınlama | Hayır | ✅ Çalışır |
| Hava durumu | Evet (Open-Meteo) | Ayarlar’da `tv_weather_city` boş bırakın |
| RSS haber | Evet (harici URL) | `tv_rss_url` boş bırakın |
| Günün sözü | Evet (harici URL) | `tv_gunun_sozu_rss_url` boş bırakın |
| Web Admin giriş (Firebase) | Evet | Bearer token ile test veya yerel auth |

**Özet:** Tüm harici URL’leri boş bırakırsanız, sistem tamamen okul içi ağda çalışır.

---

## 6. Otomatik Başlatma (Opsiyonel)

### Windows (Görev Zamanlayıcı veya Servis)

Backend ve Web Admin’i Windows açılışında çalıştırmak için:

- **NSSM** veya **PM2** ile servis olarak kurabilirsiniz
- Veya basit `.bat` ile:
```batch
@echo off
cd /d c:\UzaMobil\ogretmenpro\backend
start "Backend" node dist/main.js
cd ..\web-admin
start "Web Admin" npm run start
```

### Linux (systemd)

`/etc/systemd/system/ogretmenpro-backend.service`:
```ini
[Unit]
Description=OgretmenPro Backend
After=network.target postgresql.service

[Service]
Type=simple
User=ogretmen
WorkingDirectory=/opt/ogretmenpro/backend
ExecStart=/usr/bin/node dist/main.js
Restart=on-failure

[Install]
WantedBy=multi-user.target
```

---

## 7. Kontrol Listesi

- [ ] PostgreSQL çalışıyor (`docker ps` veya servis)
- [ ] Backend `http://192.168.1.100:4000/api/health` yanıt veriyor
- [ ] Web Admin `http://192.168.1.100:3000` açılıyor
- [ ] TV sayfası `http://192.168.1.100:3000/tv/corridor` duyuruları gösteriyor
- [ ] CORS hataları yok (farklı bilgisayardan deneyin)
- [ ] Ayarlar’da harici URL’ler boş (tam kapalı devre için)

---

*Bu rehber KAPALI_DEVRE_KURULUM.md olarak proje kökünde tutulmaktadır.*
