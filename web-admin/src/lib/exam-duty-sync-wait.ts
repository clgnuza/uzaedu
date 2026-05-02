import { apiFetch } from './api';

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export type ExamDutySyncHealthPayload = {
  last_sync_at: string | null;
  total_created_last_run: number;
  total_restored_last_run: number;
  total_gpt_errors_last_run: number;
  sync_invocation_finished: number;
  last_sync_log: {
    at: string;
    dry_run: boolean;
    message: string;
    quota_skipped: number;
    results: Array<{
      source_key: string;
      source_label: string;
      created: number;
      restored?: number;
      skipped: number;
      error?: string;
      gpt_errors?: number;
    }>;
  } | null;
  skipped_items: Array<{
    source_key: string;
    source_label?: string;
    title: string;
    url: string;
    reason: string;
    list_section?: string;
    section_order?: number;
  }>;
  sources: Array<{
    key: string;
    label: string;
    last_synced_at: string | null;
    last_result_created: number;
    last_result_skipped: number;
    last_result_error: string | null;
    consecutive_error_count: number;
  }>;
};

export async function fetchExamDutySyncHealth(token: string) {
  return apiFetch<ExamDutySyncHealthPayload>('/admin/exam-duties/sync-health', { token });
}

/** sync-health gövdesinden paneldeki “Son Sync Sonucu” tablosuna */
export function mapExamDutyHealthToSyncResultPayload(h: ExamDutySyncHealthPayload) {
  const log = h.last_sync_log;
  if (!log) return null;
  const total_created = log.results.reduce((a, r) => a + r.created, 0);
  const total_restored = log.results.reduce((a, r) => a + (r.restored ?? 0), 0);
  const total_gpt_errors = log.results.reduce((a, r) => a + (r.gpt_errors ?? 0), 0);
  const ok = !log.results.some((r) => r.error);
  return {
    ok,
    message: log.message,
    total_created,
    total_restored,
    total_gpt_errors,
    quota_skipped: log.quota_skipped,
    quota_limit: 0,
    results: log.results.map((r) => ({
      source_key: r.source_key,
      source_label: r.source_label,
      created: r.created,
      skipped: r.skipped,
      error: r.error,
    })),
    skipped_items: h.skipped_items ?? [],
  };
}

export async function waitForExamDutyInvocation(
  token: string,
  invocationId: number,
  options?: { intervalMs?: number; maxAttempts?: number },
): Promise<ExamDutySyncHealthPayload> {
  const intervalMs = options?.intervalMs ?? 2500;
  const maxAttempts = options?.maxAttempts ?? 150;
  for (let i = 0; i < maxAttempts; i++) {
    await sleep(intervalMs);
    const h = await fetchExamDutySyncHealth(token);
    if (h.sync_invocation_finished >= invocationId) return h;
  }
  throw new Error('Senkronizasyon zaman aşımı (~6 dk). Sunucu veya ağ geçidini kontrol edin.');
}
