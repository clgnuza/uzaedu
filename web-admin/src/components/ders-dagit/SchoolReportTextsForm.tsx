'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { useDersDagitStudio } from '@/hooks/use-ders-dagit-studio';
import {
  COUNCIL_PLACEHOLDERS,
  DEFAULT_COUNCIL_AGENDA,
  DEFAULT_COUNCIL_APPROVAL_TEXT,
  DEFAULT_COUNCIL_MEETING_PLACE,
  DEFAULT_COUNCIL_MEETING_TOPIC,
} from '@/lib/ders-dagit-council-texts';
import {
  DEFAULT_NOTIFICATION_ACK,
  DEFAULT_NOTIFICATION_BODY,
  DEFAULT_NOTIFICATION_REF,
  DEFAULT_NOTIFICATION_SUBJECT,
  DEFAULT_NOTIFICATION_TITLE,
  DEFAULT_TEACHER_SIGNATURE_LABEL,
  fetchReportSettings,
  NOTIFICATION_PLACEHOLDERS,
  patchReportSettings,
  type StudioReportSettings,
} from '@/lib/ders-dagit-report-settings';
import { DdCard, CardContent, CardHeader, CardTitle, DdAccentButton } from '@/components/ders-dagit/dd-ui';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Building2 } from 'lucide-react';

type Props = {
  onSaved?: (settings: StudioReportSettings) => void;
};

export function SchoolReportTextsForm({ onSaved }: Props) {
  const { token } = useAuth();
  const { studio } = useDersDagitStudio();
  const [form, setForm] = useState<StudioReportSettings | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!token || !studio) return;
    void fetchReportSettings(token, studio.id).then((data) => {
      setForm(data);
      onSaved?.(data);
    });
  }, [token, studio?.id, onSaved]);

  async function save() {
    if (!token || !studio || !form) return;
    setBusy(true);
    try {
      const saved = await patchReportSettings(token, studio.id, { meta: form.meta, texts: form.texts });
      setForm(saved);
      onSaved?.(saved);
      toast.success('Rapor metinleri kaydedildi');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Kayıt başarısız');
    } finally {
      setBusy(false);
    }
  }

  if (!form) {
    return <p className="text-sm text-muted-foreground">Rapor ayarları yükleniyor…</p>;
  }

  const setMeta = (key: keyof StudioReportSettings['meta'], value: string) =>
    setForm((f) => (f ? { ...f, meta: { ...f.meta, [key]: value } } : f));
  const setText = (key: keyof StudioReportSettings['texts'], value: string) =>
    setForm((f) => (f ? { ...f, texts: { ...f.texts, [key]: value } } : f));

  return (
    <DdCard variant="lavender">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm">
          <Building2 className="size-4" />
          Okul bilgisi ve rapor metinleri
        </CardTitle>
      </CardHeader>
      <CardContent className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5 sm:col-span-2">
          <Label className="text-xs">Okul adı (rapor başlığı)</Label>
          <Input
            value={form.meta.school_name ?? ''}
            onChange={(e) => setMeta('school_name', e.target.value)}
            placeholder="Örn. Atatürk Anadolu Lisesi"
          />
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
          <Label className="text-xs">Okul müdürü</Label>
          <Input
            value={form.meta.principal_name ?? ''}
            onChange={(e) => setMeta('principal_name', e.target.value)}
          />
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label className="text-xs">Adres</Label>
          <Input value={form.meta.address ?? ''} onChange={(e) => setMeta('address', e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Telefon</Label>
          <Input value={form.meta.phone ?? ''} onChange={(e) => setMeta('phone', e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Belge üst başlık</Label>
          <Input
            value={form.texts.title ?? ''}
            onChange={(e) => setText('title', e.target.value)}
            placeholder="HAFTALIK DERS PROGRAMI"
          />
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label className="text-xs">Alt başlık</Label>
          <Input
            value={form.texts.subtitle ?? ''}
            onChange={(e) => setText('subtitle', e.target.value)}
            placeholder="Zümre onaylı dağıtım programı"
          />
        </div>
        <div className="space-y-1.5 sm:col-span-2 border-t border-border/60 pt-3">
          <p className="text-xs font-medium">Zümre kurulu tutanağı (PDF)</p>
          <p className="text-[11px] text-muted-foreground">
            {COUNCIL_PLACEHOLDERS.map((p) => p.key).join(', ')}
          </p>
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label className="text-xs">Toplantı yeri</Label>
          <Input
            value={form.texts.council_meeting_place ?? ''}
            onChange={(e) => setText('council_meeting_place', e.target.value)}
            placeholder={DEFAULT_COUNCIL_MEETING_PLACE}
          />
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label className="text-xs">Toplantı konusu</Label>
          <Input
            value={form.texts.council_meeting_topic ?? ''}
            onChange={(e) => setText('council_meeting_topic', e.target.value)}
            placeholder={DEFAULT_COUNCIL_MEETING_TOPIC}
          />
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label className="text-xs">Gündem maddeleri</Label>
          <textarea
            rows={3}
            className="flex min-h-[4rem] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            value={form.texts.council_agenda ?? ''}
            onChange={(e) => setText('council_agenda', e.target.value)}
            placeholder={DEFAULT_COUNCIL_AGENDA}
          />
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label className="text-xs">Alınan kararlar</Label>
          <textarea
            rows={6}
            className="flex min-h-[6rem] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            value={form.texts.approval_text ?? ''}
            onChange={(e) => setText('approval_text', e.target.value)}
            placeholder={DEFAULT_COUNCIL_APPROVAL_TEXT}
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">İmza satırı etiketi</Label>
          <Input
            value={form.texts.principal_signature_label ?? ''}
            onChange={(e) => setText('principal_signature_label', e.target.value)}
            placeholder="Okul Müdürü"
          />
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label className="text-xs">Alt bilgi notu</Label>
          <textarea
            rows={2}
            className="flex min-h-[3rem] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            value={form.texts.footer_note ?? ''}
            onChange={(e) => setText('footer_note', e.target.value)}
          />
        </div>
        <div className="space-y-1.5 sm:col-span-2 border-t border-border/60 pt-3">
          <p className="text-xs font-medium text-foreground">Öğretmene tebliğ tutanağı</p>
          <p className="text-[11px] text-muted-foreground">
            Yer tutucular: {NOTIFICATION_PLACEHOLDERS.map((p) => p.key).join(', ')}. Paragraflar arasında boş satır
            bırakın; metinler resmi yazı diline uygun düzenlenir.
          </p>
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label className="text-xs">Tebliğ belge başlığı</Label>
          <Input
            value={form.texts.notification_title ?? ''}
            onChange={(e) => setText('notification_title', e.target.value)}
            placeholder={DEFAULT_NOTIFICATION_TITLE}
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Sayı (sıra no otomatik: {'{{sira}}'})</Label>
          <Input
            value={form.texts.notification_ref ?? ''}
            onChange={(e) => setText('notification_ref', e.target.value)}
            placeholder={DEFAULT_NOTIFICATION_REF}
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Konu</Label>
          <Input
            value={form.texts.notification_subject ?? ''}
            onChange={(e) => setText('notification_subject', e.target.value)}
            placeholder={DEFAULT_NOTIFICATION_SUBJECT}
          />
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label className="text-xs">Tebliğ gövde metni</Label>
          <textarea
            rows={5}
            className="flex min-h-[6rem] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            value={form.texts.notification_body ?? ''}
            onChange={(e) => setText('notification_body', e.target.value)}
            placeholder={DEFAULT_NOTIFICATION_BODY}
          />
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label className="text-xs">Öğretmen tebellüğ / beyan metni</Label>
          <textarea
            rows={3}
            className="flex min-h-[4rem] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            value={form.texts.notification_acknowledgement ?? ''}
            onChange={(e) => setText('notification_acknowledgement', e.target.value)}
            placeholder={DEFAULT_NOTIFICATION_ACK}
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Öğretmen imza etiketi</Label>
          <Input
            value={form.texts.teacher_signature_label ?? ''}
            onChange={(e) => setText('teacher_signature_label', e.target.value)}
            placeholder={DEFAULT_TEACHER_SIGNATURE_LABEL}
          />
        </div>
        <div className="sm:col-span-2">
          <DdAccentButton type="button" disabled={busy} onClick={() => void save()}>
            {busy ? 'Kaydediliyor…' : 'Kaydet'}
          </DdAccentButton>
        </div>
      </CardContent>
    </DdCard>
  );
}
