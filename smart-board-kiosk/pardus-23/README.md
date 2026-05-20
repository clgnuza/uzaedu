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
- URL: `kiosk=1` + `kilit=1` (duyuru varsayılan); `usb=1` kullanılmaz.

**Tahta kilidi:** `kilit=1` → duyuru slaytı; öğretmen QR onayı → kullanım modu.

**İki kurulum yolu:** (1) Panelden cihaza özel .deb/ZIP (`school_id` + `device_id` conf içinde). (2) Tarayıcıda `setup=1&school_code=…` ile web kurulum ekranı (yeni sınıf kaydı).

**Zorunlu:** Panel → Duyuru TV → **izinli IP listesi** dolu olmalı; yoksa tahta QR/duyuru istekleri reddedilir (kurulum ekranı hariç).

Gerçek conf paketleri panelden indirilir.
