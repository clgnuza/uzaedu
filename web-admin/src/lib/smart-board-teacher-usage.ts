import { SMART_BOARD_QR_FLOW_SUMMARY } from '@/lib/smart-board-teacher-qr-flow';

/** Öğretmen paneli — Akıllı tahta kullanım ve uyarı metinleri. */
export const SMART_BOARD_TEACHER_USAGE_STEPS = [
  'Tahtada QR görünür; telefonda Uzaedu’ya girişli hesabınızla okutun veya bildirim linkine dokunun.',
  'Onaydan sonra tahta kendiliğinden kullanım moduna geçer (birkaç saniye); tahtaya şifre girmeniz gerekmez.',
  'Ders bitince «Bağlantıyı kes» — tahta duyuru moduna döner; sonraki öğretmen yine QR ile bağlanır.',
] as const;

export const SMART_BOARD_TEACHER_WARNINGS = [
  'Tahta çevrimdışıysa okul idaresine bildirin (kurulum idare işidir).',
  'PIN/OTP yalnızca tahtadaki yedek içindir; normal akış telefondan QR onayıdır.',
  SMART_BOARD_QR_FLOW_SUMMARY,
] as const;

export const SMART_BOARD_TEACHER_HOME_DESC = 'Duyuru TV — telefondan QR ile tahta';
