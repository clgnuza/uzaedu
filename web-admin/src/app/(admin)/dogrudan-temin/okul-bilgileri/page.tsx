'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import type { Me } from '@/providers/auth-provider';
import { apiFetch } from '@/lib/api';
import { dtUrl } from '@/lib/dt-url';
import { ToolbarHeading, ToolbarPageTitle, ToolbarDescription } from '@/components/layout/toolbar';
import { Card, CardContent } from '@/components/ui/card';
import { Alert } from '@/components/ui/alert';
import { ForbiddenView } from '@/components/errors/forbidden-view';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { SchoolSelectWithFilter } from '@/components/school-select-with-filter';
import { DT_LEGAL_NOTICE, DT_INPUT_SM, DT_TEXTAREA_SM } from '@/lib/dt-ui';
import { DtInfoHint } from '@/components/dogrudan-temin/dt-info-hint';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import {
  Building2,
  ChevronLeft,
  FileText,
  Hash,
  Info,
  Sparkles,
  User,
  Users,
} from 'lucide-react';

type DtSchoolSettings = {
  schoolId: string;
  headerLine2: string | null;
  headerLine3: string | null;
  headerLine4: string | null;
  spendingAuthorityName: string | null;
  spendingAuthorityTitle: string | null;
  realizationAuthorityName: string | null;
  realizationAuthorityTitle: string | null;
  officialCorrespondenceCode: string | null;
};

type FormState = {
  header_line2: string;
  header_line3: string;
  header_line4: string;
  spending_authority_name: string;
  spending_authority_title: string;
  realization_authority_name: string;
  realization_authority_title: string;
  official_correspondence_code: string;
};

function mapApiToForm(row: DtSchoolSettings): FormState {
  return {
    header_line2: row.headerLine2 ?? '',
    header_line3: row.headerLine3 ?? '',
    header_line4: row.headerLine4 ?? '',
    spending_authority_name: row.spendingAuthorityName ?? '',
    spending_authority_title: row.spendingAuthorityTitle ?? '',
    realization_authority_name: row.realizationAuthorityName ?? '',
    realization_authority_title: row.realizationAuthorityTitle ?? '',
    official_correspondence_code: row.officialCorrespondenceCode ?? '',
  };
}

/** Yalnızca boş alanları okul profilinden doldurur; kayıtlı metinleri silmez. */
function mergeEmptyFromSchoolProfile(form: FormState, school: NonNullable<Me['school']>): FormState {
  const pick = (cur: string, next: string) => (cur.trim() ? cur : next);
  const line3 = [school.district, school.city]
    .map((x) => String(x ?? '').trim())
    .filter(Boolean)
    .join(' / ');
  const line4 = school.principalName
    ? `Okul müdürü: ${school.principalName}`
    : [school.segment, school.type].map((x) => String(x ?? '').trim()).filter(Boolean).join(' · ');
  return {
    header_line2: pick(form.header_line2, school.name ?? ''),
    header_line3: pick(form.header_line3, line3),
    header_line4: pick(form.header_line4, line4),
    spending_authority_name: pick(form.spending_authority_name, school.principalName ?? ''),
    spending_authority_title: pick(form.spending_authority_title, school.principalName ? 'Okul müdürü' : ''),
    realization_authority_name: pick(form.realization_authority_name, school.principalName ?? ''),
    realization_authority_title: pick(form.realization_authority_title, ''),
    official_correspondence_code: form.official_correspondence_code,
  };
}

const ANTET_FIELDS: Array<{ key: keyof FormState; label: string; hint: string; placeholder: string }> = [
  {
    key: 'header_line2',
    label: 'Antet 2. satır',
    hint: 'Genelde okulun tam resmî ünvanı (PDF üst bilgisinde).',
    placeholder: 'Örn. … Ortaokulu',
  },
  {
    key: 'header_line3',
    label: 'Antet 3. satır',
    hint: 'Adres, ilçe / il veya iletişim satırı.',
    placeholder: 'Örn. Mahalle · İlçe / İl',
  },
  {
    key: 'header_line4',
    label: 'Antet 4. satır',
    hint: 'Ek açıklama, web sitesi veya yetkili unvanı.',
    placeholder: 'İsteğe bağlı ek satır',
  },
];

export default function DtOkulBilgileriPage() {
  const { token, me } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const isSuperadmin = me?.role === 'superadmin' || me?.role === 'moderator';
  const [selectedSchoolId, setSelectedSchoolId] = useState(() => searchParams.get('school_id') ?? '');
  const schoolId = isSuperadmin ? selectedSchoolId : ((me as { school_id?: string })?.school_id ?? me?.school?.id ?? '');
  const enabled = me?.school?.enabled_modules ?? null;
  const ok = isSuperadmin || enabled === null || enabled.length === 0 || enabled.includes('dogrudan_temin');

  const canFillFromProfile = useMemo(
    () => Boolean(me?.school?.id && schoolId && me.school.id === schoolId),
    [me?.school, schoolId],
  );

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState<FormState>({
    header_line2: '',
    header_line3: '',
    header_line4: '',
    spending_authority_name: '',
    spending_authority_title: '',
    realization_authority_name: '',
    realization_authority_title: '',
    official_correspondence_code: '',
  });

  const setSchool = useCallback(
    (sid: string) => {
      setSelectedSchoolId(sid);
      const u = new URLSearchParams(searchParams.toString());
      if (sid) u.set('school_id', sid);
      else u.delete('school_id');
      router.replace(`/dogrudan-temin/okul-bilgileri?${u.toString()}`);
    },
    [router, searchParams],
  );

  const load = useCallback(async () => {
    if (!token || !ok) return;
    if (isSuperadmin && !schoolId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const row = await apiFetch<DtSchoolSettings>(dtUrl('/dogrudan-temin/school-settings', me?.role, schoolId), { token });
      let next = mapApiToForm(row);
      if (me?.school && me.school.id === schoolId) {
        next = mergeEmptyFromSchoolProfile(next, me.school);
      }
      setForm(next);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Yüklenemedi');
    } finally {
      setLoading(false);
    }
  }, [isSuperadmin, me?.role, me?.school, ok, schoolId, token]);

  useEffect(() => {
    void load();
  }, [load]);

  const applyProfileToEmptyFields = useCallback(() => {
    if (!me?.school || me.school.id !== schoolId) {
      toast.info('Profil önerisi yalnızca kendi okulunuz için kullanılabilir.');
      return;
    }
    setForm((f) => mergeEmptyFromSchoolProfile(f, me.school!));
    toast.success('Boş alanlar okul profiline göre dolduruldu; isterseniz düzenleyip kaydedin.');
  }, [me?.school, schoolId]);

  const save = async () => {
    if (!token) return;
    if (isSuperadmin && !schoolId) return;
    setBusy(true);
    try {
      await apiFetch(dtUrl('/dogrudan-temin/school-settings', me?.role, schoolId), {
        token,
        method: 'PATCH',
        body: JSON.stringify({
          header_line2: form.header_line2.trim() || null,
          header_line3: form.header_line3.trim() || null,
          header_line4: form.header_line4.trim() || null,
          spending_authority_name: form.spending_authority_name.trim() || null,
          spending_authority_title: form.spending_authority_title.trim() || null,
          realization_authority_name: form.realization_authority_name.trim() || null,
          realization_authority_title: form.realization_authority_title.trim() || null,
          official_correspondence_code: form.official_correspondence_code.trim() || null,
        }),
      });
      toast.success('Kaydedildi.');
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Hata');
    } finally {
      setBusy(false);
    }
  };

  if (!ok) return <ForbiddenView description="Bu okulda Doğrudan Temin modülü kapalı." />;

  return (
    <div className="mx-auto max-w-4xl space-y-5 px-2 pb-10 pt-1 text-xs sm:px-0">
      <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
        <Link
          href={dtUrl('/dogrudan-temin', me?.role, schoolId)}
          className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
        >
          <ChevronLeft className="size-3.5" />
          Doğrudan temin
        </Link>
        <span aria-hidden>/</span>
        <span className="text-foreground">Okul formu</span>
      </div>

      <header className="rounded-2xl border border-border/60 bg-gradient-to-br from-teal-50/80 via-background to-indigo-50/50 p-4 shadow-sm dark:from-teal-950/25 dark:via-background dark:to-indigo-950/20 sm:p-5">
        <div className="flex flex-wrap items-start gap-3">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-teal-500/15 text-teal-700 dark:text-teal-300">
            <Building2 className="size-5" />
          </div>
          <div className="min-w-0 flex-1 space-y-2">
            <ToolbarHeading>
              <ToolbarPageTitle className="text-lg sm:text-xl">Doğrudan temin — okul formu</ToolbarPageTitle>
              <ToolbarDescription>
                Bu alanlar PDF ve yazışma şablonlarında antet ile imza bloklarında kullanılır. Kayıtlı okul profilinizdeki ad,
                il/ilçe ve müdür bilgisi boş alanlara otomatik önerilir; dilediğiniz gibi el ile değiştirebilirsiniz.
              </ToolbarDescription>
            </ToolbarHeading>
            <div className="flex flex-wrap gap-2">
              {canFillFromProfile ? (
                <Button type="button" variant="secondary" size="sm" className="h-9 gap-1.5" onClick={applyProfileToEmptyFields}>
                  <Sparkles className="size-3.5" />
                  Boş alanları profilden doldur
                </Button>
              ) : (
                <div className="flex items-start gap-2 rounded-xl border border-amber-200/40 bg-amber-500/10 px-3 py-2 dark:border-amber-500/20 dark:bg-amber-950/25">
                  <Info className="mt-0.5 size-3.5 shrink-0 text-amber-700 dark:text-amber-300" aria-hidden />
                  <p className="max-w-xl text-[11px] leading-relaxed text-amber-950/90 dark:text-amber-50/90">
                    Süper yönetici olarak başka bir okul seçtiğinizde, o okulun kurumsal profili burada otomatik gelmez; alanları
                    o okul adına elle girmeniz gerekir.
                  </p>
                </div>
              )}
            </div>
          </div>
          {isSuperadmin ? (
            <div className="w-full min-w-0 sm:w-[min(320px,100%)]">
              <div className="mb-1 flex items-center gap-1 text-[10px] font-medium text-muted-foreground">
                Okul
                <DtInfoHint title="Hangi okulun doğrudan temin ayarlarını düzenlediğinizi seçin." />
              </div>
              <SchoolSelectWithFilter value={schoolId} onChange={setSchool} token={token} />
            </div>
          ) : null}
        </div>
      </header>

      <div className="flex gap-2 rounded-xl border border-sky-200/45 bg-sky-500/8 p-3 dark:border-sky-500/20 dark:bg-sky-950/25">
        <Info className="mt-0.5 size-4 shrink-0 text-sky-600 dark:text-sky-300" aria-hidden />
        <p className="text-[11px] leading-relaxed text-sky-950/90 dark:text-sky-50/90">
          <span className="font-semibold text-foreground">Profil ile doldurma:</span> Okul adı, il/ilçe ve müdür adı{' '}
          <code className="rounded bg-background/80 px-1 py-0.5 text-[10px]">/me</code> okul profilinden gelir; sunucuda zaten
          kayıtlı bir metin varsa üzerine yazılmaz. Kaydetmediğiniz sürece değişiklikler sunucuya gitmez.
          <DtInfoHint title={DT_LEGAL_NOTICE} className="ml-0.5 align-middle" />
        </p>
      </div>

      {error ? <Alert message={error} /> : null}
      {loading ? <LoadingSpinner label="Ayarlar yükleniyor…" className="py-12 text-xs" /> : null}

      {!loading && (!isSuperadmin || schoolId) ? (
        <div className="space-y-4">
          <Card variant="teal" soft className="overflow-hidden shadow-sm">
            <CardContent className="space-y-4 p-4 sm:p-5">
              <div className="flex flex-wrap items-center gap-2 border-b border-border/40 pb-3">
                <FileText className="size-4 text-teal-600 dark:text-teal-300" />
                <h2 className="text-sm font-semibold text-foreground sm:text-base">Antet satırları</h2>
                <DtInfoHint title="Belge üst bilgisinde sırayla görünen metin satırları; kurum şablonunuza göre düzenleyin." />
              </div>
              <div className="space-y-4">
                {ANTET_FIELDS.map(({ key, label, hint, placeholder }) => (
                  <div key={key} className="space-y-1.5">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <label className="text-[12px] font-medium text-foreground">{label}</label>
                      <DtInfoHint title={hint} />
                    </div>
                    <textarea
                      rows={2}
                      value={form[key]}
                      placeholder={placeholder}
                      onChange={(e) => setForm((s) => ({ ...s, [key]: e.target.value }))}
                      className={cn(DT_TEXTAREA_SM, 'min-h-[72px]')}
                    />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card variant="indigo" soft className="overflow-hidden shadow-sm">
            <CardContent className="space-y-4 p-4 sm:p-5">
              <div className="flex flex-wrap items-center gap-2 border-b border-border/40 pb-3">
                <Users className="size-4 text-indigo-600 dark:text-indigo-300" />
                <h2 className="text-sm font-semibold text-foreground sm:text-base">Yetkililer ve resmî kod</h2>
                <DtInfoHint title="Harcama yetkisi ve gerçekleştirme görevlisi imza bloklarında kullanılır; yazışma kodu evrak numarası öneklerinde yer alabilir." />
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <div className="flex items-center gap-1">
                    <label className="text-[12px] font-medium text-foreground">Harcama yetkilisi — adı soyadı</label>
                    <DtInfoHint title="İmzalı belgelerde harcama yetkilisi olarak görünecek kişi." />
                  </div>
                  <Input
                    value={form.spending_authority_name}
                    onChange={(e) => setForm((s) => ({ ...s, spending_authority_name: e.target.value }))}
                    className={DT_INPUT_SM}
                    placeholder="Ad Soyad"
                  />
                </div>
                <div className="space-y-1.5">
                  <div className="flex items-center gap-1">
                    <label className="text-[12px] font-medium text-foreground">Harcama yetkilisi — ünvanı</label>
                    <DtInfoHint title="Örn. Okul müdürü, harcama yetkilisi vb." />
                  </div>
                  <Input
                    value={form.spending_authority_title}
                    onChange={(e) => setForm((s) => ({ ...s, spending_authority_title: e.target.value }))}
                    className={DT_INPUT_SM}
                    placeholder="Ünvan"
                  />
                </div>
                <div className="space-y-1.5">
                  <div className="flex items-center gap-1">
                    <label className="text-[12px] font-medium text-foreground">Gerçekleştirme görevlisi — adı soyadı</label>
                    <DtInfoHint title="İşin yürütülmesinden sorumlu görevli; çoğu okulda müdür yardımcısı veya bölüm başkanı." />
                  </div>
                  <Input
                    value={form.realization_authority_name}
                    onChange={(e) => setForm((s) => ({ ...s, realization_authority_name: e.target.value }))}
                    className={DT_INPUT_SM}
                    placeholder="Ad Soyad"
                  />
                </div>
                <div className="space-y-1.5">
                  <div className="flex items-center gap-1">
                    <label className="text-[12px] font-medium text-foreground">Gerçekleştirme görevlisi — ünvanı</label>
                    <DtInfoHint title="Örn. Gerçekleştirme görevlisi, bölüm başkanı." />
                  </div>
                  <Input
                    value={form.realization_authority_title}
                    onChange={(e) => setForm((s) => ({ ...s, realization_authority_title: e.target.value }))}
                    className={DT_INPUT_SM}
                    placeholder="Ünvan"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center gap-1">
                  <Hash className="size-3.5 text-muted-foreground" aria-hidden />
                  <label className="text-[12px] font-medium text-foreground">Resmî yazı / muhatap kodu</label>
                  <DtInfoHint title="Kurumunuza tahsis edilen yazı numarası öneki veya resmî kod; boş bırakılabilir." />
                </div>
                <Input
                  value={form.official_correspondence_code}
                  onChange={(e) => setForm((s) => ({ ...s, official_correspondence_code: e.target.value }))}
                  className={DT_INPUT_SM}
                  placeholder="Örn. 123456-12345-12"
                />
              </div>
            </CardContent>
          </Card>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border/50 pt-2">
            <p className="flex max-w-md items-start gap-1.5 text-[11px] text-muted-foreground">
              <User className="mt-0.5 size-3.5 shrink-0" aria-hidden />
              Kaydettikten sonra doğrudan temin dosyalarındaki belgeler bu bilgileri kullanır; değişiklik sonrası eski PDF’leri
              yeniden üretmeniz gerekebilir.
            </p>
            <Button type="button" disabled={busy} onClick={() => void save()} className="min-w-[120px]">
              {busy ? 'Kaydediliyor…' : 'Kaydet'}
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
