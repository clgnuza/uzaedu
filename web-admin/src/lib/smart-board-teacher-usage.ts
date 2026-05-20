/** Öğretmen paneli — Akıllı tahta kullanım ve uyarı metinleri. */
export const SMART_BOARD_TEACHER_USAGE_STEPS = [
  'Tahta ekranında sol altta QR görünür; telefondan okutun veya bildirimdeki linke dokunun.',
  'Onay sonrası tahta birkaç saniye içinde kullanım moduna geçer (yan paneller, slayt kontrolü).',
  'Ders bitince «Bağlantıyı kes» — tahta otomatik duyuru moduna döner; sonraki öğretmen aynı QR ile bağlanır.',
] as const;

export const SMART_BOARD_TEACHER_WARNINGS = [
  'Tahta çevrimdışıysa okul idaresine bildirin (kurulum idare işidir).',
  'PIN/OTP yalnızca tahtadaki yedek giriş içindir; normal akış hesaptan QR onayıdır.',
  'Telefonda PWA ile aynı hesapla QR onayı yapılır.',
] as const;

export const SMART_BOARD_TEACHER_HOME_DESC = 'Duyuru TV + QR ile tahta kullanımı';
