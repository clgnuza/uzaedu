# MEB Okul Verisi Alma Kuralları

Bu doküman, MEB okul web sitelerinden (*.meb.k12.tr) okul bilgilerini alırken kullanılacak kuralları tanımlar. İleride tüm okullar ekleneceğinden bu kurallar referans alınmalıdır.

---

## Kaynak Sayfalar

| Veri | Kaynak sayfa / Yol |
|------|---------------------|
| Genel bilgiler (telefon, fax, adres, vizyon, misyon) | `/tema/okulumuz_hakkinda.php` veya `/meb_iys_dosyalar/{il}/{ilce}/{kurum_kodu}/okulumuz_hakkinda.html` |
| Harita konumu | `/tema/iletisim.php` |
| Okul görseli | Okulumuz Hakkında sayfasındaki ana fotoğraf |

---

## Kurum Kodu (institution_code)

- **Kaynak:** MEB URL yapısındaki sayısal ID
- **Yol:** `meb_iys_dosyalar/{il_kodu}/{ilce_kodu}/{kurum_kodu}/`
- **Örnek:** `https://aksehiranadolulisesi.meb.k12.tr/meb_iys_dosyalar/42/03/215787/` → **215787**
- **Format:** 6 haneli sayı
- **Not:** `il_kodu` (örn. 42=Konya), `ilce_kodu`, `kurum_kodu` yol parçalarından türetilir.

---

## Kurumsal E-posta (institutional_email)

- **Format:** `{kurum_kodu}@meb.k12.tr`
- **Örnek:** Kurum kodu 215787 → `215787@meb.k12.tr`
- **Not:** Okul adına göre (örn. info@okuladi.meb.k12.tr) değil, kurum koduna göre oluşturulur.

---

## Okul Görseli (school_image_url)

- **Kaynak:** Okulumuz Hakkında sayfası HTML’inde `alt="...Okul...Fotoğrafı"` içeren `<img>` etiketi
- **Yol:** Genelde `/meb_iys_dosyalar/{il}/{ilce}/{kurum_kodu}/resimler/{yil_ay}/{dosya_adi}.jpg`
- **Örnek:** `https://aksehiranadolulisesi.meb.k12.tr/meb_iys_dosyalar/42/03/215787/resimler/2024_10/k_11160816_whatsappimage....jpg`
- **Tespit:** Sayfa HTML’inde `img src` veya `okul*foto*` içeren satırlar aranır.

---

## Harita Konumu (map_url)

- **Kaynak:** İletişim sayfası (`/tema/iletisim.php`)
- **HTML:** `<iframe src="https://www.google.com/maps/embed/v1/place?q={lat},{lng}&key=...">`
- **Kullanım:** Koordinatları alıp paylaşım linkine çevir: `https://www.google.com/maps?q={lat},{lng}`
- **Örnek:** `38.332587, 31.434924` → `https://www.google.com/maps?q=38.332587,31.434924`

---

## Diğer Alanlar

| Alan | Kaynak | Not |
|------|--------|-----|
| **Telefon** | Okulumuz Hakkında / İletişim | 03328131010 formatında |
| **Belgegeçer (fax)** | Okulumuz Hakkında / İletişim | 03328133179 formatında |
| **Web sitesi** | Okul ana sayfası | https://okuladi.meb.k12.tr |
| **Adres** | Okulumuz Hakkında / İletişim | Kuruçay Mah. Özgürlük Cad. No17 Akşehir/KONYA |

---

## Toplu Okul Ekleme Checklist

1. Okul MEB URL’sini belirle (örn. `aksehiranadolulisesi.meb.k12.tr`)
2. Okulumuz Hakkında sayfasından kurum kodunu URL’den çıkar
3. Kurumsal mail: `{kurum_kodu}@meb.k12.tr`
4. HTML’den okul fotoğrafı URL’sini bul
5. İletişim sayfasından harita koordinatlarını al
6. Telefon, fax, adres, web siteyi ilgili sayfalardan al
7. Veritabanına ekle veya seed script ile ekle

---

## Referans Örnek

**Akşehir Şehit Selçuk Özer Anadolu Lisesi** (test verisi):

- İl/İlçe: Konya / Akşehir
- Kurum kodu: 215787
- Kurumsal mail: 215787@meb.k12.tr
- Görsel: `meb_iys_dosyalar/42/03/215787/resimler/2024_10/k_11160816_whatsappimage20231106at11.58.34.jpg`
- Harita: `https://www.google.com/maps?q=38.33258715406673,31.434924395825902`

---

*Son güncelleme: Şubat 2026*
