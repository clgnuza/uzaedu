'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import { format, subDays } from 'date-fns';
import { apiFetch } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/alert';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts';
import type { SmartBoardUsageStats, SmartBoardHealthAlerts } from '../types';
import { RefreshCw } from 'lucide-react';

function ymd(d: Date) {
  return format(d, 'yyyy-MM-dd');
}

export function SmartBoardUsagePanel({ token, schoolId }: { token: string | null; schoolId: string }) {
  const [to, setTo] = useState(() => ymd(new Date()));
  const [from, setFrom] = useState(() => ymd(subDays(new Date(), 6)));
  const [stats, setStats] = useState<SmartBoardUsageStats | null>(null);
  const [health, setHealth] = useState<SmartBoardHealthAlerts | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [filterClass, setFilterClass] = useState<string>('__all__');
  const [filterTeacher, setFilterTeacher] = useState<string>('__all__');

  const load = useCallback(async () => {
    if (!token || !schoolId) return;
    setLoading(true);
    setErr(null);
    try {
      const [s, h] = await Promise.all([
        apiFetch<SmartBoardUsageStats>(
          `/smart-board/schools/${schoolId}/usage-stats?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
          { token },
        ),
        apiFetch<SmartBoardHealthAlerts>(`/smart-board/schools/${schoolId}/health-alerts`, { token }),
      ]);
      setStats(s);
      setHealth(h);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Yüklenemedi');
      setStats(null);
      setHealth(null);
    } finally {
      setLoading(false);
    }
  }, [token, schoolId, from, to]);

  useEffect(() => {
    load();
  }, [load]);

  const classOptions = useMemo(() => {
    if (!stats) return [];
    const set = new Set<string>();
    for (const it of stats.items) {
      const k = it.class_section?.trim() || '—';
      set.add(k);
    }
    return [...set].sort((a, b) => a.localeCompare(b, 'tr'));
  }, [stats]);

  const teacherOptions = useMemo(() => {
    if (!stats) return [];
    const map = new Map<string, string | null>();
    for (const it of stats.items) {
      map.set(it.user_id, it.user_name);
    }
    return [...map.entries()]
      .map(([user_id, user_name]) => ({ user_id, user_name }))
      .sort((a, b) => (a.user_name || a.user_id).localeCompare(b.user_name || b.user_id, 'tr'));
  }, [stats]);

  const filteredItems = useMemo(() => {
    if (!stats) return [];
    return stats.items.filter((it) => {
      const ck = it.class_section?.trim() || '—';
      if (filterClass !== '__all__' && ck !== filterClass) return false;
      if (filterTeacher !== '__all__' && it.user_id !== filterTeacher) return false;
      return true;
    });
  }, [stats, filterClass, filterTeacher]);

  const hourChart = useMemo(
    () =>
      (stats?.by_hour_tr ?? []).map((x) => ({
        label: `${x.hour.toString().padStart(2, '0')}:00`,
        count: x.count,
      })),
    [stats],
  );

  const classChart = useMemo(
    () =>
      [...(stats?.by_class ?? [])]
        .sort((a, b) => b.minutes - a.minutes)
        .slice(0, 12)
        .map((c) => ({ name: c.key === '—' ? 'Sınıfsız' : c.key, dk: c.minutes })),
    [stats],
  );

  return (
    <div className="space-y-4">
      <Card className="overflow-hidden border-rose-200/45 dark:border-rose-900/35">
        <CardHeader className="flex flex-col gap-3 border-b border-border/60 px-3 py-3 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between sm:px-6 sm:py-4">
          <div>
            <CardTitle className="text-sm sm:text-base">Kullanım istatistikleri</CardTitle>
            <p className="mt-1 text-[11px] text-muted-foreground sm:text-xs">
              Tarih aralığı Türkiye saatiyle; süreler seçilen aralığa göre kırpılır (en fazla 90 gün).
            </p>
          </div>
          <div className="flex flex-wrap items-end gap-2">
            <div className="space-y-1">
              <Label className="text-xs">Başlangıç</Label>
              <input
                type="date"
                value={from}
                max={to}
                onChange={(e) => setFrom(e.target.value)}
                className="h-9 rounded-md border border-input bg-background px-2 text-sm"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Bitiş</Label>
              <input
                type="date"
                value={to}
                min={from}
                onChange={(e) => setTo(e.target.value)}
                className="h-9 rounded-md border border-input bg-background px-2 text-sm"
              />
            </div>
            <Button type="button" variant="secondary" size="sm" className="h-9 gap-1" onClick={() => load()} disabled={loading}>
              <RefreshCw className={`size-3.5 ${loading ? 'animate-spin' : ''}`} />
              Yenile
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4 px-3 py-4 sm:px-6">
          {err && <Alert variant="error">{err}</Alert>}

          {health && health.alerts.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-muted-foreground sm:text-sm">Tahta durumu ve uyarılar</p>
              {health.alerts.map((a, i) => (
                <Alert
                  key={`${a.code}-${a.device_id ?? ''}-${a.session_id ?? ''}-${i}`}
                  variant={a.severity === 'warning' ? 'warning' : 'info'}
                  className="py-2"
                >
                  <div>
                    <p className="font-medium">{a.title}</p>
                    <p className="mt-0.5 text-xs opacity-90">{a.detail}</p>
                  </div>
                </Alert>
              ))}
            </div>
          )}

          {loading && !stats ? (
            <div className="flex justify-center py-12">
              <LoadingSpinner />
            </div>
          ) : stats ? (
            <>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
                <div className="rounded-lg border bg-card p-3">
                  <p className="text-[10px] font-medium uppercase text-muted-foreground sm:text-xs">Oturum</p>
                  <p className="text-xl font-bold sm:text-2xl">{stats.totals.session_count}</p>
                </div>
                <div className="rounded-lg border bg-card p-3">
                  <p className="text-[10px] font-medium uppercase text-muted-foreground sm:text-xs">Toplam dk</p>
                  <p className="text-xl font-bold sm:text-2xl">{stats.totals.total_minutes}</p>
                </div>
                <div className="rounded-lg border bg-card p-3">
                  <p className="text-[10px] font-medium uppercase text-muted-foreground sm:text-xs">Sınıf</p>
                  <p className="text-xl font-bold sm:text-2xl">{stats.by_class.length}</p>
                </div>
                <div className="rounded-lg border bg-card p-3">
                  <p className="text-[10px] font-medium uppercase text-muted-foreground sm:text-xs">Öğretmen</p>
                  <p className="text-xl font-bold sm:text-2xl">{stats.by_teacher.length}</p>
                </div>
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                <Card>
                  <CardHeader className="py-3">
                    <CardTitle className="text-sm">Bağlanma saati (TR, aralıkta başlayan)</CardTitle>
                  </CardHeader>
                  <CardContent className="pb-4 pt-0">
                    <div className="h-56 w-full min-w-0">
                      <ResponsiveContainer width="100%" height={224} minWidth={0}>
                      <BarChart data={hourChart} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
                        <XAxis dataKey="label" tick={{ fontSize: 10 }} interval={2} />
                        <YAxis allowDecimals={false} tick={{ fontSize: 10 }} width={28} />
                        <Tooltip />
                        <Bar dataKey="count" name="Oturum" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="py-3">
                    <CardTitle className="text-sm">Sınıfa göre kullanım (dk)</CardTitle>
                  </CardHeader>
                  <CardContent className="pb-4 pt-0">
                    <div className="h-56 w-full min-w-0">
                      <ResponsiveContainer width="100%" height={224} minWidth={0}>
                      <BarChart layout="vertical" data={classChart} margin={{ top: 8, right: 16, left: 8, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" horizontal={false} />
                        <XAxis type="number" tick={{ fontSize: 10 }} />
                        <YAxis type="category" dataKey="name" width={72} tick={{ fontSize: 10 }} />
                        <Tooltip />
                        <Bar dataKey="dk" name="Dakika" fill="oklch(0.55 0.14 25)" radius={[0, 4, 4, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <div className="flex flex-wrap gap-3">
                <div className="min-w-[140px] flex-1 space-y-1">
                  <Label className="text-xs">Sınıf filtresi</Label>
                  <Select value={filterClass} onValueChange={setFilterClass}>
                    <SelectTrigger className="h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__all__">Tümü</SelectItem>
                      {classOptions.map((c) => (
                        <SelectItem key={c} value={c}>
                          {c}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="min-w-[160px] flex-1 space-y-1">
                  <Label className="text-xs">Öğretmen filtresi</Label>
                  <Select value={filterTeacher} onValueChange={setFilterTeacher}>
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="Tümü" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__all__">Tümü</SelectItem>
                      {teacherOptions.map((t) => (
                        <SelectItem key={t.user_id} value={t.user_id}>
                          {t.user_name || t.user_id.slice(0, 8)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="max-h-[min(50vh,420px)] overflow-auto rounded-lg border">
                <table className="w-full text-left text-xs sm:text-sm">
                  <thead className="sticky top-0 z-1 bg-muted/95 backdrop-blur">
                    <tr>
                      <th className="px-2 py-2 font-medium sm:px-3">Tahta</th>
                      <th className="px-2 py-2 font-medium sm:px-3">Sınıf</th>
                      <th className="px-2 py-2 font-medium sm:px-3">Öğretmen</th>
                      <th className="px-2 py-2 font-medium sm:px-3">Bağlandı</th>
                      <th className="px-2 py-2 font-medium sm:px-3">Ayrıldı</th>
                      <th className="px-2 py-2 text-right font-medium sm:px-3">Dk</th>
                      <th className="px-2 py-2 font-medium sm:px-3">Durum</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredItems.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-3 py-6 text-center text-muted-foreground">
                          Kayıt yok
                        </td>
                      </tr>
                    ) : (
                      filteredItems.map((row) => (
                        <tr key={row.id} className="border-t">
                          <td className="px-2 py-2 sm:px-3">{row.device_name}</td>
                          <td className="px-2 py-2 sm:px-3">{row.class_section ?? '—'}</td>
                          <td className="px-2 py-2 sm:px-3">{row.user_name ?? '—'}</td>
                          <td className="whitespace-nowrap px-2 py-2 sm:px-3">
                            {format(new Date(row.connected_at), 'dd.MM.yyyy HH:mm')}
                          </td>
                          <td className="whitespace-nowrap px-2 py-2 sm:px-3">
                            {row.disconnected_at ? format(new Date(row.disconnected_at), 'dd.MM.yyyy HH:mm') : '—'}
                          </td>
                          <td className="px-2 py-2 text-right sm:px-3">{row.minutes_in_range}</td>
                          <td className="px-2 py-2 sm:px-3">
                            {row.is_active ? (
                              <span className="text-emerald-600 dark:text-emerald-400">Aktif</span>
                            ) : (
                              <span className="text-muted-foreground">Kapalı</span>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
