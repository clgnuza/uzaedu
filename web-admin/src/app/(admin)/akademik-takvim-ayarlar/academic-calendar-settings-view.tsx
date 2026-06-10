'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  AcademicCalendarDropZone,
  AcademicCalendarPaletteItem,
} from '@/components/academic-calendar/academic-calendar-timeline';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { cn } from '@/lib/utils';
import { formatAcademicWeekHeading, getAcademicWeekKindLabel } from '@/lib/academic-week-label';
import {
  ArrowLeft,
  Calendar,
  CalendarDays,
  Eye,
  EyeOff,
  Filter,
  GripVertical,
  LayoutGrid,
  Plus,
  Save,
  Search,
  Sparkles,
  Trash2,
  UserPlus,
  Users,
} from 'lucide-react';

export type SettingsSectionTab = 'palet' | 'haftalar' | 'gorevlendirme';

export type SettingsWeek = {
  id: string;
  weekNumber: number;
  weekOrder?: number;
  ay?: string;
  title: string | null;
  dateStart?: string | null;
  dateEnd?: string | null;
  isTatil?: boolean;
  belirliGunHafta: { id: string; title: string }[];
  ogretmenIsleri: { id: string; title: string }[];
};

export type SettingsOverrides = {
  useTypeTemplate?: boolean;
  hiddenItemIds: string[];
  customItems: { id: string; weekId: string; type: string; title: string; path?: string; sortOrder: number }[];
};

export type SettingsAssignment = {
  id: string;
  itemId: string;
  itemTitle: string;
  userId: string;
  userName: string;
  gorevTipi: string;
};

type TeacherOption = { id: string; display_name: string | null; email: string; teacher_branch?: string | null };

type AssignMode = 'teacher' | 'branch' | 'all';

function ItemAssignments({
  itemId,
  itemTitle,
  itemAssignments,
  chipClass,
  onOpenAssignModal,
  onRemoveAssignment,
}: {
  itemId: string;
  itemTitle: string;
  itemAssignments: SettingsAssignment[];
  chipClass: string;
  onOpenAssignModal: (itemId: string, itemTitle: string) => void;
  onRemoveAssignment: (id: string) => void;
}) {
  return (
    <div className={cn('flex flex-wrap items-center gap-1.5 border-t pt-2', chipClass)}>
      {itemAssignments.map((a) => (
        <span
          key={a.id}
          className="inline-flex items-center gap-1 rounded-full border border-violet-200/60 bg-violet-500/10 px-2 py-0.5 text-[10px] font-semibold"
        >
          {a.userName} · {a.gorevTipi}
          <button
            type="button"
            onClick={() => onRemoveAssignment(a.id)}
            className="rounded p-0.5 hover:bg-destructive/15"
            aria-label="Kaldır"
          >
            <Trash2 className="size-3" />
          </button>
        </span>
      ))}
      <Button
        variant="outline"
        size="sm"
        className="h-7 gap-1 text-[10px]"
        onClick={() => onOpenAssignModal(itemId, itemTitle)}
      >
        <UserPlus className="size-3" />
        Görevlendir
      </Button>
    </div>
  );
}

function VisibilityToggle({
  visible,
  onToggle,
  label,
}: {
  visible: boolean;
  onToggle: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      title={visible ? 'Takvimde göster' : 'Takvimde gizle'}
      aria-label={`${label}: ${visible ? 'görünür' : 'gizli'}`}
      className={cn(
        'inline-flex shrink-0 items-center gap-1 rounded-lg border px-2 py-1 text-[10px] font-bold transition-colors sm:text-[11px]',
        visible
          ? 'border-emerald-300/60 bg-emerald-500/12 text-emerald-800 dark:border-emerald-800/50 dark:text-emerald-200'
          : 'border-border bg-muted/50 text-muted-foreground',
      )}
    >
      {visible ? <Eye className="size-3" /> : <EyeOff className="size-3" />}
      {visible ? 'Açık' : 'Gizli'}
    </button>
  );
}

export function AcademicCalendarSettingsView({
  loading,
  saving,
  schoolName,
  schoolTypeLabel,
  academicYear,
  academicYears,
  onAcademicYearChange,
  weeks,
  overrides,
  assignments,
  teachers,
  belirliPalette,
  ogretmenPalette,
  paletteQuery,
  onPaletteQueryChange,
  paletteTab,
  onPaletteTabChange,
  sectionTab,
  onSectionTabChange,
  filterMonth,
  onFilterMonthChange,
  filterSearch,
  onFilterSearchChange,
  sortedMonths,
  weeksByMonth,
  filteredMonths,
  filteredWeeksByMonth,
  getWeekDisplayLabel,
  getWeekLabel,
  getAssignmentsForItem,
  onSave,
  onUseTypeTemplateChange,
  onToggleHidden,
  onRemoveCustom,
  customModalOpen,
  onCustomModalOpenChange,
  customForm,
  onCustomFormChange,
  onAddCustom,
  assignModalOpen,
  onAssignModalOpenChange,
  assignForm,
  onAssignFormChange,
  onAssign,
  onOpenAssignModal,
  onRemoveAssignment,
  stats,
  paletteDragSection,
}: {
  loading: boolean;
  saving: boolean;
  schoolName?: string | null;
  schoolTypeLabel: string | null;
  academicYear: string;
  academicYears: string[];
  onAcademicYearChange: (y: string) => void;
  weeks: SettingsWeek[];
  overrides: SettingsOverrides;
  assignments: SettingsAssignment[];
  teachers: TeacherOption[];
  belirliPalette: string[];
  ogretmenPalette: { title: string }[];
  paletteQuery: string;
  onPaletteQueryChange: (q: string) => void;
  paletteTab: 'belirli' | 'ogretmen';
  onPaletteTabChange: (t: 'belirli' | 'ogretmen') => void;
  sectionTab: SettingsSectionTab;
  onSectionTabChange: (t: SettingsSectionTab) => void;
  filterMonth: string;
  onFilterMonthChange: (m: string) => void;
  filterSearch: string;
  onFilterSearchChange: (q: string) => void;
  sortedMonths: string[];
  weeksByMonth: Map<string, SettingsWeek[]>;
  filteredMonths: string[];
  filteredWeeksByMonth: Map<string, SettingsWeek[]>;
  getWeekDisplayLabel: (w: SettingsWeek) => string;
  getWeekLabel: (weekId: string) => string;
  getAssignmentsForItem: (itemId: string) => SettingsAssignment[];
  onSave: () => void;
  onUseTypeTemplateChange: (v: boolean) => void;
  onToggleHidden: (id: string) => void;
  onRemoveCustom: (id: string) => void;
  customModalOpen: boolean;
  onCustomModalOpenChange: (o: boolean) => void;
  customForm: { weekId: string; type: 'belirli_gun_hafta' | 'ogretmen_isleri'; title: string; path: string };
  onCustomFormChange: (f: typeof customForm) => void;
  onAddCustom: () => void;
  assignModalOpen: boolean;
  onAssignModalOpenChange: (o: boolean) => void;
  assignForm: {
    itemId: string;
    itemTitle: string;
    mode: AssignMode;
    userId: string;
    branch: string;
    gorevTipi: 'sorumlu' | 'yardimci';
  };
  onAssignFormChange: (f: typeof assignForm) => void;
  onAssign: () => void;
  onOpenAssignModal: (itemId: string, itemTitle: string) => void;
  onRemoveAssignment: (id: string) => void;
  stats: { weeks: number; visible: number; hidden: number; custom: number; assignments: number };
  paletteDragSection: 'belirli' | 'ogretmen' | null;
}) {
  const branchSet = new Set<string>();
  teachers.forEach((t) => {
    const b = (t.teacher_branch ?? '').trim();
    if (b) branchSet.add(b);
  });
  const branches = [...branchSet].sort((a, b) => a.localeCompare(b, 'tr'));
  const [assignSearch, setAssignSearch] = useState('');

  const assignSearchLower = assignSearch.trim().toLowerCase();

  const assignMonths = filterMonth && sortedMonths.includes(filterMonth) ? [filterMonth] : sortedMonths;

  const weekHasAssignableTemplate = (week: SettingsWeek) =>
    week.belirliGunHafta.some((i) => !i.id.startsWith('custom-')) ||
    week.ogretmenIsleri.some((i) => !i.id.startsWith('custom-'));

  const weekMatchesAssignSearch = (week: SettingsWeek) => {
    if (!assignSearchLower) return true;
    if (formatAcademicWeekHeading(week).toLowerCase().includes(assignSearchLower)) return true;
    if ((week.ay ?? '').toLowerCase().includes(assignSearchLower)) return true;
    for (const i of week.belirliGunHafta) {
      if (!i.id.startsWith('custom-') && i.title.toLowerCase().includes(assignSearchLower)) return true;
    }
    for (const i of week.ogretmenIsleri) {
      if (!i.id.startsWith('custom-') && i.title.toLowerCase().includes(assignSearchLower)) return true;
    }
    return false;
  };

  const assignWeeksByMonth = useMemo(() => {
    const map = new Map<string, SettingsWeek[]>();
    for (const monthKey of assignMonths) {
      const list = (weeksByMonth.get(monthKey) ?? []).filter(
        (w) => weekHasAssignableTemplate(w) && weekMatchesAssignSearch(w),
      );
      if (list.length > 0) map.set(monthKey, list);
    }
    return map;
  }, [assignMonths, weeksByMonth, assignSearchLower]);

  const assignWeekCount = useMemo(() => {
    let n = 0;
    for (const list of assignWeeksByMonth.values()) n += list.length;
    return n;
  }, [assignWeeksByMonth]);

  const palettePanel = weeks.length > 0 && (
    <aside
      className={cn(
        'w-full shrink-0 lg:w-52 xl:w-56',
        'lg:sticky lg:top-[calc(var(--header-height)+0.5rem)] lg:max-h-[calc(100vh-var(--header-height)-1rem)] lg:overflow-y-auto',
        sectionTab !== 'palet' && 'hidden lg:block',
      )}
    >
      <div className="overflow-hidden rounded-xl border border-border/70 bg-card shadow-sm">
        <div className="border-b border-border/60 bg-muted/20 px-2.5 py-2">
          <p className="flex items-center gap-1 text-[11px] font-bold text-foreground">
            <GripVertical className="size-3 shrink-0 text-muted-foreground" aria-hidden />
            Hazır öğe paketi
          </p>
          <p className="mt-0.5 text-[9px] leading-snug text-muted-foreground">
            Turuncu → belirli gün · Mavi → öğretmen işi
          </p>
        </div>
        <div className="space-y-2 p-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2 top-1/2 size-3 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Ara…"
              value={paletteQuery}
              onChange={(e) => onPaletteQueryChange(e.target.value)}
              className="h-8 pl-7 text-xs"
            />
          </div>
          <div className="grid grid-cols-2 gap-0.5 rounded-lg border border-border/60 bg-muted/15 p-0.5">
            <button
              type="button"
              onClick={() => onPaletteTabChange('belirli')}
              className={cn(
                'rounded-md py-1 text-[10px] font-bold transition-colors',
                paletteTab === 'belirli' ? 'bg-amber-500 text-white' : 'text-muted-foreground',
              )}
            >
              Belirli ({belirliPalette.length})
            </button>
            <button
              type="button"
              onClick={() => onPaletteTabChange('ogretmen')}
              className={cn(
                'rounded-md py-1 text-[10px] font-bold transition-colors',
                paletteTab === 'ogretmen' ? 'bg-sky-600 text-white' : 'text-muted-foreground',
              )}
            >
              İş ({ogretmenPalette.length})
            </button>
          </div>
          <div className="flex max-h-[min(50vh,360px)] flex-col gap-1 overflow-y-auto rounded-lg border border-dashed border-border/60 bg-muted/10 p-1">
            {paletteTab === 'belirli' ? (
              belirliPalette.length === 0 ? (
                <p className="py-4 text-center text-[10px] text-muted-foreground">Sonuç yok</p>
              ) : (
                belirliPalette.map((title) => (
                  <AcademicCalendarPaletteItem key={title} id={`palette-belirli-${title}`} title={title} variant="belirli" compact />
                ))
              )
            ) : ogretmenPalette.length === 0 ? (
              <p className="py-4 text-center text-[10px] text-muted-foreground">Sonuç yok</p>
            ) : (
              ogretmenPalette.map(({ title }) => (
                <AcademicCalendarPaletteItem key={title} id={`palette-ogretmen-${title}`} title={title} variant="ogretmen" compact />
              ))
            )}
          </div>
        </div>
      </div>
    </aside>
  );

  return (
    <div className="space-y-4 pb-24 sm:space-y-5 sm:pb-8">
      <div className="relative overflow-hidden rounded-2xl bg-linear-to-r from-slate-900 via-violet-950 to-slate-900 px-4 py-4 shadow-lg sm:px-5 sm:py-5">
        <div className="relative z-10 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 items-start gap-3">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-white/12 backdrop-blur">
              <CalendarDays className="size-5 text-white" aria-hidden />
            </span>
            <div className="min-w-0">
              <h1 className="text-lg font-bold tracking-tight text-white sm:text-xl">Akademik takvim ayarları</h1>
              <p className="mt-0.5 truncate text-xs text-white/75 sm:text-sm">
                {schoolName ?? 'Okul'}
                {schoolTypeLabel ? ` · ${schoolTypeLabel}` : ''}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={academicYear}
              onChange={(e) => onAcademicYearChange(e.target.value)}
              className="h-9 rounded-xl border border-white/25 bg-white/10 px-3 text-xs font-semibold text-white backdrop-blur focus:outline-none focus:ring-2 focus:ring-white/30 sm:text-sm"
              aria-label="Öğretim yılı"
            >
              {academicYears.map((y) => (
                <option key={y} value={y} className="text-foreground">
                  {y}
                </option>
              ))}
            </select>
            <Button variant="outline" size="sm" asChild className="border-white/30 bg-white/10 text-white hover:bg-white/20">
              <Link href="/akademik-takvim">
                <ArrowLeft className="mr-1.5 size-4" />
                Takvim
              </Link>
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={() => onSectionTabChange('gorevlendirme')}
              className="border-sky-300/40 bg-sky-500/90 text-white hover:bg-sky-400"
            >
              <Users className="mr-1.5 size-4" />
              Görevlendirme
            </Button>
            <Button size="sm" onClick={onSave} disabled={saving} className="bg-white text-violet-950 hover:bg-white/90">
              <Save className="mr-1.5 size-4" />
              {saving ? 'Kaydediliyor…' : 'Kaydet'}
            </Button>
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex flex-col gap-2 rounded-xl border border-border/60 bg-card px-3 py-3 shadow-xs sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="text-sm font-semibold">Hazır şablonu kullan</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Süperadminin güncellediği{' '}
              {schoolTypeLabel ? `${schoolTypeLabel} ` : ''}
              hazır öğeleri takvime alır; aşağıdan gizleyebilir veya paletten ekleyebilirsiniz.
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={overrides.useTypeTemplate === true}
            onClick={() => onUseTypeTemplateChange(!(overrides.useTypeTemplate === true))}
            className={cn(
              'relative inline-flex h-9 w-[3.25rem] shrink-0 items-center rounded-full transition-colors',
              overrides.useTypeTemplate === true ? 'bg-violet-600' : 'bg-muted',
            )}
          >
            <span
              className={cn(
                'inline-block size-7 translate-x-1 rounded-full bg-white shadow transition-transform',
                overrides.useTypeTemplate === true && 'translate-x-[1.35rem]',
              )}
            />
          </button>
        </div>
        <p className="text-xs text-muted-foreground px-1">
          {overrides.useTypeTemplate === true
            ? 'Açık: şablon öğelerini haftalardan gizleyebilir, paletten yeni öğe ekleyebilirsiniz.'
            : 'Kapalı: yalnızca ortak MEB takvimi. Kurum türüne özel hazır öğeler için açın.'}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-5">
        {[
          { label: 'Hafta', value: stats.weeks, cls: 'text-violet-700 dark:text-violet-300', tab: null as SettingsSectionTab | null },
          { label: 'Görünür', value: stats.visible, cls: 'text-emerald-700 dark:text-emerald-300', tab: null },
          { label: 'Gizli', value: stats.hidden, cls: 'text-amber-700 dark:text-amber-300', tab: null },
          { label: 'Özel öğe', value: stats.custom, cls: 'text-teal-700 dark:text-teal-300', tab: null },
          { label: 'Görev', value: stats.assignments, cls: 'text-sky-700 dark:text-sky-300', tab: 'gorevlendirme' as const },
        ].map((k) => {
          const inner = (
            <>
              <p className={cn('text-lg font-black tabular-nums leading-none', k.cls)}>{k.value}</p>
              <p className="mt-1 text-[9px] font-bold uppercase tracking-wide text-muted-foreground">{k.label}</p>
            </>
          );
          if (k.tab) {
            return (
              <button
                key={k.label}
                type="button"
                onClick={() => onSectionTabChange(k.tab!)}
                className={cn(
                  'rounded-xl border px-3 py-2 text-center shadow-xs transition-colors',
                  sectionTab === k.tab
                    ? 'border-sky-400/70 bg-sky-500/10 ring-2 ring-sky-400/25'
                    : 'border-border/60 bg-card hover:border-sky-300/50',
                )}
              >
                {inner}
              </button>
            );
          }
          return (
            <div key={k.label} className="rounded-xl border border-border/60 bg-card px-3 py-2 text-center shadow-xs">
              {inner}
            </div>
          );
        })}
      </div>

      <div className="hidden gap-2 sm:flex">
        <button
          type="button"
          onClick={() => onSectionTabChange('haftalar')}
          className={cn(
            'flex min-h-10 flex-1 items-center justify-center gap-1.5 rounded-xl text-xs font-bold sm:flex-none sm:px-5',
            sectionTab === 'haftalar' ? 'bg-violet-600 text-white' : 'bg-muted text-muted-foreground',
          )}
        >
          <Calendar className="size-3.5" />
          Haftalar ve öğeler
        </button>
        <button
          type="button"
          onClick={() => onSectionTabChange('gorevlendirme')}
          className={cn(
            'flex min-h-10 flex-1 items-center justify-center gap-1.5 rounded-xl text-xs font-bold sm:flex-none sm:px-5',
            sectionTab === 'gorevlendirme' ? 'bg-sky-600 text-white' : 'bg-muted text-muted-foreground',
          )}
        >
          <Users className="size-3.5" />
          Görevlendirme
          {stats.assignments > 0 && (
            <span className="rounded-full bg-white/25 px-1.5 py-px text-[10px] tabular-nums">{stats.assignments}</span>
          )}
        </button>
      </div>

      <div className="flex gap-2 sm:hidden">
        <button
          type="button"
          onClick={() => onSectionTabChange('palet')}
          className={cn(
            'flex min-h-10 flex-1 items-center justify-center gap-1.5 rounded-xl text-xs font-bold',
            sectionTab === 'palet' ? 'bg-amber-500 text-white' : 'bg-muted text-muted-foreground',
          )}
        >
          <LayoutGrid className="size-3.5" />
          Palet
        </button>
        <button
          type="button"
          onClick={() => onSectionTabChange('haftalar')}
          className={cn(
            'flex min-h-10 flex-1 items-center justify-center gap-1.5 rounded-xl text-xs font-bold',
            sectionTab === 'haftalar' ? 'bg-violet-600 text-white' : 'bg-muted text-muted-foreground',
          )}
        >
          <Calendar className="size-3.5" />
          Haftalar
        </button>
        <button
          type="button"
          onClick={() => onSectionTabChange('gorevlendirme')}
          className={cn(
            'flex min-h-10 flex-1 items-center justify-center gap-1.5 rounded-xl text-xs font-bold',
            sectionTab === 'gorevlendirme' ? 'bg-sky-600 text-white' : 'bg-muted text-muted-foreground',
          )}
        >
          <Users className="size-3.5" />
          Görev
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <LoadingSpinner />
        </div>
      ) : (
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:gap-4">
          {palettePanel}
          <div className={cn('min-w-0 flex-1 space-y-3', sectionTab === 'palet' && 'hidden lg:block')}>
            <div
              className={cn(
                'overflow-hidden rounded-2xl border border-sky-300/50 bg-linear-to-br from-sky-50/80 to-card shadow-sm dark:border-sky-900/40 dark:from-sky-950/25',
                sectionTab !== 'gorevlendirme' && 'hidden',
              )}
            >
              <div className="border-b border-sky-200/50 bg-sky-500/8 px-3 py-3 sm:px-4 dark:border-sky-900/40">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h2 className="flex items-center gap-2 text-sm font-bold text-sky-950 dark:text-sky-100">
                      <Users className="size-4 text-sky-600" />
                      Görevlendirme merkezi
                    </h2>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">
                      Akademik takvim sırasıyla · {assignWeekCount} hafta · öğretmen, branş veya tümü
                    </p>
                  </div>
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                    <div className="flex items-center gap-2 rounded-xl border border-sky-200/60 bg-background px-2 dark:border-sky-900/40">
                      <Filter className="size-3.5 shrink-0 text-sky-600" />
                      <select
                        value={filterMonth}
                        onChange={(e) => onFilterMonthChange(e.target.value)}
                        className="h-9 min-w-0 flex-1 border-0 bg-transparent text-sm focus:ring-0"
                        aria-label="Ay filtresi"
                      >
                        <option value="">Tüm aylar</option>
                        {sortedMonths.map((m) => (
                          <option key={m} value={m}>
                            {m}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="relative sm:w-48">
                      <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        value={assignSearch}
                        onChange={(e) => setAssignSearch(e.target.value)}
                        placeholder="Hafta veya öğe ara…"
                        className="h-9 pl-8"
                      />
                    </div>
                  </div>
                </div>
              </div>
              <div className="max-h-[min(70vh,42rem)] space-y-4 overflow-y-auto p-3 sm:p-4">
                {assignWeeksByMonth.size === 0 ? (
                  <p className="py-10 text-center text-sm text-muted-foreground">Görevlendirilebilir öğe yok</p>
                ) : (
                  [...assignWeeksByMonth.entries()].map(([monthKey, monthWeeks]) => (
                    <section key={monthKey} className="space-y-3">
                      <div className="sticky top-0 z-10 flex items-center gap-2 rounded-xl bg-sky-500/12 px-3 py-2 ring-1 ring-sky-200/50 backdrop-blur-sm dark:ring-sky-900/40">
                        <Calendar className="size-4 text-sky-600" />
                        <h3 className="text-sm font-bold uppercase tracking-wide text-sky-950 dark:text-sky-100">{monthKey}</h3>
                        <span className="ml-auto rounded-full bg-background/80 px-2 py-0.5 text-[10px] font-bold text-muted-foreground">
                          {monthWeeks.length} hafta
                        </span>
                      </div>
                      <div className="space-y-3 border-s-2 border-sky-200/40 ps-3 dark:border-sky-900/35 sm:ps-4">
                        {monthWeeks.map((week) => {
                          const belirliItems = week.belirliGunHafta.filter((i) => !i.id.startsWith('custom-'));
                          const ogretmenItems = week.ogretmenIsleri.filter((i) => !i.id.startsWith('custom-'));
                          const weekAssignCount =
                            belirliItems.reduce((n, i) => n + getAssignmentsForItem(i.id).length, 0) +
                            ogretmenItems.reduce((n, i) => n + getAssignmentsForItem(i.id).length, 0);
                          return (
                            <article
                              key={week.id}
                              className={cn(
                                'overflow-hidden rounded-xl border shadow-xs',
                                week.isTatil
                                  ? 'border-amber-200/60 bg-amber-50/25 dark:border-amber-900/40 dark:bg-amber-950/15'
                                  : 'border-border/70 bg-card',
                              )}
                            >
                              <header className="flex flex-wrap items-start justify-between gap-2 border-b border-border/50 px-3 py-2.5 sm:px-4">
                                <div className="min-w-0">
                                  <p className="text-xs font-bold leading-snug sm:text-sm">{getWeekDisplayLabel(week)}</p>
                                  {(week.isTatil || week.weekOrder === 0) && (
                                    <span className="mt-1 inline-block rounded-full bg-amber-200 px-2 py-0.5 text-[10px] font-bold text-amber-900 dark:bg-amber-900 dark:text-amber-100">
                                      {getAcademicWeekKindLabel(week)}
                                    </span>
                                  )}
                                </div>
                                <span
                                  className={cn(
                                    'shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold',
                                    weekAssignCount > 0
                                      ? 'bg-violet-100 text-violet-900 dark:bg-violet-950/50 dark:text-violet-100'
                                      : 'bg-muted text-muted-foreground',
                                  )}
                                >
                                  {weekAssignCount > 0 ? `${weekAssignCount} görev` : 'Atanmadı'}
                                </span>
                              </header>
                              <div className="space-y-2.5 p-3 sm:p-4">
                                {belirliItems.length > 0 && (
                                  <p className="text-[10px] font-bold uppercase tracking-wide text-amber-700 dark:text-amber-400">
                                    Belirli gün / hafta
                                  </p>
                                )}
                                {belirliItems.map((item) => {
                                  const itemAssignments = getAssignmentsForItem(item.id);
                                  return (
                                    <div
                                      key={item.id}
                                      className="rounded-xl border border-amber-200/50 bg-amber-500/5 p-2.5 dark:border-amber-900/35"
                                    >
                                      <p className="text-xs font-semibold text-amber-950 dark:text-amber-100 sm:text-sm">{item.title}</p>
                                      <ItemAssignments
                                        itemId={item.id}
                                        itemTitle={item.title}
                                        itemAssignments={itemAssignments}
                                        chipClass="border-amber-200/40 dark:border-amber-900/30"
                                        onOpenAssignModal={onOpenAssignModal}
                                        onRemoveAssignment={onRemoveAssignment}
                                      />
                                    </div>
                                  );
                                })}
                                {ogretmenItems.length > 0 && (
                                  <p className="text-[10px] font-bold uppercase tracking-wide text-sky-700 dark:text-sky-400">
                                    Öğretmen işleri
                                  </p>
                                )}
                                {ogretmenItems.map((item) => {
                                  const itemAssignments = getAssignmentsForItem(item.id);
                                  return (
                                    <div
                                      key={item.id}
                                      className="rounded-xl border border-sky-200/50 bg-sky-500/5 p-2.5 dark:border-sky-900/35"
                                    >
                                      <p className="text-xs font-semibold text-sky-950 dark:text-sky-100 sm:text-sm">{item.title}</p>
                                      <ItemAssignments
                                        itemId={item.id}
                                        itemTitle={item.title}
                                        itemAssignments={itemAssignments}
                                        chipClass="border-sky-200/40 dark:border-sky-900/30"
                                        onOpenAssignModal={onOpenAssignModal}
                                        onRemoveAssignment={onRemoveAssignment}
                                      />
                                    </div>
                                  );
                                })}
                              </div>
                            </article>
                          );
                        })}
                      </div>
                    </section>
                  ))
                )}
              </div>
            </div>

            <div
              className={cn(
                'overflow-hidden rounded-2xl border border-border/70 bg-card shadow-sm',
                sectionTab === 'gorevlendirme' && 'hidden',
                sectionTab === 'palet' && 'hidden lg:block',
              )}
            >
              <div className="flex flex-col gap-3 border-b border-border/60 bg-muted/15 px-3 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-4">
                <div>
                  <h2 className="text-sm font-bold text-foreground">Haftalık öğeler</h2>
                  <p className="text-[11px] text-muted-foreground">Görünürlük ve görevlendirme</p>
                </div>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <div className="flex items-center gap-2 rounded-xl border border-border/60 bg-background px-2">
                    <Filter className="size-3.5 shrink-0 text-violet-600" />
                    <select
                      value={filterMonth}
                      onChange={(e) => onFilterMonthChange(e.target.value)}
                      className="h-9 min-w-0 flex-1 border-0 bg-transparent text-sm focus:ring-0"
                    >
                      <option value="">Tüm aylar</option>
                      {sortedMonths.map((m) => (
                        <option key={m} value={m}>
                          {m}
                        </option>
                      ))}
                    </select>
                  </div>
                  <Input
                    placeholder="Hafta veya öğe ara…"
                    value={filterSearch}
                    onChange={(e) => onFilterSearchChange(e.target.value)}
                    className="h-9 sm:w-44"
                  />
                  <Dialog open={customModalOpen} onOpenChange={onCustomModalOpenChange}>
                    <DialogTrigger asChild>
                      <Button variant="outline" size="sm" className="h-9 shrink-0">
                        <Plus className="mr-1.5 size-3.5" />
                        Özel öğe
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="rounded-2xl sm:max-w-md">
                      <DialogHeader>
                        <DialogTitle>Özel öğe ekle</DialogTitle>
                      </DialogHeader>
                      <div className="grid gap-4 py-2">
                        <div>
                          <Label htmlFor="week">Hafta</Label>
                          <select
                            id="week"
                            value={customForm.weekId}
                            onChange={(e) => onCustomFormChange({ ...customForm, weekId: e.target.value })}
                            className="mt-1 flex h-10 w-full rounded-xl border border-input bg-background px-3 text-sm"
                          >
                            <option value="">Hafta seçin</option>
                            {sortedMonths.map((monthKey) => (
                              <optgroup key={monthKey} label={monthKey}>
                                {(weeksByMonth.get(monthKey) ?? []).map((w) => (
                                  <option key={w.id} value={w.id}>
                                    {getWeekDisplayLabel(w)}
                                  </option>
                                ))}
                              </optgroup>
                            ))}
                          </select>
                        </div>
                        <div className="flex gap-2">
                          {(['belirli_gun_hafta', 'ogretmen_isleri'] as const).map((t) => (
                            <button
                              key={t}
                              type="button"
                              onClick={() => onCustomFormChange({ ...customForm, type: t })}
                              className={cn(
                                'flex-1 rounded-xl border py-2 text-xs font-bold',
                                customForm.type === t
                                  ? t === 'belirli_gun_hafta'
                                    ? 'border-amber-400 bg-amber-500/15 text-amber-900'
                                    : 'border-sky-400 bg-sky-500/15 text-sky-900'
                                  : 'border-border text-muted-foreground',
                              )}
                            >
                              {t === 'belirli_gun_hafta' ? 'Belirli gün' : 'Öğretmen işi'}
                            </button>
                          ))}
                        </div>
                        <div>
                          <Label htmlFor="title">Başlık</Label>
                          <Input
                            id="title"
                            value={customForm.title}
                            onChange={(e) => onCustomFormChange({ ...customForm, title: e.target.value })}
                            className="mt-1 rounded-xl"
                            placeholder="Okula özel etkinlik"
                          />
                        </div>
                      </div>
                      <DialogFooter>
                        <Button variant="outline" onClick={() => onCustomModalOpenChange(false)}>
                          İptal
                        </Button>
                        <Button onClick={onAddCustom}>Ekle</Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </div>
              </div>

              <div className="space-y-6 p-3 sm:p-4">
                {filteredMonths.length === 0 ? (
                  <p className="py-10 text-center text-sm text-muted-foreground">Hafta bulunamadı.</p>
                ) : (
                  filteredMonths.map((monthKey) => {
                    const monthWeeks = filteredWeeksByMonth.get(monthKey) ?? [];
                    return (
                      <section key={monthKey} className="space-y-3">
                        <div className="flex items-center gap-2 rounded-xl bg-violet-500/10 px-3 py-2 ring-1 ring-violet-200/50 dark:ring-violet-800/40">
                          <Sparkles className="size-4 text-violet-600" />
                          <h3 className="text-sm font-bold uppercase tracking-wide text-violet-950 dark:text-violet-100">{monthKey}</h3>
                          <span className="ml-auto rounded-full bg-background/80 px-2 py-0.5 text-[10px] font-bold text-muted-foreground">
                            {monthWeeks.length} hafta
                          </span>
                        </div>
                        <div className="grid gap-3 xl:grid-cols-2">
                          {monthWeeks.map((week) => {
                            const weekCustomBelirli = (overrides.customItems ?? []).filter(
                              (c) => c.weekId === week.id && c.type === 'belirli_gun_hafta',
                            );
                            const weekCustomOgretmen = (overrides.customItems ?? []).filter(
                              (c) => c.weekId === week.id && c.type === 'ogretmen_isleri',
                            );
                            return (
                              <article
                                key={week.id}
                                className={cn(
                                  'overflow-hidden rounded-2xl border shadow-xs',
                                  week.isTatil
                                    ? 'border-amber-200/60 bg-amber-50/30 dark:border-amber-900/40 dark:bg-amber-950/15'
                                    : 'border-border/70 bg-card',
                                )}
                              >
                                <header className="flex items-start justify-between gap-2 border-b border-border/50 px-3 py-2.5 sm:px-4">
                                  <p className="text-xs font-bold leading-snug sm:text-sm">{getWeekDisplayLabel(week)}</p>
                                  {(week.isTatil || week.weekOrder === 0 || week.weekNumber === 0) && (
                                    <span className="shrink-0 rounded-full bg-amber-200 px-2 py-0.5 text-[10px] font-bold text-amber-900 dark:bg-amber-900 dark:text-amber-100">
                                      {getAcademicWeekKindLabel(week)}
                                    </span>
                                  )}
                                </header>
                                <div className="space-y-3 p-3 sm:p-4">
                                  {(week.belirliGunHafta.length > 0 || weekCustomBelirli.length > 0) && (
                                    <p className="text-[10px] font-bold uppercase tracking-wide text-amber-700 dark:text-amber-400">
                                      Belirli gün / hafta
                                    </p>
                                  )}
                                  {week.belirliGunHafta.map((item) => {
                                    const itemAssignments = getAssignmentsForItem(item.id);
                                    const visible = !overrides.hiddenItemIds.includes(item.id);
                                    const isTemplate = !item.id.startsWith('custom-');
                                    return (
                                      <div
                                        key={item.id}
                                        className="space-y-2 rounded-xl border border-amber-200/50 bg-amber-500/5 p-2.5 dark:border-amber-900/35"
                                      >
                                        <div className="flex items-start justify-between gap-2">
                                          <span className="min-w-0 text-xs font-semibold text-amber-950 dark:text-amber-100 sm:text-sm">
                                            {item.title}
                                          </span>
                                          <VisibilityToggle visible={visible} onToggle={() => onToggleHidden(item.id)} label={item.title} />
                                        </div>
                                        {isTemplate && (
                                          <ItemAssignments
                                            itemId={item.id}
                                            itemTitle={item.title}
                                            itemAssignments={itemAssignments}
                                            chipClass="border-amber-200/40 dark:border-amber-900/30"
                                            onOpenAssignModal={onOpenAssignModal}
                                            onRemoveAssignment={onRemoveAssignment}
                                          />
                                        )}
                                      </div>
                                    );
                                  })}
                                  <AcademicCalendarDropZone weekId={week.id} section="belirli" isEmpty={weekCustomBelirli.length === 0} paletteDragSection={paletteDragSection}>
                                    {weekCustomBelirli.length > 0 ? (
                                      <div className="flex flex-wrap gap-1.5">
                                        {weekCustomBelirli.map((c) => (
                                          <span
                                            key={c.id}
                                            className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200"
                                          >
                                            {c.title}
                                            <button type="button" onClick={() => onRemoveCustom(c.id)} aria-label="Kaldır">
                                              <Trash2 className="size-3" />
                                            </button>
                                          </span>
                                        ))}
                                      </div>
                                    ) : null}
                                  </AcademicCalendarDropZone>

                                  {(week.ogretmenIsleri.length > 0 || weekCustomOgretmen.length > 0) && (
                                    <p className="text-[10px] font-bold uppercase tracking-wide text-sky-700 dark:text-sky-400">
                                      Öğretmen işleri
                                    </p>
                                  )}
                                  {week.ogretmenIsleri.map((item) => {
                                    const itemAssignments = getAssignmentsForItem(item.id);
                                    const visible = !overrides.hiddenItemIds.includes(item.id);
                                    const isTemplate = !item.id.startsWith('custom-');
                                    return (
                                      <div
                                        key={item.id}
                                        className="space-y-2 rounded-xl border border-sky-200/50 bg-sky-500/5 p-2.5 dark:border-sky-900/35"
                                      >
                                        <div className="flex items-start justify-between gap-2">
                                          <span className="min-w-0 text-xs font-semibold text-sky-950 dark:text-sky-100 sm:text-sm">{item.title}</span>
                                          <VisibilityToggle visible={visible} onToggle={() => onToggleHidden(item.id)} label={item.title} />
                                        </div>
                                        {isTemplate && (
                                          <ItemAssignments
                                            itemId={item.id}
                                            itemTitle={item.title}
                                            itemAssignments={itemAssignments}
                                            chipClass="border-sky-200/40 dark:border-sky-900/30"
                                            onOpenAssignModal={onOpenAssignModal}
                                            onRemoveAssignment={onRemoveAssignment}
                                          />
                                        )}
                                      </div>
                                    );
                                  })}
                                  <AcademicCalendarDropZone weekId={week.id} section="ogretmen" isEmpty={weekCustomOgretmen.length === 0} paletteDragSection={paletteDragSection}>
                                    {weekCustomOgretmen.length > 0 ? (
                                      <div className="flex flex-wrap gap-1.5">
                                        {weekCustomOgretmen.map((c) => (
                                          <span
                                            key={c.id}
                                            className="inline-flex items-center gap-1 rounded-full border border-sky-200 bg-sky-50 px-2.5 py-1 text-xs font-medium text-sky-900 dark:border-sky-800 dark:bg-sky-950/40 dark:text-sky-200"
                                          >
                                            {c.title}
                                            <button type="button" onClick={() => onRemoveCustom(c.id)} aria-label="Kaldır">
                                              <Trash2 className="size-3" />
                                            </button>
                                          </span>
                                        ))}
                                      </div>
                                    ) : null}
                                  </AcademicCalendarDropZone>
                                </div>
                              </article>
                            );
                          })}
                        </div>
                      </section>
                    );
                  })
                )}
              </div>
            </div>

            {(overrides.customItems?.length ?? 0) > 0 && (
              <div className="mt-4 overflow-hidden rounded-2xl border border-teal-200/50 bg-teal-500/5 p-4 dark:border-teal-900/35">
                <h3 className="mb-2 text-sm font-bold text-teal-900 dark:text-teal-100">
                  Kaydedilmemiş özel öğeler ({overrides.customItems!.length})
                </h3>
                <ul className="space-y-2">
                  {overrides.customItems!.map((c) => (
                    <li key={c.id} className="flex items-center justify-between gap-2 rounded-xl border border-teal-200/40 bg-background/80 px-3 py-2 text-sm">
                      <span>
                        <strong>{c.title}</strong>
                        <span className="ml-2 text-xs text-muted-foreground">{getWeekLabel(c.weekId)}</span>
                      </span>
                      <Button variant="ghost" size="icon" className="size-8 text-destructive" onClick={() => onRemoveCustom(c.id)}>
                        <Trash2 className="size-4" />
                      </Button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}

      <Dialog open={assignModalOpen} onOpenChange={onAssignModalOpenChange}>
        <DialogContent className="rounded-2xl sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Görevlendir</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">{assignForm.itemTitle}</p>
          <div className="grid gap-4 py-2">
            <div className="flex gap-1 rounded-xl bg-muted/50 p-1">
              {(
                [
                  { id: 'teacher' as const, label: 'Öğretmen' },
                  { id: 'branch' as const, label: 'Branş / zümre' },
                  { id: 'all' as const, label: 'Tümü' },
                ] as const
              ).map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => onAssignFormChange({ ...assignForm, mode: m.id })}
                  className={cn(
                    'flex-1 rounded-lg py-1.5 text-[11px] font-bold',
                    assignForm.mode === m.id ? 'bg-background text-violet-900 shadow-xs' : 'text-muted-foreground',
                  )}
                >
                  {m.label}
                </button>
              ))}
            </div>
            {assignForm.mode === 'teacher' && (
              <div>
                <Label htmlFor="teacher">Öğretmen</Label>
                <select
                  id="teacher"
                  value={assignForm.userId}
                  onChange={(e) => onAssignFormChange({ ...assignForm, userId: e.target.value })}
                  className="mt-1 flex h-10 w-full rounded-xl border border-input bg-background px-3 text-sm"
                >
                  <option value="">Seçin</option>
                  {teachers.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.display_name || t.email}
                      {t.teacher_branch ? ` · ${t.teacher_branch}` : ''}
                    </option>
                  ))}
                </select>
              </div>
            )}
            {assignForm.mode === 'branch' && (
              <div>
                <Label htmlFor="branch">Branş</Label>
                <select
                  id="branch"
                  value={assignForm.branch}
                  onChange={(e) => onAssignFormChange({ ...assignForm, branch: e.target.value })}
                  className="mt-1 flex h-10 w-full rounded-xl border border-input bg-background px-3 text-sm"
                >
                  <option value="">Seçin</option>
                  {branches.map((b) => (
                    <option key={b} value={b}>
                      {b} ({teachers.filter((t) => (t.teacher_branch ?? '').trim() === b).length} öğretmen)
                    </option>
                  ))}
                </select>
              </div>
            )}
            {assignForm.mode === 'all' && (
              <p className="rounded-xl border border-border/60 bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
                Okuldaki tüm öğretmenler ({teachers.length}) bu göreve atanır.
              </p>
            )}
            <div className="flex gap-2">
              {(['sorumlu', 'yardimci'] as const).map((g) => (
                <button
                  key={g}
                  type="button"
                  onClick={() => onAssignFormChange({ ...assignForm, gorevTipi: g })}
                  className={cn(
                    'flex-1 rounded-xl border py-2 text-xs font-bold capitalize',
                    assignForm.gorevTipi === g ? 'border-violet-400 bg-violet-500/15 text-violet-900' : 'border-border text-muted-foreground',
                  )}
                >
                  {g}
                </button>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => onAssignModalOpenChange(false)}>
              İptal
            </Button>
            <Button onClick={onAssign}>Görevlendir</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border/80 bg-background/95 p-3 backdrop-blur-md sm:hidden">
        <Button className="h-11 w-full rounded-xl" onClick={onSave} disabled={saving}>
          <Save className="mr-2 size-4" />
          {saving ? 'Kaydediliyor…' : 'Değişiklikleri kaydet'}
        </Button>
      </div>
    </div>
  );
}
