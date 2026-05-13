'use client';

import { useCallback, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Toolbar, ToolbarHeading, ToolbarPageTitle } from '@/components/layout/toolbar';
import { ToolbarIconHints } from '@/components/layout/toolbar-icon-hints';
import { Card, CardContent } from '@/components/ui/card';
import { ForbiddenView } from '@/components/errors/forbidden-view';
import { useAuth } from '@/hooks/use-auth';
import { apiFetch } from '@/lib/api';
import { dtUrl } from '@/lib/dt-url';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FileDown, FileSpreadsheet } from 'lucide-react';
import { SchoolSelectWithFilter } from '@/components/school-select-with-filter';

export default function DtReportsPage() {
  const { me, token } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const isSuperadmin = me?.role === 'superadmin' || me?.role === 'moderator';
  const [selectedSchoolId, setSelectedSchoolId] = useState<string>(() => searchParams.get('school_id') ?? '');
  const schoolId = isSuperadmin ? selectedSchoolId : ((me as { school_id?: string })?.school_id ?? me?.school?.id ?? '');
  const enabled = me?.school?.enabled_modules ?? null;
  const ok = isSuperadmin || enabled === null || enabled.length === 0 || enabled.includes('dogrudan_temin');
  const now = useMemo(() => new Date(), []);
  const [year, setYear] = useState(String(now.getFullYear()));
  const [month, setMonth] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!ok) return <ForbiddenView description="Bu okulda Doğrudan Temin modülü kapalı." />;

  const setSchool = useCallback(
    (sid: string) => {
      setSelectedSchoolId(sid);
      const u = new URLSearchParams(searchParams.toString());
      if (sid) u.set('school_id', sid);
      else u.delete('school_id');
      router.replace(`/dogrudan-temin/raporlar?${u.toString()}`);
    },
    [router, searchParams],
  );

  const downloadRegistry = async () => {
    if (!token) return;
    if (isSuperadmin && !schoolId) return;
    setBusy(true);
    setError(null);
    try {
      const q = new URLSearchParams();
      q.set('year', String(Number(year)));
      if (month.trim()) q.set('month', String(Number(month)));
      const path = `/dogrudan-temin/reports/registry.xlsx?${q.toString()}`;
      const res = await apiFetch<{ download_url: string }>(dtUrl(path, me?.role, schoolId), { token });
      if (res?.download_url) window.open(res.download_url, '_blank', 'noopener,noreferrer');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Hata');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3 text-xs">
      <Toolbar>
        <ToolbarHeading>
          <ToolbarPageTitle className="text-base">DT Raporlar</ToolbarPageTitle>
          <ToolbarIconHints items={[{ label: 'Kayıt formu', icon: FileSpreadsheet }]} summary="Excel çıktı." />
        </ToolbarHeading>
        {isSuperadmin ? (
          <div className="hidden w-[320px] max-w-[60vw] md:block">
            <SchoolSelectWithFilter value={schoolId} onChange={setSchool} token={token} />
          </div>
        ) : null}
      </Toolbar>

      <Card>
        <CardContent className="py-4 space-y-3">
          {error && <Alert message={error} />}
          <div className="grid grid-cols-2 gap-2 max-w-md">
            <div className="space-y-1">
              <div className="text-[11px] text-muted-foreground">Yıl</div>
              <Input value={year} onChange={(e) => setYear(e.target.value)} />
            </div>
            <div className="space-y-1">
              <div className="text-[11px] text-muted-foreground">Ay (opsiyonel)</div>
              <Input value={month} onChange={(e) => setMonth(e.target.value)} placeholder="1-12" />
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={busy || (isSuperadmin && !schoolId)} onClick={downloadRegistry}>
              <FileDown className="size-4" />
              Doğrudan Temin Kayıt Formu (XLSX)
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

