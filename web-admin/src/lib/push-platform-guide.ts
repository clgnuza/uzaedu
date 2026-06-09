import { detectPwaInstallPlatform, type PwaInstallPlatformId } from '@/lib/pwa-install-platform';
import { isAndroid, isIos, isPwaDisplayMode } from '@/lib/pwa-display';

export type PushBlockReason =
  | 'unsupported'
  | 'ios_standalone'
  | 'ios_old_version'
  | 'ios_other_browser'
  | 'firefox_android'
  | 'huawei_gms';

export type AndroidBatteryOem = 'xiaomi' | 'oppo' | 'vivo' | 'huawei' | 'samsung' | 'oneplus';

export type PushDeviceEvaluation = {
  platform: PwaInstallPlatformId;
  canSubscribe: boolean;
  blockReason?: PushBlockReason;
  batteryOem: AndroidBatteryOem | null;
  iosVersion: number | null;
};

const IOS_PUSH_MIN = 16.4;

function parseIosVersion(): number | null {
  if (typeof navigator === 'undefined' || !isIos()) return null;
  const m = navigator.userAgent.match(/OS (\d+)[_.](\d+)/);
  if (!m) return null;
  return Number(m[1]) + Number(m[2]) / 10;
}

export function isHuaweiFamily(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /\b(HUAWEI|Honor|HMSCore)\b/i.test(navigator.userAgent);
}

export function isFirefoxAndroid(): boolean {
  if (typeof navigator === 'undefined') return false;
  return isAndroid() && /Firefox/i.test(navigator.userAgent);
}

export function detectAndroidBatteryOem(): AndroidBatteryOem | null {
  if (typeof navigator === 'undefined' || !isAndroid()) return null;
  const ua = navigator.userAgent;
  if (/Miui|Redmi|POCO|Xiaomi/i.test(ua)) return 'xiaomi';
  if (/OPPO|Realme|HeyTap/i.test(ua)) return 'oppo';
  if (/vivo/i.test(ua)) return 'vivo';
  if (/\b(HUAWEI|Honor)\b/i.test(ua)) return 'huawei';
  if (/SamsungBrowser|SM-/i.test(ua)) return 'samsung';
  if (/OnePlus/i.test(ua)) return 'oneplus';
  return null;
}

export function evaluatePushDeviceSupport(opts?: {
  pushApiAvailable?: boolean;
}): PushDeviceEvaluation {
  const platform = detectPwaInstallPlatform();
  const pushApiAvailable =
    opts?.pushApiAvailable ??
    (typeof window !== 'undefined' &&
      'serviceWorker' in navigator &&
      'PushManager' in window &&
      'Notification' in window);
  const batteryOem = detectAndroidBatteryOem();
  const iosVersion = parseIosVersion();

  if (!pushApiAvailable) {
    if (isIos()) {
      if (iosVersion !== null && iosVersion < IOS_PUSH_MIN) {
        return { platform, canSubscribe: false, blockReason: 'ios_old_version', batteryOem, iosVersion };
      }
      if (!isPwaDisplayMode()) {
        return { platform, canSubscribe: false, blockReason: 'ios_standalone', batteryOem, iosVersion };
      }
      if (platform === 'ios-other') {
        return { platform, canSubscribe: false, blockReason: 'ios_other_browser', batteryOem, iosVersion };
      }
    }
    if (isFirefoxAndroid()) {
      return { platform, canSubscribe: false, blockReason: 'firefox_android', batteryOem, iosVersion };
    }
    if (isHuaweiFamily() && isAndroid()) {
      return { platform, canSubscribe: false, blockReason: 'huawei_gms', batteryOem, iosVersion };
    }
    return { platform, canSubscribe: false, blockReason: 'unsupported', batteryOem, iosVersion };
  }

  if (isIos()) {
    if (iosVersion !== null && iosVersion < IOS_PUSH_MIN) {
      return { platform, canSubscribe: false, blockReason: 'ios_old_version', batteryOem, iosVersion };
    }
    if (!isPwaDisplayMode()) {
      return { platform, canSubscribe: false, blockReason: 'ios_standalone', batteryOem, iosVersion };
    }
    if (platform === 'ios-other') {
      return { platform, canSubscribe: false, blockReason: 'ios_other_browser', batteryOem, iosVersion };
    }
  }

  if (isFirefoxAndroid()) {
    return { platform, canSubscribe: true, batteryOem, iosVersion };
  }

  return { platform, canSubscribe: true, batteryOem, iosVersion };
}

export function pushBlockMessage(reason: PushBlockReason): string {
  switch (reason) {
    case 'ios_standalone':
      return 'iOS: Uygulamayı Safari → Paylaş → Ana Ekrana Ekle ile kurup ana ekrandaki simgeden açın.';
    case 'ios_old_version':
      return `iOS ${IOS_PUSH_MIN}+ gerekli. Ayarlar → Genel → Yazılım Güncelleme ile güncelleyin.`;
    case 'ios_other_browser':
      return 'iOS: Bildirim yalnızca Safari ile ana ekrana eklenen Uzaedu simgesinden çalışır. Chrome/Firefox iOS’ta desteklenmez.';
    case 'firefox_android':
      return 'Firefox Android’de push sınırlı. Chrome ile ana ekrana ekleyip deneyin.';
    case 'huawei_gms':
      return 'Huawei/Honor: Google Play Hizmetleri ve Chrome gerekli. Ayarlar → Uygulamalar → Chrome güncel olsun.';
    case 'unsupported':
    default:
      return 'Bu tarayıcı veya cihaz web push bildirimini desteklemiyor.';
  }
}

export function pushPermissionDeniedSteps(platform: PwaInstallPlatformId): string[] {
  const appName = 'Uzaedu';
  switch (platform) {
    case 'ios-safari':
    case 'ios-other':
      return [
        'iPhone Ayarlar → Bildirimler → ana ekrandaki Uzaedu simgesini seçin.',
        'Bildirimlere İzin Ver ve Kilit Ekranı + Bildirim Merkezi açık olsun.',
        'Uygulamayı ana ekran simgesinden açıp Bildirimler sayfasında tekrar Aç deyin.',
      ];
    case 'android-samsung':
      return [
        'Samsung Internet: ⋮ → Ayarlar → Siteler ve indirmeler → Tüm siteler → site adresi → Bildirimler → İzin ver.',
        'Alternatif: Chrome ile ana ekrana ekleyin; adres çubuğu kilit → Bildirimler → İzin ver.',
        'Ayarlar → Uygulamalar → Uzaedu (veya Chrome) → Bildirimler açık olsun.',
        'Sayfayı yenileyip Bildirimler’de tekrar Aç deyin.',
      ];
    case 'android-chrome':
      return [
        'Adres çubuğunda Bildirimler engellendi kutusunda Bu site için izin ver deyin.',
        'Yoksa kilit / site bilgisi → Bildirimler → İzin ver.',
        'Ayarlar → Uygulamalar → Chrome → Bildirimler ve Uzaedu kanalı açık olsun (Android 13+).',
        'Sayfayı yenileyip tekrar Aç deyin.',
      ];
    case 'android-other':
      return [
        'Chrome yükleyin; menüden Ana ekrana ekle / Uygulamayı yükle ile kurun.',
        'Tarayıcı site ayarlarından bildirimlere izin verin.',
        `Telefon Ayarlar → Uygulamalar → ${appName} veya Chrome → Bildirimler açık olsun.`,
        'Uygulamayı ana ekran kısayolundan açıp tekrar deneyin.',
      ];
    case 'desktop-chrome':
    case 'desktop-edge':
      return [
        'Adres çubuğu solundaki site bilgisi / kilit simgesine tıklayın.',
        'Bildirimler → İzin ver.',
        'Windows: Ayarlar → Sistem → Bildirimler → Chrome/Edge için bildirimler açık olsun.',
        'Sayfayı yenileyip tekrar Aç deyin.',
      ];
    case 'desktop-safari':
      return [
        'Safari → Ayarlar → Web siteleri → Bildirimler → site için İzin ver.',
        'macOS: Sistem Ayarları → Bildirimler → Safari / Uzaedu açık olsun.',
        'Dock’taki Uzaedu simgesinden açıp tekrar deneyin.',
      ];
    case 'desktop-firefox':
      return [
        'Adres çubuğu kilit → Bağlantı bilgisi → Daha fazla bilgi → İzinler → Bildirimler → İzin ver.',
        'Firefox → Ayarlar → Gizlilik → İzinler → Bildirimler → site için İzin ver.',
        'Push için Chrome veya Edge PWA kurulumu önerilir.',
      ];
    default:
      return [
        'Tarayıcı site ayarlarından bildirimlere izin verin.',
        'Telefon veya bilgisayar sistem ayarlarında uygulama bildirimleri açık olsun.',
        'Sayfayı yenileyip Bildirimler sayfasından tekrar Aç deyin.',
      ];
  }
}

export function pushSetupTips(platform: PwaInstallPlatformId): Array<{ title: string; detail?: string }> {
  switch (platform) {
    case 'ios-safari':
      return [
        { title: 'Ana ekran simgesinden açın', detail: 'Safari sekmesinden değil; iOS 16.4+ gerekir' },
        { title: 'İzin penceresinde İzin Ver', detail: 'Reddettiyseniz Ayarlar → Bildirimler → Uzaedu' },
        { title: 'Odak / Rahatsız Etmeyin', detail: 'Kritik kanallar sessiz modda da gelebilir' },
      ];
    case 'android-chrome':
      return [
        { title: 'Ana ekrana ekleyin', detail: 'Adres çubuğu veya menü → Uygulamayı yükle' },
        { title: 'İzin ver → Tamamla', detail: 'İzin sonrası Bildirimler’de Tamamla’ya basın' },
        { title: 'Android 13+ kanallar', detail: 'Sistem ayarında Uzaedu bildirim kanalları açık kalsın' },
      ];
    case 'android-samsung':
      return [
        { title: 'Chrome önerilir', detail: 'Samsung Internet yerine Chrome PWA daha tutarlı' },
        { title: 'Site bildirim izni', detail: 'Samsung Internet site ayarlarından izin verin' },
        { title: 'Tamamla adımı', detail: 'İzin sonrası uygulama içinde Tamamla’ya basın' },
      ];
    case 'android-other':
      return [
        { title: 'Chrome kullanın', detail: 'En güvenilir PWA ve push desteği' },
        { title: 'Ana ekran kısayolu', detail: 'Tarayıcı menüsünden ekleyin' },
        { title: 'Pil kısıtlaması', detail: 'Aşağıdaki pil ipuçlarına bakın' },
      ];
    case 'desktop-chrome':
    case 'desktop-edge':
      return [
        { title: 'Masaüstü uygulaması', detail: 'Adres çubuğundan yükleyebilirsiniz' },
        { title: 'İzin ver', detail: 'Tarayıcı ve Windows/macOS bildirimleri açık olsun' },
      ];
    default:
      return [
        { title: 'PWA kurulumu', detail: 'Ana ekrana / görev çubuğuna ekleyin' },
        { title: 'Bildirim izni', detail: 'Hem tarayıcı hem işletim sistemi izni gerekir' },
      ];
  }
}

export function pushBatteryOptimizationSteps(oem: AndroidBatteryOem): string[] {
  switch (oem) {
    case 'xiaomi':
      return [
        'Ayarlar → Uygulamalar → Uzaedu veya Chrome → Pil tasarrufu → Kısıtlama yok.',
        'Güvenlik → Otomatik başlat → Uzaedu/Chrome açık.',
        'Son uygulamalardan kapatmayın; kilit ekranı bildirimleri için gerekli.',
      ];
    case 'oppo':
    case 'vivo':
      return [
        'Ayarlar → Pil → Uygulama pil yönetimi → Uzaedu/Chrome → Kısıtlama yok.',
        'Ayarlar → Uygulamalar → Otomatik başlat → izin verin.',
        'Arka plan etkinliği engellenmesin.',
      ];
    case 'huawei':
      return [
        'Ayarlar → Pil → Uygulama başlatma → Uzaedu/Chrome → Manuel, tüm anahtarlar açık.',
        'Ayarlar → Bildirimler → Uzaedu → tüm seçenekler açık.',
        'Google Mobile Services ve Chrome güncel olsun.',
      ];
    case 'samsung':
      return [
        'Ayarlar → Uygulamalar → Uzaedu/Chrome → Pil → Kısıtlanmamış.',
        'Ayarlar → Pil ve cihaz bakımı → Arka plan kullanım sınırları → uygulama listede olmasın.',
        'Uyku modu bildirimleri geciktirebilir.',
      ];
    case 'oneplus':
      return [
        'Ayarlar → Pil → Pil optimizasyonu → Uzaedu/Chrome → Optimize etme.',
        'Ayarlar → Uygulamalar → Otomatik başlat → açık.',
      ];
    default:
      return [];
  }
}

export function pushBatteryOemLabel(oem: AndroidBatteryOem): string {
  switch (oem) {
    case 'xiaomi':
      return 'Xiaomi / Redmi / POCO';
    case 'oppo':
      return 'OPPO / Realme';
    case 'vivo':
      return 'vivo';
    case 'huawei':
      return 'Huawei / Honor';
    case 'samsung':
      return 'Samsung';
    case 'oneplus':
      return 'OnePlus';
    default:
      return 'Android';
  }
}

export function pushPermissionToastHint(platform: PwaInstallPlatformId): string {
  if (platform === 'ios-safari' || platform === 'ios-other') {
    return 'Bildirim izni verilmedi. Ayarlar → Bildirimler → Uzaedu.';
  }
  if (platform.startsWith('android')) {
    return 'Bildirim izni verilmedi. Site ayarları veya Chrome’da “Bu site için izin ver”.';
  }
  return 'Bildirim izni verilmedi. Tarayıcı site ayarlarından izin verin.';
}
