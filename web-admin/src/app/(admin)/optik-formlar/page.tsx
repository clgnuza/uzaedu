'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/hooks/use-auth';
import { apiFetch, getApiUrl } from '@/lib/api';
import { COOKIE_SESSION_TOKEN } from '@/lib/auth-session';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { EmptyState } from '@/components/ui/empty-state';
import { ChevronRight, Download, FileText, Home, ScanLine } from 'lucide-react';
import { cn } from '@/lib/utils';

type FormTemplate = {
  id: string;
  name: string;
  slug: string;
  formType: string;
  questionCount: number;
  choiceCount: number;
  pageSize?: string;
  examType?: string;
  gradeLevel?: string | null;
  subjectHint?: string | null;
  scope?: string;
};

const EXAM_LABELS: Record<string, string> = {
  genel: 'Genel',
  yazili: 'Yazılı',
  deneme: 'Deneme',
  quiz: 'Quiz',
  karma: 'Karma',
};

const EXAM_FILTER_ORDER = ['', 'genel', 'yazili', 'deneme', 'quiz', 'karma'] as const;

const EXAM_TAB_STYLES: Record<string, { active: string; idle: string }> = {
  '': {
    active:
      'border-slate-400/40 bg-slate-500/15 font-semibold text-foreground shadow-sm ring-1 ring-slate-400/25 dark:bg-slate-400/20',
    idle: 'border-transparent bg-slate-500/8 text-muted-foreground hover:bg-slate-500/14 dark:bg-slate-500/15',
  },
  genel: {
    active:
      'border-violet-400/45 bg-violet-500/18 font-semibold text-violet-950 shadow-sm ring-1 ring-violet-400/30 dark:text-violet-100',
    idle: 'border-transparent bg-violet-500/10 text-violet-900/85 hover:bg-violet-500/16 dark:bg-violet-950/40 dark:text-violet-200',
  },
  yazili: {
    active:
      'border-sky-400/45 bg-sky-500/18 font-semibold text-sky-950 shadow-sm ring-1 ring-sky-400/30 dark:text-sky-100',
    idle: 'border-transparent bg-sky-500/10 text-sky-900/85 hover:bg-sky-500/16 dark:bg-sky-950/40 dark:text-sky-200',
  },
  deneme: {
    active:
      'border-amber-400/45 bg-amber-500/18 font-semibold text-amber-950 shadow-sm ring-1 ring-amber-400/30 dark:text-amber-100',
    idle: 'border-transparent bg-amber-500/10 text-amber-950/80 hover:bg-amber-500/16 dark:bg-amber-950/35 dark:text-amber-100',
  },
  quiz: {
    active:
      'border-emerald-400/45 bg-emerald-500/18 font-semibold text-emerald-950 shadow-sm ring-1 ring-emerald-400/30 dark:text-emerald-100',
    idle: 'border-transparent bg-emerald-500/10 text-emerald-900/85 hover:bg-emerald-500/16 dark:bg-emerald-950/40 dark:text-emerald-200',
  },
  karma: {
    active:
      'border-fuchsia-400/45 bg-fuchsia-500/18 font-semibold text-fuchsia-950 shadow-sm ring-1 ring-fuchsia-400/30 dark:text-fuchsia-100',
    idle: 'border-transparent bg-fuchsia-500/10 text-fuchsia-900/85 hover:bg-fuchsia-500/16 dark:bg-fuchsia-950/40 dark:text-fuchsia-200',
  },
};

const EXAM_CARD_STYLES: Record<string, string> = {
  genel:
    'border-l-violet-500/70 bg-violet-500/[0.08] dark:border-l-violet-400/55 dark:bg-violet-950/30',
  yazili: 'border-l-sky-500/70 bg-sky-500/[0.08] dark:border-l-sky-400/55 dark:bg-sky-950/30',
  deneme: 'border-l-amber-500/70 bg-amber-500/[0.08] dark:border-l-amber-400/55 dark:bg-amber-950/28',
  quiz: 'border-l-emerald-500/70 bg-emerald-500/[0.08] dark:border-l-emerald-400/55 dark:bg-emerald-950/30',
  karma: 'border-l-fuchsia-500/70 bg-fuchsia-500/[0.08] dark:border-l-fuchsia-400/55 dark:bg-fuchsia-950/30',
};

const EXAM_ROW_STYLES: Record<string, string> = {
  genel: 'bg-violet-500/[0.04] hover:bg-violet-500/[0.09] dark:bg-violet-950/18 dark:hover:bg-violet-950/28',
  yazili: 'bg-sky-500/[0.04] hover:bg-sky-500/[0.09] dark:bg-sky-950/18 dark:hover:bg-sky-950/28',
  deneme: 'bg-amber-500/[0.04] hover:bg-amber-500/[0.09] dark:bg-amber-950/18 dark:hover:bg-amber-950/26',
  quiz: 'bg-emerald-500/[0.04] hover:bg-emerald-500/[0.09] dark:bg-emerald-950/18 dark:hover:bg-emerald-950/28',
  karma: 'bg-fuchsia-500/[0.04] hover:bg-fuchsia-500/[0.09] dark:bg-fuchsia-950/18 dark:hover:bg-fuchsia-950/28',
};

function examPaletteKey(examType?: string | null) {
  const k = examType ?? 'genel';
  return k in EXAM_CARD_STYLES ? k : 'genel';
}

export default function OptikFormlarPage() {
  const { token } = useAuth();
  const [items, setItems] = useState<FormTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [examFilter, setExamFilter] = useState<string>('');

  const fetchItems = useCallback(async () => {
    if (!token) return;
    try {
      const data = await apiFetch<FormTemplate[]>('/optik/form-templates', { token });
      setItems(data);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  const handleDownloadPdf = async (item: FormTemplate, prependBlank = 0) => {
    if (!token) return;
    setDownloadingId(item.id);
    try {
      const qs = prependBlank > 0 ? `?prepend_blank=${prependBlank}` : '';
      const headers: Record<string, string> = {};
      if (token !== COOKIE_SESSION_TOKEN) headers.Authorization = `Bearer ${token}`;
      const res = await fetch(getApiUrl(`/optik/form-templates/${item.id}/pdf${qs}`), {
        credentials: 'include',
        ...(Object.keys(headers).length > 0 && { headers }),
      });
      if (!res.ok) throw new Error('İndirme başarısız');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = prependBlank > 0 ? `${item.slug || item.id}-yazili-form.pdf` : `${item.slug || item.id}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success(prependBlank > 0 ? 'Yazılı + Form PDF indirildi' : 'PDF indirildi');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'PDF indirilemedi');
    } finally {
      setDownloadingId(null);
    }
  };

  const scopeLabel = (s?: string) => (s === 'system' ? 'Sistem' : s === 'school' ? 'Okul' : s === 'teacher' ? 'Özel' : '-');
  const filteredItems = examFilter ? items.filter((i) => (i.examType ?? 'genel') === examFilter) : items;

  if (loading) return <LoadingSpinner className="mx-auto my-8 size-8" />;

  return (
    <div className="optik-formlar space-y-2 px-1.5 py-1 sm:space-y-5 sm:px-4 sm:py-4 md:px-0 md:py-0">
      <div className="flex items-center gap-1.5 rounded-lg border border-border/80 bg-linear-to-r from-cyan-500/12 via-sky-500/8 to-violet-500/10 px-1.5 py-1 shadow-sm dark:from-cyan-950/30 dark:via-sky-950/20 dark:to-violet-950/25 sm:gap-3 sm:rounded-xl sm:px-3 sm:py-2.5">
        <Link
          href="/dashboard"
          className="flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-background/80 hover:text-primary sm:size-8 sm:rounded-lg"
          aria-label="Anasayfa"
          title="Anasayfa"
        >
          <Home className="size-4 sm:size-[18px]" />
        </Link>
        <ChevronRight className="size-2.5 shrink-0 text-muted-foreground/70 sm:size-3" aria-hidden />
        <div className="flex size-7 shrink-0 items-center justify-center rounded-md bg-cyan-600/90 text-white shadow-sm ring-1 ring-cyan-500/30 dark:bg-cyan-600 sm:size-9 sm:rounded-lg">
          <ScanLine className="size-3.5 sm:size-4" aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <h1
            className="text-xs font-bold leading-tight text-foreground sm:text-base"
            title="Okul tarafından tanımlı optik şablonları PDF olarak indirin. Yeni şablon süper admin tarafından eklenir."
          >
            Optik formlar
          </h1>
          <p className="truncate text-[10px] text-muted-foreground sm:text-xs" title={`${items.length} şablon · Filtre: ${examFilter ? (EXAM_LABELS[examFilter] ?? examFilter) : 'Tümü'}`}>
            {items.length} şablon · {examFilter ? EXAM_LABELS[examFilter] ?? examFilter : 'Tüm sınav türleri'}
          </p>
        </div>
      </div>

      <Card className="overflow-hidden border-border/80 shadow-sm">
        <CardContent className="space-y-2 p-2 sm:space-y-4 sm:p-5">
          <div
            className="grid grid-cols-3 gap-0.5 rounded-lg border border-border/50 bg-muted/20 p-0.5 dark:bg-muted/10 sm:flex sm:flex-wrap sm:gap-1.5 sm:rounded-lg sm:border-0 sm:bg-transparent sm:p-0"
            role="tablist"
            aria-label="Sınav türü"
          >
            {EXAM_FILTER_ORDER.map((key) => {
              const label = key === '' ? 'Tümü' : EXAM_LABELS[key] ?? key;
              const active = examFilter === key;
              const st = EXAM_TAB_STYLES[key] ?? EXAM_TAB_STYLES['']!;
              return (
                <button
                  key={key || 'all'}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setExamFilter(key)}
                  className={cn(
                    'min-h-8 rounded-md border px-1 py-1 text-center text-[9px] font-semibold leading-tight transition-colors active:scale-[0.98] sm:min-h-9 sm:rounded-lg sm:px-4 sm:py-2 sm:text-xs',
                    active ? st.active : st.idle,
                  )}
                >
                  {label}
                </button>
              );
            })}
          </div>

          <div className="space-y-1.5 sm:hidden">
            {filteredItems.map((item) => {
              const busy = downloadingId === item.id;
              const pk = examPaletteKey(item.examType);
              return (
                <div
                  key={item.id}
                  className={cn(
                    'rounded-lg border border-y border-r border-border/60 border-l-[3px] p-2 shadow-sm ring-1 ring-black/2 dark:ring-white/4',
                    EXAM_CARD_STYLES[pk],
                  )}
                >
                  <p className="text-xs font-semibold leading-snug text-foreground">{item.name}</p>
                  <div className="mt-1 flex flex-wrap gap-x-2 gap-y-0.5 text-[10px] text-muted-foreground">
                    <span>{EXAM_LABELS[item.examType ?? 'genel'] ?? item.examType}</span>
                    <span>
                      {item.questionCount} soru · {item.choiceCount} şık
                    </span>
                    <span>{scopeLabel(item.scope)}</span>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1">
                    <Button
                      variant="secondary"
                      size="sm"
                      className="h-8 min-w-0 flex-1 px-2 text-[11px]"
                      disabled={!!downloadingId}
                      onClick={() => handleDownloadPdf(item)}
                      title="Sadece optik form"
                    >
                      {busy ? <LoadingSpinner className="size-3.5" /> : <Download className="size-3" />}
                      <span className="ml-1">PDF</span>
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 min-w-0 flex-1 px-2 text-[11px]"
                      disabled={!!downloadingId}
                      onClick={() => handleDownloadPdf(item, 1)}
                      title="Önce boş sayfa, sonra optik"
                    >
                      Yazılı+Form
                    </Button>
                  </div>
                </div>
              );
            })}
            {filteredItems.length === 0 && (
              <EmptyState
                icon={<FileText className="size-10 text-muted-foreground" />}
                title={items.length === 0 ? 'Henüz form şablonu yok' : 'Bu sınav türünde form yok'}
                description={
                  items.length === 0
                    ? 'Şablonlar süper admin tarafından eklenir.'
                    : 'Başka bir sınav türü seçin.'
                }
              />
            )}
          </div>

          {/* Masaüstü: tablo */}
          <div className="table-x-scroll hidden sm:block">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40">
                  <th className="p-2.5 text-left font-semibold">Ad</th>
                  <th className="p-2.5 text-left font-semibold">Tür</th>
                  <th className="p-2.5 text-right font-semibold">Soru</th>
                  <th className="p-2.5 text-right font-semibold">Şık</th>
                  <th className="p-2.5 text-left font-semibold">Kaynak</th>
                  <th className="p-2.5" />
                </tr>
              </thead>
              <tbody>
                {filteredItems.map((item) => {
                  const pk = examPaletteKey(item.examType);
                  return (
                  <tr
                    key={item.id}
                    className={cn('border-b border-border/50 transition-colors', EXAM_ROW_STYLES[pk])}
                  >
                    <td className="p-2.5 font-medium">{item.name}</td>
                    <td className="p-2.5">{EXAM_LABELS[item.examType ?? 'genel'] ?? item.examType}</td>
                    <td className="p-2.5 text-right tabular-nums">{item.questionCount}</td>
                    <td className="p-2.5 text-right tabular-nums">{item.choiceCount}</td>
                    <td className="p-2.5 text-muted-foreground">{scopeLabel(item.scope)}</td>
                    <td className="p-2.5">
                      <div className="flex flex-wrap items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={!!downloadingId}
                          onClick={() => handleDownloadPdf(item)}
                          title="Sadece optik form"
                        >
                          {downloadingId === item.id ? (
                            <LoadingSpinner className="size-4" />
                          ) : (
                            <Download className="size-4" />
                          )}
                          <span className="ml-1">PDF</span>
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={!!downloadingId}
                          onClick={() => handleDownloadPdf(item, 1)}
                          title="Önce boş sayfa (yazılı sorular için), sonra optik form"
                        >
                          Yazılı + Form
                        </Button>
                      </div>
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
            {filteredItems.length === 0 && (
              <EmptyState
                icon={<FileText className="size-10 text-muted-foreground" />}
                title={items.length === 0 ? 'Henüz form şablonu yok' : 'Bu sınav türünde form yok'}
                description={
                  items.length === 0
                    ? 'Süper admin optik form şablonlarını Optik okuma ayarları üzerinden tanımlar.'
                    : 'Filtreyi değiştirin.'
                }
              />
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
