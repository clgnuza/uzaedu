# VERBIS Kişisel Veri İşleme Envanteri

Bu belge, Öğretmen Pro platformunda işlenen kişisel verilerin KVKK 6698 ve VERBIS uyumu için envanteridir.

## 1. Veri Sorumlusu

- **Unvan:** Öğretmen Pro / UzaMobil
- **İletişim:** kvkk@ogretmenpro.com

---

## 2. İşlenen Kişisel Veriler

| Veri Kategorisi | Veri Türü | İşleme Amacı | Hukuki Sebep | Saklama Süresi |
|-----------------|-----------|--------------|--------------|----------------|
| Kimlik bilgisi | Ad, soyad (display_name) | Hesap tanımlama, arayüz kişiselleştirme | Sözleşme | Hesap aktif + 10 yıl (yasal zorunluluk) |
| İletişim | E-posta | Kimlik doğrulama, bildirim, şifre sıfırlama | Sözleşme | Hesap aktif + 10 yıl |
| İletişim | Telefon numarası | Opsiyonel; çoklu giriş, hesap güvenliği | Açık rıza | Hesap aktif + 10 yıl |
| Kimlik doğrulama | Şifre hash | Giriş güvenliği | Sözleşme | Hesap aktif |
| Profil | Rol (teacher, school_admin, superadmin) | Yetkilendirme, erişim kontrolü | Hukuki yükümlülük | Hesap aktif + 10 yıl |
| Profil | Okul ilişkisi (school_id) | Kapsam sınırlama, veri erişimi | Sözleşme | Hesap aktif + 10 yıl |
| Log | IP, user-agent, giriş zamanı | Güvenlik, audit trail | Meşru menfaat | 1 yıl |
| Cihaz | FCM push token | Push bildirim gönderimi | Açık rıza | Hesap aktif, token geçerliliği |

---

## 3. Veri Akışı

- **Toplama:** Web-admin (Next.js), mobil uygulama (Flutter), backend API
- **İşleme:** Backend (NestJS), PostgreSQL, Firebase Auth, Firebase Cloud Messaging
- **Paylaşım:** Firebase (Google), WordPress (içerik), push servisleri (bildirim)
- **Saklama:** PostgreSQL (Core Backend), Firebase

---

## 4. Veri Güvenliği Önlemleri

- HTTPS zorunlu
- Şifreler hash (bcrypt) ile saklanır
- Token tabanlı yetkilendirme (JWT)
- Scope: teacher → user_id; school_admin → school_id
- Rate limiting (login, register, forgot-password)
- Audit log (kritik işlemler)

---

## 5. Veri Sahibi Hakları (KVKK Madde 11)

- Bilgi talep etme
- Düzeltme talep etme
- Silme / unutulma talep etme
- İşlemeyi kısıtlama
- Veri taşınabilirliği
- İtiraz hakkı

**Uygulama:**  
- `GET /me/data-export` – Veri dışa aktarma  
- `DELETE /me/account` – Hesap ve verilerin silinmesi  
- İletişim üzerinden düzeltme/kısıtlama talepleri

---

## 6. Güncelleme

Son güncelleme: 2025-02
