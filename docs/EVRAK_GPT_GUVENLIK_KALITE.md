# GPT Yıllık Plan – MEB Doğruluk, Güvenlik ve Kalite Önerileri

GPT ile oluşturulan plan içeriğinin MEB'e uygunluğu, güvenliği ve kalite garantisi için öneriler.

---

## 1. MEB Doğruluk Kontrolü

### 1.1 Temel Sorun

GPT modeli MEB müfredatını **ezbere bilmez**. Cutoff tarihi, güncel program değişiklikleri, ders bazlı hassas kazanım kodları eksik kalabilir.

### 1.2 Önerilen Kontrol Yöntemleri

| Yöntem | Açıklama | Zorluk | Etki |
|--------|----------|--------|------|
| **A) MEB referansı prompt'a ekle** | MEB PDF/HTML'den ilgili bölümü kopyala → prompt'ta "Bu ünite/kazanımlar MEB'den alınmıştır" bloğu | Orta | Yüksek |
| **B) RAG (Retrieval Augmented Generation)** | MEB dokümanları vektör DB → soruya göre ilgili chunk'ları çek → prompt'a ekle | Yüksek | Çok yüksek |
| **C) Statik curriculum config** | Şu anki `curriculum-unites.ts` – ünite listesi + kazanım formatı | Düşük | Orta |
| **D) İnsan onayı zorunlu** | GPT çıktısı **taslak**; superadmin mutlaka düzenleyip kaydeder | Düşük | Zorunlu |

### 1.3 MEB Kaynak Entegrasyonu

**Resmi kaynak:** [talimterbiye.meb.gov.tr](https://talimterbiye.meb.gov.tr) – Öğretim Programları

**Önerilen akış:**
1. MEB sitesinden ilgili ders/sınıf programı indir (PDF/DOCX)
2. **Manuel:** İlgili ünite + kazanım listesini `curriculum-unites.ts` veya ayrı `curriculum-kazanimlar.ts` olarak ekle
3. **Otomatik (ileride):** MEB yayınları periyodik indirilir, parse edilir, config güncellenir
4. GPT prompt'unda: "Aşağıdaki kazanımları KULLAN. Başka kazanım URETME." şeklinde strict referans

**Örnek strict prompt bloğu:**
```
SADECE AŞAĞIDAKİ KAZANIMLARI KULLAN. Listede olmayan kazanım üretme.

COĞ.9.1.1. Coğrafya biliminin konusu ve bölümlerini çözümleyebilme
COĞ.9.1.2. Mekânsal düşünme ile coğrafya öğrenmenin önemini çözümleyebilme
COĞ.9.1.3. Coğrafya biliminin gelişimi hakkında bilgi toplayabilme
...
(Kaynak: MEB Coğrafya 9. Sınıf Öğretim Programı, 2024)
```

### 1.4 Doğruluk İşaretleme (Claim)

- **YANLIŞ:** "Bu plan MEB tarafından onaylanmıştır" → MEB onay vermez
- **DOĞRU:** "GPT ile oluşturulmuş taslaktır. MEB müfredatına uygunluğu kontrol edilmemiştir."
- **DOĞRU:** "MEB [ders] [sınıf] programı referans alınarak GPT ile üretilmiştir. Nihai içerik öğretmen tarafından düzenlenmelidir."

UI'da taslak kaydedilirken veya indirilirken bu uyarı gösterilmeli.

---

## 2. Güvenlik Önerileri

### 2.1 API ve Credential

| Öneri | Durum | Açıklama |
|-------|-------|----------|
| API key .env'de | ✅ | OPENAI_API_KEY commit edilmez |
| Key rotation | Öneri | Periyodik key yenileme (örn. 6 ayda bir) |
| Farklı key (prod/staging) | Öneri | Ortam bazlı key ayrımı |

### 2.2 Input Güvenliği

| Risk | Önlem |
|------|-------|
| Prompt injection | subject_code, grade, academic_year sadece validated enum/range; serbest metin prompt'a eklenmez |
| Oversized input | Prompt boyutu sınırı (~8K token); curriculum config reasonable boyut |
| Malicious subject_label | Backend'de subject_label, document_catalog veya whitelist ile doğrula |

### 2.3 Çıktı Güvenliği

| Risk | Önlem |
|------|-------|
| Uygunsuz içerik | OpenAI Moderation API (ileride) – çıktıyı kontrol et |
| Çok uzun metin | kazanimlar 4000 char, konu 512 char – mevcut truncate |
| XSS / inject | Plan içeriği DB'de saklanır; UI escape edilir (React default) |

### 2.4 Erişim Kontrolü

| Öneri | Açıklama |
|-------|----------|
| Sadece superadmin/moderator | ✅ Mevcut |
| Rate limit | GPT endpoint için özel limit (örn. 5/dk kullanıcı başına) |
| Audit log | Kim, ne zaman, hangi ders için GPT taslak üretti – logla |

### 2.5 Veri Gizliliği

- GPT'ye gönderilen veri: ders adı, sınıf, yıl, ünite listesi, tatil bilgisi
- **Gönderilmez:** Öğrenci adı, öğretmen adı, okul adı, kişisel veri
- OpenAI veri politikası: API ile gönderilen veri eğitim için kullanılmıyor (güncel politikaya bak)

---

## 3. Kalite Önerileri

### 3.1 Prompt İyileştirmesi

- **Few-shot:** 1–2 gerçek hafta örneği prompt'ta ver → model benzer format üretsin
- **Chain-of-thought (opsiyonel):** "Önce ünite sırasını belirle, sonra her hafta için konu ata" – daha tutarlı
- **Sıcaklık:** temperature=0.3 (mevcut) – düşük tut; 0'a yakın daha tutarlı

### 3.2 Validasyon Katmanları

| Katman | Kontrol | Aksiyon |
|--------|---------|---------|
| Schema | week_order 1–36, unique | ✅ Mevcut |
| Kazanım formatı | COĞ.9.1.1 regex | Öneri: Uyumsuzsa uyarı |
| Ünite tutarlılığı | Config'teki ünite listesinde var mı? | Öneri: Bilinmeyen ünite → uyarı |
| Boş alan | konu/kazanimlar "—" | ✅ Uyarı mevcut |

### 3.3 Kalite Metrikleri (İleride)

- **Düzeltme oranı:** Kaydedilen taslakta superadmin kaç satır değiştirdi? (Analitik)
- **Kullanıcı geri bildirimi:** "Bu taslak yararlı mıydı?" (1–5)
- **A/B test:** Farklı prompt varyantları karşılaştır

### 3.4 Sürekli İyileştirme

1. Örnek planlar (seed veya manuel eklenen) → prompt'ta few-shot olarak kullan
2. Düzeltilmiş planlar → anonimize edilerek "iyi örnek" havuzuna eklenebilir
3. MEB güncellemeleri → curriculum config periyodik gözden geçirilmeli

---

## 4. Yasal / Etik Uyarılar

### 4.1 Kullanım Koşulları

- GPT taslak **yardımcı araç**; nihai sorumluluk öğretmen/okulda
- MEB müfredatı kamu malı; ancak "MEB onaylı" vb. ifadeler kullanılamaz
- Telif: GPT çıktısı OpenAI'a ait değil (API kullanım şartlarına bak); ancak MEB kazanımları MEB'e ait

### 4.2 Önerilen UI Uyarıları

**Taslak oluştururken:**
> "GPT ile oluşturulan taslak referans niteliğindedir. MEB müfredatına tam uyum garanti edilmez. Kaydetmeden önce mutlaka gözden geçirin."

**Kaydederken:**
> "Bu plan GPT yardımıyla oluşturulmuş taslaktır. Nihai içerik öğretmen tarafından düzenlenmelidir."

---

## 5. Uygulama Öncelik Sırası

| # | Öneri | Efor | Öncelik |
|---|-------|------|---------|
| 1 | UI'da taslak/kaydet uyarı metni | Düşük | **Yüksek** |
| 2 | curriculum-kazanimlar.ts – MEB kazanım listesi (manuel) | Orta | **Yüksek** |
| 3 | GPT endpoint rate limit (5/dk) | Düşük | Orta |
| 4 | Audit log (kim, ne zaman, hangi ders) | Orta | Orta |
| 5 | Kazanım formatı regex validasyonu | Düşük | Orta |
| 6 | MEB strict prompt bloğu (config'ten) | Orta | Yüksek |
| 7 | OpenAI Moderation (çıktı kontrolü) | Düşük | Orta |
| 8 | RAG – MEB PDF vektör DB | Yüksek | İleride |

---

## 6. Özet

- **MEB doğruluğu:** Statik config (ünite + kazanım listesi) + strict prompt en pratik yol. RAG ileride.
- **İnsan onayı:** Zorunlu; GPT taslak, nihai karar öğretmenin.
- **Güvenlik:** API key güvenli, input validation, rate limit, audit log.
- **Kalite:** Few-shot, validasyon, düşük temperature.
- **Yasal:** "MEB onaylı" denmez; "referans/alıntı" ve "gözden geçirin" uyarıları kullanılır.
