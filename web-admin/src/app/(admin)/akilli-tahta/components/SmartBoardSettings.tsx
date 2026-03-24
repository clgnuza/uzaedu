'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Monitor, MapPin, Tv, Users, Info } from 'lucide-react';
import { toast } from 'sonner';
import { apiFetch } from '@/lib/api';

function Toggle({ checked, onChange, disabled }: { checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors focus:outline-none focus:ring-2 focus:ring-primary/50 disabled:cursor-not-allowed disabled:opacity-50 ${
        checked ? 'bg-primary' : 'bg-muted'
      }`}
    >
      <span className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow transition ${checked ? 'translate-x-4' : 'translate-x-0.5'}`} />
    </button>
  );
}

const TIMEOUT_OPTIONS = [1, 2, 5, 10, 15, 30];

type DeviceForSettings = { id: string; name: string; roomOrLocation: string | null; classSection?: string | null };

export function SmartBoardSettings({
  schoolId,
  token,
  canManage,
  devices,
  authorizedCount,
  classSections,
  onSaved,
  onEditDevice,
}: {
  schoolId: string;
  token: string | null;
  canManage: boolean;
  devices: DeviceForSettings[];
  authorizedCount: number;
  classSections?: string[];
  onSaved?: () => void;
  onEditDevice?: (d: DeviceForSettings) => void;
}) {
  const [autoAuthorize, setAutoAuthorize] = useState(false);
  const [restrictToOwnClasses, setRestrictToOwnClasses] = useState(false);
  const [sessionTimeout, setSessionTimeout] = useState(2);
  const [notifyOnDisconnect, setNotifyOnDisconnect] = useState(true);
  const [autoDisconnectLessonEnd, setAutoDisconnectLessonEnd] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!token || !schoolId) return;
    setLoading(true);
    apiFetch<{
      smartBoardAutoAuthorize?: boolean;
      smartBoardRestrictToOwnClasses?: boolean;
      smartBoardSessionTimeoutMinutes?: number;
      smartBoardNotifyOnDisconnect?: boolean;
      smartBoardAutoDisconnectLessonEnd?: boolean;
    }>(`/schools/${schoolId}`, { token })
      .then((s) => {
        setAutoAuthorize(s?.smartBoardAutoAuthorize ?? false);
        setRestrictToOwnClasses(s?.smartBoardRestrictToOwnClasses ?? false);
        setSessionTimeout(s?.smartBoardSessionTimeoutMinutes ?? 2);
        setNotifyOnDisconnect(s?.smartBoardNotifyOnDisconnect ?? true);
        setAutoDisconnectLessonEnd(s?.smartBoardAutoDisconnectLessonEnd ?? false);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [token, schoolId]);

  const handleSave = async () => {
    if (!token || !schoolId || !canManage) return;
    setSaving(true);
    try {
      await apiFetch(`/schools/${schoolId}`, {
        method: 'PATCH',
        body: JSON.stringify({
          smart_board_auto_authorize: autoAuthorize,
          smart_board_restrict_to_own_classes: restrictToOwnClasses,
          smart_board_session_timeout_minutes: sessionTimeout,
          smart_board_notify_on_disconnect: notifyOnDisconnect,
          smart_board_auto_disconnect_lesson_end: autoDisconnectLessonEnd,
        }),
        token,
      });
      toast.success('Ayarlar kaydedildi.');
      onSaved?.();
    } catch {
      toast.error('Ayarlar kaydedilemedi.');
    } finally {
      setSaving(false);
    }
  };

  const settingRows = [
    {
      label: 'Otomatik yetki',
      hint: 'Açık: Tüm öğretmenler bağlanabilir. Kapalı: Sadece Yetkiler listesindekiler.',
      value: autoAuthorize,
      set: setAutoAuthorize,
    },
    {
      label: 'Sadece dersi olan sınıflara',
      hint: 'Öğretmen yalnızca ders verdiği sınıfların tahtalarına bağlanır (Ders Programına göre).',
      value: restrictToOwnClasses,
      set: setRestrictToOwnClasses,
    },
    {
      label: 'Bağlantı kesildiğinde bildir',
      hint: 'İdare bağlantıyı sonlandırdığında öğretmene Inbox bildirimi gider.',
      value: notifyOnDisconnect,
      set: setNotifyOnDisconnect,
    },
    {
      label: 'Ders saati bitince otomatik kes',
      hint: 'Son ders saati geçtiğinde bağlantı otomatik sonlanır (Okul Ayarları → Ders saatleri gerekli).',
      value: autoDisconnectLessonEnd,
      set: setAutoDisconnectLessonEnd,
    },
  ];

  return (
    <div className="max-w-xl space-y-4">
      <Card className="border-border/80">
        <CardContent className="pt-5">
          {loading ? (
            <p className="text-sm text-muted-foreground">Yükleniyor…</p>
          ) : (
            <div className="space-y-4">
              {settingRows.map((r) => (
                <div key={r.label} className="space-y-0.5">
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-sm font-medium">{r.label}</span>
                    <Toggle checked={r.value} onChange={r.set} disabled={!canManage} />
                  </div>
                  <p className="text-xs text-muted-foreground pl-0">{r.hint}</p>
                </div>
              ))}
              <div className="space-y-0.5 pt-1">
                <div className="flex items-center justify-between gap-4">
                  <span className="text-sm font-medium">Bağlantı süresi</span>
                  <Select value={String(sessionTimeout)} onValueChange={(v) => setSessionTimeout(Number(v))} disabled={!canManage}>
                    <SelectTrigger className="w-24 h-8 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TIMEOUT_OPTIONS.map((v) => (
                        <SelectItem key={v} value={String(v)}>
                          {v} dk
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <p className="text-xs text-muted-foreground">Heartbeat gelmezse oturum bu süre sonunda sonlanır.</p>
              </div>
              {canManage && (
                <Button onClick={handleSave} disabled={saving} size="sm" className="mt-2">
                  {saving ? 'Kaydediliyor…' : 'Kaydet'}
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border-slate-200/80 bg-slate-50/50 dark:border-slate-800 dark:bg-slate-900/30">
        <CardContent className="pt-4 pb-4">
          <div className="flex gap-2">
            <Info className="size-4 shrink-0 text-slate-500 dark:text-slate-400 mt-0.5" />
            <div className="space-y-2 text-sm text-muted-foreground">
              <p><strong className="text-foreground">Ders ve öğretmen bilgisi:</strong> Cihazlarda tahtaya sınıf atayın, Ders Programı oluşturun — kartlarda güncel ders/öğretmen otomatik görünür.</p>
              <Link href="/ders-programi" className="inline-flex items-center text-primary hover:underline text-xs">
                Ders Programı ayarları →
              </Link>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-slate-200/80 bg-slate-50/50 dark:border-slate-800 dark:bg-slate-900/30">
        <CardContent className="pt-4 pb-4">
          <div className="flex gap-2">
            <Info className="size-4 shrink-0 text-slate-500 dark:text-slate-400 mt-0.5" />
            <div className="space-y-1 text-sm text-muted-foreground">
              <p><strong className="text-foreground">Öğretmen akışı:</strong> Öğretmen Akıllı Tahta sayfasından tahta seçer, Bağlan’a basar. Uygulama açık kalmalı (heartbeat). Bağlantıyı kendisi kesebilir veya idare Oturumlar’dan sonlandırabilir.</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-2">
        <Link href="/akilli-tahta?tab=cihazlar">
          <Button variant="ghost" size="sm" className="h-8 text-muted-foreground hover:text-foreground">
            <Monitor className="mr-1.5 size-4" /> Cihazlar
          </Button>
        </Link>
        <Link href="/akilli-tahta?tab=yetkiler">
          <Button variant="ghost" size="sm" className="h-8 text-muted-foreground hover:text-foreground">
            <Users className="mr-1.5 size-4" /> Yetkiler {!autoAuthorize && `(${authorizedCount})`}
          </Button>
        </Link>
        <Link href="/akilli-tahta?tab=yerlesim">
          <Button variant="ghost" size="sm" className="h-8 text-muted-foreground hover:text-foreground">
            <MapPin className="mr-1.5 size-4" /> Yerleşim
          </Button>
        </Link>
        <Link href="/ders-programi">
          <Button variant="ghost" size="sm" className="h-8 text-muted-foreground hover:text-foreground">
            Ders Programı
          </Button>
        </Link>
        <Link href="/tv">
          <Button variant="ghost" size="sm" className="h-8 text-muted-foreground hover:text-foreground">
            <Tv className="mr-1.5 size-4" /> Duyuru TV
          </Button>
        </Link>
      </div>

      <Card className="border-slate-200/80 bg-slate-50/50 dark:border-slate-800 dark:bg-slate-900/30">
        <CardContent className="pt-3 pb-3">
          <div className="flex gap-2">
            <Info className="size-4 shrink-0 text-slate-500 dark:text-slate-400 mt-0.5" />
            <p className="text-xs text-muted-foreground">
              Modül aç/kapa: <strong className="text-foreground">Modüller</strong> sayfasından okul bazlı hızlı toggle veya <strong className="text-foreground">Okullar</strong> → Okul detay → Etkin Modüller.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
