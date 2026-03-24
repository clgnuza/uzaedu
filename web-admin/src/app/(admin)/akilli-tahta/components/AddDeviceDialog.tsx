'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Copy, BookOpen, Monitor } from 'lucide-react';
import { toast } from 'sonner';
import type { Device } from '../types';

export function AddDeviceDialog({
  open,
  onOpenChange,
  onAdd,
  onDeviceCreated,
  trigger,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdd: (data: { name: string; class_section: string; room_or_location: string }) => Promise<Device | null>;
  onDeviceCreated?: (device: Device) => void;
  trigger: React.ReactNode;
}) {
  const [createdDevice, setCreatedDevice] = useState<Device | null>(null);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ name: '', class_section: '', room_or_location: '' });

  const handleAdd = async () => {
    setAdding(true);
    try {
      const device = await onAdd({
        name: form.name.trim() || 'Akıllı Tahta',
        class_section: form.class_section.trim(),
        room_or_location: form.room_or_location.trim(),
      });
      if (device) {
        setCreatedDevice(device);
        onDeviceCreated?.(device);
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
              Tahta uygulamasında bu kodu kullanarak eşleştirme yapın.
            </p>
            {createdDevice.classSection && (
              <p className="rounded-lg bg-primary/10 px-3 py-2 text-center text-sm text-primary">
                Sınıf <strong>{createdDevice.classSection}</strong> atandı — Ders programından otomatik ders/öğretmen alınacak.
              </p>
            )}
            <Button className="w-full" onClick={() => handleClose(false)}>
              Tamam
            </Button>
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
                placeholder="Akıllı Tahta"
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="add-class" className="flex items-center gap-1.5 text-primary">
                <BookOpen className="size-4" />
                Sınıf (Ders programından otomatik)
              </Label>
              <Input
                id="add-class"
                value={form.class_section}
                onChange={(e) => setForm((f) => ({ ...f, class_section: e.target.value }))}
                placeholder="Örn. 9-A"
                className="mt-1"
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Ders Programı ayarlarınızdan ders ve öğretmen bilgisi otomatik gelir.
              </p>
            </div>
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
            <Button onClick={handleAdd} disabled={adding} className="w-full">
              {adding ? 'Ekleniyor…' : 'Tahta Ekle'}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
