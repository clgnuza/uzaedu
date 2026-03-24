'use client';

import { useEffect, useState } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { BookOpen } from 'lucide-react';
import type { Device } from '../types';

export function EditDeviceDialog({
  device,
  onClose,
  onSave,
}: {
  device: Device;
  onClose: () => void;
  onSave: (name: string, roomOrLocation: string, classSection: string) => void;
}) {
  const [name, setName] = useState(device.name);
  const [roomOrLocation, setRoomOrLocation] = useState(device.roomOrLocation ?? '');
  const [classSection, setClassSection] = useState(device.classSection ?? '');

  useEffect(() => {
    setName(device.name);
    setRoomOrLocation(device.roomOrLocation ?? '');
    setClassSection(device.classSection ?? '');
  }, [device.id, device.name, device.roomOrLocation, device.classSection]);

  return (
    <Dialog open={!!device} onOpenChange={(o) => !o && onClose()}>
      <DialogContent title="Tahta Düzenle">
        <div className="space-y-4">
          <div>
            <Label htmlFor="edit-device-name">Ad</Label>
            <Input
              id="edit-device-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Akıllı Tahta"
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="edit-device-class" className="flex items-center gap-1.5">
              <BookOpen className="size-4 text-primary" />
              Sınıf (Ders programından otomatik)
            </Label>
            <Input
              id="edit-device-class"
              value={classSection}
              onChange={(e) => setClassSection(e.target.value)}
              placeholder="Örn. 9-A"
              className="mt-1"
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Ders Programı ayarlarınızdan otomatik ders/öğretmen bilgisi alınır.
            </p>
          </div>
          <div>
            <Label htmlFor="edit-device-room">Lokasyon / Oda</Label>
            <Input
              id="edit-device-room"
              value={roomOrLocation}
              onChange={(e) => setRoomOrLocation(e.target.value)}
              placeholder="Örn. 101 No'lu Salon"
              className="mt-1"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={onClose}>
              İptal
            </Button>
            <Button onClick={() => onSave(name.trim(), roomOrLocation.trim(), classSection.trim())}>
              Kaydet
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
