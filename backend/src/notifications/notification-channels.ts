/** Modül bildirim kanalları — notification_preferences.channel ile eşleşir. */
export const NOTIFICATION_CHANNELS = [
  { id: 'nobet', label: 'Nöbet' },
  { id: 'ders_programi', label: 'Ders programı / müsaitlik' },
  { id: 'akilli_tahta', label: 'Akıllı tahta' },
  { id: 'sinav_gorevi', label: 'Sınav görevi (planlı)' },
  { id: 'sinav_modulleri', label: 'Kertenkele / sorumluluk sınav' },
  { id: 'destek', label: 'Destek talepleri' },
  { id: 'ajanda', label: 'Öğretmen ajandası' },
  { id: 'bilsem', label: 'Bilsem takvim' },
  { id: 'belirli_gun', label: 'Belirli gün / hafta' },
  { id: 'mesaj_merkezi', label: 'Mesaj merkezi' },
  { id: 'market', label: 'Market' },
  { id: 'yolluk', label: 'Yolluk' },
  { id: 'okul_degerlendirme', label: 'Okul değerlendirme' },
  { id: 'duyuru', label: 'Duyurular' },
  { id: 'genel', label: 'Diğer' },
] as const;

export type NotificationChannelId = (typeof NOTIFICATION_CHANNELS)[number]['id'];

const DOMAIN_CHANNEL: Record<string, NotificationChannelId> = {
  duty: 'nobet',
  timetable: 'ders_programi',
  ders_dagit: 'ders_programi',
  smart_board: 'akilli_tahta',
  exam_duty: 'sinav_gorevi',
  support: 'destek',
  agenda: 'ajanda',
  bilsem_calendar: 'bilsem',
  belirli_gun_hafta: 'belirli_gun',
  butterfly_exam: 'sinav_modulleri',
  sorumluluk_exam: 'sinav_modulleri',
  messaging: 'mesaj_merkezi',
  admin_message: 'mesaj_merkezi',
  market: 'market',
  yolluk: 'yolluk',
  school_reviews: 'okul_degerlendirme',
  announcement: 'duyuru',
};

export function eventTypeToChannel(eventType: string): NotificationChannelId {
  const domain = eventType.split('.')[0]?.trim();
  if (!domain) return 'genel';
  return DOMAIN_CHANNEL[domain] ?? 'genel';
}
