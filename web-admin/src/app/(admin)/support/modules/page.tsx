'use client';

import { useEffect, useState } from 'react';
import { Puzzle, Plus, Pencil, HelpCircle } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { Toolbar, ToolbarHeading, ToolbarPageTitle } from '@/components/layout/toolbar';
import { ToolbarIconHints } from '@/components/layout/toolbar-icon-hints';
import { apiFetch } from '@/lib/api';
import { Card, CardContent } from '@/components/ui/card';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert } from '@/components/ui/alert';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

type TicketModule = {
  id: string;
  name: string;
  icon_key: string;
  target_availability: 'SCHOOL_ONLY' | 'PLATFORM_ONLY' | 'BOTH';
  is_active: boolean;
  sort_order: number;
};

export default function SupportModulesPage() {
  const { token, me } = useAuth();
  const [modules, setModules] = useState<TicketModule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<TicketModule | null>(null);
  const [form, setForm] = useState({
    name: '',
    icon_key: 'help-circle',
    target_availability: 'BOTH' as 'SCHOOL_ONLY' | 'PLATFORM_ONLY' | 'BOTH',
    is_active: true,
    sort_order: 0,
  });
  const [submitting, setSubmitting] = useState(false);

  const load = () => {
    if (!token || me?.role !== 'superadmin') return;
    setLoading(true);
    apiFetch<TicketModule[]>('/ticket-modules/admin', { token })
      .then(setModules)
      .catch((e) => {
        setError(e instanceof Error ? e.message : 'Yüklenemedi');
        setModules([]);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => load(), [token, me?.role]);

  useEffect(() => {
    if (me?.role !== 'superadmin') window.location.replace('/403');
  }, [me?.role]);

  const handleCreate = async () => {
    if (!token || !form.name.trim()) return;
    setSubmitting(true);
    try {
      await apiFetch('/ticket-modules', {
        method: 'POST',
        token,
        body: JSON.stringify(form),
      });
      setCreateOpen(false);
      setForm({ name: '', icon_key: 'help-circle', target_availability: 'BOTH', is_active: true, sort_order: 0 });
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Kaydedilemedi');
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdate = async () => {
    if (!token || !editing) return;
    setSubmitting(true);
    try {
      await apiFetch(`/ticket-modules/${editing.id}`, {
        method: 'PATCH',
        token,
        body: JSON.stringify(form),
      });
      setEditOpen(false);
      setEditing(null);
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Güncellenemedi');
    } finally {
      setSubmitting(false);
    }
  };

  const openEdit = (m: TicketModule) => {
    setEditing(m);
    setForm({
      name: m.name,
      icon_key: m.icon_key,
      target_availability: m.target_availability,
      is_active: m.is_active,
      sort_order: m.sort_order,
    });
    setEditOpen(true);
  };

  if (me?.role !== 'superadmin') return null;

  return (
    <div className="space-y-4">
      <Toolbar>
        <ToolbarHeading>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10">
                <Puzzle className="size-5 text-primary" />
              </div>
              <div>
                <ToolbarPageTitle className="text-base">Destek Modülleri</ToolbarPageTitle>
                <ToolbarIconHints
                  compact
                  items={[
                    { label: 'Modül listesi', icon: Puzzle },
                    { label: 'Talep formu', icon: HelpCircle },
                  ]}
                  summary="Talep açarken seçilen modül listesi."
                />
              </div>
            </div>
            <Button size="sm" onClick={() => setCreateOpen(true)}>
              <Plus className="size-3.5 mr-1.5" />
              Yeni Modül
            </Button>
          </div>
        </ToolbarHeading>
      </Toolbar>

      {error && <Alert variant="error" message={error} className="py-2" />}
      {loading && <LoadingSpinner label="Yükleniyor…" className="py-8" />}
      {!loading && (
        <div className="space-y-2">
          {modules.map((m, idx) => {
            const pastelVariants = ['mint', 'lavender', 'peach', 'sky', 'rose', 'amber', 'teal', 'indigo', 'violet'] as const;
            const variant = pastelVariants[idx % pastelVariants.length];
            return (
              <Card key={m.id} variant={variant}>
                <CardContent className="py-3 px-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-white/60 dark:bg-black/10">
                        <HelpCircle className="size-4 text-muted-foreground" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-foreground">{m.name}</p>
                        <p className="text-[11px] text-muted-foreground">
                          {m.target_availability} • {m.sort_order}. sıra • {m.is_active ? (
                            <span className="text-emerald-600 dark:text-emerald-400">Aktif</span>
                          ) : (
                            <span className="text-zinc-500">Pasif</span>
                          )}
                        </p>
                      </div>
                    </div>
                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0 shrink-0" onClick={() => openEdit(m)}>
                      <Pencil className="size-3.5" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
          {!modules.length && (
            <Card>
              <CardContent className="py-8">
                <p className="text-center text-sm text-muted-foreground">Modül yok</p>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Yeni Modül</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>Ad</Label>
              <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="örn. Akıllı Tahta" />
            </div>
            <div>
              <Label>Kullanılabilirlik</Label>
              <select
                value={form.target_availability}
                onChange={(e) => setForm((f) => ({ ...f, target_availability: e.target.value as any }))}
                className="w-full rounded border px-3 py-2 text-sm"
              >
                <option value="SCHOOL_ONLY">Sadece Okul</option>
                <option value="PLATFORM_ONLY">Sadece Platform</option>
                <option value="BOTH">Her ikisi</option>
              </select>
            </div>
            <div>
              <Label>İkon</Label>
              <Input value={form.icon_key} onChange={(e) => setForm((f) => ({ ...f, icon_key: e.target.value }))} placeholder="help-circle" />
            </div>
            <div>
              <Label>Sıra</Label>
              <Input type="number" value={form.sort_order} onChange={(e) => setForm((f) => ({ ...f, sort_order: parseInt(e.target.value, 10) || 0 }))} />
            </div>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={form.is_active} onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.checked }))} />
              Aktif
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>İptal</Button>
            <Button onClick={handleCreate} disabled={submitting || !form.name.trim()}>Oluştur</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Modül Düzenle</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>Ad</Label>
              <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
            </div>
            <div>
              <Label>Kullanılabilirlik</Label>
              <select
                value={form.target_availability}
                onChange={(e) => setForm((f) => ({ ...f, target_availability: e.target.value as any }))}
                className="w-full rounded border px-3 py-2 text-sm"
              >
                <option value="SCHOOL_ONLY">Sadece Okul</option>
                <option value="PLATFORM_ONLY">Sadece Platform</option>
                <option value="BOTH">Her ikisi</option>
              </select>
            </div>
            <div>
              <Label>İkon</Label>
              <Input value={form.icon_key} onChange={(e) => setForm((f) => ({ ...f, icon_key: e.target.value }))} />
            </div>
            <div>
              <Label>Sıra</Label>
              <Input type="number" value={form.sort_order} onChange={(e) => setForm((f) => ({ ...f, sort_order: parseInt(e.target.value, 10) || 0 }))} />
            </div>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={form.is_active} onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.checked }))} />
              Aktif
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>İptal</Button>
            <Button onClick={handleUpdate} disabled={submitting}>Kaydet</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
