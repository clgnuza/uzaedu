'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Headphones, ArrowLeft, Building2, Send, Users } from 'lucide-react';
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
import { TicketAttachmentInput } from '@/components/ticket-attachment-input';

type TicketModule = { id: string; name: string; icon_key: string; target_availability: string };

export default function NewTicketPage() {
  const router = useRouter();
  const { token, me } = useAuth();
  const [modules, setModules] = useState<TicketModule[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [targetType, setTargetType] = useState<'SCHOOL_SUPPORT' | 'PLATFORM_SUPPORT'>('SCHOOL_SUPPORT');
  const [moduleId, setModuleId] = useState('');
  const [issueType, setIssueType] = useState<'BUG' | 'QUESTION' | 'REQUEST' | 'IMPROVEMENT'>('QUESTION');
  const [priority, setPriority] = useState<'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT'>('MEDIUM');
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [attachments, setAttachments] = useState<{ key: string; filename: string; mime_type?: string; size_bytes?: number }[]>([]);

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    const target = targetType === 'PLATFORM_SUPPORT' ? 'PLATFORM_SUPPORT' : 'SCHOOL_SUPPORT';
    apiFetch<TicketModule[]>(`/tickets/modules?target_type=${target}`, { token })
      .then((list) => {
        setModules(list);
        if (list.length && !moduleId) setModuleId(list[0].id);
        else if (!list.some((m) => m.id === moduleId) && list.length) setModuleId(list[0].id);
      })
      .catch(() => setModules([]))
      .finally(() => setLoading(false));
  }, [token, targetType]);

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
      setError(err instanceof Error ? err.message : 'Talep oluşturulamadı');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      <Toolbar>
        <ToolbarHeading>
          <div className="flex items-center gap-3">
            <button onClick={() => router.back()} className="rounded-lg p-1.5 hover:bg-muted" aria-label="Geri">
              <ArrowLeft className="size-4" />
            </button>
            <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10">
              <Headphones className="size-4 text-primary" />
            </div>
            <div>
              <ToolbarPageTitle className="text-base">Yeni Destek Talebi</ToolbarPageTitle>
              <ToolbarIconHints
                compact
                items={[
                  { label: 'Talep ilet', icon: Send },
                  { label: 'Okul / platform', icon: Building2 },
                  { label: 'Destek', icon: Headphones },
                ]}
                summary="Destek ekibine sorun veya talebinizi iletin."
              />
            </div>
          </div>
        </ToolbarHeading>
      </Toolbar>

      {error && <Alert variant="error" message={error} className="py-2" />}

      <Card>
        <CardContent className="pt-4">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2 rounded-xl border border-border bg-muted/20 p-4">
              <Label className="text-sm font-medium">Destek Kapsamı</Label>
              <p className="text-xs text-muted-foreground">Talebin hangi birime iletileceğini seçin</p>
              <div className="grid gap-3 sm:grid-cols-2">
                <label
                  className={[
                    'flex cursor-pointer flex-col gap-2 rounded-xl border-2 p-4 transition-all',
                    targetType === 'SCHOOL_SUPPORT'
                      ? 'border-primary bg-primary/5 shadow-sm'
                      : 'border-transparent bg-card hover:border-muted-foreground/30',
                  ].join(' ')}
                >
                  <input
                    type="radio"
                    name="target"
                    checked={targetType === 'SCHOOL_SUPPORT'}
                    onChange={() => setTargetType('SCHOOL_SUPPORT')}
                    className="sr-only"
                  />
                  <div className="flex items-center gap-2">
                    <Users className="size-5 text-muted-foreground" />
                    <span className="font-medium">Okul içi destek</span>
                  </div>
                  <span className="text-xs text-muted-foreground pl-7">Okul idaresine iletir (nöbet, ders programı vb.)</span>
                </label>
                <label
                  className={[
                    'flex cursor-pointer flex-col gap-2 rounded-xl border-2 p-4 transition-all',
                    targetType === 'PLATFORM_SUPPORT'
                      ? 'border-primary bg-primary/5 shadow-sm'
                      : 'border-transparent bg-card hover:border-muted-foreground/30',
                  ].join(' ')}
                >
                  <input
                    type="radio"
                    name="target"
                    checked={targetType === 'PLATFORM_SUPPORT'}
                    onChange={() => setTargetType('PLATFORM_SUPPORT')}
                    className="sr-only"
                  />
                  <div className="flex items-center gap-2">
                    <Building2 className="size-5 text-muted-foreground" />
                    <span className="font-medium">Platform / Yönetici</span>
                  </div>
                  <span className="text-xs text-muted-foreground pl-7">Sistem yöneticisine iletir (hata, öneri, genel talep)</span>
                </label>
              </div>
            </div>
            {loading ? (
              <LoadingSpinner label="Modüller yükleniyor…" />
            ) : (
              <div className="space-y-1.5">
                <Label htmlFor="module-select" className="text-sm font-medium">İlgili Modül</Label>
                <select
                  id="module-select"
                  value={moduleId}
                  onChange={(e) => setModuleId(e.target.value)}
                  className="select-input w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm font-[inherit]"
                  required
                >
                  {modules.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="issue-type" className="text-sm font-medium">Konu türü</Label>
                <select
                  id="issue-type"
                  value={issueType}
                  onChange={(e) => setIssueType(e.target.value as typeof issueType)}
                  className="select-input w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm font-[inherit]"
                >
                  <option value="QUESTION">Soru</option>
                  <option value="BUG">Hata bildirimi</option>
                  <option value="REQUEST">Talep</option>
                  <option value="IMPROVEMENT">Öneri / İyileştirme</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="priority" className="text-sm font-medium">Öncelik</Label>
                <select
                  id="priority"
                  value={priority}
                  onChange={(e) => setPriority(e.target.value as typeof priority)}
                  className="select-input w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm font-[inherit]"
                >
                  <option value="LOW">Düşük</option>
                  <option value="MEDIUM">Orta</option>
                  <option value="HIGH">Yüksek</option>
                  <option value="URGENT">Acil</option>
                </select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="subject" className="text-sm font-medium">Konu (başlık)</Label>
              <Input
                id="subject"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Örn: Ders programında değişiklik talebi"
                maxLength={512}
                className="rounded-lg px-3 py-2.5"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">Dosya ekle (isteğe bağlı)</Label>
              <p className="text-xs text-muted-foreground">Ekran görüntüsü veya belge ekleyebilirsiniz</p>
              <TicketAttachmentInput
                value={attachments}
                onChange={setAttachments}
                token={token}
                disabled={submitting}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="description" className="text-sm font-medium">Açıklama</Label>
              <textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Sorununuzu veya talebinizi detaylı anlatın. Mümkünse adım adım belirtin."
                className="min-h-[140px] w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                required
              />
            </div>
            <div className="flex gap-2 pt-1">
              <Button type="submit" size="sm" disabled={submitting || !moduleId}>
                {submitting ? 'Gönderiliyor…' : 'Talep Oluştur'}
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={() => router.back()}>
                İptal
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
