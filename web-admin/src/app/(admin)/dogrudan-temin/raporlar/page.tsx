'use client';

import { useCallback, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Toolbar, ToolbarHeading, ToolbarPageTitle } from '@/components/layout/toolbar';
import { ToolbarIconHints } from '@/components/layout/toolbar-icon-hints';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ForbiddenView } from '@/components/errors/forbidden-view';
import { useAuth } from '@/hooks/use-auth';
import { apiFetch } from '@/lib/api';
import { dtUrl } from '@/lib/dt-url';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FileDown, RefreshCw, Table } from 'lucide-react';
import { SchoolSelectWithFilter } from '@/components/school-select-with-filter';
import { Table as TTable, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Label } from '@/components/ui/label';

type RegistrySummaryRow = {
  temin_type: string;
  temin_label: string;
  count: number;
  approx_total: number;
  decision_total: number;
  payment_total: number;
};

type RegistryFileRow = {
  school_name: string;
  year: number;
  file_no: string;
  subject: string;
  temin_code: string;
  temin_label: string;
  status_code: string;
  status_label: string;
  approx_total: number;
  decision_total: number;
  payment_total: number;
  budget_code: string | null;
  budget_label: string | null;
  created_at: string;
  archived_at: string | null;
};

type RegistryPaymentRow = {
  school_name: string;
  year: number;
  file_no: string;
  file_subject: string;
  paid_at: string;
  amount: number;
  reference_no: string | null;
  note: string | null;
  vendor_title: string | null;
};

type RegistryPayload = {
  year: number;
  month: number | null;
  include_archived: boolean;
  summary: RegistrySummaryRow[];
  files: RegistryFileRow[];
  payments: RegistryPaymentRow[];
};

const trMoney = (n: number) =>
  new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 2 }).format(n);

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
  const [includeArchived, setIncludeArchived] = useState(false);
  const [busy, setBusy] = useState(false);
  const [previewBusy, setPreviewBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<RegistryPayload | null>(null);

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

  const buildQs = () => {
    const q = new URLSearchParams();
    q.set('year', String(Number(year)));
    if (month.trim()) q.set('month', String(Number(month)));
    if (includeArchived) q.set('include_archived', '1');
    return q;
  };

  const loadPreview = async () => {
    if (!token) return;
    if (isSuperadmin && !schoolId) return;
    setPreviewBusy(true);
    setError(null);
    try {
      const path = `/dogrudan-temin/reports/registry?${buildQs().toString()}`;
      const res = await apiFetch<RegistryPayload>(dtUrl(path, me?.role, schoolId), { token });
      setData(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Hata');
      setData(null);
    } finally {
      setPreviewBusy(false);
    }
  };

  const downloadRegistry = async () => {
    if (!token) return;
    if (isSuperadmin && !schoolId) return;
    setBusy(true);
    setError(null);
    try {
      const path = `/dogrudan-temin/reports/registry.xlsx?${buildQs().toString()}`;
      const res = await apiFetch<{ download_url: string }>(dtUrl(path, me?.role, schoolId), { token });
      if (res?.download_url) window.open(res.download_url, '_blank', 'noopener,noreferrer');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Hata');
    } finally {
      setBusy(false);
    }
  };

  const disabled = busy || previewBusy || (isSuperadmin && !schoolId);

  if (!ok) return <ForbiddenView description="Bu okulda Doğrudan Temin modülü kapalı." />;

  return (
    <div className="space-y-4 text-xs">
      <Toolbar>
        <ToolbarHeading>
          <ToolbarPageTitle className="text-base">Doğrudan temin raporları</ToolbarPageTitle>
          <ToolbarIconHints
            items={[
              { label: 'Özet + defter', icon: Table },
              { label: 'Mutemet XLSX', icon: FileDown },
            ]}
            summary="HYS uyumlu sütunlar: Ozet, Dosya_satirlari, Odeme_satirlari, Aciklama."
          />
        </ToolbarHeading>
        {isSuperadmin ? (
          <div className="hidden w-[320px] max-w-[60vw] md:block">
            <SchoolSelectWithFilter value={schoolId} onChange={setSchool} token={token} />
          </div>
        ) : null}
      </Toolbar>

      <Card className="border-border/80 shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">Kayıt ve ödeme defteri</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 pt-0">
          <Alert
            variant="info"
            message="XLSX dört sayfadır: Ozet, Dosya_satirlari, Odeme_satirlari, Aciklama. HMB Harcama Yönetim Sistemi ekonomik kod eşlemesini kurum kılavuzunuza göre yapın."
          />
          {error ? <Alert message={error} /> : null}

          <div className="flex flex-wrap items-end gap-4">
            <div className="grid w-[100px] gap-1">
              <Label className="text-[11px] text-muted-foreground">Yıl</Label>
              <Input value={year} onChange={(e) => setYear(e.target.value)} className="h-9" />
            </div>
            <div className="grid w-[100px] gap-1">
              <Label className="text-[11px] text-muted-foreground">Ay (ops.)</Label>
              <Input value={month} onChange={(e) => setMonth(e.target.value)} placeholder="1–12" className="h-9" />
            </div>
            <div className="flex items-center gap-2 pb-1">
              <input
                id="arch"
                type="checkbox"
                checked={includeArchived}
                onChange={(e) => setIncludeArchived(e.target.checked)}
                className="size-4 rounded border border-input accent-primary"
              />
              <Label htmlFor="arch" className="cursor-pointer text-[11px] font-normal leading-tight">
                Arşivli dosyaları dahil et
              </Label>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" size="sm" className="h-9" disabled={disabled} onClick={loadPreview}>
                <RefreshCw className={`size-3.5 ${previewBusy ? 'animate-spin' : ''}`} />
                Önizleme
              </Button>
              <Button size="sm" className="h-9" disabled={disabled} onClick={downloadRegistry}>
                <FileDown className="size-3.5" />
                Mutemet paketi (XLSX)
              </Button>
            </div>
          </div>

          {data ? (
            <div className="space-y-6 rounded-lg border bg-muted/20 p-3">
              <section className="space-y-2">
                <div className="text-[11px] font-medium text-muted-foreground">
                  Özet — {data.year}
                  {data.month != null ? ` / ay ${data.month}` : ''} {data.include_archived ? '(arşiv dahil)' : ''}
                </div>
                <div className="overflow-x-auto rounded-md border bg-background">
                  <TTable>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Temin</TableHead>
                        <TableHead className="text-right">Adet</TableHead>
                        <TableHead className="text-right">Yaklaşık</TableHead>
                        <TableHead className="text-right">Karar</TableHead>
                        <TableHead className="text-right">Ödenen</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.summary?.length ? (
                        data.summary.map((r) => (
                          <TableRow key={r.temin_type}>
                            <TableCell className="max-w-[220px]">
                              <span className="font-mono text-[10px] text-muted-foreground">{r.temin_type}</span>{' '}
                              {r.temin_label}
                            </TableCell>
                            <TableCell className="text-right tabular-nums">{r.count}</TableCell>
                            <TableCell className="text-right tabular-nums">{trMoney(r.approx_total)}</TableCell>
                            <TableCell className="text-right tabular-nums">{trMoney(r.decision_total)}</TableCell>
                            <TableCell className="text-right tabular-nums">{trMoney(r.payment_total)}</TableCell>
                          </TableRow>
                        ))
                      ) : (
                        <TableRow>
                          <TableCell colSpan={5} className="text-muted-foreground">
                            Kayıt yok
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </TTable>
                </div>
              </section>

              <section className="space-y-2">
                <div className="text-[11px] font-medium text-muted-foreground">Dosya satırları ({data.files?.length ?? 0})</div>
                <div className="max-h-[min(360px,50vh)] overflow-auto rounded-md border bg-background">
                  <TTable>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Dosya</TableHead>
                        <TableHead>Durum</TableHead>
                        <TableHead className="text-right">Ödenen</TableHead>
                        <TableHead>Bütçe</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(data.files ?? []).slice(0, 200).map((r, i) => (
                        <TableRow key={`${r.file_no}-${i}`}>
                          <TableCell className="max-w-[280px]">
                            <div className="font-medium">{r.file_no}</div>
                            <div className="truncate text-muted-foreground">{r.subject}</div>
                          </TableCell>
                          <TableCell className="whitespace-nowrap">{r.status_label}</TableCell>
                          <TableCell className="text-right tabular-nums">{trMoney(r.payment_total)}</TableCell>
                          <TableCell className="max-w-[160px] truncate text-[10px] text-muted-foreground">
                            {[r.budget_code, r.budget_label].filter(Boolean).join(' — ')}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </TTable>
                </div>
                {(data.files?.length ?? 0) > 200 ? (
                  <p className="text-[10px] text-muted-foreground">Tabloda ilk 200 satır; tam liste XLSX içinde.</p>
                ) : null}
              </section>

              <section className="space-y-2">
                <div className="text-[11px] font-medium text-muted-foreground">Ödeme satırları ({data.payments?.length ?? 0})</div>
                <div className="max-h-[min(280px,40vh)] overflow-auto rounded-md border bg-background">
                  <TTable>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Dosya</TableHead>
                        <TableHead>Tarih</TableHead>
                        <TableHead className="text-right">Tutar</TableHead>
                        <TableHead>Firma</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(data.payments ?? []).slice(0, 150).map((r, i) => (
                        <TableRow key={`${r.file_no}-${r.paid_at}-${i}`}>
                          <TableCell className="max-w-[200px]">
                            <div className="font-medium">{r.file_no}</div>
                            <div className="truncate text-muted-foreground">{r.file_subject}</div>
                          </TableCell>
                          <TableCell className="whitespace-nowrap text-[10px]">
                            {r.paid_at ? new Date(r.paid_at).toLocaleDateString('tr-TR') : '—'}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">{trMoney(r.amount)}</TableCell>
                          <TableCell className="max-w-[140px] truncate">{r.vendor_title ?? '—'}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </TTable>
                </div>
                {(data.payments?.length ?? 0) > 150 ? (
                  <p className="text-[10px] text-muted-foreground">Tabloda ilk 150 satır; tam liste XLSX içinde.</p>
                ) : null}
              </section>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
