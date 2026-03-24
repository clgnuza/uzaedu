# Güvenlik – Öğretmen Pro

Geliştirme ve yayın sırasında uyulacak kısa güvenlik kuralları.

---

## Gizlilik ve ortam

- **Asla commit edilmez:** `.env`, Firebase private key, JWT secret, DB şifresi, WP auth. Sadece `.env.example` (şablon) repo’da kalır. Bkz. ENV_EXAMPLE.md.
- **Client’ta secret yok:** Web Admin ve Flutter’da sadece public config (API base URL, Firebase client key); gizli işlemler backend’de.

---

## Yetki ve scope

- **Scope ihlali yasak:** Teacher başka öğretmen verisi görmez; school_admin başka okul verisi görmez. Backend `school_id` / `user_id` **yalnızca** token/session’dan alır; client’tan gelen değer güvenilir sayılmaz (AUTHORITY_MATRIX, CURSOR_SPEC).
- **Route guard:** Web Admin’de her sayfa için rol kontrolü; sadece menüyü gizlemek yeterli değil.

---

## API ve ağ

- **CORS:** Sadece bilinen origin’ler (Web Admin, mobil uygulama); backend `.env`’de tanımlı (ENV_EXAMPLE).
- **Rate limiting:** Önerilir; 429 ve ERROR_CODES’taki `RATE_LIMIT`.
- **HTTPS:** Production ve staging’de zorunlu; local geliştirme hariç.

---

## Log ve hata

- **Log’a yazılmaz:** Şifre, token, tam kimlik bilgisi. 4xx/5xx detayında hassas bilgi gönderilmez (ERROR_CODES, backend-api-security kuralı).
- **Hata mesajı:** Kullanıcıya Türkçe genel mesaj; teknik detay sadece log’da.

---

Güvenlik açığı tespitinde ekip/proje sahibine özel kanaldan bildirilir; public issue açılmaz.
