# MVP Kapsam Listesi

Hedef: Omurga + öğretmenin sık kullandığı modüller; okul bağlayıcı (nöbet) ve gelir (market) çekirdeği. Raporlama, Optik, Tahta, Duyuru TV MVP sonrası.

---

## P0 – Olmazsa Olmaz (MVP'de kesin)

### A. Kimlik ve Okul
- [ ] A1. Rol modeli ve scope (teacher/school_admin/superadmin; school_id/user_id)
- [ ] A2. Okul CRUD (superadmin); okul durumu, limitler
- [ ] A3. Kullanıcı CRUD + durum (aktif/pasif); superadmin tümü, admin kendi okulu
- [ ] A4. Okul admin atama (superadmin)
- [ ] A5. Öğretmen onboarding (kayıt, okul bağlama, profil)

### B. Bildirim ve Olay
- [ ] B1. Event üretim standardı (tür, hedef, zaman)
- [ ] B2. Inbox (liste, okundu/okunmadı, tür filtresi, tıkla→detay)
- [ ] B3. Push tetik kuralları (kritik→push+inbox; spam önleme)
- [ ] B4. Kullanıcı bildirim tercihleri (tür bazlı aç/kapa)

### C. Haber ve Duyuru
- [ ] C1. Okul duyuruları (admin oluşturur, hedef okul; event+inbox+önemliyse push)
- [ ] C2. WP genel haber feed'i (liste, detay, "web'de aç"; push tercihe bağlı)
- [ ] C3. WP sınav görevi feed'i (liste, detay, tarih; event+push+inbox; takvime ekle)

### D. Market (çekirdek)
- [ ] D1. Wallet (jeton bakiyesi, kazanım/harcama geçmişi)
- [ ] D2. Entitlement modeli (sayısal/süreli haklar; kullanıcı "haklarım" görür)
- [ ] D3. Jeton harcayıp hak açma (katalog, satın alma, event+inbox)

### E. Evrak
- [ ] E1. Şablon yönetimi (superadmin): türler, sürümleme
- [ ] E2. Öğretmen evrak akışı: tür seç→form→önizleme→PDF/Word; profil otomatik
- [ ] E3. (P1) Evrak üretim hakkı: hak yoksa markete yönlendir; hak varsa düş, event+inbox

### F. Ek Ders
- [ ] F1. Yarıyıl parametre seti (superadmin); cache
- [ ] F2. Mobil: ay seçimi, kalemler, vergi, net/brüt, geçen ayı kopyala, yerel kayıt

### G. Kazanım
- [ ] G1. Kazanım set yönetimi (superadmin); branş+sınıf
- [ ] G2. Öğretmen: liste, işlendi/kısmen/ertelendi, not, sınıf bazlı, ilerleme özeti

---

## P1 – Çok Önemli (MVP'ye alınabilir)

- [ ] H1. Nöbet: plan yükleme (Excel mantığı), yayın, yerine görevlendir, log; teacher görüntüleme, değişiklik etiketi, bildirim
- [ ] L1. Ayarlar ekranı: bildirim kısa yol, tema, çıkış
- [ ] E3. Evrak üretim hakkı (market entegrasyonu)
- [ ] D4. Kampanya yönetimi (superadmin) – basit

---

## P2 – MVP Sonrası

- [ ] I1. Optik okuma: tanımla→okut→sonuç, manuel düzeltme, basit analiz
- [ ] J1. Akıllı tahta: bağlan, kontrol, admin aç/kapa, yetkilendirme
- [ ] K1–K3. Raporlama V2: öğretmen/okul/platform özeti
- [ ] L2. Sorun bildir / geri bildirim formu
- [ ] Duyuru TV cihaz yönetimi (pairing, liste, show_tv)
- [ ] Okullar Tanıtım moderasyonu ve galeri

---

## MVP İçin Önerilen Sıra (6 ay özet)

| Ay | Odak |
|----|------|
| 1–2 | A + B + C (omurga) |
| 3 | E + F (evrak, ek ders) |
| 4 | G + D (kazanım, market) |
| 5 | H (nöbet) |
| 6 | I/J + stabilizasyon + yayın hazırlığı |

---

## MVP "Kesin Çıkar" Özeti (tek cümle)

Kimlik/scope + Event+Inbox+Push + Okul duyuruları + WP (haber + sınav görevi) + Market (wallet+entitlement+hak açma) + Evrak (şablon+üretim) + Ek ders + Kazanım; istenirse Nöbet (P1) ve Ayarlar; Optik, Tahta, Raporlama, TV, Tanıtım MVP sonrası.
