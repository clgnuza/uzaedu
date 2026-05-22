export type Device = {
  id: string;
  school_id: string;
  pairing_code: string;
  name: string;
  roomOrLocation: string | null;
  classSection?: string | null;
  status: string;
  last_seen_at: string | null;
  planPositionX?: number | null;
  planPositionY?: number | null;
  planFloorIndex?: number;
  current_slot?: {
    lesson_num: number;
    subject: string;
    teacher_name: string;
    class_section: string | null;
    source?: 'timetable' | 'manual';
  };
  lesson_context?: {
    my_lesson_today: boolean;
    my_lesson_now: boolean;
    my_next_lesson: { lesson_num: number; subject: string; starts_in_minutes: number } | null;
    current_slot: { lesson_num: number; subject: string; teacher_name: string } | null;
    busy_teacher_name: string | null;
    reconnect_without_qr: boolean;
  };
};

export type AuthorizedTeacher = {
  id: string;
  user_id: string;
  display_name: string | null;
  email: string;
  has_usb_pin?: boolean;
  has_otp_codes?: boolean;
  otp_code_count?: number;
};

export type Session = {
  id: string;
  device_id: string;
  device_name: string;
  user_id: string;
  user_name: string | null;
  connected_at: string;
  disconnected_at: string | null;
  is_active: boolean;
};

export type Status = {
  enabled: boolean;
  authorized: boolean;
  session_timeout_minutes?: number;
  mySession?: { session_id: string; device_id: string; device_name: string };
  myClassSections?: string[];
};

export type SmartBoardUsageStats = {
  range: { from: string; to: string };
  totals: { session_count: number; total_minutes: number };
  by_class: { key: string; session_count: number; minutes: number }[];
  by_teacher: { user_id: string; user_name: string | null; session_count: number; minutes: number }[];
  by_device: {
    device_id: string;
    device_name: string;
    class_section: string | null;
    session_count: number;
    minutes: number;
  }[];
  by_hour_tr: { hour: number; count: number }[];
  items: {
    id: string;
    device_id: string;
    device_name: string;
    class_section: string | null;
    user_id: string;
    user_name: string | null;
    connected_at: string;
    disconnected_at: string | null;
    minutes_in_range: number;
    is_active: boolean;
  }[];
};

export type SmartBoardHealthAlerts = {
  alerts: {
    severity: 'warning' | 'info';
    code: string;
    title: string;
    detail: string;
    device_id?: string;
    session_id?: string;
  }[];
};

export type SmartBoardSetupStatus = {
  module_enabled: boolean;
  setup_code: string;
  device_count: number;
  online_count: number;
  never_seen_count: number;
  has_tv_ip: boolean;
  auto_authorize: boolean;
  authorized_teacher_count: number;
  qr_claimed_last_7d: boolean;
  checklist: Array<{ id: string; label: string; done: boolean; hint?: string; optional?: boolean }>;
};

export type SmartBoardAuditLog = {
  id: string;
  action: string;
  created_at: string;
  user: { display_name: string | null; email: string } | null;
  meta: Record<string, unknown> | null;
};
