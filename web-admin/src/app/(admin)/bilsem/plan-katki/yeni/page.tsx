'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { apiFetch } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import { BILSEM_ALT_GRUPLAR, BILSEM_ANA_GRUPLAR } from '@/lib/bilsem-groups';
import { PlanKatkiExcelPlanUpload } from '@/components/bilsem/plan-katki-excel-upload';

function defaultAcademicYear(): string {
  const y = new Date().getFullYear();
  const m = new Date().getMonth();
  return m < 8 ? `${y - 1}-${y}` : `${y}-${y + 1}`;
}

export default function BilsemPlanKatkiNewPage() {
  const router = useRouter();
  const { token, me } = useAuth();
  const ayDefault = useMemo(() => defaultAcademicYear(), []);
  const [subjectCode, setSubjectCode] = useState('bilsem_cografya');
  const [subjectLabel, setSubjectLabel] = useState('Coğrafya');
  const [anaGrup, setAnaGrup] = useState<string>(BILSEM_ANA_GRUPLAR[0].value);
  const [altGrup, setAltGrup] = useState<string>('');
  const [academicYear, setAcademicYear] = useState(ayDefault);
  const [planGrade, setPlanGrade] = useState(5);
  const [tabloAltiNot, setTabloAltiNot] = useState('');
  const [itemsJson, setItemsJson] = useState('[]');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit() {
    if (!token) return;
    setError(null);
    let items: unknown[];
    try {
      items = JSON.parse(itemsJson) as unknown[];
    } catch {
      setError('Plan verisi geçersiz.');
      return;
    }
    if (!Array.isArray(items) || items.length === 0) {
      setError('Önce Excel şablonunu yükleyin (en az bir hafta).');
      return;
    }
    setSaving(true);
    try {
      const created = await apiFetch<{ id: string }>('/bilsem/plan-submissions', {
        token,
        method: 'POST',
        body: JSON.stringify({
          subject_code: subjectCode.trim(),
          subject_label: subjectLabel.trim(),
          ana_grup: anaGrup.trim(),
          alt_grup: altGrup.trim() || null,
          academic_year: academicYear.trim(),
          plan_grade: planGrade,
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
    <div className="mx-auto max-w-3xl space-y-6 px-3 py-4 sm:px-4">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" asChild className="gap-1 px-2">
          <Link href="/bilsem/plan-katki">
            <ArrowLeft className="h-4 w-4" />
            Liste
          </Link>
        </Button>
      </div>
      <h1 className="text-lg font-semibold sm:text-xl">Yeni plan taslağı</h1>

      {error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="sc">Ders kodu</Label>
          <Input id="sc" value={subjectCode} onChange={(e) => setSubjectCode(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="sl">Ders adı</Label>
          <Input id="sl" value={subjectLabel} onChange={(e) => setSubjectLabel(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="ana">Ana grup</Label>
          <select
            id="ana"
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            value={anaGrup}
            onChange={(e) => setAnaGrup(e.target.value)}
          >
            {BILSEM_ANA_GRUPLAR.map((g) => (
              <option key={g.value} value={g.value}>
                {g.label}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="alt">Alt grup (opsiyonel)</Label>
          <select
            id="alt"
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            value={altGrup}
            onChange={(e) => setAltGrup(e.target.value)}
          >
            <option value="">—</option>
            {BILSEM_ALT_GRUPLAR.map((g) => (
              <option key={g.value} value={g.value}>
                {g.label}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="ay">Öğretim yılı</Label>
          <Input id="ay" value={academicYear} onChange={(e) => setAcademicYear(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="pg">Plan sınıfı (1–12, takvim eşlemesi)</Label>
          <Input
            id="pg"
            type="number"
            min={1}
            max={12}
            value={planGrade}
            onChange={(e) => setPlanGrade(Number(e.target.value) || 1)}
          />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="not">Tablo altı not (opsiyonel)</Label>
        <Input id="not" value={tabloAltiNot} onChange={(e) => setTabloAltiNot(e.target.value)} />
      </div>
      <PlanKatkiExcelPlanUpload
        itemsJson={itemsJson}
        onItemsJsonChange={setItemsJson}
        autoLoadTemplateUrl="/yillik-plan-sablon.xlsx"
      />
      <div className="flex gap-2">
        <Button onClick={() => void onSubmit()} disabled={saving}>
          {saving ? 'Kaydediliyor…' : 'Taslak oluştur'}
        </Button>
        <Button variant="outline" asChild>
          <Link href="/bilsem/plan-katki">İptal</Link>
        </Button>
      </div>
    </div>
  );
}
