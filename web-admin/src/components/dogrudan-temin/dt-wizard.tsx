'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, CheckCircle2, Circle, ClipboardList, FileStack, FileText, Handshake, Landmark, Settings2, Sparkles, Users } from 'lucide-react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { apiFetch } from '@/lib/api';
import type { DtDetailTabId } from '@/lib/dt-ui';
import { dtUrl } from '@/lib/dt-url';

type ModuleFileItem = {
  id: string;
  year: number;
  fileNo: string;
  subject: string;
  status: string;
};

type SchoolSettings = {
  officialCorrespondenceCode: string | null;
  headerLine2?: string | null;
  headerLine3?: string | null;
  headerLine4?: string | null;
};

type RegistryEntry = {
  stage: string;
  docDate: string | null;
  numberPrefix: string | null;
  numberSuffix: string | null;
  meta: Record<string, unknown>;
};

type DocItem = { docType: string; fileFormat: string };

type CommissionListItem = { kind: string };

function chipClass(done: boolean) {
  return done
    ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-200 dark:border-emerald-900/50'
    : 'bg-muted/40 text-muted-foreground border-border/70';
}

function StepRow({
  done,
  title,
  desc,
  icon,
  color,
  actions,
}: {
  done: boolean;
  title: string;
  desc?: string;
  icon: React.ReactNode;
  color: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-border/80 bg-gradient-to-br from-background to-muted/15 p-3 sm:p-4">
      <div className="flex items-start gap-3">
        <div className={`mt-0.5 grid size-10 shrink-0 place-items-center rounded-xl ${color}`}>{icon}</div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <div className="text-sm font-semibold tracking-tight">{title}</div>
            <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${chipClass(done)}`}>
              {done ? 'TAMAM' : 'DEVAM'}
            </span>
          </div>
          {desc ? <div className="mt-1 text-[11px] text-muted-foreground">{desc}</div> : null}
          {actions ? <div className="mt-3 flex flex-wrap gap-2">{actions}</div> : null}
        </div>
        <div className="mt-1 shrink-0 text-muted-foreground">{done ? <CheckCircle2 className="size-5 text-emerald-600" /> : <Circle className="size-5" />}</div>
      </div>
    </div>
  );
}

export function DtModuleWizard({
  token,
  role,
  schoolId,
  files,
}: {
  token: string | null | undefined;
  role: string | null | undefined;
  schoolId: string;
  files: ModuleFileItem[];
}) {
  const [open, setOpen] = useState(false);
  const [hide, setHide] = useState(false);
  const [settings, setSettings] = useState<SchoolSettings | null>(null);
  const [vendorCount, setVendorCount] = useState<number>(0);

  useEffect(() => {
    try {
      const h = localStorage.getItem('dt_wizard_hide_v1') === '1';
      setHide(h);
      const seen = localStorage.getItem('dt_wizard_seen_v1') === '1';
      if (!h && !seen) setOpen(true);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    if (!token) return;
    if (!schoolId) return;
    let alive = true;
    (async () => {
      const [s, v] = await Promise.all([
        apiFetch<SchoolSettings>(dtUrl('/dogrudan-temin/school-settings', role, schoolId), { token }).catch(() => null),
        apiFetch<{ items: Array<{ id: string }> }>(dtUrl('/dogrudan-temin/vendors', role, schoolId), { token }).catch(() => ({ items: [] })),
      ]);
      if (!alive) return;
      setSettings(s);
      setVendorCount((v?.items ?? []).length);
      try {
        localStorage.setItem('dt_wizard_seen_v1', '1');
      } catch {
        // ignore
      }
    })();
    return () => {
      alive = false;
    };
  }, [open, role, schoolId, token]);

  const schoolDone = useMemo(() => {
    const c = String(settings?.officialCorrespondenceCode ?? '').trim();
    const h = [settings?.headerLine2, settings?.headerLine3, settings?.headerLine4].some((x) => String(x ?? '').trim());
    return !!c || h;
  }, [settings]);
  const vendorsDone = vendorCount > 0;
  const fileDone = files.length > 0;

  const close = useCallback(
    (next: boolean) => {
      setOpen(next);
      if (!next && hide) {
        try {
          localStorage.setItem('dt_wizard_hide_v1', '1');
        } catch {
          // ignore
        }
      }
    },
    [hide],
  );

  if (!token || !schoolId) return null;
  if (hide) return null;

  return (
    <>
      <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>
        <Sparkles className="size-4" />
        Akış sihirbazı
      </Button>
      <Dialog open={open} onOpenChange={close}>
        <DialogContent title="Doğrudan Temin · Akış Sihirbazı" className="max-w-3xl">
          <div className="space-y-3">
            <div className="rounded-xl border border-border/80 bg-gradient-to-br from-sky-50/70 to-background p-3 text-[11px] text-muted-foreground dark:from-sky-950/20">
              Akışa göre sırayla ilerleyin. Eksik olan adımlar “DEVAM” olarak görünür ve tamamlandıkça otomatik işaretlenir.
            </div>

            <StepRow
              done={schoolDone}
              title="1) Okul formu / antet"
              desc="Resmî yazışma kodu, antet satırları, yetkililer."
              color="bg-sky-100 text-sky-700 dark:bg-sky-950/30 dark:text-sky-200"
              icon={<Settings2 className="size-5" />}
              actions={
                <Link href={dtUrl('/dogrudan-temin/okul-bilgileri', role, schoolId)}>
                  <Button size="sm" variant={schoolDone ? 'outline' : 'default'}>
                    Aç
                    <ArrowRight className="size-4" />
                  </Button>
                </Link>
              }
            />

            <StepRow
              done={vendorsDone}
              title="2) Firmalar"
              desc="Fiyat araştırması ve teklif için firma kaydı."
              color="bg-violet-100 text-violet-700 dark:bg-violet-950/30 dark:text-violet-200"
              icon={<Users className="size-5" />}
              actions={
                <Link href={dtUrl('/dogrudan-temin/firmalar', role, schoolId)}>
                  <Button size="sm" variant={vendorsDone ? 'outline' : 'default'}>
                    Aç
                    <ArrowRight className="size-4" />
                  </Button>
                </Link>
              }
            />

            <StepRow
              done={fileDone}
              title="3) Dosya oluştur / seç"
              desc="İhtiyaç kalemleri → evrak defteri → komisyonlar → teklifler → belgeler."
              color="bg-emerald-100 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-200"
              icon={<ClipboardList className="size-5" />}
              actions={
                <div className="flex flex-wrap gap-2">
                  {files.slice(0, 3).map((f) => (
                    <Link key={f.id} href={dtUrl(`/dogrudan-temin/${f.id}?wizard=1`, role, schoolId)}>
                      <Button size="sm" variant="outline" className="max-w-[320px] justify-start">
                        <span className="truncate">
                          {f.year}/{f.fileNo} · {f.subject}
                        </span>
                        <ArrowRight className="size-4" />
                      </Button>
                    </Link>
                  ))}
                </div>
              }
            />

            <div className="flex items-center justify-between gap-2 pt-1">
              <button
                type="button"
                className="text-[11px] text-muted-foreground hover:text-foreground"
                onClick={() => setHide((v) => !v)}
              >
                {hide ? 'Tekrar göster' : 'Bir daha otomatik açma'}
              </button>
              <Button size="sm" variant="outline" onClick={() => close(false)}>
                Kapat
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function DtFileWizard({
  open,
  onOpenChange,
  role,
  schoolId,
  token,
  fileId,
  subject,
  itemsCount,
  registryEntries,
  quotes,
  docs,
  commissions,
  docVendorId,
  onGoTab,
  onGenerateDoc,
  onOpenPiyasaPreview,
  onOpenYaklasikPreview,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  role: string | null | undefined;
  schoolId: string;
  token: string | null | undefined;
  fileId: string;
  subject: string;
  itemsCount: number;
  registryEntries: RegistryEntry[];
  quotes: Array<{ purpose?: string }>;
  docs: DocItem[];
  commissions: CommissionListItem[];
  docVendorId: string;
  onGoTab: (tab: DtDetailTabId) => void;
  onGenerateDoc: (docType: string, vendorId?: string) => void;
  onOpenPiyasaPreview?: () => void;
  onOpenYaklasikPreview?: () => void;
}) {
  const byDoc = useMemo(() => new Set(docs.map((d) => d.docType)), [docs]);
  const reg = useMemo(() => new Map(registryEntries.map((r) => [r.stage, r] as const)), [registryEntries]);

  const hasRegStage = useCallback(
    (stage: string) => {
      const r = reg.get(stage);
      if (!r) return false;
      const hasDate = !!String(r.docDate ?? '').trim();
      const hasNo = !!String(r.numberPrefix ?? '').trim();
      return hasDate && hasNo;
    },
    [reg],
  );

  const kararNoDone = useMemo(() => {
    const r = reg.get('muayene_kabul');
    return !!String((r?.meta as any)?.karar_no ?? '').trim();
  }, [reg]);

  const commDone = useMemo(() => {
    const kinds = new Set((commissions ?? []).map((c) => c.kind));
    return kinds.has('yaklasik_maliyet') && kinds.has('piyasa_satinalma') && kinds.has('muayene_kabul');
  }, [commissions]);

  const itemsDone = itemsCount > 0;
  const regDone =
    hasRegStage('ihtiyac_listesi') &&
    hasRegStage('komisyon_onay') &&
    hasRegStage('fiyat_arastirma') &&
    hasRegStage('yaklasik_maliyet') &&
    hasRegStage('ihale_onay') &&
    hasRegStage('teklif_mektubu') &&
    hasRegStage('piyasa_arastirma') &&
    hasRegStage('muayene_kabul') &&
    kararNoDone;

  const researchDone = quotes.some((q) => q.purpose === 'market_research');

  const docsDone = {
    ihtiyac: byDoc.has('ihtiyac_listesi'),
    komisyon: byDoc.has('komisyon_onay'),
    fiyat: byDoc.has('fiyat_arastirmasi'),
    yaklasik: byDoc.has('yaklasik_maliyet_cetveli'),
    onay: byDoc.has('onay_belgesi'),
    teklif: byDoc.has('teklif_isteme'),
    piyasa: byDoc.has('piyasa_arastirma_tutanagi'),
    muayene: byDoc.has('muayene_kabul_tutanagi'),
    teknik: byDoc.has('teknik_sartname'),
    teslim: byDoc.has('teslim_tesellum_tutanagi'),
  };

  const steps = useMemo(
    () => [
      { id: 'items', done: itemsDone, title: 'İhtiyaç kalemlerini gir', tab: 'items' as const, icon: <ClipboardList className="size-5" />, color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-200' },
      { id: 'registry', done: regDone, title: 'Evrak defteri (tarih/sayı + karar no)', tab: 'registry' as const, icon: <FileText className="size-5" />, color: 'bg-fuchsia-100 text-fuchsia-700 dark:bg-fuchsia-950/30 dark:text-fuchsia-200' },
      { id: 'commission', done: commDone, title: 'Komisyonları oluştur', tab: 'commission' as const, icon: <Users className="size-5" />, color: 'bg-violet-100 text-violet-700 dark:bg-violet-950/30 dark:text-violet-200' },
      { id: 'quotes', done: researchDone, title: 'Fiyat araştırması / teklifler', tab: 'quotes' as const, icon: <Handshake className="size-5" />, color: 'bg-sky-100 text-sky-700 dark:bg-sky-950/30 dark:text-sky-200' },
      { id: 'docs', done: docs.length > 0, title: 'Belgeleri üret (PDF/DOCX)', tab: 'docs' as const, icon: <FileStack className="size-5" />, color: 'bg-slate-100 text-slate-700 dark:bg-slate-900/40 dark:text-slate-200' },
      { id: 'payments', done: false, title: 'Ödeme kayıtları', tab: 'payments' as const, icon: <FileStack className="size-5" />, color: 'bg-lime-100 text-lime-700 dark:bg-lime-950/30 dark:text-lime-200' },
      { id: 'budget', done: false, title: 'Bütçe bloke', tab: 'budget' as const, icon: <Landmark className="size-5" />, color: 'bg-amber-100 text-amber-800 dark:bg-amber-950/30 dark:text-amber-200' },
    ],
    [commDone, docs.length, itemsDone, regDone, researchDone],
  );

  useEffect(() => {
    if (!open) return;
    if (!token || !schoolId || !fileId) return;
    // keep future extension point (no-op)
  }, [fileId, open, role, schoolId, token]);

  if (!token || !schoolId) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title="Dosya akışı · Sihirbaz" className="max-w-3xl">
        <div className="space-y-3">
          <div className="rounded-xl border border-border/80 bg-gradient-to-br from-sky-50/70 to-background p-3 text-[11px] text-muted-foreground dark:from-sky-950/20">
            Konu: <span className="font-semibold text-foreground">{subject}</span>
            <div className="mt-1">Eksik adımları tamamladıkça devam edin; belgeler sekmesinde PDF üretimi hazır.</div>
          </div>

          <div className="space-y-2">
            {steps.slice(0, 5).map((s) => (
              <StepRow
                key={s.id}
                done={s.done}
                title={s.title}
                color={s.color}
                icon={s.icon}
                actions={
                  <Button
                    size="sm"
                    variant={s.done ? 'outline' : 'default'}
                    onClick={() => {
                      onGoTab(s.tab);
                      onOpenChange(false);
                    }}
                  >
                    Git
                    <ArrowRight className="size-4" />
                  </Button>
                }
              />
            ))}
          </div>

          <div className="rounded-xl border border-border/80 bg-muted/15 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-[11px] font-semibold text-muted-foreground">Hızlı PDF üret</div>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={() => onGenerateDoc('ihtiyac_listesi')} disabled={!itemsDone}>
                  İhtiyaç
                </Button>
                <Button size="sm" variant="outline" onClick={() => onGenerateDoc('komisyon_onay')} disabled={!commDone}>
                  Komisyon
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onGenerateDoc('fiyat_arastirmasi', docVendorId || undefined)}
                  disabled={!itemsDone}
                  title={!docVendorId ? 'Firma yoksa şablonda boş alanlar kullanılır' : undefined}
                >
                  Fiyat araştırma
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    onOpenYaklasikPreview ? onOpenYaklasikPreview() : onGenerateDoc('yaklasik_maliyet_cetveli')
                  }
                  disabled={!researchDone}
                >
                  Yaklaşık
                </Button>
                <Button size="sm" variant="outline" onClick={() => onGenerateDoc('onay_belgesi')} disabled={!regDone}>
                  Onay
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => (onOpenPiyasaPreview ? onOpenPiyasaPreview() : onGenerateDoc('piyasa_arastirma_tutanagi'))}
                  disabled={!researchDone}
                >
                  Piyasa
                </Button>
                <Button size="sm" variant="outline" onClick={() => onGenerateDoc('muayene_kabul_tutanagi')} disabled={!kararNoDone}>
                  Muayene
                </Button>
              </div>
            </div>
            <div className="mt-2 flex flex-wrap gap-2 text-[10px] text-muted-foreground">
              <span className={`rounded border px-2 py-0.5 ${chipClass(docsDone.teknik)}`}>Teknik şartname</span>
              <span className={`rounded border px-2 py-0.5 ${chipClass(docsDone.teslim)}`}>Teslim/tesellüm</span>
            </div>
          </div>

          <div className="flex justify-end">
            <Button size="sm" variant="outline" onClick={() => onOpenChange(false)}>
              Kapat
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

