'use client';

import { TimetableReadonly } from '@/components/timetable/TimetableReadonly';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  BookOpen,
  Calendar,
  Download,
  GraduationCap,
  Layers,
  School,
  Users,
} from 'lucide-react';

export type PublicSharePayload = {
  program: {
    name: string | null;
    academic_year?: string | null;
    studio_name?: string | null;
    updated_at?: string;
    version?: number;
  };
  meta: {
    school_name: string;
    document_title: string;
    academic_year?: string | null;
    published_label: string;
  };
  class_sections: string[];
  class_section: string | null;
  stats: {
    lesson_count: number;
    teacher_count: number;
    subject_count: number;
    section_count: number;
  };
  entries: Array<{
    day_of_week: number;
    lesson_num: number;
    class_section: string;
    subject: string;
    teacher_label?: string | null;
    room_name?: string | null;
  }>;
};

export function PublicShareView({
  data,
  section,
  onSectionChange,
  pdfUrl,
}: {
  data: PublicSharePayload;
  section: string;
  onSectionChange: (s: string) => void;
  pdfUrl: string | null;
}) {
  const meta = data.meta ?? {
    school_name: data.program.studio_name ?? 'Okul',
    document_title: 'Haftalık Ders Programı',
    academic_year: data.program.academic_year,
    published_label: '—',
  };
  const stats = data.stats ?? {
    lesson_count: data.entries.length,
    teacher_count: 0,
    subject_count: 0,
    section_count: data.class_sections.length,
  };
  const activeSection = section || data.class_section || data.class_sections[0] || '';
  const yearLabel = meta.academic_year
    ? `${data.meta.academic_year} Eğitim-Öğretim Yılı`
    : null;

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-indigo-50/40 dark:from-slate-950 dark:via-slate-950 dark:to-indigo-950/30">
      <header className="border-b border-border/60 bg-white/80 backdrop-blur-md dark:bg-slate-950/80">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-2">
            <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <GraduationCap className="size-5" aria-hidden />
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                ÖğretmenPro
              </p>
              <p className="text-sm font-semibold text-foreground">Ders programı paylaşımı</p>
            </div>
          </div>
          {pdfUrl && (
            <Button size="sm" variant="default" asChild className="shrink-0">
              <a href={pdfUrl} download>
                <Download className="mr-1.5 size-4" />
                PDF
              </a>
            </Button>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-6 px-4 py-6 sm:px-6 sm:py-8">
        <section className="overflow-hidden rounded-2xl border border-border/70 bg-white shadow-sm dark:bg-slate-900/90">
          <div className="border-b border-border/60 bg-gradient-to-r from-primary/8 via-transparent to-indigo-500/10 px-5 py-6 sm:px-7">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-primary">
              {meta.document_title}
            </p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              {meta.school_name}
            </h1>
            {yearLabel && (
              <p className="mt-1.5 flex items-center gap-1.5 text-sm text-muted-foreground">
                <Calendar className="size-3.5 shrink-0" aria-hidden />
                {yearLabel}
              </p>
            )}
          </div>

          <div className="grid gap-4 px-5 py-5 sm:grid-cols-2 sm:px-7 lg:grid-cols-4">
            <MetaChip
              icon={School}
              label="Şube"
              value={activeSection || '—'}
              highlight
            />
            <MetaChip
              icon={BookOpen}
              label="Program"
              value={data.program.name?.trim() || 'Haftalık program'}
            />
            <MetaChip icon={Layers} label="Haftalık ders" value={String(stats.lesson_count)} />
            <MetaChip icon={Users} label="Öğretmen" value={String(stats.teacher_count)} />
          </div>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-border/50 px-5 py-3 text-xs text-muted-foreground sm:px-7">
            <span>Güncelleme: {meta.published_label}</span>
            {data.program.version != null && <span>Sürüm v{data.program.version}</span>}
            {data.program.studio_name && <span>{data.program.studio_name}</span>}
          </div>
        </section>

        {data.class_sections.length > 1 && (
          <div className="rounded-xl border border-border/60 bg-white/90 p-3 shadow-sm dark:bg-slate-900/80">
            <p className="mb-2 px-1 text-xs font-medium text-muted-foreground">Sınıf / şube seçin</p>
            <div className="flex flex-wrap gap-2" role="tablist" aria-label="Sınıf şubesi">
              {data.class_sections.map((s) => (
                <button
                  key={s}
                  type="button"
                  role="tab"
                  aria-selected={activeSection === s}
                  className={cn(
                    'rounded-full px-4 py-2 text-sm font-medium transition-all',
                    activeSection === s
                      ? 'bg-primary text-primary-foreground shadow-md shadow-primary/20'
                      : 'bg-muted/80 text-foreground hover:bg-muted',
                  )}
                  onClick={() => onSectionChange(s)}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        <section className="rounded-2xl border border-border/70 bg-white p-3 shadow-sm sm:p-4 dark:bg-slate-900/90">
          <div className="mb-3 flex flex-wrap items-end justify-between gap-2 px-1">
            <div>
              <h2 className="text-base font-semibold text-foreground">
                {activeSection} — haftalık çizelge
              </h2>
              <p className="text-xs text-muted-foreground">
                Pazartesi–Cuma · {stats.lesson_count} ders saati
                {stats.subject_count > 0 ? ` · ${stats.subject_count} farklı ders` : ''}
              </p>
            </div>
          </div>
          <TimetableReadonly
            entries={data.entries}
            classSection={activeSection || undefined}
            displayMode="class"
          />
        </section>

        <footer className="pb-8 text-center text-[11px] text-muted-foreground">
          Bu sayfa okul tarafından paylaşılmış salt okunur programdır. Değişiklikler okul onayından
          sonra geçerlidir.
          <span className="mt-1 block font-medium text-foreground/70">ÖğretmenPro Ders Dağıtım</span>
        </footer>
      </main>
    </div>
  );
}

function MetaChip({
  icon: Icon,
  label,
  value,
  highlight,
}: {
  icon: typeof School;
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={cn(
        'flex items-start gap-3 rounded-xl border p-3',
        highlight
          ? 'border-primary/25 bg-primary/5'
          : 'border-border/50 bg-muted/20',
      )}
    >
      <div
        className={cn(
          'flex size-9 shrink-0 items-center justify-center rounded-lg',
          highlight ? 'bg-primary/15 text-primary' : 'bg-muted text-muted-foreground',
        )}
      >
        <Icon className="size-4" aria-hidden />
      </div>
      <div className="min-w-0">
        <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className="truncate text-sm font-semibold text-foreground">{value}</p>
      </div>
    </div>
  );
}
