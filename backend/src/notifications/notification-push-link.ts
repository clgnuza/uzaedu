import type { Notification } from './entities/notification.entity';

/** PWA push tıklanınca açılacak yol (web-admin ile uyumlu, sadeleştirilmiş). */
export function notificationDeepLink(n: Pick<Notification, 'event_type' | 'target_screen' | 'entity_id' | 'metadata'>): string {
  const et = n.event_type ?? '';
  const meta = (n.metadata ?? {}) as Record<string, unknown>;
  if (et.startsWith('school_reviews.penalty')) return '/bildirimler?filter=penalty';
  if (et.startsWith('messaging.')) return '/mesaj-merkezi';
  if (et.startsWith('admin_message.')) return '/dashboard';
  if (et.startsWith('sorumluluk_exam.')) {
    const schoolId = String(meta.school_id ?? '').trim();
    return schoolId ? `/sorumluluk-sinav/bilgilendirme?school_id=${schoolId}` : '/sorumluluk-sinav/bilgilendirme';
  }
  if (et.startsWith('market.') || n.target_screen === 'market') return '/market';
  if (et.startsWith('exam_duty.sync') || n.target_screen === '/sinav-gorevleri') return '/sinav-gorevleri';
  if (n.target_screen === 'sinav-gorevi' || et.startsWith('exam_duty.')) return '/sinav-gorevlerim';
  if (n.target_screen === 'nobet_takas' || et.includes('swap')) return '/duty/takas';
  if (et.startsWith('bilsem_calendar.')) return '/bilsem/takvim';
  if (et.startsWith('belirli_gun_hafta.')) return '/akademik-takvim';
  if (et.startsWith('agenda.')) return '/ogretmen-ajandasi';
  if (et.startsWith('smart_board.')) {
    if (et === 'smart_board.qr_pending') {
      const p = new URLSearchParams({ open_qr: '1' });
      const schoolId = String(meta.school_id ?? '').trim();
      const deviceId = String(meta.device_id ?? '').trim();
      const sessionId = String(meta.session_id ?? '').trim();
      const qrCode = String(meta.qr_code ?? '').trim();
      if (schoolId) p.set('qr_school', schoolId);
      if (deviceId) p.set('qr_device', deviceId);
      if (sessionId) p.set('qr_session', sessionId);
      if (qrCode) p.set('qr_code', qrCode);
      return `/akilli-tahta?${p.toString()}`;
    }
    return '/akilli-tahta';
  }
  if (et.includes('availability')) {
    if (et.endsWith('.availability_submitted')) return '/ders-dagit/studyo/ogretmen-tercihleri';
    return '/ders-dagit/tercihler';
  }
  if (et.startsWith('timetable.') || n.target_screen === 'ders-programi') return '/ders-programi/programlarim';
  if (et.startsWith('support.')) {
    if (n.entity_id) return `/support/${n.entity_id}`;
    return '/support';
  }
  if (et.startsWith('duty.')) {
    const date = typeof meta.date === 'string' ? meta.date : '';
    if (date) return `/duty/gunluk-tablo?date=${date}`;
    if (et === 'duty.published' || et === 'duty.changed') return '/duty/planlar';
    return '/duty';
  }
  if (et.startsWith('butterfly_exam.')) {
    const schoolId = String(meta.school_id ?? '').trim();
    return schoolId ? `/kelebek-sinav/sinav-islemleri?school_id=${schoolId}` : '/kelebek-sinav/sinav-islemleri';
  }
  if (et.startsWith('yolluk.')) {
    if (n.entity_id) return `/yolluk-hesaplama/benim/${n.entity_id}`;
    return '/yolluk-hesaplama/benim';
  }
  return '/bildirimler';
}
