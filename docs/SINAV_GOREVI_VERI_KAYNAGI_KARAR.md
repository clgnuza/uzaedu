# Sınav Görevi Veri Kaynağı: WordPress API vs Superadmin Yeni Yapı

Sınav görevi tarih ve duyurularının nereden alınacağına dair mimari karar dokümanı.

---

## Karar: Basit Tablo (Superadmin Yeni Yapı)

**Seçilen yaklaşım:** WordPress API kullanılmıyor. Sınav görevi duyuruları tek tablo (`exam_duties`) ile Core Backend'de tutulur. Superadmin web-admin üzerinden manuel CRUD ile ekler/düzenler/yayınlar. Basit tablo işimizi görebilir; ileride RSS/scrape sync opsiyonel eklenebilir.

---

## 1. Seçeneklerin Karşılaştırması

| Kriter | WordPress API (Mebhaber3) | Superadmin Yeni Yapı (Core Backend) |
|--------|---------------------------|-------------------------------------|
| **Veri sahipliği** | WP'de; OgretmenPro okur | Core Backend'de; tek gerçek kaynak (SSOT) |
| **Bildirim iletimi** | WP→Backend sync gerek; gecikme riski | Doğrudan backend'den; gecikme yok |
| **Bağımlılık** | WP'e bağımlı; WP down = sync yok | Bağımsız; sync job kontrollü |
| **Güvenilirlik** | WP schema/plugin değişimi = parse kırılır | Parse kuralları sizde; kontrollü güncelleme |
| **Ölçeklenebilirlik** | WP ayrı sunucu; ek yük | Backend tek altyapı |
| **Denetim** | WP logları + Backend logları | Tek merkezli log |
| **Kurulum** | Mebhaber3 + WP gerekli | Sadece Backend + sync config |

---

## 2. Öneri: Core Backend (Superadmin Yeni Yapı)

### 2.1 Neden Daha Sağlıklı

1. **SSOT (Single Source of Truth)**  
   Veri `exam_duties` tablosunda. Inbox, push ve cron buradan beslenir. Kaynak çakışması yok.

2. **İletim güvenilirliği**  
   Bildirimler backend’den gönderiliyor. WP’ye gidip gelmeye gerek yok; gecikme ve timeout riski azalır.

3. **Bağımsızlık**  
   WP kapalı olsa bile mevcut `exam_duties` verisi ve bildirimler çalışmaya devam eder.

4. **Parse kontrolü**  
   MEB/ÖSYM sayfa yapısı değişince sadece sync job’daki parser güncellenir. WP plugin güncellemesine bağlı değilsiniz.

### 2.2 Veri Akışı (Önerilen)

```
[MEB/ÖSYM/RSS Duyuru Sayfaları]
         │
         ▼
   Sync Job (Cron)
   - RSS parse / HTML scrape
   - exam_duties tablosuna yaz (taslak veya published)
         │
         ▼
[exam_duties - Core Backend]
         │
         ├──► Inbox bildirimleri
         ├──► Push (FCM)
         └──► Teacher liste (/exam-duties)
```

- **Manuel:** Superadmin web-admin’den CRUD ile ekleyebilir.
- **Otomatik:** Sync job MEB/ÖSYM/RSS’ten çeker, `exam_duties`’e yazar.

### 2.3 WordPress Ne Zaman Kullanılabilir?

WordPress **sadece veri kaynağı** olarak kullanılabilir:

- Mebhaber3 zaten MEB’den veri topluyorsa, sync job **WP REST API**’den çekip `exam_duties`’e yazabilir.
- Ama asıl kaynak MEB/ÖSYM URL’leri olursa **WP’ye gerek kalmaz**.

| Senaryo | Öneri |
|---------|-------|
| Mebhaber3 zaten kurulu, veri WP’de | Sync job WP’den çeker (geçiş dönemi) |
| Sıfırdan kurulum | Sync job doğrudan MEB/ÖSYM/RSS’ten çeker; WP kullanma |
| Hibrit | Önce manuel CRUD; sync fazı için MEB/ÖSYM RSS öncelikli |

---

## 3. Sonuç

- **Veri kaynağı:** MEB/ÖSYM/RSS (veya geçiş döneminde WP).
- **Depolama ve işleme:** Core Backend (`exam_duties`).
- **Bildirim iletimi:** Backend’den Inbox + Push.

WordPress varsa ek veri kaynağı olarak kullanılabilir; ana mimari Core Backend üzerine kurulmalı.
