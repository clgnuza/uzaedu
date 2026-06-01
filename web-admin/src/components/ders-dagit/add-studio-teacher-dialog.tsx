'use client';

import { useCallback, useEffect, useState } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { apiFetch } from '@/lib/api';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

type Candidate = {
  id: string;
  display_name: string;
  email: string;
  teacher_branch: string | null;
  source: 'school' | 'assignment' | 'admin';
};

const SOURCE_LABEL: Record<Candidate['source'], string> = {
  school: 'Okul kadrosu',
  assignment: 'Görevlendirme',
  admin: 'Yönetici',
};

type Tab = 'pick' | 'external';

export function AddStudioTeacherDialog({
  open,
  onOpenChange,
  token,
  studioId,
  onAdded,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  token: string | null;
  studioId: string;
  onAdded: () => void | Promise<void>;
}) {
  const [tab, setTab] = useState<Tab>('pick');
  const [q, setQ] = useState('');
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState('');
  const [branch, setBranch] = useState('');

  const loadCandidates = useCallback(async () => {
    if (!token || !studioId) return;
    setLoading(true);
    try {
      const list = await apiFetch<Candidate[]>(
        `/ders-dagit/studios/${studioId}/teachers/candidates${q.trim() ? `?q=${encodeURIComponent(q.trim())}` : ''}`,
        { token },
      );
      setCandidates(Array.isArray(list) ? list : []);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Liste alınamadı');
      setCandidates([]);
    } finally {
      setLoading(false);
    }
  }, [token, studioId, q]);

  useEffect(() => {
    if (!open || tab !== 'pick') return;
    const t = window.setTimeout(() => void loadCandidates(), 200);
    return () => window.clearTimeout(t);
  }, [open, tab, loadCandidates]);

  useEffect(() => {
    if (!open) {
      setTab('pick');
      setQ('');
      setName('');
      setBranch('');
      setCandidates([]);
    }
  }, [open]);

  async function addUser(userId: string) {
    if (!token) return;
    setBusy(true);
    try {
      await apiFetch(`/ders-dagit/studios/${studioId}/teachers/add`, {
        token,
        method: 'POST',
        body: { user_id: userId },
      });
      toast.success('Öğretmen programa eklendi');
      await onAdded();
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Eklenemedi');
    } finally {
      setBusy(false);
    }
  }

  async function addExternal() {
    if (!token) return;
    setBusy(true);
    try {
      await apiFetch(`/ders-dagit/studios/${studioId}/teachers/external`, {
        token,
        method: 'POST',
        body: { display_name: name.trim(), branch: branch.trim() || null },
      });
      toast.success('Program öğretmeni eklendi');
      await onAdded();
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Eklenemedi');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <h2 className="text-lg font-semibold">Öğretmen ekle</h2>
        <p className="text-sm text-muted-foreground">
          Okul kadrosu ve görevlendirme dışında kalanlar için «Program kaydı» kullanın (yalnızca dağıtımda görünür).
        </p>
        <div className="flex gap-2">
          <Button
            type="button"
            size="sm"
            variant={tab === 'pick' ? 'default' : 'outline'}
            onClick={() => setTab('pick')}
          >
            Okul / görevlendirme
          </Button>
          <Button
            type="button"
            size="sm"
            variant={tab === 'external' ? 'default' : 'outline'}
            onClick={() => setTab('external')}
          >
            Program kaydı
          </Button>
        </div>

        {tab === 'pick' ? (
          <div className="space-y-3">
            <div>
              <Label htmlFor="dd-teacher-cand-q">Ara</Label>
              <Input
                id="dd-teacher-cand-q"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Ad, e-posta veya branş"
                className="mt-1"
              />
            </div>
            <ul className="max-h-64 space-y-1 overflow-y-auto rounded-lg border p-1">
              {loading && <li className="p-2 text-sm text-muted-foreground">Yükleniyor…</li>}
              {!loading && candidates.length === 0 && (
                <li className="p-2 text-sm text-muted-foreground">Eklenecek kayıt yok (hepsi programda olabilir).</li>
              )}
              {candidates.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    disabled={busy}
                    className={cn(
                      'flex w-full items-start justify-between gap-2 rounded-md px-2 py-2 text-left text-sm hover:bg-muted/80',
                    )}
                    onClick={() => void addUser(c.id)}
                  >
                    <span>
                      <span className="font-medium">{c.display_name}</span>
                      {c.teacher_branch && (
                        <span className="ml-1 text-muted-foreground">· {c.teacher_branch}</span>
                      )}
                      <span className="mt-0.5 block text-xs text-muted-foreground">{c.email}</span>
                    </span>
                    <span className="shrink-0 text-[10px] uppercase text-muted-foreground">
                      {SOURCE_LABEL[c.source]}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <div className="space-y-3">
            <div>
              <Label htmlFor="dd-ext-name">Ad soyad</Label>
              <Input
                id="dd-ext-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Örn. Görevli Öğretmen"
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="dd-ext-branch">Branş (isteğe bağlı)</Label>
              <Input
                id="dd-ext-branch"
                value={branch}
                onChange={(e) => setBranch(e.target.value)}
                placeholder="Matematik"
                className="mt-1"
              />
            </div>
            <Button type="button" disabled={busy || name.trim().length < 2} onClick={() => void addExternal()}>
              Ekle
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
