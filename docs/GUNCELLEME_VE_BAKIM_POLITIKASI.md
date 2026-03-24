# Güncelleme ve bakım politikası şablonu

Bu belge, Öğretmen Pro’daki **uzaktan yapılandırma** alanlarıyla eşleşen operasyonel kuralları özetler. Metni kurumunuza göre düzenleyip iç onaydan geçirin.

---

## 1. Amaç

- Kullanıcıyı gereksiz yere **bloklamamak** (zorunlu güncelleme ve bakımı istisna tutmak).
- **Şeffaflık**: güncelleme gerekçesi, bakım süresi, yasal metin ve çerez onayı değişikliklerini izlenebilir kılmak.
- **Kesintiyi sınırlamak**: web’de kritik yolları açık tutmak; mobilde anlamlı mesaj ve mağaza linkleri sunmak.

---

## 2. Mobil uygulama (mobile_app_config)

Kaynak: ackend/src/app-config/mobile.defaults.ts — UI: **Web ve mobil ayarlar → Mobil**.

| Alan (yapılandırma) | Önerilen politika |
|---------------------|-------------------|
| ios_min_version / ndroid_min_version | Alt sınır **yalnızca** API/uyumluluk veya güvenlik gerektiğinde yükseltilir; değişiklik notu tutulur. |
| ios_latest_version / ndroid_latest_version | Önerilen sürüm; istemci bunu **yumuşak** bildirimde kullanabilir. |
| orce_update_ios / orce_update_android | Varsayılan **kapalı**. Açılırken gerekçe: güvenlik, mağaza politikası veya sunucu uyumsuzluğu. Sürekli açık tutulmaz. |
| update_message | Zorunlu veya önemli güncellemede kısa, anlaşılır HTML; mağaza linki öncesi okunur. |
| pp_store_url / play_store_url | Güncelleme yönlendirmesi için güncel ve doğrulanmış URL. |
| mobile_maintenance_enabled | Web bakımından bağımsız; yalnızca uygulama tarafında planlı kesinti gerektiğinde. |
| mobile_maintenance_message | Tahmini süre / alternatif (web, destek) bilgisi. |
| config_schema_version | İstemci önbelleğini bilinçli sıfırlamak için; sık artırılmaz, değişiklik kaydı tutulur. |
| eature_flags | Yeni özellikler **kademeli** açılır; bayrak adları ve sorumlular dokümante edilir. |
| cache_ttl_mobile_config | Kamu GET /content/mobile-config önbelleği; çok düşük TTL gereksiz yük, çok yüksek yavaş yayılım. |

---

## 3. Web bakım modu (web_extras_config)

Kaynak: ackend/src/app-config/web-extras.defaults.ts — UI: **Web ve mobil ayarlar → Gelişmiş**.

| Alan | Önerilen politika |
|------|-------------------|
| maintenance_enabled | Planlı pencereler; mümkünse düşük trafik saatleri. |
| maintenance_message_html | Kısa açıklama; mümkünse tahmini bitiş veya durum sayfası. |
| maintenance_allowed_exact | Giriş, kayıt, bakım sayfası, robots.txt, sitemap vb. kamu veya yasal erişim için açık kalır. |
| maintenance_allowed_prefixes | Yönetim paneli ve API yolları operasyon için listelenir; gereksiz genişletme yapılmaz (güvenlik). |

---

## 4. GDPR / çerez (gdpr_config)

Kaynak: ackend/src/app-config/gdpr.defaults.ts — UI: **Web ve mobil ayarlar → GDPR**.

| Alan | Önerilen politika |
|------|-------------------|
| consent_version | Aydınlatma / çerez kategorilerinde önemli değişiklik olduğunda artırılır; kullanıcıdan yeniden onay istenir. |
| cookie_banner_body_html | Hukuk onaylı metin; örnek şablon web-admin/src/lib/gdpr-banner-example.ts. |
| 
eject_button_visible | Zorunlu olmayan çerezler için ret seçeneği politikaya uygun şekilde açık tutulur. |
| cache_ttl_gdpr | GET /content/gdpr önbelleği; metin değişince TTL göz önüne alınır. |

---

## 5. Operasyon checklist (yayın öncesi)

- [ ] Zorunlu mobil güncelleme kapatıldı mı veya gerekçe + mesaj yazıldı mı?
- [ ] Web bakımında izinli path listesi ihtiyaçla uyumlu mu?
- [ ] Çerez / aydınlatma metni değiştiyse consent_version ve içerik güncellendi mi?
- [ ] update_message / bakım HTML’inde destek veya statik bilgi linki var mı?

---

## 6. Sürüm ve depo referansları

| Konfigürasyon | Backend anahtar / dosya |
|----------------|-------------------------|
| Mobil | mobile_app_config — mobile.defaults.ts |
| Web ekstra (bakım, analitik TTL) | web_extras_config — web-extras.defaults.ts |
| GDPR | gdpr_config — gdpr.defaults.ts |

Kurum içi tarih ve onay satırını ekleyin.
