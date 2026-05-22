'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { msgQ, fetchAutomationConfig, saveAutomationConfig, type SchoolAutomationConfig } from '@/lib/messaging-api';
import { Button } from '@/components/ui/button';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { toast } from 'sonner';

export default function OtomasyonPage() {
  const { me, token } = useAuth();
  const q = msgQ(me?.role, useSearchParams().get('school_id'));
  const [cfg, setCfg] = useState<SchoolAutomationConfig>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!token) return;
    void fetchAutomationConfig(token, q).then(setCfg).finally(() => setLoading(false));
  }, [token, q]);

  const save = async () => {
    setSaving(true);
    try {
      setCfg(await saveAutomationConfig(token!, q, cfg));
      toast.success('Kaydedildi');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Hata');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <LoadingSpinner />;

  const toggle = (path: keyof SchoolAutomationConfig, key: string, val: boolean) => {
    setCfg((c) => ({ ...c, [path]: { ...(c[path] as object), [key]: val } }));
  };

  return (
    <div className="space-y-4 rounded-xl border bg-card p-4">
      <h2 className="font-bold text-sm">Okul otomasyonları</h2>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={!!cfg.morningDevamsizlik?.enabled} onChange={(e) => toggle('morningDevamsizlik', 'enabled', e.target.checked)} />
        Sabah 08:00 — son devamsızlık önizlemesini otomatik gönder
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={!!cfg.eokulReminder?.enabled} onChange={(e) => toggle('eokulReminder', 'enabled', e.target.checked)} />
        07:00 — E-Okul Excel yükleme hatırlatması (müdür gelen kutusu)
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={!!cfg.weeklyReport?.enabled} onChange={(e) => toggle('weeklyReport', 'enabled', e.target.checked)} />
        Pazartesi 09:00 — haftalık iletişim özeti
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={!!cfg.quietHours?.enabled} onChange={(e) => toggle('quietHours', 'enabled', e.target.checked)} />
        Sessiz saat (21:00–08:00 gönderim yapma)
      </label>
      <p className="text-xs text-muted-foreground">E-Okul: önce devamsızlık Excel yükleyin; önizleme hazır kalsın, sabah otomasyon gönderir.</p>
      <Button onClick={() => void save()} disabled={saving}>{saving ? '…' : 'Kaydet'}</Button>
    </div>
  );
}
