# Sınav Görevi – Kaynak Analizi ve HTML Tablo Üretimi (GPT Prompt)

Bu prompt, **başka bir alanda** (duyuru detayı, evrak önizleme vb.) kaynak metnini analiz edip HTML tablo + buton üretmek için kullanılır. Sync tarafındaki tarih çıkarma (`exam-duty-gpt.service` extractFromText) ile karar kuralları uyumludur.

---

## Ne zaman kullanılır

- Bir duyuru/kaynak sayfasının **içeriğini** alıp kullanıcıya **sınav adı, oturum, tarih, son istek, resmi başvuru butonu** olarak göstermek istediğinizde.
- Girdi: sayfa/duyuru başlığı + sayfa gövdesi (veya eşleşen HTML/metin). Placeholder'lar: `[original_title]`, `[matched_content]`.

## Çıktı

- **Sadece HTML:** `<h3>` + `<table>` + tek buton. Başında/sonunda boş satır, açıklama veya markdown yok.
- Farklı sınavlar → her sınav için ayrı blok (h3 + table + buton). Aynı sınavın oturumları → aynı tabloda satır.

---

## Prompt metni

```
[gpt]
Kaynaktaki sınavları ve varsa oturumlarını analiz et.

ZORUNLU KARAR KURALI:
- Kaynakta FARKLI sınav/görevler varsa → HER SINAV İÇİN AYRI TABLO OLUŞTUR
- Aynı sınavın farklı oturumları varsa → AYNI TABLODA, HER OTURUM AYRI SATIR
- Kararsızlık varsa → FARKLI SINAV KABUL ET, AYRI TABLO OLUŞTUR

ÇIKTI KURALI (BOŞLUK ÖNLEME - ÇOK ÖNEMLİ):
- Çıktı SADECE HTML olacak
- <h3> + <table> + (hemen altında 1 buton) dışında HİÇBİR ŞEY yazma
- Başında/sonunda boş satır, açıklama, metin, markdown (### gibi) ASLA yazma
- Her tablo ve buton TEK SATIR HTML olarak yaz (satır sonu bırakma)

TARİH FORMAT KURALI:
- DD/MM/YYYY HH:MM
- Türkçe ay adı, nokta, ISO format YASAK

EKSİK BİLGİ:
- Hücrede bilgi yoksa: Bilgi yok

BUTON KURALI (TEMA UYUMLU):
- Buton metni SABİT: Resmi başvuru sayfasına git
- href değeri:
  1) içerikte geçen resmi başvuru linki
  2) yoksa kaynağın sayfa linki
  3) o da yoksa https://meb.gov.tr/
- target="_blank" rel="nofollow noopener"
- Buton HER ZAMAN ortalı ve uyumlu görünmeli: genişlik %100 ama max-width 420px

TABLO VE BUTON ŞABLONU (KESİNLİKLE DEĞİŞTİRME):
<h3 style="text-align: left;">[SINAV ADI]</h3><table style="width: 100%; border-collapse: collapse; margin: 20px 0;"><tbody><tr style="background: #2271b1; color: #fff;"><th style="padding: 12px; text-align: left; border: 1px solid #ddd;">Sınav Adı</th><th style="padding: 12px; text-align: left; border: 1px solid #ddd;">Oturum</th><th style="padding: 12px; text-align: left; border: 1px solid #ddd;">Tarih ve Saat</th><th style="padding: 12px; text-align: left; border: 1px solid #ddd;">Son İstek Zamanı</th></tr><tr style="background: #f9f9f9;"><td style="padding: 12px; border: 1px solid #ddd;">[Sınav Adı]</td><td style="padding: 12px; border: 1px solid #ddd;">[Oturum veya Bilgi yok]</td><td style="padding: 12px; border: 1px solid #ddd;">[DD/MM/YYYY HH:MM]</td><td style="padding: 12px; border: 1px solid #ddd;">[DD/MM/YYYY HH:MM veya Bilgi yok]</td></tr></tbody></table><div style="margin:12px 0 24px 0;text-align:center;"><a href="[RESMI_BASVURU_URL]" target="_blank" rel="nofollow noopener" style="display:block;max-width:420px;margin:0 auto;background:#f97316;color:#fff;padding:13px 18px;border-radius:12px;text-decoration:none;font-weight:800;font-size:16px;line-height:1.1;text-align:center;">Resmi başvuru sayfasına git</a></div>

[original_title]
[matched_content]
[/gpt]
```

---

## Sync ile ilişki

- **Sync:** `exam-duty-gpt.service.ts` → extractFromText tek JSON döndürür (application_end, exam_date, exam_date_end); çıktı HTML değil.
- **Bu prompt:** Aynı karar mantığı (farklı sınav = ayrı blok, aynı sınav oturumları = aynı tabloda satır) ile **HTML tablo + buton** üretir; duyuru detayı veya evrak önizleme ekranında `dangerouslySetInnerHTML` veya güvenli HTML render ile kullanılabilir.

## Entegrasyon notu

- Bu prompt’u kullanacak özellik eklenirken: backend’de ayrı bir GPT çağrısı (örn. `generateExamTableHtml(title, content)`) veya harici servis; çıktı HTML olduğu için sanitize edilmeli (XSS). Placeholder’lar çağrı öncesi gerçek başlık ve içerikle değiştirilir.
