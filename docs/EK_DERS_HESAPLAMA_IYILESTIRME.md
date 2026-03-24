# Ek Ders Hesaplama – Performans ve Ölçeklenebilirlik Önerileri

## Mevcut Durum

- **Hesaplama:** Tamamen client-side (`computeResult`) – sunucu yükü yok
- **API çağrıları:** Sadece 2 endpoint – `available-semesters`, `params/active`
- **Okuma ağırlıklı:** Parametreler nadiren güncellenir

## Uygulanan İyileştirmeler

### 1. Backend – HTTP Cache Headers
- `params/active` ve `available-semesters` için `Cache-Control: public, max-age=300` (5 dk)
- CDN ve tarayıcı cache ile tekrarlayan istekler sunucuya ulaşmaz

### 2. Frontend – Params Cache
- Module-level cache: Aynı `semester_code` için tekrar fetch yapılmaz (TTL 5 dk)
- Sekme yenileme veya hızlı gezinmede API çağrısı azalır

### 3. UI – Modern Görünüm
- Skeleton loading, temiz tipografi, daha iyi görsel hiyerarşi
- Responsive, erişilebilir

### 4. Brüt / Net Yapısı
- **Parametre girişleri:** Tüm tutarlar brüt (birim ücretler brüt TL/saat, vergi dilimleri brüt matrah sınırları, GV istisna vergi tutarı, DV istisna brüt matrah limiti).
- **Hesaplama:** Brüt tutarlar üzerinden GV ve DV kesintileri hesaplanır.
- **Sonuç:** Kullanıcıya net tutar (brüt − vergiler) gösterilir.

### 5. Merkezi Sınav Parametreleri (Tutarlılık)

- **Gösterge rolleri:** Brüt = Katsayı × Gösterge. Bina Sınav Sorumlusu (2000), Bina Yön. (1900), Salon Başk. (1650), Gözetmen (1600), Yedek Göz. (1200) vb.
- **E-Sınav:** Aynı formül, farklı gösterge (1300, 1200, %20: 1560, 1440). Dönem katsayısına göre otomatik güncellenir.

### 6. Parametre Güncelleme (2026 Resmi Değerler)
- Superadmin: **Hesaplama Parametreleri** → **Ek Ders ayarları** → **"Vergi Parametrelerini 2026 Resmi Değerlere Güncelle"** butonu
- Tüm parametre setlerinin vergi alanları 2026 resmi değerlere ayarlanır: GV istisna 4.211,33 TL, DV istisna 33.030 TL, damga ‰7,59 (binde), vergi dilimleri (GV Seri 332)

### 7. Damga Vergisi (DV) – Oran ve Hesaplama

**Oran (2026):** Ücret bordrosu için damga vergisi **binde 7,59** (‰7,59). Resmi kaynak: Damga Vergisi Kanunu Genel Tebliği (Seri No: 71), MuhasebeTR Bordro Parametreleri.

**Saklama:** `stamp_duty_rate` binde değer olarak tutulur (örn. 7.59). Hesaplamada `rate / 1000` kullanılır.

**DV formülü:**
```
kalan_istisna = dv_exemption_max (33.030) − dv_used (maaşta kullanılmış)
dv_matrah = max(0, ek_ders_brüt − kalan_istisna)
dv_kesintisi = dv_matrah × (stamp_duty_rate / 1000)
```

**DV istisna matrahı:** 33.030 TL (2026 brüt asgari ücret). Bu tutara kadar ücret damga vergisinden istisna.

---

### 8. 1 Kuruş Fark – Kaynak

**Belirti:** Sonuçlar genelde uyumlu; bazen brüt, net veya DV kalan’da 1 kuruş fark görülüyor.

**Kaynak:**
1. **Floating point:** JavaScript IEEE 754 kullanır. `1.5 × 194.30` veya `1.2 × 242.88` gibi işlemler tam 291,45 veya 291,46 vermez; 291,456... gibi sonuçlar oluşur.
2. **Yuvarlama stratejisi:** Her para adımı (kalem brütü, toplam brüt, vergi, net) 2 ondalığa yuvarlanır.
3. **Yuvarlama yöntemi:** Öğretmen Pro brüt/gelir için `Math.floor` (aşağı) kullanır.

**Çözüm:** Brüt/gelir: `Math.floor` (aşağı). Kesintiler (GV, DV, SGK): `Math.ceil` (yukarı). Floating point taşması engellenir.

---

## Uygulanan – Backend In-Memory Cache (10k kullanıcı desteği)

- **In-memory cache:** `getActiveParams` ve `findAvailableSemesters` 5 dk TTL ile cache
- **Invalidation:** create, update, remove, refreshAllParams, applyResmi2026ToAll sonrası otomatik temizlik
- **Cache-Control: public** – CDN önünde kullanım için

---

## İleride Yapılabilecekler

### Backend (yüksek trafik durumunda)
- **Redis:** Çoklu instance için paylaşılan cache (şu an tek instance in-memory yeterli)
- **Connection pooling:** PostgreSQL pool ayarları
- **Rate limiting:** Zaten ThrottlerModule var; hesaplama endpoint’leri için özel limit gerekmez (sadece okuma)

### Frontend
- **SWR veya TanStack Query:** Stale-while-revalidate, otomatik dedupe
- **Service Worker:** Offline params cache (PWA)
- **Virtualization:** Çok kalem varsa (50+) `hourlyLineItems` listesi virtualize edilebilir

### Genel
- Hesaplama client-side olduğu için **eşzamanlı kullanıcı sayısı backend’i çok etkilemez**
- Asıl yük: her kullanıcı ilk açılışta 2 GET isteği atar
- Cache headers ve frontend cache ile bu yük önemli ölçüde azalır
