'use client';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { GradeMode, OptikRubricTemplate } from '@/lib/optik-api';
import {
  Award,
  BookOpen,
  Camera,
  CheckCircle2,
  Circle,
  FileKey2,
  GraduationCap,
  Sparkles,
  UserRound,
} from 'lucide-react';
import { LoadingSpinner } from '@/components/ui/loading-spinner';

export function OptikOpenPanel({
  ready,
  busy,
  openStep,
  keyText,
  studentText,
  gradeMode,
  maxScore,
  lastGrade,
  ocrConfidence,
  rubrics,
  gradeModes,
  onOpenKey,
  onOpenStudent,
  onGradeMode,
  onMaxScore,
  onGrade,
  onApplyRubric,
  onEditKey,
  onEditStudent,
}: {
  ready: boolean;
  busy: boolean;
  openStep: number;
  keyText: string;
  studentText: string;
  gradeMode: GradeMode;
  maxScore: number;
  lastGrade: { score: number; max_score: number; confidence: number } | null;
  ocrConfidence: number;
  rubrics: OptikRubricTemplate[];
  gradeModes: { value: GradeMode; label: string }[];
  onOpenKey: () => void;
  onOpenStudent: () => void;
  onGradeMode: (m: GradeMode) => void;
  onMaxScore: (n: number) => void;
  onGrade: () => void;
  onApplyRubric: (r: OptikRubricTemplate) => void;
  onEditKey: (t: string) => void;
  onEditStudent: (t: string) => void;
}) {
  const steps = [
    { n: 1, label: 'Anahtar', done: !!keyText, icon: FileKey2 },
    { n: 2, label: 'Öğrenci', done: !!studentText, icon: UserRound },
    { n: 3, label: 'Puan', done: !!lastGrade, icon: Award },
  ];

  return (
    <section className="overflow-hidden rounded-2xl border border-cyan-500/20 bg-card shadow-sm">
      <div className="border-b border-cyan-500/15 bg-linear-to-r from-cyan-500/10 via-sky-500/8 to-transparent px-3 py-2.5">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <BookOpen className="size-4 text-cyan-600" />
          Açık uçlu puanlama
        </h2>
      </div>

      <div className="space-y-3 p-3">
        <div className="flex justify-between gap-1">
          {steps.map((s) => {
            const Icon = s.icon;
            const active = openStep === s.n;
            return (
              <div
                key={s.n}
                className={cn(
                  'flex flex-1 flex-col items-center gap-0.5 rounded-lg py-1.5 text-[10px]',
                  s.done && 'text-emerald-600 dark:text-emerald-400',
                  active && !s.done && 'bg-cyan-500/10 font-semibold text-cyan-800 dark:text-cyan-200',
                )}
              >
                {s.done ? (
                  <CheckCircle2 className="size-4" />
                ) : active ? (
                  <Icon className="size-4" />
                ) : (
                  <Circle className="size-4 opacity-40" />
                )}
                <span>{s.label}</span>
              </div>
            );
          })}
        </div>

        <div className="grid grid-cols-2 gap-2">
          <Button
            type="button"
            variant="outline"
            className={cn(
              'h-auto flex-col gap-1 rounded-xl py-3 text-xs',
              keyText && 'border-emerald-500/40 bg-emerald-500/5',
            )}
            disabled={busy}
            onClick={onOpenKey}
          >
            <FileKey2 className="size-5 text-violet-600" />
            Anahtar
            {keyText ? <span className="text-[9px] text-emerald-600">✓ okundu</span> : <Camera className="size-3.5 opacity-50" />}
          </Button>
          <Button
            type="button"
            variant="outline"
            className={cn(
              'h-auto flex-col gap-1 rounded-xl py-3 text-xs',
              studentText && 'border-emerald-500/40 bg-emerald-500/5',
            )}
            disabled={busy}
            onClick={onOpenStudent}
          >
            <UserRound className="size-5 text-sky-600" />
            Öğrenci
            {studentText ? (
              <span className="text-[9px] text-emerald-600">%{Math.round(ocrConfidence * 100)}</span>
            ) : (
              <Camera className="size-3.5 opacity-50" />
            )}
          </Button>
        </div>

        {rubrics.length > 0 ? (
          <div className="flex gap-1.5 overflow-x-auto pb-0.5 scrollbar-none">
            {rubrics.slice(0, 8).map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => onApplyRubric(r)}
                className="shrink-0 rounded-full border border-violet-500/25 bg-violet-500/8 px-2.5 py-1 text-[10px] font-medium text-violet-900 hover:bg-violet-500/15 dark:text-violet-100"
              >
                <GraduationCap className="mr-1 inline size-3" />
                {r.name}
              </button>
            ))}
          </div>
        ) : null}

        <Select value={gradeMode} onValueChange={(v) => onGradeMode(v as GradeMode)}>
          <SelectTrigger className="h-10 rounded-xl">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {gradeModes.map((m) => (
              <SelectItem key={m.value} value={m.value}>
                {m.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <label className="flex items-center gap-2 rounded-xl border bg-muted/20 px-3 py-2">
          <span className="text-xs text-muted-foreground">Maks puan</span>
          <input
            type="number"
            className="ml-auto w-16 rounded-lg border bg-background px-2 py-1 text-right text-sm font-semibold"
            value={maxScore}
            min={1}
            max={100}
            onChange={(e) => onMaxScore(Number(e.target.value) || 10)}
          />
        </label>

        {keyText ? (
          <textarea
            className="min-h-[56px] w-full rounded-xl border bg-muted/15 p-2 text-xs"
            value={keyText}
            onChange={(e) => onEditKey(e.target.value)}
            placeholder="Anahtar metni"
          />
        ) : null}
        {studentText ? (
          <textarea
            className="min-h-[56px] w-full rounded-xl border bg-muted/15 p-2 text-xs"
            value={studentText}
            onChange={(e) => onEditStudent(e.target.value)}
            placeholder="Öğrenci cevabı"
          />
        ) : null}

        <Button
          type="button"
          className="h-11 w-full gap-2 rounded-xl bg-linear-to-r from-cyan-600 to-sky-600 font-semibold shadow-md shadow-cyan-500/20"
          disabled={!ready || busy || !keyText || !studentText}
          onClick={onGrade}
        >
          {busy ? <LoadingSpinner className="size-4" /> : <Sparkles className="size-4" />}
          AI ile puanla
        </Button>

        {lastGrade ? (
          <div className="rounded-xl bg-linear-to-br from-emerald-500/15 to-cyan-500/10 p-4 text-center ring-1 ring-emerald-500/25">
            <p className="text-3xl font-bold tabular-nums text-emerald-700 dark:text-emerald-300">
              {lastGrade.score}
              <span className="text-lg text-muted-foreground">/{lastGrade.max_score}</span>
            </p>
            <p className="mt-1 text-[10px] text-muted-foreground">
              Güven %{Math.round(lastGrade.confidence * 100)}
            </p>
          </div>
        ) : null}
      </div>
    </section>
  );
}
