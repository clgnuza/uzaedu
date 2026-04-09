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

type SchoolReviewsConfig = {
  enabled: boolean;
  rating_min: number;
  rating_max: number;
  moderation_mode: 'auto' | 'moderation';
  allow_questions: boolean;
  questions_require_moderation: boolean;
  content_rules: SchoolReviewsContentRules;
};

type ContentReportItem = {
  id: string;
  entity_type: string;
  entity_id: string;
  reason: string;
  comment: string | null;
  created_at: string;
  reporter_kind: 'registered' | 'guest';
  school_id: string | null;
  school_name: string | null;
  content_preview: string | null;
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
  const [rulesSaving, setRulesSaving] = useState(false);
  const [reportsLoading, setReportsLoading] = useState(false);
  const [reportsError, setReportsError] = useState<string | null>(null);
  const [reportsData, setReportsData] = useState<{
    total: number;
    page: number;
    limit: number;
    items: ContentReportItem[];
  } | null>(null);
  const [reportEntityFilter, setReportEntityFilter] = useState<string>('');
  const [reportReasonFilter, setReportReasonFilter] = useState<string>('');
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
        limit: '20',
      });
      if (reportEntityFilter) params.set('entity_type', reportEntityFilter);
      if (reportReasonFilter) params.set('reason', reportReasonFilter);
      const data = await apiFetch<{ total: number; page: number; limit: number; items: ContentReportItem[] }>(
        `/school-reviews/content-reports/admin?${params}`,
        { token },
      );
      setReportsData(data);
    } catch (e) {
      setReportsData(null);
      setReportsError(e instanceof Error ? e.message : 'Bildirimler yüklenemedi');
    } finally {
      setReportsLoading(false);
    }
  }, [token, me?.role, reportPage, reportEntityFilter, reportReasonFilter]);

  const fetchModeration = useCallback(async () => {
    if (!token || !canAccessSchoolReviewsSettings(me?.role)) return;
    setModLoading(true);
    setModError(null);
    try {
      const params = new URLSearchParams({ page: String(modPage), limit: '20' });
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
      await Promise.all(
        arr.map((c, i) =>
          apiFetch(`/school-reviews/criteria/${c.id}`, {
            method: 'PATCH',
            token,
            body: JSON.stringify({ sort_order: i }),
          }),
        ),
      );
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
          className="space-y-6"
        >
          <Card className="overflow-hidden border-primary/15 bg-gradient-to-br from-primary/[0.06] to-background dark:from-primary/10">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <ListChecks className="size-5 text-primary" aria-hidden />
                Onay bekleyen içerikler
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                Moderasyon veya soru/cevap moderasyonu açıkken oluşan beklemedeki kayıtlar. Onayla yayına alın; gizle yayından kaldırılır.
              </p>
            </CardHeader>
          </Card>

          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
            <div className="min-w-0 flex-1 sm:max-w-[220px]">
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
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
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
              className="rounded-lg border border-border bg-background px-4 py-2 text-sm font-medium hover:bg-muted/50 disabled:opacity-50 sm:mb-0"
            >
              Yenile
            </button>
          </div>

          {modLoading && !modData && (
            <div className="flex min-h-[160px] items-center justify-center rounded-xl border border-dashed border-border">
              <LoadingSpinner className="size-8" />
            </div>
          )}

          {modError && <Alert variant="error" message={modError} />}

          {!modLoading && modData && modData.items.length === 0 && (
            <Card>
              <CardContent className="py-12 text-center text-sm text-muted-foreground">
                Bekleyen içerik yok veya filtreye uygun kayıt bulunamadı.
              </CardContent>
            </Card>
          )}

          {modData && modData.items.length > 0 && (
            <ul className="space-y-3">
              {modData.items.map((row) => {
                const busy = modBusyKey === `${row.entity_type}:${row.id}`;
                return (
                  <li key={`${row.entity_type}-${row.id}`}>
                    <Card className="border-border/80 shadow-sm">
                      <CardContent className="space-y-3 p-4 sm:p-5">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">
                            {ENTITY_LABELS[row.entity_type] ?? row.entity_type}
                          </span>
                          <time className="text-xs tabular-nums text-muted-foreground" dateTime={row.created_at}>
                            {new Date(row.created_at).toLocaleString('tr-TR')}
                          </time>
                        </div>
                        <div className="text-sm">
                          <span className="font-medium">{row.school_name ?? '—'}</span>
                          {row.school_id && (
                            <Link
                              href={`/okul-degerlendirmeleri?id=${encodeURIComponent(row.school_id)}`}
                              className="ml-2 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                            >
                              Okul sayfası
                              <ExternalLink className="size-3" aria-hidden />
                            </Link>
                          )}
                        </div>
                        <p className="rounded-lg border border-border/60 bg-muted/30 px-3 py-2 text-sm leading-relaxed">
                          {row.content_preview || '—'}
                        </p>
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => void handleModerate(row.entity_type, row.id, 'approved')}
                            className="rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                          >
                            {busy ? '…' : 'Onayla'}
                          </button>
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => void handleModerate(row.entity_type, row.id, 'hidden')}
                            className="rounded-lg border border-destructive/50 bg-destructive/5 px-3 py-2 text-sm font-medium text-destructive hover:bg-destructive/10 disabled:opacity-50"
                          >
                            Gizle
                          </button>
                        </div>
                      </CardContent>
                    </Card>
                  </li>
                );
              })}
            </ul>
          )}

          {modData && modData.total > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
              <p className="text-sm text-muted-foreground">
                Toplam <span className="font-semibold text-foreground">{modData.total}</span> kayıt — sayfa{' '}
                {modData.page} / {Math.max(1, Math.ceil(modData.total / modData.limit))}
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={modPage <= 1 || modLoading}
                  onClick={() => setModPage((p) => Math.max(1, p - 1))}
                  className="rounded-lg border border-border px-3 py-2 text-sm disabled:opacity-40"
                >
                  Önceki
                </button>
                <button
                  type="button"
                  disabled={
                    modLoading || modPage >= Math.ceil(modData.total / modData.limit)
                  }
                  onClick={() => setModPage((p) => p + 1)}
                  className="rounded-lg border border-border px-3 py-2 text-sm disabled:opacity-40"
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
          className="space-y-6"
        >
          <Card className="overflow-hidden border-rose-500/15 bg-gradient-to-br from-rose-500/[0.06] to-background dark:from-rose-950/20">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <Flag className="size-5 text-rose-600 dark:text-rose-400" aria-hidden />
                Kullanıcı bildirimleri
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                Okul değerlendirmelerinde «Bildir» ile işaretlenen yorum, soru ve cevaplar. İnceleme için okul sayfasına gidebilirsiniz; içerik silinmişse okul bilgisi boş kalabilir.
              </p>
            </CardHeader>
          </Card>

          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
            <div className="min-w-0 flex-1 sm:max-w-[200px]">
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
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="">Tümü</option>
                <option value="review">Yorum</option>
                <option value="question">Soru</option>
                <option value="answer">Cevap</option>
              </select>
            </div>
            <div className="min-w-0 flex-1 sm:max-w-[220px]">
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
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="">Tümü</option>
                <option value="spam">Spam / tekrar</option>
                <option value="uygunsuz">Uygunsuz dil</option>
                <option value="yanlis_bilgi">Yanıltıcı bilgi</option>
                <option value="diger">Diğer</option>
              </select>
            </div>
            <button
              type="button"
              onClick={() => {
                void fetchReports();
              }}
              disabled={reportsLoading}
              className="rounded-lg border border-border bg-background px-4 py-2 text-sm font-medium hover:bg-muted/50 disabled:opacity-50 sm:mb-0"
            >
              Yenile
            </button>
          </div>

          {reportsLoading && !reportsData && (
            <div className="flex min-h-[160px] items-center justify-center rounded-xl border border-dashed border-border">
              <LoadingSpinner className="size-8" />
            </div>
          )}

          {reportsError && (
            <Alert variant="error" message={reportsError} />
          )}

          {!reportsLoading && reportsData && reportsData.items.length === 0 && (
            <Card>
              <CardContent className="py-12 text-center text-sm text-muted-foreground">
                Henüz bildirim yok veya filtreye uygun kayıt bulunamadı.
              </CardContent>
            </Card>
          )}

          {reportsData && reportsData.items.length > 0 && (
            <ul className="space-y-3">
              {reportsData.items.map((row) => (
                <li key={row.id}>
                  <Card className="border-border/80 shadow-sm transition-shadow hover:shadow-md">
                    <CardContent className="space-y-3 p-4 sm:p-5">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">
                            {ENTITY_LABELS[row.entity_type] ?? row.entity_type}
                          </span>
                          <span className="rounded-full bg-amber-500/15 px-2.5 py-0.5 text-xs font-medium text-amber-900 dark:text-amber-100">
                            {REASON_LABELS[row.reason] ?? row.reason}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {row.reporter_kind === 'registered' ? 'Giriş yapmış bildiren' : 'Misafir bildirimi'}
                          </span>
                        </div>
                        <time
                          className="shrink-0 text-xs tabular-nums text-muted-foreground"
                          dateTime={row.created_at}
                        >
                          {new Date(row.created_at).toLocaleString('tr-TR')}
                        </time>
                      </div>
                      <div className="text-sm">
                        <span className="font-medium text-foreground">
                          {row.school_name ?? '—'}
                        </span>
                        {row.school_id && (
                          <Link
                            href={`/okul-degerlendirmeleri?id=${encodeURIComponent(row.school_id)}`}
                            className="ml-2 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                          >
                            Okul sayfası
                            <ExternalLink className="size-3" aria-hidden />
                          </Link>
                        )}
                      </div>
                      {row.content_preview && (
                        <p className="rounded-lg border border-border/60 bg-muted/30 px-3 py-2 text-sm leading-relaxed text-foreground dark:bg-muted/20">
                          {row.content_preview}
                        </p>
                      )}
                      {row.comment && (
                        <p className="text-sm text-muted-foreground">
                          <span className="font-medium text-foreground">Bildiren notu: </span>
                          {row.comment}
                        </p>
                      )}
                      <p className="font-mono text-[11px] text-muted-foreground">
                        ID: {row.entity_type}/{row.entity_id}
                      </p>
                    </CardContent>
                  </Card>
                </li>
              ))}
            </ul>
          )}

          {reportsData && reportsData.total > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
              <p className="text-sm text-muted-foreground">
                Toplam <span className="font-semibold text-foreground">{reportsData.total}</span> kayıt — sayfa{' '}
                {reportsData.page} / {Math.max(1, Math.ceil(reportsData.total / reportsData.limit))}
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={reportPage <= 1 || reportsLoading}
                  onClick={() => setReportPage((p) => Math.max(1, p - 1))}
                  className="rounded-lg border border-border px-3 py-2 text-sm disabled:opacity-40"
                >
                  Önceki
                </button>
                <button
                  type="button"
                  disabled={
                    reportsLoading ||
                    reportPage >= Math.ceil(reportsData.total / reportsData.limit)
                  }
                  onClick={() => setReportPage((p) => p + 1)}
                  className="rounded-lg border border-border px-3 py-2 text-sm disabled:opacity-40"
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
