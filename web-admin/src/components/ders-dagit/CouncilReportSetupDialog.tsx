'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { useDersDagitStudio } from '@/hooks/use-ders-dagit-studio';
import {
  COUNCIL_PLACEHOLDERS,
  COUNCIL_SETUP_STORAGE_KEY,
  DEFAULT_COUNCIL_AGENDA,
  DEFAULT_COUNCIL_APPROVAL_TEXT,
  DEFAULT_COUNCIL_MEETING_PLACE,
  DEFAULT_COUNCIL_MEETING_TOPIC,
} from '@/lib/ders-dagit-council-texts';
import {
  fetchReportSettings,
  patchReportSettings,
  type StudioReportSettings,
} from '@/lib/ders-dagit-report-settings';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';

export function CouncilReportSetupDialog() {
  const { token } = useAuth();
  const { studio } = useDersDagitStudio();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState<StudioReportSettings | null>(null);
  const [toastShown, setToastShown] = useState(false);

  const load = useCallback(async () => {
    if (!token || !studio) return;
    const data = await fetchReportSettings(token, studio.id);
    setForm({
      meta: {
        school_name: data.meta.school_name ?? studio.name ?? '',
        academic_year: data.meta.academic_year ?? studio.academic_year ?? '',
        principal_name: data.meta.principal_name ?? '',
        address: data.meta.address ?? '',
        phone: data.meta.phone ?? '',
      },
      texts: {
        ...data.texts,
        council_meeting_place: data.texts.council_meeting_place ?? DEFAULT_COUNCIL_MEETING_PLACE,
        council_meeting_topic: data.texts.council_meeting_topic ?? DEFAULT_COUNCIL_MEETING_TOPIC,
        council_agenda: data.texts.council_agenda ?? DEFAULT_COUNCIL_AGENDA,
        approval_text: data.texts.approval_text?.trim() || DEFAULT_COUNCIL_APPROVAL_TEXT,
      },
    });
    return data;
  }, [token, studio]);

  useEffect(() => {
    if (!token || !studio) return;
    const key = COUNCIL_SETUP_STORAGE_KEY(studio.id);
    if (typeof window !== 'undefined' && localStorage.getItem(key) === '1') return;

    void load().then(() => {
      if (toastShown) return;
      setToastShown(true);
      toast.message('Zümre kurulu tutanağı', {
        description: 'Varsayılan kurul kararını okulunuza göre düzenleyip kaydedin.',
        duration: 12_000,
        action: {
          label: 'Düzenle',
          onClick: () => setOpen(true),
        },
      });
      setOpen(true);
    });
  }, [token, studio, load, toastShown]);

  async function save(dismissLater = false) {
    if (!token || !studio || !form) return;
    setBusy(true);
    try {
      await patchReportSettings(token, studio.id, { meta: form.meta, texts: form.texts });
      localStorage.setItem(COUNCIL_SETUP_STORAGE_KEY(studio.id), '1');
      toast.success('Kurul metinleri kaydedildi');
      setOpen(false);
      if (dismissLater) toast.message('İstediğiniz zaman Raporlar → okul metinlerinden düzenleyebilirsiniz.');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Kayıt başarısız');
    } finally {
      setBusy(false);
    }
  }

  const setMeta = (key: keyof StudioReportSettings['meta'], value: string) =>
    setForm((f) => (f ? { ...f, meta: { ...f.meta, [key]: value } } : f));
  const setText = (key: keyof StudioReportSettings['texts'], value: string) =>
    setForm((f) => (f ? { ...f, texts: { ...f.texts, [key]: value } } : f));

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Kurul tutanağı — okul metinleri</DialogTitle>
          <DialogDescription>
            Zümre Öğretmenler Kurulu PDF tutanağında kullanılır. Yer tutucular otomatik doldurulur:{' '}
            {COUNCIL_PLACEHOLDERS.map((p) => p.key).join(', ')}.
          </DialogDescription>
        </DialogHeader>
        {form ? (
          <div className="grid gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Okul adı</Label>
              <Input value={form.meta.school_name ?? ''} onChange={(e) => setMeta('school_name', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Öğretim yılı</Label>
              <Input
                value={form.meta.academic_year ?? ''}
                onChange={(e) => setMeta('academic_year', e.target.value)}
                placeholder="2025-2026"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Toplantı yeri</Label>
              <Input
                value={form.texts.council_meeting_place ?? ''}
                onChange={(e) => setText('council_meeting_place', e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Toplantı konusu</Label>
              <Input
                value={form.texts.council_meeting_topic ?? ''}
                onChange={(e) => setText('council_meeting_topic', e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Gündem</Label>
              <textarea
                rows={4}
                className="flex min-h-[4rem] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={form.texts.council_agenda ?? ''}
                onChange={(e) => setText('council_agenda', e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Alınan kararlar</Label>
              <textarea
                rows={8}
                className="flex min-h-[8rem] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={form.texts.approval_text ?? ''}
                onChange={(e) => setText('approval_text', e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Okul müdürü (imza)</Label>
              <Input
                value={form.meta.principal_name ?? ''}
                onChange={(e) => setMeta('principal_name', e.target.value)}
              />
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Yükleniyor…</p>
        )}
        <DialogFooter className="flex-col gap-2 sm:flex-row">
          <Button type="button" variant="ghost" disabled={busy} onClick={() => void save(true)}>
            Sonra
          </Button>
          <Button type="button" disabled={busy || !form} onClick={() => void save(false)}>
            {busy ? 'Kaydediliyor…' : 'Kaydet'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
