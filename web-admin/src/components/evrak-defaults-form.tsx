'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { apiFetch } from '@/lib/api';
import { toast } from 'sonner';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  Building2,
  Calendar,
  CalendarDays,
  FileText,
  GraduationCap,
  Package,
  Plus,
  Save,
  User,
  Users,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';

/** Tarih: DD.MM.YYYY veya YYYY-MM-DD → input value YYYY-MM-DD */
function trDateToInput(s: string | undefined): string {
  if (!s?.trim()) return '';
  const str = String(s).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;
  const parts = str.split(/[.\/\-]/);
  if (parts.length === 3) {
    const [a, b, c] = parts;
    if (c?.length === 4) return `${c}-${(b ?? '').padStart(2, '0')}-${(a ?? '').padStart(2, '0')}`;
  }
  return '';
}

/** YYYY-MM-DD → DD.MM.YYYY (yerel saat kayması olmadan) */
function inputToTrDate(s: string | undefined): string {
  if (!s?.trim()) return '';
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s.trim());
  if (m) return `${m[3]}.${m[2]}.${m[1]}`;
  const d = new Date(s);
  return isNaN(d.getTime()) ? '' : d.toLocaleDateString('tr-TR');
}

/** Zümre formatı: "İsim|Görev, İsim2|Görev2" — document-generate ile uyumlu */
const GOREV_OPTIONS = [
  { value: '', label: 'Görev seçin' },
  { value: 'Okul Müdürü', label: 'Okul Müdürü' },
  { value: 'Müdür Yardımcısı', label: 'Müdür Yardımcısı' },
  { value: 'Zümre Başkanı', label: 'Zümre Başkanı' },
  { value: 'Zümre Öğretmeni', label: 'Zümre Öğretmeni' },
  { value: 'Kulüp Öğretmeni', label: 'Kulüp Öğretmeni' },
  { value: 'Rehberlik Öğretmeni', label: 'Rehberlik Öğretmeni' },
];

/** Dropdown ile aynı hiyerarşi; bilinmeyen metin ortada, görevsiz en sonda */
const GOREV_RANK = Object.fromEntries(
  GOREV_OPTIONS.filter((o) => o.value).map((o, i) => [o.value, i]),
) as Record<string, number>;

function gorevRank(gorev: string): number {
  const g = gorev.trim();
  if (!g) return 1_000_000;
  return GOREV_RANK[g] ?? 500_000;
}

function sortZumreByGorev(items: { name: string; gorev: string }[]): { name: string; gorev: string }[] {
  return [...items].sort((a, b) => {
    const ra = gorevRank(a.gorev);
    const rb = gorevRank(b.gorev);
    if (ra !== rb) return ra - rb;
    return a.name.localeCompare(b.name, 'tr', { sensitivity: 'base' });
  });
}

/** Evrak `mudur_adi`: okul kaydındaki demo/yer tutucu değil; zümre listesindeki «Okul Müdürü» satırı */
function mudurAdiFromZumre(items: { name: string; gorev: string }[]): string {
  for (const x of sortZumreByGorev(items)) {
    if (x.gorev === 'Okul Müdürü' && x.name.trim()) return x.name.trim();
  }
  return '';
}

const ZUMRE_MAX = 2000;

function parseZumreList(raw: string): { name: string; gorev: string }[] {
  if (!raw?.trim()) return [];
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((part) => {
      const i = part.indexOf('|');
      if (i >= 0) return { name: part.slice(0, i).trim(), gorev: part.slice(i + 1).trim() };
      return { name: part, gorev: '' };
    });
}

function serializeZumreList(items: { name: string; gorev: string }[]): string {
  return items.map(({ name, gorev }) => (gorev ? `${name}|${gorev}` : name)).join(', ');
}

export type EvrakDefaults = {
  okul_adi?: string;
  mudur_adi?: string;
  ogretim_yili?: string;
  sinif?: string;
  zumreler?: string;
  zumre_ogretmenleri?: string;
  onay_tarihi?: string;
  /** İmza alanında öğretmen ismi altında görünecek unvan (örn. Coğrafya Öğretmeni) */
  ogretmen_unvani?: string;
} | null;

const fieldIn = cn(
  'h-9 w-full rounded-md border border-input bg-background px-2.5 text-sm text-foreground shadow-sm',
  'transition-[color,box-shadow] focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/15',
  'max-sm:h-8 max-sm:px-2 max-sm:text-[13px] sm:rounded-lg sm:px-3',
);
const lblRow = 'flex items-center gap-1.5 text-xs font-medium text-foreground sm:gap-2 sm:text-sm';
const iconBox = 'flex size-6 shrink-0 items-center justify-center rounded-md bg-violet-500/12 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300 sm:size-7';
const iconBoxZ = 'flex size-6 shrink-0 items-center justify-center rounded-md bg-emerald-500/12 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-200 sm:size-7';
const sectionShell = 'overflow-hidden rounded-xl border border-border/80 bg-card shadow-sm ring-1 ring-black/5 dark:border-border dark:ring-white/5';
const sectionHead = 'border-b border-border/60 bg-muted/30 px-3 py-2.5 sm:px-4 sm:py-3';
const sectionBody = 'space-y-3 p-3 sm:space-y-4 sm:p-4';

export function EvrakDefaultsForm({
  token,
  evrakDefaults,
  schoolName,
  schoolDistrict,
  schoolCity,
  teacherBranch,
  schoolConnected = true,
  onSuccess,
}: {
  token: string | null;
  evrakDefaults: EvrakDefaults;
  /** Okul tablosundaki tam resmi ad (kayıt) */
  schoolName?: string;
  schoolDistrict?: string | null;
  schoolCity?: string | null;
  /** Profil branşı — öğretmen unvanı boşsa öneri olarak kullanılır */
  teacherBranch?: string | null;
  /** Okul bağlı değilse Okul sekmesi uyarısı */
  schoolConnected?: boolean;
  onSuccess: () => void;
}) {
  const [ogretimYili, setOgretimYili] = useState(evrakDefaults?.ogretim_yili ?? '');
  const [zumreList, setZumreList] = useState<{ name: string; gorev: string }[]>(() =>
    sortZumreByGorev(parseZumreList(evrakDefaults?.zumre_ogretmenleri ?? evrakDefaults?.zumreler ?? '')),
  );
  const [ogretmenUnvani, setOgretmenUnvani] = useState(
    evrakDefaults?.ogretmen_unvani ?? teacherBranch?.trim() ?? '',
  );
  const [onayTarihi, setOnayTarihi] = useState(evrakDefaults?.onay_tarihi ?? '');
  const [zumreDraftName, setZumreDraftName] = useState('');
  const [zumreDraftGorev, setZumreDraftGorev] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const patchFieldsRef = useRef({
    ogretimYili,
    ogretmenUnvani,
    onayTarihi,
    schoolName: schoolName ?? '',
  });
  useEffect(() => {
    patchFieldsRef.current = { ogretimYili, ogretmenUnvani, onayTarihi, schoolName: schoolName ?? '' };
  }, [ogretimYili, ogretmenUnvani, onayTarihi, schoolName]);

  const mudurEvrak = useMemo(() => mudurAdiFromZumre(zumreList), [zumreList]);

  const serverZumreRaw = evrakDefaults?.zumre_ogretmenleri ?? evrakDefaults?.zumreler ?? '';

  useEffect(() => {
    setZumreList(sortZumreByGorev(parseZumreList(serverZumreRaw)));
  }, [serverZumreRaw]);

  useEffect(() => {
    setOgretimYili(evrakDefaults?.ogretim_yili ?? '');
    setOgretmenUnvani(evrakDefaults?.ogretmen_unvani ?? teacherBranch?.trim() ?? '');
    setOnayTarihi(evrakDefaults?.onay_tarihi ?? '');
  }, [
    evrakDefaults?.ogretim_yili,
    evrakDefaults?.ogretmen_unvani,
    evrakDefaults?.onay_tarihi,
    teacherBranch,
  ]);

  const pushEvrakToServer = useCallback(
    async (nextList: { name: string; gorev: string }[], opts?: { silent?: boolean }) => {
      if (!token) return;
      const sorted = sortZumreByGorev(nextList);
      const serialized = serializeZumreList(sorted);
      if (serialized.length > ZUMRE_MAX) {
        toast.error('Zümre listesi çok uzun.');
        return;
      }
      const { ogretimYili: oy, ogretmenUnvani: ou, onayTarihi: ot, schoolName: sn } = patchFieldsRef.current;
      try {
        await apiFetch('/me', {
          method: 'PATCH',
          token,
          body: JSON.stringify({
            evrak_defaults: {
              okul_adi: sn.trim(),
              mudur_adi: mudurAdiFromZumre(sorted),
              ogretim_yili: oy.trim(),
              sinif: '',
              zumre_ogretmenleri: serialized,
              zumreler: serialized,
              ogretmen_unvani: ou.trim(),
              onay_tarihi: ot.trim(),
            },
          }),
        });
        if (!opts?.silent) {
          toast.success('Zümre / evrak varsayılanları kaydedildi');
        }
        onSuccess();
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Kaydedilemedi';
        toast.error(msg);
        throw err;
      }
    },
    [token, onSuccess],
  );

  const addZumre = useCallback(() => {
    const v = zumreDraftName.trim();
    const g = zumreDraftGorev.trim();
    if (!v) {
      toast.error('Ad soyad girin.');
      return;
    }
    const dup = zumreList.some(
      (x) => x.name.toLowerCase() === v.toLowerCase() && (x.gorev || '') === (g || ''),
    );
    if (dup) {
      toast.message('Aynı ad ve görev kombinasyonu listede var.');
      return;
    }
    const next = sortZumreByGorev([...zumreList, { name: v, gorev: g }]);
    setZumreList(next);
    setZumreDraftName('');
    setZumreDraftGorev('');
    void pushEvrakToServer(next, { silent: true }).catch(() => {});
  }, [zumreDraftName, zumreDraftGorev, zumreList, pushEvrakToServer]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setSubmitting(true);
    setError(null);
    const serialized = serializeZumreList(sortZumreByGorev(zumreList));
    if (serialized.length > ZUMRE_MAX) {
      setError(`Zümre listesi en fazla ${ZUMRE_MAX} karakter olabilir. Bazı satırları silin veya kısaltın.`);
      toast.error('Zümre listesi çok uzun.');
      setSubmitting(false);
      return;
    }
    try {
      await pushEvrakToServer(zumreList, { silent: false });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Kaydedilemedi';
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-5">
      {error && <Alert message={error} />}
      {!schoolConnected && (
        <Alert
          variant="info"
          message="Okul bağlı değil. Önce Okul sekmesinden okul seçin. Müdür adı evrakta, aşağıda zümre listesine Okul Müdürü olarak eklediğiniz isimden kullanılır."
        />
      )}

      <section className={sectionShell}>
        <div className={cn(sectionHead, 'bg-linear-to-r from-violet-500/10 via-transparent to-fuchsia-500/8 dark:from-violet-950/40 dark:to-fuchsia-950/20')}>
          <div className="flex items-start gap-2.5 sm:items-center sm:gap-3">
            <div className={iconBox}>
              <FileText className="size-3.5 sm:size-4" />
            </div>
            <div className="min-w-0 space-y-0.5">
              <h2 className="text-sm font-semibold leading-tight text-foreground sm:text-base">Okul ve belge alanları</h2>
              <p className="text-[11px] leading-snug text-muted-foreground sm:text-xs">
                Okul ünvanı kayıttaki tam ad; müdür alanı ise zümre listesinde «Okul Müdürü» olarak eklediğiniz addır. Öğretim yılı, onay tarihi ve imza satırını buradan düzenleyin.
              </p>
            </div>
          </div>
        </div>
        <div className={sectionBody}>
          <div className="grid gap-3 sm:grid-cols-2 sm:gap-x-4 sm:gap-y-3">
            <div className="space-y-1.5 rounded-lg border border-border/70 bg-muted/25 px-3 py-2.5 sm:col-span-2 dark:border-border/80 dark:bg-muted/15">
              <div className={lblRow}>
                <span className={iconBox}>
                  <Building2 className="size-3.5" />
                </span>
                Okul (kayıt — tam ad)
              </div>
              <p className="wrap-break-word text-sm font-semibold leading-snug text-foreground">
                {(schoolName ?? '').trim() || (schoolConnected ? '—' : 'Okul seçilmedi')}
              </p>
              {schoolConnected && (schoolDistrict?.trim() || schoolCity?.trim()) && (
                <p className="text-[11px] text-muted-foreground">
                  {[schoolDistrict?.trim(), schoolCity?.trim()].filter(Boolean).join(' · ')}
                </p>
              )}
            </div>
            <div className="space-y-1 sm:space-y-1.5">
              <label htmlFor="evrak-ogretim-yili" className={lblRow}>
                <span className={iconBox}>
                  <CalendarDays className="size-3.5" />
                </span>
                Öğretim yılı
              </label>
              <input
                id="evrak-ogretim-yili"
                type="text"
                value={ogretimYili}
                onChange={(e) => setOgretimYili(e.target.value)}
                maxLength={32}
                className={fieldIn}
                placeholder="Örn: 2025-2026"
              />
            </div>
            <div className="space-y-1 sm:space-y-1.5">
              <label htmlFor="evrak-onay-tarihi" className={lblRow}>
                <span className={iconBox}>
                  <Calendar className="size-3.5" />
                </span>
                Onay tarihi
              </label>
              <input
                id="evrak-onay-tarihi"
                type="date"
                value={trDateToInput(onayTarihi)}
                onChange={(e) => setOnayTarihi(e.target.value ? inputToTrDate(e.target.value) : '')}
                className={fieldIn}
              />
              <p className="text-[11px] text-muted-foreground">Boşsa belgede bugün kullanılır.</p>
            </div>
            <div className="space-y-1 sm:col-span-2 sm:space-y-1.5">
              <label htmlFor="evrak-ogretmen-unvani" className={lblRow}>
                <span className={iconBox}>
                  <GraduationCap className="size-3.5" />
                </span>
                Öğretmen unvanı / branş
              </label>
              <input
                id="evrak-ogretmen-unvani"
                type="text"
                value={ogretmenUnvani}
                onChange={(e) => setOgretmenUnvani(e.target.value)}
                maxLength={100}
                className={fieldIn}
                placeholder="İmza satırı — örn: Coğrafya Öğretmeni"
              />
              <p className="text-[11px] text-muted-foreground sm:text-xs">Boşsa profil branşı veya ders adı kullanılabilir.</p>
            </div>
          </div>
        </div>
      </section>

      <section className={sectionShell}>
        <div className={cn(sectionHead, 'bg-linear-to-r from-emerald-500/10 via-transparent to-teal-500/8 dark:from-emerald-950/35 dark:to-teal-950/20')}>
          <div className="flex items-start gap-2.5 sm:items-center sm:gap-3">
            <div className={iconBoxZ}>
              <Users className="size-3.5 sm:size-4" />
            </div>
            <div className="min-w-0 space-y-0.5">
              <h2 className="text-sm font-semibold leading-tight text-foreground sm:text-base">Zümre öğretmenleri</h2>
              <p className="text-[11px] leading-snug text-muted-foreground sm:text-xs">
                Aynı branştaki diğer öğretmenler (siz hariç). Evrakta müdür adı için görev olarak «Okul Müdürü» seçip adı soyadı girin; tutanak ve onay metinlerinde liste kullanılır.
              </p>
            </div>
          </div>
        </div>
        <div className={sectionBody}>
          <div className="rounded-lg border border-dashed border-emerald-500/25 bg-emerald-500/4 p-3 dark:border-emerald-800/40 dark:bg-emerald-950/15 sm:p-4">
            <p className="mb-3 text-[11px] font-medium text-emerald-950/90 dark:text-emerald-100/90 sm:text-xs">Yeni satır ekle</p>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <div className="min-w-0 flex-1 space-y-1">
                <label htmlFor="zumre-adi" className={lblRow}>
                  <span className={iconBoxZ}>
                    <User className="size-3.5" />
                  </span>
                  Adı soyadı
                </label>
                <input
                  id="zumre-adi"
                  type="text"
                  value={zumreDraftName}
                  onChange={(e) => setZumreDraftName(e.target.value)}
                  maxLength={120}
                  placeholder="Adı soyadı"
                  className={fieldIn}
                  autoComplete="off"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      addZumre();
                    }
                  }}
                />
              </div>
              <div className="w-full space-y-1 sm:w-44">
                <label htmlFor="zumre-gorev" className={lblRow}>
                  <span className={iconBoxZ}>
                    <FileText className="size-3.5" />
                  </span>
                  Görev
                </label>
                <select
                  id="zumre-gorev"
                  value={zumreDraftGorev}
                  onChange={(e) => setZumreDraftGorev(e.target.value)}
                  className={cn(fieldIn, 'cursor-pointer')}
                >
                  {GOREV_OPTIONS.map((o) => (
                    <option key={o.value || 'empty'} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
              <Button
                type="button"
                className="h-8 w-full shrink-0 gap-1.5 bg-emerald-600 text-white hover:bg-emerald-700 dark:bg-emerald-600 dark:hover:bg-emerald-500 sm:h-9 sm:w-auto"
                onClick={addZumre}
              >
                <Plus className="size-4" />
                Ekle
              </Button>
            </div>
          </div>

          <div>
            <div className="mb-2 rounded-md border border-emerald-500/20 bg-emerald-500/5 px-2.5 py-2 text-[11px] leading-snug text-emerald-950/90 dark:border-emerald-800/50 dark:bg-emerald-950/25 dark:text-emerald-100/95 sm:text-xs">
              <span className="font-semibold">Evrak müdür adı: </span>
              {mudurEvrak ? (
                <span className="font-medium text-foreground">{mudurEvrak}</span>
              ) : (
                <span className="text-muted-foreground">
                  Henüz yok — listede görevi «Okul Müdürü» olan satır ekleyin.
                </span>
              )}
            </div>
            <h3 className="mb-2 flex items-center gap-2 text-xs font-semibold text-foreground sm:text-sm">
              <Users className="size-3.5 text-emerald-700 dark:text-emerald-400" />
              Kayıtlı liste
            </h3>
            {zumreList.length > 0 ? (
              <div className="table-x-scroll overflow-hidden rounded-lg border border-border/80 bg-muted/5 shadow-inner ring-1 ring-black/5 dark:ring-white/5">
                <table className="w-full text-xs sm:text-sm">
                  <thead>
                    <tr className="border-b border-border/80 bg-linear-to-r from-emerald-500/12 to-transparent dark:from-emerald-950/40">
                      <th className="w-9 px-2 py-2 text-left text-[10px] font-bold uppercase tracking-wide text-muted-foreground sm:w-10 sm:px-3 sm:py-2.5 sm:text-xs">
                        #
                      </th>
                      <th className="px-2 py-2 text-left text-[10px] font-bold uppercase tracking-wide text-muted-foreground sm:px-3 sm:py-2.5 sm:text-xs">
                        Adı soyadı
                      </th>
                      <th className="px-2 py-2 text-left text-[10px] font-bold uppercase tracking-wide text-muted-foreground sm:px-3 sm:py-2.5 sm:text-xs">
                        Görev
                      </th>
                      <th className="w-12 px-2 py-2 text-right sm:w-14 sm:px-3 sm:py-2.5" />
                    </tr>
                  </thead>
                  <tbody>
                    {zumreList.map((item, i) => (
                      <tr
                        key={`zumre-${i}-${item.name.slice(0, 24)}`}
                        className="border-b border-border/50 last:border-0 odd:bg-background/50 even:bg-muted/20 hover:bg-muted/35"
                      >
                        <td className="px-2 py-2 text-muted-foreground sm:px-3 sm:py-2.5">{i + 1}</td>
                        <td className="px-2 py-2 font-medium sm:px-3 sm:py-2.5">{item.name}</td>
                        <td className="px-2 py-2 text-muted-foreground sm:px-3 sm:py-2.5">{item.gorev || '—'}</td>
                        <td className="px-2 py-2 text-right sm:px-3 sm:py-2.5">
                          <button
                            type="button"
                            onClick={() => {
                            setZumreList((prev) => {
                              const next = prev.filter((_, j) => j !== i);
                              void pushEvrakToServer(next, { silent: true }).catch(() => {});
                              return next;
                            });
                          }}
                            className="inline-flex rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-destructive/15 hover:text-destructive"
                            title="Satırı sil"
                            aria-label={`${item.name} satırını sil`}
                          >
                            <X className="size-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border/80 bg-muted/15 py-10">
                <Package className="mb-2 size-10 text-muted-foreground/45 sm:size-11" />
                <p className="px-3 text-center text-xs text-muted-foreground sm:text-sm">Liste boş. Yukarıdan ad ekleyin.</p>
              </div>
            )}
          </div>
        </div>
      </section>

      <div className="flex flex-col gap-2 border-t border-border/60 pt-3 sm:flex-row sm:items-center sm:justify-end sm:pt-4">
        <Button
          type="submit"
          disabled={submitting}
          size="sm"
          className="h-9 w-full gap-2 sm:w-auto sm:min-w-30"
          aria-busy={submitting}
        >
          <Save className="size-4 shrink-0" />
          {submitting ? 'Kaydediliyor…' : 'Kaydet'}
        </Button>
      </div>
    </form>
  );
}
