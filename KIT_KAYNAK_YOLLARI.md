# Kit kaynak klasörleri (orijinaller)

Cursor, kit'ten bileşen/ekran alırken **sadece ihtiyaç duyulan dosyaları** bu yollardan okur ve projeye uyarlar. Tüm kit kopyalanmaz.

| Kit | Kaynak yol (orijinal) |
|-----|------------------------|
| **Metronic** (Web Admin – Next.js) | `C:\UzaMobil\hazirkit\metronic` |
| **FlutKit** (Flutter mobil) | `C:\UzaMobil\hazirkit\flutkit` |

## Kullanım

- Web Admin'a Metronic'ten bir şey eklerken: yukarıdaki **metronic** yolundan ilgili dosya/klasörü oku; sadece gerekenleri projeye kopyala veya uyarla.
- Flutter projesine FlutKit'ten bir şey eklerken: **flutkit** yolundan oku; sadece gereken widget/ekranı projeye al (örn. `lib/vendor/flutkit/` veya `lib/ui/kit/` altına).
- Proje içinde API, auth, rol, navigasyon ve tema **KIT_ENTEGRASYON_KURALLARI.md** ve **CURSOR_SPEC**'e göre proje kodunda kalır; kit'ten sadece UI bileşenleri alınır.
