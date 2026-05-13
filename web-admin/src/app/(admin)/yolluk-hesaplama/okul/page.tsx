'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Archive,
  ArchiveRestore,
  Briefcase,
  Building2,
  Bus,
  Calculator,
  CalendarDays,
  ClipboardList,
  Coins,
  ExternalLink,
  FileDown,
  FileText,
  History,
  Info,
  Landmark,
  MapPin,
  Pencil,
  Plus,
  RefreshCw,
  Route,
  Sparkles,
  Trash2,
  Users,
} from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { apiFetch } from '@/lib/api';
import { toast } from 'sonner';
import { downloadYollukPdf } from '@/lib/yolluk-pdf-download';
import { getDistrictsForCity, TURKEY_CITIES } from '@/lib/turkey-addresses';
import { cn } from '@/lib/utils';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { YollukInfoBody, YollukInfoTrigger } from './yolluk-okul-info';
import { EkGostergeInfoContent, ElleGundelikInfoContent, KadroDerecesiInfoContent } from './yolluk-ic-gundelik-help';
import {
  formatIlceLine,
  hydrateYollukForm,
  mergeYerFromSelectors,
  newBildRow,
  type GeciciBildirimRowState,
} from './hydrate-yolluk-form';
import {
  GECICI_BILDIRIM_META_NOTU,
  GECICI_IC_GUNDELIK_ONCELIK_OKUL,
  GECICI_OZET_MASRAF_ACIKLAMA,
  GECICI_SATIR_ALAN_IPUCU,
  GECICI_YOLLUK_UYARILARI,
  KONAKLAMA_BEYAN_OPTIONS,
  TASIT_CESIT_OPTIONS,
  UNVAN_OPTIONS,
  YEVMIYE_KESIR_UYARISI,
  YEVMIYE_KOD_OPTIONS,
  YEVMIYE_SAAT_ORNEGI_BASLIK,
  YEVMIYE_SAAT_ORNEGI_SATIRLARI,
} from './yolluk-gecici-options';

const ELLE_MARKER = '— Elle yaz';

const SUREKLI_AVANS_PDF_OPTIONS = ['Almamıştır', 'Almıştır'] as const;

function listedOrElle(value: string, opts: readonly string[]): string {
  const t = value.trim();
  if (!t) return '';
  return (opts as readonly string[]).includes(t) ? t : ELLE_MARKER;
}

function yollukKindLabelTr(k: string): string {
  if (k === 'gecici') return 'Geçici görev';
  if (k === 'surekli') return 'Sürekli / yer değiştirme';
  if (k === 'denetim') return 'Denetim';
  return k;
}

function yollukKindBadgeClass(k: string): string {
  if (k === 'gecici') return 'border border-sky-500/35 bg-sky-500/12 text-sky-950 dark:text-sky-100';
  if (k === 'surekli') return 'border border-violet-500/35 bg-violet-500/12 text-violet-950 dark:text-violet-100';
  if (k === 'denetim') return 'border border-amber-500/40 bg-amber-500/12 text-amber-950 dark:text-amber-100';
  return 'border border-border bg-muted text-foreground';
}

function yollukKindRowAccent(k: string): string {
  if (k === 'gecici') return 'border-l-sky-500 bg-sky-500/[0.04] dark:bg-sky-500/10';
  if (k === 'surekli') return 'border-l-violet-500 bg-violet-500/[0.04] dark:bg-violet-500/10';
  if (k === 'denetim') return 'border-l-amber-500 bg-amber-500/[0.05] dark:bg-amber-500/10';
  return 'border-l-muted bg-muted/20';
}

function statusLabelTr(s: string): string {
  if (s === 'final') return 'Kesin';
  if (s === 'draft') return 'Taslak';
  return s;
}

function formatCalcListDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString('tr-TR', {
      timeZone: 'Europe/Istanbul',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

function fiscalYearFromRulesSnapshot(rs: Record<string, unknown> | undefined): number | null {
  if (!rs) return null;
  const fy = rs.fiscal_year;
  if (typeof fy === 'number' && Number.isFinite(fy)) return fy;
  if (typeof fy === 'string') {
    const n = parseInt(fy, 10);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

type Teacher = { id: string; display_name: string | null };

type YollukContextRes = {
  school: {
    id: string;
    name: string;
    city: string | null;
    district: string | null;
    principal_name: string | null;
    yolluk_school_template: {
      dairesi: string;
      birim_yetkilisi_unvan: string;
      gorev_yeri: string;
    };
  } | null;
  teacher: {
    id: string;
    display_name: string | null;
    teacher_title: string | null;
    teacher_branch: string | null;
    evrak_defaults: Record<string, unknown> | null;
  } | null;
};
type Calc = {
  id: string;
  teacher_user_id: string;
  kind: string;
  status: string;
  title: string | null;
  result: {
    total_tl?: number;
    effective_daily_tl?: number;
    lines?: { key: string; label: string; amount_tl: number }[];
    gecici_bildirim?: {
      rows: {
        gundelik_tutar_tl: number;
        satir_toplam_tl: number;
        yevmiye_metin: string;
        tasit_ucret_tl?: number;
        doviz_cinsi_tl?: number;
      }[];
      toplam_gundelik_tl: number;
      toplam_tasit_tl: number;
      gorev_yeri?: string;
      konaklama_beyan?: string;
    };
    surekli_pdf?: {
      rows: {
        key?: string;
        label: string;
        gun_sayisi: number;
        tutar_tl: number;
        rayic_tl: number;
        sabit_tl: number;
        mesafe_km: number;
        degisken_tl: number;
        satir_toplam_tl: number;
      }[];
    };
  };
  created_at: string;
  archived_at: string | null;
  inputs?: Record<string, unknown>;
  rules_snapshot?: Record<string, unknown>;
};

function teacherDisplayName(teachers: Teacher[], teacherUserId: string): string {
  const t = teachers.find((x) => x.id === teacherUserId);
  const n = t?.display_name?.trim();
  return n && n.length > 0 ? n : 'Öğretmen';
}

function calcListLines(c: Calc, teachers: Teacher[]): { primary: string; subtitle: string } {
  const name = teacherDisplayName(teachers, c.teacher_user_id);
  const fy = fiscalYearFromRulesSnapshot(c.rules_snapshot as Record<string, unknown> | undefined);
  const auto = `${name} · ${yollukKindLabelTr(c.kind)}${fy != null ? ` · ${fy}` : ''}`;
  const custom = c.title?.trim();
  if (!custom) return { primary: auto, subtitle: '' };
  return { primary: custom, subtitle: auto };
}

type EkBand = 'g8000_ust' | 'g6400_8000' | 'g3600_6400' | 'alt3600';

type ActiveSettings = {
  default_daily_tl: string;
  derece_daily_tl: Record<string, string>;
  ek_gosterge_daily_tl?: Record<string, string>;
};

const EK_OPTIONS: { value: EkBand; label: string }[] = [
  { value: 'g8000_ust', label: '8000 ve daha üstü' },
  { value: 'g6400_8000', label: '6400 (dahil) – 8000 (hariç)' },
  { value: 'g3600_6400', label: '3600 (dahil) – 6400 (hariç)' },
  { value: 'alt3600', label: '3600 altı' },
];

const KGM_UZAKLIK = 'https://www.kgm.gov.tr/Sayfalar/KGM/SiteTr/Root/Uzakliklar.aspx';

export default function YollukOkulPage() {
  const router = useRouter();
  const { me } = useAuth();
  const can = me?.role === 'school_admin' || me?.role === 'superadmin';
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [list, setList] = useState<Calc[]>([]);
  const [tid, setTid] = useState('');
  const [kind, setKind] = useState<'gecici' | 'surekli'>('gecici');
  const [missionDays, setMissionDays] = useState(1);
  const [yol, setYol] = useState(0);
  const [kon, setKon] = useState(0);
  const [diger, setDiger] = useState(0);
  const [tasitG, setTasitG] = useState(0);
  const [taksiG, setTaksiG] = useState(0);
  const [km, setKm] = useState(0);
  const [aile, setAile] = useState(0);
  const [derece, setDerece] = useState<number | ''>('');
  const [gundelikElle, setGundelikElle] = useState(0);
  const [ekBand, setEkBand] = useState<EkBand | ''>('');
  const [ydm, setYdm] = useState<'tam' | 'yarim'>('tam');
  const [tasitS, setTasitS] = useState(0);
  const [eskiIl, setEskiIl] = useState('');
  const [eskiIlce, setEskiIlce] = useState('');
  const [yeniIl, setYeniIl] = useState('');
  const [yeniIlce, setYeniIlce] = useState('');
  const [rayicS, setRayicS] = useState(0);
  const [surSatirliAile, setSurSatirliAile] = useState(false);
  const [surEs, setSurEs] = useState(false);
  const [surCocuk, setSurCocuk] = useState(0);
  const [surAtama, setSurAtama] = useState('');
  const [surPdfTarih, setSurPdfTarih] = useState('');
  const [surAvans, setSurAvans] = useState('');
  const [surEkHucre, setSurEkHucre] = useState('');
  const [surEsAd, setSurEsAd] = useState('');
  const [surCocukAdMetni, setSurCocukAdMetni] = useState('');
  const [settings, setSettings] = useState<ActiveSettings | null>(null);
  const [title, setTitle] = useState('');
  const [preview, setPreview] = useState<{ result: Calc['result'] } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [pdfBusy, setPdfBusy] = useState<string | null>(null);
  const [fiscalYear, setFiscalYear] = useState<number | null>(null);
  const [yearChoices, setYearChoices] = useState<number[]>([]);
  const [activeHelp, setActiveHelp] = useState<string | null>(null);
  const [yevmiyeBilgiRowId, setYevmiyeBilgiRowId] = useState<string | null>(null);
  const [bildRows, setBildRows] = useState<GeciciBildirimRowState[]>([newBildRow()]);
  const [bildKapsam, setBildKapsam] = useState<'yurtici' | 'yurtdisi'>('yurtici');
  const [bildAd, setBildAd] = useState('');
  const [bildUnvan, setBildUnvan] = useState('');
  const [bildTc, setBildTc] = useState('');
  const [bildDaire, setBildDaire] = useState('');
  const [bildMudurUnvan, setBildMudurUnvan] = useState('');
  const [bildGorevYeri, setBildGorevYeri] = useState('');
  const [bildKonaklamaBeyan, setBildKonaklamaBeyan] = useState<'hayir' | 'evet'>('hayir');
  const [bildPdfDuzenleme, setBildPdfDuzenleme] = useState('');
  const [bildIban, setBildIban] = useState('');
  const [bildKademe, setBildKademe] = useState('');
  const [profBusy, setProfBusy] = useState(false);
  const [schoolIdSa, setSchoolIdSa] = useState('');
  const [archiveTab, setArchiveTab] = useState<'active' | 'archived'>('active');
  const [editingId, setEditingId] = useState<string | null>(null);
  const saveDraftInFlight = useRef(false);
  /** Düzenlenen taslağın sahibi öğretmen; başka öğretmen seçilince form sıfırlanır. */
  const draftOwnerTidRef = useRef<string | null>(null);
  /** `applyYollukContext` ile `startEdit` hydrate yarışmasın (gecici bildirim üst alanları silinmesin). */
  const yollukTeacherCtxGenRef = useRef(0);

  const resetFormToDefaults = useCallback(() => {
    yollukTeacherCtxGenRef.current += 1;
    setMissionDays(1);
    setYol(0);
    setKon(0);
    setDiger(0);
    setTasitG(0);
    setTaksiG(0);
    setKm(0);
    setAile(0);
    setDerece('');
    setGundelikElle(0);
    setEkBand('');
    setYdm('tam');
    setTasitS(0);
    setEskiIl('');
    setEskiIlce('');
    setYeniIl('');
    setYeniIlce('');
    setRayicS(0);
    setSurSatirliAile(false);
    setSurEs(false);
    setSurCocuk(0);
    setSurAtama('');
    setSurPdfTarih('');
    setSurAvans('');
    setSurEkHucre('');
    setSurEsAd('');
    setSurCocukAdMetni('');
    setTitle('');
    setPreview(null);
    setYevmiyeBilgiRowId(null);
    setBildRows([newBildRow()]);
    setBildKapsam('yurtici');
    setBildAd('');
    setBildUnvan('');
    setBildTc('');
    setBildDaire('');
    setBildMudurUnvan('');
    setBildGorevYeri('');
    setBildKonaklamaBeyan('hayir');
    setBildPdfDuzenleme('');
    setBildIban('');
    setBildKademe('');
  }, []);

  const toggleHelp = (key: string) => setActiveHelp((h) => (h === key ? null : key));

  const applySchoolBildTemplate = useCallback((sch: NonNullable<YollukContextRes['school']>) => {
    const t = sch.yolluk_school_template;
    if (!t) return;
    setBildDaire(t.dairesi);
    setBildMudurUnvan(t.birim_yetkilisi_unvan);
    setBildGorevYeri(t.gorev_yeri);
  }, []);

  const applyYollukContext = useCallback(
    async (teacherId: string) => {
      if (!teacherId) return;
      const genAtStart = yollukTeacherCtxGenRef.current;
      const sid = me?.role === 'superadmin' ? schoolIdSa.trim() : me?.school_id ?? '';
      if (me?.role === 'superadmin' && !sid) return;
      try {
        const qs = new URLSearchParams({ teacher_user_id: teacherId });
        if (me?.role === 'superadmin') qs.set('school_id', sid);
        const ctx = await apiFetch<YollukContextRes>(`/yolluk/context?${qs.toString()}`);
        if (yollukTeacherCtxGenRef.current !== genAtStart) return;
        const t = ctx.teacher;
        if (!t) return;
        const ev = (t.evrak_defaults ?? {}) as Record<string, unknown>;
        const ytRaw =
          (ev.yolluk_teacher && typeof ev.yolluk_teacher === 'object' && !Array.isArray(ev.yolluk_teacher)
            ? ev.yolluk_teacher
            : null) ??
          (typeof ev['yollukTeacher'] === 'object' && ev['yollukTeacher'] !== null && !Array.isArray(ev['yollukTeacher'])
            ? ev['yollukTeacher']
            : null);
        const yt = (ytRaw ?? {}) as Record<string, unknown>;
        setBildAd(typeof t.display_name === 'string' ? t.display_name.trim() : '');
        const pdfU = typeof yt.pdf_unvan === 'string' ? yt.pdf_unvan.trim() : '';
        const ou = typeof ev.ogretmen_unvani === 'string' ? ev.ogretmen_unvani.trim() : '';
        const tt = typeof t.teacher_title === 'string' ? t.teacher_title.trim() : '';
        setBildUnvan(pdfU || tt || ou);
        setBildTc(typeof yt.tc_kimlik === 'string' ? String(yt.tc_kimlik).replace(/\D/g, '').slice(0, 11) : '');
        setBildIban(typeof yt.iban === 'string' ? String(yt.iban).replace(/\s/g, '').toUpperCase() : '');
        const kd = yt.kadro_derecesi;
        const dn = typeof kd === 'number' ? kd : typeof kd === 'string' ? parseInt(String(kd).trim(), 10) : NaN;
        if (Number.isFinite(dn) && dn >= 1 && dn <= 15) setDerece(dn);
        setBildKademe(typeof yt.kadro_kademesi === 'string' ? yt.kadro_kademesi : '');
        if (ctx.school) applySchoolBildTemplate(ctx.school);
      } catch {
        /* profil/okul yoksa form elle doldurulur */
      }
    },
    [me?.role, me?.school_id, schoolIdSa, applySchoolBildTemplate],
  );

  async function doSaveYollukTeacherProfile() {
    if (!tid) {
      setErr('Öğretmen seçin.');
      toast.error('Öğretmen seçin.');
      return;
    }
    setErr(null);
    setProfBusy(true);
    try {
      const ib = bildIban.replace(/\s/g, '').toUpperCase();
      const body: Record<string, unknown> = {
        tc_kimlik: bildTc.replace(/\D/g, '').slice(0, 11) || undefined,
        iban: ib || undefined,
        kadro_derecesi: derece === '' ? undefined : derece,
        kadro_kademesi: bildKademe.trim() || undefined,
        pdf_unvan: bildUnvan.trim() || undefined,
      };
      for (const k of Object.keys(body)) {
        if (body[k] === undefined) delete body[k];
      }
      const res = await apiFetch<{ ok?: boolean; yolluk_teacher?: Record<string, unknown> }>(
        `/yolluk/teachers/${encodeURIComponent(tid)}/yolluk-profile`,
        { method: 'PATCH', body: JSON.stringify(body) },
      );
      const yt = res.yolluk_teacher;
      if (yt && typeof yt === 'object') {
        if (typeof yt.iban === 'string') setBildIban(String(yt.iban).replace(/\s/g, '').toUpperCase());
        const kd = yt.kadro_derecesi;
        const dn = typeof kd === 'number' ? kd : typeof kd === 'string' ? parseInt(String(kd).trim(), 10) : NaN;
        if (Number.isFinite(dn) && dn >= 1 && dn <= 15) setDerece(dn);
        if (typeof yt.kadro_kademesi === 'string') setBildKademe(yt.kadro_kademesi);
        if (typeof yt.tc_kimlik === 'string') setBildTc(String(yt.tc_kimlik).replace(/\D/g, '').slice(0, 11));
      }
      toast.success('Yolluk profili kaydedildi', { description: 'IBAN, kadro ve PDF ünvanı güncellendi.' });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setErr(msg);
      toast.error('Profil kaydedilemedi', { description: msg });
    } finally {
      setProfBusy(false);
    }
  }

  const bildirimPayload = useMemo(() => {
    if (kind !== 'gecici') return undefined;
    const rows = bildRows
      .map((r) => {
        const kod = Number.parseInt(r.yevmiye_kod, 10) as 1 | 2 | 3 | 4;
        const yer = mergeYerFromSelectors(r);
        return {
          tarih: r.tarih.trim() || undefined,
          yer,
          gidis_saat: r.gidis_saat.trim() || undefined,
          donus_saat: r.donus_saat.trim() || undefined,
          gun_sayisi: r.gun_sayisi,
          yevmiye_kodu: kod,
          tasit_tip: r.tasit_tip.trim() || undefined,
          tasit_ucret_tl: r.tasit_ucret_tl,
          doviz_cinsi_tl: r.doviz_cinsi_tl,
          ...(r.yer_from_il.trim() ? { yer_from_il: r.yer_from_il.trim() } : {}),
          ...(r.yer_from_ilce.trim() ? { yer_from_ilce: r.yer_from_ilce.trim() } : {}),
          ...(r.yer_to_il.trim() ? { yer_to_il: r.yer_to_il.trim() } : {}),
          ...(r.yer_to_ilce.trim() ? { yer_to_ilce: r.yer_to_ilce.trim() } : {}),
        };
      })
      .filter((r) => r.gun_sayisi > 0);
    const ibNorm = bildIban.replace(/\s/g, '').toUpperCase();
    const hasHeader =
      !!bildAd.trim() ||
      !!bildUnvan.trim() ||
      !!bildTc.trim() ||
      !!ibNorm ||
      !!bildKademe.trim() ||
      !!bildDaire.trim() ||
      !!bildMudurUnvan.trim() ||
      !!bildGorevYeri.trim() ||
      bildKonaklamaBeyan === 'evet' ||
      !!bildPdfDuzenleme.trim();
    if (rows.length === 0 && !hasHeader) return undefined;
    return {
      kapsam: bildKapsam,
      ad_soyad: bildAd.trim() || undefined,
      unvan: bildUnvan.trim() || undefined,
      tc_kimlik: bildTc.trim() || undefined,
      ...(ibNorm ? { iban: ibNorm.slice(0, 34) } : {}),
      ...(bildKademe.trim() ? { kadro_kademesi: bildKademe.trim() } : {}),
      dairesi: bildDaire.trim() || undefined,
      birim_yetkilisi_unvan: bildMudurUnvan.trim() || undefined,
      gorev_yeri: bildGorevYeri.trim() || undefined,
      konaklama_beyan: bildKonaklamaBeyan,
      ...(bildPdfDuzenleme.trim() ? { pdf_duzenleme_tarihi: bildPdfDuzenleme.trim() } : {}),
      rows,
    };
  }, [
    kind,
    bildRows,
    bildKapsam,
    bildAd,
    bildUnvan,
    bildTc,
    bildKademe,
    bildDaire,
    bildMudurUnvan,
    bildGorevYeri,
    bildKonaklamaBeyan,
    bildIban,
    bildPdfDuzenleme,
  ]);

  const bildirimTarihSecenekleri = useMemo(() => {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const r of bildRows) {
      const t = (r.tarih ?? '').trim();
      if (t && !seen.has(t)) {
        seen.add(t);
        out.push(t);
      }
    }
    return out;
  }, [bildRows]);

  const input = useMemo(() => {
    const d = derece === '' ? undefined : derece;
    const gEl = gundelikElle > 0 ? gundelikElle : undefined;
    const ek = ekBand === '' ? {} : { ek_gosterge_band: ekBand };
    if (kind === 'gecici') {
      return {
        kind: 'gecici' as const,
        mission_days: bildirimPayload?.rows?.length ? 0 : missionDays,
        yol_masrafi_tl: yol,
        konaklama_tl: kon,
        diger_tl: diger,
        tasit_ucreti_tl: tasitG,
        taksi_tl: taksiG,
        ...(d !== undefined ? { derece: d } : {}),
        ...(gEl !== undefined ? { gundelik_tl_override: gEl } : {}),
        ...ek,
        ...(bildirimPayload ? { bildirim: bildirimPayload } : {}),
      };
    }
    const cocNames = surCocukAdMetni
      .split(/\r?\n/)
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 5);
    const meta: Record<string, unknown> = {};
    if (surAtama.trim()) meta.atama_tarihi = surAtama.trim();
    if (surPdfTarih.trim()) meta.pdf_duzenleme_tarihi = surPdfTarih.trim();
    if (surAvans.trim()) meta.avans_durumu = surAvans.trim();
    if (surEkHucre.trim()) meta.ek_gosterge_hucresi = surEkHucre.trim();
    if (bildKademe.trim()) meta.kadro_kademesi = bildKademe.trim();
    if (surEsAd.trim()) meta.es_ad_soyad = surEsAd.trim();
    if (cocNames.length) meta.cocuk_adlari = cocNames;
    const hasMeta = Object.keys(meta).length > 0;
    const aileN = surSatirliAile ? (surEs ? 1 : 0) + surCocuk : aile;
    const eskiStr = formatIlceLine(eskiIl, eskiIlce).trim();
    const yeniStr = formatIlceLine(yeniIl, yeniIlce).trim();
    return {
      kind: 'surekli' as const,
      mesafe_km: km,
      aile_ferdi_sayisi: aileN,
      ydm_km_mode: ydm,
      tasit_ucreti_tl: tasitS,
      ...(d !== undefined ? { derece: d } : {}),
      ...(gEl !== undefined ? { gundelik_tl_override: gEl } : {}),
      ...ek,
      ...(eskiStr ? { eski_mahal: eskiStr } : {}),
      ...(yeniStr ? { yeni_mahal: yeniStr } : {}),
      ...(rayicS > 0 ? { rayic_ucreti_tl: rayicS } : {}),
      ...(surSatirliAile ? { es_dahil: surEs, cocuk_dahil_adet: surCocuk } : {}),
      ...(hasMeta ? { bildirim_meta: meta } : {}),
    };
  }, [
    kind,
    missionDays,
    yol,
    kon,
    diger,
    tasitG,
    taksiG,
    km,
    aile,
    derece,
    gundelikElle,
    ekBand,
    ydm,
    tasitS,
    eskiIl,
    eskiIlce,
    yeniIl,
    yeniIlce,
    rayicS,
    surSatirliAile,
    surEs,
    surCocuk,
    surAtama,
    surPdfTarih,
    surAvans,
    surEkHucre,
    surEsAd,
    surCocukAdMetni,
    bildKademe,
    bildirimPayload,
  ]);

  const loadList = useCallback(async () => {
    if (me?.role === 'superadmin' && !schoolIdSa.trim()) {
      setList([]);
      return;
    }
    const qs = new URLSearchParams();
    qs.set('archived', archiveTab === 'archived' ? 'archived' : 'active');
    if (me?.role === 'superadmin' && schoolIdSa.trim()) qs.set('school_id', schoolIdSa.trim());
    const rows = await apiFetch<Calc[]>(`/yolluk/calculations?${qs.toString()}`);
    setList(rows);
  }, [me?.role, schoolIdSa, archiveTab]);

  useEffect(() => {
    if (!can) {
      router.replace('/403');
      return;
    }
    if (me?.role === 'superadmin' && !schoolIdSa.trim()) return;
    (async () => {
      try {
        const yd = await apiFetch<{ years: number[]; suggested_fiscal_year: number }>('/yolluk/settings/years');
        setYearChoices(yd.years ?? []);
        setFiscalYear(yd.suggested_fiscal_year ?? new Date().getFullYear());
        if (me?.role === 'school_admin') {
          const t = await apiFetch<Teacher[]>('/duty/teachers?teacher_only=true');
          setTeachers(t);
        } else if (me?.role === 'superadmin' && schoolIdSa.trim()) {
          const t = await apiFetch<Teacher[]>(
            `/duty/teachers?school_id=${encodeURIComponent(schoolIdSa.trim())}&teacher_only=true`,
          );
          setTeachers(t);
        }
        try {
          const st = await apiFetch<ActiveSettings>('/yolluk/settings/active');
          setSettings(st);
        } catch {
          setSettings(null);
        }
        await loadList();
      } catch (e) {
        setErr(e instanceof Error ? e.message : String(e));
      }
    })();
  }, [can, me?.role, router, loadList, schoolIdSa, archiveTab]);

  useEffect(() => {
    if ((kind !== 'gecici' && kind !== 'surekli') || !tid || editingId) return;
    void applyYollukContext(tid);
  }, [kind, tid, editingId, applyYollukContext]);

  useEffect(() => {
    if (kind !== 'gecici' || editingId || tid) return;
    const sid = me?.role === 'superadmin' ? schoolIdSa.trim() : me?.school_id ?? '';
    if (!sid) return;
    (async () => {
      try {
        const qs = new URLSearchParams();
        if (me?.role === 'superadmin') qs.set('school_id', sid);
        const ctx = await apiFetch<YollukContextRes>(`/yolluk/context?${qs.toString()}`);
        if (ctx.school) applySchoolBildTemplate(ctx.school);
      } catch {
        /* okul yok */
      }
    })();
  }, [kind, editingId, tid, me?.role, me?.school_id, schoolIdSa, applySchoolBildTemplate]);

  if (!can) return null;

  async function doPreview() {
    if (fiscalYear == null) return;
    setErr(null);
    setBusy(true);
    try {
      const out = await apiFetch<{ result: Calc['result'] }>('/yolluk/calculations/preview', {
        method: 'POST',
        body: JSON.stringify({ fiscal_year: fiscalYear, input }),
      });
      setPreview(out);
      toast.success('Hesaplama önizlemesi hazır', { description: 'Sonuç özeti aşağıda güncellendi.' });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setErr(msg);
      toast.error('Önizleme alınamadı', { description: msg });
    } finally {
      setBusy(false);
    }
  }

  async function doSaveDraft() {
    if (!tid) {
      setErr('Öğretmen seçin.');
      toast.error('Öğretmen seçin.');
      return;
    }
    if (fiscalYear == null) {
      setErr('Mali yıl seçin.');
      toast.error('Mali yıl seçin.');
      return;
    }
    if (saveDraftInFlight.current) return;
    saveDraftInFlight.current = true;
    const nm = teachers.find((t) => t.id === tid)?.display_name?.trim() || bildAd.trim() || 'Öğretmen';
    const autoTitle = `${nm} · ${yollukKindLabelTr(kind)} · ${fiscalYear}`;
    const titleForApi = (title.trim() || autoTitle).trim() || null;
    setErr(null);
    setBusy(true);
    const wasUpdate = Boolean(editingId);
    try {
      if (editingId) {
        await apiFetch(`/yolluk/calculations/${editingId}`, {
          method: 'PATCH',
          body: JSON.stringify({ input, title: titleForApi }),
        });
      } else {
        const created = await apiFetch<Calc>('/yolluk/calculations', {
          method: 'POST',
          body: JSON.stringify({
            teacher_user_id: tid,
            fiscal_year: fiscalYear,
            input,
            title: titleForApi,
            ...(me?.role === 'superadmin' && schoolIdSa.trim() ? { school_id: schoolIdSa.trim() } : {}),
          }),
        });
        setEditingId(created.id);
        if (!title.trim()) setTitle(created.title?.trim() || autoTitle);
      }
      try {
        const pv = await apiFetch<{ result: Calc['result'] }>('/yolluk/calculations/preview', {
          method: 'POST',
          body: JSON.stringify({ fiscal_year: fiscalYear, input }),
        });
        setPreview(pv);
      } catch {
        setPreview(null);
        toast.warning('Kayıt tamam; önizleme yenilenemedi', { description: 'Listeyi kontrol edin veya Hesapla ile tekrar deneyin.' });
      }
      await loadList();
      toast.success(wasUpdate ? 'Hesaplama güncellendi' : 'Taslak kaydedildi', {
        description: wasUpdate ? 'Değişiklikler sunucuya yazıldı.' : 'Yeni kayıt oluşturuldu; düzenlemeye devam edebilirsiniz.',
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setErr(msg);
      toast.error(wasUpdate ? 'Güncelleme başarısız' : 'Kayıt başarısız', { description: msg });
    } finally {
      saveDraftInFlight.current = false;
      setBusy(false);
    }
  }

  async function startEdit(id: string) {
    yollukTeacherCtxGenRef.current += 1;
    setErr(null);
    setBusy(true);
    try {
      const c = await apiFetch<Calc>(`/yolluk/calculations/${id}`);
      if (c.kind === 'denetim') {
        toast.error('Denetim yolluğu kaldırıldı', { description: 'Bu kayıt bu ekrandan açılamıyor.' });
        return;
      }
      const ins = c.inputs;
      const rs = c.rules_snapshot;
      if (!ins || !rs) {
        setErr('Kayıt verisi okunamadı.');
        toast.error('Kayıt verisi okunamadı.');
        return;
      }
      const h = hydrateYollukForm(ins, rs, c.teacher_user_id, c.title);
      setTid(h.tid);
      setKind(h.kind === 'surekli' ? 'surekli' : 'gecici');
      if (h.fiscalYear != null) setFiscalYear(h.fiscalYear);
      setTitle(h.title);
      setMissionDays(h.missionDays);
      setYol(h.yol);
      setKon(h.kon);
      setDiger(h.diger);
      setTasitG(h.tasitG);
      setTaksiG(h.taksiG);
      setKm(h.km);
      setAile(h.aile);
      setDerece(h.derece);
      setGundelikElle(h.gundelikElle);
      setEkBand(h.ekBand);
      setYdm(h.ydm);
      setTasitS(h.tasitS);
      setEskiIl(h.eskiIl);
      setEskiIlce(h.eskiIlce);
      setYeniIl(h.yeniIl);
      setYeniIlce(h.yeniIlce);
      setRayicS(h.rayicS);
      setSurSatirliAile(h.surSatirliAile);
      setSurEs(h.surEs);
      setSurCocuk(h.surCocuk);
      setSurAtama(h.surAtama);
      setSurPdfTarih(h.surPdfTarih);
      setSurAvans(h.surAvans);
      setSurEkHucre(h.surEkHucre);
      setSurEsAd(h.surEsAd);
      setSurCocukAdMetni(h.surCocukAdMetni);
      setBildRows(h.bildRows);
      setBildKapsam(h.bildKapsam);
      setBildAd(h.bildAd);
      setBildUnvan(h.bildUnvan);
      setBildTc(h.bildTc);
      setBildIban(h.bildIban);
      setBildDaire(h.bildDaire);
      setBildMudurUnvan(h.bildMudurUnvan);
      setBildGorevYeri(h.bildGorevYeri);
      setBildKonaklamaBeyan(h.bildKonaklamaBeyan);
      setBildPdfDuzenleme(h.bildPdfDuzenleme);
      setBildKademe(h.bildKademe);

      if (c.teacher_user_id) {
        const sidSa = me?.role === 'superadmin' ? schoolIdSa.trim() : me?.school_id ?? '';
        if (me?.role === 'school_admin' || (me?.role === 'superadmin' && sidSa)) {
          try {
            const qs = new URLSearchParams({ teacher_user_id: c.teacher_user_id });
            if (me?.role === 'superadmin') qs.set('school_id', sidSa);
            const ctx = await apiFetch<YollukContextRes>(`/yolluk/context?${qs.toString()}`);
            const t = ctx.teacher;
            if (t) {
              const ev = (t.evrak_defaults ?? {}) as Record<string, unknown>;
              const ytRaw =
                (ev.yolluk_teacher && typeof ev.yolluk_teacher === 'object' && !Array.isArray(ev.yolluk_teacher)
                  ? ev.yolluk_teacher
                  : null) ??
                (typeof ev['yollukTeacher'] === 'object' && ev['yollukTeacher'] !== null && !Array.isArray(ev['yollukTeacher'])
                  ? ev['yollukTeacher']
                  : null);
              const yt = (ytRaw ?? {}) as Record<string, unknown>;
              const ibPr = typeof yt.iban === 'string' ? String(yt.iban).replace(/\s/g, '').toUpperCase() : '';
              if (!h.bildIban.trim() && ibPr) setBildIban(ibPr);
              const kd = yt.kadro_derecesi;
              const dn = typeof kd === 'number' ? kd : typeof kd === 'string' ? parseInt(String(kd).trim(), 10) : NaN;
              if (h.derece === '' && Number.isFinite(dn) && dn >= 1 && dn <= 15) setDerece(dn);
              const km = typeof yt.kadro_kademesi === 'string' ? yt.kadro_kademesi.trim() : '';
              if (km && !h.bildKademe.trim()) setBildKademe(km);
            }
          } catch {
            /* profil yok */
          }
        }
      }

      draftOwnerTidRef.current = (h.tid || c.teacher_user_id || '').trim() || null;
      setEditingId(id);
      setPreview(null);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setErr(msg);
      toast.error('Kayıt açılamadı', { description: msg });
    } finally {
      setBusy(false);
    }
  }

  async function doArchive(id: string) {
    setBusy(true);
    setErr(null);
    try {
      await apiFetch(`/yolluk/calculations/${id}/archive`, { method: 'POST' });
      if (editingId === id) {
        setEditingId(null);
        draftOwnerTidRef.current = null;
      }
      await loadList();
      toast.success('Kayıt arşivlendi', { description: 'Arşiv sekmesinden erişilebilir.' });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setErr(msg);
      toast.error('Arşivleme başarısız', { description: msg });
    } finally {
      setBusy(false);
    }
  }

  async function doUnarchive(id: string) {
    setBusy(true);
    setErr(null);
    try {
      await apiFetch(`/yolluk/calculations/${id}/unarchive`, { method: 'POST' });
      await loadList();
      toast.success('Kayıt arşivden çıkarıldı', { description: 'Aktif listeye alındı.' });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setErr(msg);
      toast.error('Arşivden çıkarma başarısız', { description: msg });
    } finally {
      setBusy(false);
    }
  }

  async function doDelete(id: string) {
    if (!globalThis.confirm('Bu yolluk kaydını kalıcı olarak silmek istiyor musunuz?')) return;
    setBusy(true);
    setErr(null);
    try {
      await apiFetch(`/yolluk/calculations/${id}`, { method: 'DELETE' });
      if (editingId === id) {
        setEditingId(null);
        draftOwnerTidRef.current = null;
      }
      await loadList();
      toast.success('Kayıt silindi');
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setErr(msg);
      toast.error('Silinemedi', { description: msg });
    } finally {
      setBusy(false);
    }
  }

  async function doFinalize(id: string) {
    setBusy(true);
    setErr(null);
    try {
      await apiFetch(`/yolluk/calculations/${id}/finalize`, { method: 'POST' });
      if (editingId === id) {
        setEditingId(null);
        draftOwnerTidRef.current = null;
      }
      await loadList();
      toast.success('Hesaplama kesinleştirildi', { description: 'Öğretmen tarafında özet olarak görünür.' });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setErr(msg);
      toast.error('Kesinleştirme başarısız', { description: msg });
    } finally {
      setBusy(false);
    }
  }

  const inputBase = 'border-input bg-background h-9 w-full rounded-lg border px-2.5 text-sm shadow-sm';

  return (
    <div className="mx-auto max-w-4xl space-y-4 px-3 pb-8 sm:space-y-5 sm:px-4">
      {/* Üst başlık */}
      <div className="from-primary/12 via-violet-500/10 to-amber-500/8 relative overflow-hidden rounded-2xl border border-violet-500/20 bg-linear-to-br p-4 shadow-sm sm:p-5">
        <div className="absolute -right-6 -top-6 size-28 rounded-full bg-violet-400/20 blur-2xl" aria-hidden />
        <div className="absolute -bottom-8 -left-4 size-24 rounded-full bg-sky-400/15 blur-2xl" aria-hidden />
        <div className="relative flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex gap-3">
            <div className="bg-background/80 flex size-11 shrink-0 items-center justify-center rounded-xl border border-violet-500/30 shadow-sm sm:size-12">
              <Calculator className="text-violet-600 size-6 sm:size-7" aria-hidden />
            </div>
            <div className="min-w-0">
              <h1 className="text-lg font-bold tracking-tight sm:text-xl">Yurt içi yolluk</h1>
              <p className="text-muted-foreground mt-0.5 text-xs leading-snug sm:text-sm">
                Okul için özet hesap. Kesin ödeme ve haklar için mali işler / mevzuat esas alınır.
              </p>
            </div>
          </div>
          <Button variant="secondary" size="sm" className="shrink-0 gap-1.5 shadow-sm" asChild>
            <a href="/yolluk-hesaplama/rapor">
              <FileText className="size-4" />
              PDF raporlar
            </a>
          </Button>
        </div>
      </div>

      {/* Uyarı / bilgi */}
      <div className="space-y-2.5">
        {err && <Alert variant="error" message={err} />}
        {me?.role === 'superadmin' && !schoolIdSa.trim() && (
          <Alert variant="warning" message="Öğretmen listesi ve kayıtlar için okul UUID girin; ardından «Uygula» ile yenileyin." />
        )}
        {!settings && !err && (
          <Alert
            variant="warning"
            message={
              me?.role === 'superadmin'
                ? 'Aktif yolluk parametreleri yüklenemedi. «Yolluk parametreleri» sayfasından mali yıl ve cetveli tanımlayın.'
                : 'Bu okul ve seçilen mali yıl için yolluk tablosu şu an yüklenemedi. Lütfen daha sonra deneyin veya kurum destek / mali işler birimi ile görüşün.'
            }
          />
        )}
      </div>

      {me?.role === 'superadmin' && (
        <Card className="overflow-hidden border-amber-500/25 shadow-sm">
          <CardHeader className="border-b bg-amber-500/5 py-3 sm:py-3.5">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold sm:text-base">
              <Building2 className="text-amber-600 size-5 shrink-0" />
              Süper yönetici — okul bağlamı
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap items-end gap-2 p-3 sm:p-4">
            <div className="min-w-[min(100%,220px)] flex-1 space-y-1">
              <Label className="text-xs">Okul UUID</Label>
              <Input className="h-9 font-mono text-xs" value={schoolIdSa} onChange={(e) => setSchoolIdSa(e.target.value)} placeholder="schools.id" />
            </div>
            <Button type="button" variant="secondary" size="sm" className="h-9 gap-1" onClick={() => window.location.reload()}>
              <RefreshCw className="size-4" />
              Uygula
            </Button>
          </CardContent>
        </Card>
      )}

      <Card className="overflow-visible border-sky-500/20 shadow-md">
        <CardHeader className="from-sky-500/8 to-violet-500/6 border-b bg-linear-to-r py-3 sm:py-4">
          <CardTitle className="flex items-center gap-2 text-sm font-semibold sm:text-base">
            <ClipboardList className="text-sky-600 size-5" />
            Bilgi girişi
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 overflow-visible p-3 sm:gap-4 sm:p-4">
          {editingId && (
            <Alert variant="info" className="flex flex-wrap items-center justify-between gap-2 py-2 text-xs">
              <span>
                Düzenleme: <code className="font-mono text-[11px]">{editingId.slice(0, 8)}…</code>
              </span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8"
                onClick={() => {
                  draftOwnerTidRef.current = null;
                  setEditingId(null);
                }}
              >
                Düzenlemeyi kapat
              </Button>
            </Alert>
          )}
          {(me?.role === 'school_admin' || (me?.role === 'superadmin' && schoolIdSa.trim())) && (
            <div className="space-y-1">
              <div className="flex items-center justify-between gap-2">
                <Label className="flex items-center gap-1.5 text-xs font-medium sm:text-sm">
                  <Users className="text-violet-600 size-4 shrink-0" />
                  Öğretmen
                </Label>
                <YollukInfoTrigger active={activeHelp === 'teacher'} onClick={() => toggleHelp('teacher')} />
              </div>
              <YollukInfoBody show={activeHelp === 'teacher'}>
                Taslak ve kesinleştirme bu öğretmene atanır. Kesinleşince öğretmene bildirim gider.
              </YollukInfoBody>
              <select
                className={inputBase}
                value={tid}
                onChange={(e) => {
                  const v = e.target.value;
                  if (editingId) {
                    const owner = (draftOwnerTidRef.current ?? tid).trim();
                    if (v === '') {
                      draftOwnerTidRef.current = null;
                      setEditingId(null);
                      resetFormToDefaults();
                      setTid('');
                      setPreview(null);
                      return;
                    }
                    if (owner && v !== owner) {
                      draftOwnerTidRef.current = null;
                      setEditingId(null);
                      resetFormToDefaults();
                      setTid(v);
                      setPreview(null);
                      setErr(null);
                      void applyYollukContext(v);
                      return;
                    }
                  }
                  setTid(v);
                }}
              >
                <option value="">— Seçin —</option>
                {teachers.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.display_name || t.id.slice(0, 8)}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <div className="flex items-center justify-between gap-2">
                <Label className="flex items-center gap-1.5 text-xs font-medium sm:text-sm">
                  <CalendarDays className="text-sky-600 size-4 shrink-0" />
                  Bütçe dönemi (mali yıl)
                </Label>
                <YollukInfoTrigger active={activeHelp === 'fiscal'} onClick={() => toggleHelp('fiscal')} />
              </div>
              <YollukInfoBody show={activeHelp === 'fiscal'}>
                Seçilen mali yılın parametreleri sunucuda tanımlı olmalı. Geçici görev PDF’inde «Bütçe yılı» bu seçimle aynıdır. Listede yoksa yıl
                numarasını elle girin.
              </YollukInfoBody>
              {yearChoices.length > 0 ? (
                <select
                  className={inputBase}
                  value={fiscalYear ?? ''}
                  onChange={(e) => setFiscalYear(parseInt(e.target.value, 10) || null)}
                >
                  {yearChoices.map((y) => (
                    <option key={y} value={y}>
                      {y} · 1 Oca – 31 Ara
                    </option>
                  ))}
                </select>
              ) : (
                <Input
                  className="h-9"
                  type="number"
                  min={2000}
                  max={2100}
                  placeholder="Örn. 2026"
                  value={fiscalYear ?? ''}
                  onChange={(e) => setFiscalYear(parseInt(e.target.value, 10) || null)}
                />
              )}
            </div>
            <div className="space-y-1.5">
              <Label className="flex items-center gap-1.5 text-xs font-medium sm:text-sm">
                <FileText className="text-muted-foreground size-4" />
                Başlık <span className="text-muted-foreground font-normal">(isteğe bağlı)</span>
              </Label>
              <Input className="h-9" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Örn. Şubat 2026 tayin" />
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold tracking-wide uppercase sm:text-sm">Yolluk türü</span>
              <YollukInfoTrigger active={activeHelp === 'kind'} onClick={() => toggleHelp('kind')} />
            </div>
            <YollukInfoBody show={activeHelp === 'kind'}>
              Geçici görev: görev günü ve masraf kalemleri (isteğe bağlı bildirim tablosu). Sürekli: yer değiştirme sabit + km.
            </YollukInfoBody>
            <div className="grid grid-cols-2 gap-1.5 sm:gap-2">
              <button
                type="button"
                onClick={() => setKind('gecici')}
                className={cn(
                  'flex flex-col items-center gap-1 rounded-xl border-2 px-1.5 py-2 transition-all sm:px-2 sm:py-2.5',
                  kind === 'gecici'
                    ? 'border-sky-500 bg-sky-500/12 shadow-sm ring-1 ring-sky-500/30'
                    : 'border-transparent bg-muted/60 hover:bg-muted',
                )}
              >
                <Route className={cn('size-5 sm:size-6', kind === 'gecici' ? 'text-sky-600' : 'text-muted-foreground')} />
                <span className={cn('text-[10px] font-semibold leading-tight sm:text-xs', kind === 'gecici' && 'text-sky-900 dark:text-sky-100')}>Geçici</span>
              </button>
              <button
                type="button"
                onClick={() => setKind('surekli')}
                className={cn(
                  'flex flex-col items-center gap-1 rounded-xl border-2 px-1.5 py-2 transition-all sm:px-2 sm:py-2.5',
                  kind === 'surekli'
                    ? 'border-violet-500 bg-violet-500/12 shadow-sm ring-1 ring-violet-500/30'
                    : 'border-transparent bg-muted/60 hover:bg-muted',
                )}
              >
                <Briefcase className={cn('size-5 sm:size-6', kind === 'surekli' ? 'text-violet-600' : 'text-muted-foreground')} />
                <span className={cn('text-[10px] font-semibold leading-tight sm:text-xs', kind === 'surekli' && 'text-violet-900 dark:text-violet-100')}>
                  Sürekli
                </span>
              </button>
            </div>
          </div>

          <div className="grid gap-3 overflow-visible sm:grid-cols-2">
            <div className={cn('relative z-0 min-w-0 space-y-1.5 overflow-visible', activeHelp === 'derece' && 'z-50')}>
              <div className="flex items-center justify-between gap-2">
                <Label className="flex items-center gap-1.5 text-xs font-medium sm:text-sm">
                  <Landmark className="text-emerald-600 size-4" />
                  Kadro derecesi
                </Label>
                <YollukInfoTrigger
                  ariaLabel="Kadro derecesi açıklaması"
                  active={activeHelp === 'derece'}
                  onClick={() => toggleHelp('derece')}
                />
              </div>
              <select
                className={inputBase}
                value={derece === '' ? '' : String(derece)}
                onChange={(e) => {
                  const v = e.target.value;
                  setDerece(v === '' ? '' : parseInt(v, 10));
                }}
              >
                <option value="">— Yedek gündelik —</option>
                {Array.from({ length: 15 }, (_, i) => i + 1).map((n) => (
                  <option key={n} value={n}>
                    {n} · {settings?.derece_daily_tl?.[String(n)] ?? '?'} TL
                  </option>
                ))}
              </select>
              <YollukInfoBody
                layout="overlay"
                show={activeHelp === 'derece'}
                className="border-l-4 border-l-emerald-600 border-border"
              >
                <KadroDerecesiInfoContent />
              </YollukInfoBody>
            </div>
            <div className={cn('relative z-0 min-w-0 space-y-1.5 overflow-visible', activeHelp === 'ek' && 'z-50')}>
              <div className="flex items-center justify-between gap-2">
                <Label className="flex items-center gap-1.5 text-xs font-medium sm:text-sm">
                  <Coins className="text-amber-600 size-4" />
                  Ek gösterge
                </Label>
                <YollukInfoTrigger
                  ariaLabel="Ek gösterge açıklaması"
                  active={activeHelp === 'ek'}
                  onClick={() => toggleHelp('ek')}
                />
              </div>
              <select
                className={inputBase}
                value={ekBand}
                onChange={(e) => setEkBand((e.target.value || '') as EkBand | '')}
              >
                <option value="">— Derece / yedek —</option>
                {EK_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                    {settings?.ek_gosterge_daily_tl?.[o.value] != null ? ` · ${settings.ek_gosterge_daily_tl[o.value]} TL` : ''}
                  </option>
                ))}
              </select>
              <YollukInfoBody
                layout="overlay"
                show={activeHelp === 'ek'}
                className="border-l-4 border-l-amber-600 border-border"
              >
                <EkGostergeInfoContent />
              </YollukInfoBody>
            </div>
          </div>

          <div className={cn('relative z-0 max-w-full space-y-1.5 overflow-visible', activeHelp === 'manual' && 'z-50')}>
            <div className="flex items-center justify-between gap-2">
              <Label className="flex items-center gap-1.5 text-xs font-medium sm:text-sm">
                <Sparkles className="text-rose-500 size-4" />
                Elle gündelik (TL)
              </Label>
              <YollukInfoTrigger
                ariaLabel="Elle gündelik açıklaması"
                active={activeHelp === 'manual'}
                onClick={() => toggleHelp('manual')}
              />
            </div>
            <Input className="h-9 max-w-xs" type="number" min={0} value={gundelikElle || ''} onChange={(e) => setGundelikElle(parseFloat(e.target.value) || 0)} />
            <YollukInfoBody
              layout="overlay"
              show={activeHelp === 'manual'}
              className="border-l-4 border-l-rose-600 border-border sm:max-w-xl"
            >
              <ElleGundelikInfoContent />
            </YollukInfoBody>
          </div>

          {kind === 'gecici' && (
            <div className="rounded-lg border border-sky-500/25 bg-sky-500/8 px-3 py-2.5 text-xs leading-relaxed dark:bg-sky-950/20">
              <p className="font-semibold text-[11px] uppercase tracking-wide text-sky-900 dark:text-sky-100">İç gündelik (H cetveli)</p>
              <p className="text-muted-foreground mt-1">{GECICI_IC_GUNDELIK_ONCELIK_OKUL}</p>
              {preview?.result?.effective_daily_tl != null ? (
                <p className="mt-2 font-mono text-sm font-semibold tabular-nums text-foreground">
                  Son önizleme: {preview.result.effective_daily_tl.toFixed(2)} TL / gün
                </p>
              ) : (
                <p className="text-muted-foreground mt-2 text-[11px]">Güncel tutarı görmek için aşağıdan «Hesapla».</p>
              )}
            </div>
          )}

          {kind === 'surekli' ? (
            <div className="from-violet-500/6 space-y-3 rounded-xl border border-violet-500/20 bg-linear-to-br to-transparent p-3 sm:p-4">
              <div className="flex items-center gap-2 text-violet-800 dark:text-violet-200">
                <MapPin className="size-4 shrink-0" />
                <span className="text-xs font-bold tracking-wide uppercase">Yer değiştirme</span>
              </div>
              <div className="grid gap-2.5 sm:grid-cols-2">
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs">Mesafe (km)</Label>
                    <YollukInfoTrigger active={activeHelp === 'km'} onClick={() => toggleHelp('km')} />
                  </div>
                  <YollukInfoBody show={activeHelp === 'km'}>
                    KGM mesafe cetveli / sorgu; değer elle de düzenlenebilir.{' '}
                    <a className="text-primary mt-1 inline-flex items-center gap-1 font-medium" href={KGM_UZAKLIK} rel="noreferrer" target="_blank">
                      kgm.gov.tr — Mesafeler <ExternalLink className="size-3.5" />
                    </a>
                  </YollukInfoBody>
                  <Input className="h-9" type="number" value={km} onChange={(e) => setKm(parseFloat(e.target.value) || 0)} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Rayıç (kişi başı TL)</Label>
                  <Input className="h-9" type="number" min={0} value={rayicS || ''} onChange={(e) => setRayicS(parseFloat(e.target.value) || 0)} />
                  <p className="text-muted-foreground text-[10px] leading-snug">Doluysa taşıt = rayıç × (1+eş+çocuk). Boş/0 ise taşıt özeti kullanılır.</p>
                </div>
              </div>
              <label className="flex cursor-pointer items-center gap-2 text-xs">
                <input
                  type="checkbox"
                  className="border-input size-3.5 shrink-0 rounded border"
                  checked={surSatirliAile}
                  onChange={(e) => setSurSatirliAile(e.target.checked)}
                />
                Eş / çocuk satırları (Excel; en fazla 5 çocuk, aile birimi tavanı)
              </label>
              {!surSatirliAile ? (
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs">Aile ferdi (toplam)</Label>
                    <YollukInfoTrigger active={activeHelp === 'aile'} onClick={() => toggleHelp('aile')} />
                  </div>
                  <YollukInfoBody show={activeHelp === 'aile'}>
                    Kendiniz hariç; yönetmelikteki aile ferdi tanımına göre toplam sayı (özet model).
                  </YollukInfoBody>
                  <Input className="h-9 max-w-xs" type="number" value={aile} onChange={(e) => setAile(parseInt(e.target.value, 10) || 0)} />
                </div>
              ) : (
                <div className="grid gap-2 sm:grid-cols-2">
                  <label className="flex cursor-pointer items-center gap-2 rounded-md border border-violet-500/20 bg-background/80 px-2 py-2 text-xs">
                    <input type="checkbox" className="size-3.5 shrink-0 rounded border" checked={surEs} onChange={(e) => setSurEs(e.target.checked)} />
                    Eş
                  </label>
                  <div className="space-y-1">
                    <Label className="text-xs">Çocuk sayısı (0–5)</Label>
                    <Input
                      className="h-9"
                      type="number"
                      min={0}
                      max={5}
                      value={surCocuk}
                      onChange={(e) => setSurCocuk(Math.min(5, Math.max(0, parseInt(e.target.value, 10) || 0)))}
                    />
                  </div>
                </div>
              )}
              <div className="space-y-1.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Label className="text-xs font-medium">Y.D.M. (km çarpanı)</Label>
                  <YollukInfoTrigger active={activeHelp === 'ydm'} onClick={() => toggleHelp('ydm')} />
                </div>
                <YollukInfoBody show={activeHelp === 'ydm'}>
                  Normal tayin veya eş durumu tam: km ile çarpılan değişken unsur tam. Her iki eş aynı mahalle geçişinde biri tam biri yarım
                  ödenecekse «Yarım» seçilir.
                </YollukInfoBody>
                <div className="flex gap-1.5">
                  <Button type="button" className="h-9 flex-1 gap-1 text-xs" variant={ydm === 'tam' ? 'default' : 'outline'} onClick={() => setYdm('tam')}>
                    Tam
                  </Button>
                  <Button type="button" className="h-9 flex-1 gap-1 text-xs" variant={ydm === 'yarim' ? 'default' : 'outline'} onClick={() => setYdm('yarim')}>
                    Yarım
                  </Button>
                </div>
              </div>
              <div className="space-y-1">
                <Label className="flex items-center gap-1.5 text-xs">
                  <Bus className="size-3.5 text-muted-foreground" />
                  Taşıt (TL, rayıç yoksa özet)
                </Label>
                <Input className="h-9" type="number" value={tasitS} onChange={(e) => setTasitS(parseFloat(e.target.value) || 0)} />
              </div>
              <details open className="rounded-md border border-violet-500/15 bg-violet-500/5 px-2 py-2 text-xs">
                <summary className="cursor-pointer font-medium text-violet-900 dark:text-violet-100">PDF üst bilgisi (isteğe bağlı)</summary>
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  <div className="space-y-1">
                    <Label className="text-[10px]">Atama tarihi</Label>
                    {bildirimTarihSecenekleri.length > 0 ? (
                      <select
                        className={cn(inputBase, 'h-8 text-xs')}
                        value={bildirimTarihSecenekleri.includes(surAtama.trim()) ? surAtama.trim() : ''}
                        onChange={(e) => {
                          const v = e.target.value;
                          setSurAtama(v);
                        }}
                      >
                        <option value="">Liste / elle (aşağı)</option>
                        {bildirimTarihSecenekleri.map((t) => (
                          <option key={t} value={t}>
                            {t}
                          </option>
                        ))}
                      </select>
                    ) : null}
                    <Input className="h-8 text-xs" value={surAtama} onChange={(e) => setSurAtama(e.target.value)} placeholder="Örn. 1.01.2026" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px]">Önceden avans (PDF)</Label>
                    <div className="flex flex-wrap gap-1">
                      <Button type="button" size="sm" variant={surAvans === '' ? 'default' : 'outline'} className="h-7 px-2 text-[10px]" onClick={() => setSurAvans('')}>
                        Boş
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant={surAvans === 'Almamıştır' ? 'default' : 'outline'}
                        className="h-7 px-2 text-[10px]"
                        onClick={() => setSurAvans('Almamıştır')}
                      >
                        Almamıştır
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant={surAvans === 'Almıştır' ? 'default' : 'outline'}
                        className="h-7 px-2 text-[10px]"
                        onClick={() => setSurAvans('Almıştır')}
                      >
                        Almıştır
                      </Button>
                    </div>
                    <Input
                      className="h-8 text-xs"
                      list="yolluk-sur-avans-presets"
                      value={surAvans}
                      onChange={(e) => setSurAvans(e.target.value)}
                      placeholder="Listeden veya elle (PDF: Saymanlık ve Tarihi)"
                    />
                    <datalist id="yolluk-sur-avans-presets">
                      {SUREKLI_AVANS_PDF_OPTIONS.map((o) => (
                        <option key={o} value={o} />
                      ))}
                    </datalist>
                  </div>
                  <div className="space-y-1 sm:col-span-2">
                    <Label className="text-[10px]">PDF düzenleme tarihi</Label>
                    <Input className="h-8 max-w-xs text-xs" type="date" value={surPdfTarih} onChange={(e) => setSurPdfTarih(e.target.value)} />
                    <p className="text-muted-foreground text-[9px] leading-snug">Boşsa PDF dip tarihinde kesinleştirme veya oluşturma tarihi kullanılır.</p>
                  </div>
                  <div className="space-y-1 sm:col-span-2">
                    <Label className="text-[10px]">Ek gösterge / derece (not)</Label>
                    <Input className="h-8 text-xs" value={surEkHucre} onChange={(e) => setSurEkHucre(e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px]">Kadro kademesi (PDF)</Label>
                    <Input className="h-8 text-xs" value={bildKademe} onChange={(e) => setBildKademe(e.target.value)} placeholder="Örn. 3" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px]">Eş adı soyadı</Label>
                    <Input className="h-8 text-xs" value={surEsAd} onChange={(e) => setSurEsAd(e.target.value)} />
                  </div>
                  <div className="space-y-1 sm:col-span-2">
                    <Label className="text-[10px]">Çocuk adları (satır başına, en fazla 5)</Label>
                    <textarea
                      className="border-input bg-background min-h-16 w-full rounded-md border px-2 py-1.5 text-xs shadow-sm"
                      value={surCocukAdMetni}
                      onChange={(e) => setSurCocukAdMetni(e.target.value)}
                      spellCheck={false}
                    />
                  </div>
                </div>
              </details>
              <div className="space-y-3">
                <p className="text-muted-foreground text-[10px] font-semibold uppercase tracking-wide">Eski mahal</p>
                <div className="grid gap-2 sm:grid-cols-2">
                  <div className="space-y-1">
                    <Label className="text-xs">İl</Label>
                    <select
                      className={inputBase}
                      value={eskiIl}
                      onChange={(e) => {
                        const il = e.target.value;
                        setEskiIl(il);
                        setEskiIlce('');
                      }}
                    >
                      <option value="">—</option>
                      {TURKEY_CITIES.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">İlçe</Label>
                    {getDistrictsForCity(eskiIl, []).length > 0 ? (
                      <select className={inputBase} value={eskiIlce} onChange={(e) => setEskiIlce(e.target.value)}>
                        <option value="">—</option>
                        {getDistrictsForCity(eskiIl, []).map((d) => (
                          <option key={d} value={d}>
                            {d}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <Input
                        className="h-9"
                        value={eskiIlce}
                        disabled={!eskiIl}
                        onChange={(e) => setEskiIlce(e.target.value)}
                        placeholder={eskiIl ? 'İlçe (liste yoksa elle)' : 'Önce il'}
                      />
                    )}
                  </div>
                </div>
                <p className="text-muted-foreground text-[10px] font-semibold uppercase tracking-wide">Yeni mahal</p>
                <div className="grid gap-2 sm:grid-cols-2">
                  <div className="space-y-1">
                    <Label className="text-xs">İl</Label>
                    <select
                      className={inputBase}
                      value={yeniIl}
                      onChange={(e) => {
                        setYeniIl(e.target.value);
                        setYeniIlce('');
                      }}
                    >
                      <option value="">—</option>
                      {TURKEY_CITIES.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">İlçe</Label>
                    {getDistrictsForCity(yeniIl, []).length > 0 ? (
                      <select className={inputBase} value={yeniIlce} onChange={(e) => setYeniIlce(e.target.value)}>
                        <option value="">—</option>
                        {getDistrictsForCity(yeniIl, []).map((d) => (
                          <option key={d} value={d}>
                            {d}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <Input
                        className="h-9"
                        value={yeniIlce}
                        disabled={!yeniIl}
                        onChange={(e) => setYeniIlce(e.target.value)}
                        placeholder={yeniIl ? 'İlçe (liste yoksa elle)' : 'Önce il'}
                      />
                    )}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-3 rounded-xl border border-sky-500/25 from-sky-500/8 bg-linear-to-br to-transparent p-3 sm:p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Route className="text-sky-600 size-4" />
                  <span className="text-xs font-bold tracking-wide uppercase">Geçici görev</span>
                </div>
              </div>
              {kind === 'gecici' && (
                <div className="space-y-4 rounded-xl border border-sky-600/25 bg-sky-500/6 p-3 sm:p-5">
                  <p className="text-muted-foreground text-[11px] font-semibold uppercase tracking-wide">
                    Geçici görev bildirimi (resmî PDF, yolluk2026)
                  </p>
                  <ul className="text-muted-foreground list-inside list-disc space-y-1 text-[10px] leading-snug sm:text-[11px]">
                    {GECICI_YOLLUK_UYARILARI.map((u) => (
                      <li key={u}>{u}</li>
                    ))}
                  </ul>
                  <p className="text-muted-foreground border-border/60 border-t pt-2 text-[11px] leading-relaxed">{GECICI_BILDIRIM_META_NOTU}</p>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 lg:gap-x-5 lg:gap-y-4">
                    <div className="space-y-1.5">
                      <Label className="text-xs">Kapsam</Label>
                      <select
                        className={inputBase}
                        value={bildKapsam}
                        onChange={(e) => setBildKapsam(e.target.value as 'yurtici' | 'yurtdisi')}
                      >
                        <option value="yurtici">Yurtiçi</option>
                        <option value="yurtdisi">Yurtdışı</option>
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Adı soyadı (PDF)</Label>
                      <Input className="h-9" value={bildAd} onChange={(e) => setBildAd(e.target.value)} placeholder="Öğretmen seçilince dolar" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Ünvan</Label>
                      <select
                        className={inputBase}
                        value={listedOrElle(bildUnvan, UNVAN_OPTIONS)}
                        onChange={(e) => {
                          const v = e.target.value;
                          setBildUnvan(v === ELLE_MARKER || v === '' ? '' : v);
                        }}
                      >
                        <option value="">—</option>
                        {UNVAN_OPTIONS.map((o) => (
                          <option key={o} value={o}>
                            {o}
                          </option>
                        ))}
                        <option value={ELLE_MARKER}>Elle yaz…</option>
                      </select>
                      {listedOrElle(bildUnvan, UNVAN_OPTIONS) === ELLE_MARKER && (
                        <Input className="h-9" value={bildUnvan} onChange={(e) => setBildUnvan(e.target.value)} placeholder="Ünvan (metin)" />
                      )}
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">T.C. kimlik no</Label>
                      <Input className="h-9" value={bildTc} onChange={(e) => setBildTc(e.target.value)} inputMode="numeric" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">IBAN (isteğe bağlı)</Label>
                      <Input
                        className="h-9 font-mono text-xs"
                        value={bildIban}
                        onChange={(e) => setBildIban(e.target.value.toUpperCase())}
                        placeholder="TR…"
                        spellCheck={false}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Kadro kademesi (isteğe bağlı)</Label>
                      <Input className="h-9" value={bildKademe} onChange={(e) => setBildKademe(e.target.value)} placeholder="Örn. 1" />
                    </div>
                    <div className="flex flex-col justify-end gap-1.5 sm:col-span-2 lg:col-span-1">
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        className="h-9"
                        disabled={!tid || profBusy}
                        onClick={() => void doSaveYollukTeacherProfile()}
                      >
                        {profBusy ? 'Kaydediliyor…' : 'Öğretmen profiline kaydet'}
                      </Button>
                      <p className="text-muted-foreground text-[10px] leading-tight">T.C., IBAN, derece (form), kademe, ünvan metni.</p>
                    </div>
                    <div className="space-y-1.5 sm:col-span-2 lg:col-span-2">
                      <Label className="text-xs">Dairesi / birim</Label>
                      <Input
                        className="h-9"
                        value={bildDaire}
                        onChange={(e) => setBildDaire(e.target.value)}
                        placeholder="Okul kaydından dolar"
                      />
                      <p className="text-muted-foreground text-[10px] leading-tight">İl/ilçe ve kurum adına göre sunucu metni; okul profilinde güncelleyin.</p>
                    </div>
                    <div className="space-y-1.5 sm:col-span-2 lg:col-span-1">
                      <Label className="text-xs">Birim yetkilisi ünvanı</Label>
                      <Input
                        className="h-9"
                        value={bildMudurUnvan}
                        onChange={(e) => setBildMudurUnvan(e.target.value)}
                        placeholder="Okul müdürü (…)"
                      />
                      <p className="text-muted-foreground text-[10px] leading-tight">
                        Belge sekmesindeki müdür adı (Ayarlar → Okul hesabı → Belge); boşsa okul kaydındaki müdür adı. Gerekirse burada düzeltin.
                      </p>
                    </div>
                    <div className="space-y-1.5 sm:col-span-2 lg:col-span-2">
                      <Label className="text-xs">Görev yeri (şablon)</Label>
                      <Input
                        className="h-9"
                        value={bildGorevYeri}
                        onChange={(e) => setBildGorevYeri(e.target.value)}
                        placeholder="Okul adı · ilçe / il"
                      />
                      <p className="text-muted-foreground text-[10px] leading-tight">Kurum adı ve konum okul kaydından üretilir.</p>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Düzenleme / imza tarihi (PDF)</Label>
                      <Input
                        type="date"
                        className="h-9"
                        value={bildPdfDuzenleme}
                        onChange={(e) => setBildPdfDuzenleme(e.target.value)}
                      />
                      <p className="text-muted-foreground text-[10px] leading-tight">
                        PDF altındaki «İmza tarihi (gün / ay / yıl)» alanları (birim yetkilisi ve bildirim sahibi).
                      </p>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Konaklama beyanı (bilgi)</Label>
                      <select
                        className={inputBase}
                        value={bildKonaklamaBeyan}
                        onChange={(e) => setBildKonaklamaBeyan(e.target.value as 'hayir' | 'evet')}
                      >
                        {KONAKLAMA_BEYAN_OPTIONS.map((o) => (
                          <option key={o.value} value={o.value}>
                            {o.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="space-y-3 sm:space-y-4">
                    {bildRows.map((row, idx) => (
                      <div
                        key={row.id}
                        className="overflow-visible rounded-xl border border-border bg-background/90 p-3 shadow-sm sm:p-4"
                      >
                        <div className="mb-3 flex items-center justify-between gap-2 border-b border-border/60 pb-2">
                          <span className="text-muted-foreground text-[11px] font-semibold uppercase tracking-wide">
                            Satır {idx + 1}
                          </span>
                          {bildRows.length > 1 && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="text-destructive hover:text-destructive h-8 px-2"
                              onClick={() => setBildRows((xs) => xs.filter((r) => r.id !== row.id))}
                            >
                              <Trash2 className="size-4" aria-hidden />
                            </Button>
                          )}
                        </div>
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
                          <div className="space-y-1" title={GECICI_SATIR_ALAN_IPUCU.tarih}>
                            <Label className="text-[11px]">Tarih</Label>
                            <Input
                              className="h-9"
                              type="date"
                              value={row.tarih}
                              onChange={(e) =>
                                setBildRows((xs) => xs.map((r) => (r.id === row.id ? { ...r, tarih: e.target.value } : r)))
                              }
                            />
                          </div>
                          <div className="col-span-full grid grid-cols-1 gap-2 border-border/40 border-y border-dashed py-2 sm:grid-cols-2 lg:grid-cols-4">
                            <div className="space-y-1" title={GECICI_SATIR_ALAN_IPUCU.yer_from}>
                              <Label className="text-[11px]">Nereden · il</Label>
                              <select
                                className={inputBase}
                                value={row.yer_from_il}
                                onChange={(e) => {
                                  const il = e.target.value;
                                  setBildRows((xs) =>
                                    xs.map((r) => (r.id === row.id ? { ...r, yer_from_il: il, yer_from_ilce: '' } : r)),
                                  );
                                }}
                              >
                                <option value="">—</option>
                                {TURKEY_CITIES.map((c) => (
                                  <option key={c} value={c}>
                                    {c}
                                  </option>
                                ))}
                              </select>
                            </div>
                            <div className="space-y-1">
                              <Label className="text-[11px]">Nereden · ilçe</Label>
                              {getDistrictsForCity(row.yer_from_il, []).length > 0 ? (
                                <select
                                  className={inputBase}
                                  value={row.yer_from_ilce}
                                  onChange={(e) =>
                                    setBildRows((xs) =>
                                      xs.map((r) => (r.id === row.id ? { ...r, yer_from_ilce: e.target.value } : r)),
                                    )
                                  }
                                >
                                  <option value="">—</option>
                                  {getDistrictsForCity(row.yer_from_il, []).map((d) => (
                                    <option key={d} value={d}>
                                      {d}
                                    </option>
                                  ))}
                                </select>
                              ) : (
                                <Input
                                  className="h-9"
                                  value={row.yer_from_ilce}
                                  disabled={!row.yer_from_il}
                                  onChange={(e) =>
                                    setBildRows((xs) =>
                                      xs.map((r) => (r.id === row.id ? { ...r, yer_from_ilce: e.target.value } : r)),
                                    )
                                  }
                                  placeholder={row.yer_from_il ? 'İlçe' : 'Önce il'}
                                />
                              )}
                            </div>
                            <div className="space-y-1" title={GECICI_SATIR_ALAN_IPUCU.yer_to}>
                              <Label className="text-[11px]">Nereye · il</Label>
                              <select
                                className={inputBase}
                                value={row.yer_to_il}
                                onChange={(e) => {
                                  const il = e.target.value;
                                  setBildRows((xs) =>
                                    xs.map((r) => (r.id === row.id ? { ...r, yer_to_il: il, yer_to_ilce: '' } : r)),
                                  );
                                }}
                              >
                                <option value="">—</option>
                                {TURKEY_CITIES.map((c) => (
                                  <option key={c} value={c}>
                                    {c}
                                  </option>
                                ))}
                              </select>
                            </div>
                            <div className="space-y-1">
                              <Label className="text-[11px]">Nereye · ilçe</Label>
                              {getDistrictsForCity(row.yer_to_il, []).length > 0 ? (
                                <select
                                  className={inputBase}
                                  value={row.yer_to_ilce}
                                  onChange={(e) =>
                                    setBildRows((xs) =>
                                      xs.map((r) => (r.id === row.id ? { ...r, yer_to_ilce: e.target.value } : r)),
                                    )
                                  }
                                >
                                  <option value="">—</option>
                                  {getDistrictsForCity(row.yer_to_il, []).map((d) => (
                                    <option key={d} value={d}>
                                      {d}
                                    </option>
                                  ))}
                                </select>
                              ) : (
                                <Input
                                  className="h-9"
                                  value={row.yer_to_ilce}
                                  disabled={!row.yer_to_il}
                                  onChange={(e) =>
                                    setBildRows((xs) =>
                                      xs.map((r) => (r.id === row.id ? { ...r, yer_to_ilce: e.target.value } : r)),
                                    )
                                  }
                                  placeholder={row.yer_to_il ? 'İlçe' : 'Önce il'}
                                />
                              )}
                            </div>
                            <div className="space-y-1 sm:col-span-2 lg:col-span-4">
                              <Label className="text-[11px]">Serbest (il/ilçe seçilmediyse «nereden — nereye»)</Label>
                              <div className="grid gap-1 sm:grid-cols-2">
                                <Input
                                  className="h-9"
                                  value={row.yer_from}
                                  onChange={(e) =>
                                    setBildRows((xs) =>
                                      xs.map((r) => (r.id === row.id ? { ...r, yer_from: e.target.value } : r)),
                                    )
                                  }
                                  placeholder="Nereden"
                                />
                                <Input
                                  className="h-9"
                                  value={row.yer_to}
                                  onChange={(e) =>
                                    setBildRows((xs) => xs.map((r) => (r.id === row.id ? { ...r, yer_to: e.target.value } : r)))
                                  }
                                  placeholder="Nereye"
                                />
                              </div>
                            </div>
                          </div>
                          <div className="space-y-1" title={GECICI_SATIR_ALAN_IPUCU.saat}>
                            <Label className="text-[11px]">Gidiş saati</Label>
                            <Input
                              className="h-9"
                              type="time"
                              value={row.gidis_saat}
                              onChange={(e) =>
                                setBildRows((xs) => xs.map((r) => (r.id === row.id ? { ...r, gidis_saat: e.target.value } : r)))
                              }
                            />
                          </div>
                          <div className="space-y-1" title={GECICI_SATIR_ALAN_IPUCU.saat}>
                            <Label className="text-[11px]">Dönüş saati</Label>
                            <Input
                              className="h-9"
                              type="time"
                              value={row.donus_saat}
                              onChange={(e) =>
                                setBildRows((xs) => xs.map((r) => (r.id === row.id ? { ...r, donus_saat: e.target.value } : r)))
                              }
                            />
                          </div>
                          <div className="space-y-1" title={GECICI_SATIR_ALAN_IPUCU.gun}>
                            <Label className="text-[11px]">Gün sayısı</Label>
                            <Input
                              className="h-9"
                              type="number"
                              min={0}
                              value={row.gun_sayisi}
                              onChange={(e) =>
                                setBildRows((xs) =>
                                  xs.map((r) => (r.id === row.id ? { ...r, gun_sayisi: parseInt(e.target.value, 10) || 0 } : r)),
                                )
                              }
                            />
                          </div>
                          <div className="relative space-y-1">
                            <div className="flex items-center gap-1">
                              <Label className="text-[11px]" id={`yevmiye-lbl-${row.id}`}>
                                Yevmiye
                              </Label>
                              <button
                                type="button"
                                className={cn(
                                  'rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground',
                                  yevmiyeBilgiRowId === row.id && 'text-amber-700 dark:text-amber-300',
                                )}
                                aria-expanded={yevmiyeBilgiRowId === row.id}
                                aria-controls={`yevmiye-bilgi-${row.id}`}
                                aria-label="Yevmiye açıklamasını aç veya kapat"
                                onClick={() => setYevmiyeBilgiRowId((id) => (id === row.id ? null : row.id))}
                              >
                                <Info className="size-3.5" aria-hidden />
                              </button>
                            </div>
                            <select
                              className={inputBase}
                              value={row.yevmiye_kod}
                              onChange={(e) =>
                                setBildRows((xs) =>
                                  xs.map((r) =>
                                    r.id === row.id ? { ...r, yevmiye_kod: e.target.value as GeciciBildirimRowState['yevmiye_kod'] } : r,
                                  ),
                                )
                              }
                            >
                              {YEVMIYE_KOD_OPTIONS.map((o) => (
                                <option key={o.kod} value={o.kod} title={o.optionTitle}>
                                  {o.label}
                                </option>
                              ))}
                            </select>
                            {yevmiyeBilgiRowId === row.id && (
                              <div
                                id={`yevmiye-bilgi-${row.id}`}
                                role="region"
                                aria-labelledby={`yevmiye-lbl-${row.id}`}
                                className="absolute left-0 top-full z-30 mt-1 w-[min(100%,18rem)] rounded-md border border-amber-200/80 bg-amber-50/98 p-2 text-[9.5px] leading-snug text-amber-950 shadow-md dark:border-amber-900/50 dark:bg-amber-950/95 dark:text-amber-50"
                              >
                                <p className="font-semibold">{YEVMIYE_SAAT_ORNEGI_BASLIK}</p>
                                <ul className="mt-1 list-inside list-disc space-y-0.5">
                                  {YEVMIYE_SAAT_ORNEGI_SATIRLARI.map((l) => (
                                    <li key={l}>{l}</li>
                                  ))}
                                </ul>
                                <p className="mt-2 border-t border-amber-200/70 pt-2 opacity-95 dark:border-amber-800/40">
                                  {YEVMIYE_KESIR_UYARISI}
                                </p>
                              </div>
                            )}
                          </div>
                          <div className="space-y-1" title={GECICI_SATIR_ALAN_IPUCU.tasit_tip}>
                            <Label className="text-[11px]">Taşıt çeşidi</Label>
                            <select
                              className={inputBase}
                              value={listedOrElle(row.tasit_tip, TASIT_CESIT_OPTIONS)}
                              onChange={(e) => {
                                const v = e.target.value;
                                setBildRows((xs) =>
                                  xs.map((r) => (r.id === row.id ? { ...r, tasit_tip: v === ELLE_MARKER || v === '' ? '' : v } : r)),
                                );
                              }}
                            >
                              <option value="">—</option>
                              {TASIT_CESIT_OPTIONS.map((o) => (
                                <option key={o} value={o}>
                                  {o}
                                </option>
                              ))}
                              <option value={ELLE_MARKER}>Elle yaz…</option>
                            </select>
                            {listedOrElle(row.tasit_tip, TASIT_CESIT_OPTIONS) === ELLE_MARKER && (
                              <Input
                                className="h-9 mt-1"
                                value={row.tasit_tip}
                                onChange={(e) =>
                                  setBildRows((xs) => xs.map((r) => (r.id === row.id ? { ...r, tasit_tip: e.target.value } : r)))
                                }
                                placeholder="Taşıt türü"
                              />
                            )}
                          </div>
                          <div className="space-y-1" title={GECICI_SATIR_ALAN_IPUCU.tasit_tl}>
                            <Label className="text-[11px]">Taşıt / zorunlu TL</Label>
                            <Input
                              className="h-9"
                              type="number"
                              min={0}
                              value={row.tasit_ucret_tl}
                              onChange={(e) =>
                                setBildRows((xs) =>
                                  xs.map((r) => (r.id === row.id ? { ...r, tasit_ucret_tl: parseFloat(e.target.value) || 0 } : r)),
                                )
                              }
                            />
                          </div>
                          <div className="space-y-1" title={GECICI_SATIR_ALAN_IPUCU.doviz_tl}>
                            <Label className="text-[11px]">Dövizin cinsi (TL)</Label>
                            <Input
                              className="h-9"
                              type="number"
                              min={0}
                              value={row.doviz_cinsi_tl}
                              onChange={(e) =>
                                setBildRows((xs) =>
                                  xs.map((r) => (r.id === row.id ? { ...r, doviz_cinsi_tl: parseFloat(e.target.value) || 0 } : r)),
                                )
                              }
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-9 gap-1.5"
                    onClick={() => setBildRows((xs) => [...xs, newBildRow()])}
                  >
                    <Plus className="size-4" aria-hidden />
                    Satır ekle
                  </Button>
                </div>
              )}
              {kind === 'gecici' && bildirimPayload && (
                <Alert variant="info" className="py-2 text-xs">
                  Bildirim tablosu etkin: gündelik bu satırlardan hesaplanır; görev günü alanı bu kayıtta kullanılmaz.
                </Alert>
              )}
              {(kind === 'gecici' && !bildirimPayload) && (
                <div className="space-y-1">
                  <Label className="text-xs">Görev günü</Label>
                  <Input
                    className="h-9"
                    type="number"
                    min={0}
                    value={missionDays}
                    onChange={(e) => setMissionDays(parseInt(e.target.value, 10) || 0)}
                  />
                </div>
              )}
              {kind === 'gecici' && bildirimPayload && (
                <p className="text-muted-foreground text-xs leading-relaxed">
                  Gündelik matrahı tablodaki gün × yevmiye kesri × yukarıdaki iç gündelik ile hesaplanır (90+90 kademeli özet modu bu kayıtta kapalı).
                </p>
              )}
              {kind === 'gecici' && (
                <div className="space-y-1.5 rounded-lg border border-border bg-muted/25 px-2.5 py-2">
                  <p className="text-foreground text-xs font-semibold">Özet masraf kalemleri</p>
                  <p className="text-muted-foreground text-[11px] leading-snug">{GECICI_OZET_MASRAF_ACIKLAMA}</p>
                </div>
              )}
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {[
                  { k: 'yol', label: 'Yol (özet TL)', v: yol, set: setYol },
                  { k: 'tas', label: 'Taşıt (özet, tablo dışı)', v: tasitG, set: setTasitG },
                  { k: 'kon', label: 'Konaklama (özet TL)', v: kon, set: setKon },
                  { k: 'tak', label: 'Taksi / hamal', v: taksiG, set: setTaksiG },
                  { k: 'dig', label: 'Diğer', v: diger, set: setDiger },
                ].map((x) => (
                  <div key={x.k} className="space-y-1">
                    <Label className="text-[11px] sm:text-xs">{x.label}</Label>
                    <Input className="h-9" type="number" value={x.v} onChange={(e) => x.set(parseFloat(e.target.value) || 0)} />
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex flex-wrap gap-2 pt-1">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="h-9 flex-1 gap-1.5 min-[400px]:flex-none sm:h-10"
              disabled={busy || fiscalYear == null}
              onClick={() => void doPreview()}
            >
              <Calculator className="size-4" />
              Hesapla
            </Button>
            <Button type="button" size="sm" className="h-9 flex-1 gap-1.5 min-[400px]:flex-none sm:h-10" disabled={busy || fiscalYear == null} onClick={() => void doSaveDraft()}>
              <FileText className="size-4" />
              {editingId ? 'Taslağı güncelle' : 'Taslak kaydet'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {preview?.result && (
        <Card className="overflow-hidden border-emerald-500/30 shadow-md ring-1 ring-emerald-500/10">
          <CardHeader className="from-emerald-500/12 border-b bg-linear-to-r to-teal-500/8 py-3">
            <CardTitle className="flex flex-wrap items-center gap-2 text-sm font-semibold sm:text-base">
              <Sparkles className="text-emerald-600 size-5" />
              Sonuç
              <span className="text-emerald-700 dark:text-emerald-300 ml-auto text-base font-bold sm:text-lg">
                {(preview.result.total_tl as number)?.toFixed?.(2) ?? preview.result.total_tl} TL
              </span>
            </CardTitle>
            {preview.result.effective_daily_tl != null && (
              <p className="text-muted-foreground text-xs">Gündelik: {preview.result.effective_daily_tl.toFixed(2)} TL</p>
            )}
          </CardHeader>
          <CardContent className="divide-border max-h-[min(50vh,320px)] divide-y overflow-y-auto p-0 text-sm">
            {(preview.result.lines ?? []).map((l) => (
              <div key={l.key} className="flex items-start justify-between gap-2 px-3 py-2 sm:px-4">
                <span className="text-muted-foreground min-w-0 flex-1 text-xs leading-snug">{l.label}</span>
                <span className="text-foreground shrink-0 font-mono text-xs font-semibold tabular-nums sm:text-sm">{l.amount_tl.toFixed(2)} TL</span>
              </div>
            ))}
            {preview.result.gecici_bildirim?.rows?.length ? (
              <div className="bg-muted/30 text-muted-foreground border-t px-3 py-2 text-[11px] sm:px-4 sm:text-xs">
                <p>
                  Bildirim tablosu: {preview.result.gecici_bildirim.rows.length} satır · gündelik toplamı{' '}
                  {preview.result.gecici_bildirim.toplam_gundelik_tl.toFixed(2)} TL · taşıt + döviz (satır){' '}
                  {preview.result.gecici_bildirim.toplam_tasit_tl.toFixed(2)} TL
                </p>
              </div>
            ) : null}
            {preview.result.surekli_pdf?.rows?.length ? (
              <div className="border-t px-2 py-2 sm:px-3">
                <p className="text-muted-foreground mb-1.5 text-[10px] font-semibold uppercase tracking-wide">Sürekli tablo (PDF ile aynı satırlar)</p>
                <div className="max-h-40 overflow-auto rounded border border-violet-500/20 text-[10px]">
                  <table className="w-full border-collapse text-left">
                    <thead className="sticky top-0 bg-muted/90">
                      <tr>
                        <th className="border-b px-1 py-1 font-medium">İlişki</th>
                        <th className="border-b px-1 py-1 font-medium">Br.</th>
                        <th className="border-b px-1 py-1 font-medium">Gnd.</th>
                        <th className="border-b px-1 py-1 font-medium">Ray.</th>
                        <th className="border-b px-1 py-1 font-medium">Sbt.</th>
                        <th className="border-b px-1 py-1 font-medium">Km</th>
                        <th className="border-b px-1 py-1 font-medium">Dğ.</th>
                        <th className="border-b px-1 py-1 font-medium">∑</th>
                      </tr>
                    </thead>
                    <tbody>
                      {preview.result.surekli_pdf.rows.map((r, i) => (
                        <tr key={r.key ?? `sr-${i}`} className="odd:bg-background/60">
                          <td className="border-b border-border/50 px-1 py-0.5">{r.label}</td>
                          <td className="border-b border-border/50 px-1 py-0.5 tabular-nums">{r.gun_sayisi}</td>
                          <td className="border-b border-border/50 px-1 py-0.5 tabular-nums">{r.tutar_tl.toFixed(2)}</td>
                          <td className="border-b border-border/50 px-1 py-0.5 tabular-nums">{r.rayic_tl.toFixed(2)}</td>
                          <td className="border-b border-border/50 px-1 py-0.5 tabular-nums">{r.sabit_tl.toFixed(2)}</td>
                          <td className="border-b border-border/50 px-1 py-0.5 tabular-nums">{r.mesafe_km}</td>
                          <td className="border-b border-border/50 px-1 py-0.5 tabular-nums">{r.degisken_tl.toFixed(2)}</td>
                          <td className="border-b border-border/50 px-1 py-0.5 font-medium tabular-nums">{r.satir_toplam_tl.toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : null}
          </CardContent>
        </Card>
      )}

      <Card className="overflow-hidden shadow-sm">
        <CardHeader className="bg-muted/40 flex flex-col gap-2 border-b py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-0.5">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold sm:text-base">
              <History className="text-muted-foreground size-5" />
              Kayıtlar
            </CardTitle>
            <p className="text-muted-foreground text-xs font-normal">
              {archiveTab === 'active' ? 'Taslak ve kesin yolluk hesapları' : 'Arşivlenmiş hesaplar (geri alınabilir)'}
            </p>
          </div>
          <div className="flex flex-wrap gap-1.5">
            <Button
              type="button"
              size="sm"
              variant={archiveTab === 'active' ? 'default' : 'outline'}
              className="h-8 text-xs"
              onClick={() => setArchiveTab('active')}
            >
              Aktif liste
            </Button>
            <Button
              type="button"
              size="sm"
              variant={archiveTab === 'archived' ? 'default' : 'outline'}
              className="h-8 text-xs"
              onClick={() => setArchiveTab('archived')}
            >
              Arşiv listesi
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {list.length === 0 && (
            <p className="text-muted-foreground p-4 text-center text-sm">
              {archiveTab === 'archived' ? 'Arşiv listesinde kayıt yok.' : 'Aktif listede henüz kayıt yok.'}
            </p>
          )}
          {list.length > 0 && (
            <div className="max-h-[min(48vh,420px)] overflow-y-auto overflow-x-hidden [scrollbar-width:thin]">
              <ul className="flex flex-col gap-2 p-3 sm:gap-2.5 sm:p-4">
                {list.map((c) => {
                  const { primary, subtitle } = calcListLines(c, teachers);
                  return (
                    <li
                      key={c.id}
                      className={cn(
                        'rounded-xl border border-border p-3 shadow-sm sm:p-3.5',
                        'border-l-[3px]',
                        yollukKindRowAccent(c.kind),
                      )}
                    >
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                        <div className="min-w-0 flex-1 space-y-2">
                          <p className="text-foreground wrap-break-word text-sm font-semibold leading-snug">{primary}</p>
                          {subtitle ? (
                            <p className="text-muted-foreground wrap-break-word text-xs leading-relaxed">{subtitle}</p>
                          ) : null}
                          <p className="text-muted-foreground break-all font-mono text-[10px] leading-normal tabular-nums" title={c.id}>
                            Kayıt: {c.id}
                          </p>
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span
                              className={cn(
                                'inline-flex max-w-full rounded-full px-2.5 py-1 text-left text-[11px] font-semibold leading-snug whitespace-normal sm:text-xs',
                                yollukKindBadgeClass(c.kind),
                              )}
                            >
                              {yollukKindLabelTr(c.kind)}
                            </span>
                            <span
                              className={cn(
                                'inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase leading-none sm:text-xs',
                                c.status === 'final'
                                  ? 'bg-emerald-500/15 text-emerald-800 dark:text-emerald-200'
                                  : 'bg-amber-500/15 text-amber-900 dark:text-amber-100',
                              )}
                            >
                              {statusLabelTr(c.status)}
                            </span>
                            {c.archived_at ? (
                              <span className="inline-flex rounded-full bg-slate-500/15 px-2.5 py-1 text-[11px] font-semibold leading-none text-slate-700 dark:text-slate-300 sm:text-xs">
                                Arşivde
                              </span>
                            ) : null}
                            <span className="text-muted-foreground w-full text-[11px] tabular-nums sm:w-auto sm:text-xs">
                              {formatCalcListDate(c.created_at)}
                            </span>
                          </div>
                        </div>
                        <div className="flex shrink-0 flex-col gap-2 border-border pt-1 sm:border-t-0 sm:pt-0 sm:text-right">
                          <div className="font-mono text-base font-bold tabular-nums text-foreground sm:text-lg">
                            {(c.result?.total_tl as number)?.toFixed?.(2) ?? c.result?.total_tl ?? '—'} TL
                          </div>
                          <div className="flex flex-wrap gap-1.5 sm:justify-end">
                            {c.status === 'draft' && !c.archived_at && (me?.role === 'school_admin' || me?.role === 'superadmin') && (
                              <>
                                <Button size="sm" variant="secondary" className="h-8 gap-1 px-2 text-xs" disabled={busy} onClick={() => void startEdit(c.id)}>
                                  <Pencil className="size-3.5 shrink-0" />
                                  Düzenle
                                </Button>
                                <Button size="sm" className="h-8 gap-1 text-xs" disabled={busy} onClick={() => void doFinalize(c.id)}>
                                  Kesinleştir
                                </Button>
                              </>
                            )}
                            {!c.archived_at && (me?.role === 'school_admin' || me?.role === 'superadmin') && (
                              <Button size="sm" variant="outline" className="h-8 gap-1 px-2 text-xs" disabled={busy} onClick={() => void doArchive(c.id)}>
                                <Archive className="size-3.5 shrink-0" />
                                Arşivle
                              </Button>
                            )}
                            {c.archived_at && (me?.role === 'school_admin' || me?.role === 'superadmin') && (
                              <Button size="sm" variant="outline" className="h-8 gap-1 px-2 text-xs" disabled={busy} onClick={() => void doUnarchive(c.id)}>
                                <ArchiveRestore className="size-3.5 shrink-0" />
                                Arşivden çıkar
                              </Button>
                            )}
                            {((c.status === 'draft' && !c.archived_at) || !!c.archived_at) && (me?.role === 'school_admin' || me?.role === 'superadmin') && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-destructive hover:text-destructive h-8 gap-1 px-2 text-xs"
                                disabled={busy}
                                onClick={() => void doDelete(c.id)}
                              >
                                <Trash2 className="size-3.5 shrink-0" />
                                Sil
                              </Button>
                            )}
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-8 gap-1 text-xs"
                              disabled={pdfBusy === c.id}
                              onClick={() => {
                                setPdfBusy(c.id);
                                setErr(null);
                                downloadYollukPdf(c.id)
                                  .then(() => toast.success('PDF indirildi'))
                                  .catch((e) => {
                                    const msg = e instanceof Error ? e.message : String(e);
                                    setErr(msg);
                                    toast.error('PDF indirilemedi', { description: msg });
                                  })
                                  .finally(() => setPdfBusy(null));
                              }}
                            >
                              <FileDown className="size-3.5 shrink-0" />
                              PDF
                            </Button>
                          </div>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
