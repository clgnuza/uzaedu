'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Copy, BookOpen, Monitor, Sparkles, Wrench, Link2 } from 'lucide-react';
import { buildClassroomTvUrl } from '@/lib/smart-board-classroom-url';
import { toast } from 'sonner';
import type { Device } from '../types';

export function AddDeviceDialog({
  open,
  onOpenChange,
  onAdd,
  onDeviceCreated,
  classSections,
  trigger,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdd: (data: { name: string; class_section: string; room_or_location: string }) => Promise<Device | null>;
  onDeviceCreated?: (device: Device) => void;
  classSections: string[];
  trigger: React.ReactNode;
}) {
  const [createdDevice, setCreatedDevice] = useState<Device | null>(null);
  const [adding, setAdding] = useState(false);
  const [keepOpenForNext, setKeepOpenForNext] = useState(false);
  const [noClassBoard, setNoClassBoard] = useState(false);
  const [form, setForm] = useState({ name: '', class_section: '', room_or_location: '' });

  const suggestedName = useMemo(() => {
    const classPart = form.class_section.trim();
    const roomPart = form.room_or_location.trim();
    if (!classPart && !roomPart) return 'Akıllı Tahta';
    if (classPart && roomPart) return `${classPart} - ${roomPart}`;
    if (classPart) return `${classPart} Akıllı Tahta`;
    return `Akıllı Tahta - ${roomPart}`;
  }, [form.class_section, form.room_or_location]);

  const handleAdd = async () => {
    const room = form.room_or_location.trim();
    const cls = noClassBoard ? '' : form.class_section.trim();
    const name = form.name.trim();
    if (noClassBoard && !name && !room) {
      toast.error('Sınıf dışı tahta için ad veya lokasyon girin.');
      return;
    }
    setAdding(true);
    try {
      const device = await onAdd({
        name: name || 'Akıllı Tahta',
        class_section: cls,
        room_or_location: room,
      });
      if (device) {
        onDeviceCreated?.(device);
        if (keepOpenForNext) {
          setForm({ name: '', class_section: '', room_or_location: '' });
          toast.success('Tahta eklendi. Eşleme kodu: ' + device.pairing_code);
          return;
        }
        setCreatedDevice(device);
      }
    } finally {
      setAdding(false);
    }
  };

  const handleClose = (isOpen: boolean) => {
    if (!isOpen) {
      setCreatedDevice(null);
      setForm({ name: '', class_section: '', room_or_location: '' });
    }
    onOpenChange(isOpen);
  };

  const copyCode = (code: string) => {
    navigator.clipboard?.writeText(code);
    toast.success('Eşleme kodu kopyalandı: ' + code);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent title={createdDevice ? 'Tahta Eklendi' : 'Tahta Ekle'}>
        {createdDevice ? (
          <div className="space-y-4">
            <div className="flex items-center justify-center gap-2">
              <span className="font-mono text-lg font-semibold">{createdDevice.pairing_code}</span>
              <Button variant="outline" size="sm" onClick={() => copyCode(createdDevice.pairing_code)}>
                <Copy className="mr-1 size-4" />
                Kopyala
              </Button>
            </div>
            <p className="text-center text-sm text-muted-foreground">
              Tahtada Chromium bu sınıf URL’si ile açılmalı. Kurulum sekmesinden QR etiketi yazdırın.
            </p>
            {typeof window !== 'undefined' ? (
              <div className="space-y-1">
                <code className="block break-all rounded bg-muted px-2 py-1 text-[10px]">
                  {buildClassroomTvUrl({
                    origin: window.location.origin,
                    schoolId: createdDevice.school_id,
                    deviceId: createdDevice.id,
                  })}
                </code>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={() => {
                    const url = buildClassroomTvUrl({
                      origin: window.location.origin,
                      schoolId: createdDevice.school_id,
                      deviceId: createdDevice.id,
                    });
                    void navigator.clipboard?.writeText(url);
                    toast.success('Classroom URL kopyalandı');
                  }}
                >
                  <Link2 className="mr-1 size-4" />
                  Classroom URL kopyala
                </Button>
              </div>
            ) : null}
            {createdDevice.classSection && (
              <p className="rounded-lg bg-primary/10 px-3 py-2 text-center text-sm text-primary">
                Sınıf <strong>{createdDevice.classSection}</strong> atandı — Ders programından otomatik ders/öğretmen alınacak.
              </p>
            )}
            <div className="grid gap-2 sm:grid-cols-2">
              <Button
                variant="outline"
                onClick={() => {
                  setCreatedDevice(null);
                  setForm({ name: '', class_section: '', room_or_location: '' });
                }}
              >
                Yeni tahta ekle
              </Button>
              <Button className="w-full" onClick={() => handleClose(false)}>
                Tamam
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <Label htmlFor="add-name" className="flex items-center gap-1.5">
                <Monitor className="size-4" />
                Ad
              </Label>
              <Input
                id="add-name"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder={suggestedName}
                className="mt-1"
              />
              <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 gap-1 px-2 text-[10px]"
                  onClick={() => setForm((f) => ({ ...f, name: suggestedName }))}
                >
                  <Sparkles className="size-3" />
                  Önerilen adı kullan
                </Button>
                <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">{suggestedName}</span>
              </div>
            </div>
            <label className="flex cursor-pointer items-start gap-2 rounded-lg border border-border/80 bg-muted/30 p-2.5 text-sm">
              <input
                type="checkbox"
                className="mt-0.5 size-4 rounded border-input"
                checked={noClassBoard}
                onChange={(e) => {
                  const v = e.target.checked;
                  setNoClassBoard(v);
                  if (v) setForm((f) => ({ ...f, class_section: '' }));
                }}
              />
              <span>
                <span className="font-medium text-foreground">Sınıf dışı tahta</span>
                <span className="mt-0.5 block text-xs text-muted-foreground">
                  İdare, lab, koridor vb. — ders programı eşlemesi yok; ad ve lokasyon yeterli.
                </span>
              </span>
            </label>
            {!noClassBoard ? (
              <div className="rounded-xl border border-sky-500/25 bg-linear-to-br from-sky-500/12 via-cyan-500/8 to-indigo-500/10 p-2.5">
                <Label htmlFor="add-class" className="flex items-center gap-1.5 text-primary">
                  <BookOpen className="size-4" />
                  Sınıf (Gruplar ve Dersler listesi)
                </Label>
                <Input
                  id="add-class"
                  value={form.class_section}
                  onChange={(e) => setForm((f) => ({ ...f, class_section: e.target.value }))}
                  placeholder="Örn. 9-A"
                  className="mt-1"
                />
                <div className="mt-1.5">
                  <select
                    value=""
                    onChange={(e) => setForm((f) => ({ ...f, class_section: e.target.value }))}
                    disabled={classSections.length === 0}
                    className="h-9 w-full rounded-md border border-input bg-background px-2 text-xs disabled:cursor-not-allowed disabled:opacity-60 sm:text-sm"
                  >
                    <option value="" disabled>
                      {classSections.length > 0 ? 'Listeden seç' : 'Kayıtlı sınıf bulunamadı'}
                    </option>
                    {classSections.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>
                {classSections.length === 0 ? (
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    <Link href="/classes-subjects">
                      <Button type="button" variant="outline" size="sm" className="h-7 px-2 text-[10px]">
                        Gruplar ve Dersler
                      </Button>
                    </Link>
                  </div>
                ) : null}
              </div>
            ) : null}
            <div>
              <Label htmlFor="add-room">Lokasyon / Oda</Label>
              <Input
                id="add-room"
                value={form.room_or_location}
                onChange={(e) => setForm((f) => ({ ...f, room_or_location: e.target.value }))}
                placeholder="Örn. 101 No'lu Salon"
                className="mt-1"
              />
            </div>
            <div className="rounded-lg border border-primary/20 bg-primary/5 p-2.5">
              <p className="text-[11px] font-medium text-foreground">Okul tahta ekleme önerisi</p>
              <ul className="mt-1 list-disc space-y-0.5 pl-4 text-[10px] text-muted-foreground">
                <li>Sınıf şubesi: ders programı eşlemesi için (isteğe bağlı, sınıf dışı işaretleyin).</li>
                <li>Lokasyon girin (harita ve teknik takip için).</li>
                <li>Tahta eklendikten sonra kodu cihaza hemen girin.</li>
              </ul>
              <Link href="/akilli-tahta?tab=kurulum" className="mt-2 inline-flex">
                <Button type="button" variant="secondary" size="sm" className="h-7 gap-1 px-2 text-[10px]">
                  <Wrench className="size-3" />
                  Kurulum sekmesini aç
                </Button>
              </Link>
            </div>
            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              <input
                type="checkbox"
                checked={keepOpenForNext}
                onChange={(e) => setKeepOpenForNext(e.target.checked)}
                className="size-3.5 rounded border-input"
              />
              Eklemeden sonra yeni tahta için formu açık tut
            </label>
            <Button onClick={handleAdd} disabled={adding} className="w-full">
              {adding ? 'Ekleniyor…' : 'Tahta Ekle'}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
