export interface SuperadminStatsPayload {
  users_by_role: Record<string, number>;
  users_by_status: Record<string, number>;
  teachers_pending_approval: number;
  schools_by_status: Record<string, number>;
  teacher_quota_near_ratio: number;
  schools_teacher_quota_full: number;
  schools_teacher_quota_near: number;
  module_school_counts: { key: string; count: number }[];
  users_registration_chart: { month: string; count: number }[];
  schools_askida: { id: string; name: string }[];
  schools_teacher_full: { id: string; name: string; teacher_count: number; teacher_limit: number }[];
  recent_schools: { id: string; name: string; created_at: string }[];
  recent_users: {
    id: string;
    email: string;
    role: string;
    display_name: string | null;
    created_at: string;
  }[];
}

export interface StatsResponse {
  schools: number;
  users: number;
  announcements: number;
  chart: { month: string; count: number }[];
  superadmin?: SuperadminStatsPayload;
}
