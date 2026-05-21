'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { apiFetch } from '@/lib/api';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import {
  fetchOptikReport,
  deleteOptikScanResult,
  downloadReportPdf,
  type OptikFullReport,
  type OptikReportQuery,
} from '@/lib/optik-reports-api';
import { fetchOptikTemplates } from '@/lib/optik-api';
import type { OptikFormTemplate } from '@/lib/optik-form-templates';
import { OPTIK_EXAM_LABELS } from '@/lib/optik-form-templates';
import {
  BarChart3,
  CalendarRange,
  ChevronRight,
  GraduationCap,
  Home,
  ListChecks,
  PenLine,
  RefreshCw,
  ScanLine,
  FileText,
  Trash2,
  TrendingUp,
  AlertTriangle,
  BookOpen,
  Layers,
} from 'lucide-react';

function defaultFromTo() {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - 30);
  return {
    from: from.toISOString().slice(0, 10),
    to: to.toISOString().slice(0, 10),
  };
}

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  accent,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string | number;
  sub?: string;
  accent: string;
}) {
  return (
    <div
      className={cn(
        'rounded-2xl border p-3 shadow-sm',
        accent,
      )}
    >
      <div className="mb-1 flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
        <Icon className="size-3.5" />
        {label}
      </div>
      <p className="text-xl font-bold tabular-nums">{value}</p>
      {sub ? <p className="mt-0.5 text-[10px] text-muted-foreground">{sub}</p> : null}
    </div>
  );
}

function BarRow({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="space-y-0.5">
      <div className="flex justify-between text-[11px]">
        <span className="truncate font-medium">{label}</span>
        <span className="tabular-nums text-muted-foreground">{value}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-muted/50">
        <div className={cn('h-full rounded-full transition-all', color)} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export default function OptikRaporlarPage() {
  const { token, role } = useAuth();
  const searchParams = useSearchParams();
  const sessionIdFilter = searchParams.get('session_id') ?? '';
  const [range, setRange] = useState(defaultFromTo);
  const [classId, setClassId] = useState('');
  const [subjectId, setSubjectId] = useState('');
  const [templateId, setTemplateId] = useState('');
  const [kind, setKind] = useState('');
  const [report, setReport] = useState<OptikFullReport | null>(null);
  const [templates, setTemplates] = useState<OptikFormTemplate[]>([]);
  const [classes, setClasses] = useState<Array<{ id: string; name: string }>>([]);
  const [subjects, setSubjects] = useState<Array<{ id: string; name: string }>>([]);
  const [loading, setLoading] = useState(true);

  const query: OptikReportQuery = useMemo(
    () => ({
      from: range.from,
      to: range.to,
      class_id: classId || undefined,
      subject_id: subjectId || undefined,
      template_id: templateId || undefined,
      kind: kind || undefined,
      session_id: sessionIdFilter || undefined,
    }),
    [range, classId, subjectId, templateId, kind, sessionIdFilter],
  );

  const loadMeta = useCallback(async () => {
    if (!token) return;
    const [tpl, cls, sub] = await Promise.all([
      fetchOptikTemplates(token),
      apiFetch<Array<{ id: string; name: string }>>('/classes-subjects/classes', { token }).catch(() => []),
      apiFetch<Array<{ id: string; name: string }>>('/classes-subjects/subjects', { token }).catch(() => []),
    ]);
    setTemplates(tpl);
    setClasses(cls);
    setSubjects(sub);
  }, [token]);

  const exportPeriodPdf = useCallback(async () => {
    if (!token) return;
    try {
      await downloadReportPdf(token, query);
      toast.success('Dönem özeti PDF indirildi');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'PDF indirilemedi');
    }
  }, [token, query]);

  const loadReport = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const data = await fetchOptikReport(token, query);
      setReport(data);
    } catch (e) {
      setReport(null);
      toast.error(e instanceof Error ? e.message : 'Rapor yüklenemedi');
    } finally {
      setLoading(false);
    }
  }, [token, query]);

  useEffect(() => {
    void loadMeta();
  }, [loadMeta]);

  useEffect(() => {
    void loadReport();
  }, [loadReport]);

  const maxClassScans = Math.max(1, ...(report?.by_class.map((c) => c.scans) ?? [1]));
  const maxDayScans = Math.max(1, ...(report?.by_day.map((d) => d.scans) ?? [1]));

  if (role && role !== 'teacher' && role !== 'school_admin') {
    return <p className="p-4 text-sm">Bu sayfa öğretmen veya okul yöneticisi içindir.</p>;
  }

  return (
    <div className="mx-auto min-h-[100dvh] max-w-lg space-y-3 px-3 pb-24 pt-2">
      <div className="relative overflow-hidden rounded-2xl border border-indigo-500/25 bg-linear-to-br from-indigo-600 via-violet-600 to-fuchsia-600 p-4 text-white shadow-lg">
        <nav className="mb-2 flex items-center gap-1 text-[11px] text-white/75">
          <Link href="/dashboard" className="rounded-lg p-1 hover:bg-white/10">
            <Home className="size-3.5" />
          </Link>
          <ChevronRight className="size-3" />
          <Link href="/optik-okuma" className="hover:text-white">
            Okuma
          </Link>
          <ChevronRight className="size-3" />
          <span className="font-medium text-white">Raporlar</span>
        </nav>
        <div className="flex items-start justify-between">
          <div>
            <h1 className="flex items-center gap-2 text-lg font-bold">
              <BarChart3 className="size-5" />
              Optik Raporlar
            </h1>
            <p className="text-xs text-white/80">Sınıf · ders · şablon · şık dağılımı</p>
            {sessionIdFilter ? (
              <Link href={`/optik-oturumlar/${sessionIdFilter}`} className="mt-1 inline-block text-[11px] underline">
                Oturum filtresi — detay
              </Link>
            ) : null}
          </div>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="size-9 text-white hover:bg-white/15"
            onClick={() => void loadReport()}
            disabled={loading}
          >
            <RefreshCw className={cn('size-4', loading && 'animate-spin')} />
          </Button>
        </div>
        {role === 'school_admin' ? (
          <p className="mt-2 rounded-lg bg-white/10 px-2 py-1 text-[10px]">Okul geneli tüm öğretmen taramaları</p>
        ) : null}
      </div>

      <section className="rounded-2xl border bg-card p-3 shadow-sm">
        <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold">
          <CalendarRange className="size-4 text-indigo-600" />
          Filtreler
        </p>
        <div className="grid grid-cols-2 gap-2">
          <label className="text-[10px] text-muted-foreground">
            Başlangıç
            <input
              type="date"
              className="mt-0.5 w-full rounded-lg border bg-background px-2 py-1.5 text-xs"
              value={range.from}
              onChange={(e) => setRange((r) => ({ ...r, from: e.target.value }))}
            />
          </label>
          <label className="text-[10px] text-muted-foreground">
            Bitiş
            <input
              type="date"
              className="mt-0.5 w-full rounded-lg border bg-background px-2 py-1.5 text-xs"
              value={range.to}
              onChange={(e) => setRange((r) => ({ ...r, to: e.target.value }))}
            />
          </label>
        </div>
        <div className="mt-2 grid grid-cols-2 gap-2">
          <Select value={classId || '_'} onValueChange={(v) => setClassId(v === '_' ? '' : v)}>
            <SelectTrigger className="h-9 rounded-xl text-xs">
              <SelectValue placeholder="Sınıf" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="_">Tüm sınıflar</SelectItem>
              {classes.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={subjectId || '_'} onValueChange={(v) => setSubjectId(v === '_' ? '' : v)}>
            <SelectTrigger className="h-9 rounded-xl text-xs">
              <SelectValue placeholder="Ders" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="_">Tüm dersler</SelectItem>
              {subjects.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="mt-2 grid grid-cols-2 gap-2">
          <Select value={templateId || '_'} onValueChange={(v) => setTemplateId(v === '_' ? '' : v)}>
            <SelectTrigger className="h-9 rounded-xl text-xs">
              <SelectValue placeholder="Şablon" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="_">Tüm şablonlar</SelectItem>
              {templates.map((t) => (
                <SelectItem key={t.id} value={t.id}>
                  {t.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={kind || '_'} onValueChange={(v) => setKind(v === '_' ? '' : v)}>
            <SelectTrigger className="h-9 rounded-xl text-xs">
              <SelectValue placeholder="Tür" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="_">Tümü</SelectItem>
              <SelectItem value="mc">Çoktan seçmeli</SelectItem>
              <SelectItem value="open">Açık uçlu</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="mt-2 flex gap-2">
          <Button type="button" className="h-9 flex-1 rounded-xl text-xs" onClick={() => void loadReport()}>
            Uygula
          </Button>
          <Button
            type="button"
            variant="outline"
            className="h-9 rounded-xl px-3 text-xs"
            onClick={() => void exportPeriodPdf()}
            disabled={!token}
          >
            <FileText className="mr-1 size-3.5" />
            PDF
          </Button>
        </div>
      </section>

      {loading && !report ? (
        <div className="flex justify-center py-12">
          <LoadingSpinner className="size-8 text-indigo-600" />
        </div>
      ) : report ? (
        <>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            <StatCard
              icon={ScanLine}
              label="Tarama"
              value={report.summary.total_scans}
              sub={`${report.summary.mc_scans} MC · ${report.summary.open_scans} açık`}
              accent="border-fuchsia-500/20 bg-fuchsia-500/8"
            />
            <StatCard
              icon={ListChecks}
              label="Cevap"
              value={report.summary.total_answers}
              accent="border-violet-500/20 bg-violet-500/8"
            />
            <StatCard
              icon={TrendingUp}
              label="Güven"
              value={
                report.summary.avg_confidence != null
                  ? `%${Math.round(report.summary.avg_confidence * 100)}`
                  : '—'
              }
              accent="border-cyan-500/20 bg-cyan-500/8"
            />
            <StatCard
              icon={AlertTriangle}
              label="Belirsiz"
              value={report.summary.ambiguous_total}
              sub={
                report.summary.ambiguous_rate != null
                  ? `%${Math.round(report.summary.ambiguous_rate * 100)} oran`
                  : undefined
              }
              accent="border-amber-500/20 bg-amber-500/8"
            />
            {report.summary.avg_grade_pct != null ? (
              <StatCard
                icon={PenLine}
                label="Ort. puan"
                value={`%${report.summary.avg_grade_pct}`}
                accent="border-emerald-500/20 bg-emerald-500/8"
              />
            ) : null}
            {report.summary.avg_net != null ? (
              <StatCard
                icon={TrendingUp}
                label="Ort. net"
                value={report.summary.avg_net}
                sub={
                  report.summary.mc_with_net != null
                    ? `${report.summary.mc_with_net} öğrenci`
                    : undefined
                }
                accent="border-violet-500/20 bg-violet-500/10"
              />
            ) : null}
          </div>

          {report.by_day.length > 0 ? (
            <section className="rounded-2xl border bg-card p-3">
              <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold">
                <CalendarRange className="size-4 text-indigo-600" />
                Günlük tarama
              </h2>
              <div className="space-y-2">
                {report.by_day.map((d) => (
                  <BarRow
                    key={d.date}
                    label={new Date(`${d.date}T12:00:00`).toLocaleDateString('tr-TR', {
                      day: 'numeric',
                      month: 'short',
                    })}
                    value={d.scans}
                    max={maxDayScans}
                    color="bg-linear-to-r from-indigo-500 to-violet-500"
                  />
                ))}
              </div>
            </section>
          ) : null}

          {report.by_class.length > 0 ? (
            <section className="rounded-2xl border bg-card p-3">
              <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold">
                <GraduationCap className="size-4 text-fuchsia-600" />
                Sınıfa göre
              </h2>
              <div className="space-y-2">
                {report.by_class.map((c) => (
                  <BarRow
                    key={c.class_id ?? c.class_name}
                    label={c.class_name}
                    value={c.scans}
                    max={maxClassScans}
                    color="bg-fuchsia-500"
                  />
                ))}
              </div>
              <div className="mt-3 overflow-x-auto">
                <table className="w-full text-left text-[10px]">
                  <thead>
                    <tr className="border-b text-muted-foreground">
                      <th className="py-1 pr-2">Sınıf</th>
                      <th className="py-1 pr-2">Tarama</th>
                      <th className="py-1 pr-2">Cevap</th>
                      <th className="py-1">Belirsiz</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.by_class.map((c) => (
                      <tr key={c.class_id ?? c.class_name} className="border-b border-border/50">
                        <td className="py-1.5 pr-2 font-medium">{c.class_name}</td>
                        <td className="py-1.5 pr-2 tabular-nums">{c.scans}</td>
                        <td className="py-1.5 pr-2 tabular-nums">{c.answers}</td>
                        <td className="py-1.5 tabular-nums">
                          {c.ambiguous}
                          {c.ambiguous_rate > 0 ? ` (${Math.round(c.ambiguous_rate * 100)}%)` : ''}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ) : null}

          {report.by_subject.length > 0 ? (
            <section className="rounded-2xl border bg-card p-3">
              <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold">
                <BookOpen className="size-4 text-cyan-600" />
                Derslere göre
              </h2>
              <div className="flex flex-wrap gap-1.5">
                {report.by_subject.map((s) => (
                  <span
                    key={s.subject_id ?? s.subject_name}
                    className="inline-flex items-center gap-1 rounded-full border border-cyan-500/25 bg-cyan-500/10 px-2.5 py-1 text-[11px] font-medium"
                  >
                    {s.subject_name}
                    <span className="rounded-full bg-cyan-600/20 px-1.5 tabular-nums">{s.scans}</span>
                  </span>
                ))}
              </div>
            </section>
          ) : null}

          {report.by_template.length > 0 ? (
            <section className="rounded-2xl border bg-card p-3">
              <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold">
                <Layers className="size-4 text-violet-600" />
                Form şablonları
              </h2>
              <ul className="space-y-1.5">
                {report.by_template.map((t) => (
                  <li
                    key={t.template_id}
                    className="flex items-center justify-between rounded-xl border px-2.5 py-2 text-xs"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-semibold">{t.template_name}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {OPTIK_EXAM_LABELS[t.exam_type ?? 'genel'] ?? t.exam_type} · {t.kind_mc} MC ·{' '}
                        {t.kind_open} açık
                      </p>
                    </div>
                    <span className="shrink-0 rounded-full bg-violet-500/15 px-2 py-0.5 font-bold tabular-nums text-violet-800 dark:text-violet-200">
                      {t.scans}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {report.choice_distribution.length > 0 ? (
            <section className="rounded-2xl border bg-card p-3">
              <h2 className="mb-2 text-sm font-semibold">Şık dağılımı (tüm taramalar)</h2>
              <div className="max-h-64 space-y-2 overflow-y-auto">
                {report.choice_distribution.slice(0, 40).map((row) => {
                  const entries = Object.entries(row.choices).sort((a, b) => b[1] - a[1]);
                  const top = entries[0];
                  return (
                    <div key={row.question} className="rounded-lg bg-muted/30 px-2 py-1.5">
                      <div className="flex justify-between text-[11px]">
                        <span className="font-bold">S{row.question}</span>
                        {top ? (
                          <span>
                            En çok <strong>{top[0]}</strong> ({top[1]}/{row.total})
                          </span>
                        ) : null}
                      </div>
                      <div className="mt-1 flex gap-1">
                        {entries.map(([lbl, n]) => (
                          <span
                            key={lbl}
                            className="rounded bg-background px-1.5 py-0.5 text-[9px] font-mono tabular-nums"
                          >
                            {lbl}:{n}
                          </span>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          ) : null}

          <section className="rounded-2xl border bg-card p-3">
            <h2 className="mb-2 text-sm font-semibold">Son taramalar</h2>
            {report.recent.length === 0 ? (
              <p className="text-xs text-muted-foreground">Kayıt yok. Optik okuma ile tarama yapın.</p>
            ) : (
              <ul className="space-y-1.5">
                {report.recent.map((r) => (
                  <li
                    key={r.id}
                    className="flex items-center gap-2 rounded-xl border px-2.5 py-2 text-xs"
                  >
                    <div
                      className={cn(
                        'flex size-8 shrink-0 items-center justify-center rounded-lg',
                        r.kind === 'mc' ? 'bg-fuchsia-500/15 text-fuchsia-700' : 'bg-cyan-500/15 text-cyan-800',
                      )}
                    >
                      {r.kind === 'mc' ? <ListChecks className="size-4" /> : <PenLine className="size-4" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold">
                        {r.student_label || r.template_name}
                      </p>
                      <p className="text-[10px] text-muted-foreground">
                        {[r.class_name, r.subject_name].filter(Boolean).join(' · ') || '—'}
                        {' · '}
                        {new Date(r.scanned_at).toLocaleString('tr-TR', {
                          day: '2-digit',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </p>
                      {r.kind === 'mc' ? (
                        <p className="text-[10px]">
                          {r.answer_count} cevap
                          {r.net_score != null ? ` · net ${r.net_score}` : ''}
                          {r.ambiguous_count > 0 ? ` · ${r.ambiguous_count} belirsiz` : ''}
                        </p>
                      ) : r.grade_score != null ? (
                        <p className="text-[10px] font-medium text-emerald-700">
                          {r.grade_score}/{r.grade_max_score}
                        </p>
                      ) : null}
                    </div>
                    {token ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-8 shrink-0"
                        onClick={async () => {
                          try {
                            await deleteOptikScanResult(token, r.id);
                            toast.success('Silindi');
                            void loadReport();
                          } catch {
                            toast.error('Silinemedi');
                          }
                        }}
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      ) : (
        <p className="py-8 text-center text-sm text-muted-foreground">Veri yok</p>
      )}

      <Link
        href="/optik-okuma"
        className="flex h-11 items-center justify-center gap-2 rounded-2xl bg-linear-to-r from-fuchsia-600 to-violet-600 text-sm font-semibold text-white shadow-lg"
      >
        <ScanLine className="size-4" />
        Yeni tarama
      </Link>
    </div>
  );
}
