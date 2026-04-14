# Pardus 23 (Etap) — akıllı tahta kiosk

Üretilen paket **web yönetim panelinden** indirilir: **Akıllı Tahta → Ayarlar → USB ile sınıf tahtası → Pardus ZIP** (her cihaz satırında).

Paket içeriği (örnek `i-kilit-pardus-etap.zip` ile benzer **klasör düzeni**; native ikili / sudoers / .deb yok):

- `Makefile` — `sudo make install` / `sudo make uninstall`  
- `bin/ogretmenpro-tahta-launch.sh` — Chromium’u bu sınıfa özel `/tv/classroom` ile açar  
- `bin/desktop/ogretmenpro-tahta.desktop` — menü / autostart kaynağı  
- `assets/ogretmenpro-tahta.svg` — simge (`/usr/local/share/pixmaps/`)  
- `packages/README.txt` — bağımlılıklar `apt` ile (paket içinde .deb yok)  
- `ogretmenpro-tahta.conf` — panel kökü, `school_id`, `device_id`, API kökü, `KIOSK_MODE`, `KILIT_MODE` (`kilit=1`)  
- `chromium-policy-managed.json` — URL allowlist + kiosk sıkılaştırma  
- `install.sh` / `uninstall.sh` — doğrudan veya Make ile  
- Başlatıcı: `xset` varsa DPMS kapatır; `CHROME_EXTRA_FLAGS` (`ogretmenpro-tahta.conf`)

**Tahta kilidi:** `kilit=1` ile arayüzde yalnızca okul duyuru slaytları döner; öğretmen/idare PIN’i olmadan USB akışında veri zaten sunucuda kapalıdır. Tam cihaz güvenliği için BIOS, ayrı kullanıcı ve VLAN şarttır.

Sunucu tarafında **TV izinli IP listesi** ve **kayıtlı cihaz** doğrulaması kullanılmalıdır; bu klasör şablon dokümantasyonudur — gerçek conf ZIP panelden iner.
