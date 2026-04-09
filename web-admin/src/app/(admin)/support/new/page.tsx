'use client';

import { useState, useEffect, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import {
  Headphones,
  ArrowLeft,
  Building2,
  Send,
  Users,
  Sparkles,
  ShieldCheck,
  ClipboardList,
  Paperclip,
  AlignLeft,
} from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { ToolbarIconHints } from '@/components/layout/toolbar-icon-hints';
import { apiFetch, isSupportModuleDisabledError } from '@/lib/api';
import { useSupportModuleAvailability } from '@/hooks/use-support-module-availability';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert } from '@/components/ui/alert';
import { TicketAttachmentInput } from '@/components/ticket-attachment-input';
import { cn } from '@/lib/utils';

type TicketModule = { id: string; name: string; icon_key: string; target_availability: string };

const ISSUE_LABELS: Record<string, string> = {
  QUESTION: 'Soru',
  BUG: 'Hata',
  REQUEST: 'Talep',
  IMPROVEMENT: 'Öneri',
};
const PRIORITY_LABELS: Record<string, string> = {
  LOW: 'Düşük',
  MEDIUM: 'Orta',
  HIGH: 'Yüksek',
  URGENT: 'Acil',
};

function StepShell({
  step,
  title,
  subtitle,
  accent,
  children,
}: {
  step: number;
  title: string;
  subtitle?: string;
  accent: 'sky' | 'violet' | 'emerald' | 'amber';
  children: ReactNode;
}) {
  const ring =
    accent === 'sky'
      ? 'from-sky-500 to-cyan-600'
      : accent === 'violet'
        ? 'from-violet-500 to-purple-600'
        : accent === 'emerald'
          ? 'from-emerald-500 to-teal-600'
          : 'from-amber-500 to-orange-600';

  return (
    <section className="overflow-hidden rounded-xl border border-border/50 bg-card/90 shadow-sm ring-1 ring-black/3 dark:ring-white/6 sm:rounded-2xl">
      <div className="flex items-start gap-2.5 border-b border-border/40 bg-linear-to-r from-muted/40 to-transparent px-3 py-2.5 sm:gap-3 sm:px-4 sm:py-3">
        <span
          className={cn(
            'flex size-8 shrink-0 items-center justify-center rounded-full bg-linear-to-br text-[11px] font-bold text-white shadow-md sm:size-9 sm:text-xs',
            ring,
          )}
        >
          {step}
        </span>
        <div className="min-w-0 pt-0.5">
          <h2 className="text-sm font-semibold leading-tight text-foreground sm:text-base">{title}</h2>
          {subtitle ? <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground sm:text-xs">{subtitle}</p> : null}
        </div>
      </div>
      <div className="p-3 sm:p-4">{children}</div>
    </section>
  );
}

export default function NewTicketPage() {
  const router = useRouter();
  const { token, me } = useAuth();
  const { supportEnabled, loading: supportLoading } = useSupportModuleAvailability();
  const [modules, setModules] = useState<TicketModule[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [supportBlocked, setSupportBlocked] = useState(false);
  const [targetType, setTargetType] = useState<'SCHOOL_SUPPORT' | 'PLATFORM_SUPPORT'>('SCHOOL_SUPPORT');
  const [moduleId, setModuleId] = useState('');
  const [issueType, setIssueType] = useState<'BUG' | 'QUESTION' | 'REQUEST' | 'IMPROVEMENT'>('QUESTION');
  const [priority, setPriority] = useState<'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT'>('MEDIUM');
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [attachments, setAttachments] = useState<{ key: string; filename: string; mime_type?: string; size_bytes?: number }[]>([]);

  useEffect(() => {
    if (supportEnabled === false || supportBlocked) {
      setLoading(false);
      return;
    }
    if (!token || supportEnabled !== true) return;
    setLoading(true);
    const target = targetType === 'PLATFORM_SUPPORT' ? 'PLATFORM_SUPPORT' : 'SCHOOL_SUPPORT';
    apiFetch<TicketModule[]>(`/tickets/modules?target_type=${target}`, { token })
      .then((list) => {
        setModules(list);
        if (list.length && !moduleId) setModuleId(list[0].id);
        else if (!list.some((m) => m.id === moduleId) && list.length) setModuleId(list[0].id);
      })
      .catch((e) => {
        if (isSupportModuleDisabledError(e)) {
          setSupportBlocked(true);
          setError(null);
          setModules([]);
          return;
        }
        setModules([]);
      })
      .finally(() => setLoading(false));
  }, [token, targetType, supportEnabled, supportBlocked]);

  if (supportLoading) return <LoadingSpinner label="Yükleniyor…" className="py-8" />;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !moduleId || !subject.trim() || !description.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await apiFetch<{ id: string }>('/tickets', {
        method: 'POST',
        token,
        body: JSON.stringify({
          target_type: targetType,
          module_id: moduleId,
          issue_type: issueType,
          priority,
          subject: subject.trim(),
          description: description.trim(),
          ...(attachments.length ? { attachments } : {}),
        }),
      });
      router.push(`/support/${res.id}`);
    } catch (err) {
      if (isSupportModuleDisabledError(err)) {
        setSupportBlocked(true);
        setError(null);
        return;
      }
      setError(err instanceof Error ? err.message : 'Talep oluşturulamadı');
    } finally {
      setSubmitting(false);
    }
  };

  const scopeLabel = targetType === 'SCHOOL_SUPPORT' ? 'Okul içi' : 'Platform';
  const previewChips = [scopeLabel, ISSUE_LABELS[issueType] ?? issueType, PRIORITY_LABELS[priority] ?? priority];

  return (
    <div className="support-new-page space-y-3 pb-6 sm:space-y-4 sm:pb-8">
      <div className="relative overflow-hidden rounded-xl border border-sky-400/25 bg-linear-to-br from-sky-500/12 via-cyan-500/8 to-emerald-500/10 p-2.5 shadow-md ring-1 ring-sky-500/15 dark:border-sky-500/20 dark:from-sky-950/45 dark:via-cyan-950/20 dark:to-emerald-950/25 sm:rounded-2xl sm:p-3">
        <div className="pointer-events-none absolute -right-6 -top-8 size-28 rounded-full bg-cyan-400/20 blur-2xl dark:bg-cyan-500/10" aria-hidden />
        <div className="relative flex flex-col gap-2.5 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-3">
          <div className="flex min-w-0 items-start gap-2 sm:gap-3">
            <button
              type="button"
              onClick={() => router.back()}
              className="mt-0.5 shrink-0 rounded-lg p-1.5 text-muted-foreground hover:bg-background/80"
              aria-label="Geri"
            >
              <ArrowLeft className="size-4" />
            </button>
            <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-linear-to-br from-sky-600 to-cyan-600 text-white shadow-md ring-2 ring-white/20 dark:ring-white/10 sm:size-10">
              <Headphones className="size-[1.05rem] sm:size-5" aria-hidden />
            </div>
            <div className="min-w-0">
              <p className="text-base font-semibold leading-tight tracking-tight sm:text-lg">Yeni destek talebi</p>
              <p className="mt-0.5 text-[11px] text-muted-foreground sm:text-xs">Dört adımda iletin — kapsam, ayrıntı, metin, gönder</p>
              <ToolbarIconHints
                compact
                showOnMobile
                className="mt-1.5 text-[11px] sm:text-xs"
                items={[
                  { label: 'Talep ilet', icon: Send },
                  { label: 'Okul / platform', icon: Building2 },
                  { label: 'Destek', icon: Headphones },
                ]}
                summary="Destek ekibine sorun veya talebinizi iletin."
              />
            </div>
          </div>
          <div className="flex flex-wrap gap-1 sm:justify-end">
            {previewChips.map((label) => (
              <span
                key={label}
                className="inline-flex items-center rounded-full border border-sky-500/25 bg-background/90 px-2 py-0.5 text-[10px] font-medium text-sky-900 shadow-sm dark:text-sky-100 sm:text-[11px]"
              >
                {label}
              </span>
            ))}
          </div>
        </div>
      </div>

      {error && <Alert variant="error" message={error} className="py-2 text-sm" />}
      {(supportEnabled === false || supportBlocked) && me?.role !== 'superadmin' && (
        <Alert variant="warning" message="Destek modülü şu anda kapalı. Yeni destek talebi oluşturamazsınız." className="py-2 text-xs sm:text-sm" />
      )}

      {supportEnabled !== false && !supportBlocked && (
        <div className="mx-auto grid max-w-3xl gap-3 lg:max-w-none lg:grid-cols-[minmax(0,1fr)_260px] lg:gap-4 xl:grid-cols-[minmax(0,1fr)_280px]">
          <form onSubmit={handleSubmit} className="space-y-3 sm:space-y-4">
            <StepShell
              step={1}
              title="Kime iletilsin?"
              subtitle="Okul yönetimi veya platform ekibi"
              accent="sky"
            >
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 sm:gap-3">
                <button
                  type="button"
                  onClick={() => setTargetType('SCHOOL_SUPPORT')}
                  className={cn(
                    'flex flex-col items-start rounded-xl border-2 p-3 text-left transition-all sm:p-3.5',
                    targetType === 'SCHOOL_SUPPORT'
                      ? 'border-emerald-500/50 bg-emerald-500/10 shadow-md ring-2 ring-emerald-500/20'
                      : 'border-border/60 bg-muted/10 hover:border-emerald-500/25',
                  )}
                >
                  <span className="flex w-full items-center gap-2">
                    <span className="flex size-9 items-center justify-center rounded-lg bg-emerald-500/20 text-emerald-700 dark:text-emerald-300">
                      <Users className="size-4" />
                    </span>
                    <span className="text-sm font-semibold">Okul içi</span>
                  </span>
                  <span className="mt-1.5 pl-11 text-[11px] leading-snug text-muted-foreground sm:text-xs">
                    Nöbet, program vb. okul yönetimine gider
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setTargetType('PLATFORM_SUPPORT')}
                  className={cn(
                    'flex flex-col items-start rounded-xl border-2 p-3 text-left transition-all sm:p-3.5',
                    targetType === 'PLATFORM_SUPPORT'
                      ? 'border-violet-500/50 bg-violet-500/10 shadow-md ring-2 ring-violet-500/20'
                      : 'border-border/60 bg-muted/10 hover:border-violet-500/25',
                  )}
                >
                  <span className="flex w-full items-center gap-2">
                    <span className="flex size-9 items-center justify-center rounded-lg bg-violet-500/20 text-violet-700 dark:text-violet-300">
                      <Building2 className="size-4" />
                    </span>
                    <span className="text-sm font-semibold">Platform</span>
                  </span>
                  <span className="mt-1.5 pl-11 text-[11px] leading-snug text-muted-foreground sm:text-xs">
                    Hata, öneri ve genel talepler sistem ekibine
                  </span>
                </button>
              </div>
            </StepShell>

            <StepShell step={2} title="Modül ve öncelik" subtitle="Konu sınıfı ve aciliyet" accent="violet">
              {loading ? (
                <LoadingSpinner label="Modüller…" className="py-4" />
              ) : (
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="module-select" className="text-xs font-medium sm:text-sm">
                      İlgili modül
                    </Label>
                    <select
                      id="module-select"
                      value={moduleId}
                      onChange={(e) => setModuleId(e.target.value)}
                      className="select-input h-10 w-full rounded-lg border border-input bg-background px-3 text-sm font-[inherit] sm:h-11"
                      required
                    >
                      {modules.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label htmlFor="issue-type" className="text-xs font-medium sm:text-sm">
                        Konu türü
                      </Label>
                      <select
                        id="issue-type"
                        value={issueType}
                        onChange={(e) => setIssueType(e.target.value as typeof issueType)}
                        className="select-input h-10 w-full rounded-lg border border-input bg-background px-3 text-sm font-[inherit] sm:h-11"
                      >
                        <option value="QUESTION">Soru</option>
                        <option value="BUG">Hata bildirimi</option>
                        <option value="REQUEST">Talep</option>
                        <option value="IMPROVEMENT">Öneri / iyileştirme</option>
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="priority" className="text-xs font-medium sm:text-sm">
                        Öncelik
                      </Label>
                      <select
                        id="priority"
                        value={priority}
                        onChange={(e) => setPriority(e.target.value as typeof priority)}
                        className="select-input h-10 w-full rounded-lg border border-input bg-background px-3 text-sm font-[inherit] sm:h-11"
                      >
                        <option value="LOW">Düşük</option>
                        <option value="MEDIUM">Orta</option>
                        <option value="HIGH">Yüksek</option>
                        <option value="URGENT">Acil</option>
                      </select>
                    </div>
                  </div>
                </div>
              )}
            </StepShell>

            <StepShell step={3} title="Başlık ve açıklama" subtitle="Net yazın, hızlı yanıt alın" accent="emerald">
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="subject" className="text-xs font-medium sm:text-sm">
                    Konu (başlık)
                  </Label>
                  <Input
                    id="subject"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder="Örn: Ders programı güncellemesi"
                    maxLength={512}
                    className="h-10 rounded-lg px-3 text-sm sm:h-11"
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="flex items-center gap-1.5 text-xs font-medium sm:text-sm">
                    <Paperclip className="size-3.5 text-muted-foreground" />
                    Dosya (isteğe bağlı)
                  </Label>
                  <p className="text-[10px] text-muted-foreground sm:text-xs">Ekran görüntüsü veya belge ekleyebilirsiniz</p>
                  <TicketAttachmentInput value={attachments} onChange={setAttachments} token={token} disabled={submitting} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="description" className="flex items-center gap-1.5 text-xs font-medium sm:text-sm">
                    <AlignLeft className="size-3.5 text-muted-foreground" />
                    Açıklama
                  </Label>
                  <textarea
                    id="description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Adım adım ne olduğunu yazın; mümkünse tarih/saat ekleyin."
                    className="min-h-[120px] w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/25 sm:min-h-[140px]"
                    required
                  />
                </div>
              </div>
            </StepShell>

            <div className="overflow-hidden rounded-xl border border-amber-400/30 bg-linear-to-br from-amber-500/8 to-orange-500/5 p-3 ring-1 ring-amber-500/15 sm:rounded-2xl sm:p-4">
              <div className="flex flex-wrap items-center gap-2 text-[11px] sm:text-xs">
                <Sparkles className="size-3.5 shrink-0 text-amber-600 dark:text-amber-400" />
                <span className="font-medium text-foreground">Gönderim özeti</span>
                <span className="text-muted-foreground">—</span>
                <span className="text-muted-foreground">
                  {targetType === 'SCHOOL_SUPPORT' ? 'Okul ekibi' : 'Platform ekibi'}
                </span>
                <span className="rounded-md bg-background/80 px-1.5 py-0.5 font-mono text-[10px] text-foreground/80">
                  {subject.trim() ? `${subject.slice(0, 28)}${subject.length > 28 ? '…' : ''}` : 'Başlık yok'}
                </span>
                {attachments.length > 0 && (
                  <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-medium text-amber-900 dark:text-amber-200">
                    {attachments.length} dosya
                  </span>
                )}
              </div>
              <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
                <Button type="submit" className="h-10 w-full gap-2 sm:h-11 sm:min-w-[160px]" disabled={submitting || !moduleId || loading}>
                  {submitting ? 'Gönderiliyor…' : 'Talebi oluştur'}
                  <Send className="size-4" />
                </Button>
                <Button type="button" variant="outline" className="h-10 w-full sm:w-auto" onClick={() => router.back()}>
                  İptal
                </Button>
              </div>
            </div>
          </form>

          <aside className="space-y-3 lg:sticky lg:top-[calc(var(--header-height,0px)+0.75rem)] lg:self-start">
            <div className="rounded-xl border border-emerald-500/20 bg-linear-to-br from-emerald-500/8 to-teal-500/5 p-3 shadow-sm sm:rounded-2xl sm:p-4">
              <div className="flex items-center gap-2">
                <div className="flex size-8 items-center justify-center rounded-lg bg-emerald-500/20 text-emerald-700 dark:text-emerald-400">
                  <ShieldCheck className="size-4" />
                </div>
                <div>
                  <p className="text-xs font-semibold sm:text-sm">Yönlendirme</p>
                  <p className="text-[10px] text-muted-foreground sm:text-xs">
                    {targetType === 'SCHOOL_SUPPORT' ? 'Okul yönetimi ve destek' : 'Platform / sistem yönetimi'}
                  </p>
                </div>
              </div>
            </div>
            <div className="rounded-xl border border-border/50 bg-card/90 p-3 shadow-sm sm:rounded-2xl sm:p-4">
              <div className="flex items-center gap-2 border-b border-border/40 pb-2">
                <ClipboardList className="size-4 text-sky-600 dark:text-sky-400" />
                <p className="text-xs font-semibold sm:text-sm">Akış</p>
              </div>
              <ol className="mt-3 space-y-2.5 text-[11px] text-muted-foreground sm:text-xs">
                <li className="flex gap-2">
                  <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-sky-500/20 text-[10px] font-bold text-sky-800 dark:text-sky-200">
                    1
                  </span>
                  <span>Kapsamı seçin (okul veya platform)</span>
                </li>
                <li className="flex gap-2">
                  <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-violet-500/20 text-[10px] font-bold text-violet-800 dark:text-violet-200">
                    2
                  </span>
                  <span>Modül, konu türü ve öncelik</span>
                </li>
                <li className="flex gap-2">
                  <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-emerald-500/20 text-[10px] font-bold text-emerald-800 dark:text-emerald-200">
                    3
                  </span>
                  <span>Başlık, ek ve açıklama</span>
                </li>
              </ol>
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}
