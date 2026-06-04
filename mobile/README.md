# Uzaedu Optik (Flutter)

Native optik tarama — PWA yönetim paneli ile birlikte.

## Mimari

- **PWA (kurulum devam):** `web-admin` ana uygulama — panele ekle, push, offline; optik **yönetim** burada
- **Bu uygulama:** 5 kare + sunucu OpenCV, canlı rehber (ışık/köşe), kalite kapısı, belirsiz şık onayı

## P0 (doğruluk)

1. `omr_image_quality.dart` — bulanık/karanlık red
2. `omr_live_guidance.dart` — 3 sn önizleme anchor
3. `omr_burst_decoder.dart` — çoklu kare oylama
4. Backend `decode_params` — LGS/TYT/varsayılan eşik

## P1

- Offline kuyruk (`offline_scan_queue.dart`) + `SyncService.flushQueue`
- Google Firebase giriş (`LoginPage`, `dart-define FIREBASE_*`)
- Toplu sınıf (`batch=1` deep link, oturum listesinde «Toplu sınıf tara»)

```powershell
flutter run `
  --dart-define=API_BASE_URL=http://10.0.2.2:4000/api `
  --dart-define=FIREBASE_API_KEY=... `
  --dart-define=FIREBASE_AUTH_DOMAIN=... `
  --dart-define=FIREBASE_PROJECT_ID=...
```

Test: `flutter test` · `npm run test:optik-params` · `npm run test:optik-golden`

## P2

- Öğrenci no. + `POST /optik/feedback/omr-corrections`
- Kare ön işleme: `omr_frame_enhance.dart` (`OMR_ENHANCE_FRAMES`, varsayılan açık)
- OpenCV cihaz: `OMR_OPENCV_ENHANCE=1` + `opencv_dart` + Flutter ≥3.38 + `dart run opencv_dart:setup`

## P2b

- Golden dosya: `npm run generate:optik-golden-ppm -- file-25x4-abcd` → `test-fixtures/optik-omr-golden/*.ppm`
- **Deep link:** `uzaedu://optik/scan?template_id=…&mode=mc_student&session_id=…`

## Çalıştırma

Paketler (pub.dev socket / exit 69):

```powershell
Set-Location c:\UzaMobil\ogretmenpro\mobile
.\scripts\pub-get.ps1
```

Doğrudan pub.dev: `.\scripts\pub-get.ps1 -UsePubDev`

```powershell
Set-Location c:\UzaMobil\ogretmenpro\backend; npm run start:dev
Set-Location c:\UzaMobil\ogretmenpro\mobile; .\scripts\pub-get.ps1
flutter run --dart-define=API_BASE_URL=http://10.0.2.2:4000/api
```

Fiziksel cihaz (LAN): `API_BASE_URL=http://<PC-IP>:4000/api`

İlk giriş: PWA’daki JWT’yi yapıştırın (geliştirme). Firebase entegrasyonu sonraki adım.

## PWA

`NEXT_PUBLIC_OPTIK_SCAN_SURFACE=native` (varsayılan) — tarama butonları mobil uygulamayı açar.

Geliştirici tarayıcı kamerası: panelde «Tarayıcıda tara» veya `localStorage optik_scan_surface_pwa=1`.
