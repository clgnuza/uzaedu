# Cloudflare R2 Görsel Yükleme – Planlama

Bu belge, Öğretmen Pro projesinde görsel URL alanlarına Cloudflare R2 upload desteği eklemek için yol haritasını tanımlar.

---

## 1. Mevcut Görsel URL Alanları

| Konum | Alan | Açıklama |
|-------|------|----------|
| Duyuru oluşturma/düzenleme | `attachment_url` | Görsel URL (Duyuru TV) |
| TV ayarları | `tv_welcome_image_url` | Hoş geldin / arka plan görseli |
| TV ayarları | `tv_logo_url` | Okul logosu |
| Belirli Gün ve Haftalar | `image_url` (entry) | Her kayıt için görsel |

**Strateji:** Tüm bu alanlarda hem **link girişi** hem **dosya yükleme** desteklenecek.

---

## 2. Önerilen Mimari

```
[Frontend] → POST /api/upload/presign (filename, contentType, purpose)
         ← { uploadUrl, publicUrl }
[Frontend] → PUT uploadUrl (file body)  [doğrudan R2'e]
[Frontend] → Form submit: attachment_url = publicUrl
```

**Presigned URL (client-side upload):**
- Dosya sunucudan geçmez → backend yükü minimal
- R2 S3 API `createPresignedPost` veya `getSignedUrl` kullanılır
- `purpose`: `announcement` | `school_logo` | `school_welcome` | `special_day`

---

## 3. Fazlar

### Faz 1: Altyapı ve Temel Upload (≈2–3 gün)

| Adım | Görev |
|------|-------|
| 1.1 | Cloudflare R2 bucket oluştur, CORS ayarla |
| 1.2 | Backend: `@aws-sdk/client-s3` ekle (R2 S3 uyumlu) |
| 1.3 | Backend: `UploadModule`, `UploadController`, `UploadService` |
| 1.4 | `POST /api/upload/presign` endpoint: `filename`, `contentType`, `purpose` → presigned URL + public URL |
| 1.5 | `.env.example`: `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`, `R2_PUBLIC_URL` |

### Faz 2: Frontend Bileşen (≈1–2 gün)

| Adım | Görev |
|------|-------|
| 2.1 | `ImageUrlInput` bileşeni: URL input + "Dosya yükle" butonu |
| 2.2 | Yükleme akışı: dosya seç → presign isteği → R2’e PUT → URL’i state’e yaz |
| 2.3 | Önizleme: yüklenen / girilen URL için küçük thumbnail |
| 2.4 | Validasyon: sadece image/jpeg, image/png, image/webp, image/gif; max 5 MB |

### Faz 3: Entegrasyon (≈1 gün)

| Adım | Görev |
|------|-------|
| 3.1 | `announcement-create-form.tsx`: Görsel URL alanını `ImageUrlInput` ile değiştir |
| 3.2 | `announcement-list.tsx` (düzenleme): aynı bileşen |
| 3.3 | TV ayarları: Hoş geldin görsel, Logo URL alanları |
| 3.4 | Belirli Gün ve Haftalar: her kayıt için image_url alanı (opsiyonel, Faz 4’e bırakılabilir) |

### Faz 4: İyileştirmeler (opsiyonel)

| Adım | Görev |
|------|-------|
| 4.1 | Drag & drop desteği |
| 4.2 | Toplu yükleme (Belirli Gün Excel’de görseller) |
| 4.3 | Görsel sıkıştırma (client-side, tarayıcı desteği varsa) |

---

## 4. Teknik Detaylar

### R2 Presigned URL

```typescript
// Backend: UploadService
async getPresignedUploadUrl(filename: string, contentType: string, purpose: string): Promise<{ uploadUrl: string; publicUrl: string }> {
  const key = `${purpose}/${uuid()}-${sanitizeFilename(filename)}`;
  const uploadUrl = await getSignedUrl(new PutObjectCommand({
    Bucket: this.bucket,
    Key: key,
    ContentType: contentType,
  }), { expiresIn: 300 }); // 5 dk
  const publicUrl = `${this.publicBaseUrl}/${key}`;
  return { uploadUrl, publicUrl };
}
```

### R2 Bucket Ayarları

- **Access:** Public read (görseller herkese açık) veya R2 custom domain üzerinden
- **CORS:** Web-admin origin’leri (`https://admin.ogretmenpro.com`, `http://localhost:3000`)
- **Lifecycle:** Şimdilik yok; ileride 90 gün kullanılmayan silinebilir

### Dosya Adı / Key Yapısı

```
{ purpose }/{ uuid }.{ ext }
ör: announcement/a1b2c3d4-e5f6-7890-abcd-ef1234567890.jpg
```

---

## 5. Güvenlik

| Madde | Önlem |
|-------|-------|
| Auth | Presign endpoint: sadece giriş yapmış `school_admin` / `superadmin` |
| Dosya tipi | Sadece `image/jpeg`, `image/png`, `image/webp`, `image/gif` |
| Boyut | Max 5 MB (backend presign’da contentType kontrolü) |
| Rate limit | Örn. upload 30/dk kullanıcı başına |
| Scope | school_admin için school_id loglama (hangi okul yükledi) |

---

## 6. R2 Ayarları Kaynağı

**Superadmin Ayarlar sayfasından girilir.** Backend `app_config` tablosunda tutulur; `.env` gerekmez.

- **Ayarlar** → **Depolama (Cloudflare R2)** → Account ID, Access Key ID, Secret Access Key, Bucket, Public URL
- Secret Access Key: Boş bırakılırsa mevcut değer korunur

---

## 7. Tahmini Süre ve Bağımlılıklar

| Faz | Süre | Bağımlılık |
|-----|------|------------|
| Faz 1 | 2–3 gün | Cloudflare hesabı, R2 bucket |
| Faz 2 | 1–2 gün | Faz 1 |
| Faz 3 | 1 gün | Faz 2 |
| **Toplam** | **≈4–6 gün** | |

---

## 8. Alternatifler

| Alternatif | Artı | Eksi |
|------------|------|------|
| **Backend üzerinden upload** | Tam kontrol, virus tarama | Sunucu yükü, bellek |
| **Firebase Storage** | Zaten Firebase kullanılıyor | Egress ücreti, başka servis |
| **Sadece link** | En basit | Kullanıcı harici hosting bulmak zorunda |

---

## 9. Sonraki Adım

1. Cloudflare dashboard’da R2 bucket oluştur
2. API token (R2 read/write) al
3. Faz 1’e başla: backend `UploadModule` + presign endpoint
