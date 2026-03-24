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
};

export type AuthorizedTeacher = {
  id: string;
  user_id: string;
  display_name: string | null;
  email: string;
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
  mySession?: { session_id: string; device_id: string; device_name: string };
  myClassSections?: string[];
};
