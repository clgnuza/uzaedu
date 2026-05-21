/** Tahta QR → ders oturumu — panel, kurulum ve öğretmen metinlerinde ortak ifade. */
export const SMART_BOARD_QR_FLOW_SUMMARY =
  'Tahtada şifre yok: öğretmen telefonda Uzaedu hesabıyla giriş yapar, tahtadaki QR’ı okutur; tahta birkaç saniye içinde ders oturumuna geçer.';

export const SMART_BOARD_QR_FLOW_STEPS = [
  'Tahta açılış: duyuru ekranı (kiosk). MEB/ETAP masaüstü şifresi Uzaedu için gerekmez.',
  'Öğretmen telefonda panel veya PWA’da girişli olmalı; tahtadaki QR’ı okutur veya bildirim linkine dokunur.',
  'Onay sonrası tahta ders oturumuna geçer (yan panel, slayt). Tahtaya şifre yazılmaz.',
  'Aynı ders içinde QR tekrar gerekmez (okul süresi kadar panelden devam edebilirsiniz).',
  'Ders bitince bağlantı kesilir; tahta yine duyuru moduna döner.',
] as const;

export const SMART_BOARD_LESSON_SESSION_LABEL = 'Ders oturumu';
