export const SWAP_EVENT_TYPES = [
  'duty.swap_requested',
  'duty.swap_approved',
  'duty.swap_rejected',
  'duty.swap_teacher2_approved',
];
export const EXAM_DUTY_EVENT_TYPES = [
  'exam_duty.open',
  'exam_duty.lastday',
  'exam_duty.approval_day',
  'exam_duty.examday',
  'exam_duty.reminder',
  'exam_duty.exam_day_morning',
];
export const EXAM_DUTY_SYNC_EVENT_TYPES = [
  'exam_duty.sync_source_error',
  'exam_duty.sync_items_processed',
  'exam_duty.sync_auto_published',
];
export const SUPPORT_EVENT_TYPES = [
  'support.ticket.created',
  'support.ticket.replied',
  'support.ticket.assigned',
  'support.ticket.escalated',
];
export const TIMETABLE_EVENT_TYPES = ['timetable.published'];
export const DUTY_PLAN_EVENT_TYPES = ['duty.published', 'duty.changed'];
export const DUTY_DAILY_EVENT_TYPES = ['duty.reassigned', 'duty.coverage_assigned', 'duty.reminder'];
export const BELIRLI_GUN_EVENT_TYPES = [
  'belirli_gun_hafta.assigned',
  'belirli_gun_hafta.reminder',
  'belirli_gun_hafta.notification_sent',
];
export const BILSEM_CALENDAR_EVENT_TYPES = ['bilsem_calendar.assigned', 'bilsem_calendar.notification_sent'];
export const AGENDA_EVENT_TYPES = ['agenda.school_event_added', 'agenda.reminder'];
export const SMART_BOARD_EVENT_TYPES = [
  'smart_board.disconnected_by_admin',
  'smart_board.session_ended_by_admin',
  'smart_board.qr_pending',
];
export const MARKET_EVENT_TYPES = ['market.school_credit_added', 'market.user_credit_added'];
export const YOLLUK_EVENT_TYPES = ['yolluk.calculation_finalized'];
