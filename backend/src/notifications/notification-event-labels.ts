/** Kullanıcıya gösterilen bildirim türü etiketleri (event_type ham anahtar değil). */
const EXACT: Record<string, string> = {
  'duty.published': 'Nöbet planı',
  'duty.changed': 'Nöbet değişikliği',
  'duty.reassigned': 'Yerine görevlendirme',
  'duty.coverage_assigned': 'Ders görevi',
  'duty.reminder': 'Nöbet hatırlatması',
  'duty.swap_requested': 'Takas talebi',
  'duty.swap_approved': 'Takas onayı',
  'duty.swap_rejected': 'Takas reddi',
  'duty.swap_teacher2_approved': 'Takas onay bekliyor',
  'duty.swap_reverted': 'Takas geri alındı',
  'belirli_gun_hafta.assigned': 'Belirli Gün görevlendirmesi',
  'belirli_gun_hafta.reminder': 'Belirli Gün hatırlatması',
  'belirli_gun_hafta.notification_sent': 'Bildirim gönderildi',
  'bilsem_calendar.assigned': 'Bilsem görevlendirmesi',
  'bilsem_calendar.notification_sent': 'Bilsem bildirimi',
  'bilsem_calendar.reminder': 'Bilsem hatırlatması',
  'timetable.published': 'Ders programı',
  'timetable.availability_window_open': 'Müsaitlik bildirimi',
  'timetable.availability_submitted': 'Müsaitlik onayı',
  'timetable.availability_approved': 'Müsaitlik onaylandı',
  'timetable.availability_rejected': 'Müsaitlik reddedildi',
  'timetable.availability_partial': 'Kısmi müsaitlik onayı',
  'ders_dagit.availability_window_open': 'Müsaitlik bildirimi',
  'ders_dagit.availability_submitted': 'Müsaitlik onayı',
  'ders_dagit.availability_approved': 'Müsaitlik onaylandı',
  'ders_dagit.availability_rejected': 'Müsaitlik reddedildi',
  'ders_dagit.availability_partial': 'Kısmi müsaitlik onayı',
  'announcement.created': 'Duyuru',
  'smart_board.disconnected_by_admin': 'Tahta bağlantısı kesildi',
  'smart_board.session_ended_by_admin': 'Tahta oturumu sonlandı',
  'smart_board.qr_pending': 'Tahta QR onayı bekliyor',
  'smart_board.replaced_on_device': 'Tahta oturumu değişti',
  'exam_duty.open': 'Sınav görevi açıldı',
  'exam_duty.lastday': 'Sınav görevi son başvuru',
  'exam_duty.approval_day': 'Sınav görevi onay günü',
  'exam_duty.examday': 'Sınav görevi sınav günü',
  'exam_duty.reminder': 'Sınav görevi hatırlatma',
  'exam_duty.exam_day_morning': 'Sınav günü sabah hatırlatması',
  'exam_duty.sync_source_error': 'Sınav görevi senkron',
  'exam_duty.sync_items_processed': 'Sınav görevi senkron',
  'exam_duty.sync_auto_published': 'Sınav görevi yayınlandı',
  'support.ticket.created': 'Yeni destek talebi',
  'support.ticket.replied': 'Talebinize yanıt verildi',
  'support.ticket.assigned': 'Size destek talebi atandı',
  'support.ticket.escalated': 'Üst birime iletildi',
  'support.ticket.auto_closed': 'Destek talebi kapatıldı',
  'agenda.school_event_added': 'Okul etkinliği',
  'agenda.reminder': 'Ajanda hatırlatması',
  'market.school_credit_added': 'Market (okul)',
  'market.user_credit_added': 'Market (bireysel)',
  'butterfly_exam.proctor_assigned': 'Kertenkele sınav görevi',
  'sorumluluk_exam.proctor_assigned': 'Sorumluluk sınav görevi',
  'admin_message.sent': 'Sistem mesajı',
  'messaging.campaign_completed': 'Mesaj merkezi',
  'messaging.eokul_reminder': 'Mesaj merkezi',
  'messaging.weekly_report': 'Mesaj merkezi',
  'school_reviews.penalty.strike': 'Okul değerlendirme — ceza',
  'school_reviews.penalty.site_ban': 'Okul değerlendirme — erişim kısıtı',
  'yolluk.calculation_finalized': 'Yolluk kesinleşti',
};

const AVAILABILITY_SUFFIX: Record<string, string> = {
  window_open: 'Müsaitlik bildirimi',
  submitted: 'Müsaitlik onayı',
  approved: 'Müsaitlik onaylandı',
  rejected: 'Müsaitlik reddedildi',
  partial: 'Kısmi müsaitlik onayı',
};

const DOMAIN_FALLBACK: Record<string, string> = {
  duty: 'Nöbet bildirimi',
  timetable: 'Ders programı bildirimi',
  ders_dagit: 'Müsaitlik bildirimi',
  belirli_gun_hafta: 'Belirli Gün bildirimi',
  bilsem_calendar: 'Bilsem bildirimi',
  exam_duty: 'Sınav görevi bildirimi',
  support: 'Destek bildirimi',
  smart_board: 'Akıllı tahta bildirimi',
  agenda: 'Ajanda bildirimi',
  market: 'Market bildirimi',
  messaging: 'Mesaj merkezi',
  admin_message: 'Sistem mesajı',
  announcement: 'Duyuru',
  butterfly_exam: 'Sınav bildirimi',
  sorumluluk_exam: 'Sınav bildirimi',
  yolluk: 'Yolluk bildirimi',
  school_reviews: 'Okul değerlendirme',
};

function looksTechnicalKey(s: string): boolean {
  return /^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$/i.test(s.trim());
}

function availabilityLabel(eventType: string): string | null {
  const m = /^(?:timetable|ders_dagit)\.availability_(.+)$/.exec(eventType.trim());
  if (!m) return null;
  return AVAILABILITY_SUFFIX[m[1]] ?? 'Müsaitlik bildirimi';
}

/** event_type → Türkçe kısa etiket; teknik anahtar asla dönmez. */
export function notificationEventLabel(eventType: string | null | undefined): string {
  const et = eventType?.trim();
  if (!et) return 'Bildirim';
  if (EXACT[et]) return EXACT[et];
  const avail = availabilityLabel(et);
  if (avail) return avail;
  const dot = et.indexOf('.');
  if (dot > 0) {
    const domain = et.slice(0, dot);
    if (DOMAIN_FALLBACK[domain]) return DOMAIN_FALLBACK[domain];
  }
  if (looksTechnicalKey(et)) return 'Bildirim';
  return et;
}
