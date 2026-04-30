'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Files, Trash2, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/use-auth';
import { apiFetch } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { LoadingSpinner } from '@/components/ui/loading-spinner';

export type SchoolTimetablePlanRow = {
  id: string;
  name: string | null;
  valid_from: string;
  valid_until: string | null;
  status: string;
  academic_year?: string | null;
  entry_count: number;
  created_at?: string;
};

function fmtDate(s: string): string {
  return new Date(s + 'T12:00:00').toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

type Props = {
  /** Okul programı kartı içinde: dış Card sarmalayıcı kullanılmaz */
  embedded?: boolean;
  onChanged?: () => void;
};

export function SchoolTimetableDraftsPanel({ embedded, onChanged }: Props) {
  const { token, me } = useAuth();
  const [plans, setPlans] = useState<SchoolTimetablePlanRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const isAdmin = me?.role === 'school_admin';
  const drafts = useMemo(() => plans.filter((p) => p.status === 'draft'), [plans]);

  const load = useCallback(async () => {
    if (!token || !isAdmin) return;
    setLoading(true);
    try {
      const list = await apiFetch<SchoolTimetablePlanRow[]>('/teacher-timetable/plans', { token });
      setPlans(Array.isArray(list) ? list : []);
    } catch {
      setPlans([]);
    } finally {
      setLoading(false);
    }
  }, [token, isAdmin]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleDelete = async (id: string) => {
    if (!token || !confirm('Bu taslağı silmek istediğinize emin misiniz?')) return;
    setDeletingId(id);
    try {
      await apiFetch(`/teacher-timetable/plans/${id}`, { token, method: 'DELETE' });
      toast.success('Taslak silindi.');
      await load();
      onChanged?.();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Silinemedi.');
    } finally {
      setDeletingId(null);
    }
  };

  if (!isAdmin) return null;

  const table = loading ? (
    <div className="flex justify-center py-12">
      <LoadingSpinner className="size-8" />
    </div>
  ) : drafts.length === 0 ? (
    <p className="py-8 text-center text-sm text-muted-foreground">
      Taslak yok.{' '}
      <Link href="/ders-programi/olustur" className="font-medium text-primary underline underline-offset-2">
        Excel ile yükle
      </Link>
    </p>
  ) : (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[520px] text-sm">
        <thead>
          <tr className="border-b text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            <th className="py-2 pr-3">Plan</th>
            <th className="py-2 pr-3">Tarih aralığı</th>
            <th className="py-2 pr-3">Oluşturma</th>
            <th className="py-2 text-right">Ders</th>
            <th className="py-2 text-right">İşlem</th>
          </tr>
        </thead>
        <tbody>
          {drafts.map((p) => (
            <tr key={p.id} className="border-b border-border/60">
              <td className="py-2 pr-3 font-medium">{p.name || p.academic_year || 'Taslak'}</td>
              <td className="py-2 pr-3 text-muted-foreground">
                {fmtDate(p.valid_from)}
                {p.valid_until ? ` – ${fmtDate(p.valid_until)}` : ''}
              </td>
              <td className="py-2 pr-3 text-xs text-muted-foreground">
                {p.created_at ? new Date(p.created_at).toLocaleString('tr-TR') : '—'}
              </td>
              <td className="py-2 text-right tabular-nums">{p.entry_count}</td>
              <td className="py-2 text-right">
                <div className="flex justify-end gap-1.5">
                  <Button size="sm" variant="outline" className="h-8 gap-1 px-2" asChild>
                    <Link href={`/ders-programi/olustur?plan=${encodeURIComponent(p.id)}`}>
                      <ExternalLink className="size-3.5" />
                      Yayınla
                    </Link>
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-8 gap-1 px-2 text-destructive hover:bg-destructive/10 hover:text-destructive"
                    disabled={deletingId === p.id}
                    onClick={() => handleDelete(p.id)}
                  >
                    <Trash2 className="size-3.5" />
                    {deletingId === p.id ? '…' : 'Sil'}
                  </Button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  if (embedded) {
    return (
      <div className="min-w-0 rounded-xl border border-slate-200/80 bg-slate-50/40 p-4 dark:border-slate-800/80 dark:bg-slate-950/25">
        <div className="mb-3 flex items-center gap-2">
          <Files className="size-5 text-slate-600 dark:text-slate-400" />
          <h3 className="text-sm font-bold text-foreground">Taslaklar ({drafts.length})</h3>
        </div>
        {table}
      </div>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center gap-2 space-y-0">
        <Files className="size-5 text-slate-600" />
        <CardTitle className="text-base">Taslaklar ({drafts.length})</CardTitle>
      </CardHeader>
      <CardContent>{table}</CardContent>
    </Card>
  );
}
