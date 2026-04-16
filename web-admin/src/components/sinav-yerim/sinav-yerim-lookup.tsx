'use client';

import { useEffect, useMemo, useState } from 'react';
import { resolveDefaultApiBase } from '@/lib/resolve-api-base';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { LayoutGrid, Search } from 'lucide-react';
import { cn } from '@/lib/utils';

/** Bir yayınlanmış sınav oturumundaki koltuk satırı (API ile uyumlu). */
type LookupPlacement = {
  planId: string;
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

type LookupOk = { found: true; placements?: LookupPlacement[] } & LookupPlacement;

type LookupPartial = {
  found: false;
  schoolName: string;
  studentName: string;
  message: string;
};

function formatChipWhen(iso: string) {
  try {
    const d = new Date(iso);
    return d.toLocaleString('tr-TR', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

function formatExamWhen(iso: string) {
  try {
    const d = new Date(iso);
    return {
      full: d.toLocaleString('tr-TR', { dateStyle: 'full', timeStyle: 'short' }),
      dateLine: d.toLocaleDateString('tr-TR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }),
      timeLine: d.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }),
    };
  } catch {
    return { full: iso, dateLine: iso, timeLine: '' };
  }
}

function placementListFromOk(res: LookupOk): LookupPlacement[] {
  if (res.placements?.length) return res.placements;
  const { found: _f, placements: _p, ...row } = res;
  return [{ ...row, planId: row.planId || `legacy-${row.examStartsAt}` }];
}

export function SinavYerimLookup({ variant }: { variant: 'public' | 'embedded' }) {
  const [code, setCode] = useState('');
  const [num, setNum] = useState('');
  const [loading, setLoading] = useState(false);
  const [res, setRes] = useState<LookupOk | LookupPartial | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [activePlanId, setActivePlanId] = useState<string | null>(null);

  useEffect(() => {
    if (res?.found) setActivePlanId(res.planId);
    else setActivePlanId(null);
  }, [res]);

  const activePlacement = useMemo(() => {
    if (!res?.found) return null;
    const list = placementListFromOk(res);
    return list.find((p) => p.planId === activePlanId) ?? list[0] ?? null;
  }, [res, activePlanId]);

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

  const form = (
    <Card
      className={cn(
        'text-foreground',
        variant === 'public'
          ? 'border-white/25 bg-white/95 shadow-2xl dark:bg-zinc-950/90'
          : 'border-2 border-sky-400/55 bg-white shadow-md ring-2 ring-sky-400/15 dark:border-sky-600/60 dark:bg-zinc-950 dark:ring-sky-500/20',
      )}
    >
      <CardHeader className="space-y-1 px-4 pb-2 pt-4 sm:px-6 sm:pt-6">
        <CardTitle className="flex items-center gap-2 text-lg font-bold sm:text-base">
          <Search className="size-5 shrink-0 text-indigo-600 sm:size-5" />
          Sorgula
        </CardTitle>
        <p className="text-xs leading-snug text-muted-foreground sm:text-sm">
          Kurum kodunuzu ve öğrenci okul numaranızı girin. Birden fazla yayınlanmış sınavda yeriniz varsa hepsi listelenir; istediğiniz oturumu seçebilirsiniz.
        </p>
      </CardHeader>
      <CardContent className="space-y-3 px-4 pb-4 sm:px-6 sm:pb-6">
        <div>
          <label className="text-sm font-medium text-muted-foreground">Kurum kodu</label>
          <Input
            className="mt-1.5 h-11 bg-white text-base dark:bg-zinc-950/80 sm:h-10 sm:text-sm"
            inputMode="numeric"
            autoComplete="off"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="Örn. 123456"
          />
        </div>
        <div>
          <label className="text-sm font-medium text-muted-foreground">Öğrenci numarası</label>
          <Input
            className="mt-1.5 h-11 bg-white text-base dark:bg-zinc-950/80 sm:h-10 sm:text-sm"
            inputMode="numeric"
            autoComplete="off"
            value={num}
            onChange={(e) => setNum(e.target.value)}
            placeholder="Okul numarası"
          />
        </div>
        <Button
          type="button"
          className="h-12 w-full bg-gradient-to-r from-indigo-600 to-violet-600 text-base font-semibold shadow-md sm:h-10 sm:text-sm"
          disabled={loading || !code.trim() || !num.trim()}
          onClick={() => void submit()}
        >
          {loading ? 'Aranıyor…' : 'Yeri göster'}
        </Button>
        {err ? (
          <p className="rounded-lg bg-rose-500/10 px-3 py-2 text-center text-sm text-rose-700 dark:text-rose-300 sm:text-sm">
            {err}
          </p>
        ) : null}
      </CardContent>
    </Card>
  );

  const examWhen =
    res && res.found && activePlacement ? formatExamWhen(activePlacement.examStartsAt) : null;
  const placementTabs = res?.found ? placementListFromOk(res) : [];

  const results = (
    <>
      {res?.found && activePlacement && examWhen ? (
        <Card
          className={cn(
            'overflow-hidden text-emerald-50 shadow-xl ring-1 backdrop-blur dark:text-emerald-50',
            variant === 'embedded'
              ? 'border-2 border-emerald-500 bg-emerald-600 ring-emerald-300/40 dark:border-emerald-400 dark:bg-emerald-950 dark:ring-emerald-600/40'
              : 'border-emerald-500/50 bg-emerald-600/25 ring-emerald-400/30',
          )}
        >
          <CardContent className="space-y-0 p-0 text-sm">
            {placementTabs.length > 1 ? (
              <div className="border-b border-white/10 bg-black/15 px-2 py-2 sm:px-3">
                <p className="mb-1.5 px-1 text-center text-[10px] font-semibold uppercase tracking-wide text-emerald-100/90">
                  Birden fazla sınavınız var — görmek istediğinizi seçin
                </p>
                <div className="flex max-h-40 flex-col gap-1.5 overflow-y-auto overscroll-contain sm:max-h-none sm:flex-row sm:flex-wrap">
                  {placementTabs.map((p) => {
                    const on = p.planId === activePlacement.planId;
                    return (
                      <button
                        key={p.planId}
                        type="button"
                        onClick={() => setActivePlanId(p.planId)}
                        className={cn(
                          'min-h-11 w-full rounded-lg px-2.5 py-2 text-left text-[11px] font-semibold leading-tight transition-colors sm:min-h-0 sm:max-w-[14rem] sm:flex-1 sm:py-1.5',
                          on ? 'bg-white/25 text-white ring-1 ring-white/30' : 'bg-black/20 text-emerald-100 hover:bg-black/30',
                        )}
                      >
                        <span className="line-clamp-2">{p.planTitle}</span>
                        <span className="mt-0.5 block text-[10px] font-normal opacity-90">
                          {formatChipWhen(p.examStartsAt)} · Koltuk {p.seatLabel}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : null}

            <div className="bg-black/20 px-4 py-2.5 text-center sm:px-5">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-emerald-100/75">Kurum</p>
              <p className="mt-0.5 text-xs font-medium leading-snug text-white sm:text-sm">{activePlacement.schoolName}</p>
            </div>

            <div className="px-4 pb-3 pt-4 text-center sm:px-5 sm:text-left">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-emerald-100/80">Öğrenci</p>
              <p className="mt-1 text-xl font-bold leading-tight text-white sm:text-2xl">{activePlacement.studentName}</p>
              <p className="mt-1 text-sm text-emerald-100 sm:text-base">{activePlacement.classLabel}</p>
              {activePlacement.studentNumber ? (
                <p className="mt-1 text-xs text-emerald-100/85">No: {activePlacement.studentNumber}</p>
              ) : null}
            </div>

            <div className="mx-3 rounded-xl border border-white/15 bg-black/25 p-3 sm:mx-4 sm:p-4">
              <p className="text-center text-[10px] font-semibold uppercase tracking-wide text-amber-100/90">
                Sınav yeri
              </p>
              <p className="mt-2 text-center text-base font-semibold leading-snug text-white sm:text-lg">
                {activePlacement.buildingName}
              </p>
              <p className="text-center text-lg font-bold text-amber-100 sm:text-xl">{activePlacement.roomName}</p>
              <div className="mt-4 border-t border-white/15 pt-4">
                <p className="text-center text-[10px] font-semibold uppercase tracking-widest text-emerald-100/80">
                  Koltuk / sıra no
                </p>
                <p className="mt-1 text-center text-4xl font-black tabular-nums leading-none tracking-tight text-amber-200 sm:text-5xl">
                  {activePlacement.seatLabel}
                </p>
              </div>
            </div>

            <div className="space-y-2.5 px-4 py-4 text-xs sm:space-y-2 sm:px-5 sm:text-sm">
              <div className="flex flex-col gap-1 rounded-lg bg-black/15 px-3 py-2.5 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
                <span className="shrink-0 text-[11px] font-semibold text-emerald-100/85 sm:text-xs">Oturum</span>
                <span className="min-w-0 text-left text-sm font-medium leading-snug text-white sm:text-right sm:text-sm">
                  {activePlacement.planTitle}
                </span>
              </div>
              <div className="flex flex-col gap-1 rounded-lg bg-black/15 px-3 py-2.5 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
                <span className="shrink-0 text-[11px] font-semibold text-emerald-100/85 sm:text-xs">Tarih ve saat</span>
                <span className="min-w-0 text-left text-sm leading-snug text-white sm:text-right">
                  <span className="block sm:hidden">
                    <span className="block font-medium leading-snug">{examWhen.dateLine}</span>
                    <span className="mt-1.5 block text-lg font-bold tabular-nums text-amber-100">{examWhen.timeLine}</span>
                  </span>
                  <span className="hidden sm:block">{examWhen.full}</span>
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {res && !res.found ? (
        <Card
          className={cn(
            'text-amber-50 shadow-lg ring-1 backdrop-blur dark:text-amber-50',
            variant === 'embedded'
              ? 'border-2 border-amber-500 bg-amber-600 ring-amber-300/40 dark:border-amber-400 dark:bg-amber-950 dark:ring-amber-700/40'
              : 'border-amber-500/55 bg-amber-600/25 ring-amber-400/25',
          )}
        >
          <CardContent className="space-y-2 px-4 py-5 sm:px-6 sm:py-6">
            <p className="text-center text-[10px] font-semibold uppercase tracking-wide text-amber-100/85">Sonuç</p>
            <p className="text-center text-lg font-bold text-white">{res.studentName}</p>
            <p className="rounded-lg bg-black/20 px-3 py-2.5 text-center text-sm leading-relaxed text-amber-50/95">
              {res.message}
            </p>
          </CardContent>
        </Card>
      ) : null}
    </>
  );

  if (variant === 'embedded') {
    return (
      <div className="min-w-0 rounded-2xl border border-sky-300/70 bg-linear-to-b from-sky-50 via-white to-indigo-50/30 p-3 shadow-md dark:border-sky-800/50 dark:from-sky-950/50 dark:via-zinc-950 dark:to-indigo-950/30 sm:p-5">
        <div className="mb-3 rounded-xl border border-sky-400/40 bg-sky-500/10 px-3 py-2.5 dark:border-sky-600/40 dark:bg-sky-950/40">
          <h2 className="text-base font-bold text-sky-950 dark:text-sky-50 sm:text-lg">Öğrenci sınav yeri sorgusu</h2>
          <p className="mt-1 text-[11px] leading-snug text-sky-900/85 dark:text-sky-200/90 sm:text-xs">
            Kurum kodu ve öğrenci numarasını girip <strong>Yeri göster</strong> deyin. Birden fazla sınavda kaydı varsa oturumları üstten seçerek salon ve koltuğu görüntüleyin.
          </p>
        </div>
        <div className="space-y-3 sm:space-y-4">
          {form}
          {results}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] bg-gradient-to-b from-indigo-600 via-violet-700 to-fuchsia-900 px-3 py-6 text-indigo-50 sm:py-10">
      <div className="mx-auto w-full max-w-md space-y-4 sm:space-y-6">
        <div className="text-center">
          <div className="mx-auto mb-2 flex size-12 items-center justify-center rounded-2xl bg-white/15 shadow-lg ring-2 ring-white/25 backdrop-blur sm:mb-3 sm:size-14">
            <LayoutGrid className="size-7 text-amber-200 sm:size-8" />
          </div>
          <h1 className="text-lg font-bold tracking-tight sm:text-2xl">Sınav yerim</h1>
          <p className="mt-1 px-1 text-xs leading-snug text-indigo-100/90 sm:text-sm">
            Kurum kodu ve öğrenci numaranızı girin. Birden fazla sınavda yeriniz varsa oturumları seçerek ayrı ayrı görebilirsiniz.
          </p>
        </div>
        {form}
        {results}
      </div>
    </div>
  );
}
