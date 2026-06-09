'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { apiFetch } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ArrowLeft, CheckCircle2, CircleDashed, Table2 } from 'lucide-react';
import { toast } from 'sonner';
import { PlanKatkiExcelPlanUpload } from '@/components/bilsem/plan-katki-excel-upload';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { cn } from '@/lib/utils';

function defaultAcademicYear(): string {
  const y = new Date().getFullYear();
  const m = new Date().getMonth();
  return m < 8 ? `${y - 1}-${y}` : `${y}-${y + 1}`;
}

const SELECT_CLASS =
  'mt-1 flex h-9 w-full rounded-md border border-input bg-background px-2.5 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/40';

export default function EvrakPlanKatkiNewPage() {
  const router = useRouter();
  const { token, me } = useAuth();
  const [subjectCode, setSubjectCode] = useState('');
  const [grade, setGrade] = useState('9');
  const [section, setSection] = useState('ders');
  const [academicYear, setAcademicYear] = useState(defaultAcademicYear());
  const [tabloAltiNot, setTabloAltiNot] = useState('');
  const [itemsJson, setItemsJson] = useState('[]');
  const [saving, setSaving] = useState(false);
  const [loadingMeta, setLoadingMeta] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [academicYears, setAcademicYears] = useState<string[]>([]);
  const [sections, setSections] = useState<Array<{ value: string; label: string }>>([]);
  const [subjects, setSubjects] = useState<Array<{ code: string; label: string }>>([]);

  const selectedSubject = useMemo(
    () => subjects.find((s) => s.code === subjectCode) ?? null,
    [subjects, subjectCode],
  );

  const weekCount = useMemo(() => {
    try {
      const j = JSON.parse(itemsJson) as unknown;
      return Array.isArray(j) ? j.length : 0;
    } catch {
      return 0;
    }
  }, [itemsJson]);

  const metaReady = !loadingMeta && !!selectedSubject;
  const planReady = weekCount > 0;
  const canSave = metaReady && planReady && !saving;

  useEffect(() => {
    if (!token) return;
    let mounted = true;
    void (async () => {
      setLoadingMeta(true);
      try {
        const opt = await apiFetch<{
          academic_years: string[];
          sections: { value: string; label: string }[];
        }>('/document-templates/options?type=yillik_plan', { token });
        if (!mounted) return;
        const years = Array.isArray(opt.academic_years) ? opt.academic_years : [];
        const sec = Array.isArray(opt.sections) ? opt.sections : [];
        setAcademicYears(years);
        setSections(sec);
        if (years.length > 0 && !years.includes(academicYear)) setAcademicYear(years[0]!);
        if (sec.length > 0 && !sec.some((x) => x.value === section)) setSection(sec[0]!.value);
      } catch {
        if (!mounted) return;
        setAcademicYears([academicYear]);
        setSections([{ value: 'ders', label: 'Ders' }]);
      } finally {
        if (mounted) setLoadingMeta(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [token]);

  useEffect(() => {
    if (!token) return;
    const nGrade = Number.parseInt(grade, 10);
    if (!Number.isFinite(nGrade) || nGrade < 1 || nGrade > 12) return;
    let mounted = true;
    void (async () => {
      try {
        const qs = new URLSearchParams();
        qs.set('grade', String(nGrade));
        qs.set('section', section);
        qs.set('academic_year', academicYear);
        const res = await apiFetch<{ items: Array<{ code: string; label: string }> }>(
          `/document-templates/subjects?${qs.toString()}`,
          { token },
        );
        if (!mounted) return;
        const items = Array.isArray(res.items) ? res.items : [];
        setSubjects(items);
        if (items.length > 0) {
          if (!items.some((x) => x.code === subjectCode)) setSubjectCode(items[0]!.code);
        } else {
          setSubjectCode('');
        }
      } catch {
        if (!mounted) return;
        setSubjects([]);
        setSubjectCode('');
      }
    })();
    return () => {
      mounted = false;
    };
  }, [token, grade, section, academicYear]);

  async function onSubmit() {
    if (!token) return;
    let items: unknown[];
    try {
      items = JSON.parse(itemsJson) as unknown[];
    } catch {
      setError('Plan verisi geçersiz.');
      return;
    }
    if (!subjectCode.trim() || !selectedSubject || !academicYear.trim()) {
      setError('Ders, sınıf, bölüm ve öğretim yılı seçimi zorunlu.');
      return;
    }
    const nGrade = Number.parseInt(grade, 10);
    if (!Number.isFinite(nGrade) || nGrade < 1 || nGrade > 12) {
      setError('Sınıf 1-12 aralığında olmalı.');
      return;
    }
    if (!Array.isArray(items) || items.length === 0) {
      setError('Excel şablonu yükleyin.');
      return;
    }
    setError(null);
    setSaving(true);
    try {
      const created = await apiFetch<{ id: string }>('/yillik-plan-icerik/submissions', {
        token,
        method: 'POST',
        body: JSON.stringify({
          subject_code: subjectCode.trim(),
          subject_label: selectedSubject.label.trim(),
          grade: nGrade,
          section: section.trim() || null,
          academic_year: academicYear.trim(),
          tablo_alti_not: tabloAltiNot.trim() || null,
          items,
        }),
      });
      toast.success('Taslak oluşturuldu');
      router.replace(`/evrak/plan-katki/${created.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Kayıt başarısız');
    } finally {
      setSaving(false);
    }
  }

  if (!me || (me.role !== 'teacher' && me.role !== 'school_admin')) return null;

  return (
    <div className="mx-auto max-w-2xl space-y-2.5 px-2.5 pb-24 pt-1 sm:space-y-3 sm:px-4 sm:pb-8">
      <div className="flex items-center justify-between gap-2 border-b border-border/60 pb-2">
        <div className="min-w-0">
          <p className="text-[10px] font-medium uppercase tracking-wide text-violet-600/90 dark:text-violet-400">Yeni</p>
          <h1 className="text-sm font-semibold sm:text-base">Plan katkısı ekle</h1>
        </div>
        <Button variant="ghost" size="sm" asChild className="h-8 shrink-0 gap-0.5 px-2 text-xs">
          <Link href="/evrak/plan-katki">
            <ArrowLeft className="h-3.5 w-3.5" />
            Liste
          </Link>
        </Button>
      </div>

      <ol className="flex gap-1 text-[9px] sm:text-[10px]">
        {[
          { done: metaReady, label: 'Ders bilgisi' },
          { done: planReady, label: 'Excel plan' },
          { done: false, label: 'Kaydet' },
        ].map((s, i) => (
          <li
            key={s.label}
            className={cn(
              'flex flex-1 items-center justify-center gap-1 rounded-md border px-1 py-1 font-medium sm:px-2',
              s.done
                ? 'border-emerald-500/35 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200'
                : i === 0 || (i === 1 && metaReady)
                  ? 'border-violet-500/30 bg-violet-500/8 text-foreground'
                  : 'border-border/60 bg-muted/30 text-muted-foreground',
            )}
          >
            {s.done ? <CheckCircle2 className="h-3 w-3 shrink-0" /> : <CircleDashed className="h-3 w-3 shrink-0 opacity-50" />}
            <span className="truncate">{s.label}</span>
          </li>
        ))}
      </ol>

      {error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-2.5 py-1.5 text-[11px] text-destructive sm:text-xs">
          {error}
        </div>
      )}

      {loadingMeta ? (
        <div className="flex justify-center py-6">
          <LoadingSpinner label="Seçimler hazırlanıyor…" />
        </div>
      ) : (
        <section className="rounded-xl border border-border/70 bg-card p-2.5 sm:p-3">
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground sm:text-xs">1 · Ders bilgisi</p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-2">
            <div>
              <Label className="text-xs">Sınıf</Label>
              <select className={SELECT_CLASS} value={grade} onChange={(e) => setGrade(e.target.value)}>
                {Array.from({ length: 12 }, (_, i) => i + 1).map((g) => (
                  <option key={g} value={String(g)}>
                    {g}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label className="text-xs">Bölüm</Label>
              <select className={SELECT_CLASS} value={section} onChange={(e) => setSection(e.target.value)}>
                {(sections.length > 0 ? sections : [{ value: 'ders', label: 'Ders' }]).map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label className="text-xs">Öğretim yılı</Label>
              <select className={SELECT_CLASS} value={academicYear} onChange={(e) => setAcademicYear(e.target.value)}>
                {(academicYears.length > 0 ? academicYears : [academicYear]).map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label className="text-xs">Ders</Label>
              <select className={SELECT_CLASS} value={subjectCode} onChange={(e) => setSubjectCode(e.target.value)}>
                {subjects.length === 0 ? (
                  <option value="">Ders bulunamadı</option>
                ) : (
                  subjects.map((s) => (
                    <option key={s.code} value={s.code}>
                      {s.label}
                    </option>
                  ))
                )}
              </select>
            </div>
            <div className="col-span-2">
              <Label className="text-xs">Tablo altı not (isteğe bağlı)</Label>
              <Input className="mt-1 h-9 text-sm" value={tabloAltiNot} onChange={(e) => setTabloAltiNot(e.target.value)} />
            </div>
          </div>
        </section>
      )}

      <section className="rounded-xl border border-fuchsia-200/50 bg-fuchsia-500/4 p-2.5 dark:border-fuchsia-900/30 sm:p-3">
        <p className="mb-2 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-fuchsia-800 dark:text-fuchsia-200 sm:text-xs">
          <Table2 className="h-3.5 w-3.5" />
          2 · Yıllık plan (Excel)
          {planReady && (
            <span className="ml-auto inline-flex items-center gap-0.5 rounded-full bg-emerald-500/15 px-1.5 py-px text-[9px] font-medium text-emerald-800 dark:text-emerald-200">
              <CheckCircle2 className="h-2.5 w-2.5" />
              {weekCount} hafta eklendi
            </span>
          )}
        </p>
        <PlanKatkiExcelPlanUpload
          variant="meb"
          itemsJson={itemsJson}
          onItemsJsonChange={setItemsJson}
          templateQuery={{
            academicYear,
            subjectCode: subjectCode || undefined,
            grade: Number.parseInt(grade, 10) || undefined,
          }}
        />
      </section>

      <div className="fixed bottom-[calc(0.75rem+env(safe-area-inset-bottom,0px))] left-1/2 z-20 w-[calc(100%-1.25rem)] max-w-2xl -translate-x-1/2 sm:static sm:w-auto sm:translate-x-0">
        <Button className="h-11 w-full sm:h-10 sm:w-auto" onClick={() => void onSubmit()} disabled={!canSave}>
          {saving ? 'Kaydediliyor…' : planReady ? 'Taslak oluştur' : 'Önce Excel yükleyin'}
        </Button>
      </div>
    </div>
  );
}
