'use client';

import { useState, useEffect, useCallback } from 'react';
import { ScrollText, RotateCcw } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { apiFetch } from '@/lib/api';
import { toast } from 'sonner';
import {
  getDutyLogActionLabel,
  getDutyLogDetailLine,
  DUTY_LOG_ACTION_HINTS,
  DUTY_LOG_ACTION_LABELS,
} from '@/lib/duty-log-labels';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { EmptyState } from '@/components/ui/empty-state';
import { DutyPageHeader } from '@/components/duty/duty-page-header';
import { cn } from '@/lib/utils';

const UNDOABLE = new Set(['reassign', 'absent_marked', 'coverage_assigned', 'duty_exempt_set', 'duty_exempt_cleared']);

type DutyLogRow = {
  id: string;
  action: string;
  created_at: string;
  undone_at: string | null;
  performedByUser?: { display_name: string | null; email: string };
  oldUser?: { display_name: string | null; email: string } | null;
  newUser?: { display_name: string | null; email: string } | null;
};

function formatWhen(iso: string) {
  try {
    const d = new Date(iso);
    return d.toLocaleString('tr-TR', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

export default function DutyLogsPage() {
  const { token, me } = useAuth();
  const isAdmin = me?.role === 'school_admin';
  const [logs, setLogs] = useState<DutyLogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [undoingId, setUndoingId] = useState<string | null>(null);

  const fetchLogs = useCallback(async () => {
    if (!token || !isAdmin) return;
    setLoading(true);
    try {
      const list = await apiFetch<DutyLogRow[]>('/duty/logs?limit=100', { token });
      setLogs(Array.isArray(list) ? list : []);
    } catch {
      setLogs([]);
    } finally {
      setLoading(false);
    }
  }, [token, isAdmin]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const handleUndo = async (logId: string) => {
    if (!token) return;
    setUndoingId(logId);
    try {
      await apiFetch(`/duty/undo/${logId}`, { token, method: 'POST' });
      toast.success('��lem geri al�nd�.');
      await fetchLogs();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Geri al�namad�.');
    } finally {
      setUndoingId(null);
    }
  };

  if (!isAdmin) {
    return <p className="text-muted-foreground">Bu sayfaya eri�im yetkiniz yok.</p>;
  }

  const glossaryEntries = Object.keys(DUTY_LOG_ACTION_LABELS).filter((k) => DUTY_LOG_ACTION_HINTS[k]);

  return (
    <div className="space-y-6">
      <DutyPageHeader
        icon={ScrollText}
        title="��lem kayd�"
        description="N�bet plan�, ders g�revi ve devams�zl�kla ilgili yap�lan i�lemlerin listesi."
        color="primary"
      />

      <Card>
        <CardHeader className="space-y-2">
          <CardTitle className="text-base">Terimler</CardTitle>
          <div className="text-sm leading-relaxed text-muted-foreground space-y-1.5">
            {glossaryEntries.map((key) => (
              <p key={key}>
                <span className="font-medium text-foreground">{DUTY_LOG_ACTION_LABELS[key]}:</span>{' '}
                {DUTY_LOG_ACTION_HINTS[key]}
              </p>
            ))}
          </div>
        </CardHeader>
      </Card>

      {loading ? (
        <div className="flex justify-center py-12">
          <LoadingSpinner />
        </div>
      ) : logs.length === 0 ? (
        <EmptyState icon={<ScrollText className="size-10 text-muted-foreground" />} title="Kay�t yok" description="Hen�z i�lem kayd� bulunmuyor." />
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="table-x-scroll">
              <table className="evrak-admin-table w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground whitespace-nowrap">Zaman</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">��lem</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground hidden md:table-cell">�lgili ki�iler</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">��lemi yapan</th>
                    <th className="px-4 py-3 text-right font-medium text-muted-foreground w-28">Durum</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log) => {
                    const detail = getDutyLogDetailLine(log);
                    const ageMs = Date.now() - new Date(log.created_at).getTime();
                    const canUndo =
                      !log.undone_at && ageMs < 24 * 60 * 60 * 1000 && UNDOABLE.has(log.action);
                    const label = getDutyLogActionLabel(log.action);
                    const unknown = !DUTY_LOG_ACTION_LABELS[log.action];

                    return (
                      <tr key={log.id} className={cn('border-b last:border-0', log.undone_at && 'opacity-60 bg-muted/20')}>
                        <td className="px-4 py-3 text-muted-foreground tabular-nums whitespace-nowrap align-top">
                          {formatWhen(log.created_at)}
                        </td>
                        <td className="px-4 py-3 align-top">
                          <span className="font-medium text-foreground">{label}</span>
                          {unknown && (
                            <span className="ml-1.5 text-xs text-muted-foreground font-mono" title="Sistem kodu">
                              ({log.action})
                            </span>
                          )}
                          <p className="md:hidden mt-1 text-xs text-muted-foreground">{detail ?? '�'}</p>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground align-top hidden md:table-cell max-w-[240px]">
                          {detail ?? '�'}
                        </td>
                        <td className="px-4 py-3 align-top">
                          <span className="text-muted-foreground">
                            {log.performedByUser?.display_name || log.performedByUser?.email || '�'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right align-top whitespace-nowrap">
                          {log.undone_at ? (
                            <span className="text-xs text-muted-foreground italic">Geri al�nd�</span>
                          ) : canUndo ? (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 gap-1 text-xs text-orange-600 hover:text-orange-700"
                              onClick={() => handleUndo(log.id)}
                              disabled={undoingId === log.id}
                            >
                              {undoingId === log.id ? <LoadingSpinner className="size-3" /> : <RotateCcw className="size-3" />}
                              Geri al
                            </Button>
                          ) : (
                            <span className="text-xs text-muted-foreground">�</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p className="px-4 py-3 text-xs text-muted-foreground border-t bg-muted/20">
              Son 100 kay�t g�sterilir. <strong>Geri al</strong> yaln�zca son 24 saat i�indeki ve uygun i�lem t�rleri i�in kullan�labilir.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

