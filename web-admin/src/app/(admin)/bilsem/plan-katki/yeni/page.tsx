'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { apiFetch } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ArrowLeft, Table2 } from 'lucide-react';
import { toast } from 'sonner';
import { BILSEM_ALT_GRUPLAR, BILSEM_ANA_GRUPLAR, bilsemAnaGrupLabel } from '@/lib/bilsem-groups';
import { PlanKatkiExcelPlanUpload } from '@/components/bilsem/plan-katki-excel-upload';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { cn } from '@/lib/utils';

function defaultAcademicYear(): string {
  const y = new Date().getFullYear();
  const m = new Date().getMonth();
  return m < 8 ? `${y - 1}-${y}` : `${y}-${y + 1}`;
}

const SELECT_CLASS =
  'flex h-9 w-full rounded-md border border-input bg-background px-2.5 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/50';

const SECTION = {
  meta: 'border-violet-200/50 bg-violet-500/[0.04] dark:border-violet-800/30',
  excel: 'border-fuchsia-200/50 bg-fuchsia-500/[0.04] dark:border-fuchsia-900/30',
} as const;

type CatalogItem = { code: string; label: string; ana_grup: string };

export default function BilsemPlanKatkiNewPage() {
  const router = useRouter();
  const { token, me } = useAuth();
  const ayDefault = useMemo(() => defaultAcademicYear(), []);
  const [catalog, setCatalog] = useState<CatalogItem[]>([]);
  const [catLoading, setCatLoading] = useState(true);
  const [anaGrup, setAnaGrup] = useState('');
  const [altGrup, setAltGrup] = useState('');
  const [selectedCode, setSelectedCode] = useState('');
  const [academicYear, setAcademicYear] = useState(ayDefault);
  const [tabloAltiNot, setTabloAltiNot] = useState('');
  const [itemsJson, setItemsJson] = useState('[]');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadCatalog = useCallback(async () => {
    if (!token) return;
    setCatLoading(true);
    try {
      const res = await apiFetch<{ items: CatalogItem[] }>('/bilsem/plan-submissions/meta/subjects', { token });
      setCatalog(res?.items ?? []);
    } catch {
      setCatalog([]);
    } finally {
      setCatLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void loadCatalog();
  }, [loadCatalog]);

  /** Katalogda dersi olan yetenek alanları (yıllık plan sihirbazı ile aynı sözlük). */
  const anaGrupOptions = useMemo(() => {
    const withSubjects = new Set(catalog.map((c) => c.ana_grup).filter(Boolean));
    return BILSEM_ANA_GRUPLAR.filter((g) => withSubjects.has(g.value));
  }, [catalog]);

  const subjectsForAna = useMemo(() => {
    if (!anaGrup.trim()) return [];
    return catalog.filter((c) => (c.ana_grup ?? '') === anaGrup.trim());
  }, [catalog, anaGrup]);

  const selected = useMemo(
    () => subjectsForAna.find((c) => c.code === selectedCode) ?? null,
    [subjectsForAna, selectedCode],
  );

  useEffect(() => {
    if (!catalog.length || anaGrupOptions.length === 0) return;
    if (!anaGrup || !anaGrupOptions.some((g) => g.value === anaGrup)) {
      setAnaGrup(anaGrupOptions[0]!.value);
    }
  }, [catalog.length, anaGrup, anaGrupOptions]);

  useEffect(() => {
    if (!subjectsForAna.length) {
      if (selectedCode) setSelectedCode('');
      return;
    }
    if (!selectedCode || !subjectsForAna.some((c) => c.code === selectedCode)) {
      setSelectedCode(subjectsForAna[0]!.code);
    }
  }, [subjectsForAna, selectedCode]);

  function onAnaGrupChange(value: string) {
    setAnaGrup(value);
    setSelectedCode('');
  }

  async function onSubmit() {
    if (!token) return;
    if (!anaGrup.trim()) {
      setError('Yetenek alanı (ana grup) seçin.');
      return;
    }
    if (!selected) {
      setError('Ders seçin (bu alan için katalogda ders yoksa Bilsem altyapısını kontrol edin).');
      return;
    }
    if ((selected.ana_grup ?? '') !== anaGrup.trim()) {
      setError('Seçilen ders ile yetenek alanı uyuşmuyor. Alanı değiştirip tekrar deneyin.');
      return;
    }
    setError(null);
    let items: unknown[];
    try {
      items = JSON.parse(itemsJson) as unknown[];
    } catch {
      setError('Plan verisi geçersiz.');
      return;
    }
    if (!Array.isArray(items) || items.length === 0) {
      setError('Excel şablonu yükleyin (en az bir hafta).');
      return;
    }
    setSaving(true);
    try {
      const created = await apiFetch<{ id: string }>('/bilsem/plan-submissions', {
        token,
        method: 'POST',
        body: JSON.stringify({
          subject_code: selected.code.trim(),
          subject_label: selected.label.trim(),
          ana_grup: selected.ana_grup.trim(),
          alt_grup: altGrup.trim() || null,
          academic_year: academicYear.trim(),
          tablo_alti_not: tabloAltiNot.trim() || null,
          items,
        }),
      });
      toast.success('Taslak oluşturuldu');
      router.replace(`/bilsem/plan-katki/${created.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Kayıt başarısız');
    } finally {
      setSaving(false);
    }
  }

  if (!me || (me.role !== 'teacher' && me.role !== 'school_admin')) return null;

  return (
    <div className="mx-auto max-w-3xl space-y-3 px-2 pb-8 pt-1 sm:space-y-4 sm:px-4 sm:pt-2">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" asChild className="h-8 gap-0.5 px-2 text-xs sm:h-9 sm:text-sm">
          <Link href="/bilsem/plan-katki">
            <ArrowLeft className="h-3.5 w-3.5" />
            Liste
          </Link>
        </Button>
      </div>

      <div>
        <h1 className="text-base font-bold sm:text-lg">Yeni taslak</h1>
        <p className="mt-0.5 text-[11px] text-muted-foreground sm:text-sm">
          Öğretim yılını, yetenek alanını ve gerekirse program aşamasını seçin; ders listesi alana göre gelir. Ardından Exceli yükleyin.
        </p>
      </div>

      {error && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-2.5 py-2 text-xs sm:text-sm">{error}</div>
      )}

      <div className={cn('space-y-3 rounded-2xl border p-3 sm:p-4', SECTION.meta)}>
        <p className="text-xs font-medium text-violet-800 dark:text-violet-200">Plan bilgileri</p>
        {catLoading ? (
          <div className="flex min-h-[8rem] items-center justify-center">
            <LoadingSpinner label="Katalog yükleniyor…" />
          </div>
        ) : catalog.length === 0 || anaGrupOptions.length === 0 ? (
          <p className="text-sm text-destructive">
            BİLSEM ders kataloğu boş veya yetenek alanı atanmamış. Platform yöneticisi Bilsem altyapısında ders tanımlarını kontrol etmeli.
          </p>
        ) : (
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="ay" className="text-xs">
                Öğretim yılı
              </Label>
              <Input id="ay" className="h-9" value={academicYear} onChange={(e) => setAcademicYear(e.target.value)} />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="ana" className="text-xs">
                Yetenek alanı (ana grup)
              </Label>
              <p className="text-[11px] text-muted-foreground sm:text-xs">
                Branşınıza uygun alanı seçin; katalogdaki ders listesi buna göre listelenir (Bilsem yıllık plan ile aynı sözlük).
              </p>
              <select
                id="ana"
                className={SELECT_CLASS}
                value={anaGrup}
                onChange={(e) => onAnaGrupChange(e.target.value)}
              >
                {anaGrupOptions.map((g) => (
                  <option key={g.value} value={g.value}>
                    {g.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="alt" className="text-xs">
                Program aşaması (alt grup)
              </Label>
              <p className="text-[11px] text-muted-foreground sm:text-xs">Ek-1; isteğe bağlı. Boş bırakırsanız kayıtta alan doldurulmaz.</p>
              <select
                id="alt"
                className={SELECT_CLASS}
                value={altGrup}
                onChange={(e) => setAltGrup(e.target.value)}
              >
                <option value="">Tümü / belirtmeyin</option>
                {BILSEM_ALT_GRUPLAR.map((g) => (
                  <option key={g.value} value={g.value}>
                    {g.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="ders" className="text-xs">
                Ders
              </Label>
              {subjectsForAna.length === 0 ? (
                <p className="text-sm text-amber-800 dark:text-amber-200">
                  Bu yetenek alanı için katalogda ders yok. Bilsem altyapısında ders atamasını kontrol edin.
                </p>
              ) : (
                <>
                  <select
                    id="ders"
                    className={SELECT_CLASS}
                    value={selectedCode}
                    onChange={(e) => setSelectedCode(e.target.value)}
                  >
                    {subjectsForAna.map((c) => (
                      <option key={c.code} value={c.code}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                  {selected && (
                    <p className="text-[11px] text-muted-foreground">
                      Alan: {bilsemAnaGrupLabel(selected.ana_grup)} — kod:{' '}
                      <code className="text-[10px]">{selected.code}</code>
                    </p>
                  )}
                </>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="not" className="text-xs">
                Tablo altı not <span className="font-normal text-muted-foreground">(isteğe bağlı)</span>
              </Label>
              <Input id="not" className="h-9" value={tabloAltiNot} onChange={(e) => setTabloAltiNot(e.target.value)} />
            </div>
          </div>
        )}
      </div>

      <div className={cn('rounded-2xl border p-3 sm:p-4', SECTION.excel)}>
        <p className="mb-2 flex items-center gap-1.5 text-xs font-medium text-fuchsia-800 dark:text-fuchsia-200">
          <Table2 className="h-3.5 w-3.5" />
          Yıllık plan (Excel)
        </p>
        <PlanKatkiExcelPlanUpload
          itemsJson={itemsJson}
          onItemsJsonChange={setItemsJson}
          onParsed={({ weekCount: n, fileName }) => {
            if (n > 0 && fileName) {
              toast.success(`${n} hafta okundu: ${fileName}`);
            }
          }}
        />
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
        <Button
          className="h-10 w-full bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-600/90 hover:to-fuchsia-600/90 sm:w-auto"
          onClick={() => void onSubmit()}
          disabled={saving || catLoading || !catalog.length || !anaGrupOptions.length || !selected}
        >
          {saving ? 'Kaydediliyor…' : 'Taslak oluştur'}
        </Button>
        <Button variant="outline" className="h-10 w-full sm:w-auto" asChild>
          <Link href="/bilsem/plan-katki">İptal</Link>
        </Button>
      </div>
    </div>
  );
}
