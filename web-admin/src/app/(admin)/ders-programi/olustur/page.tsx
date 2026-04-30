'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  Upload,
  FileSpreadsheet,
  FileText,
  Trash2,
  Download,
  CheckCircle2,
  AlertTriangle,
  Info,
  ExternalLink,
  Send,
  Calendar,
} from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { apiFetch, getApiUrl } from '@/lib/api';
import { COOKIE_SESSION_TOKEN } from '@/lib/auth-session';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { TeacherProgramCreateForm } from '@/components/ders-programi/teacher-program-create-form';
import { DersProgramiSubpageIntro } from '@/components/ders-programi/ders-programi-subpage-intro';

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
  const [uploading, setUploading] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [lastResult, setLastResult] = useState<{
    imported: number;
    errors: string[];
    plan_id?: string;
  } | null>(null);
  const [entryCount, setEntryCount] = useState<number | null>(null);
  const [validFrom, setValidFrom] = useState(() => new Date().toISOString().slice(0, 10));
  const [validUntil, setValidUntil] = useState(getDefaultValidUntil);
  const [openEnded, setOpenEnded] = useState(false);
  const [planTitle, setPlanTitle] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [draftEntries, setDraftEntries] = useState<TimetableEntry[]>([]);
  const [teachers, setTeachers] = useState<TeacherInfo[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const DAYS = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'] as const;

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
    const planId = lastResult?.plan_id;
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

  const handleFilePick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    setSelectedFile(file);
  };

  const handleUpload = async () => {
    const file = selectedFile;
    if (!file || !token) return;

    const ext = file.name.toLowerCase().split('.').pop();
    if (ext !== 'xlsx' && ext !== 'xls' && ext !== 'pdf') {
      toast.error('Sadece Excel (.xlsx, .xls) veya e-Okul PDF yükleyin.');
      return;
    }

    setUploading(true);
    setLastResult(null);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await apiFetch<{ imported: number; errors: string[]; plan_id?: string }>('/teacher-timetable/upload', {
        token,
        method: 'POST',
        body: formData,
        headers: {},
      });
      setLastResult(res);
      const plan = await apiFetch<{ entries: TimetableEntry[] }>(`/teacher-timetable/plans/${res.plan_id}`, { token });
      setDraftEntries(Array.isArray(plan.entries) ? plan.entries : []);
      setValidFrom(new Date().toISOString().slice(0, 10));
      setValidUntil(getDefaultValidUntil());
      setOpenEnded(false);
      showUploadResultToast(res);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Yükleme başarısız.');
      setLastResult(null);
    } finally {
      setUploading(false);
      setSelectedFile(null);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const handlePublish = async () => {
    const planId = lastResult?.plan_id;
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
      setSelectedFile(null);
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
    if (teacherKey.startsWith('raw:')) return decodeURIComponent(teacherKey.slice(4)) || 'Eşleşmeyen öğretmen';
    const t = teacherMap.get(teacherKey);
    return t?.display_name || t?.email || teacherKey;
  };
  const previewTeachers = [...new Set(draftEntries.map((e) => (e.user_id ? e.user_id : `raw:${encodeURIComponent((e.teacher_name_raw ?? '').trim())}`)))]
    .filter(Boolean)
    .sort((a, b) => teacherNameFromKey(a).localeCompare(teacherNameFromKey(b), 'tr'));
  const previewMaxLesson = draftEntries.reduce((m, e) => Math.max(m, e.lesson_num || 0), 0);
  const previewLessonNums = Array.from({ length: Math.max(previewMaxLesson, 1) }, (_, i) => i + 1);
  const previewCellMap = new Map<string, Array<{ class_section: string; subject: string }>>();
  for (const e of draftEntries) {
    const teacherKey = e.user_id ? e.user_id : `raw:${encodeURIComponent((e.teacher_name_raw ?? '').trim())}`;
    const key = `${teacherKey}|${e.day_of_week}|${e.lesson_num}`;
    if (!previewCellMap.has(key)) previewCellMap.set(key, []);
    previewCellMap.get(key)!.push({ class_section: e.class_section, subject: e.subject });
  }

  return (
    <div className="mx-auto w-full max-w-6xl space-y-4 sm:space-y-6">
      <DersProgramiSubpageIntro title="Excel / e-Okul PDF ile yükle" subtitle="Yükle → Tarih ve yayın → Programlarım" accent="emerald" />

      {/* Admin stepper */}
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-emerald-200/45 bg-emerald-500/5 px-3 py-2.5 text-xs dark:border-emerald-900/45 dark:bg-emerald-950/20 sm:gap-3 sm:px-4 sm:py-3 sm:text-sm">
        <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">
          1
        </span>
        <span className="font-medium">Dosya Yükle</span>
        <span className="text-muted-foreground">→</span>
        <span
          className={cn(
            'flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-bold',
            lastResult?.plan_id ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground',
          )}
        >
          2
        </span>
        <span className={lastResult?.plan_id ? 'font-medium' : 'text-muted-foreground'}>
          Tarih Seç ve Yayınla
        </span>
        <span className="text-muted-foreground">→</span>
        <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground text-xs font-bold">
          3
        </span>
        <span className="text-muted-foreground">Programlarım</span>
        <Link
          href="/ders-programi/programlarim"
          className="ml-auto text-primary hover:underline font-medium"
        >
          Programlara git
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <FileSpreadsheet className="size-5" />
            Excel / e-Okul PDF ile Yükle
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded-xl border border-emerald-200/70 bg-linear-to-br from-emerald-50 to-white p-4 shadow-sm dark:border-emerald-900/60 dark:from-emerald-950/30 dark:to-background">
              <p className="mb-2 flex items-center gap-2 text-sm font-semibold text-emerald-800 dark:text-emerald-200">
                <FileSpreadsheet className="size-4 shrink-0" />
                Excel ile Yükle
              </p>
              <ul className="ml-5 list-disc space-y-1 text-xs text-emerald-700 dark:text-emerald-300">
                <li>
                  <strong>Ad Soyad</strong> sütunu – sistemdeki tam ad veya e-posta
                </li>
                <li>
                  Sütun formatı:{' '}
                  <code className="rounded bg-emerald-100 px-1 text-[11px] dark:bg-emerald-900/40">Pazartesi_ders1</code>{' '}
                  …{' '}
                  <code className="rounded bg-emerald-100 px-1 text-[11px] dark:bg-emerald-900/40">Cuma_ders8</code>
                </li>
                <li>
                  Hücre değeri:{' '}
                  <code className="rounded bg-emerald-100 px-1 text-[11px] dark:bg-emerald-900/40">7A-MAT</code>
                </li>
                <li>Boş hücre = o saatte dersi yok</li>
              </ul>
            </div>
            <div className="rounded-xl border border-sky-200/70 bg-linear-to-br from-sky-50 to-white p-4 shadow-sm dark:border-sky-900/60 dark:from-sky-950/30 dark:to-background">
              <p className="mb-2 flex items-center gap-2 text-sm font-semibold text-sky-800 dark:text-sky-200">
                <FileText className="size-4 shrink-0" />
                e-Okul PDF ile Yükle
              </p>
              <ul className="ml-5 list-disc space-y-1 text-xs text-sky-700 dark:text-sky-300">
                <li>
                  Rapor adı: <strong>OOK11003R010 Öğretmen Ders Programları</strong>
                </li>
                <li>Format: .pdf</li>
                <li>Öğretmen adı sistemdeki kullanıcıyla eşleşmeli</li>
                <li>Öğretmen programı ve dersler ayrı ayrı parse edilir</li>
              </ul>
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <Button onClick={handleDownloadExample} className="gap-2">
              <Download className="size-4" />
              Örnek Excel İndir
            </Button>
            <input
              ref={inputRef}
              type="file"
              accept=".xlsx,.xls,.pdf"
              className="sr-only"
              onChange={handleFilePick}
              disabled={uploading}
            />
            <Button variant="outline" onClick={() => inputRef.current?.click()} disabled={uploading}>
              <Upload className="size-4" />
              Dosya Seç
            </Button>
            <Button variant="outline" onClick={handleUpload} disabled={uploading || !selectedFile}>
              <Send className="size-4" />
              {uploading ? 'Kaydediliyor…' : 'Taslağa Kaydet'}
            </Button>
            {selectedFile ? (
              <span className="self-center text-xs text-muted-foreground">{selectedFile.name}</span>
            ) : null}
            {(entryCount !== null && entryCount > 0) || lastResult?.plan_id ? (
              <Button
                variant="ghost"
                className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                onClick={handleClear}
                disabled={clearing}
              >
                <Trash2 className="size-4" />
                {clearing ? 'Temizleniyor…' : 'Ders Programını ve Taslakları Temizle'}
              </Button>
            ) : null}
          </div>

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
                  'font-semibold flex items-center gap-1.5',
                  lastResult.errors?.length > 0
                    ? 'text-amber-800 dark:text-amber-200'
                    : 'text-emerald-800 dark:text-emerald-200',
                )}
              >
                <CheckCircle2 className="size-4" />
                {lastResult.imported} ders girdisi taslağa aktarıldı.
                {lastResult.errors?.length > 0 && ` (${lastResult.errors.length} satır hatalı)`}
              </p>
              {lastResult.errors?.length > 0 && (
                <ul className="mt-2 max-h-80 overflow-auto list-inside list-disc text-amber-700 dark:text-amber-300 text-xs space-y-0.5 pr-1">
                  {lastResult.errors.map((err, i) => (
                    <li key={i}>{err}</li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {lastResult?.plan_id && (
        <Card className="border-primary/30 bg-linear-to-br from-primary/5 to-primary/10">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Calendar className="size-5 text-primary" />
              Taslak Önizleme – Yayınla
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Geçerlilik tarihlerini seçin ve yayınlayın. Yayınlandıktan sonra öğretmenlere bildirim gönderilir. Bu aralıkla çakışan
              eski yayınlar otomatik arşivlenir; başlangıç ≤ bitiş olmalıdır.
            </p>
            <div className="max-w-md space-y-2">
              <Label htmlFor="draft-plan-title">Program adı</Label>
              <Input
                id="draft-plan-title"
                type="text"
                value={planTitle}
                onChange={(e) => setPlanTitle(e.target.value)}
                onBlur={() => void persistDraftPlanName()}
                placeholder="Örn. 2025–2026 Bahar"
                maxLength={128}
                className="w-full"
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2 max-w-md">
              <div className="space-y-2">
                <Label htmlFor="valid-from">Başlangıç tarihi</Label>
                <Input
                  id="valid-from"
                  type="date"
                  value={validFrom}
                  onChange={(e) => setValidFrom(e.target.value)}
                  className="w-full"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="open-ended" className="flex items-center gap-2 cursor-pointer">
                  <input
                    id="open-ended"
                    type="checkbox"
                    checked={openEnded}
                    onChange={(e) => setOpenEnded(e.target.checked)}
                    className="rounded border-border"
                  />
                  Bitiş tarihi belirsiz (açık uçlu)
                </Label>
                <p className="text-xs text-muted-foreground">
                  Açık uçlu program, yeni program yayınlanana kadar geçerlidir.
                </p>
                {!openEnded && (
                  <>
                    <Label htmlFor="valid-until">Bitiş tarihi</Label>
                    <Input
                      id="valid-until"
                      type="date"
                      value={validUntil}
                      onChange={(e) => setValidUntil(e.target.value)}
                      className="w-full"
                    />
                  </>
                )}
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button onClick={handlePublish} disabled={publishing} className="gap-2">
                <Send className="size-4" />
                {publishing ? 'Yayınlanıyor…' : 'Yayınla'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {lastResult?.plan_id && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Öğretmen Programları Önizleme</CardTitle>
          </CardHeader>
          <CardContent>
            {draftEntries.length === 0 ? (
              <p className="text-sm text-muted-foreground">Önizleme için ders girdisi yok.</p>
            ) : (
              <div className="overflow-x-auto">
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
                    {previewTeachers.flatMap((teacherKey) =>
                      previewLessonNums.map((lessonNum, idx) => (
                        <tr
                          key={`${teacherKey}-${lessonNum}`}
                          className={cn(
                            'border-b border-border/60',
                            idx === 0 && 'border-t-2 border-t-primary/35 bg-primary/5',
                          )}
                        >
                          <td className="py-1.5 pr-2 align-top">
                            {idx === 0 ? (
                              <span className="inline-flex rounded bg-primary/10 px-1.5 py-0.5 text-[11px] font-semibold text-primary">
                                {teacherNameFromKey(teacherKey)}
                              </span>
                            ) : (
                              <span className="text-[10px] text-muted-foreground"> </span>
                            )}
                          </td>
                          <td className="py-1.5 pr-2 tabular-nums text-[11px]">{lessonNum}</td>
                          {[1, 2, 3, 4, 5, 6, 7].map((day) => {
                            const items = previewCellMap.get(`${teacherKey}|${day}|${lessonNum}`) ?? [];
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
                      )),
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
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
