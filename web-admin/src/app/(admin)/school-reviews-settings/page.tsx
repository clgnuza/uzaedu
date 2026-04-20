'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { apiFetch } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { Alert } from '@/components/ui/alert';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import {
  Plus,
  Pencil,
  Trash2,
  ArrowUp,
  ArrowDown,
  Flag,
  ExternalLink,
  SlidersHorizontal,
  ListChecks,
  User,
  CheckCircle2,
  Circle,
  Gavel,
  Upload,
  Sparkles,
  Download,
} from 'lucide-react';
import { cn } from '@/lib/utils';

type SchoolReviewCriteria = {
  id: string;
  slug: string;
  label: string;
  hint: string | null;
  sort_order: number;
  min_score: number;
  max_score: number;
  is_active: boolean;
};

type ReportReasonKey = 'spam' | 'uygunsuz' | 'yanlis_bilgi' | 'diger';

type SchoolReviewsContentRules = {
  daily_report_limit_per_actor: number;
  reasons: Record<ReportReasonKey, { label: string; hint: string; enabled: boolean }>;
  profanity_block_enabled: boolean;
  blocked_terms: string[];
};

type SchoolReviewsPenaltyRules = {
  enabled: boolean;
  strikes_until_ban: number;
  ban_duration_days: number;
  reset_strikes_on_ban: boolean;
};

type PlacementUpdatedSchoolRow = { id: string; name: string; institution_code: string | null };

type PlacementApplySummary = {
  source: 'feed' | 'csv' | 'gpt';
  at: number;
  ok?: boolean;
  updated: number;
  skipped_no_match: number;
  row_errors: string[];
  updated_schools?: PlacementUpdatedSchoolRow[];
  updated_schools_truncated?: boolean;
  message?: string;
  /** both | central_only | local_only */
  update_scope?: string;
};

type SchoolReviewsConfig = {
  enabled: boolean;
  rating_min: number;
  rating_max: number;
  moderation_mode: 'auto' | 'moderation';
  allow_questions: boolean;
  questions_require_moderation: boolean;
  content_rules: SchoolReviewsContentRules;
  penalty_rules: SchoolReviewsPenaltyRules;
};

type ContentReportItem = {
  id: string;
  entity_type: string;
  entity_id: string;
  reason: string;
  comment: string | null;
  created_at: string;
  reporter_actor_key: string;
  reporter_user_id: string | null;
  reporter_display_name: string | null;
  reporter_email: string | null;
  reporter_kind: 'registered' | 'guest';
  school_id: string | null;
  school_name: string | null;
  content_exists: boolean;
  content_author_user_id: string | null;
  content_author_display_name: string | null;
  content_is_anonymous: boolean;
  content_preview: string | null;
  admin_seen_at: string | null;
  admin_seen_by: string | null;
  is_read: boolean;
};

type ModerationQueueItem = {
  entity_type: 'review' | 'question' | 'answer';
  id: string;
  school_id: string;
  school_name: string | null;
  content_preview: string;
  created_at: string;
};

const REASON_LABELS: Record<string, string> = {
  spam: 'Spam / tekrar',
  uygunsuz: 'Uygunsuz dil',
  yanlis_bilgi: 'Yanıltıcı bilgi',
  diger: 'Diğer',
};

const ENTITY_LABELS: Record<string, string> = {
  review: 'Yorum',
  question: 'Soru',
  answer: 'Cevap',
};

function canAccessSchoolReviewsSettings(role: string | undefined): boolean {
  return role === 'superadmin' || role === 'moderator';
}

export default function SchoolReviewsSettingsPage() {
  const router = useRouter();
  const { token, me, loading: authLoading } = useAuth();
  const isSuperadmin = me?.role === 'superadmin';
  const [config, setConfig] = useState<SchoolReviewsConfig | null>(null);
  const [criteria, setCriteria] = useState<SchoolReviewCriteria[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<Partial<SchoolReviewsConfig>>({});
  const [criteriaForm, setCriteriaForm] = useState<Partial<SchoolReviewCriteria> & { slug?: string } | null>(null);
  const [activeTab, setActiveTab] = useState<'settings' | 'moderation' | 'reports' | 'rules'>('settings');
  const [rulesForm, setRulesForm] = useState<SchoolReviewsContentRules | null>(null);
  const [penaltyForm, setPenaltyForm] = useState<SchoolReviewsPenaltyRules | null>(null);
  const [rulesSaving, setRulesSaving] = useState(false);
  const [penaltySaving, setPenaltySaving] = useState(false);
  const [reportsLoading, setReportsLoading] = useState(false);
  const [reportsError, setReportsError] = useState<string | null>(null);
  const [reportsData, setReportsData] = useState<{
    total: number;
    page: number;
    limit: number;
    unread_total: number;
    items: ContentReportItem[];
  } | null>(null);
  const [reportEntityFilter, setReportEntityFilter] = useState<string>('');
  const [reportReasonFilter, setReportReasonFilter] = useState<string>('');
  const [reportUnreadOnly, setReportUnreadOnly] = useState(false);
  const [reportPage, setReportPage] = useState(1);
  const [modLoading, setModLoading] = useState(false);
  const [modError, setModError] = useState<string | null>(null);
  const [modData, setModData] = useState<{
    total: number;
    page: number;
    limit: number;
    items: ModerationQueueItem[];
  } | null>(null);
  const [modPage, setModPage] = useState(1);
  const [modEntityFilter, setModEntityFilter] = useState<'review' | 'question' | 'answer' | ''>('');
  const [modBusyKey, setModBusyKey] = useState<string | null>(null);
  const [reportDeleteBusy, setReportDeleteBusy] = useState<string | null>(null);
  const [reportMarkBusy, setReportMarkBusy] = useState<string | null>(null);
  const [reportStrikeBusy, setReportStrikeBusy] = useState<string | null>(null);
  const [placementSyncing, setPlacementSyncing] = useState(false);
  const [placementCsvLoading, setPlacementCsvLoading] = useState(false);
  const [gptSource, setGptSource] = useState('');
  const [gptLimit, setGptLimit] = useState(400);
  const [gptBatch, setGptBatch] = useState(12);
  const [gptSchoolIds, setGptSchoolIds] = useState('');
  const [gptCity, setGptCity] = useState('');
  const [gptResultJson, setGptResultJson] = useState('');
  const [gptWarnings, setGptWarnings] = useState<string[]>([]);
  const [gptMeta, setGptMeta] = useState<{
    schools_considered: number;
    batches: number;
    model: string;
    row_count: number;
    restrict_on_apply?: boolean;
    city?: string;
    update_scope?: string;
    source_scores_in_table?: string;
  } | null>(null);
  const [gptPreviewLoading, setGptPreviewLoading] = useState(false);
  const [gptApplyLoading, setGptApplyLoading] = useState(false);
  const [placementApplySummary, setPlacementApplySummary] = useState<PlacementApplySummary | null>(null);
  /** Yerleştirme: merkezî / yerel beslemelerinin birbirine karışmaması için uygulama kapsamı */
  const [placementUpdateScope, setPlacementUpdateScope] = useState<'both' | 'central_only' | 'local_only'>('both');
  /** GPT önizleme/uygula: DB’ye hangi sütunların yazılacağı (CSV kapsamından bağımsız) */
  const [placementGptUpdateScope, setPlacementGptUpdateScope] = useState<'both' | 'central_only' | 'local_only'>(
    'both',
  );
  /** Yapıştırılan tabloda hangi puanlar var — GPT çıktısı ve sütun eşlemesi */
  const [placementGptSourceTable, setPlacementGptSourceTable] = useState<'both' | 'central_only' | 'local_only'>(
    'both',
  );

  const fetchConfig = useCallback(async () => {
    if (authLoading || !canAccessSchoolReviewsSettings(me?.role)) return;
    setLoading(true);
    try {
      const [configData, criteriaData] = await Promise.all([
        apiFetch<SchoolReviewsConfig>('/app-config/school-reviews', { token: token ?? undefined }),
        apiFetch<SchoolReviewCriteria[]>('/school-reviews/criteria/admin', { token: token ?? undefined }),
      ]);
      setConfig(configData);
      setCriteria(criteriaData);
      setForm({
        enabled: configData.enabled,
        rating_min: configData.rating_min,
        rating_max: configData.rating_max,
        moderation_mode: configData.moderation_mode,
        allow_questions: configData.allow_questions,
        questions_require_moderation: configData.questions_require_moderation,
      });
      const cr = configData.content_rules;
      setRulesForm(
        cr
          ? {
              daily_report_limit_per_actor: cr.daily_report_limit_per_actor,
              reasons: {
                spam: { ...cr.reasons.spam },
                uygunsuz: { ...cr.reasons.uygunsuz },
                yanlis_bilgi: { ...cr.reasons.yanlis_bilgi },
                diger: { ...cr.reasons.diger },
              },
              profanity_block_enabled: cr.profanity_block_enabled ?? false,
              blocked_terms: Array.isArray(cr.blocked_terms) ? [...cr.blocked_terms] : [],
            }
          : null,
      );
      const pr = configData.penalty_rules;
      setPenaltyForm(
        pr
          ? {
              enabled: pr.enabled !== false,
              strikes_until_ban: Math.min(20, Math.max(1, Math.round(Number(pr.strikes_until_ban) || 3))),
              ban_duration_days: Math.min(3650, Math.max(1, Math.round(Number(pr.ban_duration_days) || 30))),
              reset_strikes_on_ban: pr.reset_strikes_on_ban !== false,
            }
          : {
              enabled: true,
              strikes_until_ban: 3,
              ban_duration_days: 30,
              reset_strikes_on_ban: true,
            },
      );
      setLoadError(false);
    } catch {
      setConfig(null);
      setCriteria([]);
      setLoadError(true);
      toast.error('Ayarlar yüklenemedi veya yetkiniz yok.');
    } finally {
      setLoading(false);
    }
  }, [authLoading, me?.role, token]);

  const fetchReports = useCallback(async () => {
    if (!token || !canAccessSchoolReviewsSettings(me?.role)) return;
    setReportsLoading(true);
    setReportsError(null);
    try {
      const params = new URLSearchParams({
        page: String(reportPage),
        limit: '30',
      });
      if (reportEntityFilter) params.set('entity_type', reportEntityFilter);
      if (reportReasonFilter) params.set('reason', reportReasonFilter);
      if (reportUnreadOnly) params.set('unread_only', 'true');
      const data = await apiFetch<{
        total: number;
        page: number;
        limit: number;
        unread_total: number;
        items: ContentReportItem[];
      }>(`/school-reviews/content-reports/admin?${params}`, { token });
      setReportsData(data);
    } catch (e) {
      setReportsData(null);
      setReportsError(e instanceof Error ? e.message : 'Bildirimler yüklenemedi');
    } finally {
      setReportsLoading(false);
    }
  }, [token, me?.role, reportPage, reportEntityFilter, reportReasonFilter, reportUnreadOnly]);

  const fetchModeration = useCallback(async () => {
    if (!token || !canAccessSchoolReviewsSettings(me?.role)) return;
    setModLoading(true);
    setModError(null);
    try {
      const params = new URLSearchParams({ page: String(modPage), limit: '30' });
      if (modEntityFilter) params.set('entity_type', modEntityFilter);
      const data = await apiFetch<{ total: number; page: number; limit: number; items: ModerationQueueItem[] }>(
        `/school-reviews/moderation/queue?${params}`,
        { token },
      );
      setModData(data);
    } catch (e) {
      setModData(null);
      setModError(e instanceof Error ? e.message : 'Kuyruk yüklenemedi');
    } finally {
      setModLoading(false);
    }
  }, [token, me?.role, modPage, modEntityFilter]);

  const runPlacementFeedSync = useCallback(async () => {
    if (!token) return;
    setPlacementSyncing(true);
    try {
      const res = await apiFetch<{
        ok: boolean;
        feed_url_configured: boolean;
        updated: number;
        skipped_no_match: number;
        row_errors: string[];
        message?: string;
        updated_schools?: PlacementUpdatedSchoolRow[];
        updated_schools_truncated?: boolean;
        update_scope?: string;
      }>('/schools/placement-scores/sync-from-feed', {
        method: 'POST',
        token,
        body: JSON.stringify({ update_scope: placementUpdateScope }),
      });
      if (!res.feed_url_configured) {
        toast.message('Feed URL tanımlı değil', {
          description: 'Backend .env: SCHOOL_PLACEMENT_SCORES_FEED_URL (isteğe SCHOOL_PLACEMENT_SCORES_FEED_TOKEN). Günlük 04:00 cron.',
        });
        return;
      }
      if (res.ok) {
        setPlacementApplySummary({
          source: 'feed',
          at: Date.now(),
          ok: true,
          updated: res.updated,
          skipped_no_match: res.skipped_no_match,
          row_errors: res.row_errors ?? [],
          updated_schools: res.updated_schools,
          updated_schools_truncated: res.updated_schools_truncated,
          update_scope: res.update_scope,
        });
        toast.success(`Senkron: ${res.updated} okul güncellendi · eşleşmeyen satır: ${res.skipped_no_match}`);
        if (res.row_errors.length) {
          toast.message('Uyarılar', { description: res.row_errors.slice(0, 6).join(' · ') });
        }
      } else {
        toast.error(res.message ?? res.row_errors[0] ?? 'Senkron başarısız');
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'İstek başarısız');
    } finally {
      setPlacementSyncing(false);
    }
  }, [token, placementUpdateScope]);

  const handlePlacementCsvChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const input = e.target;
      const file = input.files?.[0];
      input.value = '';
      if (!file || !token) return;
      setPlacementCsvLoading(true);
      try {
        const fd = new FormData();
        fd.append('file', file);
        const res = await apiFetch<{
          ok: boolean;
          updated: number;
          skipped_no_match: number;
          row_errors: string[];
          updated_schools?: PlacementUpdatedSchoolRow[];
          updated_schools_truncated?: boolean;
          update_scope?: string;
        }>(
          `/schools/placement-scores/import-csv?auto_enable_dual_track=true&update_scope=${encodeURIComponent(placementUpdateScope)}`,
          {
          method: 'POST',
          token,
          body: fd,
          },
        );
        setPlacementApplySummary({
          source: 'csv',
          at: Date.now(),
          ok: res.ok,
          updated: res.updated,
          skipped_no_match: res.skipped_no_match,
          row_errors: res.row_errors ?? [],
          updated_schools: res.updated_schools,
          updated_schools_truncated: res.updated_schools_truncated,
          update_scope: res.update_scope,
        });
        toast.success(`CSV: ${res.updated} okul güncellendi · eşleşmeyen: ${res.skipped_no_match}`);
        if (res.row_errors?.length) {
          toast.message('Satır uyarıları', { description: res.row_errors.slice(0, 8).join(' · ') });
        }
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Yükleme başarısız');
      } finally {
        setPlacementCsvLoading(false);
      }
    },
    [token, placementUpdateScope],
  );

  const parseSchoolIdList = useCallback((raw: string): string[] | undefined => {
    const parts = raw
      .split(/[\s,;]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    const uuids = parts.filter((p) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(p));
    return uuids.length ? uuids : undefined;
  }, []);

  const runPlacementGptPreview = useCallback(async () => {
    if (!token) return;
    setGptPreviewLoading(true);
    setGptWarnings([]);
    setGptMeta(null);
    try {
      const school_ids = parseSchoolIdList(gptSchoolIds);
      const city = gptCity.trim();
      const body = {
        source_text: gptSource,
        limit: Math.min(2000, Math.max(1, gptLimit || 400)),
        batch_size: Math.min(30, Math.max(4, gptBatch || 12)),
        update_scope: placementGptUpdateScope,
        source_scores_in_table: placementGptSourceTable,
        ...(school_ids?.length ? { school_ids } : {}),
        ...(city ? { city } : {}),
      };
      const res = await apiFetch<{
        ok: boolean;
        rows: unknown[];
        warnings: string[];
        schools_considered: number;
        batches: number;
        model: string;
        update_scope?: string;
        source_scores_in_table?: string;
        city?: string;
        restrict_on_apply?: boolean;
        sample_payload: {
          auto_enable_dual_track: boolean;
          update_scope?: string;
          source_scores_in_table?: string;
          rows: unknown[];
        };
      }>('/schools/placement-scores/gpt-preview', {
        method: 'POST',
        token,
        body: JSON.stringify(body),
      });
      setGptResultJson(JSON.stringify(res.sample_payload ?? { auto_enable_dual_track: true, rows: res.rows }, null, 2));
      setGptWarnings(res.warnings ?? []);
      setGptMeta({
        schools_considered: res.schools_considered,
        batches: res.batches,
        model: res.model,
        row_count: Array.isArray(res.rows) ? res.rows.length : 0,
        restrict_on_apply: res.restrict_on_apply,
        city: res.city,
        update_scope: res.update_scope,
        source_scores_in_table: res.source_scores_in_table,
      });
      toast.success(`Önizleme: ${res.rows?.length ?? 0} satır · ${res.schools_considered} okul bağlamı`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Önizleme başarısız');
      setGptResultJson('');
    } finally {
      setGptPreviewLoading(false);
    }
  }, [
    token,
    gptSource,
    gptLimit,
    gptBatch,
    gptSchoolIds,
    gptCity,
    parseSchoolIdList,
    placementGptUpdateScope,
    placementGptSourceTable,
  ]);

  const runPlacementGptApply = useCallback(async () => {
    if (!token) return;
    if (!gptSource.trim()) {
      toast.error('Önce kaynak metin girin veya önizleme üretin.');
      return;
    }
    const city = gptCity.trim();
    const hasScope = !!parseSchoolIdList(gptSchoolIds)?.length || !!city;
    const scopeHint = hasScope
      ? ' Yalnızca seçilen bağlamdaki (il filtresi ve/veya UUID listesi) okullar güncellenecek.'
      : '';
    const scopeLbl =
      placementGptUpdateScope === 'central_only'
        ? 'kayıt: yalnız merkezî'
        : placementGptUpdateScope === 'local_only'
          ? 'kayıt: yalnız yerel'
          : 'kayıt: her iki sütun';
    const tabLbl =
      placementGptSourceTable === 'central_only'
        ? 'tablo: yalnız merkezî'
        : placementGptSourceTable === 'local_only'
          ? 'tablo: yalnız yerel'
          : 'tablo: ikisi';
    if (
      !window.confirm(
        `GPT çıktısı veritabanındaki eşleşen okulların yerleştirme puanlarını güncelleyecek (${tabLbl}, ${scopeLbl}).${scopeHint} Devam edilsin mi?`,
      )
    ) {
      return;
    }
    setGptApplyLoading(true);
    try {
      const school_ids = parseSchoolIdList(gptSchoolIds);
      const body = {
        source_text: gptSource,
        limit: Math.min(2000, Math.max(1, gptLimit || 400)),
        batch_size: Math.min(30, Math.max(4, gptBatch || 12)),
        update_scope: placementGptUpdateScope,
        source_scores_in_table: placementGptSourceTable,
        ...(school_ids?.length ? { school_ids } : {}),
        ...(city ? { city } : {}),
      };
      const res = await apiFetch<{
        ok: boolean;
        updated: number;
        skipped_no_match: number;
        row_errors: string[];
        gpt_warnings?: string[];
        updated_schools?: PlacementUpdatedSchoolRow[];
        updated_schools_truncated?: boolean;
        update_scope?: string;
      }>('/schools/placement-scores/gpt-apply?auto_enable_dual_track=true', {
        method: 'POST',
        token,
        body: JSON.stringify(body),
      });
      setPlacementApplySummary({
        source: 'gpt',
        at: Date.now(),
        ok: res.ok,
        updated: res.updated,
        skipped_no_match: res.skipped_no_match,
        row_errors: res.row_errors ?? [],
        updated_schools: res.updated_schools,
        updated_schools_truncated: res.updated_schools_truncated,
        update_scope: res.update_scope,
      });
      toast.success(`Uygulandı: ${res.updated} okul güncellendi · eşleşmeyen: ${res.skipped_no_match}`);
      if (res.row_errors?.length) toast.message('Satır hataları', { description: res.row_errors.slice(0, 6).join(' · ') });
      if (res.gpt_warnings?.length) setGptWarnings(res.gpt_warnings);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Uygulama başarısız');
    } finally {
      setGptApplyLoading(false);
    }
  }, [
    token,
    gptSource,
    gptLimit,
    gptBatch,
    gptSchoolIds,
    gptCity,
    parseSchoolIdList,
    placementGptUpdateScope,
    placementGptSourceTable,
  ]);

  const downloadGptJson = useCallback(() => {
    if (!gptResultJson.trim()) return;
    const blob = new Blob([gptResultJson], { type: 'application/json;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'placement-feed-gpt.json';
    a.click();
    URL.revokeObjectURL(a.href);
  }, [gptResultJson]);

  useEffect(() => {
    if (authLoading) return;
    if (!canAccessSchoolReviewsSettings(me?.role)) {
      router.replace('/403');
      return;
    }
    fetchConfig();
  }, [authLoading, me?.role, router, fetchConfig]);

  useEffect(() => {
    if (activeTab !== 'reports' || authLoading) return;
    fetchReports();
  }, [activeTab, authLoading, fetchReports]);

  useEffect(() => {
    if (activeTab !== 'moderation' || authLoading) return;
    void fetchModeration();
  }, [activeTab, authLoading, fetchModeration]);

  const handleDeleteReportedContent = async (row: ContentReportItem) => {
    if (!token || !isSuperadmin || !row.content_exists) return;
    const label = ENTITY_LABELS[row.entity_type] ?? row.entity_type;
    if (
      !confirm(
        `${label} içeriğini kalıcı olarak silmek istediğinize emin misiniz? Bu işlem geri alınamaz; ilgili beğeni/bildirim kayıtları da temizlenir.`,
      )
    )
      return;
    const key = `${row.entity_type}:${row.entity_id}`;
    setReportDeleteBusy(key);
    try {
      const path =
        row.entity_type === 'review'
          ? `/school-reviews/reviews/${row.entity_id}`
          : row.entity_type === 'question'
            ? `/school-reviews/questions/${row.entity_id}`
            : `/school-reviews/answers/${row.entity_id}`;
      await apiFetch(path, { method: 'DELETE', token });
      toast.success('İçerik silindi.');
      await fetchReports();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Silinemedi');
    } finally {
      setReportDeleteBusy(null);
    }
  };

  const handleModerate = async (
    entity_type: ModerationQueueItem['entity_type'],
    id: string,
    status: 'approved' | 'hidden',
  ) => {
    if (!token) return;
    const key = `${entity_type}:${id}`;
    setModBusyKey(key);
    try {
      const path =
        entity_type === 'review'
          ? `/school-reviews/moderation/reviews/${id}`
          : entity_type === 'question'
            ? `/school-reviews/moderation/questions/${id}`
            : `/school-reviews/moderation/answers/${id}`;
      await apiFetch(path, {
        method: 'PATCH',
        token,
        body: JSON.stringify({ status }),
      });
      toast.success(status === 'approved' ? 'Onaylandı' : 'Gizlendi');
      void fetchModeration();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'İşlem başarısız');
    } finally {
      setModBusyKey(null);
    }
  };

  const handleSave = async () => {
    if (!token || !canAccessSchoolReviewsSettings(me?.role)) return;
    const min = form.rating_min ?? config?.rating_min ?? 1;
    const max = form.rating_max ?? config?.rating_max ?? 10;
    if (min > max) {
      toast.error('Minimum puan, maksimum puandan büyük olamaz.');
      return;
    }
    setSaving(true);
    try {
      const payload: Partial<SchoolReviewsConfig> = {
        rating_min: form.rating_min,
        rating_max: form.rating_max,
        moderation_mode: form.moderation_mode,
        allow_questions: form.allow_questions,
        questions_require_moderation: form.questions_require_moderation,
      };
      if (isSuperadmin) payload.enabled = form.enabled;
      await apiFetch('/app-config/school-reviews', {
        method: 'PATCH',
        token,
        body: JSON.stringify(payload),
      });
      toast.success('Okul değerlendirme ayarları kaydedildi');
      fetchConfig();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Kaydedilemedi');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveRules = async () => {
    if (!token || !canAccessSchoolReviewsSettings(me?.role) || !rulesForm) return;
    setRulesSaving(true);
    try {
      await apiFetch('/app-config/school-reviews', {
        method: 'PATCH',
        token,
        body: JSON.stringify({ content_rules: rulesForm }),
      });
      toast.success('Bildirim kuralları kaydedildi');
      fetchConfig();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Kaydedilemedi');
    } finally {
      setRulesSaving(false);
    }
  };

  const handleSavePenaltyRules = async () => {
    if (!token || !isSuperadmin || !penaltyForm) return;
    setPenaltySaving(true);
    try {
      await apiFetch('/app-config/school-reviews', {
        method: 'PATCH',
        token,
        body: JSON.stringify({ penalty_rules: penaltyForm }),
      });
      toast.success('Ceza kuralları kaydedildi');
      fetchConfig();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Kaydedilemedi');
    } finally {
      setPenaltySaving(false);
    }
  };

  const handleMarkReportSeen = async (reportId: string) => {
    if (!token) return;
    setReportMarkBusy(reportId);
    try {
      await apiFetch(`/school-reviews/content-reports/admin/${encodeURIComponent(reportId)}/seen`, {
        method: 'PATCH',
        token,
      });
      toast.success('Okundu işaretlendi');
      await fetchReports();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Güncellenemedi');
    } finally {
      setReportMarkBusy(null);
    }
  };

  const handleStrikeAuthor = async (userId: string) => {
    if (!token || !isSuperadmin) return;
    if (
      !confirm(
        'Bu kullanıcıya bir ceza (strike) uygulanacak. Ayarlardaki eşik dolunca site erişimi süreli kısıtlanır. Devam?',
      )
    )
      return;
    setReportStrikeBusy(userId);
    try {
      const res = await apiFetch<{
        school_reviews_strike_count: number;
        school_reviews_site_ban_until: string | null;
        banned: boolean;
      }>('/school-reviews/content-reports/admin/penalties/strike', {
        method: 'POST',
        token,
        body: JSON.stringify({ user_id: userId }),
      });
      toast.success(res.banned ? 'Ceza uygulandı; kullanıcı süreli yasaklandı.' : 'Ceza (strike) eklendi.');
      await fetchReports();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'İşlem başarısız');
    } finally {
      setReportStrikeBusy(null);
    }
  };

  const sortedCriteria = useMemo(
    () =>
      [...criteria].sort((a, b) => {
        if (a.sort_order !== b.sort_order) return a.sort_order - b.sort_order;
        return a.label.localeCompare(b.label, 'tr');
      }),
    [criteria],
  );

  const moveCriterion = async (index: number, dir: -1 | 1) => {
    if (!token) return;
    const j = index + dir;
    if (j < 0 || j >= sortedCriteria.length) return;
    const arr = [...sortedCriteria];
    const [item] = arr.splice(index, 1);
    arr.splice(j, 0, item);
    try {
      await apiFetch('/school-reviews/criteria/reorder', {
        method: 'POST',
        token,
        body: JSON.stringify({ ordered_ids: arr.map((c) => c.id) }),
      });
      toast.success('Sıra güncellendi');
      fetchConfig();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Sıra değişmedi');
    }
  };

  const toggleCriterionActive = async (c: SchoolReviewCriteria) => {
    if (!token) return;
    try {
      await apiFetch(`/school-reviews/criteria/${c.id}`, {
        method: 'PATCH',
        token,
        body: JSON.stringify({ is_active: !c.is_active }),
      });
      toast.success(c.is_active ? 'Kriter pasif; öğretmen formunda görünmez.' : 'Kriter tekrar aktif.');
      fetchConfig();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Güncellenemedi');
    }
  };

  const handleNormalizeCriteriaScores = async () => {
    if (!token || !canAccessSchoolReviewsSettings(me?.role)) return;
    if (!confirm('Tüm kriterlerde min=1, max=10 olarak güncellenecek (başlık/slug silinmez). Devam?')) return;
    try {
      await apiFetch('/school-reviews/criteria/normalize-score-range', { method: 'POST', token });
      toast.success('Kriter puan aralıkları 1–10 yapıldı');
      fetchConfig();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Güncellenemedi');
    }
  };

  const handleReseedDefaultCriteria = async () => {
    if (!token || !isSuperadmin) return;
    if (
      !confirm(
        'Mevcut tüm kriter satırları silinir ve 8 yeni varsayılan kriter (1–10) yüklenir. Eski değerlendirmelerdeki kriter puanları (slug) artık eşleşmeyebilir. Devam edilsin mi?'
      )
    )
      return;
    try {
      await apiFetch('/school-reviews/criteria/reseed-defaults', { method: 'POST', token });
      toast.success('Varsayılan kriterler yüklendi');
      fetchConfig();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Yüklenemedi');
    }
  };

  if (authLoading) {
    return (
      <div className="flex min-h-[200px] items-center justify-center">
        <LoadingSpinner className="size-8" />
      </div>
    );
  }
  if (me?.role && !canAccessSchoolReviewsSettings(me.role)) return null;
  if (loadError && !config) {
    return (
      <div className="space-y-4">
        <Alert variant="error" message="Ayarlar yüklenemedi. Oturum ve yetkilerinizi kontrol edin." />
        <button
          type="button"
          onClick={() => fetchConfig()}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
        >
          Yeniden dene
        </button>
      </div>
    );
  }
  if (loading || !config) {
    return (
      <div className="flex min-h-[200px] items-center justify-center">
        <LoadingSpinner className="size-8" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {me?.school_reviews_site_ban_until &&
        !Number.isNaN(Date.parse(me.school_reviews_site_ban_until)) &&
        Date.parse(me.school_reviews_site_ban_until) > Date.now() && (
          <Alert
            variant="warning"
            message={`Hesabınız okul değerlendirme kuralları gereği ${new Date(me.school_reviews_site_ban_until).toLocaleString('tr-TR')} tarihine kadar kısıtlı; profil (/me) ve oturum uçları kullanılabilir.`}
          />
        )}
      <div className="rounded-xl border border-primary/20 bg-primary/5 px-4 py-3">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-xl font-semibold text-foreground">Okul Değerlendirme Ayarları</h1>
          <span className="rounded-full bg-primary/15 px-2.5 py-0.5 text-xs font-medium text-primary">
            Puanlama 1–10
          </span>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          Modül anahtarı, moderasyon, soru-cevap ve değerlendirme kriterleri (süper yönetici: varsayılan kriterleri yeniden yükleme).
        </p>
      </div>

      <div
        role="tablist"
        aria-label="Okul değerlendirme yönetimi"
        className="flex flex-wrap gap-1 rounded-xl border border-border/80 bg-muted/30 p-1 dark:bg-muted/15"
      >
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'settings'}
          aria-controls="panel-sr-settings"
          id="tab-sr-settings"
          onClick={() => setActiveTab('settings')}
          className={cn(
            'rounded-lg px-4 py-2.5 text-sm font-medium transition-colors',
            activeTab === 'settings'
              ? 'bg-background text-foreground shadow-sm ring-1 ring-border'
              : 'text-muted-foreground hover:text-foreground',
          )}
        >
          Modül ayarları
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'reports'}
          aria-controls="panel-sr-reports"
          id="tab-sr-reports"
          onClick={() => setActiveTab('reports')}
          className={cn(
            'inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors',
            activeTab === 'reports'
              ? 'bg-background text-foreground shadow-sm ring-1 ring-border'
              : 'text-muted-foreground hover:text-foreground',
          )}
        >
          <Flag className="size-4 shrink-0 opacity-80" aria-hidden />
          İçerik bildirimleri
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'moderation'}
          aria-controls="panel-sr-moderation"
          id="tab-sr-moderation"
          onClick={() => setActiveTab('moderation')}
          className={cn(
            'inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors',
            activeTab === 'moderation'
              ? 'bg-background text-foreground shadow-sm ring-1 ring-border'
              : 'text-muted-foreground hover:text-foreground',
          )}
        >
          <ListChecks className="size-4 shrink-0 opacity-80" aria-hidden />
          Onay kuyruğu
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'rules'}
          aria-controls="panel-sr-rules"
          id="tab-sr-rules"
          onClick={() => setActiveTab('rules')}
          className={cn(
            'inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors',
            activeTab === 'rules'
              ? 'bg-background text-foreground shadow-sm ring-1 ring-border'
              : 'text-muted-foreground hover:text-foreground',
          )}
        >
          <SlidersHorizontal className="size-4 shrink-0 opacity-80" aria-hidden />
          Bildirim kuralları
        </button>
      </div>

      {activeTab === 'settings' && (
      <>
      <div id="panel-sr-settings" role="tabpanel" aria-labelledby="tab-sr-settings" className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Modül Durumu</CardTitle>
          <p className="text-sm text-muted-foreground">
            Modül kapalıyken öğretmenler okul listesine erişemez ve değerlendirme yapamaz.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <label
            className={`flex items-center gap-3 ${isSuperadmin ? 'cursor-pointer' : 'cursor-not-allowed opacity-80'}`}
          >
            <input
              type="checkbox"
              disabled={!isSuperadmin}
              checked={form.enabled ?? config.enabled}
              onChange={(e) => setForm((f) => ({ ...f, enabled: e.target.checked }))}
              className="size-4 rounded border-border disabled:cursor-not-allowed"
            />
            <span className="text-sm font-medium">Modülü aç</span>
          </label>
          {!isSuperadmin && (
            <p className="text-xs text-muted-foreground">
              Modülü açıp kapatma yalnızca süper yönetici tarafından yapılabilir.
            </p>
          )}
        </CardContent>
      </Card>

      {isSuperadmin && (
        <>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Ortaöğretime geçiş — otomatik / toplu besleme</CardTitle>
            <p className="text-sm text-muted-foreground">
              MEB’de <strong>merkezî</strong> (LGS puanı) ve <strong>yerel</strong> (OBP, ikamet, devamsızlık) yerleştirme
              ayrı süreçlerdir. JSON/CSV ile <code className="rounded bg-muted px-1">review_placement_scores</code> güncellenir;
              eşleştirme: <strong>kurum_kodu</strong> / institution_code veya <strong>okul UUID</strong>.
            </p>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div className="rounded-lg border border-border bg-muted/30 p-3 text-xs text-muted-foreground">
              <p className="font-medium text-foreground">JSON örnek (URL yanıtı — takma adlar kabul edilir)</p>
              <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap break-all font-mono text-[11px] leading-relaxed">
                {`{\n  "auto_enable_dual_track": true,\n  "update_scope": "central_only",\n  "rows": [\n    { "kurum_kodu": "709981", "yil": 2025, "merkezi_lgs": 450.5 },\n    { "kurum_kodu": "709981", "yil": 2025, "yerel_taban": 380 }\n  ]\n}`}
              </pre>
              <p className="mt-1 text-[11px] leading-snug">
                <code className="rounded bg-background px-1">update_scope</code>:{' '}
                <strong>both</strong> (varsayılan, iki sütun), <strong>central_only</strong> / <strong>merkezi_only</strong>{' '}
                (yalnız LGS/merkezî — yerel korunur), <strong>local_only</strong> / <strong>yerel_only</strong> /{' '}
                <strong>puansiz</strong> (yalnız yerel — merkezî korunur). İki ayrı JSON dosyasını sırayla yüklerken mutlaka
                doğru kapsamı kullanın.
              </p>
              <p className="mt-2">
                Ortam: <code className="rounded bg-background px-1">SCHOOL_PLACEMENT_SCORES_FEED_URL</code>
                {', '}
                <code className="rounded bg-background px-1">SCHOOL_PLACEMENT_SCORES_FEED_TOKEN</code> (Bearer, isteğe bağlı).
                Zamanlama: her gün 04:00 (İstanbul).
              </p>
            </div>
            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-muted-foreground">
                Uygulama kapsamı (CSV yükleme ve URL JSON senkronu — GPT kartındaki ayarlardan ayrı)
              </label>
              <select
                value={placementUpdateScope}
                onChange={(e) => setPlacementUpdateScope(e.target.value as 'both' | 'central_only' | 'local_only')}
                className="max-w-md rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="both">Her iki sütun (merkezî + yerel)</option>
                <option value="central_only">Yalnız merkezî (LGS) — yerel puanlara dokunma</option>
                <option value="local_only">Yalnız yerel — merkezî (LGS) puanlara dokunma</option>
              </select>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => void runPlacementFeedSync()}
                disabled={placementSyncing || !token}
                className="inline-flex items-center gap-2 rounded-lg border border-border bg-background px-4 py-2 text-sm font-medium hover:bg-muted disabled:opacity-50"
              >
                {placementSyncing ? 'Senkron…' : 'URL’den şimdi senkronize et'}
              </button>
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-primary bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50">
                <Upload className="size-4" aria-hidden />
                {placementCsvLoading ? 'Yükleniyor…' : 'CSV yükle'}
                <input
                  type="file"
                  accept=".csv,text/csv"
                  className="sr-only"
                  disabled={placementCsvLoading || !token}
                  onChange={(ev) => void handlePlacementCsvChange(ev)}
                />
              </label>
            </div>
            <p className="text-xs text-muted-foreground">
              CSV sütunları (en az biri): kurum: <code className="rounded bg-muted px-1">institution_code</code> /{' '}
              <code className="rounded bg-muted px-1">kurum_kodu</code>; okul: <code className="rounded bg-muted px-1">school_id</code> /{' '}
              <code className="rounded bg-muted px-1">okul_id</code>; yıl: <code className="rounded bg-muted px-1">year</code> /{' '}
              <code className="rounded bg-muted px-1">yil</code>; merkezî: <code className="rounded bg-muted px-1">with_exam</code>,{' '}
              <code className="rounded bg-muted px-1">merkezi_lgs</code>, <code className="rounded bg-muted px-1">merkezi_taban</code>; yerel:{' '}
              <code className="rounded bg-muted px-1">without_exam</code>, <code className="rounded bg-muted px-1">yerel_taban</code>,{' '}
              <code className="rounded bg-muted px-1">yerel_obp</code> — ayırıcı <code className="rounded bg-muted px-1">;</code> veya{' '}
              <code className="rounded bg-muted px-1">,</code>.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Sparkles className="size-5 text-violet-500" aria-hidden />
              GPT ile tablodan taslak çıkarma
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              MEB / kılavuz tablosunu yapıştırın. GPT yalnızca metinde <strong>açıkça yazılı</strong> kurum kodu ve puanları
              çıkarmaya çalışır; yine de <strong>insan kontrolü</strong> yapın. Önizleme DB yazmaz; uygulama CSV ile aynı
              birleştirme mantığını kullanır. İl alanı <code className="rounded bg-muted px-1">schools.city</code> ile
              eşleşir; doluysa liste ve uygulama yalnız o ildeki okullarla sınırlıdır. Aşağıda <strong>liste bağlamı</strong>{' '}
              (hangi okullar GPT&apos;ye verilir) ile <strong>tablo / kayıt kapsamı</strong> (hangi puan türü) ayrı
              ayarlanır. Backend: <code className="rounded bg-muted px-1">OPENAI_API_KEY</code>, isteğe bağlı{' '}
              <code className="rounded bg-muted px-1">PLACEMENT_GPT_MODEL</code>.
            </p>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div className="rounded-lg border border-violet-200/50 bg-violet-500/6 p-3 dark:border-violet-900/50 dark:bg-violet-950/25">
              <p className="mb-2 text-xs font-semibold text-foreground">Tablo ve kayıt kapsamı</p>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <label className="block text-xs font-medium text-muted-foreground">
                    Yapıştırdığınız tabloda hangi puanlar var (GPT + sunucu düzeltmesi)
                  </label>
                  <select
                    value={placementGptSourceTable}
                    onChange={(e) => setPlacementGptSourceTable(e.target.value as 'both' | 'central_only' | 'local_only')}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    <option value="both">İkisi de (merkezî + yerel sütunları)</option>
                    <option value="central_only">Yalnız merkezî (LGS) — yerel sütunu yok say</option>
                    <option value="local_only">Yalnız yerel — merkezî sütunu yok say</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="block text-xs font-medium text-muted-foreground">
                    Veritabanına hangi sütunlar yazılsın (uygulama)
                  </label>
                  <select
                    value={placementGptUpdateScope}
                    onChange={(e) => setPlacementGptUpdateScope(e.target.value as 'both' | 'central_only' | 'local_only')}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    <option value="both">Her iki sütun</option>
                    <option value="central_only">Yalnız merkezî (LGS) — yerel DB alanına dokunma</option>
                    <option value="local_only">Yalnız yerel — merkezî DB alanına dokunma</option>
                  </select>
                </div>
              </div>
              <p className="mt-2 text-[11px] leading-snug text-muted-foreground">
                Tabloda tek tür puan varken GPT bazen yanlış JSON alanına yazar; ilk seçenek bunu sadeleştirir. İkinci seçenek
                ise veritabanında hangi alanın güncelleneceğini belirler (CSV ile aynı <code className="rounded bg-muted px-0.5">update_scope</code>).
              </p>
            </div>

            <div>
              <p className="mb-2 text-xs font-semibold text-foreground">Liste bağlamı — hangi okullar GPT&apos;ye verilir</p>
              <div className="grid gap-3 sm:grid-cols-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">En fazla okul (kurum kodlu)</label>
                  <input
                    type="number"
                    min={1}
                    max={2000}
                    value={gptLimit}
                    onChange={(e) => setGptLimit(parseInt(e.target.value, 10) || 400)}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">Parti boyutu (GPT çağrısı başına okul)</label>
                  <input
                    type="number"
                    min={4}
                    max={30}
                    value={gptBatch}
                    onChange={(e) => setGptBatch(parseInt(e.target.value, 10) || 12)}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  />
                </div>
                <div className="sm:col-span-1" />
              </div>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">
                    İl filtresi (isteğe bağlı, okul kaydındaki il adı)
                  </label>
                  <input
                    type="text"
                    value={gptCity}
                    onChange={(e) => setGptCity(e.target.value)}
                    placeholder="Örn. Ankara — boşsa tüm iller (limit kadar)"
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">
                    Okul UUID filtre (isteğe bağlı, virgül veya satır ile)
                  </label>
                  <textarea
                    value={gptSchoolIds}
                    onChange={(e) => setGptSchoolIds(e.target.value)}
                    rows={2}
                    spellCheck={false}
                    placeholder="Boş + il yoksa (limit kadar) kurum kodlu tüm okullar bağlamda kullanılır."
                    className="w-full resize-y rounded-md border border-input bg-background px-3 py-2 font-mono text-xs"
                  />
                </div>
              </div>
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Kaynak metin (tablo / PDF metni)</label>
              <textarea
                value={gptSource}
                onChange={(e) => setGptSource(e.target.value)}
                rows={10}
                spellCheck={false}
                placeholder="Kurum kodları ve puanların geçtiği metni buraya yapıştırın…"
                className="w-full resize-y rounded-md border border-input bg-background px-3 py-2 font-mono text-xs leading-relaxed"
              />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => void runPlacementGptPreview()}
                disabled={gptPreviewLoading || !token || !gptSource.trim()}
                className="inline-flex items-center gap-2 rounded-lg border border-violet-600/40 bg-violet-600/10 px-4 py-2 text-sm font-medium text-violet-900 hover:bg-violet-600/15 disabled:opacity-50 dark:text-violet-100"
              >
                {gptPreviewLoading ? 'Önizleme…' : 'Önizleme üret'}
              </button>
              <button
                type="button"
                onClick={() => void runPlacementGptApply()}
                disabled={gptApplyLoading || !token || !gptSource.trim()}
                className="inline-flex items-center gap-2 rounded-lg border border-primary bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
              >
                {gptApplyLoading ? 'Uygulanıyor…' : 'Veritabanına uygula'}
              </button>
              <button
                type="button"
                onClick={downloadGptJson}
                disabled={!gptResultJson.trim()}
                className="inline-flex items-center gap-2 rounded-lg border border-border bg-background px-4 py-2 text-sm font-medium hover:bg-muted disabled:opacity-50"
              >
                <Download className="size-4" aria-hidden />
                JSON indir
              </button>
            </div>
            {gptMeta && (
              <p className="text-xs text-muted-foreground">
                Model: <span className="font-mono">{gptMeta.model}</span> · Bağlam okul: {gptMeta.schools_considered} ·
                Parti: {gptMeta.batches} · Satır: {gptMeta.row_count}
                {gptMeta.city ? (
                  <>
                    {' '}
                    · İl: <span className="font-medium text-foreground">{gptMeta.city}</span>
                  </>
                ) : null}
                {gptMeta.restrict_on_apply ? (
                  <span className="text-violet-700 dark:text-violet-300">
                    {' '}
                    · Uygulama yalnız bağlam okul kimlikleriyle sınırlı
                  </span>
                ) : null}
                {gptMeta.update_scope ? (
                  <>
                    {' '}
                    · Kayıt kapsamı: <span className="font-mono">{gptMeta.update_scope}</span>
                  </>
                ) : null}
                {gptMeta.source_scores_in_table ? (
                  <>
                    {' '}
                    · Tablo: <span className="font-mono">{gptMeta.source_scores_in_table}</span>
                  </>
                ) : null}
              </p>
            )}
            {gptWarnings.length > 0 && (
              <div className="max-h-32 overflow-auto rounded-md border border-amber-500/30 bg-amber-500/5 p-2 text-xs text-amber-950 dark:text-amber-100">
                {gptWarnings.slice(0, 40).map((w, i) => (
                  <div key={i}>{w}</div>
                ))}
                {gptWarnings.length > 40 && <div className="opacity-80">… +{gptWarnings.length - 40}</div>}
              </div>
            )}
            {gptResultJson && (
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">Besleme JSON örneği (önizleme)</label>
                <textarea
                  readOnly
                  value={gptResultJson}
                  rows={8}
                  className="w-full resize-y rounded-md border border-input bg-muted/30 px-3 py-2 font-mono text-[11px] leading-relaxed"
                />
              </div>
            )}
          </CardContent>
        </Card>

        {placementApplySummary && (
          <Card className="border-emerald-500/25 bg-emerald-500/[0.04] dark:bg-emerald-950/20">
            <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-2 space-y-0 pb-2">
              <div>
                <CardTitle className="text-base">Son yerleştirme işlemi — güncellenen okullar</CardTitle>
                <p className="mt-1 text-xs text-muted-foreground">
                  Kaynak:{' '}
                  {placementApplySummary.source === 'feed'
                    ? 'URL senkron'
                    : placementApplySummary.source === 'csv'
                      ? 'CSV'
                      : 'GPT'}{' '}
                  · {new Date(placementApplySummary.at).toLocaleString('tr-TR')} · Güncellenen:{' '}
                  {placementApplySummary.updated} · Eşleşmeyen satır: {placementApplySummary.skipped_no_match}
                  {placementApplySummary.update_scope
                    ? ` · Kapsam: ${
                        placementApplySummary.update_scope === 'central_only'
                          ? 'yalnız merkezî'
                          : placementApplySummary.update_scope === 'local_only'
                            ? 'yalnız yerel'
                            : 'her iki sütun'
                      }`
                    : ''}
                  {placementApplySummary.updated_schools_truncated
                    ? ' · Liste ilk 500 okulla sınırlı (tam sayı yukarıda)'
                    : ''}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPlacementApplySummary(null)}
                className="shrink-0 rounded-md border border-border bg-background px-2 py-1 text-xs font-medium hover:bg-muted"
              >
                Özeti kapat
              </button>
            </CardHeader>
            <CardContent className="space-y-2">
              {placementApplySummary.updated_schools && placementApplySummary.updated_schools.length > 0 ? (
                <ul className="max-h-64 list-none space-y-1 overflow-y-auto rounded-md border border-border bg-background/80 p-2 text-sm">
                  {placementApplySummary.updated_schools.map((s) => (
                    <li key={s.id} className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 border-b border-border/60 py-1.5 last:border-0">
                      <Link
                        href={`/schools/${s.id}`}
                        className="min-w-0 flex-1 font-medium text-primary hover:underline"
                      >
                        {s.name || 'İsimsiz okul'}
                      </Link>
                      {s.institution_code ? (
                        <span className="shrink-0 font-mono text-xs text-muted-foreground">{s.institution_code}</span>
                      ) : null}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Bu işlemde veritabanında eşleşen okul kaydı güncellenmedi veya liste dönmedi.
                </p>
              )}
            </CardContent>
          </Card>
        )}
        </>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Değerlendirme (Puan) Ayarları</CardTitle>
          <p className="text-sm text-muted-foreground">
            Genel tek puan modunda aralık 1–10 olmalıdır (kriter varken her kritere ayrı 1–10).
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium">Minimum puan</label>
              <input
                type="number"
                min={1}
                max={10}
                value={form.rating_min ?? config.rating_min}
                onChange={(e) =>
                  setForm((f) => ({ ...f, rating_min: parseInt(e.target.value, 10) || 1 }))
                }
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Maksimum puan</label>
              <input
                type="number"
                min={1}
                max={10}
                value={form.rating_max ?? config.rating_max}
                onChange={(e) =>
                  setForm((f) => ({ ...f, rating_max: parseInt(e.target.value, 10) || 10 }))
                }
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
            </div>
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium">Moderasyon modu</label>
            <select
              value={form.moderation_mode ?? config.moderation_mode}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  moderation_mode: e.target.value as 'auto' | 'moderation',
                }))
              }
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="auto">
                Otomatik yayın – Değerlendirmeler anında yayınlanır
              </option>
              <option value="moderation">
                Moderasyon – Değerlendirmeler onay sonrası yayınlanır
              </option>
            </select>
            {(form.moderation_mode ?? config.moderation_mode) === 'moderation' && (
              <p className="mt-2 text-xs text-muted-foreground">
                Bekleyen değerlendirmeleri <strong>Onay kuyruğu</strong> sekmesinden yayına alın veya gizleyin.
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Soru / Cevap Ayarları</CardTitle>
          <p className="text-sm text-muted-foreground">
            Öğretmenler okullar hakkında soru sorabilir; diğer öğretmenler cevap verebilir.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <label className="flex cursor-pointer items-center gap-3">
            <input
              type="checkbox"
              checked={form.allow_questions ?? config.allow_questions}
              onChange={(e) => setForm((f) => ({ ...f, allow_questions: e.target.checked }))}
              className="size-4 rounded border-border"
            />
            <span className="text-sm font-medium">Soru özelliğini aç</span>
          </label>
          <label className="flex cursor-pointer items-center gap-3">
            <input
              type="checkbox"
              checked={form.questions_require_moderation ?? config.questions_require_moderation}
              onChange={(e) =>
                setForm((f) => ({ ...f, questions_require_moderation: e.target.checked }))
              }
              className="size-4 rounded border-border"
            />
            <span className="text-sm font-medium">Sorular moderasyondan geçsin</span>
          </label>
          {(form.questions_require_moderation ?? config.questions_require_moderation) && (
            <p className="text-xs text-muted-foreground">
              Bekleyen soru ve cevapları <strong>Onay kuyruğu</strong> sekmesinden onaylayın; yazar kendi bekleyen içeriğini okul sayfasında «Onay bekliyor» ile görür.
            </p>
          )}
        </CardContent>
      </Card>

      {(form.moderation_mode ?? config.moderation_mode) === 'moderation' ||
      (form.questions_require_moderation ?? config.questions_require_moderation) ? (
        <Alert variant="info">
          <p className="text-sm">
            Moderasyon açıkken içerikler önce <strong>beklemede</strong> kaydolur. Yayına almak için{' '}
            <button
              type="button"
              className="font-semibold text-primary underline underline-offset-2 hover:no-underline"
              onClick={() => setActiveTab('moderation')}
            >
              Onay kuyruğu
            </button>{' '}
            sekmesini kullanın.
          </p>
        </Alert>
      ) : null}

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <CardTitle className="text-base">Değerlendirme Kriterleri</CardTitle>
              <p className="text-sm text-muted-foreground">
                Varsayılan kriterler 1–10 puan ölçeğindedir. Kriter yoksa tek genel puan (yukarıdaki aralık) kullanılır.
              </p>
            </div>
            <div className="flex shrink-0 flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleNormalizeCriteriaScores}
                className="rounded-md border border-primary/40 bg-primary/5 px-3 py-2 text-xs font-medium text-primary hover:bg-primary/10"
              >
                Tüm kriterleri 1–10 yap
              </button>
              {isSuperadmin && (
                <button
                  type="button"
                  onClick={handleReseedDefaultCriteria}
                  className="rounded-md border border-amber-600/40 bg-amber-500/10 px-3 py-2 text-xs font-medium text-amber-900 hover:bg-amber-500/20 dark:text-amber-100"
                >
                  Varsayılan kriterleri yeniden yükle
                </button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {criteriaForm ? (
            <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-3">
              <div>
                <label className="mb-1 block text-sm font-medium">Slug (sadece yeni kritere)</label>
                <input
                  type="text"
                  value={criteriaForm.slug ?? ''}
                  onChange={(e) => setCriteriaForm((f) => ({ ...f, slug: e.target.value }))}
                  placeholder="sosyo_ekonomik"
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  readOnly={!!criteriaForm.id}
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Başlık</label>
                <input
                  type="text"
                  value={criteriaForm.label ?? ''}
                  onChange={(e) => setCriteriaForm((f) => ({ ...f, label: e.target.value }))}
                  placeholder="Lokasyonun Sosyo-Ekonomik Durumu"
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">İpucu (opsiyonel)</label>
                <input
                  type="text"
                  value={criteriaForm.hint ?? ''}
                  onChange={(e) => setCriteriaForm((f) => ({ ...f, hint: e.target.value || undefined }))}
                  placeholder="1 = en pahalı"
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-medium">Sıra (0 = ilk)</label>
                  <input
                    type="number"
                    min={0}
                    value={criteriaForm.sort_order ?? 0}
                    onChange={(e) =>
                      setCriteriaForm((f) => ({
                        ...f,
                        sort_order: Math.max(0, parseInt(e.target.value, 10) || 0),
                      }))
                    }
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  />
                </div>
                <label className="flex cursor-pointer items-end gap-2 pb-2">
                  <input
                    type="checkbox"
                    checked={criteriaForm.is_active !== false}
                    onChange={(e) => setCriteriaForm((f) => ({ ...f, is_active: e.target.checked }))}
                    className="size-4 rounded border-border"
                  />
                  <span className="text-sm font-medium">Aktif (formda göster)</span>
                </label>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-medium">Min puan</label>
                  <input
                    type="number"
                    min={1}
                    max={10}
                    value={criteriaForm.min_score ?? 1}
                    onChange={(e) =>
                      setCriteriaForm((f) => ({
                        ...f,
                        min_score: Math.min(10, Math.max(1, parseInt(e.target.value, 10) || 1)),
                      }))
                    }
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium">Max puan</label>
                  <input
                    type="number"
                    min={1}
                    max={10}
                    value={criteriaForm.max_score ?? 10}
                    onChange={(e) =>
                      setCriteriaForm((f) => ({
                        ...f,
                        max_score: Math.min(10, Math.max(1, parseInt(e.target.value, 10) || 10)),
                      }))
                    }
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={async () => {
                    if (!token) return;
                    try {
                      if (criteriaForm.id) {
                        await apiFetch(`/school-reviews/criteria/${criteriaForm.id}`, {
                          method: 'PATCH',
                          token,
                          body: JSON.stringify({
                            label: criteriaForm.label,
                            hint: criteriaForm.hint || null,
                            sort_order: criteriaForm.sort_order ?? 0,
                            min_score: criteriaForm.min_score ?? 1,
                            max_score: criteriaForm.max_score ?? 10,
                            is_active: criteriaForm.is_active !== false,
                          }),
                        });
                        toast.success('Kriter güncellendi');
                      } else if (criteriaForm.slug && criteriaForm.label) {
                        await apiFetch('/school-reviews/criteria', {
                          method: 'POST',
                          token,
                          body: JSON.stringify({
                            slug: criteriaForm.slug.trim().toLowerCase().replace(/\s+/g, '_'),
                            label: criteriaForm.label.trim(),
                            hint: criteriaForm.hint?.trim() || null,
                            sort_order:
                              criteriaForm.sort_order ??
                              (criteria.length ? Math.max(...criteria.map((x) => x.sort_order)) + 1 : 0),
                            min_score: criteriaForm.min_score ?? 1,
                            max_score: criteriaForm.max_score ?? 10,
                            is_active: criteriaForm.is_active !== false,
                          }),
                        });
                        toast.success('Kriter eklendi');
                      }
                      setCriteriaForm(null);
                      fetchConfig();
                    } catch (e) {
                      toast.error(e instanceof Error ? e.message : 'Hata');
                    }
                  }}
                  className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                >
                  Kaydet
                </button>
                <button
                  type="button"
                  onClick={() => setCriteriaForm(null)}
                  className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-muted/50"
                >
                  İptal
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() =>
                setCriteriaForm({
                  slug: '',
                  label: '',
                  hint: null,
                  min_score: 1,
                  max_score: 10,
                  is_active: true,
                  sort_order: criteria.length ? Math.max(...criteria.map((x) => x.sort_order)) + 1 : 0,
                })
              }
              className="flex items-center gap-2 rounded-md border border-dashed border-primary/50 px-4 py-2 text-sm font-medium text-primary hover:bg-primary/5"
            >
              <Plus className="size-4" />
              Yeni kriter ekle
            </button>
          )}
          <ul className="divide-y divide-border">
            {sortedCriteria.map((c, index) => (
              <li
                key={c.id}
                className={cn(
                  'flex flex-wrap items-center justify-between gap-2 py-3 first:pt-0 sm:flex-nowrap',
                  !c.is_active && 'opacity-65',
                )}
              >
                <div className="flex min-w-0 flex-1 items-start gap-2">
                  <div className="flex shrink-0 flex-col gap-0.5">
                    <button
                      type="button"
                      onClick={() => moveCriterion(index, -1)}
                      disabled={index === 0}
                      className="rounded p-0.5 hover:bg-muted disabled:cursor-not-allowed disabled:opacity-30"
                      aria-label="Yukarı taşı"
                    >
                      <ArrowUp className="size-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => moveCriterion(index, 1)}
                      disabled={index === sortedCriteria.length - 1}
                      className="rounded p-0.5 hover:bg-muted disabled:cursor-not-allowed disabled:opacity-30"
                      aria-label="Aşağı taşı"
                    >
                      <ArrowDown className="size-4" />
                    </button>
                  </div>
                  <div className="min-w-0">
                    <span className="font-medium">{c.label}</span>
                    {c.hint && <span className="ml-2 text-sm text-muted-foreground">({c.hint})</span>}
                    <span className="ml-2 text-xs text-muted-foreground">#{c.slug}</span>
                    <span className="ml-2 rounded-md bg-muted px-1.5 py-0.5 text-xs tabular-nums text-muted-foreground">
                      {c.min_score}–{c.max_score}
                    </span>
                    {!c.is_active && (
                      <span className="ml-2 rounded-md bg-amber-500/15 px-1.5 py-0.5 text-xs text-amber-900 dark:text-amber-100">
                        Pasif
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
                  <label className="flex cursor-pointer items-center gap-1.5 text-xs text-muted-foreground">
                    <input
                      type="checkbox"
                      checked={c.is_active}
                      onChange={() => toggleCriterionActive(c)}
                      className="size-3.5 rounded border-border"
                    />
                    Aktif
                  </label>
                  <button
                    type="button"
                    onClick={() => setCriteriaForm({ ...c })}
                    className="rounded p-1.5 hover:bg-muted"
                    aria-label="Düzenle"
                  >
                    <Pencil className="size-4" />
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      if (!token || !confirm('Bu kriteri silmek istediğinize emin misiniz?')) return;
                      try {
                        await apiFetch(`/school-reviews/criteria/${c.id}`, { method: 'DELETE', token });
                        toast.success('Kriter silindi');
                        fetchConfig();
                      } catch (e) {
                        toast.error(e instanceof Error ? e.message : 'Silinemedi');
                      }
                    }}
                    className="rounded p-1.5 text-destructive hover:bg-destructive/10"
                    aria-label="Sil"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
          {criteria.length === 0 && !criteriaForm && (
            <p className="text-sm text-muted-foreground">Henüz kriter yok. Eklediğinizde öğretmenler her kritere ayrı puan verir.</p>
          )}
        </CardContent>
      </Card>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          {saving ? 'Kaydediliyor…' : 'Kaydet'}
        </button>
      </div>

      <Alert variant="info">
        <p className="font-medium">Önerilen ayarlar</p>
        <ul className="mt-2 list-inside list-disc space-y-1 text-muted-foreground">
          <li>6–10 kriter: formu uzatmadan yeterli ayrıntı.</li>
          <li>Tüm kriterlerde min–max’ı aynı tutun (örn. 1–10).</li>
          <li>Geçici kapatma için silmek yerine &quot;Pasif&quot; kullanın (slug/puan geçmişi korunur).</li>
          <li>Moderasyonu önce test ortamında deneyin; canlıda &quot;Otomatik yayın&quot; risklidir.</li>
          <li>&quot;Varsayılan kriterleri yeniden yükle&quot; mevcut satırları siler; yalnızca sıfırdan kurulumda kullanın.</li>
        </ul>
      </Alert>

      <Alert
        variant="info"
        message="Okul yöneticisi yalnızca kendi okulunun raporunu görür. Modül anahtarı (aç/kapa) yalnızca süper yönetici içindir; moderatör diğer ayarları güncelleyebilir."
      />
      </div>
      </>
      )}

      {activeTab === 'moderation' && (
        <div
          id="panel-sr-moderation"
          role="tabpanel"
          aria-labelledby="tab-sr-moderation"
          className="space-y-4"
        >
          <Card className="overflow-hidden border-primary/15 bg-gradient-to-br from-primary/[0.06] to-background dark:from-primary/10">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <ListChecks className="size-5 text-primary" aria-hidden />
                Onay bekleyen içerikler
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                Bekleyen kayıtlar tabloda; Onayla / Gizle ile işleyin.
              </p>
            </CardHeader>
          </Card>

          <div className="flex flex-wrap items-end gap-2">
            <div className="min-w-0 sm:max-w-[160px]">
              <label htmlFor="mod-entity" className="mb-1 block text-xs font-medium text-muted-foreground">
                Tür
              </label>
              <select
                id="mod-entity"
                value={modEntityFilter}
                onChange={(e) => {
                  setModEntityFilter(e.target.value as '' | 'review' | 'question' | 'answer');
                  setModPage(1);
                }}
                className="w-full rounded-lg border border-input bg-background px-2 py-1.5 text-xs"
              >
                <option value="">Tümü</option>
                <option value="review">Yorum</option>
                <option value="question">Soru</option>
                <option value="answer">Cevap</option>
              </select>
            </div>
            <button
              type="button"
              onClick={() => void fetchModeration()}
              disabled={modLoading}
              className="rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-medium hover:bg-muted/50 disabled:opacity-50"
            >
              Yenile
            </button>
          </div>

          {modLoading && !modData && (
            <div className="flex min-h-[120px] items-center justify-center rounded-lg border border-dashed border-border">
              <LoadingSpinner className="size-8" />
            </div>
          )}

          {modError && <Alert variant="error" message={modError} />}

          {!modLoading && modData && modData.items.length === 0 && (
            <Card>
              <CardContent className="py-8 text-center text-sm text-muted-foreground">
                Bekleyen içerik yok veya filtreye uygun kayıt bulunamadı.
              </CardContent>
            </Card>
          )}

          {modData && modData.items.length > 0 && (
            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full min-w-[720px] border-collapse text-left text-xs">
                <thead>
                  <tr className="border-b border-border bg-muted/40 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    <th className="px-2 py-2">Tür</th>
                    <th className="px-2 py-2">Tarih</th>
                    <th className="px-2 py-2">Okul</th>
                    <th className="min-w-[180px] px-2 py-2">Özet</th>
                    <th className="px-2 py-2 text-right">İşlem</th>
                  </tr>
                </thead>
                <tbody>
                  {modData.items.map((row) => {
                    const busy = modBusyKey === `${row.entity_type}:${row.id}`;
                    const prev = (row.content_preview ?? '').trim();
                    const short = prev.length > 120 ? `${prev.slice(0, 118)}…` : prev || '—';
                    return (
                      <tr
                        key={`${row.entity_type}-${row.id}`}
                        className="border-b border-border/80 align-top hover:bg-muted/25"
                      >
                        <td className="whitespace-nowrap px-2 py-1.5 font-medium">
                          {ENTITY_LABELS[row.entity_type] ?? row.entity_type}
                        </td>
                        <td className="whitespace-nowrap px-2 py-1.5 tabular-nums text-muted-foreground">
                          <time dateTime={row.created_at}>{new Date(row.created_at).toLocaleString('tr-TR')}</time>
                        </td>
                        <td className="max-w-[140px] px-2 py-1.5">
                          <div className="truncate font-medium" title={row.school_name ?? ''}>
                            {row.school_name?.trim() || '—'}
                          </div>
                          {row.school_id ? (
                            <Link
                              href={`/okul-degerlendirmeleri?id=${encodeURIComponent(row.school_id)}`}
                              className="inline-flex items-center gap-0.5 text-[10px] text-primary hover:underline"
                            >
                              okul
                              <ExternalLink className="size-2.5 shrink-0" aria-hidden />
                            </Link>
                          ) : null}
                        </td>
                        <td className="max-w-[320px] px-2 py-1.5">
                          <p className="line-clamp-2 text-muted-foreground" title={prev}>
                            {short}
                          </p>
                        </td>
                        <td className="space-y-1 px-2 py-1.5 text-right">
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => void handleModerate(row.entity_type, row.id, 'approved')}
                            className="block w-full rounded border border-primary bg-primary px-2 py-1 text-[11px] font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                          >
                            {busy ? '…' : 'Onayla'}
                          </button>
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => void handleModerate(row.entity_type, row.id, 'hidden')}
                            className="block w-full rounded border border-destructive/50 bg-destructive/5 px-2 py-1 text-[11px] font-medium text-destructive hover:bg-destructive/10 disabled:opacity-50"
                          >
                            Gizle
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {modData && modData.total > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
              <p>
                Toplam <span className="font-semibold text-foreground">{modData.total}</span> — sayfa{' '}
                {modData.page} / {Math.max(1, Math.ceil(modData.total / (modData.limit || 1)))}
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={modPage <= 1 || modLoading}
                  onClick={() => setModPage((p) => Math.max(1, p - 1))}
                  className="rounded border border-border px-2 py-1 disabled:opacity-40"
                >
                  Önceki
                </button>
                <button
                  type="button"
                  disabled={
                    modLoading || modPage >= Math.ceil(modData.total / (modData.limit || 1))
                  }
                  onClick={() => setModPage((p) => p + 1)}
                  className="rounded border border-border px-2 py-1 disabled:opacity-40"
                >
                  Sonraki
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'reports' && (
        <div
          id="panel-sr-reports"
          role="tabpanel"
          aria-labelledby="tab-sr-reports"
          className="space-y-4"
        >
          <Card className="overflow-hidden border-rose-500/15 bg-gradient-to-br from-rose-500/[0.06] to-background dark:from-rose-950/20">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <Flag className="size-5 text-rose-600 dark:text-rose-400" aria-hidden />
                Kullanıcı bildirimleri
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                Okunmamış satırlar vurgulanır; «Okundu» ile kuyruk temizlenir. Süper yönetici içerik yazarına ceza (strike)
                uygular; ayarlardaki eşikte süreli site yasağı tetiklenir.
              </p>
            </CardHeader>
          </Card>

          <div className="flex flex-col flex-wrap gap-3 sm:flex-row sm:items-end">
            <div className="min-w-0 flex-1 sm:max-w-[160px]">
              <label htmlFor="rep-entity" className="mb-1 block text-xs font-medium text-muted-foreground">
                Tür
              </label>
              <select
                id="rep-entity"
                value={reportEntityFilter}
                onChange={(e) => {
                  setReportEntityFilter(e.target.value);
                  setReportPage(1);
                }}
                className="w-full rounded-lg border border-input bg-background px-2 py-1.5 text-xs"
              >
                <option value="">Tümü</option>
                <option value="review">Yorum</option>
                <option value="question">Soru</option>
                <option value="answer">Cevap</option>
              </select>
            </div>
            <div className="min-w-0 flex-1 sm:max-w-[180px]">
              <label htmlFor="rep-reason" className="mb-1 block text-xs font-medium text-muted-foreground">
                Sebep
              </label>
              <select
                id="rep-reason"
                value={reportReasonFilter}
                onChange={(e) => {
                  setReportReasonFilter(e.target.value);
                  setReportPage(1);
                }}
                className="w-full rounded-lg border border-input bg-background px-2 py-1.5 text-xs"
              >
                <option value="">Tümü</option>
                <option value="spam">Spam / tekrar</option>
                <option value="uygunsuz">Uygunsuz dil</option>
                <option value="yanlis_bilgi">Yanıltıcı bilgi</option>
                <option value="diger">Diğer</option>
              </select>
            </div>
            <label className="flex cursor-pointer items-center gap-2 text-xs font-medium text-foreground">
              <input
                type="checkbox"
                checked={reportUnreadOnly}
                onChange={(e) => {
                  setReportUnreadOnly(e.target.checked);
                  setReportPage(1);
                }}
                className="rounded border-input"
              />
              Yalnız okunmamış
            </label>
            {reportsData != null ? (
              <span className="text-xs tabular-nums text-muted-foreground">
                Okunmamış (filtreyle):{' '}
                <strong className="text-foreground">{reportsData.unread_total}</strong>
              </span>
            ) : null}
            <button
              type="button"
              onClick={() => void fetchReports()}
              disabled={reportsLoading}
              className="rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-medium hover:bg-muted/50 disabled:opacity-50"
            >
              Yenile
            </button>
          </div>

          {reportsLoading && !reportsData && (
            <div className="flex min-h-[120px] items-center justify-center rounded-lg border border-dashed border-border">
              <LoadingSpinner className="size-8" />
            </div>
          )}

          {reportsError && <Alert variant="error" message={reportsError} />}

          {!reportsLoading && reportsData && reportsData.items.length === 0 && (
            <Card>
              <CardContent className="py-8 text-center text-sm text-muted-foreground">
                Kayıt yok veya filtreye uyan bildirim bulunamadı.
              </CardContent>
            </Card>
          )}

          {reportsData && reportsData.items.length > 0 && (
            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full min-w-[920px] border-collapse text-left text-xs">
                <thead>
                  <tr className="border-b border-border bg-muted/40 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    <th className="px-2 py-2">Durum</th>
                    <th className="px-2 py-2">Tarih</th>
                    <th className="px-2 py-2">Tür</th>
                    <th className="px-2 py-2">Sebep</th>
                    <th className="px-2 py-2">Okul</th>
                    <th className="px-2 py-2">Bildiren</th>
                    <th className="px-2 py-2">Yazar</th>
                    <th className="min-w-[140px] px-2 py-2">Özet</th>
                    <th className="px-2 py-2 text-right">İşlem</th>
                  </tr>
                </thead>
                <tbody>
                  {reportsData.items.map((row) => {
                    const warn =
                      !row.content_exists || !row.school_id
                        ? !row.content_exists
                          ? 'İçerik yok'
                          : 'Okul eksik'
                        : '';
                    const prev = (row.content_preview ?? '').trim();
                    const short = prev.length > 96 ? `${prev.slice(0, 94)}…` : prev;
                    return (
                      <tr
                        key={row.id}
                        className={cn(
                          'border-b border-border/80 align-top',
                          !row.is_read ? 'bg-amber-500/[0.07]' : 'hover:bg-muted/30',
                        )}
                      >
                        <td className="px-2 py-1.5">
                          <span className="inline-flex items-center gap-1 whitespace-nowrap font-medium text-foreground">
                            {row.is_read ? (
                              <CheckCircle2 className="size-3.5 shrink-0 text-emerald-600" aria-hidden />
                            ) : (
                              <Circle className="size-3.5 shrink-0 text-amber-600" aria-hidden />
                            )}
                            {row.is_read ? 'Okundu' : 'Okunmadı'}
                          </span>
                        </td>
                        <td className="whitespace-nowrap px-2 py-1.5 tabular-nums text-muted-foreground">
                          <time dateTime={row.created_at}>{new Date(row.created_at).toLocaleString('tr-TR')}</time>
                        </td>
                        <td className="px-2 py-1.5">{ENTITY_LABELS[row.entity_type] ?? row.entity_type}</td>
                        <td className="px-2 py-1.5">{REASON_LABELS[row.reason] ?? row.reason}</td>
                        <td className="max-w-[120px] px-2 py-1.5">
                          <div className="truncate font-medium" title={row.school_name ?? ''}>
                            {row.school_name?.trim() || (row.school_id ? '—' : '—')}
                          </div>
                          {row.school_id ? (
                            <Link
                              href={`/okul-degerlendirmeleri?id=${encodeURIComponent(row.school_id)}`}
                              className="text-[10px] text-primary hover:underline"
                            >
                              okul
                            </Link>
                          ) : null}
                        </td>
                        <td className="max-w-[100px] px-2 py-1.5">
                          {row.reporter_kind === 'registered' && row.reporter_user_id ? (
                            <Link
                              href={`/users/${encodeURIComponent(row.reporter_user_id)}`}
                              className="block truncate text-primary hover:underline"
                              title={row.reporter_display_name ?? row.reporter_email ?? ''}
                            >
                              {row.reporter_display_name?.trim() || row.reporter_email || '—'}
                            </Link>
                          ) : (
                            <span className="truncate text-muted-foreground" title={row.reporter_actor_key}>
                              Misafir
                            </span>
                          )}
                        </td>
                        <td className="max-w-[100px] px-2 py-1.5">
                          {row.content_author_user_id ? (
                            <Link
                              href={`/users/${encodeURIComponent(row.content_author_user_id)}`}
                              className="block truncate text-primary hover:underline"
                              title={row.content_author_display_name ?? ''}
                            >
                              {row.content_author_display_name?.trim() || '—'}
                            </Link>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="max-w-[200px] px-2 py-1.5">
                          <p className="line-clamp-2 text-muted-foreground" title={prev || row.comment || ''}>
                            {short || row.comment?.slice(0, 80) || '—'}
                          </p>
                          {warn ? (
                            <span className="mt-0.5 inline-block text-[10px] font-medium text-amber-700 dark:text-amber-300">
                              {warn}
                            </span>
                          ) : null}
                        </td>
                        <td className="space-y-1 px-2 py-1.5 text-right">
                          {!row.is_read ? (
                            <button
                              type="button"
                              disabled={reportMarkBusy === row.id}
                              onClick={() => void handleMarkReportSeen(row.id)}
                              className="block w-full rounded border border-border bg-background px-2 py-1 text-[11px] font-medium hover:bg-muted/60 disabled:opacity-50"
                            >
                              {reportMarkBusy === row.id ? '…' : 'Okundu'}
                            </button>
                          ) : null}
                          {isSuperadmin && row.content_author_user_id ? (
                            <button
                              type="button"
                              disabled={reportStrikeBusy === row.content_author_user_id}
                              onClick={() => void handleStrikeAuthor(row.content_author_user_id!)}
                              className="inline-flex w-full items-center justify-center gap-1 rounded border border-amber-600/40 bg-amber-500/10 px-2 py-1 text-[11px] font-medium text-amber-900 hover:bg-amber-500/15 dark:text-amber-100"
                              title="İçerik yazarına +1 strike"
                            >
                              <Gavel className="size-3 shrink-0" aria-hidden />
                              Ceza
                            </button>
                          ) : null}
                          {isSuperadmin && row.content_exists ? (
                            <button
                              type="button"
                              disabled={reportDeleteBusy === `${row.entity_type}:${row.entity_id}`}
                              onClick={() => void handleDeleteReportedContent(row)}
                              className="block w-full rounded border border-destructive/40 bg-destructive/5 px-2 py-1 text-[11px] font-medium text-destructive hover:bg-destructive/10 disabled:opacity-50"
                            >
                              Sil
                            </button>
                          ) : null}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {reportsData && reportsData.total > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
              <p>
                Bu sayfa <span className="font-semibold text-foreground">{reportsData.total}</span> kayıt —{' '}
                {reportsData.page} / {Math.max(1, Math.ceil(reportsData.total / (reportsData.limit || 1)))}
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={reportPage <= 1 || reportsLoading}
                  onClick={() => setReportPage((p) => Math.max(1, p - 1))}
                  className="rounded border border-border px-2 py-1 disabled:opacity-40"
                >
                  Önceki
                </button>
                <button
                  type="button"
                  disabled={
                    reportsLoading ||
                    reportPage >= Math.ceil(reportsData.total / (reportsData.limit || 1))
                  }
                  onClick={() => setReportPage((p) => p + 1)}
                  className="rounded border border-border px-2 py-1 disabled:opacity-40"
                >
                  Sonraki
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'rules' && rulesForm && (
        <div
          id="panel-sr-rules"
          role="tabpanel"
          aria-labelledby="tab-sr-rules"
          className="space-y-6"
        >
          {isSuperadmin && penaltyForm ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">İçerik yazarı cezaları</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Süper yönetici bildirim satırından «Ceza» ile strike ekler. Eşik dolunca kullanıcı süreli olarak API erişiminden
                  men edilir (profil / oturum hariç).
                </p>
              </CardHeader>
              <CardContent className="space-y-4 text-sm">
                <label className="flex cursor-pointer items-center gap-2">
                  <input
                    type="checkbox"
                    checked={penaltyForm.enabled}
                    onChange={(e) =>
                      setPenaltyForm((p) => (p ? { ...p, enabled: e.target.checked } : p))
                    }
                  />
                  Otomatik site yasağı aktif
                </label>
                <div className="flex flex-wrap gap-4">
                  <div>
                    <label htmlFor="sr-strikes" className="mb-1 block text-xs text-muted-foreground">
                      Kaç cezada yasak
                    </label>
                    <input
                      id="sr-strikes"
                      type="number"
                      min={1}
                      max={20}
                      value={penaltyForm.strikes_until_ban}
                      onChange={(e) =>
                        setPenaltyForm((p) =>
                          p
                            ? {
                                ...p,
                                strikes_until_ban: Math.min(20, Math.max(1, parseInt(e.target.value, 10) || 1)),
                              }
                            : p,
                        )
                      }
                      className="w-24 rounded-md border border-input bg-background px-2 py-1.5 text-sm"
                    />
                  </div>
                  <div>
                    <label htmlFor="sr-ban-days" className="mb-1 block text-xs text-muted-foreground">
                      Yasak süresi (gün)
                    </label>
                    <input
                      id="sr-ban-days"
                      type="number"
                      min={1}
                      max={3650}
                      value={penaltyForm.ban_duration_days}
                      onChange={(e) =>
                        setPenaltyForm((p) =>
                          p
                            ? {
                                ...p,
                                ban_duration_days: Math.min(3650, Math.max(1, parseInt(e.target.value, 10) || 1)),
                              }
                            : p,
                        )
                      }
                      className="w-28 rounded-md border border-input bg-background px-2 py-1.5 text-sm"
                    />
                  </div>
                </div>
                <label className="flex cursor-pointer items-center gap-2">
                  <input
                    type="checkbox"
                    checked={penaltyForm.reset_strikes_on_ban}
                    onChange={(e) =>
                      setPenaltyForm((p) => (p ? { ...p, reset_strikes_on_ban: e.target.checked } : p))
                    }
                  />
                  Yasak verilince strike sayacını sıfırla
                </label>
                <button
                  type="button"
                  onClick={() => void handleSavePenaltyRules()}
                  disabled={penaltySaving}
                  className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                >
                  {penaltySaving ? 'Kaydediliyor…' : 'Ceza ayarlarını kaydet'}
                </button>
              </CardContent>
            </Card>
          ) : (
            <p className="text-xs text-muted-foreground">
              Ceza eşiği ve yasak süresi yalnızca süper yönetici tarafından düzenlenir (mevcut:{' '}
              {config?.penalty_rules
                ? `${config.penalty_rules.strikes_until_ban} ceza / ${config.penalty_rules.ban_duration_days} gün`
                : '—'}
              ).
            </p>
          )}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Bildirim sebepleri ve limit</CardTitle>
              <p className="text-sm text-muted-foreground">
                «Bildir» diyaloğunda görünen başlık ve kısa açıklamalar; kapalı olan sebepler listede çıkmaz. Günlük limit, aynı cihaz veya hesap için 24 saatte en fazla kaç bildirim yapılabileceğini sınırlar (spam öncesi).
              </p>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <label htmlFor="sr-daily-report-limit" className="mb-1 block text-sm font-medium">
                  Günlük bildirim limiti (aynı kullanıcı / cihaz)
                </label>
                <input
                  id="sr-daily-report-limit"
                  type="number"
                  min={1}
                  max={50}
                  value={rulesForm.daily_report_limit_per_actor}
                  onChange={(e) =>
                    setRulesForm((f) =>
                      f
                        ? {
                            ...f,
                            daily_report_limit_per_actor: Math.min(
                              50,
                              Math.max(1, parseInt(e.target.value, 10) || 1),
                            ),
                          }
                        : f,
                    )
                  }
                  className="w-full max-w-[200px] rounded-md border border-input bg-background px-3 py-2 text-sm"
                />
              </div>

              <div className="space-y-3 rounded-xl border border-border/80 bg-muted/20 p-4 dark:bg-muted/10">
                <label className="flex cursor-pointer items-center gap-2">
                  <input
                    type="checkbox"
                    checked={rulesForm.profanity_block_enabled}
                    onChange={(e) =>
                      setRulesForm((f) => (f ? { ...f, profanity_block_enabled: e.target.checked } : f))
                    }
                    className="size-4 rounded border-border"
                  />
                  <span className="text-sm font-semibold">Uygunsuz dil / küfür / nefret söylemi öncesi engel</span>
                </label>
                <p className="text-xs text-muted-foreground">
                  Açık ve aşağıda en az bir ifade varken: yorum metni, soru, cevap ve bildirim notu bu ifadelerden birini
                  içerirse gönderim sunucuda reddedilir (Türkçe büyük/küçük harf duyarsız alt dizi eşleşmesi).
                </p>
                <div>
                  <label htmlFor="sr-blocked-terms" className="mb-1 block text-xs font-medium text-muted-foreground">
                    Engellenecek ifadeler (satır veya virgülle; 2–80 karakter, en çok 300)
                  </label>
                  <textarea
                    id="sr-blocked-terms"
                    rows={8}
                    value={rulesForm.blocked_terms.join('\n')}
                    onChange={(e) => {
                      const parts = e.target.value
                        .split(/[\n,]+/)
                        .map((s) => s.trim())
                        .filter((s) => s.length >= 2)
                        .map((s) => s.slice(0, 80));
                      const uniq: string[] = [];
                      const seen = new Set<string>();
                      for (const p of parts) {
                        const k = p.toLocaleLowerCase('tr-TR');
                        if (seen.has(k)) continue;
                        seen.add(k);
                        uniq.push(p);
                        if (uniq.length >= 300) break;
                      }
                      setRulesForm((f) => (f ? { ...f, blocked_terms: uniq } : f));
                    }}
                    className="min-h-[120px] w-full rounded-md border border-input bg-background px-3 py-2 font-mono text-sm"
                    placeholder="Her satıra bir ifade (liste yöneticiye özeldir)"
                  />
                </div>
              </div>

              {(['spam', 'uygunsuz', 'yanlis_bilgi', 'diger'] as const).map((key) => (
                <div
                  key={key}
                  className="space-y-3 rounded-xl border border-border/80 bg-muted/20 p-4 dark:bg-muted/10"
                >
                  <label className="flex cursor-pointer items-center gap-2">
                    <input
                      type="checkbox"
                      checked={rulesForm.reasons[key].enabled}
                      onChange={(e) =>
                        setRulesForm((f) =>
                          f
                            ? {
                                ...f,
                                reasons: {
                                  ...f.reasons,
                                  [key]: { ...f.reasons[key], enabled: e.target.checked },
                                },
                              }
                            : f,
                        )
                      }
                      className="size-4 rounded border-border"
                    />
                    <span className="text-sm font-semibold capitalize text-foreground">{key}</span>
                  </label>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <label className="mb-1 block text-xs font-medium text-muted-foreground">Başlık</label>
                      <input
                        type="text"
                        value={rulesForm.reasons[key].label}
                        onChange={(e) =>
                          setRulesForm((f) =>
                            f
                              ? {
                                  ...f,
                                  reasons: {
                                    ...f.reasons,
                                    [key]: { ...f.reasons[key], label: e.target.value },
                                  },
                                }
                              : f,
                          )
                        }
                        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                        maxLength={200}
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-muted-foreground">Kısa açıklama</label>
                      <input
                        type="text"
                        value={rulesForm.reasons[key].hint}
                        onChange={(e) =>
                          setRulesForm((f) =>
                            f
                              ? {
                                  ...f,
                                  reasons: {
                                    ...f.reasons,
                                    [key]: { ...f.reasons[key], hint: e.target.value },
                                  },
                                }
                              : f,
                          )
                        }
                        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                        maxLength={400}
                      />
                    </div>
                  </div>
                </div>
              ))}
              <button
                type="button"
                onClick={() => void handleSaveRules()}
                disabled={rulesSaving}
                className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                {rulesSaving ? 'Kaydediliyor…' : 'Kuralları kaydet'}
              </button>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
