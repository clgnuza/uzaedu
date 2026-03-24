'use client';

import { useState, useEffect, useCallback } from 'react';
import { ScrollText, UserX, UserCog, Send, RefreshCw, X, ShieldOff, ShieldCheck, RotateCcw, BookOpen, ArrowLeftRight } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { apiFetch } from '@/lib/api';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { EmptyState } from '@/components/ui/empty-state';
import { Alert } from '@/components/ui/alert';
import { DutyPageHeader } from '@/components/duty/duty-page-header';
import { cn } from '@/lib/utils';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

type DutyLog = {
  id: string;
  action: string;
  duty_slot_id: string | null;
  old_user_id: string | null;
  new_user_id: string | null;
  performed_by: string;
  created_at: string;
  undone_at?: string | null;
  performedByUser?: { display_name: string | null; email: string };
  oldUser?: { display_name: string | null; email: string } | null;
  newUser?: { display_name: string | null; email: string } | null;
};

type ActionConfig = {
  label: string;
  icon: React.ReactNode;
  badgeClass: string;
};

const ACTION_CONFIG: Record<string, ActionConfig> = {
  publish: {
    label: 'Plan yayınlandı',
    icon: <Send className="size-3.5" />,
    badgeClass: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  },
  reassign: {
    label: 'Yerine görevlendirme',
    icon: <UserCog className="size-3.5" />,
    badgeClass: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  },
  absent_marked: {
    label: 'Devamsızlık işaretlendi',
    icon: <UserX className="size-3.5" />,
    badgeClass: 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300',
  },
  coverage_assigned: {
    label: 'Ders görevi atandı',
    icon: <BookOpen className="size-3.5" />,
    badgeClass: 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300',
  },
  swap_approved: {
    label: 'Takas onaylandı',
    icon: <ArrowLeftRight className="size-3.5" />,
    badgeClass: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  },
  duty_exempt_set: {
    label: 'Nöbet muafiyeti verildi',
    icon: <ShieldOff className="size-3.5" />,
    badgeClass: 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300',
  },
  duty_exempt_cleared: {
    label: 'Nöbet muafiyeti kaldırıldı',
    icon: <ShieldCheck className="size-3.5" />,
    badgeClass: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  },
  undo: {
    label: 'İşlem geri alındı',
    icon: <RotateCcw className="size-3.5" />,
    badgeClass: 'bg-gray-100 text-gray-700 dark:bg-gray-900/40 dark:text-gray-300',
  },
};

function userName(u?: { display_name: string | null; email: string } | null): string {
  if (!u) return '—';
  return u.display_name || u.email;
}

function describeLog(log: DutyLog): string {
  const performer = userName(log.performedByUser);
  const oldU = userName(log.oldUser);
  const newU = userName(log.newUser);

  switch (log.action) {
    case 'publish':
      return 'Plan yayınlandı.';
    case 'reassign':
      if (log.old_user_id && log.new_user_id) {
        return `${oldU} yerine ${newU} görevlendirildi.`;
      }
      if (log.new_user_id) {
        return `${newU} nöbete görevlendirildi.`;
      }
      return 'Nöbet yeniden atandı.';
    case 'absent_marked':
      if (log.old_user_id) {
        return `${oldU} gelmeyen olarak işaretlendi.`;
      }
      return 'Öğretmen gelmeyen olarak işaretlendi.';
    case 'coverage_assigned':
      if (log.new_user_id && log.old_user_id) {
        return `${newU}, ${oldU}'nın dersini üstlendi.`;
      }
      if (log.new_user_id) {
        return `${newU} ders görevine atandı.`;
      }
      return 'Ders görevi atandı.';
    case 'swap_approved':
      if (log.old_user_id && log.new_user_id) {
        return `${oldU}'nın nöbeti ${newU}'ya devredildi.`;
      }
      return 'Nöbet takası onaylandı.';
    case 'duty_exempt_set':
      if (log.new_user_id) {
        return `${newU} nöbet muafiyetine alındı.`;
      }
      if (log.old_user_id) {
        return `${oldU} nöbet muafiyetine alındı.`;
      }
      return `Nöbet muafiyeti uygulandı.`;
    case 'duty_exempt_cleared':
      if (log.old_user_id) {
        return `${oldU}'nın nöbet muafiyeti kaldırıldı.`;
      }
      return 'Nöbet muafiyeti kaldırıldı.';
    case 'undo':
      return `${performer} tarafından işlem geri alındı.`;
    default:
      return log.action;
  }
}

function formatDateTime(s: string) {
  const d = new Date(s);
  return d.toLocaleString('tr-TR', { dateStyle: 'short', timeStyle: 'short' });
}

function toYMD(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export default function DutyLogsPage() {
  const { token, me } = useAuth();
  const isAdmin = me?.role === 'school_admin';
  const [logs, setLogs] = useState<DutyLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [from, setFrom] = useState(() => { const d = new Date(); d.setFullYear(d.getFullYear() - 2); return toYMD(d); });
  const [to, setTo] = useState(() => toYMD(new Date()));
  const [action, setAction] = useState<string>('all');

  const fetchLogs = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const qs = new URLSearchParams();
      qs.set('limit', '200');
      if (from) qs.set('from', from);
      if (to) qs.set('to', to);
      if (action !== 'all') qs.set('action', action);
      const list = await apiFetch<DutyLog[]>(`/duty/logs?${qs.toString()}`, { token });
      setLogs(Array.isArray(list) ? list : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Loglar yüklenemedi.');
      setLogs([]);
    } finally {
      setLoading(false);
    }
  }, [token, from, to, action]);

  useEffect(() => {
    if (isAdmin) fetchLogs();
  }, [isAdmin, fetchLogs]);

  if (!isAdmin) {
    return <Alert variant="error" message="Bu sayfaya erişim yetkiniz yok." />;
  }

  const hasActiveFilter = action !== 'all';

  return (
    <div className="space-y-6">
      <DutyPageHeader
        icon={ScrollText}
        title="İşlem Kaydı"
        description="Plan yayınlama, yerine görevlendirme, devamsızlık ve muafiyet işlemlerinin geçmişi."
        color="amber"
        badge={
          logs.length > 0 ? (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
              {logs.length} kayıt
            </span>
          ) : undefined
        }
        actions={
          <Button variant="outline" size="sm" onClick={fetchLogs} disabled={loading}>
            <RefreshCw className={cn('size-4', loading && 'animate-spin')} />
            Yenile
          </Button>
        }
      />

      {/* Filtreler */}
      <div className="flex flex-wrap items-end gap-3 rounded-xl bg-muted/40 p-4 border border-border/50">
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Başlangıç</Label>
          <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="h-9 w-36" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Bitiş</Label>
          <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="h-9 w-36" />
        </div>
        <div className="space-y-1 min-w-[200px]">
          <Label className="text-xs text-muted-foreground">İşlem türü</Label>
          <Select value={action} onValueChange={setAction}>
            <SelectTrigger className="h-9">
              <SelectValue placeholder="Tümü" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tümü</SelectItem>
              <SelectItem value="publish">Plan yayınlandı</SelectItem>
              <SelectItem value="reassign">Yerine görevlendirme</SelectItem>
              <SelectItem value="absent_marked">Devamsızlık</SelectItem>
              <SelectItem value="coverage_assigned">Ders görevi atandı</SelectItem>
              <SelectItem value="duty_exempt_set">Muafiyet verildi</SelectItem>
              <SelectItem value="duty_exempt_cleared">Muafiyet kaldırıldı</SelectItem>
              <SelectItem value="undo">İşlem geri alındı</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {hasActiveFilter && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setAction('all')}
            className="h-9 text-muted-foreground"
          >
            <X className="size-4" />
            Temizle
          </Button>
        )}
      </div>

      {error && <Alert variant="error" message={error} />}

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <LoadingSpinner />
          <p className="text-sm text-muted-foreground">Kayıtlar yükleniyor…</p>
        </div>
      ) : !logs.length ? (
        <EmptyState
          icon={<ScrollText className="size-12 text-muted-foreground/50" />}
          title="Kayıt bulunamadı"
          description="Seçilen filtreler için işlem kaydı yok."
        />
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/40">
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground whitespace-nowrap">Tarih / Saat</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">İşlem</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Açıklama</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground whitespace-nowrap">Yapan</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log) => {
                    const cfg = ACTION_CONFIG[log.action] ?? {
                      label: log.action,
                      icon: <ScrollText className="size-3.5" />,
                      badgeClass: 'bg-muted text-muted-foreground',
                    };
                    const description = describeLog(log);
                    const isUndone = !!log.undone_at;
                    return (
                      <tr key={log.id} className={cn('border-b last:border-0 hover:bg-muted/30 transition-colors', isUndone && 'opacity-50')}>
                        <td className="px-4 py-3 text-muted-foreground text-xs font-mono whitespace-nowrap">
                          {formatDateTime(log.created_at)}
                          {isUndone && (
                            <div className="mt-0.5 text-[10px] text-rose-500 flex items-center gap-0.5">
                              <RotateCcw className="size-2.5" />
                              geri alındı
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <span className={cn(
                            'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium',
                            cfg.badgeClass,
                          )}>
                            {cfg.icon}
                            {cfg.label}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-foreground max-w-xs">
                          {description}
                        </td>
                        <td className="px-4 py-3">
                          <span className="font-medium text-foreground text-sm">
                            {log.performedByUser?.display_name || log.performedByUser?.email || '—'}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
