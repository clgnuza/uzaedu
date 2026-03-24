'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  SlidersHorizontal,
  CalendarCheck,
  CheckCircle2,
  Plus,
  Trash2,
  Undo2,
  RefreshCw,
  AlertCircle,
  Star,
  BanIcon,
  Clock3,
  BadgeCheck,
} from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { apiFetch } from '@/lib/api';
import { toast } from 'sonner';
import { Card, CardContent } from '@/components/ui/card';
import { DutyPageHeader } from '@/components/duty/duty-page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { EmptyState } from '@/components/ui/empty-state';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

type DutyPreference = {
  id: string;
  date: string;
  status: 'available' | 'unavailable' | 'prefer';
  note: string | null;
  created_at: string;
  admin_confirmed_at?: string | null;
  user?: { display_name: string | null; email: string };
};

const STATUS_LABELS: Record<string, string> = {
  available: 'Müsait',
  unavailable: 'Müsait değil',
  prefer: 'Tercih ediyorum',
};

function formatDate(s: string) {
  return new Date(s + 'T12:00:00').toLocaleDateString('tr-TR', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function toYMD(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Tercihleri ay bazında grupla: { "2025-02": [...], "2025-03": [...] } */
function groupByMonth(prefs: DutyPreference[]): Array<{ monthKey: string; label: string; items: DutyPreference[] }> {
  const groups = new Map<string, DutyPreference[]>();
  for (const p of prefs) {
    const key = p.date.slice(0, 7); // YYYY-MM
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(p);
  }
  return Array.from(groups.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([monthKey, items]) => {
      const [y, m] = monthKey.split('-').map(Number);
      const label = new Date(y, m - 1, 1).toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' });
      return { monthKey, label, items };
    });
}

export default function TercihlerPage() {
  const { token, me } = useAuth();
  const isAdmin = me?.role === 'school_admin';
  const [preferencesEnabled, setPreferencesEnabled] = useState<boolean | null>(isAdmin ? true : null);
  const [preferences, setPreferences] = useState<DutyPreference[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState<{ from: string; to: string }>(() => {
    // 2 yıl geriye + 1 yıl ileri - tüm tercihleri göster
    const now = new Date();
    const from = `${now.getFullYear() - 2}-01-01`;
    const to = `${now.getFullYear() + 1}-12-31`;
    return { from, to };
  });
  const [createOpen, setCreateOpen] = useState(false);
  const [createMode, setCreateMode] = useState<'single' | 'recurring'>('single');
  const [createDate, setCreateDate] = useState(() => toYMD(new Date()));
  const [createPeriodFrom, setCreatePeriodFrom] = useState(() => toYMD(new Date()));
  const [createPeriodTo, setCreatePeriodTo] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() + 2);
    return toYMD(d);
  });
  const [createDays, setCreateDays] = useState<number[]>([1]); // 1=Pzt .. 6=Cmt
  const [createStatus, setCreateStatus] = useState<'available' | 'unavailable' | 'prefer'>('unavailable');
  const [createNote, setCreateNote] = useState('');
  const [creating, setCreating] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [unconfirmingId, setUnconfirmingId] = useState<string | null>(null);

  useEffect(() => {
    if (!token || isAdmin) return;
    apiFetch<{ preferences_enabled: boolean }>('/duty/teacher-features', { token })
      .then((d) => setPreferencesEnabled(d?.preferences_enabled ?? true))
      .catch(() => setPreferencesEnabled(true));
  }, [token, isAdmin]);

  const fetchPreferences = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const list = await apiFetch<DutyPreference[]>(
        `/duty/preferences?from=${dateRange.from}&to=${dateRange.to}`,
        { token },
      );
      setPreferences(Array.isArray(list) ? list : []);
    } catch {
      setPreferences([]);
    } finally {
      setLoading(false);
    }
  }, [token, dateRange.from, dateRange.to]);

  useEffect(() => {
    fetchPreferences();
  }, [fetchPreferences]);

  const handleCreate = async () => {
    if (!token) return;
    setCreating(true);
    try {
      const body: Record<string, unknown> = {
        status: createStatus,
        note: createNote.trim() || undefined,
      };
      if (createMode === 'single') {
        if (!createDate) { toast.error('Tarih seçin.'); setCreating(false); return; }
        body.date = createDate;
      } else {
        if (createDays.length === 0) { toast.error('En az bir gün seçin.'); setCreating(false); return; }
        if (!createPeriodFrom || !createPeriodTo) { toast.error('Başlangıç ve bitiş tarihi girin.'); setCreating(false); return; }
        body.day_of_week = createDays;
        body.period_from = createPeriodFrom;
        body.period_to = createPeriodTo;
      }
      const res = await apiFetch<{ created?: number } | DutyPreference>('/duty/preferences', {
        token,
        method: 'POST',
        body: JSON.stringify(body),
      });
      const created = typeof res === 'object' && res && 'created' in res ? (res as { created?: unknown }).created : undefined;
      const count = typeof created === 'number' ? created : 1;
      toast.success(count > 1 ? `${count} tercih kaydedildi.` : 'Tercih kaydedildi.');
      setCreateOpen(false);
      setCreateDate(toYMD(new Date()));
      setCreateStatus('unavailable');
      setCreateNote('');
      fetchPreferences();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : (e as { message?: string })?.message;
      toast.error(msg ?? 'Kaydedilemedi.');
    } finally {
      setCreating(false);
    }
  };

  const handleConfirm = async (id: string) => {
    if (!token || !isAdmin) return;
    setConfirmingId(id);
    try {
      await apiFetch(`/duty/preferences/${id}/confirm`, { token, method: 'PATCH' });
      toast.success('Dikkate alındı.');
      fetchPreferences();
    } catch {
      toast.error('İşlem başarısız.');
    } finally {
      setConfirmingId(null);
    }
  };

  const handleUnconfirm = async (id: string) => {
    if (!token || !isAdmin) return;
    setUnconfirmingId(id);
    try {
      await apiFetch(`/duty/preferences/${id}/unconfirm`, { token, method: 'PATCH' });
      toast.success('Onay geri alındı.');
      fetchPreferences();
    } catch {
      toast.error('İşlem başarısız.');
    } finally {
      setUnconfirmingId(null);
    }
  };

  const handleDelete = async (id: string) => {
    if (!token) return;
    setDeletingId(id);
    try {
      await apiFetch(`/duty/preferences/${id}`, { token, method: 'DELETE' });
      toast.success('Tercih silindi.');
      fetchPreferences();
    } catch {
      toast.error('Silinemedi.');
    } finally {
      setDeletingId(null);
    }
  };

  const STATUS_CONFIG = {
    available: {
      icon: CalendarCheck,
      label: 'Müsait',
      cardBorder: 'border-l-emerald-400',
      badge: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
      iconColor: 'text-emerald-500',
      bg: 'bg-emerald-50/50 dark:bg-emerald-950/10',
    },
    unavailable: {
      icon: BanIcon,
      label: 'Müsait değil',
      cardBorder: 'border-l-rose-400',
      badge: 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300',
      iconColor: 'text-rose-500',
      bg: 'bg-rose-50/30 dark:bg-rose-950/10',
    },
    prefer: {
      icon: Star,
      label: 'Tercih ediyorum',
      cardBorder: 'border-l-blue-400',
      badge: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
      iconColor: 'text-blue-500',
      bg: 'bg-blue-50/30 dark:bg-blue-950/10',
    },
  } as const;

  const pendingCount = preferences.filter((p) => !p.admin_confirmed_at).length;
  const confirmedCount = preferences.filter((p) => !!p.admin_confirmed_at).length;

  if (!isAdmin && preferencesEnabled === false) {
    return (
      <div className="space-y-5">
        <Card className="rounded-xl border-amber-200 bg-amber-50/50 dark:border-amber-900/50 dark:bg-amber-950/20">
          <CardContent className="p-6">
            <div className="flex flex-col sm:flex-row sm:items-start gap-4">
              <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-amber-100 dark:bg-amber-900/40">
                <SlidersHorizontal className="size-6 text-amber-700 dark:text-amber-300" />
              </div>
              <div>
                <h3 className="font-semibold text-amber-900 dark:text-amber-100">Tercihlerim kapalı</h3>
                <p className="mt-1 text-sm text-amber-800/90 dark:text-amber-200/90">
                  Okul yöneticiniz Tercihlerim özelliğini devre dışı bırakmış. Nöbet günü tercihlerinizi giremezsiniz. Açılmasını istiyorsanız okul yöneticinizle iletişime geçin.
                </p>
                <Link href="/duty">
                  <Button variant="outline" size="sm" className="mt-4 border-amber-300 text-amber-800 hover:bg-amber-100 dark:border-amber-700 dark:text-amber-200">
                    Nöbet sayfasına dön
                  </Button>
                </Link>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <DutyPageHeader
        icon={SlidersHorizontal}
        title="Nöbet Tercihleri"
        description={
          isAdmin
            ? 'Öğretmenlerin nöbet günü tercihleri. Otomatik planlama bu bilgileri dikkate alır.'
            : 'Hangi günlerde müsait veya müsait olmadığınızı belirtin. Otomatik plan buna göre yapılır.'
        }
        color="blue"
        badge={
          preferences.length > 0 ? (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
              {preferences.length} kayıt
            </span>
          ) : undefined
        }
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={fetchPreferences} disabled={loading}>
              <RefreshCw className={cn('size-4', loading && 'animate-spin')} />
              Yenile
            </Button>
            {!isAdmin && (
              <Button size="sm" onClick={() => setCreateOpen(true)}>
                <Plus className="size-4" />
                Tercih ekle
              </Button>
            )}
          </div>
        }
      />

      {/* Özet sayaçlar – sadece admin */}
      {isAdmin && preferences.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Toplam', value: preferences.length, color: 'text-foreground', bg: 'bg-muted/40' },
            { label: 'Admin Onayı Bekliyor', value: pendingCount, color: 'text-amber-700', bg: 'bg-amber-50 dark:bg-amber-950/20' },
            { label: 'Dikkate Alındı', value: confirmedCount, color: 'text-emerald-700', bg: 'bg-emerald-50 dark:bg-emerald-950/20' },
          ].map((s) => (
            <div key={s.label} className={cn('rounded-xl p-3 border border-border/50', s.bg)}>
              <p className="text-xs text-muted-foreground">{s.label}</p>
              <p className={cn('text-2xl font-bold mt-0.5', s.color)}>{s.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Tarih filtresi */}
      <div className={cn(
        'flex flex-wrap items-end gap-3 border border-border/50',
        isAdmin ? 'rounded-xl bg-muted/40 p-3.5' : 'rounded-lg bg-muted/20 px-3 py-2',
      )}>
        <div className="space-y-0.5">
          <Label className="text-[11px] text-muted-foreground">Başlangıç</Label>
          <Input type="date" value={dateRange.from} onChange={(e) => setDateRange((r) => ({ ...r, from: e.target.value }))} className={cn('h-8 w-32 text-xs', !isAdmin && 'h-8 w-28')} />
        </div>
        <div className="space-y-0.5">
          <Label className="text-[11px] text-muted-foreground">Bitiş</Label>
          <Input type="date" value={dateRange.to} onChange={(e) => setDateRange((r) => ({ ...r, to: e.target.value }))} className={cn('h-8 w-32 text-xs', !isAdmin && 'h-8 w-28')} />
        </div>
      </div>

      {loading ? (
        <div className={cn('flex flex-col items-center justify-center gap-2', isAdmin ? 'py-20' : 'py-12')}>
          <LoadingSpinner />
          <p className="text-xs text-muted-foreground">Yükleniyor…</p>
        </div>
      ) : !preferences.length ? (
        <EmptyState
          icon={<CalendarCheck className={cn('text-muted-foreground/50', isAdmin ? 'size-12' : 'size-10')} />}
          title="Tercih kaydı yok"
          description={isAdmin ? 'Seçilen tarih aralığında tercih bulunamadı.' : 'Tercih eklemek için "Tercih ekle" butonunu kullanın.'}
        />
      ) : isAdmin ? (
        /* Admin: ay gruplu tam liste */
        <div className="space-y-4">
          {groupByMonth(preferences).map(({ monthKey, label, items }) => (
            <div key={monthKey}>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2 sticky top-0 bg-background/95 py-1 z-10">
                {label}
              </p>
              <div className="grid gap-2.5">
                {items.map((pref) => {
            const cfg = STATUS_CONFIG[pref.status as keyof typeof STATUS_CONFIG] ?? STATUS_CONFIG.available;
            const Icon = cfg.icon;
            const isConfirmed = !!pref.admin_confirmed_at;
            return (
              <div
                key={pref.id}
                className={cn(
                  'relative rounded-xl border border-l-4 bg-card transition-shadow hover:shadow-sm',
                  cfg.cardBorder,
                  isConfirmed && 'ring-1 ring-emerald-200 dark:ring-emerald-800',
                )}
              >
                <div className="flex items-start gap-3 p-3.5">
                  <div className={cn('mt-0.5 flex items-center justify-center size-8 rounded-lg bg-muted/60 shrink-0', cfg.iconColor)}>
                    <Icon className="size-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium text-sm text-foreground">{formatDate(pref.date)}</span>
                      <span className={cn('inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium', cfg.badge)}>{cfg.label}</span>
                      {isConfirmed ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
                          <BadgeCheck className="size-3" /> Dikkate alındı
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
                          <Clock3 className="size-3" /> Beklemede
                        </span>
                      )}
                    </div>
                    {pref.user && (
                      <p className="text-xs text-muted-foreground mt-1"><span className="font-medium text-foreground">{pref.user.display_name || pref.user.email}</span></p>
                    )}
                    {pref.note && <p className="text-xs text-muted-foreground mt-1 italic">"{pref.note}"</p>}
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0 print:hidden">
                    {!isConfirmed ? (
                      <Button size="sm" className="h-8 text-xs bg-emerald-600 hover:bg-emerald-700 text-white" onClick={() => handleConfirm(pref.id)} disabled={!!confirmingId}>
                        {confirmingId === pref.id ? <LoadingSpinner className="size-3" /> : <CheckCircle2 className="size-3" />} Dikkate al
                      </Button>
                    ) : (
                      <Button variant="ghost" size="sm" className="h-8 text-xs text-amber-600 hover:bg-amber-50" onClick={() => handleUnconfirm(pref.id)} disabled={!!unconfirmingId}>
                        {unconfirmingId === pref.id ? <LoadingSpinner className="size-3" /> : <Undo2 className="size-3" />} Geri al
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* Öğretmen: ay gruplu minimal liste */
        <div className="space-y-4">
          {groupByMonth(preferences).map(({ monthKey, label, items }) => (
            <div key={monthKey}>
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">
                {label}
              </p>
              <div className="space-y-1">
                {items.map((pref) => {
            const cfg = STATUS_CONFIG[pref.status as keyof typeof STATUS_CONFIG] ?? STATUS_CONFIG.available;
            const Icon = cfg.icon;
            const isConfirmed = !!pref.admin_confirmed_at;
            return (
              <div
                key={pref.id}
                className={cn(
                  'flex items-center justify-between gap-2 rounded-lg border px-2.5 py-2 text-xs transition-colors hover:bg-muted/30',
                  'border-l-4',
                  cfg.cardBorder,
                )}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <Icon className={cn('size-3.5 shrink-0', cfg.iconColor)} />
                  <span className="tabular-nums text-foreground truncate">
                    {new Date(pref.date + 'T12:00:00').toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', year: '2-digit' })}
                  </span>
                  <span className={cn('shrink-0 px-1.5 py-0.5 rounded text-[10px] font-medium', cfg.badge)}>
                    {cfg.label}
                  </span>
                  {isConfirmed && <BadgeCheck className="size-3 text-emerald-600 dark:text-emerald-400 shrink-0" />}
                  {pref.note && <span className="text-muted-foreground truncate max-w-[120px]" title={pref.note}>"{pref.note}"</span>}
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 shrink-0 text-rose-500 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                  onClick={() => handleDelete(pref.id)}
                  disabled={!!deletingId}
                >
                  {deletingId === pref.id ? <LoadingSpinner className="size-3" /> : <Trash2 className="size-3" />}
                </Button>
              </div>
            );
          })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Tercih ekle modal – teacher */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <SlidersHorizontal className="size-5" />
              Nöbet Tercihi Ekle
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-xs text-muted-foreground">Tekrar türü</Label>
              <p className="text-xs text-muted-foreground mt-0.5 mb-1.5">Tek bir gün mü yoksa her hafta aynı günler mi?</p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setCreateMode('single')}
                  className={cn(
                    'flex-1 py-2 rounded-lg text-sm font-medium border transition-colors',
                    createMode === 'single'
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'border-border text-muted-foreground hover:border-primary/50 hover:text-foreground',
                  )}
                >
                  Tek gün
                </button>
                <button
                  type="button"
                  onClick={() => setCreateMode('recurring')}
                  className={cn(
                    'flex-1 py-2 rounded-lg text-sm font-medium border transition-colors',
                    createMode === 'recurring'
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'border-border text-muted-foreground hover:border-primary/50 hover:text-foreground',
                  )}
                >
                  Her hafta (periyodik)
                </button>
              </div>
            </div>
            {createMode === 'single' ? (
              <div>
                <Label>Nöbet günü</Label>
                <p className="text-xs text-muted-foreground mt-0.5 mb-1">Müsaitlik belirleyeceğiniz tarihi seçin</p>
                <Input
                  type="date"
                  value={createDate}
                  onChange={(e) => setCreateDate(e.target.value)}
                />
              </div>
            ) : (
              <>
                <div>
                  <Label>Hangi günler</Label>
                  <p className="text-xs text-muted-foreground mt-0.5 mb-1.5">Seçtiğiniz günlerde (Pzt–Cmt) tercih geçerli olacak</p>
                  <div className="flex flex-wrap gap-2">
                    {[
                      [1, 'Pzt'],
                      [2, 'Sal'],
                      [3, 'Çar'],
                      [4, 'Per'],
                      [5, 'Cum'],
                      [6, 'Cmt'],
                    ].map(([d, label]) => (
                      <label
                        key={d as number}
                        className="flex items-center gap-1.5 cursor-pointer text-sm"
                      >
                        <input
                          type="checkbox"
                          checked={createDays.includes(d as number)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setCreateDays((prev) => [...prev, d as number].sort());
                            } else {
                              setCreateDays((prev) => prev.filter((x) => x !== d));
                            }
                          }}
                        />
                        {label}
                      </label>
                    ))}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Başlangıç tarihi</Label>
                    <p className="text-xs text-muted-foreground mt-0.5 mb-1">Tercihin geçerli olacağı ilk gün</p>
                    <Input
                      type="date"
                      value={createPeriodFrom}
                      onChange={(e) => setCreatePeriodFrom(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label>Bitiş tarihi</Label>
                    <p className="text-xs text-muted-foreground mt-0.5 mb-1">Tercihin geçerli olacağı son gün</p>
                    <Input
                      type="date"
                      value={createPeriodTo}
                      onChange={(e) => setCreatePeriodTo(e.target.value)}
                    />
                  </div>
                </div>
              </>
            )}
            <div>
              <Label>Müsaitlik durumu</Label>
              <p className="text-xs text-muted-foreground mt-0.5 mb-1">Otomatik plan bu bilgiyi dikkate alır</p>
              <Select value={createStatus} onValueChange={(v) => setCreateStatus(v as 'available' | 'unavailable' | 'prefer')}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="unavailable">Müsait değil — O gün nöbet tutamıyorum</SelectItem>
                  <SelectItem value="available">Müsait — O gün nöbet tutabilirim</SelectItem>
                  <SelectItem value="prefer">Tercih ediyorum — Bu günü tercih ediyorum</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Not (opsiyonel)</Label>
              <Input
                value={createNote}
                onChange={(e) => setCreateNote(e.target.value)}
                placeholder="Örn: Doktor randevusu"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              İptal
            </Button>
            <Button onClick={handleCreate} disabled={creating}>
              {creating ? <LoadingSpinner className="size-4" /> : 'Kaydet'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
