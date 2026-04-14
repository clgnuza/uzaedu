'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { apiFetch, getApiUrl } from '@/lib/api';
import { COOKIE_SESSION_TOKEN } from '@/lib/auth-session';
import { butterflyExamApiQuery } from '@/lib/butterfly-exam-school-q';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { toast } from 'sonner';
import {
  FileSpreadsheet, Settings2, Download, X, Plus, Trash2,
  GripHorizontal, Check, FileText, Upload, QrCode, FileUp,
  Printer, BookOpen, Users, LayoutList,
} from 'lucide-react';
import { cn } from '@/lib/utils';

/* ─────────── types ─────────── */
type Plan = {
  id: string;
  title: string;
  examStartsAt?: string;
  rules?: Record<string, unknown> & {
    classSubjectAssignments?: Array<{ classId: string; subjectName: string; className?: string }>;
    participantClassIds?: string[];
    lessonPeriodLabel?: string;
    cityLine?: string;
    academicYear?: string;
    duzenleyenName?: string;
    duzenleyenTitle?: string;
    onaylayanName?: string;
    onaylayanTitle?: string;
    uploadedPapers?: Array<{ subjectName: string; filename: string; size: number; uploadedAt: string }>;
  };
};

type RoomRow = { id: string; name: string; buildingName?: string; capacity: number };

type EokulPreview = {
  headers: string[];
  rows: Array<{ row: number; name: string; studentNumber: string | null; classRaw: string | null }>;
};

type FieldType = 'studentName' | 'studentNumber' | 'className' | 'attendance';
type FieldItem = {
  id: string;
  fieldType: FieldType;
  label: string;
  pageIndex: number;
  xPct: number;
  yPct: number;
};

const FIELD_DEFS: { type: FieldType; label: string; color: string }[] = [
  { type: 'studentName', label: 'Öğrenci Adı Soyadı', color: 'bg-blue-100 border-blue-400 text-blue-800' },
  { type: 'studentNumber', label: 'Öğrenci No', color: 'bg-emerald-100 border-emerald-400 text-emerald-800' },
  { type: 'className', label: 'Öğrenci Sınıfı', color: 'bg-violet-100 border-violet-400 text-violet-800' },
  { type: 'attendance', label: 'Sınava Geldi', color: 'bg-amber-100 border-amber-400 text-amber-800' },
];

const TABS_DEF = [
  {
    id: 'paper', label: 'Sınav Kağıdı', shortLabel: 'Kağıt', icon: FileText,
    activeClass: 'from-indigo-600 to-violet-600 shadow-indigo-500/35 ring-indigo-400/35',
    idleClass: 'text-indigo-950/90 hover:bg-indigo-500/10 dark:text-indigo-100/90 dark:hover:bg-indigo-950/40',
  },
  {
    id: 'upload', label: 'Kağıt Yükle', shortLabel: 'Yükle', icon: FileUp,
    activeClass: 'from-sky-600 to-cyan-600 shadow-sky-500/30 ring-sky-400/30',
    idleClass: 'text-sky-950/90 hover:bg-sky-500/10 dark:text-sky-100/90 dark:hover:bg-sky-950/40',
  },
  {
    id: 'reports', label: 'Raporlar', shortLabel: 'Rapor', icon: Printer,
    activeClass: 'from-teal-600 to-emerald-600 shadow-teal-500/25 ring-teal-400/25',
    idleClass: 'text-teal-950/90 hover:bg-teal-500/10 dark:text-teal-100/90 dark:hover:bg-teal-950/45',
  },
  {
    id: 'pdf', label: 'Salon PDF', shortLabel: 'PDF', icon: Download,
    activeClass: 'from-amber-600 to-orange-600 shadow-amber-500/25 ring-amber-400/25',
    idleClass: 'text-amber-950/90 hover:bg-amber-500/10 dark:text-amber-100/90 dark:hover:bg-amber-950/40',
  },
  {
    id: 'rules', label: 'Kural Ayarları', shortLabel: 'Kurallar', icon: Settings2,
    activeClass: 'from-rose-600 to-pink-600 shadow-rose-500/25 ring-rose-400/25',
    idleClass: 'text-rose-950/90 hover:bg-rose-500/10 dark:text-rose-100/90 dark:hover:bg-rose-950/40',
  },
  {
    id: 'eokul', label: 'E-Okul Excel', shortLabel: 'E-Okul', icon: FileSpreadsheet,
    activeClass: 'from-violet-600 to-fuchsia-600 shadow-violet-500/25 ring-violet-400/25',
    idleClass: 'text-violet-950/90 hover:bg-violet-500/10 dark:text-violet-100/90 dark:hover:bg-violet-950/45',
  },
] as const;
type TabId = typeof TABS_DEF[number]['id'];

/* ─────────── main component ─────────── */
export default function KelebekAyarlarPage() {
  const { token, me } = useAuth();
  const searchParams = useSearchParams();
  const schoolQ = butterflyExamApiQuery(me?.role ?? null, searchParams.get('school_id'));
  const isAdmin = me?.role === 'school_admin' || me?.role === 'superadmin' || me?.role === 'moderator';

  const [tab, setTab] = useState<TabId>('paper');
  const [loading, setLoading] = useState(true);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [rooms, setRooms] = useState<RoomRow[]>([]);
  const [planId, setPlanId] = useState('');
  const [saving, setSaving] = useState(false);
  const [pdfRoom, setPdfRoom] = useState<string | null>(null);

  /* ─── Rules state ─── */
  const [sameAdj, setSameAdj] = useState<'forbid' | 'allow'>('forbid');
  const [sameSkip, setSameSkip] = useState<'forbid' | 'allow'>('forbid');
  const [dist, setDist] = useState<'round_robin' | 'constraint_greedy' | 'swap_optimize'>('constraint_greedy');
  const [footerLines, setFooterLines] = useState<string[]>([]);
  const [buildingStrategy, setBuildingStrategy] = useState<'inter_building' | 'intra_building'>('inter_building');
  const [roomPick, setRoomPick] = useState<Record<string, boolean>>({});

  /* ─── Exam Paper state ─── */
  const [paperMode, setPaperMode] = useState<'custom' | 'template'>('custom');
  const [showQrCode, setShowQrCode] = useState(true);
  const [qrCorner, setQrCorner] = useState<'tl' | 'tr' | 'bl' | 'br'>('tr');
  /* ─── Upload state ─── */
  const [uploadFiles, setUploadFiles] = useState<Record<string, File>>({});
  const [uploading, setUploading] = useState(false);
  /* ─── Report (Takvim) state ─── */
  const [reportType, setReportType] = useState<'genel' | 'sinif' | 'sube'>('genel');
  const [reportGrade, setReportGrade] = useState<number>(9);
  const [reportClassId, setReportClassId] = useState('');
  const [reportPlanIds, setReportPlanIds] = useState<Set<string>>(new Set());
  const [cityLine, setCityLine] = useState('');
  const [academicYear, setAcademicYear] = useState('');
  const [duzenleyenName, setDuzenleyenName] = useState('');
  const [duzenleyenTitle, setDuzenleyenTitle] = useState('Müdür Yardımcısı');
  const [onaylayanName, setOnaylayanName] = useState('');
  const [onaylayanTitle, setOnaylayanTitle] = useState('Müdür');
  const [classes, setClasses] = useState<Array<{ id: string; name: string; grade?: number }>>([]);
  const [pdfReport, setPdfReport] = useState(false);
  const [pageCount, setPageCount] = useState(1);
  const [usedPageCount, setUsedPageCount] = useState(1);
  const [currentPage, setCurrentPage] = useState(0);
  const [enabledFields, setEnabledFields] = useState<Set<FieldType>>(new Set(['studentName', 'studentNumber', 'className', 'attendance']));
  const [fields, setFields] = useState<FieldItem[]>([]);
  const [dragging, setDragging] = useState<{ id: string; startX: number; startY: number; origXPct: number; origYPct: number } | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);

  /* ─── E-Okul state ─── */
  const [eokul, setEokul] = useState<EokulPreview | null>(null);
  const [eokulLoading, setEokulLoading] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const [p, r, cl] = await Promise.all([
        apiFetch<Plan[]>(`/butterfly-exam/plans${schoolQ}`, { token }),
        apiFetch<RoomRow[]>(`/butterfly-exam/rooms${schoolQ}`, { token }),
        apiFetch<Array<{ id: string; name: string; grade?: number }>>(`/butterfly-exam/classes${schoolQ}`, { token }).catch(() => []),
      ]);
      setPlans(p);
      setRooms(r);
      setClasses(cl);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Yüklenemedi');
    } finally {
      setLoading(false);
    }
  }, [token, schoolQ]);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    if (!plans.length) { setPlanId(''); return; }
    if (!planId || !plans.some((x) => x.id === planId)) setPlanId(plans[0].id);
    setReportPlanIds(new Set(plans.map((p) => p.id)));

    // Pre-fill report settings from any plan that has them
    const src = plans.find((p) => p.rules?.cityLine || p.rules?.duzenleyenName);
    if (src?.rules) {
      const r = src.rules as Record<string, string>;
      if (r.cityLine) setCityLine(r.cityLine);
      if (r.academicYear) setAcademicYear(r.academicYear);
      if (r.duzenleyenName) setDuzenleyenName(r.duzenleyenName);
      if (r.duzenleyenTitle) setDuzenleyenTitle(r.duzenleyenTitle);
      if (r.onaylayanName) setOnaylayanName(r.onaylayanName);
      if (r.onaylayanTitle) setOnaylayanTitle(r.onaylayanTitle);
    }
  }, [plans, planId]);

  const selected = plans.find((x) => x.id === planId);

  // Sync rules from selected plan
  useEffect(() => {
    if (!selected?.rules) return;
    const raw = selected.rules;
    setSameAdj(raw.sameClassAdjacent === 'allow' ? 'allow' : 'forbid');
    setSameSkip(raw.sameClassSkipOne === 'allow' ? 'allow' : 'forbid');
    const dm = raw.distributionMode;
    if (dm === 'round_robin' || dm === 'constraint_greedy' || dm === 'swap_optimize') setDist(dm);
    else setDist('constraint_greedy');
    const fl = raw.reportFooterLines;
    setFooterLines(Array.isArray(fl) && fl.length ? fl.map((x) => String(x)) : []);
    const bps = raw.buildingPlacementStrategy;
    setBuildingStrategy(bps === 'intra_building' ? 'intra_building' : 'inter_building');
  }, [selected?.id, selected?.rules]);

  // Sync room picks from selected plan
  useEffect(() => {
    if (!rooms.length) return;
    const raw = selected?.rules as Record<string, unknown> | undefined;
    const ids = raw && Array.isArray(raw.roomIds) && (raw.roomIds as unknown[]).length > 0 ? (raw.roomIds as string[]) : null;
    setRoomPick(Object.fromEntries(rooms.map((r) => [r.id, !ids || ids.includes(r.id)])));
  }, [selected?.id, rooms, selected?.rules]);

  // Sync exam paper config from selected plan
  useEffect(() => {
    const cfg = (selected?.rules as Record<string, unknown> | undefined)?.examPaperConfig as Record<string, unknown> | undefined;
      if (cfg) {
      setPageCount(typeof cfg.pageCount === 'number' ? cfg.pageCount : 1);
      setUsedPageCount(typeof cfg.usedPageCount === 'number' ? cfg.usedPageCount : 1);
      setShowQrCode(cfg.showQrCode !== false);
      if (cfg.qrCorner === 'tl' || cfg.qrCorner === 'tr' || cfg.qrCorner === 'bl' || cfg.qrCorner === 'br') setQrCorner(cfg.qrCorner as 'tl' | 'tr' | 'bl' | 'br');
      if (Array.isArray(cfg.fields)) {
        const loadedFields = (cfg.fields as Array<Record<string, unknown>>).map((f, i) => ({
          id: `f${i}`,
          fieldType: f.fieldType as FieldType,
          label: String(f.label),
          pageIndex: typeof f.pageIndex === 'number' ? f.pageIndex : 0,
          xPct: typeof f.xPct === 'number' ? f.xPct : 10,
          yPct: typeof f.yPct === 'number' ? f.yPct : 10 + i * 8,
        }));
        setFields(loadedFields);
        setEnabledFields(new Set(loadedFields.map((f) => f.fieldType)));
      }
    }
  }, [selected?.id, selected?.rules]);

  /* ─── Drag handlers ─── */
  const onFieldMouseDown = (e: React.MouseEvent, id: string) => {
    if (!canvasRef.current) return;
    e.preventDefault();
    const f = fields.find((x) => x.id === id);
    if (!f) return;
    setDragging({ id, startX: e.clientX, startY: e.clientY, origXPct: f.xPct, origYPct: f.yPct });
  };

  useEffect(() => {
    if (!dragging) return;
    const onMove = (e: MouseEvent) => {
      if (!canvasRef.current || !dragging) return;
      const rect = canvasRef.current.getBoundingClientRect();
      const dx = e.clientX - dragging.startX;
      const dy = e.clientY - dragging.startY;
      const newX = Math.max(0, Math.min(90, dragging.origXPct + (dx / rect.width) * 100));
      const newY = Math.max(0, Math.min(95, dragging.origYPct + (dy / rect.height) * 100));
      setFields((prev) => prev.map((f) => f.id === dragging.id ? { ...f, xPct: newX, yPct: newY } : f));
    };
    const onUp = () => setDragging(null);
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    return () => { document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp); };
  }, [dragging]);

  const addField = (fieldType: FieldType) => {
    const def = FIELD_DEFS.find((d) => d.type === fieldType);
    if (!def) return;
    const existing = fields.filter((f) => f.fieldType === fieldType && f.pageIndex === currentPage);
    if (existing.length > 0) { toast.info('Bu alan zaten bu sayfada mevcut'); return; }
    setFields((prev) => [...prev, {
      id: `f${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      fieldType,
      label: def.label,
      pageIndex: currentPage,
      xPct: 10,
      yPct: 10 + (fields.filter((f) => f.pageIndex === currentPage).length * 8),
    }]);
  };

  const removeField = (id: string) => setFields((prev) => prev.filter((f) => f.id !== id));

  const toggleField = (ft: FieldType) => {
    if (enabledFields.has(ft)) {
      setEnabledFields((prev) => { const next = new Set(prev); next.delete(ft); return next; });
      setFields((f) => f.filter((x) => x.fieldType !== ft));
    } else {
      setEnabledFields((prev) => { const next = new Set(prev); next.add(ft); return next; });
      addField(ft);
    }
  };

  const savePaperConfig = async () => {
    if (!token || !planId) return;
    setSaving(true);
    try {
      await apiFetch(`/butterfly-exam/plans/${planId}${schoolQ}`, {
        method: 'PATCH', token,
        body: JSON.stringify({
          rules: {
            examPaperConfig: { pageCount, usedPageCount, fields, showQrCode, qrCorner },
          },
        }),
      });
      toast.success('Sınav kağıdı ayarları kaydedildi');
      void load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Kaydedilemedi');
    } finally {
      setSaving(false);
    }
  };

  const saveRules = async () => {
    if (!token || !planId) return;
    setSaving(true);
    try {
      const picked = Object.entries(roomPick).filter(([, v]) => v).map(([k]) => k);
      const roomIds = picked.length < rooms.length ? picked : undefined;
      const lines = footerLines.filter(Boolean);
      await apiFetch(`/butterfly-exam/plans/${planId}${schoolQ}`, {
        method: 'PATCH', token,
        body: JSON.stringify({ rules: {
          buildingPlacementStrategy: buildingStrategy,
          roomIds,
          sameClassAdjacent: sameAdj,
          sameClassSkipOne: sameSkip,
          distributionMode: dist,
          reportFooterLines: lines,
        }}),
      });
      toast.success('Kurallar kaydedildi');
      void load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Kaydedilemedi');
    } finally {
      setSaving(false);
    }
  };

  const downloadSalonPdf = async (roomId: string) => {
    if (!token || !planId) return;
    const qs = new URLSearchParams({ room_id: roomId });
    const sid = searchParams.get('school_id');
    if ((me?.role === 'superadmin' || me?.role === 'moderator') && sid) qs.set('school_id', sid);
    setPdfRoom(roomId);
    try {
      const headers: Record<string, string> = {};
      if (token !== COOKIE_SESSION_TOKEN) headers.Authorization = `Bearer ${token}`;
      const res = await fetch(getApiUrl(`/butterfly-exam/plans/${planId}/pdf/salon?${qs}`), { credentials: 'include', headers });
      if (!res.ok) throw new Error('PDF alınamadı');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = Object.assign(document.createElement('a'), { href: url, download: `salon-${roomId.slice(0, 8)}.pdf` });
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success('PDF indirildi');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'İndirilemedi');
    } finally {
      setPdfRoom(null);
    }
  };

  const downloadExamPaperLabels = async (roomId?: string) => {
    if (!token || !planId) return;
    const qs = new URLSearchParams();
    const sid = searchParams.get('school_id');
    if ((me?.role === 'superadmin' || me?.role === 'moderator') && sid) qs.set('school_id', sid);
    if (roomId) qs.set('room_id', roomId);
    try {
      const headers: Record<string, string> = {};
      if (token !== COOKIE_SESSION_TOKEN) headers.Authorization = `Bearer ${token}`;
      const res = await fetch(getApiUrl(`/butterfly-exam/plans/${planId}/pdf/sinav-kagitlari?${qs}`), { credentials: 'include', headers });
      if (!res.ok) throw new Error('PDF alınamadı');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = Object.assign(document.createElement('a'), { href: url, download: `sinav-kagitlari.pdf` });
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success('Sınav kağıtları PDF indirildi');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'İndirilemedi');
    }
  };

  const downloadTakvimPdf = async () => {
    if (!token || reportPlanIds.size === 0) return;
    setPdfReport(true);
    try {
      const qs = new URLSearchParams();
      qs.set('plan_ids', [...reportPlanIds].join(','));
      qs.set('type', reportType);
      if (reportType === 'sinif') qs.set('grade', String(reportGrade));
      if (reportType === 'sube' && reportClassId) qs.set('class_id', reportClassId);
      if (cityLine) qs.set('city_line', cityLine);
      if (academicYear) qs.set('academic_year', academicYear);
      if (duzenleyenName) { qs.set('duzenleyen_name', duzenleyenName); qs.set('duzenleyen_title', duzenleyenTitle); }
      if (onaylayanName) { qs.set('onaylayan_name', onaylayanName); qs.set('onaylayan_title', onaylayanTitle); }
      const sid = searchParams.get('school_id');
      if ((me?.role === 'superadmin' || me?.role === 'moderator') && sid) qs.set('school_id', sid);
      const headers: Record<string, string> = {};
      if (token !== COOKIE_SESSION_TOKEN) headers.Authorization = `Bearer ${token}`;
      const res = await fetch(getApiUrl(`/butterfly-exam/pdf/takvim?${qs}`), { credentials: 'include', headers });
      if (!res.ok) throw new Error('PDF alınamadı');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = Object.assign(document.createElement('a'), { href: url, download: 'sinav-takvimi.pdf' });
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success('Sınav takvimi indirildi');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'İndirilemedi');
    } finally {
      setPdfReport(false);
    }
  };

  const onEokulFile = async (file: File | undefined) => {
    if (!file || !token) return;
    setEokulLoading(true); setEokul(null);
    try {
      const fd = new FormData(); fd.append('file', file);
      const headers: Record<string, string> = {};
      if (token !== COOKIE_SESSION_TOKEN) headers.Authorization = `Bearer ${token}`;
      const res = await fetch(getApiUrl('/butterfly-exam/import/eokul-preview'), { method: 'POST', body: fd, credentials: 'include', headers });
      if (!res.ok) { const j = await res.json().catch(() => ({})) as { message?: string }; throw new Error(j.message ?? 'Hata'); }
      setEokul(await res.json() as EokulPreview);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Dosya okunamadı');
    } finally {
      setEokulLoading(false);
    }
  };

  /* ─── Render ─── */
  if (loading) return <div className="flex justify-center py-16"><LoadingSpinner /></div>;

  const pageFields = fields.filter((f) => f.pageIndex === currentPage);

  return (
    <div className="space-y-4">
      {/* Plan Selector */}
      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-sm font-medium">
          <Settings2 className="size-4 text-indigo-600" />
          Sınav Oturumu:
        </label>
        <select
          className="h-9 rounded-lg border border-input bg-white px-3 text-sm dark:bg-zinc-900 max-w-xs"
          value={planId}
          onChange={(e) => setPlanId(e.target.value)}>
          {plans.length === 0 && <option value="">Önce sınav oluşturun</option>}
          {plans.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
        </select>
      </div>

      {/* Tab Nav */}
      <nav className="flex gap-1.5 overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] sm:flex-wrap sm:gap-2 sm:overflow-visible [&::-webkit-scrollbar]:hidden">
        {TABS_DEF.map((t) => {
          const Icon = t.icon;
          const active = tab === t.id;
          return (
            <button key={t.id} type="button" onClick={() => setTab(t.id)}
              className={cn(
                'flex min-w-22 flex-1 shrink-0 snap-start items-center justify-center gap-1.5 rounded-xl border border-transparent px-2.5 py-2.5 text-center text-[11px] font-semibold transition-all duration-200 sm:min-w-0 sm:gap-2 sm:px-3 sm:text-xs',
                active
                  ? cn('bg-linear-to-r text-white shadow-lg ring-2 ring-offset-2 ring-offset-background dark:ring-offset-zinc-950', t.activeClass)
                  : cn('bg-white/55 dark:bg-zinc-900/45', t.idleClass),
              )}>
              <Icon className="size-3.5 shrink-0 opacity-95 sm:size-4" strokeWidth={2} />
              <span className="leading-tight sm:hidden">{t.shortLabel}</span>
              <span className="hidden leading-tight sm:inline">{t.label}</span>
            </button>
          );
        })}
      </nav>

      {/* ═══ TAB: Sınav Kağıdı ═══ */}
      {tab === 'paper' && (
        <div className="rounded-2xl border border-white/60 bg-white/80 shadow-sm dark:border-zinc-800/40 dark:bg-zinc-900/60">
          <div className="border-b border-slate-100 px-5 py-4 dark:border-zinc-800">
            <p className="font-semibold">Sınav Kağıdı Önizleme ve Ayarlar</p>
            {planId && <p className="text-xs text-muted-foreground">{plans.find(p => p.id === planId)?.title}</p>}
          </div>

          {!planId ? (
            <div className="p-6 text-center text-sm text-muted-foreground">Önce sınav oturumu seçin.</div>
          ) : (
            <div className="flex flex-col gap-0 lg:flex-row">
              {/* Left settings panel */}
              <div className="w-full border-b border-slate-100 p-5 dark:border-zinc-800 lg:w-64 lg:shrink-0 lg:border-b-0 lg:border-r">
                <div className="space-y-5">
                  {/* Yerleştirme Modu */}
                  <div>
                    <p className="mb-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Yerleştirme Modu:</p>
                    <div className="space-y-1.5">
                      <label className={cn('flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-xs transition',
                        paperMode === 'custom' ? 'border-indigo-400/60 bg-indigo-50 dark:bg-indigo-950/25' : 'border-slate-200 hover:bg-slate-50 dark:border-zinc-700')}>
                        <input type="radio" checked={paperMode === 'custom'} onChange={() => setPaperMode('custom')} />
                        Alanları Ayrı Ayrı Yerleştir
                      </label>
                      <label className={cn('flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-xs transition',
                        paperMode === 'template' ? 'border-emerald-400/60 bg-emerald-50 dark:bg-emerald-950/25' : 'border-slate-200 hover:bg-slate-50 dark:border-zinc-700')}>
                        <input type="radio" checked={paperMode === 'template'} onChange={() => setPaperMode('template')} />
                        Hazır Şablon Kullan
                      </label>
                    </div>
                  </div>

                  {/* Kağıt Ayarları */}
                  <div>
                    <p className="mb-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Sınav Kağıdı Ayarları:</p>
                    <div className="space-y-2">
                      <label className="block text-xs">
                        <span className="text-muted-foreground">PDF Sayfa Sayısı</span>
                        <Input type="number" min={1} max={20} value={pageCount}
                          onChange={(e) => setPageCount(Math.max(1, parseInt(e.target.value) || 1))}
                          className="mt-1 h-8 text-sm" />
                      </label>
                      <label className="block text-xs">
                        <span className="text-muted-foreground">Kullanılacak Sayfa Sayısı</span>
                        <Input type="number" min={1} max={pageCount} value={usedPageCount}
                          onChange={(e) => setUsedPageCount(Math.max(1, Math.min(pageCount, parseInt(e.target.value) || 1)))}
                          className="mt-1 h-8 text-sm" />
                      </label>
                    </div>
                  </div>

                  {/* Alan Seçimi */}
                  <div>
                    <p className="mb-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Yazdırılacak Alanları Seçin:</p>
                    <div className="space-y-1.5">
                      {FIELD_DEFS.map((fd) => (
                        <label key={fd.type}
                          className={cn('flex cursor-pointer items-center gap-2 rounded-lg border px-2.5 py-1.5 text-xs transition',
                            enabledFields.has(fd.type) ? 'border-indigo-300/60 bg-indigo-50/80 dark:bg-indigo-950/20' : 'border-slate-200 dark:border-zinc-700')}>
                          <div className={cn('flex size-4 items-center justify-center rounded border-2',
                            enabledFields.has(fd.type) ? 'border-indigo-600 bg-indigo-600' : 'border-slate-300')}>
                            {enabledFields.has(fd.type) && <Check className="size-2.5 text-white" />}
                          </div>
                          <input type="checkbox" checked={enabledFields.has(fd.type)}
                            onChange={() => toggleField(fd.type)} className="sr-only" />
                          {fd.label}
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* QR Code */}
                  <div>
                    <p className="mb-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Karekod (QR):</p>
                    <label className={cn('flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-xs transition',
                      showQrCode ? 'border-violet-400/60 bg-violet-50 dark:bg-violet-950/20' : 'border-slate-200 hover:bg-slate-50 dark:border-zinc-700')}>
                      <div className={cn('flex size-4 items-center justify-center rounded border-2',
                        showQrCode ? 'border-violet-600 bg-violet-600' : 'border-slate-300')}>
                        {showQrCode && <Check className="size-2.5 text-white" />}
                      </div>
                      <input type="checkbox" checked={showQrCode} onChange={(e) => setShowQrCode(e.target.checked)} className="sr-only" />
                      <QrCode className="size-3.5 text-violet-600" /> Köşeye karekod ekle
                    </label>
                    {showQrCode && (
                      <div className="mt-2 grid grid-cols-2 gap-1">
                        {(['tl', 'tr', 'bl', 'br'] as const).map((c) => (
                          <button key={c} type="button"
                            onClick={() => setQrCorner(c)}
                            className={cn('rounded-lg border py-1 text-[11px] font-medium transition',
                              qrCorner === c ? 'border-violet-500 bg-violet-600 text-white' : 'border-slate-200 text-muted-foreground hover:bg-slate-50 dark:border-zinc-700 dark:hover:bg-zinc-800')}>
                            {c === 'tl' ? '↖ Sol Üst' : c === 'tr' ? '↗ Sağ Üst' : c === 'bl' ? '↙ Sol Alt' : '↘ Sağ Alt'}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Page nav */}
                  {pageCount > 1 && (
                    <div>
                      <p className="mb-2 text-xs font-semibold text-muted-foreground">Sayfa Seçimi:</p>
                      <div className="flex flex-wrap gap-1">
                        {Array.from({ length: pageCount }, (_, i) => (
                          <button key={i} type="button"
                            onClick={() => setCurrentPage(i)}
                            className={cn('size-7 rounded-md border text-xs font-medium',
                              currentPage === i ? 'border-indigo-600 bg-indigo-600 text-white' : 'border-slate-200 hover:bg-slate-50')}>
                            {i + 1}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {isAdmin && (
                    <Button size="sm" className="w-full gap-1.5" disabled={saving} onClick={() => void savePaperConfig()}>
                      {saving ? <LoadingSpinner /> : <><Check className="size-3.5" /> Kaydet</>}
                    </Button>
                  )}
                </div>
              </div>

              {/* Right: Canvas */}
              <div className="flex flex-1 flex-col gap-3 p-5">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold">
                    Sınav Kağıdı {pageCount > 1 ? `${currentPage + 1}. Sayfa` : '1. Sayfa'}
                  </p>
                  <div className="flex gap-1">
                    {FIELD_DEFS.filter((fd) => enabledFields.has(fd.type)).map((fd) => (
                      <button key={fd.type} type="button"
                        onClick={() => addField(fd.type)}
                        className={cn('rounded-lg border px-2 py-1 text-[10px] font-medium transition hover:opacity-80', fd.color)}>
                        + {fd.label.split(' ')[0]}
                      </button>
                    ))}
                  </div>
                </div>

                {/* A4 Canvas */}
                <div
                  ref={canvasRef}
                  className="relative mx-auto overflow-hidden rounded-xl border-2 border-slate-300 bg-white shadow-lg dark:border-zinc-600 dark:bg-zinc-100"
                  style={{ width: '100%', maxWidth: 480, aspectRatio: '210/297', cursor: dragging ? 'grabbing' : 'default' }}
                  onMouseDown={(e) => { if (e.target === canvasRef.current) return; }}
                >
                  {/* Paper content background */}
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-300 select-none pointer-events-none">
                    <div className="text-center opacity-30">
                      <p className="text-2xl font-bold text-slate-400">
                        {plans.find(p => p.id === planId)?.title?.split('/').pop()?.trim() ?? 'Sınav Kağıdı'}
                      </p>
                      <p className="mt-2 text-sm text-slate-300">Sorular</p>
                      <div className="mt-4 h-px w-32 bg-slate-200" />
                    </div>
                  </div>

                  {/* Ruler grid */}
                  <div className="absolute inset-0 pointer-events-none opacity-5"
                    style={{ backgroundImage: 'linear-gradient(to right, #000 1px, transparent 1px), linear-gradient(to bottom, #000 1px, transparent 1px)', backgroundSize: '10% 10%' }} />

                  {/* Draggable fields */}
                  {pageFields.map((f) => {
                    const def = FIELD_DEFS.find((d) => d.type === f.fieldType);
                    return (
                      <div
                        key={f.id}
                        className={cn(
                          'absolute flex cursor-grab items-center gap-1.5 rounded-md border-2 px-2 py-1 text-[11px] font-semibold shadow-md select-none active:cursor-grabbing',
                          def?.color ?? 'bg-slate-100 border-slate-400',
                          dragging?.id === f.id && 'ring-2 ring-indigo-400 ring-offset-1 cursor-grabbing'
                        )}
                        style={{ left: `${f.xPct}%`, top: `${f.yPct}%`, transform: 'translateY(-50%)', zIndex: dragging?.id === f.id ? 50 : 10 }}
                        onMouseDown={(e) => onFieldMouseDown(e, f.id)}
                      >
                        <GripHorizontal className="size-3 opacity-60" />
                        {f.label.toUpperCase()}
                        {isAdmin && (
                          <button type="button"
                            className="ml-0.5 rounded-full p-0.5 hover:bg-black/10"
                            onMouseDown={(e) => { e.stopPropagation(); removeField(f.id); }}>
                            <X className="size-2.5" />
                          </button>
                        )}
                      </div>
                    );
                  })}

                  {/* QR code corner preview */}
                  {showQrCode && (
                    <div className={cn(
                      'pointer-events-none absolute flex flex-col items-center justify-center rounded-md border-2 border-violet-400/70 bg-violet-50/80 dark:bg-violet-950/40',
                      'w-[10%] aspect-square',
                      qrCorner === 'tl' && 'left-2 top-2',
                      qrCorner === 'tr' && 'right-2 top-2',
                      qrCorner === 'bl' && 'left-2 bottom-2',
                      qrCorner === 'br' && 'right-2 bottom-2',
                    )}>
                      <QrCode className="size-[55%] text-violet-600 opacity-70" />
                      <span className="text-[6px] font-bold text-violet-500 mt-0.5">QR</span>
                    </div>
                  )}

                  {pageFields.length === 0 && (
                    <div className="absolute inset-0 flex items-end justify-center pb-6 pointer-events-none">
                      <p className="text-[11px] text-slate-300">Yukarıdaki butonlarla alan ekleyin ve sürükleyin</p>
                    </div>
                  )}
                </div>

                <p className="text-center text-[11px] text-muted-foreground">
                  Alanları sürükleyerek kağıt üzerinde konumlandırın • {pageFields.length} alan yerleştirildi
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ═══ TAB: Kağıt Yükle ═══ */}
      {tab === 'upload' && (
        <div className="rounded-2xl border border-white/60 bg-white/80 shadow-sm dark:border-zinc-800/40 dark:bg-zinc-900/60">
          <div className="border-b border-slate-100 px-5 py-4 dark:border-zinc-800">
            <p className="font-semibold flex items-center gap-2"><FileUp className="size-4 text-indigo-600" /> Sınav Kağıdı Yükle</p>
            <p className="text-xs text-muted-foreground">Sınıf veya grup bazlı PDF sınav kağıtları yükleyin</p>
          </div>
          {!planId ? (
            <div className="p-6 text-center text-sm text-muted-foreground">Sınav oturumu seçin.</div>
          ) : (
            <div className="p-5 space-y-4">
              {/* Subjects/classes from plan */}
              {(() => {
                const assignments = selected?.rules?.classSubjectAssignments ?? [];
                const groups = assignments.length > 0
                  ? [...new Map(assignments.map((a) => [a.subjectName, a.subjectName])).keys()]
                  : ['Genel'];
                return (
                  <div className="space-y-3">
                    {groups.map((grp) => {
                      const fileKey = `${planId}-${grp}`;
                      const f = uploadFiles[fileKey];
                      const classCount = assignments.filter((a) => a.subjectName === grp).length;
                        const savedPaper = selected?.rules?.uploadedPapers?.find((p) => p.subjectName === grp);
                        return (
                        <div key={grp}
                          className="flex items-center gap-3 rounded-xl border border-slate-200/60 bg-slate-50/60 px-4 py-3 dark:border-zinc-800/60 dark:bg-zinc-800/30">
                          <div className="rounded-lg bg-indigo-100 p-2 dark:bg-indigo-950/40">
                            <FileText className="size-4 text-indigo-600" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold">{grp}</p>
                            {classCount > 0 && <p className="text-xs text-muted-foreground">{classCount} sınıf</p>}
                            {f ? (
                              <p className="text-[11px] text-emerald-600 dark:text-emerald-400 truncate">✓ {f.name}</p>
                            ) : savedPaper ? (
                              <p className="text-[11px] text-emerald-600 dark:text-emerald-400 truncate">
                                ✓ {savedPaper.filename} · {new Date(savedPaper.uploadedAt).toLocaleDateString('tr-TR')}
                              </p>
                            ) : (
                              <p className="text-[11px] text-muted-foreground">PDF henüz yüklenmedi</p>
                            )}
                          </div>
                          <label className="shrink-0 cursor-pointer">
                            <input type="file" accept=".pdf,.PDF" className="sr-only"
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) setUploadFiles((prev) => ({ ...prev, [fileKey]: file }));
                              }} />
                            <span className={cn(
                              'flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition',
                              f ? 'border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:border-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300'
                                : 'border-indigo-300 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 dark:border-indigo-700 dark:bg-indigo-950/30 dark:text-indigo-300',
                            )}>
                              <Upload className="size-3" /> {f ? 'Değiştir' : 'PDF Seç'}
                            </span>
                          </label>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}

              <div className="rounded-lg border border-violet-200/60 bg-violet-50/60 px-3 py-2.5 dark:border-violet-800/40 dark:bg-violet-950/20">
                <p className="flex items-center gap-1.5 text-[11px] font-semibold text-violet-700 dark:text-violet-300 mb-1">
                  <QrCode className="size-3.5" /> Otomatik Karekod
                </p>
                <p className="text-[11px] text-violet-600 dark:text-violet-400">
                  Yazdırma sırasında her kağıdın köşesine öğrenci adı, numarası, sınıfı ve salon bilgisini içeren karekod otomatik eklenir. "Sınav Kağıdı" sekmesinden köşe konumunu ayarlayabilirsiniz.
                </p>
              </div>

              {planId && (
                <Button size="sm" variant="outline" className="gap-1.5 border-violet-300 text-violet-700 hover:bg-violet-50 dark:border-violet-700 dark:text-violet-300"
                  onClick={() => void downloadExamPaperLabels()}>
                  <Printer className="size-3.5" />
                  Tüm Salonlar — Sınav Kağıtlarını Yazdır
                </Button>
              )}

              {isAdmin && Object.keys(uploadFiles).length > 0 && (
                <Button size="sm" disabled={uploading} className="gap-1.5"
                  onClick={async () => {
                    if (!token) return;
                    setUploading(true);
                    try {
                      for (const [key, file] of Object.entries(uploadFiles)) {
                        const subjectName = key.replace(`${planId}-`, '');
                        const fd = new FormData();
                        fd.append('file', file);
                        fd.append('subjectName', subjectName);
                        await apiFetch(`/butterfly-exam/plans/${planId}/upload-paper${schoolQ}`, {
                          method: 'POST', token, body: fd,
                        }).catch(() => null);
                      }
                      toast.success(`${Object.keys(uploadFiles).length} kağıt yüklendi`);
                      setUploadFiles({});
                    } catch {
                      toast.error('Yükleme başarısız');
                    } finally {
                      setUploading(false);
                    }
                  }}>
                  {uploading ? <LoadingSpinner /> : <><Upload className="size-3.5" /> {Object.keys(uploadFiles).length} Kağıdı Yükle</>}
                </Button>
              )}
            </div>
          )}
        </div>
      )}

      {/* ═══ TAB: Raporlar ═══ */}
      {tab === 'reports' && (
        <div className="space-y-4">
          {/* Template cards */}
          <div className="grid gap-3 sm:grid-cols-3">
            {([
              { id: 'genel', label: 'Genel Sınav Takvimi', desc: 'Tüm sınıflar için ortak takvim cetveli', icon: LayoutList, color: 'indigo' },
              { id: 'sinif', label: 'Sınıf Bazlı Takvim', desc: 'Belirli sınıf düzeyi için takvim', icon: Users, color: 'emerald' },
              { id: 'sube', label: 'Şube Bazlı Takvim', desc: 'Tek şubeye özel sınav takvimi', icon: BookOpen, color: 'violet' },
            ] as const).map((t) => {
              const Icon = t.icon;
              const colorMap = {
                indigo: { sel: 'border-indigo-500 bg-indigo-50 dark:bg-indigo-950/30', icon: 'bg-indigo-100 text-indigo-600 dark:bg-indigo-950/40', dot: 'bg-indigo-500' },
                emerald: { sel: 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30', icon: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-950/40', dot: 'bg-emerald-500' },
                violet: { sel: 'border-violet-500 bg-violet-50 dark:bg-violet-950/30', icon: 'bg-violet-100 text-violet-600 dark:bg-violet-950/40', dot: 'bg-violet-500' },
              };
              const c = colorMap[t.color];
              return (
                <button key={t.id} type="button" onClick={() => setReportType(t.id)}
                  className={cn(
                    'flex flex-col items-start gap-2 rounded-2xl border-2 p-4 text-left transition',
                    reportType === t.id ? c.sel : 'border-slate-200/60 bg-white/80 hover:bg-slate-50 dark:border-zinc-800/40 dark:bg-zinc-900/60 dark:hover:bg-zinc-800/40'
                  )}>
                  <div className={cn('rounded-xl p-2', c.icon)}><Icon className="size-4" /></div>
                  <div>
                    <p className="text-sm font-semibold">{t.label}</p>
                    <p className="text-[11px] text-muted-foreground">{t.desc}</p>
                  </div>
                  {reportType === t.id && <div className={cn('h-1.5 w-6 rounded-full', c.dot)} />}
                </button>
              );
            })}
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            {/* Left: Filters + Plan selector */}
            <div className="rounded-2xl border border-white/60 bg-white/80 shadow-sm dark:border-zinc-800/40 dark:bg-zinc-900/60 p-5 space-y-4">
              {reportType === 'sinif' && (
                <label className="block text-xs">
                  <span className="mb-1 block font-semibold text-muted-foreground uppercase tracking-wide">Sınıf Düzeyi</span>
                  <select className="h-9 w-full rounded-lg border border-input bg-white px-3 text-sm dark:bg-zinc-900"
                    value={reportGrade} onChange={(e) => setReportGrade(Number(e.target.value))}>
                    {[9, 10, 11, 12].map((g) => <option key={g} value={g}>{g}. Sınıflar</option>)}
                  </select>
                </label>
              )}
              {reportType === 'sube' && (
                <label className="block text-xs">
                  <span className="mb-1 block font-semibold text-muted-foreground uppercase tracking-wide">Şube</span>
                  <select className="h-9 w-full rounded-lg border border-input bg-white px-3 text-sm dark:bg-zinc-900"
                    value={reportClassId} onChange={(e) => setReportClassId(e.target.value)}>
                    <option value="">Şube seçin</option>
                    {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </label>
              )}

              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Sınavlar</p>
                <div className="max-h-40 space-y-1 overflow-auto rounded-xl border border-slate-200 bg-slate-50/50 p-2 dark:border-zinc-700 dark:bg-zinc-800/30">
                  {plans.map((p) => (
                    <label key={p.id} className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-xs hover:bg-slate-100 dark:hover:bg-zinc-800">
                      <input type="checkbox" checked={reportPlanIds.has(p.id)}
                        onChange={(e) => setReportPlanIds((prev) => {
                          const s = new Set(prev);
                          if (e.target.checked) s.add(p.id); else s.delete(p.id);
                          return s;
                        })} />
                      <span className="flex-1 truncate">{p.title}</span>
                      <span className="text-[10px] text-muted-foreground">
                        {p.examStartsAt ? new Date(p.examStartsAt).toLocaleDateString('tr-TR') : ''}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            </div>

            {/* Right: Signature & header settings */}
            <div className="rounded-2xl border border-white/60 bg-white/80 shadow-sm dark:border-zinc-800/40 dark:bg-zinc-900/60 p-5 space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Başlık Bilgileri</p>
              <label className="block text-xs">
                <span className="mb-1 block text-muted-foreground">Şehir / İl Satırı</span>
                <Input value={cityLine} onChange={(e) => setCityLine(e.target.value)} placeholder="Erzurum Valiliği ..." className="h-8 text-xs" />
              </label>
              <label className="block text-xs">
                <span className="mb-1 block text-muted-foreground">Eğitim-Öğretim Yılı</span>
                <Input value={academicYear} onChange={(e) => setAcademicYear(e.target.value)} placeholder="2025 - 2026 Eğitim - Öğretim Yılı" className="h-8 text-xs" />
              </label>

              <p className="pt-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">İmza Bilgileri</p>
              <div className="grid grid-cols-2 gap-2">
                <label className="block text-xs">
                  <span className="mb-1 block text-muted-foreground">Düzenleyen Adı</span>
                  <Input value={duzenleyenName} onChange={(e) => setDuzenleyenName(e.target.value)} placeholder="Ad Soyad" className="h-8 text-xs" />
                </label>
                <label className="block text-xs">
                  <span className="mb-1 block text-muted-foreground">Ünvan</span>
                  <Input value={duzenleyenTitle} onChange={(e) => setDuzenleyenTitle(e.target.value)} placeholder="Müdür Yardımcısı" className="h-8 text-xs" />
                </label>
                <label className="block text-xs">
                  <span className="mb-1 block text-muted-foreground">Onaylayan Adı</span>
                  <Input value={onaylayanName} onChange={(e) => setOnaylayanName(e.target.value)} placeholder="Ad Soyad" className="h-8 text-xs" />
                </label>
                <label className="block text-xs">
                  <span className="mb-1 block text-muted-foreground">Ünvan</span>
                  <Input value={onaylayanTitle} onChange={(e) => setOnaylayanTitle(e.target.value)} placeholder="Müdür" className="h-8 text-xs" />
                </label>
              </div>

              <Button className="w-full mt-2 gap-1.5" disabled={pdfReport || reportPlanIds.size === 0}
                onClick={() => void downloadTakvimPdf()}>
                {pdfReport ? <LoadingSpinner /> : <><Download className="size-3.5" /> Sınav Takvimi PDF İndir</>}
              </Button>
            </div>
          </div>

          {/* Preview mock */}
          <div className="rounded-2xl border border-slate-200/60 bg-slate-50/60 dark:border-zinc-800/40 dark:bg-zinc-900/40 p-5">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Şablon Önizleme</p>
            <div className="mx-auto max-w-lg rounded-xl border border-slate-300/60 bg-white shadow-sm dark:border-zinc-700/60 dark:bg-zinc-800/80 overflow-hidden text-xs">
              {/* Header mock */}
              <div className="border-b border-slate-200 dark:border-zinc-700 px-4 py-3 text-center space-y-0.5">
                <p className="text-[10px] text-slate-400">T.C.</p>
                <p className="text-[10px] text-slate-500">{cityLine || 'İL / VALİLİK'}</p>
                <p className="font-bold text-[11px]">{plans.find(p => p.id === planId)?.title?.split(' — ')[0] ?? 'Okul Adı'}</p>
                <p className="text-[10px] text-slate-500">{academicYear || '2025 - 2026 Eğitim - Öğretim Yılı'}</p>
                <p className="font-semibold text-[11px] text-indigo-700 dark:text-indigo-300">
                  {[...reportPlanIds][0] ? plans.find(p => p.id === [...reportPlanIds][0])?.title : 'Dönem Adı'}
                </p>
                <p className="text-[10px] text-slate-500">
                  {reportType === 'sinif' ? `${reportGrade}. Sınıflar Sınav Takvimi`
                    : reportType === 'sube' ? `${classes.find(c => c.id === reportClassId)?.name ?? 'Şube'} Sınav Takvimi`
                    : 'Genel Sınav Takvimi'}
                </p>
              </div>
              {/* Table mock */}
              <table className="w-full text-[10px]">
                <thead>
                  <tr className="bg-slate-50 dark:bg-zinc-800/60 border-b border-slate-200 dark:border-zinc-700">
                    <th className="px-2 py-1.5 text-left font-semibold">S.N</th>
                    <th className="px-2 py-1.5 text-left font-semibold">Gün</th>
                    <th className="px-2 py-1.5 text-left font-semibold">Tarih</th>
                    <th className="px-2 py-1.5 text-left font-semibold">Saat</th>
                    <th className="px-2 py-1.5 text-left font-semibold">Sınav Dersi</th>
                    <th className="px-2 py-1.5 text-left font-semibold">Açıklama</th>
                  </tr>
                </thead>
                <tbody>
                  {plans.filter(p => reportPlanIds.has(p.id)).slice(0, 5).map((p, i) => {
                    const d = p.examStartsAt ? new Date(p.examStartsAt) : null;
                    const DAYS = ['Paz', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt'];
                    const subject = (p.rules?.classSubjectAssignments as Array<{subjectName:string}>|undefined)?.[0]?.subjectName
                      ?? p.title;
                    return (
                      <tr key={p.id} className="border-b border-slate-100 dark:border-zinc-800">
                        <td className="px-2 py-1">{i + 1}</td>
                        <td className="px-2 py-1">{d ? DAYS[d.getDay()] : ''}</td>
                        <td className="px-2 py-1">{d ? d.toLocaleDateString('tr-TR') : ''}</td>
                        <td className="px-2 py-1 text-slate-500">{p.rules?.lessonPeriodLabel ?? '—'}</td>
                        <td className="px-2 py-1 font-medium truncate max-w-[90px]">{subject}</td>
                        <td className="px-2 py-1 text-slate-400 text-[9px]">{(p.rules as Record<string,unknown>)?.examNote as string ?? '—'}</td>
                      </tr>
                    );
                  })}
                  {reportPlanIds.size === 0 && (
                    <tr><td colSpan={6} className="px-2 py-4 text-center text-slate-400">Sınav seçin</td></tr>
                  )}
                </tbody>
              </table>
              {/* Signature mock */}
              {(duzenleyenName || onaylayanName) && (
                <div className="flex justify-between px-6 py-3 text-[10px] border-t border-slate-200 dark:border-zinc-700">
                  {duzenleyenName && <div className="text-center"><p className="text-slate-400">Düzenleyen</p><p className="font-bold">{duzenleyenName.toUpperCase()}</p><p>{duzenleyenTitle}</p></div>}
                  {onaylayanName && <div className="text-center"><p className="text-slate-400">Onaylayan</p><p className="font-bold">{onaylayanName.toUpperCase()}</p><p>{onaylayanTitle}</p></div>}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ═══ TAB: Salon PDF ═══ */}
      {tab === 'pdf' && (
        <div className="rounded-2xl border border-white/60 bg-white/80 shadow-sm dark:border-zinc-800/40 dark:bg-zinc-900/60">
          <div className="border-b border-slate-100 px-5 py-4 dark:border-zinc-800">
            <p className="font-semibold">Salon Yoklama PDF</p>
            <p className="text-xs text-muted-foreground">Her salon için öğrenci yoklama listesi PDF indir</p>
          </div>
          <div className="p-5">
            {!planId ? (
              <p className="text-sm text-muted-foreground">Sınav oturumu seçin.</p>
            ) : rooms.length === 0 ? (
              <p className="text-sm text-muted-foreground">Salon tanımlı değil. Önce Salon İşlemleri'nden salon ekleyin.</p>
            ) : (
              <div className="space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                  <p className="text-sm text-muted-foreground">{rooms.length} salon listeleniyor</p>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" className="gap-1.5 border-violet-300 text-violet-700 hover:bg-violet-50 dark:border-violet-700 dark:text-violet-300"
                      onClick={() => void downloadExamPaperLabels()}>
                      <Printer className="size-3.5" /> Sınav Kağıtlarını Yazdır
                    </Button>
                    <Button size="sm" variant="outline" className="gap-1.5"
                      onClick={() => { for (const r of rooms) void downloadSalonPdf(r.id); }}>
                      <Download className="size-3.5" /> Yoklama PDF
                    </Button>
                  </div>
                </div>
                {rooms.map((r) => (
                  <div key={r.id}
                    className="flex items-center justify-between gap-2 rounded-xl border border-white/50 bg-white/70 px-3 py-2.5 shadow-sm dark:border-zinc-800/40 dark:bg-zinc-900/50">
                    <div className="flex items-center gap-2.5">
                      <div className="rounded-lg bg-indigo-100 p-1.5 dark:bg-indigo-950/40">
                        <FileText className="size-3.5 text-indigo-600" />
                      </div>
                      <div>
                        <p className="text-sm font-medium">{r.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {r.buildingName ? `${r.buildingName} · ` : ''}{r.capacity} koltuk
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-1.5">
                      <Button type="button" size="sm" variant="outline"
                        className="gap-1 text-xs border-violet-300 text-violet-700 hover:bg-violet-50 dark:border-violet-700 dark:text-violet-300"
                        onClick={() => void downloadExamPaperLabels(r.id)}>
                        <Printer className="size-3" /> Yazdır
                      </Button>
                      <Button type="button" size="sm" variant="outline"
                        disabled={pdfRoom === r.id}
                        className="gap-1 text-xs"
                        onClick={() => void downloadSalonPdf(r.id)}>
                        {pdfRoom === r.id ? <LoadingSpinner /> : <><Download className="size-3" /> Yoklama</>}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ═══ TAB: Kural Ayarları ═══ */}
      {tab === 'rules' && (
        <div className="rounded-2xl border border-white/60 bg-white/80 shadow-sm dark:border-zinc-800/40 dark:bg-zinc-900/60">
          <div className="border-b border-slate-100 px-5 py-4 dark:border-zinc-800">
            <p className="font-semibold">Kural Ayarları</p>
            <p className="text-xs text-muted-foreground">Yerleştirme kuralları ve salon seçimi</p>
          </div>
          {!planId ? (
            <div className="p-6 text-center text-sm text-muted-foreground">Sınav oturumu seçin.</div>
          ) : (
            <div className="p-5 space-y-5">
              {/* Building strategy */}
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Yerleştirme Stratejisi (Bina)</p>
                <div className="flex gap-2">
                  {[
                    { val: 'inter_building', label: 'Binalar Arası' },
                    { val: 'intra_building', label: 'Bina İçi' },
                  ].map((opt) => (
                    <label key={opt.val}
                      className={cn('flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2 text-sm transition',
                        buildingStrategy === opt.val ? 'border-indigo-400/60 bg-indigo-50 dark:bg-indigo-950/25' : 'border-slate-200 hover:bg-slate-50 dark:border-zinc-700')}>
                      <input type="radio" checked={buildingStrategy === opt.val}
                        onChange={() => setBuildingStrategy(opt.val as typeof buildingStrategy)} />
                      {opt.label}
                    </label>
                  ))}
                </div>
              </div>

              {/* Constraint selects */}
              <div className="grid gap-3 sm:grid-cols-3">
                {[
                  { label: 'Aynı sınıf yan yana', val: sameAdj, set: setSameAdj },
                  { label: 'Aynı sınıf arada bir', val: sameSkip, set: setSameSkip },
                ].map(({ label, val, set }) => (
                  <label key={label} className="block text-xs">
                    <span className="mb-1 block text-muted-foreground">{label}</span>
                    <select className="h-9 w-full rounded-lg border border-input bg-white px-3 text-sm dark:bg-zinc-900"
                      value={val} onChange={(e) => set(e.target.value as 'forbid' | 'allow')}>
                      <option value="forbid">Yasakla</option>
                      <option value="allow">İzin ver</option>
                    </select>
                  </label>
                ))}
                <label className="block text-xs">
                  <span className="mb-1 block text-muted-foreground">Dağıtım Algoritması</span>
                  <select className="h-9 w-full rounded-lg border border-input bg-white px-3 text-sm dark:bg-zinc-900"
                    value={dist} onChange={(e) => setDist(e.target.value as typeof dist)}>
                    <option value="constraint_greedy">Kurala göre (önerilen)</option>
                    <option value="round_robin">Salonlar arası sırayla</option>
                    <option value="swap_optimize">Takas ile iyileştir</option>
                  </select>
                </label>
              </div>

              {/* PDF footer notes */}
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">PDF Alt Notları</p>
                  <Button type="button" size="sm" variant="outline" className="h-7 gap-1 text-xs"
                    onClick={() => setFooterLines((l) => [...l, ''])}>
                    <Plus className="size-3" /> Madde Ekle
                  </Button>
                </div>
                <div className="space-y-1.5 rounded-xl border border-slate-200 bg-slate-50/50 p-2 dark:border-zinc-700 dark:bg-zinc-800/30">
                  {footerLines.length === 0 && <p className="py-2 text-center text-xs text-muted-foreground">Madde yok</p>}
                  {footerLines.map((line, i) => (
                    <div key={i} className="flex gap-2">
                      <Input value={line}
                        onChange={(e) => setFooterLines((fl) => fl.map((l, j) => j === i ? e.target.value : l))}
                        className="flex-1 h-8 text-xs" placeholder={`Madde ${i + 1}`} />
                      <button type="button"
                        onClick={() => setFooterLines((fl) => fl.filter((_, j) => j !== i))}
                        className="rounded p-1 text-rose-500 hover:bg-rose-50">
                        <Trash2 className="size-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Room selection */}
              {rooms.length > 0 && (
                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Bu Oturumda Kullanılacak Salonlar</p>
                  <div className="max-h-40 space-y-1 overflow-auto rounded-xl border border-slate-200 bg-slate-50/50 p-2 dark:border-zinc-700 dark:bg-zinc-800/30">
                    {rooms.map((r) => (
                      <label key={r.id} className="flex cursor-pointer items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-xs hover:bg-slate-100 dark:hover:bg-zinc-800">
                        <span className="flex items-center gap-2">
                          <input type="checkbox" checked={!!roomPick[r.id]}
                            onChange={(e) => setRoomPick((m) => ({ ...m, [r.id]: e.target.checked }))} />
                          {r.buildingName ? `${r.buildingName} · ` : ''}{r.name}
                        </span>
                        <span className="text-muted-foreground">{r.capacity} koltuk</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {isAdmin && (
                <Button size="sm" disabled={saving} onClick={() => void saveRules()} className="gap-1.5">
                  {saving ? <LoadingSpinner /> : <><Check className="size-3.5" /> Kuralları Kaydet</>}
                </Button>
              )}
            </div>
          )}
        </div>
      )}

      {/* ═══ TAB: E-Okul Excel ═══ */}
      {tab === 'eokul' && (
        <div className="rounded-2xl border border-white/60 bg-white/80 shadow-sm dark:border-zinc-800/40 dark:bg-zinc-900/60">
          <div className="border-b border-slate-100 px-5 py-4 dark:border-zinc-800">
            <p className="font-semibold flex items-center gap-2">
              <FileSpreadsheet className="size-4 text-emerald-600" /> E-Okul Excel Önizleme
            </p>
            <p className="text-xs text-muted-foreground">E-Okul'dan indirilen Excel dosyasını yükleyin</p>
          </div>
          <div className="p-5 space-y-4">
            {!isAdmin ? (
              <p className="text-sm text-muted-foreground">Bu işlem için yönetici yetkisi gerekli.</p>
            ) : (
              <>
                <label className={cn(
                  'flex cursor-pointer flex-col items-center gap-3 rounded-xl border-2 border-dashed p-8 transition',
                  'border-emerald-300/60 bg-emerald-50/50 hover:bg-emerald-50 dark:border-emerald-900/40 dark:bg-emerald-950/20'
                )}>
                  <Upload className="size-8 text-emerald-500" />
                  <div className="text-center">
                    <p className="text-sm font-medium">Excel Dosyası Seç</p>
                    <p className="text-xs text-muted-foreground">.xlsx veya .xls formatında E-Okul öğrenci listesi</p>
                  </div>
                  <input type="file" className="sr-only"
                    accept=".xlsx,.xls,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                    disabled={eokulLoading}
                    onChange={(e) => void onEokulFile(e.target.files?.[0])} />
                </label>

                {eokulLoading && <div className="flex justify-center py-4"><LoadingSpinner /></div>}

                {eokul && eokul.rows.length > 0 && (
                  <div>
                    <p className="mb-2 text-sm font-semibold text-emerald-700 dark:text-emerald-300">
                      ✅ {eokul.rows.length} satır bulundu
                    </p>
                    <div className="overflow-auto rounded-xl border border-slate-200 dark:border-zinc-700 max-h-72">
                      <table className="w-full min-w-[400px] text-xs">
                        <thead className="sticky top-0 bg-slate-50 dark:bg-zinc-800/80 text-[10px] uppercase tracking-wide text-muted-foreground">
                          <tr>
                            <th className="px-3 py-2.5 text-left">Satır</th>
                            <th className="px-3 py-2.5 text-left">Ad Soyad</th>
                            <th className="px-3 py-2.5 text-left">Öğrenci No</th>
                            <th className="px-3 py-2.5 text-left">Sınıf</th>
                          </tr>
                        </thead>
                        <tbody>
                          {eokul.rows.slice(0, 100).map((row) => (
                            <tr key={row.row} className="border-t border-slate-100 hover:bg-slate-50 dark:border-zinc-800 dark:hover:bg-zinc-800/30">
                              <td className="px-3 py-1.5 text-muted-foreground tabular-nums">{row.row}</td>
                              <td className="px-3 py-1.5 font-medium">{row.name}</td>
                              <td className="px-3 py-1.5 tabular-nums">{row.studentNumber ?? '—'}</td>
                              <td className="px-3 py-1.5">{row.classRaw ?? '—'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {eokul.rows.length > 100 && (
                      <p className="mt-1 text-xs text-center text-muted-foreground">+ {eokul.rows.length - 100} daha...</p>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
