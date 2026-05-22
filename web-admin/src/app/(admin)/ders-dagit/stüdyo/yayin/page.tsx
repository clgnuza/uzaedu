'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { useDersDagitStudio } from '@/hooks/use-ders-dagit-studio';
import { apiFetch } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import Link from 'next/link';
import { ProgramGridPreview } from '@/components/ders-dagit/program-grid-preview';
import { downloadDersDagitExport } from '@/lib/ders-dagit-api';
import { Star } from 'lucide-react';

type Program = {
  id: string;
  name: string | null;
  status: string;
  score: number | null;
  published_plan_id?: string | null;
  is_favorite?: boolean;
};

type AuditRow = { id: string; action: string; user_label: string | null; created_at: string; detail: Record<string, unknown> };

export default function YayinPage() {
  const { token } = useAuth();
  const { studio, refresh } = useDersDagitStudio();
  const [programs, setPrograms] = useState<Program[]>([]);
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [previewEntries, setPreviewEntries] = useState<
    Array<{
      id: string;
      day_of_week: number;
      lesson_num: number;
      class_section: string;
      subject: string;
      is_locked?: boolean;
    }>
  >([]);
  const [editEntryId, setEditEntryId] = useState('');
  const [editDay, setEditDay] = useState(1);
  const [editLesson, setEditLesson] = useState(1);
  const [editLock, setEditLock] = useState(false);
  const [validFrom, setValidFrom] = useState(() => new Date().toISOString().slice(0, 10));
  const [validUntil, setValidUntil] = useState('');
  const [audit, setAudit] = useState<AuditRow[]>([]);

  const load = useCallback(async () => {
    if (!token || !studio) return;
    const [list, logs] = await Promise.all([
      apiFetch<Program[]>(`/ders-dagit/studios/${studio.id}/programs`, { token }),
      apiFetch<AuditRow[]>(`/ders-dagit/studios/${studio.id}/audit-log`, { token }),
    ]);
    setPrograms(list);
    setAudit(logs);
  }, [token, studio]);

  useEffect(() => {
    void load();
  }, [load]);

  async function loadPreview(id: string) {
    if (!token || !studio) return;
    const res = await apiFetch<{ entries: typeof previewEntries }>(
      `/ders-dagit/studios/${studio.id}/programs/${id}`,
      { token },
    );
    setPreviewId(id);
    setPreviewEntries(res.entries);
    const first = res.entries[0];
    if (first) {
      setEditEntryId(first.id);
      setEditDay(first.day_of_week);
      setEditLesson(first.lesson_num);
      setEditLock(!!first.is_locked);
    }
  }

  async function council() {
    if (!token || !studio) return;
    await apiFetch(`/ders-dagit/studios/${studio.id}/council-review`, { token, method: 'POST' });
    toast.success('Kurul incelemesi');
    await refresh();
  }

  async function favorite(id: string) {
    if (!token || !studio) return;
    await apiFetch(`/ders-dagit/studios/${studio.id}/programs/${id}/favorite`, { token, method: 'POST' });
    toast.success('Favori işaretlendi');
    await load();
  }

  async function saveEntry() {
    if (!token || !studio || !previewId || !editEntryId) return;
    try {
      await apiFetch(`/ders-dagit/studios/${studio.id}/programs/${previewId}/entries/${editEntryId}`, {
        token,
        method: 'PATCH',
        body: { day_of_week: editDay, lesson_num: editLesson, is_locked: editLock },
      });
      toast.success('Slot güncellendi');
      await loadPreview(previewId);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Kayıt başarısız');
    }
  }

  async function exportProg(id: string, kind: 'csv' | 'eokul' | 'pdf') {
    if (!token || !studio) return;
    try {
      await downloadDersDagitExport(token, studio.id, id, kind);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'İndirme başarısız');
    }
  }

  async function publish(id: string) {
    if (!token || !studio) return;
    try {
      const res = await apiFetch<{ plan_id: string; imported: number }>(
        `/ders-dagit/studios/${studio.id}/programs/${id}/publish`,
        {
          token,
          method: 'POST',
          body: {
            valid_from: validFrom,
            valid_until: validUntil.trim() || null,
          },
        },
      );
      toast.success(`Yayınlandı — ${res.imported} satır (plan ${res.plan_id.slice(0, 8)}…)`);
      await load();
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Yayın başarısız');
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Süreç</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap items-end gap-4">
          <div>
            <Label>Geçerlilik başlangıç</Label>
            <Input type="date" value={validFrom} onChange={(e) => setValidFrom(e.target.value)} />
          </div>
          <div>
            <Label>Bitiş (boş = açık uçlu)</Label>
            <Input type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} />
          </div>
          <Button type="button" variant="secondary" onClick={() => void council()}>
            Kurula al
          </Button>
          <Button type="button" variant="outline" asChild>
            <Link href="/ders-dagit/tercihler">Tercihler</Link>
          </Button>
          <Button type="button" variant="outline" asChild>
            <Link href="/ders-programi/programlarim">Mevcut ders programı</Link>
          </Button>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Programlar</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2 text-sm">
            {programs.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2">
                <span>
                  {p.name ?? p.id.slice(0, 8)} · {p.status} · skor {p.score ?? '—'}
                  {p.published_plan_id ? ` · plan ${p.published_plan_id.slice(0, 8)}` : ''}
                </span>
                <span className="flex flex-wrap gap-2">
                  <Button type="button" size="sm" variant="outline" onClick={() => void loadPreview(p.id)}>
                    Önizle
                  </Button>
                  <Button type="button" size="sm" variant="outline" onClick={() => void exportProg(p.id, 'csv')}>
                    CSV
                  </Button>
                  <Button type="button" size="sm" variant="outline" onClick={() => void exportProg(p.id, 'eokul')}>
                    e-Okul
                  </Button>
                  <Button type="button" size="sm" variant="outline" onClick={() => void exportProg(p.id, 'pdf')}>
                    PDF
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={p.is_favorite ? 'default' : 'ghost'}
                    onClick={() => void favorite(p.id)}
                    title="Favori"
                  >
                    <Star className={p.is_favorite ? 'size-4 fill-current' : 'size-4'} />
                  </Button>
                  {p.status !== 'published' && (
                    <Button type="button" size="sm" onClick={() => void publish(p.id)}>
                      Yayınla → ders programı
                    </Button>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Denetim kaydı</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="max-h-40 space-y-1 overflow-y-auto text-xs text-muted-foreground">
            {audit.map((a) => (
              <li key={a.id}>
                {new Date(a.created_at).toLocaleString('tr-TR')} · {a.action}
                {a.user_label ? ` · ${a.user_label}` : ''}
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
      {previewEntries.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Grid önizleme</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <ProgramGridPreview entries={previewEntries} />
            {previewEntries.length > 0 && (
              <div className="flex flex-wrap items-end gap-2 border-t pt-3 text-sm">
                <select
                  className="h-9 rounded-md border px-2 text-xs"
                  value={editEntryId}
                  onChange={(e) => {
                    const id = e.target.value;
                    setEditEntryId(id);
                    const row = previewEntries.find((x) => x.id === id);
                    if (row) {
                      setEditDay(row.day_of_week);
                      setEditLesson(row.lesson_num);
                      setEditLock(!!row.is_locked);
                    }
                  }}
                >
                  {previewEntries.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.class_section} · {r.subject} ({r.day_of_week}/{r.lesson_num})
                    </option>
                  ))}
                </select>
                <Input type="number" className="h-9 w-14" min={1} max={7} value={editDay} onChange={(e) => setEditDay(Number(e.target.value))} />
                <Input type="number" className="h-9 w-14" min={1} value={editLesson} onChange={(e) => setEditLesson(Number(e.target.value))} />
                <label className="flex items-center gap-1 text-xs">
                  <input type="checkbox" checked={editLock} onChange={(e) => setEditLock(e.target.checked)} />
                  Kilit
                </label>
                <Button type="button" size="sm" onClick={() => void saveEntry()}>
                  Kaydet
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
