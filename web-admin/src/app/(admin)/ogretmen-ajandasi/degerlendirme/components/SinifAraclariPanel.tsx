'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { LucideIcon } from 'lucide-react';
import {
  ArrowDownAZ,
  CaseSensitive,
  ChevronRight,
  Clock,
  ClockArrowUp,
  Copy,
  Dices,
  Gauge,
  HeartHandshake,
  LayoutGrid,
  ListOrdered,
  Maximize2,
  Medal,
  Mic,
  MicOff,
  PartyPopper,
  Play,
  RotateCcw,
  ScrollText,
  Shuffle,
  Square,
  Timer,
  UsersRound,
  Wrench,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { StudentMascotIcon } from '../lib/student-mascot-icon';
import { EvalBlobMascot, EvalCardCornerArt, EvalRibbonBadge, EvalSparkleCluster } from './eval-decor';

type Student = { id: string; name: string };

const TOOL_TONES = {
  indigo: {
    border: 'border-indigo-300/45 dark:border-indigo-700/40',
    bg: 'bg-linear-to-br from-indigo-500/12 via-white to-violet-500/8 dark:from-indigo-950/35 dark:via-zinc-950 dark:to-violet-950/25',
    icon: 'bg-linear-to-br from-indigo-500 to-violet-600 text-white shadow-md shadow-indigo-500/20',
    corner: 'text-indigo-400/20 dark:text-indigo-300/15' as string | undefined,
  },
  violet: {
    border: 'border-violet-300/45 dark:border-violet-700/40',
    bg: 'bg-linear-to-br from-violet-500/12 via-white to-fuchsia-500/8 dark:from-violet-950/35 dark:via-zinc-950 dark:to-fuchsia-950/20',
    icon: 'bg-linear-to-br from-violet-500 to-fuchsia-600 text-white shadow-md shadow-violet-500/20',
    corner: 'text-fuchsia-400/22 dark:text-fuchsia-300/14',
  },
  amber: {
    border: 'border-amber-300/50 dark:border-amber-700/40',
    bg: 'bg-linear-to-br from-amber-400/14 via-white to-orange-500/8 dark:from-amber-950/35 dark:via-zinc-950 dark:to-orange-950/20',
    icon: 'bg-linear-to-br from-amber-500 to-orange-600 text-white shadow-md shadow-amber-500/25',
    corner: undefined as string | undefined,
  },
  sky: {
    border: 'border-sky-300/50 dark:border-sky-700/40',
    bg: 'bg-linear-to-br from-sky-400/14 via-white to-cyan-500/8 dark:from-sky-950/35 dark:via-zinc-950 dark:to-cyan-950/20',
    icon: 'bg-linear-to-br from-sky-500 to-cyan-600 text-white shadow-md shadow-sky-500/20',
    corner: 'text-sky-400/22 dark:text-cyan-300/14',
  },
  cyan: {
    border: 'border-cyan-300/45 dark:border-cyan-700/40',
    bg: 'bg-linear-to-br from-cyan-400/12 via-white to-blue-500/8 dark:from-cyan-950/30 dark:via-zinc-950 dark:to-blue-950/20',
    icon: 'bg-linear-to-br from-cyan-500 to-blue-600 text-white shadow-md shadow-cyan-500/20',
    corner: 'text-cyan-400/18 dark:text-blue-300/14',
  },
  emerald: {
    border: 'border-emerald-300/45 dark:border-emerald-700/40',
    bg: 'bg-linear-to-br from-emerald-400/12 via-white to-teal-500/8 dark:from-emerald-950/30 dark:via-zinc-950 dark:to-teal-950/20',
    icon: 'bg-linear-to-br from-emerald-500 to-teal-600 text-white shadow-md shadow-emerald-500/20',
    corner: 'text-emerald-400/18 dark:text-teal-300/14',
  },
  slate: {
    border: 'border-slate-300/50 dark:border-slate-600/40',
    bg: 'bg-linear-to-br from-slate-400/10 via-white to-zinc-400/8 dark:from-slate-900/40 dark:via-zinc-950 dark:to-zinc-900/30',
    icon: 'bg-linear-to-br from-slate-600 to-slate-800 text-white shadow-md shadow-slate-500/15',
    corner: undefined,
  },
  orange: {
    border: 'border-orange-300/50 dark:border-orange-800/40',
    bg: 'bg-linear-to-br from-orange-400/12 via-white to-amber-500/8 dark:from-orange-950/28 dark:via-zinc-950 dark:to-amber-950/15',
    icon: 'bg-linear-to-br from-orange-500 to-red-500 text-white shadow-md shadow-orange-500/20',
    corner: undefined,
  },
  lime: {
    border: 'border-lime-300/45 dark:border-lime-800/35',
    bg: 'bg-linear-to-br from-lime-400/10 via-white to-green-500/8 dark:from-lime-950/25 dark:via-zinc-950 dark:to-green-950/20',
    icon: 'bg-linear-to-br from-lime-500 to-green-600 text-white shadow-md shadow-lime-500/20',
    corner: 'text-lime-400/18 dark:text-green-300/12',
  },
  blue: {
    border: 'border-blue-300/45 dark:border-blue-800/40',
    bg: 'bg-linear-to-br from-blue-400/10 via-white to-indigo-500/8 dark:from-blue-950/28 dark:via-zinc-950 dark:to-indigo-950/20',
    icon: 'bg-linear-to-br from-blue-500 to-indigo-600 text-white shadow-md shadow-blue-500/18',
    corner: 'text-blue-400/18 dark:text-indigo-300/12',
  },
  pink: {
    border: 'border-pink-300/45 dark:border-pink-900/35',
    bg: 'bg-linear-to-br from-pink-400/10 via-white to-rose-500/8 dark:from-pink-950/22 dark:via-zinc-950 dark:to-rose-950/18',
    icon: 'bg-linear-to-br from-pink-500 to-rose-600 text-white shadow-md shadow-pink-500/18',
    corner: undefined,
  },
} as const;

function ToolCard({
  tone,
  icon: Icon,
  title,
  subtitle,
  children,
  sparkle,
}: {
  tone: keyof typeof TOOL_TONES;
  icon: LucideIcon;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  sparkle?: boolean;
}) {
  const t = TOOL_TONES[tone];
  return (
    <section className={cn('relative overflow-hidden rounded-2xl border-2 p-2.5 shadow-sm sm:rounded-3xl sm:p-4', t.border, t.bg)}>
      {t.corner ? <EvalCardCornerArt className={t.corner} /> : null}
      {sparkle ? <EvalSparkleCluster className="pointer-events-none absolute right-1.5 top-1.5 size-7 opacity-45 sm:right-2 sm:top-2 sm:size-9" /> : null}
      <div className="relative z-1 mb-2 flex items-start gap-2 sm:mb-3 sm:gap-3">
        <span className={cn('flex size-10 shrink-0 items-center justify-center rounded-xl sm:size-12 sm:rounded-2xl', t.icon)}>
          <Icon className="size-[1.1rem] sm:size-6" aria-hidden />
        </span>
        <div className="min-w-0 flex-1 pt-0.5">
          <h3 className="text-[13px] font-extrabold leading-tight tracking-tight sm:text-sm">{title}</h3>
          {subtitle ? <p className="mt-0.5 text-[10px] leading-snug text-muted-foreground sm:text-xs">{subtitle}</p> : null}
        </div>
      </div>
      <div className="relative z-1">{children}</div>
    </section>
  );
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

/** Tek kalan öğrenciyi son gruba ekler (en fazla 3 kişi). */
function makeRandomPairGroups(list: Student[]): Student[][] {
  if (list.length === 0) return [];
  const sh = shuffle(list);
  const out: Student[][] = [];
  let i = 0;
  while (i < sh.length) {
    if (i + 1 < sh.length) {
      out.push([sh[i]!, sh[i + 1]!]);
      i += 2;
    } else {
      const last = sh[i]!;
      if (out.length > 0) out[out.length - 1] = [...out[out.length - 1]!, last];
      else out.push([last]);
      i += 1;
    }
  }
  return out;
}

function BoardModeOverlay({
  open,
  onClose,
  traffic,
  timerSec,
  fmt,
  queue,
  queueIndex,
  picked,
}: {
  open: boolean;
  onClose: () => void;
  traffic: 'off' | 'red' | 'yellow' | 'green';
  timerSec: number;
  fmt: (s: number) => string;
  queue: Student[] | null;
  queueIndex: number;
  picked: Student | null;
}) {
  useEffect(() => {
    if (!open) return;
    const fn = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', fn);
    return () => window.removeEventListener('keydown', fn);
  }, [open, onClose]);

  if (!open || typeof document === 'undefined') return null;

  const headline =
    queue && queue.length > 0
      ? { name: queue[queueIndex]!.name, id: queue[queueIndex]!.id, sub: `${queueIndex + 1} / ${queue.length} · sunum sırası` as const }
      : picked
        ? { name: picked.name, id: picked.id, sub: 'Rastgele seçilen' as const }
        : null;

  return createPortal(
    <div
      className="fixed inset-0 z-300 flex flex-col bg-zinc-950 text-white"
      role="dialog"
      aria-modal="true"
      aria-label="Tahta modu"
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-2 p-3 sm:p-5">
        {timerSec > 0 ? (
          <div className="pointer-events-none rounded-xl bg-black/40 px-3 py-2 font-mono text-xl font-black tabular-nums text-amber-200 ring-1 ring-white/10 sm:text-3xl">
            {fmt(timerSec)}
          </div>
        ) : (
          <span />
        )}
        <Button
          type="button"
          variant="secondary"
          className="pointer-events-auto h-10 shrink-0 rounded-xl px-4 text-xs font-bold shadow-lg sm:h-9"
          onClick={onClose}
        >
          Kapat (Esc)
        </Button>
      </div>

      <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-5 px-4 pb-36 pt-20 text-center sm:gap-8 sm:pb-40 sm:pt-24">
        {headline ? (
          <>
            <span className="flex size-28 shrink-0 items-center justify-center overflow-hidden rounded-3xl bg-white ring-4 ring-white/20 sm:size-36">
              <StudentMascotIcon studentId={headline.id} className="size-28 sm:size-36" />
            </span>
            <p className="max-w-[95vw] wrap-break-word text-4xl font-black leading-tight tracking-tight sm:text-6xl md:text-7xl lg:text-8xl">{headline.name}</p>
            <p className="text-sm font-semibold text-zinc-400">{headline.sub}</p>
          </>
        ) : (
          <p className="max-w-md text-balance text-lg leading-relaxed text-zinc-400">
            Sunum sırası oluşturun veya rastgele öğrenci seçin; burada projeksiyon için büyük gösterim açılır. Veri sunucuya gitmez.
          </p>
        )}
      </div>

      <div className="absolute bottom-6 left-1/2 flex -translate-x-1/2 gap-3 sm:bottom-10 sm:gap-5">
        {(
          [
            { k: 'red' as const, cls: 'bg-red-600' },
            { k: 'yellow' as const, cls: 'bg-amber-400' },
            { k: 'green' as const, cls: 'bg-emerald-500' },
          ] as const
        ).map(({ k, cls }) => (
          <div
            key={k}
            className={cn(
              'size-14 rounded-full shadow-lg transition-all sm:size-20',
              cls,
              traffic === 'off' ? 'opacity-25' : traffic === k ? 'scale-110 opacity-100 ring-4 ring-white/90 ring-offset-4 ring-offset-zinc-950' : 'opacity-35',
            )}
            aria-hidden
          />
        ))}
      </div>
    </div>,
    document.body,
  );
}

export function SinifAraclariPanel({
  students,
  panelClass,
  headClass,
  iconWrapClass,
  iconClass,
}: {
  students: Student[];
  panelClass: string;
  headClass: string;
  iconWrapClass: string;
  iconClass: string;
}) {
  const [picked, setPicked] = useState<Student | null>(null);
  const [groupCount, setGroupCount] = useState(4);
  const [groups, setGroups] = useState<Student[][]>([]);
  const [timerSec, setTimerSec] = useState(0);
  const [timerRunning, setTimerRunning] = useState(false);
  const [queue, setQueue] = useState<Student[] | null>(null);
  const [queueIndex, setQueueIndex] = useState(0);
  const [pairGroups, setPairGroups] = useState<Student[][]>([]);
  const [dice, setDice] = useState<number | null>(null);
  const [swSec, setSwSec] = useState(0);
  const [swRun, setSwRun] = useState(false);
  const [teamA, setTeamA] = useState(0);
  const [teamB, setTeamB] = useState(0);
  const [traffic, setTraffic] = useState<'off' | 'red' | 'yellow' | 'green'>('off');
  const [boardOpen, setBoardOpen] = useState(false);
  const [letterPool, setLetterPool] = useState('ABCÇDEFGĞHIİJKLMNOÖPRSŞTUÜVYZ');
  const [drawnLetter, setDrawnLetter] = useState<string | null>(null);
  const [wordBank, setWordBank] = useState('');
  const [drawnWord, setDrawnWord] = useState<string | null>(null);
  const [scoreBoard, setScoreBoard] = useState([0, 0, 0, 0]);

  const pool = students;

  const sortedByName = useMemo(() => [...pool].sort((a, b) => a.name.localeCompare(b.name, 'tr')), [pool]);

  const pickRandom = useCallback(() => {
    if (pool.length === 0) return;
    setPicked(pool[Math.floor(Math.random() * pool.length)] ?? null);
  }, [pool]);

  const makeGroups = useCallback(() => {
    if (pool.length === 0) return;
    const n = Math.min(12, Math.max(2, Math.round(groupCount)));
    const sh = shuffle(pool);
    const g: Student[][] = Array.from({ length: n }, () => []);
    sh.forEach((s, i) => g[i % n]!.push(s));
    setGroups(g);
  }, [pool, groupCount]);

  const startQueue = useCallback(() => {
    if (pool.length === 0) return;
    setQueue(shuffle(pool));
    setQueueIndex(0);
  }, [pool]);

  const buildRandomPairs = useCallback(() => {
    setPairGroups(makeRandomPairGroups(pool));
  }, [pool]);

  const copyAllNames = useCallback(async () => {
    if (pool.length === 0) return;
    try {
      await navigator.clipboard.writeText(pool.map((s) => s.name).join('\n'));
      toast.success(`${pool.length} isim panoya kopyalandı`);
    } catch {
      toast.error('Pano kullanılamadı');
    }
  }, [pool]);

  const rollDice = useCallback(() => {
    setDice(1 + Math.floor(Math.random() * 6));
  }, []);

  const drawLetter = useCallback(() => {
    const s = letterPool.trim();
    if (!s) return;
    const chars = [...s];
    setDrawnLetter(chars[Math.floor(Math.random() * chars.length)] ?? null);
  }, [letterPool]);

  const drawWord = useCallback(() => {
    const lines = wordBank.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    if (lines.length === 0) return;
    setDrawnWord(lines[Math.floor(Math.random() * lines.length)] ?? null);
  }, [wordBank]);

  useEffect(() => {
    if (!timerRunning) return;
    const id = setInterval(() => {
      setTimerSec((s) => {
        if (s <= 1) {
          setTimerRunning(false);
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [timerRunning]);

  useEffect(() => {
    if (!swRun) return;
    const id = setInterval(() => setSwSec((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [swRun]);

  const startTimer = (minutes: number) => {
    setTimerSec(minutes * 60);
    setTimerRunning(true);
  };

  const fmt = (s: number) => {
    const m = Math.floor(s / 60);
    const r = s % 60;
    return `${m}:${r.toString().padStart(2, '0')}`;
  };

  const groupColors = [
    'border-violet-200/70 bg-violet-500/8 dark:border-violet-800/50 dark:bg-violet-950/30',
    'border-sky-200/70 bg-sky-500/8 dark:border-sky-800/50 dark:bg-sky-950/25',
    'border-emerald-200/70 bg-emerald-500/8 dark:border-emerald-800/50 dark:bg-emerald-950/25',
    'border-amber-200/70 bg-amber-500/8 dark:border-amber-800/50 dark:bg-amber-950/25',
    'border-rose-200/70 bg-rose-500/8 dark:border-rose-800/45 dark:bg-rose-950/25',
    'border-fuchsia-200/70 bg-fuchsia-500/8 dark:border-fuchsia-800/45 dark:bg-fuchsia-950/20',
  ];

  return (
    <>
    <Card className={cn('relative overflow-hidden rounded-3xl border-2 shadow-md bg-card', panelClass)}>
      <EvalSparkleCluster className="pointer-events-none absolute left-2 top-12 size-9 opacity-70 sm:left-4 sm:top-14" />
      <EvalRibbonBadge className="pointer-events-none absolute right-2 top-2 h-7 w-20 opacity-70 sm:right-4 sm:top-3" />
      <CardHeader className={cn('relative z-1 flex flex-col gap-2 pb-2 sm:flex-row sm:items-center sm:justify-between sm:pb-0', headClass)}>
        <div className="flex min-w-0 flex-1 items-center gap-2.5 sm:gap-3">
          <span className={cn('relative flex size-10 shrink-0 items-center justify-center rounded-2xl shadow-inner ring-2 ring-white/40 dark:ring-white/10 sm:size-11', iconWrapClass)}>
            <Wrench className={cn('size-[1.15rem] shrink-0 sm:size-5', iconClass)} />
            <span className="absolute -bottom-0.5 -right-0.5 flex size-6 items-center justify-center rounded-full bg-white shadow sm:size-7 dark:bg-sky-950">
              <EvalBlobMascot size={24} className="drop-shadow sm:h-[26px] sm:w-[26px]" />
            </span>
          </span>
          <div className="min-w-0">
            <CardTitle className="flex items-center gap-1.5 text-sm font-extrabold tracking-tight sm:text-base">
              <PartyPopper className="size-4 shrink-0 text-sky-600 dark:text-sky-400 sm:size-5" aria-hidden />
              <span className="truncate">Sınıf araçları</span>
            </CardTitle>
            <p className="text-[10px] leading-snug text-muted-foreground sm:text-xs">
              Tahta modu, harf/kelime, puan tahtası; sıra, çift, grup, süre, skor, ışık, zar — yalnızca tarayıcıda.
            </p>
          </div>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-9 w-full shrink-0 gap-2 rounded-xl border-2 font-bold sm:w-auto"
          onClick={() => setBoardOpen(true)}
        >
          <Maximize2 className="size-3.5" aria-hidden />
          Tahta modu
        </Button>
      </CardHeader>
      <CardContent className="relative z-1 space-y-2.5 p-2.5 sm:space-y-5 sm:p-6">
        <p className="rounded-xl border border-border/60 bg-muted/25 px-2.5 py-2 text-[9px] leading-relaxed text-muted-foreground sm:text-[10px]">
          <span className="font-semibold text-foreground">KVKK / gizlilik:</span> Araçlar sunucuya öğrenci kaydı göndermez. Mikrofon yalnızca siz açarsanız çalışır; ses kaydı veya yüz tanıma yoktur. Pano ve sıralama yalnızca bu listedeki isimleri cihazınızda kullanır.
        </p>
        <ToolCard
          tone="indigo"
          icon={Shuffle}
          title="Rastgele öğrenci"
          subtitle="Tek tıkla sınıftan bir isim."
        >
          {pool.length === 0 ? (
            <p className="text-xs text-muted-foreground sm:text-sm">Öğrenci listesi boş.</p>
          ) : (
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
              <Button type="button" size="sm" onClick={pickRandom} className="h-10 w-full gap-2 rounded-xl bg-linear-to-r from-indigo-600 to-violet-600 text-white shadow-md hover:opacity-95 sm:h-9 sm:w-auto">
                <Shuffle className="size-4" aria-hidden />
                Seç
              </Button>
              {picked ? (
                <div className="flex min-h-11 w-full items-center gap-2 rounded-xl border border-indigo-200/60 bg-white/90 px-2.5 py-1.5 shadow-inner dark:border-indigo-800/50 dark:bg-zinc-900/90 sm:flex-1">
                  <span className="flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-white ring-1 ring-black/5 dark:bg-zinc-800 dark:ring-white/10 sm:size-10">
                    <StudentMascotIcon studentId={picked.id} className="size-9 sm:size-10" />
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm font-bold">{picked.name}</span>
                </div>
              ) : (
                <p className="text-center text-[11px] text-muted-foreground sm:flex-1 sm:text-left sm:text-xs">Henüz seçim yok.</p>
              )}
            </div>
          )}
        </ToolCard>

        <ToolCard tone="cyan" icon={ListOrdered} title="Sunum sırası" subtitle="Karışık sıra; tahta / sözlü sırayla ilerleyin.">
          {pool.length === 0 ? (
            <p className="text-xs text-muted-foreground sm:text-sm">Öğrenci listesi boş.</p>
          ) : queue === null ? (
            <Button
              type="button"
              size="sm"
              onClick={startQueue}
              className="h-10 w-full gap-2 rounded-xl bg-linear-to-r from-cyan-600 to-blue-600 text-white shadow-md hover:opacity-95 sm:h-9"
            >
              <ListOrdered className="size-4" aria-hidden />
              Sıra oluştur
            </Button>
          ) : (
            <div className="space-y-2">
              <div className="flex flex-col items-center gap-2 rounded-xl border border-cyan-200/60 bg-white/90 px-3 py-2.5 shadow-inner dark:border-cyan-800/45 dark:bg-zinc-900/90 sm:flex-row sm:justify-center sm:gap-3">
                <span className="flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white ring-1 ring-black/5 dark:bg-zinc-800 dark:ring-white/10">
                  <StudentMascotIcon studentId={queue[queueIndex]!.id} className="size-11" />
                </span>
                <div className="min-w-0 text-center sm:text-left">
                  <p className="truncate text-sm font-bold">{queue[queueIndex]!.name}</p>
                  <p className="text-[10px] font-semibold tabular-nums text-muted-foreground">
                    {queueIndex + 1} / {queue.length} sıra
                  </p>
                </div>
              </div>
              <Button
                type="button"
                size="sm"
                className="h-10 w-full gap-2 rounded-xl bg-cyan-600 text-white hover:bg-cyan-600/90 sm:h-9"
                onClick={() => setQueueIndex((i) => (i + 1) % queue.length)}
              >
                <ChevronRight className="size-4" aria-hidden />
                Sıradaki
              </Button>
              <div className="grid grid-cols-2 gap-1.5">
                <Button type="button" variant="outline" size="sm" className="h-9 rounded-xl border-cyan-300/50 text-xs" onClick={() => setQueueIndex(0)}>
                  Başa dön
                </Button>
                <Button type="button" variant="secondary" size="sm" className="h-9 rounded-xl text-xs" onClick={startQueue}>
                  Yeniden karıştır
                </Button>
              </div>
            </div>
          )}
        </ToolCard>

        <ToolCard tone="emerald" icon={HeartHandshake} title="Çift çalışma" subtitle="Rastgele eşler; tek kalan son gruba eklenir.">
          {pool.length < 2 ? (
            <p className="text-xs text-muted-foreground sm:text-sm">En az 2 öğrenci gerekir.</p>
          ) : (
            <>
              <Button
                type="button"
                size="sm"
                onClick={buildRandomPairs}
                className="h-10 w-full gap-2 rounded-xl bg-linear-to-r from-emerald-600 to-teal-600 text-white shadow-md hover:opacity-95 sm:h-9 sm:w-auto"
              >
                <HeartHandshake className="size-4" aria-hidden />
                Çiftleri oluştur
              </Button>
              {pairGroups.length > 0 && (
                <div className="mt-2 grid max-h-[min(50vh,22rem)] grid-cols-1 gap-2 overflow-y-auto min-[400px]:grid-cols-2 sm:max-h-none lg:grid-cols-3">
                  {pairGroups.map((g, gi) => (
                    <div
                      key={gi}
                      className="rounded-xl border-2 border-emerald-200/60 bg-emerald-500/6 p-2 shadow-sm dark:border-emerald-800/50 dark:bg-emerald-950/25"
                    >
                      <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wide text-emerald-900 dark:text-emerald-200">
                        {g.length === 3 ? 'Üçlü' : g.length === 2 ? 'Çift' : 'Tek'} · {gi + 1}
                      </p>
                      <ul className="space-y-1 text-[11px] font-medium leading-snug sm:text-sm">
                        {g.map((s) => (
                          <li key={s.id} className="flex items-center gap-1.5 truncate">
                            <span className="size-1.5 shrink-0 rounded-full bg-emerald-500/70" aria-hidden />
                            {s.name}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </ToolCard>

        <ToolCard tone="violet" icon={UsersRound} title="Gruplara böl" subtitle="2–12 grup; öğrenciler eşit dağıtılır.">
          {pool.length === 0 ? (
            <p className="text-xs text-muted-foreground sm:text-sm">Öğrenci listesi boş.</p>
          ) : (
            <>
              <div className="mb-2 flex flex-wrap items-center gap-1.5 sm:mb-3 sm:gap-2">
                <label className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground sm:text-sm">
                  <span className="shrink-0">Grup</span>
                  <input
                    type="number"
                    min={2}
                    max={12}
                    value={groupCount}
                    onChange={(e) => setGroupCount(Number(e.target.value) || 2)}
                    className="h-9 w-12 rounded-lg border border-violet-200/70 bg-background text-center text-xs font-bold tabular-nums dark:border-violet-800/60 sm:w-14 sm:text-sm"
                  />
                </label>
                <Button type="button" size="sm" variant="secondary" onClick={makeGroups} className="h-9 gap-1.5 rounded-xl px-3 text-xs font-semibold sm:text-sm">
                  <UsersRound className="size-3.5 opacity-80" aria-hidden />
                  Oluştur
                </Button>
              </div>
              {groups.length > 0 && (
                <div className="grid max-h-[min(55vh,28rem)] grid-cols-1 gap-2 overflow-y-auto pr-0.5 min-[400px]:grid-cols-2 sm:max-h-none sm:grid-cols-2 lg:grid-cols-3 sm:gap-3">
                  {groups.map((g, gi) => (
                    <div
                      key={gi}
                      className={cn(
                        'rounded-xl border-2 p-2 shadow-sm sm:rounded-2xl sm:p-3',
                        groupColors[gi % groupColors.length],
                      )}
                    >
                      <p className="mb-1.5 flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-muted-foreground sm:text-xs">
                        <span className="flex size-5 items-center justify-center rounded-md bg-violet-600/15 text-[10px] font-black text-violet-700 dark:text-violet-300">
                          {gi + 1}
                        </span>
                        Grup
                      </p>
                      <ul className="max-h-32 space-y-1 overflow-y-auto text-[11px] leading-snug sm:max-h-none sm:text-sm">
                        {g.map((s) => (
                          <li key={s.id} className="flex items-center gap-1.5 truncate">
                            <span className="size-1 shrink-0 rounded-full bg-violet-500/60" aria-hidden />
                            {s.name}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </ToolCard>

        <ToolCard tone="amber" icon={Timer} title="Süre sayacı" subtitle="Sessiz çalışma veya etkinlik için geri sayım." sparkle>
          <div className="mb-2 flex items-baseline justify-between gap-2 sm:mb-3">
            <div className="font-mono text-2xl font-black tabular-nums tracking-tight text-amber-950 dark:text-amber-100 sm:text-4xl">{fmt(timerSec)}</div>
            <div className="flex shrink-0 gap-1">
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="size-9 rounded-lg border-amber-300/60 sm:size-8"
                onClick={() => setTimerRunning((r) => !r)}
                disabled={timerSec <= 0}
                title={timerRunning ? 'Duraklat' : 'Devam'}
              >
                {timerRunning ? <Square className="size-3.5" /> : <Play className="size-3.5" />}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-9 rounded-lg sm:size-8"
                onClick={() => {
                  setTimerRunning(false);
                  setTimerSec(0);
                }}
                title="Sıfırla"
              >
                <RotateCcw className="size-3.5" />
              </Button>
            </div>
          </div>
          <div className="flex flex-wrap gap-1.5 sm:gap-2">
            {[1, 2, 3, 5, 10].map((m) => (
              <Button
                key={m}
                type="button"
                variant="outline"
                size="sm"
                className="h-9 min-w-13 gap-1 rounded-xl border-amber-300/55 bg-amber-500/5 px-2 text-xs font-bold text-amber-950 hover:bg-amber-500/12 dark:border-amber-700/50 dark:text-amber-100 sm:h-8 sm:px-2.5"
                onClick={() => startTimer(m)}
                disabled={timerRunning}
              >
                <Clock className="size-3 opacity-70" aria-hidden />
                {m}′
              </Button>
            ))}
          </div>
        </ToolCard>

        <div className="grid gap-2.5 sm:grid-cols-2 sm:gap-4">
          <ToolCard tone="lime" icon={ClockArrowUp} title="Kronometre" subtitle="Yukarı sayım; dışa veri gönderilmez.">
            <div className="mb-2 flex items-center justify-between gap-2">
              <div className="font-mono text-xl font-black tabular-nums text-lime-950 dark:text-lime-100 sm:text-2xl">{fmt(swSec)}</div>
              <div className="flex gap-1">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="size-9 rounded-lg border-lime-300/60 sm:size-8"
                  onClick={() => setSwRun((r) => !r)}
                  title={swRun ? 'Duraklat' : 'Başlat'}
                >
                  {swRun ? <Square className="size-3.5" /> : <Play className="size-3.5" />}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-9 rounded-lg sm:size-8"
                  onClick={() => {
                    setSwRun(false);
                    setSwSec(0);
                  }}
                  title="Sıfırla"
                >
                  <RotateCcw className="size-3.5" />
                </Button>
              </div>
            </div>
          </ToolCard>
          <ToolCard tone="blue" icon={ArrowDownAZ} title="A–Z sıra" subtitle="Yoklama / liste için alfabetik (yalnızca bu ekranda).">
            {sortedByName.length === 0 ? (
              <p className="text-xs text-muted-foreground">Liste boş.</p>
            ) : (
              <ul className="max-h-40 space-y-1 overflow-y-auto rounded-lg border border-blue-200/40 bg-white/60 p-1.5 dark:border-blue-900/40 dark:bg-zinc-900/50 sm:max-h-52">
                {sortedByName.map((s) => (
                  <li key={s.id} className="flex items-center gap-2 rounded-md px-1 py-0.5 text-[11px] font-medium sm:text-xs">
                    <span className="flex size-6 shrink-0 items-center justify-center overflow-hidden rounded-md bg-white ring-1 ring-black/5 dark:bg-zinc-800">
                      <StudentMascotIcon studentId={s.id} className="size-6" />
                    </span>
                    <span className="min-w-0 truncate">{s.name}</span>
                  </li>
                ))}
              </ul>
            )}
          </ToolCard>
        </div>

        <ToolCard tone="pink" icon={Medal} title="Takım skoru" subtitle="İsim veya öğrenci kaydı tutmaz; yalnızca iki sayaç.">
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-xl border-2 border-rose-300/50 bg-rose-500/8 p-2 text-center dark:border-rose-800/45 dark:bg-rose-950/25">
              <p className="text-[10px] font-bold uppercase tracking-wide text-rose-900 dark:text-rose-200">A</p>
              <p className="text-2xl font-black tabular-nums text-rose-800 dark:text-rose-100">{teamA}</p>
              <Button type="button" size="sm" variant="secondary" className="mt-1 h-8 w-full rounded-lg text-xs" onClick={() => setTeamA((n) => n + 1)}>
                +1
              </Button>
            </div>
            <div className="rounded-xl border-2 border-blue-300/50 bg-blue-500/8 p-2 text-center dark:border-blue-800/45 dark:bg-blue-950/25">
              <p className="text-[10px] font-bold uppercase tracking-wide text-blue-900 dark:text-blue-200">B</p>
              <p className="text-2xl font-black tabular-nums text-blue-800 dark:text-blue-100">{teamB}</p>
              <Button type="button" size="sm" variant="secondary" className="mt-1 h-8 w-full rounded-lg text-xs" onClick={() => setTeamB((n) => n + 1)}>
                +1
              </Button>
            </div>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="mt-2 h-8 w-full rounded-xl text-xs"
            onClick={() => {
              setTeamA(0);
              setTeamB(0);
            }}
          >
            Skoru sıfırla
          </Button>
        </ToolCard>

        <ToolCard tone="slate" icon={Gauge} title="Trafik ışığı (manuel)" subtitle="Mikrofon yok; sınıfa görsel işaret — tamamen sizin seçiminiz.">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <button
              type="button"
              onClick={() => setTraffic('off')}
              className={cn(
                'flex h-12 flex-col items-center justify-center rounded-xl border-2 text-[10px] font-bold transition-all sm:h-14 sm:text-xs',
                traffic === 'off'
                  ? 'border-slate-500 bg-slate-600 text-white shadow-md ring-2 ring-slate-400/50'
                  : 'border-border/60 bg-muted/40 text-muted-foreground hover:bg-muted',
              )}
            >
              Kapalı
            </button>
            <button
              type="button"
              onClick={() => setTraffic('red')}
              className={cn(
                'flex h-12 flex-col items-center justify-center rounded-xl border-2 text-[10px] font-bold text-white transition-all sm:h-14 sm:text-xs',
                traffic === 'red' ? 'border-red-700 bg-red-600 shadow-lg ring-2 ring-red-400/60' : 'border-red-300/50 bg-red-500/70 opacity-80 hover:opacity-100 dark:border-red-900',
              )}
            >
              Kırmızı
            </button>
            <button
              type="button"
              onClick={() => setTraffic('yellow')}
              className={cn(
                'flex h-12 flex-col items-center justify-center rounded-xl border-2 text-[10px] font-bold text-amber-950 transition-all sm:h-14 sm:text-xs',
                traffic === 'yellow'
                  ? 'border-amber-500 bg-amber-400 shadow-lg ring-2 ring-amber-300/70'
                  : 'border-amber-300/60 bg-amber-400/70 opacity-85 hover:opacity-100 dark:border-amber-700',
              )}
            >
              Sarı
            </button>
            <button
              type="button"
              onClick={() => setTraffic('green')}
              className={cn(
                'flex h-12 flex-col items-center justify-center rounded-xl border-2 text-[10px] font-bold text-white transition-all sm:h-14 sm:text-xs',
                traffic === 'green' ? 'border-emerald-700 bg-emerald-600 shadow-lg ring-2 ring-emerald-400/50' : 'border-emerald-300/50 bg-emerald-500/75 opacity-85 hover:opacity-100 dark:border-emerald-800',
              )}
            >
              Yeşil
            </button>
          </div>
        </ToolCard>

        <div className="grid gap-2.5 lg:grid-cols-3 sm:gap-4">
          <ToolCard tone="indigo" icon={CaseSensitive} title="Harf havuzu" subtitle="Metni siz düzenlersiniz; çekim yalnızca cihazda.">
            <label className="mb-1.5 block text-[10px] font-semibold text-muted-foreground">Harfler (tek tek veya blok)</label>
            <input
              type="text"
              value={letterPool}
              onChange={(e) => {
                setLetterPool(e.target.value);
                setDrawnLetter(null);
              }}
              className="mb-2 h-9 w-full rounded-lg border border-indigo-200/70 bg-background px-2 text-xs font-medium dark:border-indigo-800/60"
              spellCheck={false}
            />
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <Button type="button" size="sm" className="h-10 w-full gap-2 rounded-xl bg-indigo-600 text-white hover:bg-indigo-600/90 sm:h-9 sm:w-auto" onClick={drawLetter}>
                Harf çek
              </Button>
              {drawnLetter ? (
                <div className="flex min-h-14 flex-1 items-center justify-center rounded-2xl border-2 border-indigo-300/50 bg-indigo-500/10 text-4xl font-black text-indigo-950 dark:border-indigo-700/50 dark:bg-indigo-950/30 dark:text-indigo-100 sm:text-5xl">
                  {drawnLetter}
                </div>
              ) : (
                <p className="text-center text-[11px] text-muted-foreground sm:flex-1 sm:text-left sm:text-xs">Havuz boş olmamalı.</p>
              )}
            </div>
          </ToolCard>
          <ToolCard tone="violet" icon={ScrollText} title="Kelime havuzu" subtitle="Her satıra bir kelime; rastgele bir satır.">
            <textarea
              value={wordBank}
              onChange={(e) => {
                setWordBank(e.target.value);
                setDrawnWord(null);
              }}
              rows={3}
              placeholder={'Örnek:\nenerji\ndenge\nişbirliği'}
              className="mb-2 w-full resize-y rounded-lg border border-violet-200/70 bg-background p-2 text-xs dark:border-violet-800/60"
              spellCheck={false}
            />
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start">
              <Button type="button" size="sm" className="h-10 w-full shrink-0 gap-2 rounded-xl bg-violet-600 text-white hover:bg-violet-600/90 sm:h-9 sm:w-auto" onClick={drawWord}>
                Kelime çek
              </Button>
              {drawnWord ? (
                <p className="min-h-12 flex-1 wrap-break-word rounded-2xl border-2 border-violet-300/50 bg-violet-500/10 px-3 py-2 text-center text-lg font-bold leading-snug text-violet-950 dark:border-violet-700/50 dark:bg-violet-950/25 dark:text-violet-50 sm:text-left sm:text-xl">
                  {drawnWord}
                </p>
              ) : (
                <p className="text-center text-[11px] text-muted-foreground sm:flex-1 sm:pt-2 sm:text-left sm:text-xs">En az bir dolu satır gerekir.</p>
              )}
            </div>
          </ToolCard>
          <ToolCard tone="slate" icon={LayoutGrid} title="Puan tahtası (4)" subtitle="Sayfa yenilenince sıfırlanır; isim tutulmaz.">
            <div className="grid grid-cols-2 gap-2">
              {scoreBoard.map((sc, i) => (
                <div key={i} className="rounded-xl border-2 border-slate-300/50 bg-slate-500/6 p-2 text-center dark:border-slate-600/50 dark:bg-slate-900/40">
                  <p className="text-[10px] font-bold uppercase text-muted-foreground">Sütun {i + 1}</p>
                  <p className="text-2xl font-black tabular-nums">{sc}</p>
                  <div className="mt-1 flex gap-1">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-8 flex-1 rounded-lg px-0 text-xs"
                      onClick={() => setScoreBoard((prev) => {
                        const n = [...prev];
                        n[i] = Math.max(0, n[i]! - 1);
                        return n;
                      })}
                    >
                      −1
                    </Button>
                    <Button type="button" size="sm" variant="secondary" className="h-8 flex-1 rounded-lg px-0 text-xs" onClick={() => setScoreBoard((prev) => {
                      const n = [...prev];
                      n[i] = (n[i] ?? 0) + 1;
                      return n;
                    })}>
                      +1
                    </Button>
                  </div>
                </div>
              ))}
            </div>
            <Button type="button" variant="outline" size="sm" className="mt-2 h-8 w-full rounded-xl text-xs" onClick={() => setScoreBoard([0, 0, 0, 0])}>
              Tümünü sıfırla
            </Button>
          </ToolCard>
        </div>

        <div className="grid gap-2.5 sm:grid-cols-2 sm:gap-4">
          <ToolCard tone="slate" icon={Copy} title="İsim listesi" subtitle="Her satırda bir isim — yapıştırılabilir.">
            {pool.length === 0 ? (
              <p className="text-xs text-muted-foreground sm:text-sm">Liste boş.</p>
            ) : (
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => void copyAllNames()}
                className="h-10 w-full gap-2 rounded-xl border-slate-300/70 bg-slate-500/5 font-semibold text-slate-900 hover:bg-slate-500/10 dark:border-slate-600 dark:text-slate-100 sm:h-9"
              >
                <Copy className="size-4 shrink-0" aria-hidden />
                Panoya kopyala
              </Button>
            )}
          </ToolCard>
          <ToolCard tone="orange" icon={Dices} title="Zar (1–6)" subtitle="Oyun veya rastgele seçim için.">
            <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
              <Button
                type="button"
                size="sm"
                onClick={rollDice}
                className="h-10 w-full gap-2 rounded-xl bg-linear-to-r from-orange-600 to-red-500 text-white shadow-md hover:opacity-95 sm:h-9 sm:w-auto"
              >
                <Dices className="size-4" aria-hidden />
                Zar at
              </Button>
              {dice !== null ? (
                <div
                  key={dice}
                  className="flex h-14 min-w-14 items-center justify-center self-center rounded-2xl border-2 border-orange-300/60 bg-orange-500/10 text-2xl font-black tabular-nums text-orange-950 shadow-inner animate-in zoom-in-50 duration-200 dark:border-orange-700/50 dark:bg-orange-950/30 dark:text-orange-100 sm:h-16 sm:min-w-16 sm:text-3xl"
                >
                  {dice}
                </div>
              ) : (
                <p className="text-center text-[11px] text-muted-foreground sm:flex-1 sm:text-left sm:text-xs">Henüz atılmadı.</p>
              )}
            </div>
          </ToolCard>
        </div>

        <NoiseMeterSection />
      </CardContent>
    </Card>
    <BoardModeOverlay
      open={boardOpen}
      onClose={() => setBoardOpen(false)}
      traffic={traffic}
      timerSec={timerSec}
      fmt={fmt}
      queue={queue}
      queueIndex={queueIndex}
      picked={picked}
    />
    </>
  );
}

function NoiseMeterSection() {
  const [on, setOn] = useState(false);
  const [level, setLevel] = useState(0);
  const [err, setErr] = useState<string | null>(null);
  const rafRef = useRef<number | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const stop = useCallback(() => {
    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    void ctxRef.current?.close();
    ctxRef.current = null;
    setLevel(0);
    setOn(false);
  }, []);

  const start = async () => {
    if (on) return;
    setErr(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const ctx = new AudioContext();
      ctxRef.current = ctx;
      const src = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      src.connect(analyser);
      const data = new Uint8Array(analyser.frequencyBinCount);
      const tick = () => {
        analyser.getByteFrequencyData(data);
        let sum = 0;
        for (let i = 0; i < data.length; i++) sum += data[i]!;
        const avg = sum / data.length / 255;
        setLevel(avg);
        rafRef.current = requestAnimationFrame(tick);
      };
      rafRef.current = requestAnimationFrame(tick);
      setOn(true);
    } catch {
      setErr('Mikrofon izni gerekli veya tarayıcı desteklemiyor.');
      stop();
    }
  };

  useEffect(() => () => stop(), [stop]);

  const pct = Math.min(100, Math.round(level * 100 * 2.5));

  return (
    <ToolCard tone="sky" icon={Gauge} title="Gürültü göstergesi" subtitle="Ortam sesi — HTTPS ve mikrofon izni gerekir.">
      {err ? <p className="mb-2 text-[11px] text-destructive sm:text-sm">{err}</p> : null}
      <div className="mb-2 flex items-center gap-2 sm:mb-3">
        <div className="h-3 min-w-0 flex-1 overflow-hidden rounded-full bg-white/90 shadow-inner ring-2 ring-sky-200/45 dark:bg-sky-950/60 dark:ring-sky-800/40">
          <div
            className="h-full rounded-full bg-linear-to-r from-emerald-400 via-amber-400 to-rose-500 transition-[width] duration-75"
            style={{ width: `${pct}%` }}
          />
        </div>
        <span className="w-8 shrink-0 text-right text-[10px] font-bold tabular-nums text-muted-foreground sm:text-xs">{pct}%</span>
      </div>
      {!on ? (
        <Button type="button" size="sm" variant="outline" className="h-10 w-full gap-2 rounded-xl border-sky-300/60 bg-sky-500/5 text-sky-900 hover:bg-sky-500/10 dark:text-sky-100 sm:h-9 sm:w-auto" onClick={() => void start()}>
          <Mic className="size-4 text-sky-600 dark:text-sky-400" aria-hidden />
          Mikrofonu aç
        </Button>
      ) : (
        <Button type="button" size="sm" variant="destructive" className="h-10 w-full gap-2 rounded-xl sm:h-9 sm:w-auto" onClick={stop}>
          <MicOff className="size-4" aria-hidden />
          Durdur
        </Button>
      )}
    </ToolCard>
  );
}
