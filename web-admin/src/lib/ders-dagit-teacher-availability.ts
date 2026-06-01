import type { UnavailablePeriod } from '@/lib/teacher-availability';

export type TeacherAvailabilityPolicy = {
  collection_enabled: boolean;
  require_admin_approval: boolean;
  notify_teachers_on_open: boolean;
  instruction_text: string | null;
  deadline: string | null;
  allow_partial_approval: boolean;
};

export type AvailabilitySubmission = {
  id: string;
  status: 'draft' | 'submitted' | 'approved' | 'partially_approved' | 'rejected';
  periods: UnavailablePeriod[];
  approved_periods: UnavailablePeriod[] | null;
  teacher_note: string | null;
  admin_reply: string | null;
  submitted_at: string | null;
  reviewed_at: string | null;
  updated_at: string;
};

export type TeacherAvailabilityContext = {
  collection_open: boolean;
  deadline_passed: boolean;
  policy: TeacherAvailabilityPolicy;
  preference_window_open: boolean;
  applied_periods: UnavailablePeriod[];
  submission: AvailabilitySubmission | null;
  edit_locked_reason: string | null;
  can_edit: boolean;
  can_submit: boolean;
  can_update_submission: boolean;
  can_withdraw: boolean;
  can_delete: boolean;
};

export type PolicyBundle = {
  preference_window_open: boolean;
  workflow_status: string;
  policy: TeacherAvailabilityPolicy;
  pending_submissions: number;
};

export type SubmissionRow = {
  id: string;
  user_id: string;
  teacher_name: string;
  status: string;
  periods: UnavailablePeriod[];
  approved_periods: UnavailablePeriod[] | null;
  teacher_note: string | null;
  admin_reply: string | null;
  submitted_at: string | null;
  reviewed_at: string | null;
  updated_at: string;
};

export {
  SUBMISSION_STATUS_LABELS as SUBMISSION_STATUS_LABEL,
  submissionStatusLabel,
  workflowStatusLabel,
} from '@/lib/ders-dagit-labels';

export type SubmissionDetail = SubmissionRow & {
  current_applied_periods: UnavailablePeriod[];
};
