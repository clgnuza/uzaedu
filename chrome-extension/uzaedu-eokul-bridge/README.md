# Uzaedu Uzaedu Okul Köprüsü

Chrome MV3 — **Uzaedu paneli** ile **e-Okul** arasında veri köprüsü. Min. sürüm: **0.3.2** (`manifest.json`).

Referans: OBS 3.12.7 (`.tmp-obs-ext/unpacked/`), EduPanel 2.0.8 (`.tmp-edupanel-ext/unpacked/`).

---

## Kurulum

1. `cd backend; npm run start:dev`
2. `cd web-admin; npm run dev`
3. e-Okul oturumu: https://e-okul.meb.gov.tr/
4. `chrome://extensions` → geliştirici → `chrome-extension/uzaedu-eokul-bridge`
5. Kapı → modüller

---

## Özellik özeti (0.3.0)

| Alan | Durum |
|------|--------|
| Kurum | Okul öncesi + ilk + orta |
| 20 köprü modülü | Aktif |
| Öğrenci dosya | 6 grup CSV + ZIP resim + panele aktarım |
| Veli yazma | API + DOM + MEB Ajanda |
| Veli izin PDF | Portal API |
| Ders programı | Panel ↔ XLSX + **deneysel** e-Okul upload |
| MEBBİS / KBS bordro | Excel yükleme + **açık sekmeden otomatik çek** (mebbis.meb.gov.tr / kbs.muhasebat.gov.tr) |
| e-Okul 08001 | Gömülü panel + sesli komut + confirm bypass (ayar) |
| Sesli rapor | Temel komutlar (Web Speech API) |

---

## API

| Metot | Yol |
|-------|-----|
| POST | `/api/eokul-bridge/v1/import/ogrenci-dosya` |
| POST | `/api/eokul-bridge/v1/ozur/veli-izin-pdf` |
| … | Diğer `import/*` uçları README önceki sürümlerde |

---

## Bilinen sınırlar

- **e-Okul program upload:** Sayfa/form MEB’ye göre değişir; deneysel.
- **Sesli rapor:** EduPanel kadar kapsamlı değil.
- **Öğrenci dosya (nüfus/genel):** Alan eşlemesi bootstrap + etiket kazıma; OBS selector tabanlı `op:120` henüz yok.
- **HTML parse:** e-Okul HTML ayrıştırma `chrome.offscreen` + `DOM_SCRAPING` (`shared/dom-offscreen.js`, `offscreen/`).

Panel: **http://localhost:3000/e-okul-kopru**
