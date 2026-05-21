/** Okul yöneticisi saha kurulumu — Akıllı Tahta sayfasındaki yönlendirme metinleri. */
export const SMART_BOARD_SCHOOL_SETUP_STEPS = [
  'Kurulum sekmesi: sınıfları toplu ekleyin, okul kurulum kodunu alın, QR etiketlerini (eşleştirme kodu ile) yazdırın.',
  'Canlıda önce Ayarlar → TV izinli IP (okul ağı). Tahtada ilk kurulum linki; kayıtlı tahta için etiketteki eşleştirme kodu.',
  'Pardus: paneldeki Pardus kurulum linki → tahta seç → ZIP → tek komut. Diğer tahtalar: Chromium tam ekran + sınıf URL.',
  'Öğretmen telefonda Uzaedu ile giriş yapar, tahtadaki QR’ı okutur — tahta şifresiz kullanım moduna geçer; ders bitince duyuruya döner.',
] as const;

export const SMART_BOARD_SCHOOL_SETUP_NOTE =
  'Tahta varsayılan kilit=1 ile duyuru gösterilir; öğretmen girişi tahtada değil telefondan QR ile yapılır (MEB ETAP şifresi gerekmez).';
