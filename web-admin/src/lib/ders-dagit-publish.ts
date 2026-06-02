import { apiFetch } from '@/lib/api';

export type PublishPreview = {
  program: { id: string; name: string | null; status: string; score: number | null };
  entry_count: number;
  clash_count: number;
  unplaced_count: number;
  unplaced_hours: number;
  placement_percent: number;
  required_hours: number;
  placed_hours: number;
  validation_error_count: number;
  validation_warn_count: number;
  published_program: {
    id: string;
    name: string | null;
    published_plan_id: string | null;
  } | null;
  diff_entry_count: number;
  blockers: string[];
  soft_warnings: string[];
  can_publish: boolean;
  requires_risk_ack: boolean;
};

export async function fetchPublishPreview(
  token: string,
  studioId: string,
  programId: string,
): Promise<PublishPreview> {
  return apiFetch(`/ders-dagit/studios/${studioId}/programs/${programId}/publish-preview`, { token });
}

export async function publishProgramToSchool(
  token: string,
  studioId: string,
  programId: string,
  body: {
    valid_from: string;
    valid_until?: string | null;
    risk_acknowledged?: boolean;
  },
): Promise<{ plan_id: string; imported: number; program_id: string }> {
  return apiFetch(`/ders-dagit/studios/${studioId}/programs/${programId}/publish`, {
    token,
    method: 'POST',
    body: JSON.stringify(body),
  });
}
