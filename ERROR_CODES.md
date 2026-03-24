# Hata Kodları ve Kullanıcı Mesajları

Backend'in döndüreceği hata kodları, HTTP status ve client tarafında gösterilecek/günlğe yazılacak mesajlar.

---

## 1. Standart Hata Cevabı Formatı

**HTTP status:** 4xx veya 5xx

**Body (JSON):**
```json
{
  "code": "FORBIDDEN",
  "message": "Bu işlem için yetkiniz yok.",
  "details": {}
}
```

- **code:** Aşağıdaki sabit kodlardan biri (İngilizce, UPPER_SNAKE_CASE).
- **message:** Kullanıcıya gösterilebilecek kısa Türkçe mesaj.
- **details:** Opsiyonel; validation hatalarında alan bazlı hatalar veya ek bilgi.

---

## 2. Hata Kodu Listesi

| code | HTTP | message (Türkçe) | Ne zaman |
|------|------|------------------|----------|
| UNAUTHORIZED | 401 | Oturum açmanız gerekiyor. | Token yok, geçersiz veya süresi dolmuş |
| FORBIDDEN | 403 | Bu işlem için yetkiniz yok. | Rol veya scope yetmiyor |
| SCOPE_VIOLATION | 403 | Bu veriye erişim yetkiniz yok. | Başka okul / başka kullanıcı verisine istek |
| NOT_FOUND | 404 | İstediğiniz kayıt bulunamadı. | entity_id veya path geçersiz |
| VALIDATION_ERROR | 400 | Lütfen girdiğiniz bilgileri kontrol edin. | Zorunlu alan eksik, format hatalı |
| CONFLICT | 409 | Bu işlem mevcut veri ile çakışıyor. | Örn. aynı plan iki kez yayınlama |
| RATE_LIMIT | 429 | Çok fazla istek gönderdiniz. Biraz bekleyin. | Rate limit aşıldı |
| ENTITLEMENT_REQUIRED | 402 | Bu özelliği kullanmak için yeterli hakkınız yok. | Evrak/optik hakkı bitti; markete yönlendir |
| TV_ACCESS_RESTRICTED | 403 | TV sayfası sadece okul ağından erişilebilir. | TV IP whitelist: istek IP'si izinli listede değil |
| R2_NOT_CONFIGURED | 400 | R2 ayarları eksik. Lütfen tüm alanları doldurup kaydedin. | R2 test endpoint çağrıldı, eksik config |
| TEMPLATE_NOT_FOUND | 400 | Yerel şablon bulunamadı / R2’de dosya yok. | Evrak: loadTemplateBuffer – dosya mevcut değil |
| TEMPLATE_FETCH_FAILED | 400 | Şablon dosyası alınamadı. | Evrak: HTTP URL ile şablon indirilemedi |
| TEMPLATE_FETCH_TIMEOUT | 400 | Şablon dosyası zaman aşımına uğradı. | Evrak: fetch 15 sn timeout |
| TEMPLATE_CORRUPT | 400 | Şablon dosyası bozuk veya geçersiz format. | Evrak: PizZip/merge işlemi hata verdi |
| MERGE_ERROR | 400 | Şablonda ‘X’ alanı bulunamadı. Form verilerini kontrol edin. | Evrak: Docxtemplater tag çözümleme hatası |
| FORM_VALIDATION | 400 | Zorunlu alan eksik: [alan adı]. | Evrak: form_schema required alanları boş |
| DUTY_TEACHER_NOT_IN_SCHOOL | 400 | Bazı öğretmenler okulunuzda kayıtlı değil veya nöbetçi olarak atanamaz. | Nöbet planı/reassign/takas: user_id okul öğretmenleri arasında değil |
| MODULE_DISABLED | 403 | Bu okulda bu modül kapalı. | Okul enabled_modules içinde modül yok (Okul Değerlendirme vb.) |
| SCHOOL_INACTIVE | 403 | Okulunuz şu an aktif değil. | Okul pasif/askıda |
| USER_INACTIVE | 403 | Hesabınız aktif değil. | Kullanıcı passive/suspended |
| EXTERNAL_SERVICE_ERROR | 502 | Dış servis geçici olarak yanıt vermiyor. | WP veya Firebase çağrısı başarısız |
| INTERNAL_ERROR | 500 | Bir hata oluştu. Lütfen daha sonra tekrar deneyin. | Beklenmeyen sunucu hatası |
| DEVICE_BUSY | 400 | Bu tahta şu an başka bir öğretmen tarafından kullanılıyor. | Akıllı Tahta: connect – tahta meşgul |
| TICKET_NOT_FOUND | 404 | İstediğiniz talep bulunamadı. | Destek: ticket id geçersiz |
| TICKET_SCOPE_VIOLATION | 403 | Bu talebe erişim yetkiniz yok. | Destek: scope ihlali |
| TICKET_TARGET_FORBIDDEN | 400 | Öğretmenler yalnızca okul içi destek talebi açabilir. | Destek: teacher PLATFORM_SUPPORT açmaya çalışır |
| TICKET_ESCALATION_REASON_REQUIRED | 400 | Eskalasyon sebebi zorunludur. | Destek: escalate reason boş |
| TICKET_ALREADY_CLOSED | 400 | Bu talep kapatılmış. | Destek: closed ticket'a yazılamaz (ops. reopen) |
| TICKET_FINALIZED | 403 | Çözülmüş veya kapatılmış taleplere yeni mesaj eklenemez. | Destek: RESOLVED/CLOSED talep mesaj gönderme |

---

## 3. Validation Hataları (details ile)

**code:** VALIDATION_ERROR  
**details** örneği:

```json
{
  "code": "VALIDATION_ERROR",
  "message": "Lütfen girdiğiniz bilgileri kontrol edin.",
  "details": {
    "fields": {
      "title": ["Başlık zorunludur."],
      "published_at": ["Geçerli bir tarih girin."]
    }
  }
}
```

Client tarafı: Alan bazlı hataları form alanının altında gösterebilir.

---

## 4. Client Tarafı Davranışı (Öneri)

| code | Önerilen davranış |
|------|-------------------|
| UNAUTHORIZED | Oturum ekranına yönlendir; token yenileme denenebilir |
| FORBIDDEN, SCOPE_VIOLATION | "Yetkiniz yok" mesajı; ana sayfaya veya önceki ekrana dön |
| NOT_FOUND | "Bulunamadı" mesajı; liste ekranına veya geri git |
| VALIDATION_ERROR | `details.fields` varsa ilgili alanlarda göster; yoksa `message` |
| RATE_LIMIT | `message` göster; 30–60 sn sonra tekrar dene |
| ENTITLEMENT_REQUIRED | Market / Haklarım ekranına yönlendir |
| SCHOOL_INACTIVE, USER_INACTIVE | Açıklayıcı mesaj; çıkış veya destek bilgisi |
| 5xx | Genel "Bir hata oluştu" mesajı; isteği logla (sentry vb.) |

---

## 5. Loglama (Backend)

- **4xx:** Genelde debug seviyesinde log; gerekirse audit log (örn. 403 denemeleri).
- **5xx:** Mutlaka hata logu + stack trace; alert tetiklenebilir.
- **details** içinde hassas bilgi (şifre, token) yazılmamalı.

---

*API_CONTRACT.md'deki hata formatı ile uyumludur. Yeni kod eklenince bu listeye eklenmeli.*
