'use client';

import { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import {
  Building2,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Download,
  Eye,
  FileText,
  Mail,
  Plus,
  ShieldCheck,
  Users,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Alert } from '@/components/ui/alert';
import { LoadingSpinner } from '@/components/ui/loading-spinner';

type FormSchemaField = { key: string; label: string; type: string; required?: boolean };

export type YillikPlanGenerateTemplate = {
  id: string;
  formSchema?: FormSchemaField[] | null;
  form_schema?: FormSchemaField[] | null;
};

export type YillikPlanGeneratePreview =
  | { format: 'xlsx'; sheet_name: string; sheet_html: string; preview_url?: string; full_plan?: boolean }
  | { format: 'docx'; sheet_name?: string; sheet_html?: string; preview_available: true; full_plan?: boolean }
  | { format: 'docx'; preview_available: false; message: string; sheet_name?: string; sheet_html?: string; full_plan?: boolean };

type ZumreItem = { isim: string; unvan: string };

function parseZumreRaw(raw: string): ZumreItem[] {
  return String(raw ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((t) => {
      const pipe = t.indexOf('|');
      if (pipe >= 0) return { isim: t.slice(0, pipe).trim(), unvan: t.slice(pipe + 1).trim() };
      return { isim: t, unvan: '' };
    })
    .filter((x) => x.isim.length > 0);
}

function dedupeZumre(items: ZumreItem[]): ZumreItem[] {
  const map = new Map<string, ZumreItem>();
  for (const item of items) {
    const key = item.isim.toLocaleLowerCase('tr-TR');
    const prev = map.get(key);
    if (!prev) {
      map.set(key, item);
      continue;
    }
    if (!prev.unvan && item.unvan) map.set(key, item);
  }
  return [...map.values()];
}

function serializeZumre(items: ZumreItem[]): string {
  return items.map((x) => (x.unvan ? `${x.isim}|${x.unvan}` : x.isim)).join(', ');
}

const READ_ONLY_KEYS = [
  'ogretim_yili',
  'sinif',
  'ders_kodu',
  'dersKodu',
  'ders-kodu',
  'subject_code',
  'ders_adi',
  'dersAdi',
  'ders-adi',
  'subject_label',
];
const ZUMRE_KEYS = ['zumre_ogretmenleri', 'zumreler'];
const PROFILE_LOCKED_KEYS = [
  'onay_tarihi',
  'tarih',
  'onay_tarihi_alt',
  'mudur_adi',
  'zumre_ogretmenleri',
  'zumreler',
  'ogretmen_unvani',
];
const OKUL_KEYS = new Set(['okul_adi']);
const ONAY_KEYS = new Set(['mudur_adi', 'onay_tarihi', 'tarih', 'onay_tarihi_alt', 'ogretmen_unvani']);

const fieldInputClass =
  'h-9 rounded-lg border-border/80 bg-background text-sm shadow-sm focus-visible:ring-1 focus-visible:ring-primary/30';

function MetaChip({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex max-w-full items-center truncate rounded-md border border-border/70 bg-muted/40 px-2 py-0.5 text-[11px] font-medium text-foreground',
        className,
      )}
    >
      {children}
    </span>
  );
}

function SectionCard({
  icon: Icon,
  title,
  hint,
  children,
  accentClass,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  hint?: string;
  children: React.ReactNode;
  accentClass: string;
}) {
  return (
    <section className="overflow-hidden rounded-xl border border-border/70 bg-card shadow-sm">
      <div className="flex items-start gap-2.5 border-b border-border/60 bg-muted/20 px-3.5 py-2.5 sm:px-4">
        <span className={cn('flex size-8 shrink-0 items-center justify-center rounded-lg', accentClass)}>
          <Icon className="size-4" aria-hidden />
        </span>
        <div className="min-w-0 pt-0.5">
          <h3 className="text-sm font-semibold tracking-tight text-foreground">{title}</h3>
          {hint ? <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">{hint}</p> : null}
        </div>
      </div>
      <div className="space-y-3 p-3.5 sm:p-4">{children}</div>
    </section>
  );
}

function FieldLabel({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <label className="mb-1.5 block text-xs font-medium text-foreground">
      {children}
      {required ? <span className="text-destructive"> *</span> : null}
    </label>
  );
}

export function YillikPlanGenerateModal({
  open,
  isBilsem,
  title,
  metaChips,
  template,
  generateForm,
  setGenerateForm,
  generateSuccess,
  setGenerateSuccess,
  generateLoading,
  sendPlanEmail,
  setSendPlanEmail,
  preview,
  previewLoading,
  previewExpanded,
  setPreviewExpanded,
  onayBolumuEksik,
  noPlanKota,
  useBilsemPlanContentSource,
  userEmail,
  onClose,
  onSubmit,
}: {
  open: boolean;
  isBilsem: boolean;
  title: string;
  metaChips: string[];
  template: YillikPlanGenerateTemplate;
  generateForm: Record<string, string>;
  setGenerateForm: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  generateSuccess: boolean;
  setGenerateSuccess: (v: boolean) => void;
  generateLoading: boolean;
  sendPlanEmail: boolean;
  setSendPlanEmail: (v: boolean) => void;
  preview: YillikPlanGeneratePreview | null;
  previewLoading: boolean;
  previewExpanded: boolean;
  setPreviewExpanded: React.Dispatch<React.SetStateAction<boolean>>;
  onayBolumuEksik: boolean;
  noPlanKota: boolean;
  useBilsemPlanContentSource: boolean;
  userEmail?: string | null;
  onClose: () => void;
  onSubmit: () => void;
}) {
  const titleId = useId();
  const blockBackdropClose = useRef(false);
  const zumreIsimId = useId();
  const zumreUnvanId = useId();

  useEffect(() => {
    if (!open) return;
    blockBackdropClose.current = true;
    const t = window.setTimeout(() => {
      blockBackdropClose.current = false;
    }, 200);
    return () => window.clearTimeout(t);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onEscape);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onEscape);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  if (!open || typeof document === 'undefined') return null;

  const schema = template.formSchema ?? template.form_schema ?? [];
  const accentIcon = isBilsem
    ? 'bg-violet-500/12 text-violet-700 dark:bg-violet-500/20 dark:text-violet-300'
    : 'bg-sky-500/12 text-sky-700 dark:bg-sky-500/20 dark:text-sky-300';
  const accentChip = isBilsem
    ? 'border-violet-500/25 bg-violet-500/8 text-violet-900 dark:text-violet-100'
    : 'border-sky-500/25 bg-sky-500/8 text-sky-900 dark:text-sky-100';
  const primaryBtn = isBilsem
    ? 'bg-violet-600 hover:bg-violet-700 dark:bg-violet-600 dark:hover:bg-violet-500'
    : 'bg-primary hover:bg-primary/90';

  const visibleFields = schema.filter((f) => {
    if (READ_ONLY_KEYS.includes(f.key)) return false;
    if (f.key === 'zumreler' && schema.some((x) => x.key === 'zumre_ogretmenleri')) return false;
    if (f.key === 'tarih' && schema.some((x) => x.key === 'onay_tarihi')) return false;
    return true;
  });

  const okulFields = visibleFields.filter((f) => OKUL_KEYS.has(f.key));
  const onayFields = visibleFields.filter((f) => ONAY_KEYS.has(f.key) && !ZUMRE_KEYS.includes(f.key));
  const zumreField = visibleFields.find((f) => ZUMRE_KEYS.includes(f.key));
  const otherFields = visibleFields.filter(
    (f) => !OKUL_KEYS.has(f.key) && !ONAY_KEYS.has(f.key) && !ZUMRE_KEYS.includes(f.key),
  );

  const renderTextOrDateField = (f: FormSchemaField) => {
    const isProfileLocked = PROFILE_LOCKED_KEYS.includes(f.key);
    const placeholders: Record<string, string> = {
      okul_adi: 'Örn: Atatürk Anadolu Lisesi',
      mudur_adi: 'Örn: Mehmet Yılmaz',
      onay_tarihi: 'GG.AA.YYYY',
    };

    if (f.key === 'onay_tarihi' || f.key === 'tarih' || f.key === 'onay_tarihi_alt') {
      return (
        <Input
          type="date"
          value={(() => {
            const s = (generateForm[f.key] ?? generateForm.onay_tarihi ?? generateForm.tarih ?? '')
              .trim()
              .replace(/\s*\/\s*/g, '.');
            if (!s) return '';
            const parts = s.split(/[.\/\-]/).map((p) => p.trim());
            if (parts.length === 3 && parts[2]?.length === 4)
              return `${parts[2]}-${(parts[1] ?? '').padStart(2, '0')}-${(parts[0] ?? '').padStart(2, '0')}`;
            if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
            return '';
          })()}
          onChange={(e) => {
            if (isProfileLocked) return;
            const v = e.target.value;
            const tr = v ? new Date(v).toLocaleDateString('tr-TR') : '';
            const trAlt = tr.replace(/\./g, ' / ');
            setGenerateForm((prev) => ({
              ...prev,
              onay_tarihi: tr,
              tarih: tr,
              onay_tarihi_alt: trAlt,
            }));
          }}
          className={fieldInputClass}
          disabled={isProfileLocked}
        />
      );
    }

    return (
      <Input
        type="text"
        value={generateForm[f.key] ?? ''}
        onChange={(e) => {
          if (isProfileLocked) return;
          setGenerateForm((prev) => ({ ...prev, [f.key]: e.target.value }));
        }}
        placeholder={placeholders[f.key]}
        className={fieldInputClass}
        disabled={isProfileLocked}
      />
    );
  };

  const renderZumreSection = () => {
    if (!zumreField) return null;
    const f = zumreField;
    const isProfileLocked = PROFILE_LOCKED_KEYS.includes(f.key);
    const zumreValue = generateForm[f.key] ?? generateForm.zumre_ogretmenleri ?? generateForm.zumreler ?? '';
    const zumreItems = dedupeZumre(parseZumreRaw(zumreValue));

    const addZumre = () => {
      const isimEl = document.getElementById(zumreIsimId) as HTMLInputElement | null;
      const unvanEl = document.getElementById(zumreUnvanId) as HTMLInputElement | null;
      const isim = isimEl?.value?.trim();
      if (!isim) return;
      const unvan = unvanEl?.value?.trim() ?? '';
      const next = [...zumreItems, { isim, unvan }];
      setGenerateForm((prev) => ({
        ...prev,
        zumre_ogretmenleri: serializeZumre(next),
        zumreler: serializeZumre(next),
      }));
      if (isimEl) isimEl.value = '';
      if (unvanEl) unvanEl.value = '';
    };

    return (
      <SectionCard
        icon={Users}
        title="Zümre öğretmenleri"
        hint="İsim ve branş/unvan ile ekleyin. Profilden gelen kayıtlar düzenlenemez."
        accentClass={accentIcon}
      >
        {!isProfileLocked ? (
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
            <div className="min-w-0 flex-1">
              <FieldLabel>Öğretmen adı</FieldLabel>
              <Input
                id={zumreIsimId}
                placeholder="Ad Soyad"
                className={fieldInputClass}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addZumre();
                  }
                }}
              />
            </div>
            <div className="min-w-0 flex-1">
              <FieldLabel>Branş / unvan</FieldLabel>
              <Input
                id={zumreUnvanId}
                placeholder="Coğrafya Öğretmeni"
                className={fieldInputClass}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addZumre();
                  }
                }}
              />
            </div>
            <button
              type="button"
              onClick={addZumre}
              className={cn(
                'inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-lg px-3 text-sm font-medium text-primary-foreground shadow-sm',
                primaryBtn,
              )}
            >
              <Plus className="size-4" />
              Ekle
            </button>
          </div>
        ) : null}
        {zumreItems.length > 0 ? (
          <ul className="flex flex-wrap gap-1.5">
            {zumreItems.map((item, i) => (
              <li
                key={`${item.isim}-${item.unvan}-${i}`}
                className="inline-flex max-w-full items-center gap-1 rounded-full border border-border/70 bg-muted/30 py-1 pl-2.5 pr-1 text-xs text-foreground"
              >
                <span className="truncate">
                  <span className="font-medium">{item.isim}</span>
                  {item.unvan ? <span className="text-muted-foreground"> · {item.unvan}</span> : null}
                </span>
                {!isProfileLocked ? (
                  <button
                    type="button"
                    className="rounded-full p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                    onClick={() => {
                      const next = zumreItems.filter((_, j) => j !== i);
                      setGenerateForm((prev) => ({
                        ...prev,
                        zumre_ogretmenleri: serializeZumre(next),
                        zumreler: serializeZumre(next),
                      }));
                    }}
                    aria-label="Kaldır"
                  >
                    <X className="size-3.5" />
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        ) : (
          <p className="rounded-lg border border-dashed border-border/80 bg-muted/15 px-3 py-2.5 text-center text-xs text-muted-foreground">
            Henüz zümre öğretmeni eklenmedi.
          </p>
        )}
      </SectionCard>
    );
  };

  return createPortal(
    <>
      <div
        className="fixed inset-0 z-[350] bg-black/50 backdrop-blur-sm"
        aria-hidden
        onClick={() => {
          if (!blockBackdropClose.current) onClose();
        }}
      />
      <div className="pointer-events-none fixed inset-0 z-[351] flex items-end justify-center p-0 sm:items-center sm:p-4 sm:pb-[max(1rem,env(safe-area-inset-bottom))]">
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          className="pointer-events-auto flex max-h-[min(94dvh,calc(100dvh-env(safe-area-inset-bottom)))] w-full max-w-2xl min-w-0 flex-col overflow-hidden rounded-t-2xl border border-border/80 bg-background shadow-2xl ring-1 ring-black/5 sm:max-h-[min(90dvh,calc(100dvh-2rem))] sm:rounded-2xl dark:ring-white/10"
        >
          <header className="shrink-0 border-b border-border/70 bg-muted/15 px-4 py-3.5 sm:px-5">
            <div className="flex items-start gap-3">
              <span className={cn('flex size-10 shrink-0 items-center justify-center rounded-xl', accentIcon)}>
                <FileText className="size-5" aria-hidden />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {isBilsem ? 'Word üretimi' : 'Yıllık plan üretimi'}
                </p>
                <h2 id={titleId} className="mt-0.5 text-base font-semibold leading-snug tracking-tight text-foreground sm:text-lg">
                  {title}
                </h2>
                {metaChips.length > 0 ? (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {metaChips.map((chip) => (
                      <MetaChip key={chip} className={accentChip}>
                        {chip}
                      </MetaChip>
                    ))}
                  </div>
                ) : null}
              </div>
              <button
                type="button"
                onClick={onClose}
                className="shrink-0 rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                aria-label="Kapat"
              >
                <X className="size-5" />
              </button>
            </div>
          </header>

          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
            {generateSuccess ? (
              <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 py-10 text-center">
                <span className={cn('flex size-14 items-center justify-center rounded-full', accentIcon)}>
                  <CheckCircle2 className="size-7" />
                </span>
                <div className="space-y-1">
                  <p className="text-base font-semibold text-foreground">
                    {isBilsem ? 'Dosya indirildi' : 'Plan indirildi'}
                  </p>
                  <p className="max-w-sm text-sm text-muted-foreground">
                    {isBilsem
                      ? 'Arşivde saklandı. Aynı veya farklı seçimle yeni dosya üretebilirsiniz.'
                      : 'Word dosyanız hazır. İsterseniz yeni bir plan daha üretebilirsiniz.'}
                  </p>
                </div>
                <div className="flex w-full max-w-xs flex-col gap-2 sm:flex-row sm:justify-center">
                  <button
                    type="button"
                    onClick={() => {
                      setGenerateSuccess(false);
                      setGenerateForm((prev) => ({ ...prev }));
                    }}
                    className={cn(
                      'h-10 rounded-xl px-4 text-sm font-semibold text-primary-foreground shadow-sm',
                      primaryBtn,
                    )}
                  >
                    Yeni üret
                  </button>
                  <button
                    type="button"
                    onClick={onClose}
                    className="h-10 rounded-xl border border-border bg-background px-4 text-sm font-medium text-foreground hover:bg-muted"
                  >
                    Kapat
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 sm:px-5">
                  <div className="space-y-4">
                    {onayBolumuEksik ? (
                      <Alert message="Müdür adı ve zümre öğretmenleri zorunludur." variant="warning" />
                    ) : null}
                    <p className="rounded-lg border border-border/60 bg-muted/20 px-3 py-2 text-[11px] leading-relaxed text-muted-foreground">
                      Onay tarihi, müdür, zümre ve unvan bilgileri{' '}
                      <Link href="/settings?tab=zumre" className="font-medium text-primary underline-offset-2 hover:underline">
                        Ayarlar → Zümre
                      </Link>{' '}
                      sekmesinden alınır.
                    </p>

                    {okulFields.length > 0 ? (
                      <SectionCard
                        icon={Building2}
                        title="Okul bilgileri"
                        accentClass={accentIcon}
                      >
                        {okulFields.map((f) => (
                          <div key={f.key}>
                            <FieldLabel required={f.required}>{f.label}</FieldLabel>
                            {renderTextOrDateField(f)}
                          </div>
                        ))}
                      </SectionCard>
                    ) : null}

                    {onayFields.length > 0 ? (
                      <SectionCard
                        icon={ShieldCheck}
                        title="Onay bilgileri"
                        accentClass={accentIcon}
                      >
                        <div className="grid gap-3 sm:grid-cols-2">
                          {onayFields.map((f) => (
                            <div key={f.key} className={f.key === 'ogretmen_unvani' ? 'sm:col-span-2' : undefined}>
                              <FieldLabel required={f.required}>{f.label}</FieldLabel>
                              {renderTextOrDateField(f)}
                            </div>
                          ))}
                        </div>
                      </SectionCard>
                    ) : null}

                    {renderZumreSection()}

                    {otherFields.length > 0 ? (
                      <SectionCard icon={FileText} title="Ek alanlar" accentClass={accentIcon}>
                        {otherFields.map((f) => (
                          <div key={f.key}>
                            <FieldLabel required={f.required}>{f.label}</FieldLabel>
                            {renderTextOrDateField(f)}
                          </div>
                        ))}
                      </SectionCard>
                    ) : null}

                    {(preview !== null || previewLoading) && (
                      <section className="overflow-hidden rounded-xl border border-border/70 bg-card shadow-sm">
                        <button
                          type="button"
                          onClick={() => setPreviewExpanded((e) => !e)}
                          className="flex w-full items-center gap-3 px-3.5 py-3 text-left transition-colors hover:bg-muted/30 sm:px-4"
                        >
                          <span className={cn('flex size-9 shrink-0 items-center justify-center rounded-lg', accentIcon)}>
                            <Eye className="size-4" />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                              {previewLoading ? 'Önizleme hazırlanıyor' : 'Canlı önizleme'}
                            </span>
                            <span className="line-clamp-1 text-sm font-medium text-foreground">
                              {preview?.sheet_name ?? 'Şablon özeti'}
                            </span>
                          </span>
                          {previewExpanded ? (
                            <ChevronUp className="size-4 shrink-0 text-muted-foreground" />
                          ) : (
                            <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
                          )}
                        </button>
                        {previewExpanded ? (
                          <div className="max-h-[min(38vh,320px)] overflow-auto overscroll-contain border-t border-border/60 bg-muted/10 px-3 py-3 sm:px-4">
                            {previewLoading ? (
                              <div className="flex flex-col items-center justify-center gap-2 py-8">
                                <LoadingSpinner className={cn('size-6', isBilsem ? 'text-violet-600' : 'text-primary')} />
                                <p className="text-xs text-muted-foreground">Sayfa oluşturuluyor…</p>
                              </div>
                            ) : preview?.sheet_html ? (
                              <div
                                className="origin-top-left [scrollbar-width:thin]"
                                style={
                                  preview.full_plan
                                    ? { transform: 'scale(0.88)', transformOrigin: 'top left', minWidth: '113.6%' }
                                    : isBilsem
                                      ? { transform: 'scale(0.95)', transformOrigin: 'top left' }
                                      : undefined
                                }
                              >
                                <div
                                  className={cn(
                                    'prose prose-sm max-w-none [&_th]:border [&_th]:border-border/80 [&_th]:bg-muted/60 [&_td]:border [&_td]:border-border/60 dark:[&_th]:border-white/10 dark:[&_td]:border-white/10',
                                    isBilsem
                                      ? 'text-[11px] leading-snug [&_table]:text-[10px] [&_td]:p-1.5 [&_th]:p-1.5'
                                      : '[&_td]:p-2 [&_th]:p-2',
                                  )}
                                  dangerouslySetInnerHTML={{ __html: preview.sheet_html }}
                                />
                              </div>
                            ) : preview && 'message' in preview ? (
                              <p className="rounded-lg border border-dashed border-border/80 bg-muted/20 px-3 py-4 text-center text-xs leading-relaxed text-muted-foreground">
                                {preview.message}
                              </p>
                            ) : null}
                          </div>
                        ) : null}
                      </section>
                    )}
                  </div>
                </div>

                <footer className="shrink-0 border-t border-border/70 bg-muted/25 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur-sm sm:px-5">
                  {userEmail ? (
                    <label className="mb-3 flex cursor-pointer items-start gap-3 rounded-xl border border-border/70 bg-background/80 px-3 py-2.5 shadow-sm">
                      <input
                        type="checkbox"
                        checked={sendPlanEmail}
                        onChange={(e) => setSendPlanEmail(e.target.checked)}
                        className="mt-0.5 size-4 shrink-0 rounded border-input accent-primary"
                      />
                      <span className="min-w-0 text-sm leading-snug">
                        <span className="inline-flex items-center gap-1.5 font-medium text-foreground">
                          <Mail className="size-3.5 shrink-0 text-primary" aria-hidden />
                          Word dosyasını e-postayla gönder
                        </span>
                        <span className="mt-0.5 block truncate text-xs text-muted-foreground">{userEmail}</span>
                      </span>
                    </label>
                  ) : null}
                  <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                    <button
                      type="button"
                      onClick={onClose}
                      className="h-10 rounded-xl border border-border bg-background px-4 text-sm font-medium text-foreground hover:bg-muted sm:min-w-[6.5rem]"
                    >
                      İptal
                    </button>
                    <button
                      type="button"
                      onClick={onSubmit}
                      disabled={
                        generateLoading ||
                        noPlanKota ||
                        (isBilsem &&
                          !useBilsemPlanContentSource &&
                          !String(generateForm.bilsem_yillik_draft_json ?? '').trim())
                      }
                      title={noPlanKota ? 'Plan üretim kotanız bitti. Marketten hak alın.' : undefined}
                      className={cn(
                        'inline-flex h-10 items-center justify-center gap-2 rounded-xl px-5 text-sm font-semibold text-primary-foreground shadow-sm transition-all disabled:cursor-not-allowed disabled:opacity-50 sm:min-w-[10rem]',
                        primaryBtn,
                      )}
                    >
                      {generateLoading ? (
                        <>
                          <LoadingSpinner className="size-4" />
                          Üretiliyor…
                        </>
                      ) : (
                        <>
                          <Download className="size-4" />
                          Üret ve İndir
                        </>
                      )}
                    </button>
                  </div>
                </footer>
              </>
            )}
          </div>
        </div>
      </div>
    </>,
    document.body,
  );
}
