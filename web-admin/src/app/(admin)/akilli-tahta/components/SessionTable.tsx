'use client';

import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Activity, Clock3, Filter, PowerOff, RefreshCw, Search } from 'lucide-react';
import type { Session } from '../types';

export function SessionTable({
  sessions,
  onDisconnect,
  onRefresh,
  canDisconnect = true,
}: {
  sessions: Session[];
  onDisconnect: (sessionId: string) => void;
  onRefresh: () => void;
  canDisconnect?: boolean;
}) {
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'closed'>('all');
  const [sortKey, setSortKey] = useState<'newest' | 'device' | 'teacher'>('newest');

  const activeCount = useMemo(() => sessions.filter((s) => s.is_active).length, [sessions]);
  const totalCount = sessions.length;

  const filteredSessions = useMemo(() => {
    const q = query.trim().toLocaleLowerCase('tr');
    const list = sessions.filter((s) => {
      if (statusFilter === 'active' && !s.is_active) return false;
      if (statusFilter === 'closed' && s.is_active) return false;
      if (!q) return true;
      const dev = (s.device_name ?? '').toLocaleLowerCase('tr');
      const usr = (s.user_name ?? '').toLocaleLowerCase('tr');
      return dev.includes(q) || usr.includes(q);
    });

    return [...list].sort((a, b) => {
      if (sortKey === 'device') return (a.device_name ?? '').localeCompare(b.device_name ?? '', 'tr');
      if (sortKey === 'teacher') return (a.user_name ?? '').localeCompare(b.user_name ?? '', 'tr');
      return new Date(b.connected_at).getTime() - new Date(a.connected_at).getTime();
    });
  }, [sessions, query, statusFilter, sortKey]);

  return (
    <Card className="mb-3 overflow-hidden border-emerald-200/45 dark:border-emerald-900/35 sm:mb-6">
      <CardHeader className="flex flex-row items-center justify-between gap-2 border-b border-emerald-200/40 bg-emerald-500/6 px-2.5 py-2 dark:border-emerald-900/40 sm:px-6 sm:py-4">
        <CardTitle className="flex min-w-0 items-center gap-2 text-sm sm:text-base">
          <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-emerald-500/15 sm:size-8">
            <Activity className="size-3.5 text-emerald-800 dark:text-emerald-300 sm:size-4" />
          </span>
          <span className="truncate">Oturumlar</span>
        </CardTitle>
        <Button variant="ghost" size="sm" className="h-8 w-8 shrink-0 p-0 sm:h-9 sm:w-9" onClick={onRefresh} aria-label="Yenile">
          <RefreshCw className="size-3.5 sm:size-4" />
        </Button>
      </CardHeader>
      <CardContent className="px-2 pb-3 pt-2 sm:px-6 sm:pb-6 sm:pt-4">
        <div className="mb-3 grid grid-cols-3 gap-2">
          <div className="rounded-lg border bg-card px-2 py-2">
            <p className="text-[10px] uppercase text-muted-foreground">Toplam</p>
            <p className="text-base font-semibold">{totalCount}</p>
          </div>
          <div className="rounded-lg border bg-card px-2 py-2">
            <p className="text-[10px] uppercase text-muted-foreground">Aktif</p>
            <p className="text-base font-semibold text-emerald-700 dark:text-emerald-300">{activeCount}</p>
          </div>
          <div className="rounded-lg border bg-card px-2 py-2">
            <p className="text-[10px] uppercase text-muted-foreground">Kapalı</p>
            <p className="text-base font-semibold text-muted-foreground">{Math.max(0, totalCount - activeCount)}</p>
          </div>
        </div>

        <div className="mb-3 grid gap-2 sm:grid-cols-3">
          <div className="relative sm:col-span-1">
            <Search className="pointer-events-none absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Tahta / öğretmen ara"
              className="h-9 w-full rounded-md border border-input bg-background py-1 pl-7 pr-2 text-xs sm:text-sm"
            />
          </div>
          <div className="sm:col-span-1">
            <label className="sr-only">Durum filtresi</label>
            <div className="flex h-9 items-center rounded-md border bg-background px-2 text-xs sm:text-sm">
              <Filter className="mr-1.5 size-3.5 text-muted-foreground" />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as 'all' | 'active' | 'closed')}
                className="w-full bg-transparent outline-none"
              >
                <option value="all">Durum: Tümü</option>
                <option value="active">Durum: Aktif</option>
                <option value="closed">Durum: Kapalı</option>
              </select>
            </div>
          </div>
          <div className="sm:col-span-1">
            <label className="sr-only">Sıralama</label>
            <div className="flex h-9 items-center rounded-md border bg-background px-2 text-xs sm:text-sm">
              <Clock3 className="mr-1.5 size-3.5 text-muted-foreground" />
              <select
                value={sortKey}
                onChange={(e) => setSortKey(e.target.value as 'newest' | 'device' | 'teacher')}
                className="w-full bg-transparent outline-none"
              >
                <option value="newest">Sıralama: En yeni</option>
                <option value="device">Sıralama: Tahta adı</option>
                <option value="teacher">Sıralama: Öğretmen adı</option>
              </select>
            </div>
          </div>
        </div>

        {filteredSessions.length === 0 ? (
          <EmptyState
            icon={<Activity className="size-10 text-muted-foreground" />}
            title={sessions.length === 0 ? 'Bağlantı yok' : 'Filtreye uygun kayıt yok'}
            description={sessions.length === 0 ? 'Bugün henüz tahtaya bağlanan olmadı.' : 'Arama veya filtre ayarını değiştirin.'}
          />
        ) : (
          <div className="table-x-scroll -mx-0.5">
            <table className="w-full min-w-[20rem] text-xs sm:min-w-0 sm:text-sm">
              <thead>
                <tr className="border-b bg-muted/40">
                  <th className="px-1.5 py-1.5 text-left font-semibold sm:px-3 sm:py-2">Tahta</th>
                  <th className="px-1.5 py-1.5 text-left font-semibold sm:px-3 sm:py-2">Öğretmen</th>
                  <th className="whitespace-nowrap px-1.5 py-1.5 text-left font-semibold sm:px-3 sm:py-2">Saat</th>
                  <th className="px-1.5 py-1.5 text-left font-semibold sm:px-3 sm:py-2">Durum</th>
                  <th className="px-1.5 py-1.5 text-left font-semibold sm:px-3 sm:py-2">İşlem</th>
                </tr>
              </thead>
              <tbody>
                {filteredSessions.map((s) => (
                  <tr key={s.id} className="border-b last:border-0">
                    <td className="max-w-28 truncate px-1.5 py-1.5 align-top sm:max-w-none sm:px-3 sm:py-2">{s.device_name}</td>
                    <td className="max-w-24 truncate px-1.5 py-1.5 align-top sm:max-w-none sm:px-3 sm:py-2">{s.user_name || '—'}</td>
                    <td className="whitespace-nowrap px-1.5 py-1.5 align-top tabular-nums sm:px-3 sm:py-2">
                      {new Date(s.connected_at).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td className="px-1.5 py-1.5 align-top sm:px-3 sm:py-2">
                      {s.is_active ? (
                        <span className="text-emerald-600 dark:text-emerald-400">Aktif</span>
                      ) : (
                        <span className="text-muted-foreground">Ayrıldı</span>
                      )}
                    </td>
                    <td className="px-1.5 py-1.5 align-top sm:px-3 sm:py-2">
                      {s.is_active && canDisconnect && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => onDisconnect(s.id)}
                          className="h-7 gap-0.5 px-1.5 text-[10px] text-amber-700 hover:text-amber-800 sm:h-8 sm:px-2 sm:text-xs"
                        >
                          <PowerOff className="size-3 sm:mr-0.5 sm:size-3.5" />
                          <span className="hidden sm:inline">Sonlandır</span>
                          <span className="sm:hidden">Kes</span>
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
