'use client';

import { useState } from 'react';
import { resolveDefaultApiBase } from '@/lib/resolve-api-base';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { LayoutGrid, Search } from 'lucide-react';

type LookupOk = {
  found: true;
  schoolName: string;
  planTitle: string;
  examStartsAt: string;
  examEndsAt: string | null;
  studentName: string;
  studentNumber: string | null;
  classLabel: string;
  buildingName: string;
  roomName: string;
  seatLabel: string;
};

type LookupPartial = {
  found: false;
  schoolName: string;
  studentName: string;
  message: string;
};

export default function SinavYerimPublicPage() {
  const [code, setCode] = useState('');
  const [num, setNum] = useState('');
  const [loading, setLoading] = useState(false);
  const [res, setRes] = useState<LookupOk | LookupPartial | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const submit = async () => {
    setLoading(true);
    setErr(null);
    setRes(null);
    try {
      const base = resolveDefaultApiBase();
      const q = new URLSearchParams({
        institution_code: code.trim(),
        student_number: num.trim(),
      });
      const r = await fetch(`${base}/butterfly-exam-public/lookup?${q}`, { cache: 'no-store' });
      const data = (await r.json().catch(() => ({}))) as Record<string, unknown>;
      if (!r.ok) {
        setErr(typeof data.message === 'string' ? data.message : 'Sorgu başarısız');
        return;
      }
      setRes(data as LookupOk | LookupPartial);
    } catch {
      setErr('Bağlantı kurulamadı.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[100dvh] bg-gradient-to-b from-indigo-600 via-violet-700 to-fuchsia-900 px-3 py-10 text-indigo-50">
      <div className="mx-auto w-full max-w-md space-y-6">
        <div className="text-center">
          <div className="mx-auto mb-3 flex size-14 items-center justify-center rounded-2xl bg-white/15 shadow-lg ring-2 ring-white/25 backdrop-blur">
            <LayoutGrid className="size-8 text-amber-200" />
          </div>
          <h1 className="text-xl font-bold tracking-tight sm:text-2xl">Sınav yerim</h1>
          <p className="mt-1 text-sm text-indigo-100/90">Kurum kodu ve öğrenci numaranızı girin.</p>
        </div>

        <Card className="border-white/25 bg-white/95 text-foreground shadow-2xl dark:bg-zinc-950/90">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Search className="size-5 text-indigo-600" />
              Sorgula
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground">Kurum kodu</label>
              <Input
                className="mt-1 bg-white dark:bg-zinc-950/80"
                inputMode="numeric"
                autoComplete="off"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="Örn. 123456"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Öğrenci numarası</label>
              <Input
                className="mt-1 bg-white dark:bg-zinc-950/80"
                inputMode="numeric"
                autoComplete="off"
                value={num}
                onChange={(e) => setNum(e.target.value)}
                placeholder="Okul numarası"
              />
            </div>
            <Button
              type="button"
              className="w-full bg-gradient-to-r from-indigo-600 to-violet-600 font-semibold shadow-md"
              disabled={loading || !code.trim() || !num.trim()}
              onClick={() => void submit()}
            >
              {loading ? 'Aranıyor…' : 'Göster'}
            </Button>
            {err ? <p className="text-center text-sm text-rose-600 dark:text-rose-400">{err}</p> : null}
          </CardContent>
        </Card>

        {res?.found ? (
          <Card className="border-emerald-400/40 bg-emerald-500/15 text-emerald-50 shadow-xl backdrop-blur">
            <CardContent className="space-y-2 pt-6 text-sm">
              <p className="text-xs uppercase tracking-wide text-emerald-100/80">{res.schoolName}</p>
              <p className="text-lg font-bold">{res.studentName}</p>
              <p className="text-emerald-100/90">{res.classLabel}</p>
              <div className="mt-3 grid gap-2 rounded-xl bg-black/15 p-3 text-xs sm:text-sm">
                <div className="flex justify-between gap-2">
                  <span className="text-emerald-100/80">Oturum</span>
                  <span className="font-medium">{res.planTitle}</span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-emerald-100/80">Tarih</span>
                  <span>{new Date(res.examStartsAt).toLocaleString('tr-TR')}</span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-emerald-100/80">Bina / salon</span>
                  <span className="text-right">
                    {res.buildingName} · {res.roomName}
                  </span>
                </div>
                <div className="flex justify-between gap-2 border-t border-white/10 pt-2">
                  <span className="text-emerald-100/80">Sıra</span>
                  <span className="text-lg font-bold text-amber-200">{res.seatLabel}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        ) : null}

        {res && !res.found ? (
          <Card className="border-amber-400/50 bg-amber-500/20 text-amber-50 shadow-lg backdrop-blur">
            <CardContent className="pt-6 text-sm">
              <p className="font-semibold">{res.studentName}</p>
              <p className="mt-1 text-amber-100/90">{res.message}</p>
            </CardContent>
          </Card>
        ) : null}
      </div>
    </div>
  );
}
