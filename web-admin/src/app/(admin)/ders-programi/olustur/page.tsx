'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  FileSpreadsheet,
  Trash2,
  Download,
  CheckCircle2,
  AlertTriangle,
  Info,
  ExternalLink,
  Send,
  Calendar,
  Sparkles,
  Users,
  GraduationCap,
} from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { apiFetch, getApiUrl, ApiError } from '@/lib/api';
import { COOKIE_SESSION_TOKEN } from '@/lib/auth-session';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { TeacherProgramCreateForm } from '@/components/ders-programi/teacher-program-create-form';
import { DersProgramiSubpageIntro } from '@/components/ders-programi/ders-programi-subpage-intro';
import { TimetableClassGrid } from '@/components/ders-programi/timetable-class-grid';

type TimetableEntry = {
  user_id: string | null;
  teacher_name_raw?: string | null;
  day_of_week: number;
  lesson_num: number;
  class_section: string;
  subject: string;
};
type TeacherInfo = { id: string; display_name: string | null; email: string };

function getDefaultValidUntil(): string {
  const d = new Date();
  const year = d.getFullYear();
  const month = d.getMonth();
  if (month < 6) return `${year}-01-31`;
  return `${year}-06-30`;
}

export default function OlusturPage() {
  const searchParams = useSearchParams();
  const planFromQuery = searchParams.get('plan');
  const { token, me } = useAuth();
  const [uploadingTemplate, setUploadingTemplate] = useState(false);
  const [uploadingGpt, setUploadingGpt] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);
  const uploading = uploadingTemplate || uploadingGpt || savingDraft;
  const [clearing, setClearing] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [lastResult, setLastResult] = useState<{
    imported: number;
    errors: string[];
    plan_id?: string;
    preview?: boolean;
    reconcile_stats?: {
      pdf_teachers: number;
      output_rows: number;
      xls_matched: number;
      needs_review: number;
    };
  } | null>(null);
  const [entryCount, setEntryCount] = useState<number | null>(null);
  const [validFrom, setValidFrom] = useState(() => new Date().toISOString().slice(0, 10));
  const [validUntil, setValidUntil] = useState(getDefaultValidUntil);
  const [openEnded, setOpenEnded] = useState(false);
  const [planTitle, setPlanTitle] = useState('');
  const [selectedTemplateFile, setSelectedTemplateFile] = useState<File | null>(null);
  const [selectedGptPdf, setSelectedGptPdf] = useState<File | null>(null);
  const [selectedGptXls, setSelectedGptXls] = useState<File | null>(null);
  const [draftEntries, setDraftEntries] = useState<TimetableEntry[]>([]);
  const [teachers, setTeachers] = useState<TeacherInfo[]>([]);
  const [previewViewMode, setPreviewViewMode] = useState<'teacher' | 'class'>('teacher');
  const templateInputRef = useRef<HTMLInputElement>(null);
  const gptPdfInputRef = useRef<HTMLInputElement>(null);
  const gptXlsInputRef = useRef<HTMLInputElement>(null);
  /** Okul / MEB Crystal yalnız Pzt–Cum; Cmt–Paz sütunu veri kaydırması yaratıyordu. */
  const DAYS = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum'] as const;

  const isAdmin = me?.role === 'school_admin';

  useEffect(() => {
    if (!token || !isAdmin) return;
    const id = planFromQuery ?? lastResult?.plan_id ?? null;
    if (!id) return;
    let cancelled = false;
    (async () => {
      try {
        const p = await apiFetch<{
          id: string;
          status: string;
          valid_from: string;
          valid_until: string | null;
          entries: unknown[];
          name: string | null;
        }>(`/teacher-timetable/plans/${id}`, { token });
        if (cancelled || p.status !== 'draft') return;
        setPlanTitle(p.name ?? '');
        setDraftEntries(Array.isArray(p.entries) ? (p.entries as TimetableEntry[]) : []);
        if (planFromQuery && planFromQuery === id) {
          setLastResult({
            imported: Array.isArray(p.entries) ? p.entries.length : 0,
            errors: [],
            plan_id: p.id,
          });
          setValidFrom(p.valid_from.slice(0, 10));
          setOpenEnded(!p.valid_until);
          setValidUntil(p.valid_until?.slice(0, 10) ?? getDefaultValidUntil());
        }
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token, isAdmin, planFromQuery, lastResult?.plan_id]);

  useEffect(() => {
    if (!token || !isAdmin) return;
    apiFetch<TeacherInfo[]>('/duty/teachers?includeExempt=true', { token })
      .then((rows) => setTeachers(Array.isArray(rows) ? rows : []))
      .catch(() => setTeachers([]));
  }, [token, isAdmin]);

  const persistDraftPlanName = async () => {
    const planId = lastResult?.plan_id ?? planFromQuery ?? null;
    if (!token || !planId) return;
    try {
      await apiFetch(`/teacher-timetable/plans/${planId}`, {
        token,
        method: 'PATCH',
        body: JSON.stringify({ name: planTitle.trim() || null }),
        headers: { 'Content-Type': 'application/json' },
      });
    } catch {
      /* sessiz */
    }
  };

  const showUploadResultToast = (res: { imported: number; errors: string[] }) => {
    const hasErrors = (res.errors?.length ?? 0) > 0;
    const title = hasErrors ? 'Yükleme tamamlandı (uyarı var)' : 'Yükleme başarılı';
    const subtitle = hasErrors
      ? `${res.imported} kayıt aktarıldı, ${res.errors.length} uyarı var.`
      : `${res.imported} kayıt taslağa aktarıldı.`;
    toast.custom(
      () => (
        <div
          className={cn(
            'w-[min(92vw,420px)] rounded-2xl border p-3 shadow-lg backdrop-blur',
            hasErrors
              ? 'border-amber-300/70 bg-linear-to-br from-amber-50 to-white dark:border-amber-800 dark:from-amber-950/40 dark:to-background'
              : 'border-emerald-300/70 bg-linear-to-br from-emerald-50 to-white dark:border-emerald-800 dark:from-emerald-950/40 dark:to-background',
          )}
        >
          <div className="flex items-start gap-2.5">
            <div
              className={cn(
                'mt-0.5 inline-flex size-8 shrink-0 items-center justify-center rounded-xl',
                hasErrors ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300' : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
              )}
            >
              {hasErrors ? <AlertTriangle className="size-4.5" /> : <CheckCircle2 className="size-4.5" />}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold leading-5">{title}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>
            </div>
          </div>
        </div>
      ),
      { duration: hasErrors ? 7000 : 4500 },
    );
  };

  useEffect(() => {
    if (!token || !isAdmin) return;
    apiFetch<TimetableEntry[]>('/teacher-timetable', { token })
      .then((data) => setEntryCount(Array.isArray(data) ? data.length : 0))
      .catch(() => setEntryCount(0));
  }, [token, isAdmin]);

  const handleDownloadExample = async () => {
    if (!token) return;
    try {
      const headers: Record<string, string> = {};
      if (token !== COOKIE_SESSION_TOKEN) headers.Authorization = `Bearer ${token}`;
      const res = await fetch(getApiUrl('/teacher-timetable/example-template'), {
        credentials: 'include',
        ...(Object.keys(headers).length > 0 && { headers }),
      });
      if (!res.ok) throw new Error('İndirme başarısız.');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'ogretmen-ders-programi-ornek.xlsx';
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Örnek Excel indirildi.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'İndirme başarısız.');
    }
  };

  const handleTemplateFilePick = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSelectedTemplateFile(e.target.files?.[0] ?? null);
  };

  const handleGptPdfPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSelectedGptPdf(e.target.files?.[0] ?? null);
  };

  const handleGptXlsPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSelectedGptXls(e.target.files?.[0] ?? null);
  };

  const getUploadErrorMessage = (error: unknown): string => {
    if (!(error instanceof Error)) return 'Yükleme başarısız.';
    const apiErr = error as ApiError;
    switch (apiErr.code) {
      case 'OPENAI_NOT_CONFIGURED':
        return 'OpenAI anahtarı yok; Optik ayarlarından veya sunucu .env’den API key girin.';
      case 'PDF_GPT_DISABLED':
        return 'GPT yüklemesi kapalı; şablon Excel kullanın veya süperadmin ayarlarını açın.';
      case 'PDF_LOW_CONFIDENCE':
        return apiErr.message || 'PDF güven skoru düşük; şablon Excel deneyin.';
      case 'GPT_TEXT_TOO_SHORT':
        return 'PDF/Excel metni çok kısa; daha net bir dosya yükleyin.';
      case 'PDF_PARSE_FAILED':
        return 'PDF okunamadı; dosyayı yeniden indirip tekrar deneyin.';
      case 'GPT_TIMETABLE_PARSE_FAILED':
        return 'GPT çıktısı tabloya dönüştürülemedi; daha iyi formatlı bir dosya kullanın.';
      case 'OPENAI_TIMETABLE_FAILED':
        return apiErr.message || 'OpenAI çağrısı başarısız oldu; parametreleri ve kota durumunu kontrol edin.';
      case 'PDF_USE_GPT_MODE':
        return 'PDF yüklemek için “e-Okul / GPT ile yükle” bölümünü kullanın.';
      case 'INVALID_FILE_TYPE':
        return 'Dosya türü uygun değil; şablon Excel için .xlsx/.xls, GPT için .pdf/.xlsx/.xls seçin.';
      case 'GPT_RECONCILE_FILES_REQUIRED':
      case 'GPT_RECONCILE_REQUIRES_PAIR':
        return apiErr.message || 'e-Okul PDF (öğretmen) ve Excel (kurumsal program) birlikte yükleyin.';
      default:
        return apiErr.message || 'Yükleme başarısız.';
    }
  };

  const runUpload = async (file: File, mode: 'template' | 'gpt') => {
    if (!token) return;
    const setBusy = mode === 'template' ? setUploadingTemplate : setUploadingGpt;
    setBusy(true);
    setLastResult(null);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('mode', mode);
      const q = mode === 'gpt' ? '?mode=gpt&preview=1' : '?preview=1';
      const res = await apiFetch<{
        imported: number;
        errors: string[];
        plan_id?: string;
        preview?: boolean;
        entries?: TimetableEntry[];
      }>(`/teacher-timetable/upload${q}`, {
        token,
        method: 'POST',
        body: formData,
        headers: {},
      });
      setLastResult(res);
      if (res.preview && Array.isArray(res.entries)) {
        setDraftEntries(res.entries);
        toast.success(`${res.imported} ders satırı önizlemeye alındı. Taslağa kaydet ile kalıcı kayıt yapın.`);
      } else if (res.plan_id) {
        const plan = await apiFetch<{ entries: TimetableEntry[] }>(`/teacher-timetable/plans/${res.plan_id}`, { token });
        setDraftEntries(Array.isArray(plan.entries) ? plan.entries : []);
        setValidFrom(new Date().toISOString().slice(0, 10));
        setValidUntil(getDefaultValidUntil());
        setOpenEnded(false);
        showUploadResultToast(res);
      }
    } catch (err) {
      toast.error(getUploadErrorMessage(err));
      setLastResult(null);
    } finally {
      setBusy(false);
      if (mode === 'template') {
        setSelectedTemplateFile(null);
        if (templateInputRef.current) templateInputRef.current.value = '';
      }
    }
  };

  const savePreviewToDraft = async () => {
    if (!token || draftEntries.length === 0) {
      toast.error('Kaydedilecek önizleme verisi yok.');
      return;
    }
    setSavingDraft(true);
    try {
      const res = await apiFetch<{ imported: number; errors: string[]; plan_id: string }>(
        '/teacher-timetable/plans/draft-from-entries',
        {
          token,
          method: 'POST',
          body: JSON.stringify({
            entries: draftEntries,
            errors: lastResult?.errors ?? [],
          }),
          headers: { 'Content-Type': 'application/json' },
        },
      );
      setLastResult({ imported: res.imported, errors: res.errors, plan_id: res.plan_id, preview: false });
      setValidFrom(new Date().toISOString().slice(0, 10));
      setValidUntil(getDefaultValidUntil());
      setOpenEnded(false);
      showUploadResultToast(res);
      toast.success('Taslak kaydedildi.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Taslak kaydedilemedi.');
    } finally {
      setSavingDraft(false);
    }
  };

  const handleUploadTemplate = async () => {
    const file = selectedTemplateFile;
    if (!file || !token) return;
    const ext = file.name.toLowerCase().split('.').pop();
    if (ext !== 'xlsx' && ext !== 'xls') {
      toast.error('Şablon yüklemesi yalnızca .xlsx veya .xls kabul eder.');
      return;
    }
    await runUpload(file, 'template');
  };

  const runGptReconcile = async () => {
    const pdf = selectedGptPdf;
    const xls = selectedGptXls;
    if (!pdf || !xls || !token) {
      toast.error('PDF (öğretmen programı) ve Excel (kurumsal tablo) dosyalarını seçin.');
      return;
    }
    if (!pdf.name.toLowerCase().endsWith('.pdf')) {
      toast.error('Öğretmen dosyası PDF olmalı.');
      return;
    }
    const xlsExt = xls.name.toLowerCase().split('.').pop();
    if (xlsExt !== 'xlsx' && xlsExt !== 'xls') {
      toast.error('Kurumsal program dosyası .xlsx veya .xls olmalı.');
      return;
    }
    setUploadingGpt(true);
    setLastResult(null);
    try {
      const formData = new FormData();
      formData.append('file_pdf', pdf);
      formData.append('file_xls', xls);
      const res = await apiFetch<{
        imported: number;
        errors: string[];
        plan_id?: string;
        preview?: boolean;
        entries?: TimetableEntry[];
        reconcile_stats?: {
          pdf_teachers: number;
          output_rows: number;
          xls_matched: number;
          needs_review: number;
        };
      }>('/teacher-timetable/upload-gpt-reconcile?preview=1', {
        token,
        method: 'POST',
        body: formData,
        headers: {},
      });
      setLastResult(res);
      if (res.preview && Array.isArray(res.entries)) {
        setDraftEntries(res.entries);
        toast.success(`${res.imported} ders satırı önizlemeye alındı. Taslağa kaydet ile kalıcı kayıt yapın.`);
      }
    } catch (err) {
      toast.error(getUploadErrorMessage(err));
      setLastResult(null);
    } finally {
      setUploadingGpt(false);
    }
  };

  const handlePublish = async () => {
    const planId = lastResult?.plan_id ?? planFromQuery ?? null;
    if (!token || !planId) return;
    if (!openEnded && (!validUntil?.trim() || validFrom > validUntil)) {
      toast.error(!validUntil?.trim() ? 'Bitiş tarihi girin veya açık uçlu seçin.' : 'Bitiş tarihi başlangıçtan önce olamaz.');
      return;
    }
    setPublishing(true);
    try {
      await apiFetch(`/teacher-timetable/plans/${planId}`, {
        token,
        method: 'PATCH',
        body: JSON.stringify({ name: planTitle.trim() || null }),
        headers: { 'Content-Type': 'application/json' },
      });
      await apiFetch(`/teacher-timetable/plans/${planId}/publish`, {
        token,
        method: 'POST',
        body: JSON.stringify({
          valid_from: validFrom,
          valid_until: openEnded ? null : validUntil,
        }),
        headers: { 'Content-Type': 'application/json' },
      });
      toast.success('Ders programı yayınlandı. Öğretmenlere bildirim gönderildi.');
      setLastResult(null);
      setPlanTitle('');
      const data = await apiFetch<TimetableEntry[]>('/teacher-timetable', { token });
      setEntryCount(Array.isArray(data) ? data.length : 0);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Yayınlama başarısız.';
      toast.error(msg);
    } finally {
      setPublishing(false);
    }
  };

  const handleClear = async () => {
    if (!token) return;
    setClearing(true);
    try {
      await apiFetch('/teacher-timetable', { token, method: 'DELETE' });
      setLastResult(null);
      setPlanTitle('');
      setSelectedTemplateFile(null);
      setSelectedGptPdf(null);
      setSelectedGptXls(null);
      if (templateInputRef.current) templateInputRef.current.value = '';
      if (gptPdfInputRef.current) gptPdfInputRef.current.value = '';
      if (gptXlsInputRef.current) gptXlsInputRef.current.value = '';
      setDraftEntries([]);
      setEntryCount(0);
      toast.success('Ders programı ve taslaklar temizlendi.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Temizleme başarısız.');
    } finally {
      setClearing(false);
    }
  };

  if (!isAdmin) {
    return (
      <TeacherProgramCreateForm token={token} />
    );
  }

  const teacherMap = new Map(teachers.map((t) => [t.id, t]));
  const teacherNameFromKey = (teacherKey: string) => {
    if (teacherKey.startsWith('raw:')) {
      try {
        return decodeURIComponent(teacherKey.slice(4)).trim() || 'Eşleşmeyen (şablondaki adı kontrol edin)';
      } catch {
        return 'Eşleşmeyen';
      }
    }
    const t = teacherMap.get(teacherKey);
    return t?.display_name || t?.email || teacherKey;
  };

  const previewTeachers = [...new Set(draftEntries.map((e) => (e.user_id ? e.user_id : `raw:${encodeURIComponent((e.teacher_name_raw ?? '').trim())}`)))]
    .filter(Boolean)
    .sort((a, b) => teacherNameFromKey(a).localeCompare(teacherNameFromKey(b), 'tr'));
  const previewCellMap = new Map<string, Array<{ class_section: string; subject: string }>>();
  for (const e of draftEntries) {
    const teacherKey = e.user_id ? e.user_id : `raw:${encodeURIComponent((e.teacher_name_raw ?? '').trim())}`;
    const key = `${teacherKey}|${e.day_of_week}|${e.lesson_num}`;
    if (!previewCellMap.has(key)) previewCellMap.set(key, []);
    previewCellMap.get(key)!.push({ class_section: e.class_section, subject: e.subject });
  }

  const previewMaxLesson = Math.max(6, ...draftEntries.map((e) => e.lesson_num || 0), 0);
  const previewLessonNums = Array.from({ length: previewMaxLesson }, (_, i) => i + 1);

  const draftPlanId = lastResult?.plan_id ?? planFromQuery ?? null;
  const hasDraftContent = draftEntries.length > 0;
  const isPreviewOnly = !!(lastResult?.preview && !draftPlanId);
  const flowStep: 1 | 2 | 3 = !hasDraftContent ? 1 : !draftPlanId ? 2 : 3;
  const canClearAll = (entryCount !== null && entryCount > 0) || !!draftPlanId || hasDraftContent;

  return (
    <div className="mx-auto w-full max-w-6xl space-y-4 sm:space-y-6">
      <DersProgramiSubpageIntro
        title="Program yükle"
        subtitle="Dosya yükle → taslağı kontrol et → geçerlilik tarihiyle yayınla"
        accent="emerald"
      />

      <ol className="grid gap-2 sm:grid-cols-3">
        {(
          [
            { n: 1 as const, label: 'Dosya yükle', hint: 'Şablon veya e-Okul' },
            { n: 2 as const, label: 'Taslağı kontrol et', hint: 'Tablo ve uyarılar' },
            { n: 3 as const, label: 'Yayınla', hint: 'Öğretmenlere açılır' },
          ] as const
        ).map(({ n, label, hint }) => (
          <li
            key={n}
            className={cn(
              'rounded-xl border px-3 py-2.5',
              flowStep === n
                ? 'border-primary/40 bg-primary/5 ring-1 ring-primary/20'
                : flowStep > n
                  ? 'border-emerald-200/60 bg-emerald-500/5 dark:border-emerald-900/40'
                  : 'border-border/80 bg-muted/20',
            )}
          >
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  'flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-bold',
                  flowStep >= n ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground',
                )}
              >
                {flowStep > n ? '✓' : n}
              </span>
              <div className="min-w-0">
                <p className="text-sm font-semibold leading-tight">{label}</p>
                <p className="text-[11px] text-muted-foreground">{hint}</p>
              </div>
            </div>
          </li>
        ))}
      </ol>

      <p className="text-sm font-medium text-muted-foreground">1. Dosya yükle</p>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <FileSpreadsheet className="size-5" />
            Şablon ile yükle
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-xs text-muted-foreground">
            Kurallı şablon: <code className="rounded bg-muted px-1">DersProgram</code> sayfası,{' '}
            <code className="rounded bg-muted px-1">Ad_Soyad</code> ve günlük ders sütunları. Önce önizleyin; onayladıktan sonra taslağa kaydedin.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button onClick={handleDownloadExample} variant="outline" size="sm" className="gap-2" disabled={uploading}>
              <Download className="size-4" />
              Örnek indir
            </Button>
            <input
              ref={templateInputRef}
              type="file"
              accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
              title="Şablon .xlsx veya .xls"
              className="sr-only"
              onChange={handleTemplateFilePick}
              disabled={uploading}
            />
            <Button variant="outline" size="sm" onClick={() => templateInputRef.current?.click()} disabled={uploading}>
              Dosya seç
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => void handleUploadTemplate()}
              disabled={uploading || !selectedTemplateFile}
            >
              {uploadingTemplate ? 'İşleniyor…' : 'Önizle'}
            </Button>
            {selectedTemplateFile ? (
              <span className="self-center text-xs text-muted-foreground">{selectedTemplateFile.name}</span>
            ) : null}
          </div>
        </CardContent>
      </Card>

      <Card className="border-violet-200/50 dark:border-violet-900/40">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Sparkles className="size-5 text-violet-600 dark:text-violet-400" />
            e-Okul ile yükle
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-xs text-muted-foreground">
            Öğretmen PDF + kurumsal Excel birlikte işlenir. Önce önizleyin; onayladıktan sonra taslağa kaydedin.
          </p>
          <div className="flex flex-wrap gap-2">
            <input
              ref={gptPdfInputRef}
              type="file"
              accept=".pdf,application/pdf"
              className="sr-only"
              onChange={handleGptPdfPick}
              disabled={uploading}
            />
            <input
              ref={gptXlsInputRef}
              type="file"
              accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
              className="sr-only"
              onChange={handleGptXlsPick}
              disabled={uploading}
            />
            <Button variant="outline" size="sm" onClick={() => gptPdfInputRef.current?.click()} disabled={uploading}>
              PDF seç
            </Button>
            <Button variant="outline" size="sm" onClick={() => gptXlsInputRef.current?.click()} disabled={uploading}>
              Excel seç
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => void runGptReconcile()}
              disabled={uploading || !selectedGptPdf || !selectedGptXls}
            >
              {uploadingGpt ? 'İşleniyor…' : 'Önizle'}
            </Button>
          </div>
          {(selectedGptPdf || selectedGptXls) && (
            <p className="text-xs text-muted-foreground">
              {selectedGptPdf ? `PDF: ${selectedGptPdf.name}` : ''}
              {selectedGptPdf && selectedGptXls ? ' · ' : ''}
              {selectedGptXls ? `Excel: ${selectedGptXls.name}` : ''}
            </p>
          )}
        </CardContent>
      </Card>

      {hasDraftContent && (
        <Card>
          <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <CardTitle className="text-base">2. Taslağı kontrol et</CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">
                {draftEntries.length} ders satırı
                {isPreviewOnly ? ' · henüz kaydedilmedi' : draftPlanId ? ' · taslak kayıtlı' : ''}
              </p>
            </div>
            {isPreviewOnly && (
              <Button
                size="sm"
                className="shrink-0 gap-2"
                onClick={() => void savePreviewToDraft()}
                disabled={uploading || draftEntries.length === 0}
              >
                <Send className="size-4" />
                {savingDraft ? 'Kaydediliyor…' : 'Taslağa kaydet'}
              </Button>
            )}
          </CardHeader>
          <CardContent className="space-y-4">
            {lastResult && (
              <div
                className={cn(
                  'rounded-lg border p-3 text-sm',
                  lastResult.errors?.length > 0
                    ? 'border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/20'
                    : 'border-emerald-200 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/20',
                )}
              >
                <p
                  className={cn(
                    'flex items-center gap-1.5 font-semibold',
                    lastResult.errors?.length > 0 ? 'text-amber-800 dark:text-amber-200' : 'text-emerald-800 dark:text-emerald-200',
                  )}
                >
                  {lastResult.errors?.length > 0 ? <AlertTriangle className="size-4" /> : <CheckCircle2 className="size-4" />}
                  {lastResult.preview
                    ? `${lastResult.imported} satır önizlemede`
                    : `${lastResult.imported} satır taslağa aktarıldı`}
                  {lastResult.reconcile_stats ? (
                    <span className="font-normal text-muted-foreground">
                      {' '}
                      · PDF {lastResult.reconcile_stats.pdf_teachers} öğretmen
                    </span>
                  ) : null}
                </p>
                {lastResult.errors?.length > 0 && (
                  <ul className="mt-2 max-h-40 list-inside list-disc space-y-0.5 overflow-auto text-xs text-amber-700 dark:text-amber-300">
                    {lastResult.errors.map((err, i) => (
                      <li key={i}>{err}</li>
                    ))}
                  </ul>
                )}
              </div>
            )}
            <div
              role="tablist"
              aria-label="Önizleme görünümü"
              className="flex flex-wrap gap-1 rounded-xl border border-border/80 bg-muted/40 p-1"
            >
              <button
                type="button"
                role="tab"
                aria-selected={previewViewMode === 'teacher'}
                onClick={() => setPreviewViewMode('teacher')}
                className={cn(
                  'inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-semibold transition-all',
                  previewViewMode === 'teacher'
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-muted-foreground hover:bg-background',
                )}
              >
                <Users className="size-4" />
                Öğretmen
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={previewViewMode === 'class'}
                onClick={() => setPreviewViewMode('class')}
                className={cn(
                  'inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-semibold transition-all',
                  previewViewMode === 'class'
                    ? 'bg-orange-600 text-white shadow-sm dark:bg-orange-500'
                    : 'text-muted-foreground hover:bg-background',
                )}
              >
                <GraduationCap className="size-4" />
                Sınıf
              </button>
            </div>
            {previewViewMode === 'class' ? (
              <TimetableClassGrid entries={draftEntries} teachers={teachers} lessonNums={previewLessonNums} compact />
            ) : (
            <table className="w-full min-w-[860px] text-xs">
                  <thead>
                    <tr className="border-b text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                      <th className="py-1.5 pr-2">Öğretmen</th>
                      <th className="py-1.5 pr-2">Saat</th>
                      {DAYS.map((d) => (
                        <th key={d} className="py-1.5 pr-2 text-center">{d}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {previewTeachers.flatMap((teacherKey) => {
                      const maxL = Math.max(
                        1,
                        draftEntries
                          .filter(
                            (e) =>
                              (e.user_id ? e.user_id : `raw:${encodeURIComponent((e.teacher_name_raw ?? '').trim())}`) ===
                              teacherKey,
                          )
                          .reduce((m, e) => Math.max(m, e.lesson_num || 0), 0),
                      );
                      return Array.from({ length: maxL }, (_, i) => i + 1).map((lessonNum, idx) => (
                        <tr
                          key={`${teacherKey}-${lessonNum}`}
                          className={cn(
                            'border-b border-border/60',
                            idx === 0 && 'border-t-2 border-t-primary/35 bg-primary/5',
                          )}
                        >
                          <td className="py-1.5 pr-2 align-top">
                            {idx === 0 ? (
                              <span
                                className={cn(
                                  'inline-flex max-w-[min(260px,80vw)] rounded px-1.5 py-0.5 text-[11px] font-semibold leading-snug',
                                  teacherKey.startsWith('raw:')
                                    ? 'border border-amber-500/40 bg-amber-500/10 text-amber-950 dark:border-amber-700/50 dark:bg-amber-950/35 dark:text-amber-50'
                                    : 'bg-primary/10 text-primary',
                                )}
                              >
                                {teacherNameFromKey(teacherKey)}
                              </span>
                            ) : (
                              <span className="text-[10px] text-muted-foreground"> </span>
                            )}
                          </td>
                          <td className="py-1.5 pr-2 tabular-nums text-[11px]">{lessonNum}</td>
                          {[1, 2, 3, 4, 5].map((day) => {
                            const rawItems = previewCellMap.get(`${teacherKey}|${day}|${lessonNum}`) ?? [];
                            const seen = new Set<string>();
                            const items = rawItems.filter((x) => {
                              const k = `${x.class_section}\t${x.subject}`;
                              if (seen.has(k)) return false;
                              seen.add(k);
                              return true;
                            });
                            return (
                              <td key={`${teacherKey}-${day}-${lessonNum}`} className="py-1.5 pr-2 align-top">
                                {items.length === 0 ? (
                                  <span className="text-[10px] text-muted-foreground">—</span>
                                ) : (
                                  <div className="space-y-0.5">
                                    {items.map((x, i2) => (
                                      <div key={i2} className="rounded border bg-muted/30 px-1.5 py-0.5 text-[10px] leading-tight">
                                        {x.class_section} · {x.subject}
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      ));
                    })}
                  </tbody>
                </table>
            )}
          </CardContent>
        </Card>
      )}

      {draftPlanId && (
        <Card className="border-primary/30 bg-linear-to-br from-primary/5 to-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Calendar className="size-5 text-primary" />
              3. Yayınla
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Geçerlilik tarihini belirleyin. Çakışan eski yayınlar arşivlenir; öğretmenlere bildirim gider.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid max-w-2xl gap-4 sm:grid-cols-2">
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="draft-plan-title">Program adı</Label>
                <Input
                  id="draft-plan-title"
                  type="text"
                  value={planTitle}
                  onChange={(e) => setPlanTitle(e.target.value)}
                  onBlur={() => void persistDraftPlanName()}
                  placeholder="Örn. 2025–2026 Bahar"
                  maxLength={128}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="valid-from">Başlangıç</Label>
                <Input id="valid-from" type="date" value={validFrom} onChange={(e) => setValidFrom(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="open-ended" className="flex cursor-pointer items-center gap-2">
                  <input
                    id="open-ended"
                    type="checkbox"
                    checked={openEnded}
                    onChange={(e) => setOpenEnded(e.target.checked)}
                    className="rounded border-border"
                  />
                  Açık uçlu (bitiş yok)
                </Label>
                {!openEnded && (
                  <>
                    <Label htmlFor="valid-until">Bitiş</Label>
                    <Input id="valid-until" type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} />
                  </>
                )}
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button onClick={handlePublish} disabled={publishing} className="gap-2">
                <Send className="size-4" />
                {publishing ? 'Yayınlanıyor…' : 'Yayınla'}
              </Button>
              <Button variant="outline" size="sm" asChild>
                <Link href="/ders-programi/programlarim">Programlarım</Link>
              </Button>
              <Button variant="outline" size="sm" asChild>
                <Link href="/ders-programi/programlarim?tab=drafts">Taslaklar</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {canClearAll && (
        <div className="flex justify-end">
          <Button
            variant="ghost"
            size="sm"
            className="text-destructive hover:bg-destructive/10 hover:text-destructive"
            onClick={handleClear}
            disabled={clearing || uploading}
          >
            <Trash2 className="size-4" />
            {clearing ? 'Temizleniyor…' : 'Tüm taslakları ve yayını temizle'}
          </Button>
        </div>
      )}

      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <Info className="size-5 shrink-0 text-muted-foreground" />
            <div>
              <p className="text-sm font-medium">Ders saatleri</p>
              <p className="text-xs text-muted-foreground">
                Ders başlangıç ve bitiş saatlerini Nöbet → Ayarlar sayfasındaki &quot;Okul Varsayılan Saatleri&quot;
                bölümünden düzenleyebilirsiniz.
              </p>
              <Button variant="outline" size="sm" asChild className="mt-2">
                <Link href="/duty/yerler" className="gap-2">
                  <ExternalLink className="size-4" />
                  Nöbet Ayarlarına git
                </Link>
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
