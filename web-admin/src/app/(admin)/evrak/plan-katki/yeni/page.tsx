'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { apiFetch } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ArrowLeft, Table2 } from 'lucide-react';
import { toast } from 'sonner';
import { PlanKatkiExcelPlanUpload } from '@/components/bilsem/plan-katki-excel-upload';
import { LoadingSpinner } from '@/components/ui/loading-spinner';

function defaultAcademicYear(): string {
  const y = new Date().getFullYear();
  const m = new Date().getMonth();
  return m < 8 ? `${y - 1}-${y}` : `${y}-${y + 1}`;
}

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
    <div className="mx-auto max-w-3xl space-y-3 px-2 pb-8 pt-1 sm:px-4">
      <div className="relative overflow-hidden rounded-2xl border border-cyan-200/60 bg-linear-to-br from-cyan-100/60 via-white to-fuchsia-100/40 p-3 dark:border-cyan-800/30 dark:from-cyan-950/25 dark:via-zinc-950 dark:to-fuchsia-950/20">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-40 dark:opacity-20"
          style={{
            backgroundImage:
              "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='100' viewBox='0 0 160 100'%3E%3Cg fill='none' stroke='%2306b6d4' stroke-opacity='0.25'%3E%3Cpath d='M0 80C24 60 48 60 72 80s48 20 72 0'/%3E%3Cpath d='M0 50C24 30 48 30 72 50s48 20 72 0'/%3E%3C/g%3E%3C/svg%3E\")",
          }}
        />
        <h1 className="relative text-sm font-semibold tracking-tight sm:text-base">Yeni plan katkı taslağı</h1>
      </div>
      <Button variant="ghost" size="sm" asChild className="h-8 gap-0.5 px-2 text-xs">
        <Link href="/evrak/plan-katki">
          <ArrowLeft className="h-3.5 w-3.5" />
          Liste
        </Link>
      </Button>

      {error && <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-2.5 py-2 text-xs">{error}</div>}

      {loadingMeta ? (
        <div className="flex justify-center py-6">
          <LoadingSpinner label="Seçimler hazırlanıyor…" />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-2 rounded-2xl border border-fuchsia-200/50 bg-fuchsia-500/4 p-3 sm:grid-cols-2 dark:border-fuchsia-900/30">
          <div>
            <Label>Sınıf</Label>
            <select className="mt-1 flex h-9 w-full rounded-md border border-input bg-background px-2.5 text-sm" value={grade} onChange={(e) => setGrade(e.target.value)}>
              {Array.from({ length: 12 }, (_, i) => i + 1).map((g) => (
                <option key={g} value={String(g)}>
                  {g}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label>Bölüm</Label>
            <select className="mt-1 flex h-9 w-full rounded-md border border-input bg-background px-2.5 text-sm" value={section} onChange={(e) => setSection(e.target.value)}>
              {(sections.length > 0 ? sections : [{ value: 'ders', label: 'Ders' }]).map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label>Öğretim yılı</Label>
            <select className="mt-1 flex h-9 w-full rounded-md border border-input bg-background px-2.5 text-sm" value={academicYear} onChange={(e) => setAcademicYear(e.target.value)}>
              {(academicYears.length > 0 ? academicYears : [academicYear]).map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label>Ders</Label>
            <select className="mt-1 flex h-9 w-full rounded-md border border-input bg-background px-2.5 text-sm" value={subjectCode} onChange={(e) => setSubjectCode(e.target.value)}>
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
            {selectedSubject ? (
              <p className="mt-1 text-[10px] text-muted-foreground">Kod: {selectedSubject.code}</p>
            ) : null}
          </div>
          <div className="sm:col-span-2">
            <Label>Tablo altı not</Label>
            <Input value={tabloAltiNot} onChange={(e) => setTabloAltiNot(e.target.value)} />
          </div>
        </div>
      )}

      <div className="rounded-2xl border border-violet-200/50 bg-violet-500/4 p-3 sm:p-4 dark:border-violet-900/30">
        <p className="mb-2 flex items-center gap-1.5 text-xs font-medium"><Table2 className="h-3.5 w-3.5" />Yıllık plan (Excel)</p>
        <PlanKatkiExcelPlanUpload itemsJson={itemsJson} onItemsJsonChange={setItemsJson} />
      </div>

      <Button className="h-10" onClick={() => void onSubmit()} disabled={saving || loadingMeta || !selectedSubject}>
        {saving ? 'Kaydediliyor…' : 'Taslak oluştur'}
      </Button>
    </div>
  );
}
