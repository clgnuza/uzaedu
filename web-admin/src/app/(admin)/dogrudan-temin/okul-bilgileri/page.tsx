'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { apiFetch } from '@/lib/api';
import { dtUrl } from '@/lib/dt-url';
import { Toolbar, ToolbarHeading, ToolbarPageTitle } from '@/components/layout/toolbar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert } from '@/components/ui/alert';
import { ForbiddenView } from '@/components/errors/forbidden-view';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { SchoolSelectWithFilter } from '@/components/school-select-with-filter';
import { DT_LEGAL_NOTICE } from '@/lib/dt-ui';
import { toast } from 'sonner';

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

export default function DtOkulBilgileriPage() {
  const { token, me } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const isSuperadmin = me?.role === 'superadmin' || me?.role === 'moderator';
  const [selectedSchoolId, setSelectedSchoolId] = useState(() => searchParams.get('school_id') ?? '');
  const schoolId = isSuperadmin ? selectedSchoolId : ((me as { school_id?: string })?.school_id ?? me?.school?.id ?? '');
  const enabled = me?.school?.enabled_modules ?? null;
  const ok = isSuperadmin || enabled === null || enabled.length === 0 || enabled.includes('dogrudan_temin');

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
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
      setForm({
        header_line2: row.headerLine2 ?? '',
        header_line3: row.headerLine3 ?? '',
        header_line4: row.headerLine4 ?? '',
        spending_authority_name: row.spendingAuthorityName ?? '',
        spending_authority_title: row.spendingAuthorityTitle ?? '',
        realization_authority_name: row.realizationAuthorityName ?? '',
        realization_authority_title: row.realizationAuthorityTitle ?? '',
        official_correspondence_code: row.officialCorrespondenceCode ?? '',
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Yüklenemedi');
    } finally {
      setLoading(false);
    }
  }, [isSuperadmin, me?.role, ok, schoolId, token]);

  useEffect(() => {
    void load();
  }, [load]);

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
    <div className="space-y-3">
      <Toolbar>
        <ToolbarHeading>
          <ToolbarPageTitle className="text-base">Doğrudan temin — okul formu</ToolbarPageTitle>
        </ToolbarHeading>
        {isSuperadmin ? (
          <div className="w-[320px] max-w-[60vw]">
            <SchoolSelectWithFilter value={schoolId} onChange={setSchool} token={token} />
          </div>
        ) : null}
      </Toolbar>

      <Alert variant="info" message={DT_LEGAL_NOTICE} />

      {error ? <Alert message={error} /> : null}
      {loading ? <LoadingSpinner label="Yükleniyor…" className="py-10 text-xs" /> : null}
      {!loading && (!isSuperadmin || schoolId) ? (
        <Card>
          <CardHeader className="py-3">
            <CardTitle className="text-sm">Antet satırları ve yetkililer</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-xs max-w-2xl">
            {(['header_line2', 'header_line3', 'header_line4'] as const).map((k) => (
              <div key={k} className="space-y-1">
                <div className="text-[11px] text-muted-foreground">{k}</div>
                <Input value={form[k]} onChange={(e) => setForm((s) => ({ ...s, [k]: e.target.value }))} />
              </div>
            ))}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div className="space-y-1">
                <div className="text-[11px] text-muted-foreground">Harcama yetkilisi adı</div>
                <Input
                  value={form.spending_authority_name}
                  onChange={(e) => setForm((s) => ({ ...s, spending_authority_name: e.target.value }))}
                />
              </div>
              <div className="space-y-1">
                <div className="text-[11px] text-muted-foreground">Harcama yetkilisi ünvanı</div>
                <Input
                  value={form.spending_authority_title}
                  onChange={(e) => setForm((s) => ({ ...s, spending_authority_title: e.target.value }))}
                />
              </div>
              <div className="space-y-1">
                <div className="text-[11px] text-muted-foreground">Gerçekleştirme görevlisi adı</div>
                <Input
                  value={form.realization_authority_name}
                  onChange={(e) => setForm((s) => ({ ...s, realization_authority_name: e.target.value }))}
                />
              </div>
              <div className="space-y-1">
                <div className="text-[11px] text-muted-foreground">Gerçekleştirme görevlisi ünvanı</div>
                <Input
                  value={form.realization_authority_title}
                  onChange={(e) => setForm((s) => ({ ...s, realization_authority_title: e.target.value }))}
                />
              </div>
            </div>
            <div className="space-y-1">
              <div className="text-[11px] text-muted-foreground">Resmî yazı / muhatap kodu</div>
              <Input
                value={form.official_correspondence_code}
                onChange={(e) => setForm((s) => ({ ...s, official_correspondence_code: e.target.value }))}
              />
            </div>
            <Button type="button" size="sm" disabled={busy} onClick={() => void save()}>
              Kaydet
            </Button>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
