'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { useDersDagitStudio } from '@/hooks/use-ders-dagit-studio';
import { apiFetch } from '@/lib/api';
import { DdCard, CardContent, CardHeader, CardTitle, DdPageHeader, DD_PAGE, DD_CARD_HEADER, DD_CARD_CONTENT } from '@/components/ders-dagit/dd-ui';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';

const DAYS = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum'] as const;

type RequestRow = {
  id: string;
  body: string;
  status: string;
  author_name?: string;
  admin_reply: string | null;
};

export default function TercihlerPage() {
  const { token, me } = useAuth();
  const { studio } = useDersDagitStudio();
  const [open, setOpen] = useState(false);
  const [requests, setRequests] = useState<RequestRow[]>([]);
  const [reqBody, setReqBody] = useState('');

  const load = useCallback(async () => {
    if (!token) return;
    const list = await apiFetch<Array<{ id: string; preference_window_open: boolean }>>('/ders-dagit/studios', {
      token,
    }).catch(() => []);
    if (list[0]) setOpen(!!list[0].preference_window_open);
    if (studio && me?.role === 'school_admin') {
      setRequests(await apiFetch<RequestRow[]>(`/ders-dagit/studios/${studio.id}/requests`, { token }));
    }
  }, [token, studio, me?.role]);

  useEffect(() => {
    void load();
  }, [load]);

  async function savePref(day: number, lesson: number | null) {
    if (!token || !studio) return;
    if (!open && me?.role === 'teacher') {
      toast.error('Tercih penceresi kapalı');
      return;
    }
    await apiFetch(`/ders-dagit/studios/${studio.id}/preferences`, {
      token,
      method: 'POST',
      body: { day_of_week: day, lesson_num: lesson, status: 'unavailable', is_hard: true },
    });
    toast.success('Kaydedildi');
  }

  async function toggleWindow() {
    if (!token || !studio || me?.role !== 'school_admin') return;
    await apiFetch(`/ders-dagit/studios/${studio.id}/preference-window`, {
      token,
      method: 'PATCH',
      body: { open: !open },
    });
    setOpen(!open);
    toast.success(open ? 'Kapandı' : 'Açıldı');
  }

  async function submitRequest() {
    if (!token || !studio || !reqBody.trim()) return;
    await apiFetch(`/ders-dagit/studios/${studio.id}/requests`, {
      token,
      method: 'POST',
      body: { body: reqBody.trim() },
    });
    setReqBody('');
    toast.success('Talep gönderildi');
    await load();
  }

  async function moderate(id: string, status: string) {
    if (!token || !studio) return;
    await apiFetch(`/ders-dagit/studios/${studio.id}/requests/${id}`, {
      token,
      method: 'PATCH',
      body: { status, admin_reply: status === 'approved' ? 'Onaylandı' : 'Reddedildi' },
    });
    await load();
  }

  return (
    <div className={DD_PAGE}>
      <DdPageHeader title="Tercihler" description="Öğretmen müsaitlik ve değişiklik talepleri." />
      {!open && me?.role === 'teacher' && (
        <p className="text-sm text-amber-700 dark:text-amber-300">Tercih penceresi şu an kapalı.</p>
      )}
      {me?.role === 'school_admin' && studio && (
        <Button type="button" variant="secondary" onClick={() => void toggleWindow()}>
          {open ? 'Tercih toplamayı kapat' : 'Tercih toplamayı aç'}
        </Button>
      )}
      <DdCard>
        <CardHeader>
          <CardTitle className="text-base">Müsait değil</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex flex-wrap gap-2">
            {DAYS.map((label, i) => (
              <Button
                key={label}
                type="button"
                variant="outline"
                size="sm"
                disabled={!open && me?.role === 'teacher'}
                onClick={() => void savePref(i + 1, null)}
              >
                {label} (tüm gün)
              </Button>
            ))}
          </div>
          <div className="flex flex-wrap gap-1">
            {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
              <Button
                key={n}
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs"
                disabled={!open && me?.role === 'teacher'}
                onClick={() => void savePref(1, n)}
              >
                Pzt-{n}
              </Button>
            ))}
          </div>
        </CardContent>
      </DdCard>
      <DdCard>
        <CardHeader>
          <CardTitle className="text-base">Değişiklik talebi</CardTitle>
        </CardHeader>
        <CardContent className="flex gap-2">
          <Input value={reqBody} onChange={(e) => setReqBody(e.target.value)} placeholder="Talep metni" />
          <Button type="button" onClick={() => void submitRequest()}>
            Gönder
          </Button>
        </CardContent>
      </DdCard>
      {me?.role === 'school_admin' && requests.length > 0 && (
        <DdCard>
          <CardHeader>
            <CardTitle className="text-base">Talep moderasyonu</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {requests.map((r) => (
              <div key={r.id} className="rounded border px-3 py-2">
                <p>
                  <strong>{r.author_name}</strong> · {r.status}
                </p>
                <p className="text-muted-foreground">{r.body}</p>
                {r.status === 'pending' && (
                  <span className="mt-2 flex gap-2">
                    <Button type="button" size="sm" onClick={() => void moderate(r.id, 'approved')}>
                      Onayla
                    </Button>
                    <Button type="button" size="sm" variant="outline" onClick={() => void moderate(r.id, 'rejected')}>
                      Reddet
                    </Button>
                  </span>
                )}
              </div>
            ))}
          </CardContent>
        </DdCard>
      )}
    </div>
  );
}
