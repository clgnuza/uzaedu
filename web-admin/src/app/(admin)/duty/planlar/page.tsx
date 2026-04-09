'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import * as XLSX from 'xlsx';
import {
  ArrowLeft,
  FileText,
  Send,
  Upload,
  Download,
  FileDown,
  Zap,
  Trash2,
  ChevronDown,
  ChevronUp,
  Settings2,
  BarChart2,
  Archive,
  ArchiveRestore,
  CalendarRange,
} from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { apiFetch } from '@/lib/api';
import { toast } from 'sonner';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { EmptyState } from '@/components/ui/empty-state';
import { Alert } from '@/components/ui/alert';
import { cn } from '@/lib/utils';
import { DutyPageHeader } from '@/components/duty/duty-page-header';

type DutyPlan = {
  id: string;
  version: string | null;
  status: 'draft' | 'published';
  published_at: string | null;
  period_start: string | null;
  period_end: string | null;
  academic_year: string | null;
  created_at: string;
  archived_at?: string | null;
};

type UserItem = { id: string; display_name: string | null; email: string; role?: string; status?: string };
type ParsedRow = {
  date: string;
  shift: 'morning' | 'afternoon';
  teacherInput: string;
  area: string;
  slot_start_time: string | null;
  slot_end_time: string | null;
  user_id: string | null;
  matchedName: string | null;
  error?: string;
};

function formatDate(s: string | null) {
  if (!s) return '—';
  const d = new Date(s + 'T12:00:00');
  return d.toLocaleDateString('tr-TR');
}

function toYMD(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function trCap(s: string) {
  if (!s) return s;
  return s.charAt(0).toLocaleUpperCase('tr-TR') + s.slice(1);
}

/** Dönemden okunaklı plan adı: "Mart 2026", "1–15 Mart 2026", "1 Mart – 15 Nisan 2026" */
function formatDutyPlanVersionLabel(periodStart: string, periodEnd: string): string {
  if (!periodStart || !periodEnd || periodStart > periodEnd) return '';
  const a = new Date(periodStart + 'T12:00:00');
  const b = new Date(periodEnd + 'T12:00:00');
  const sameDay = periodStart === periodEnd;
  const sameMonth = a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();
  const sameYear = a.getFullYear() === b.getFullYear();

  const monthLong = (d: Date) => trCap(d.toLocaleDateString('tr-TR', { month: 'long' }));
  const year = (d: Date) => d.getFullYear();
  const day = (d: Date) => d.getDate();

  if (sameDay) {
    return trCap(a.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' }));
  }
  if (sameMonth) {
    const lastOfMonth = new Date(year(a), a.getMonth() + 1, 0).getDate();
    const fullMonth = day(a) === 1 && day(b) === lastOfMonth;
    if (fullMonth) {
      return `${monthLong(a)} ${year(a)}`;
    }
    return `${day(a)}–${day(b)} ${monthLong(a)} ${year(a)}`;
  }
  if (sameYear) {
    return `${day(a)} ${monthLong(a)} – ${day(b)} ${monthLong(b)} ${year(a)}`;
  }
  return `${day(a)} ${monthLong(a)} ${year(a)} – ${day(b)} ${monthLong(b)} ${year(b)}`;
}

function excelSerialToDate(serial: number): string {
  if (serial < 1) return '';
  const utc = (serial - 25569) * 86400 * 1000;
  return toYMD(new Date(utc));
}

/** Excel'den gelen saati HH:mm formatına çevir (08:00, 15:30). Boş/geçersiz → null */
function normalizeTime(val: string | number | Date | null | undefined): string | null {
  if (val == null || val === '') return null;
  if (typeof val === 'number') {
    if (val < 0 || val >= 1) return null;
    const h = Math.floor(val * 24);
    const m = Math.round(((val * 24) - h) * 60);
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  }
  const s = String(val).trim();
  if (!s) return null;
  const match = s.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
  if (match) {
    const h = parseInt(match[1], 10);
    const m = parseInt(match[2], 10);
    if (h >= 0 && h <= 23 && m >= 0 && m <= 59) {
      return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    }
  }
  return null;
}

function matchTeacher(
  input: string,
  teachers: UserItem[],
): { user_id: string; matchedName: string } | { error: string } {
  const raw = String(input ?? '').trim();
  if (!raw) return { error: 'Boş' };
  const lower = raw.toLowerCase();
  for (const t of teachers) {
    const email = (t.email ?? '').toLowerCase();
    const name = (t.display_name ?? '').toLowerCase();
    if (email && email === lower) return { user_id: t.id, matchedName: t.display_name || t.email };
    if (name && name === lower) return { user_id: t.id, matchedName: t.display_name || t.email };
    if (name && name.includes(lower)) return { user_id: t.id, matchedName: t.display_name || t.email };
    if (raw && name && name.includes(raw)) return { user_id: t.id, matchedName: t.display_name || t.email };
  }
  return { error: 'Eşleşmedi' };
}

export default function DutyPlanlarPage() {
  const { token, me } = useAuth();
  const isAdmin = me?.role === 'school_admin';
  const [plans, setPlans] = useState<DutyPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [publishing, setPublishing] = useState<string | null>(null);
  const [teachers, setTeachers] = useState<UserItem[]>([]);
  const [teachersLoading, setTeachersLoading] = useState(false);
  const [dutyEducationMode, setDutyEducationMode] = useState<'single' | 'double'>('single');
  const [autoShifts, setAutoShifts] = useState<('morning' | 'afternoon')[]>(['morning']);
  const [parsedRows, setParsedRows] = useState<ParsedRow[] | null>(null);
  const [uploading, setUploading] = useState(false);
  const [exportingId, setExportingId] = useState<string | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);
  const [autoGenerating, setAutoGenerating] = useState(false);
  const [autoForm, setAutoForm] = useState({ period_start: '', period_end: '', slots_per_day: 3, version: '', max_per_week: 0 });
  const lastAutoVersionRef = useRef<string>('');
  const [dutyDaysPerWeek, setDutyDaysPerWeek] = useState<1 | 2>(1);
  const [lastCreatedPlanId, setLastCreatedPlanId] = useState<string | null>(null);
  const [autoGenWarning, setAutoGenWarning] = useState<string | null>(null);
  const [priorityAreaExtendedMsg, setPriorityAreaExtendedMsg] = useState<string | null>(null);
  const [advancedRulesOpen, setAdvancedRulesOpen] = useState(false);
  const [rotateAreaByWeek, setRotateAreaByWeek] = useState(false);
  const [ruleToggles, setRuleToggles] = useState({
    prevent_consecutive_days: true,
    respect_preferences: true,
    enable_weekday_balance: true,
    prefer_fewer_lessons_day: true,
    equal_plan_totals: true,
    max_per_month: 0,
    min_days_between: 0,
  });
  const [distributionReport, setDistributionReport] = useState<{
    user_id: string; display_name: string | null; email: string; weekday_labels: Record<string, number>; total: number;
  }[] | null>(null);
  const [distributionReportOpen, setDistributionReportOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [selectedPlanIds, setSelectedPlanIds] = useState<Set<string>>(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [distributionLoadingId, setDistributionLoadingId] = useState<string | null>(null);
  const [planScope, setPlanScope] = useState<'active' | 'archived'>('active');
  const [plansRefreshKey, setPlansRefreshKey] = useState(0);
  const [archivingId, setArchivingId] = useState<string | null>(null);
  const [prefsInRange, setPrefsInRange] = useState<{ preferConfirmed: number; unavailable: number } | null>(null);
  const [areasTotalSlots, setAreasTotalSlots] = useState<number | null>(null);
  const PERIOD_PRESETS = [
    { label: 'Bu ay', get: () => {
      const d = new Date();
      const first = new Date(d.getFullYear(), d.getMonth(), 1);
      const last = new Date(d.getFullYear(), d.getMonth() + 1, 0);
      return { period_start: toYMD(first), period_end: toYMD(last) };
    }},
    { label: 'Gelecek ay', get: () => {
      const d = new Date();
      const first = new Date(d.getFullYear(), d.getMonth() + 1, 1);
      const last = new Date(d.getFullYear(), d.getMonth() + 2, 0);
      return { period_start: toYMD(first), period_end: toYMD(last) };
    }},
    { label: 'Sonraki 4 hafta', get: () => {
      const start = new Date();
      const end = new Date();
      end.setDate(end.getDate() + 27);
      return { period_start: toYMD(start), period_end: toYMD(end) };
    }},
    { label: 'Sonraki 8 hafta', get: () => {
      const start = new Date();
      const end = new Date();
      end.setDate(end.getDate() + 55);
      return { period_start: toYMD(start), period_end: toYMD(end) };
    }},
  ];

  const applyPreset = (preset: { get: () => { period_start: string; period_end: string } }) => {
    const { period_start, period_end } = preset.get();
    setAutoForm((f) => ({ ...f, period_start, period_end }));
  };

  const { estimatedSlots, estimatedWorkDays } = (() => {
    const s = autoForm.period_start;
    const e = autoForm.period_end;
    if (!s || !e || s > e) return { estimatedSlots: null as number | null, estimatedWorkDays: 0 };
    const start = new Date(s + 'T12:00:00');
    const end = new Date(e + 'T12:00:00');
    let days = 0;
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      if (d.getDay() >= 1 && d.getDay() <= 5) days++;
    }
    const shiftMul = Math.max(1, autoShifts.length);
    const slots = days * (autoForm.slots_per_day || 3) * shiftMul;
    return { estimatedSlots: slots, estimatedWorkDays: days };
  })();

  const autoGenerateError = (() => {
    if (!isAdmin) return null;
    if (!autoForm.period_start || !autoForm.period_end) return 'Başlangıç ve bitiş tarihi zorunludur.';
    if (autoForm.period_start > autoForm.period_end) return 'Başlangıç tarihi bitiş tarihinden büyük olamaz.';
    if (teachersLoading) return 'Öğretmen listesi yükleniyor…';
    if (teachers.length === 0) return 'Okulda aktif öğretmen bulunamadı. Önce kullanıcı ekleyin veya aktif edin.';
    if (estimatedSlots === 0) return 'Seçilen aralıkta (Pazartesi–Cuma) iş günü yok.';
    if (estimatedSlots != null && estimatedSlots > 3000) return 'Seçilen aralık çok büyük. Lütfen tarih aralığını daraltın.';
    return null;
  })();

  const fetchPlans = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const q = planScope === 'archived' ? '?scope=archived' : '';
      const list = await apiFetch<DutyPlan[]>(`/duty/plans${q}`, { token });
      setPlans(Array.isArray(list) ? list : []);
    } catch {
      setPlans([]);
    } finally {
      setLoading(false);
    }
  }, [token, planScope]);

  const fetchTeachers = useCallback(async () => {
    if (!token || !isAdmin) return;
    setTeachersLoading(true);
    try {
      const list = await apiFetch<UserItem[]>('/duty/teachers', { token });
      setTeachers(Array.isArray(list) ? list : []);
    } catch {
      setTeachers([]);
    } finally {
      setTeachersLoading(false);
    }
  }, [token, isAdmin]);

  const fetchDutySettings = useCallback(async () => {
    if (!token || !isAdmin) return;
    try {
      const data = await apiFetch<{ duty_education_mode?: 'single' | 'double' | null }>('/duty/school-default-times', { token });
      const mode = data?.duty_education_mode === 'double' ? 'double' : 'single';
      setDutyEducationMode(mode);
      setAutoShifts((prev) => {
        if (mode === 'double') {
          // İlk kurulumda iki vardiyayı seçili getir, kullanıcı isterse azaltabilir
          if (prev.length === 2) return prev;
          return ['morning', 'afternoon'];
        }
        return ['morning'];
      });
    } catch {
      setDutyEducationMode('single');
      setAutoShifts(['morning']);
    }
  }, [token, isAdmin]);

  useEffect(() => {
    fetchPlans();
  }, [fetchPlans, plansRefreshKey]);

  useEffect(() => {
    setSelectedPlanIds(new Set());
  }, [planScope]);

  useEffect(() => {
    if (isAdmin) fetchTeachers();
  }, [isAdmin, fetchTeachers]);

  useEffect(() => {
    if (isAdmin) fetchDutySettings();
  }, [isAdmin, fetchDutySettings]);

  const fetchAreasTotal = useCallback(async () => {
    if (!token || !isAdmin) return;
    try {
      const list = await apiFetch<Array<{ slots_required?: number; slotsRequired?: number }>>('/duty/areas', { token });
      const total = Array.isArray(list)
        ? list.reduce((s, a) => s + Math.max(1, a.slots_required ?? a.slotsRequired ?? 1), 0)
        : 0;
      setAreasTotalSlots(total > 0 ? total : null);
    } catch {
      setAreasTotalSlots(null);
    }
  }, [token, isAdmin]);

  useEffect(() => {
    if (isAdmin) fetchAreasTotal();
  }, [isAdmin, fetchAreasTotal]);

  useEffect(() => {
    if (!isAdmin) return;
    const onVis = () => {
      if (document.visibilityState === 'visible') fetchAreasTotal();
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [isAdmin, fetchAreasTotal]);

  useEffect(() => {
    const minSlots = areasTotalSlots ?? 1;
    if (autoForm.slots_per_day < minSlots) {
      setAutoForm((f) => ({ ...f, slots_per_day: minSlots }));
    }
  }, [areasTotalSlots, autoForm.slots_per_day]);

  useEffect(() => {
    const s = autoForm.period_start;
    const e = autoForm.period_end;
    if (!s || !e || s > e) return;
    const suggested = formatDutyPlanVersionLabel(s, e);
    if (!suggested) return;
    setAutoForm((f) => {
      if (f.version !== '' && f.version !== lastAutoVersionRef.current) {
        return f;
      }
      lastAutoVersionRef.current = suggested;
      return { ...f, version: suggested };
    });
  }, [autoForm.period_start, autoForm.period_end]);

  const fetchPrefsInRange = useCallback(async () => {
    if (!token || !isAdmin || !autoForm.period_start || !autoForm.period_end || autoForm.period_start > autoForm.period_end) {
      setPrefsInRange(null);
      return;
    }
    try {
      const list = await apiFetch<Array<{ status: string; admin_confirmed_at?: string | null }>>(
        `/duty/preferences?from=${autoForm.period_start}&to=${autoForm.period_end}`,
        { token }
      );
      const confirmed = list.filter((p) => p.status === 'prefer' && p.admin_confirmed_at).length;
      const unavail = list.filter((p) => p.status === 'unavailable').length;
      setPrefsInRange({ preferConfirmed: confirmed, unavailable: unavail });
    } catch {
      setPrefsInRange(null);
    }
  }, [token, isAdmin, autoForm.period_start, autoForm.period_end]);

  useEffect(() => {
    fetchPrefsInRange();
  }, [fetchPrefsInRange]);

  const handlePublish = async (id: string) => {
    if (!token) return;
    setPublishing(id);
    try {
      await apiFetch(`/duty/plans/${id}/publish`, { token, method: 'POST' });
      toast.success('Plan yayınlandı.');
      setPlansRefreshKey((k) => k + 1);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Yayınlama başarısız.');
    } finally {
      setPublishing(null);
    }
  };

  const handleArchivePlan = async (id: string) => {
    if (!token) return;
    setArchivingId(id);
    try {
      await apiFetch(`/duty/plans/${id}/archive`, { token, method: 'POST' });
      toast.success('Plan arşivlendi.');
      setPlansRefreshKey((k) => k + 1);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Arşivlenemedi.');
    } finally {
      setArchivingId(null);
    }
  };

  const handleUnarchivePlan = async (id: string) => {
    if (!token) return;
    setArchivingId(id);
    try {
      await apiFetch(`/duty/plans/${id}/unarchive`, { token, method: 'POST' });
      toast.success('Plan arşivden çıkarıldı.');
      setPlansRefreshKey((k) => k + 1);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'İşlem başarısız.');
    } finally {
      setArchivingId(null);
    }
  };

  const downloadTemplate = () => {
    const today = new Date();
    const d1 = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    const nextDay = new Date(today); nextDay.setDate(today.getDate() + 1);
    const d2 = `${nextDay.getFullYear()}-${String(nextDay.getMonth() + 1).padStart(2, '0')}-${String(nextDay.getDate()).padStart(2, '0')}`;

    // ── Kılavuz Sayfası ──────────────────────────────────────────────────────
    const guideRows: string[][] = [
      ['NÖBET PLANI – EXCEL YÜKLEME KILAVUZU'],
      [''],
      ['SÜTUN AÇIKLAMALARI'],
      ['Tarih      → YYYY-AA-GG formatında (örn: 2025-09-15)'],
      ['Vardiya    → morning (sabah) veya afternoon (öğle)  ·  Tekli eğitimde: morning'],
      ['Öğretmen   → Sistemdeki tam ad soyad veya e-posta adresi'],
      ['Alan       → Nöbet yeri adı (Koridor, Bahçe, Giriş Kapısı vb.)  ·  OPSİYONEL'],
      ['Giriş Saati→ SS:DD formatında (örn: 08:00)  ·  OPSİYONEL'],
      ['Çıkış Saati→ SS:DD formatında (örn: 15:30)  ·  OPSİYONEL'],
      [''],
      ['ÖNEMLİ NOTLAR'],
      ['• Tarih sütununu METİN olarak girin (önüne tırnak koyun ya da hücre biçimini Metin yapın).'],
      ['• Öğretmen adı sistemdeki kullanıcı adı veya e-posta ile tam eşleşmeli.'],
      ['• Muaf ve müdür kadrosundaki öğretmenler sisteme eklenirse uyarı verilir.'],
      ['• "Nöbet Planı" sayfasındaki verileri doldurun; bu sayfayı silmeyin.'],
    ];
    const wsGuide = XLSX.utils.aoa_to_sheet(guideRows);
    wsGuide['!cols'] = [{ wch: 80 }];

    // ── Nöbet Planı Sayfası ──────────────────────────────────────────────────
    const COL_WIDTHS = [
      { wch: 14 }, // Tarih
      { wch: 12 }, // Vardiya
      { wch: 26 }, // Öğretmen
      { wch: 18 }, // Alan
      { wch: 13 }, // Giriş Saati
      { wch: 13 }, // Çıkış Saati
    ];
    const planRows: string[][] = [
      // # ile başlayan satırlar yükleme sırasında otomatik atlanır
      ['# NÖBET PLANI ŞABLONU – Aşağıdaki ÖRNEK satırları SİLİP kendi verilerinizi girin', '', '', '', '', ''],
      ['# Tarih: YYYY-AA-GG  |  Vardiya: morning veya afternoon  |  Öğretmen: sistemdeki ad veya e-posta', '', '', '', '', ''],
      ['# Örnek: 2025-09-15  morning  Ahmet Yılmaz  Koridor A  08:00  15:30', '', '', '', '', ''],
      // Başlık satırı (parser bu satırı okur – silmeyin)
      ['Tarih', 'Vardiya', 'Öğretmen', 'Alan', 'Giriş Saati', 'Çıkış Saati'],
      // Örnek veri satırları – bu satırları SİLİP kendi öğretmen adlarınızı yazın
      [d1, 'morning', 'Örnek Ad Soyad 1', 'Koridor A', '08:00', '15:30'],
      [d1, 'morning', 'Örnek Ad Soyad 2', 'Bahçe', '08:00', '15:30'],
      [d1, 'morning', 'Örnek Ad Soyad 3', 'Giriş Kapısı', '08:00', '15:30'],
      [d2, 'morning', 'Örnek Ad Soyad 4', 'Koridor B', '08:00', '15:30'],
      [d2, 'morning', 'Örnek Ad Soyad 5', 'Spor Salonu', '08:00', '15:30'],
    ];
    // Tüm hücreleri string olarak işaretleyerek tarih otomatik dönüşümünü önle
    const ws = XLSX.utils.aoa_to_sheet(planRows, { cellDates: false });
    ws['!cols'] = COL_WIDTHS;
    ws['!freeze'] = { xSplit: 0, ySplit: 1 };

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, wsGuide, 'Kılavuz');
    XLSX.utils.book_append_sheet(wb, ws, 'Nöbet Planı');
    XLSX.writeFile(wb, 'nobet-plani-sablon.xlsx');
    toast.success('Şablon indirildi.');
  };

  const handleExcelUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    let teacherList = teachers;
    if (teacherList.length === 0 && token) {
      try {
        const res = await apiFetch<UserItem[]>('/duty/teachers', { token });
        teacherList = Array.isArray(res) ? res : [];
        setTeachers(teacherList);
      } catch {
        toast.error('Öğretmen listesi yüklenemedi.');
        return;
      }
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = ev.target?.result;
        if (!data || typeof data !== 'object') return;
        const wb = XLSX.read(data, { type: 'array', cellDates: true });
        // Şablonda "Kılavuz" sayfası varsa "Nöbet Planı" sayfasını seç, yoksa ilk sayfayı kullan
        const sheetName = wb.SheetNames.find((s) =>
          s.toLowerCase().includes('nöbet') || s.toLowerCase().includes('nobet') || s.toLowerCase().includes('plan')
        ) ?? wb.SheetNames[0];
        const firstSheet = wb.Sheets[sheetName];
        const rows = XLSX.utils.sheet_to_json(firstSheet, {
          header: 1,
        }) as (string | number | Date)[][];
        if (rows.length < 2) {
          toast.error('Excel dosyasında en az 1 veri satırı olmalı.');
          return;
        }
        // Şablon açıklama satırlarını (# ile başlayanları) geç; ilk gerçek başlık satırını bul
        let headerRowIdx = 0;
        for (let i = 0; i < rows.length; i++) {
          const fc = String((rows[i] ?? [])[0] ?? '').trim();
          if (!fc.startsWith('#') && fc !== '') { headerRowIdx = i; break; }
        }
        const headers = (rows[headerRowIdx] ?? []).map((h) => String(h ?? '').toLowerCase());
        const dateIdx = headers.findIndex((h) => h.includes('tarih') || h === 'date');
        const teacherIdx = headers.findIndex((h) =>
          h.includes('öğretmen') || h.includes('ogretmen') || h.includes('ögretmen') || h === 'teacher',
        );
        const areaIdx = headers.findIndex((h) => h.includes('alan') || h === 'area');
        const startIdx = headers.findIndex((h) =>
          h.includes('giriş') || h.includes('giris') || h.includes('başlangıç') || h === 'start',
        );
        const endIdx = headers.findIndex((h) =>
          h.includes('çıkış') || h.includes('cikis') || h.includes('bitiş') || h === 'end',
        );
        const shiftIdx = headers.findIndex((h) => h.includes('vardiya') || h.includes('shift') || h.includes('oturum'));
        const getCol = (row: (string | number | Date)[], i: number) => {
          if (i >= 0 && i < row.length) {
            const v = row[i];
            if (v instanceof Date) return toYMD(v);
            if (typeof v === 'number' && v > 1000 && v < 100000) return excelSerialToDate(v);
            return String(v ?? '').trim();
          }
          return '';
        };
        const parseShift = (v: unknown): 'morning' | 'afternoon' => {
          const s = String(v ?? '').trim().toLowerCase();
          if (!s) return 'morning';
          if (s === '2' || s.includes('öğle') || s.includes('ogle') || s.includes('ikindi') || s.includes('afternoon')) return 'afternoon';
          return 'morning';
        };
        const parsed: ParsedRow[] = [];
        for (let r = headerRowIdx + 1; r < rows.length; r++) {
          const row = rows[r] ?? [];
          // Şablon açıklama satırlarını atla (# ile başlayanlar veya tamamen boş)
          const firstCell = String(row[0] ?? '').trim();
          if (firstCell.startsWith('#') || row.every((c) => String(c ?? '').trim() === '')) continue;
          const dateRaw = dateIdx >= 0 ? getCol(row, dateIdx) : getCol(row, 0);
          const shiftRaw = shiftIdx >= 0 ? getCol(row, shiftIdx) : '';
          const shift = parseShift(shiftRaw);
          const teacherInput = teacherIdx >= 0 ? getCol(row, teacherIdx) : getCol(row, 2);
          const area = areaIdx >= 0 ? getCol(row, areaIdx) : getCol(row, 3);
          const startVal = startIdx >= 0 ? row[startIdx] : row[4];
          const endVal = endIdx >= 0 ? row[endIdx] : row[5];
          const slot_start_time = normalizeTime(startVal);
          const slot_end_time = normalizeTime(endVal);
          const date = dateRaw.includes('-') && dateRaw.length >= 10 ? dateRaw.slice(0, 10) : dateRaw;
          if (!date) continue;
          const match = matchTeacher(teacherInput, teacherList);
          if ('user_id' in match) {
            parsed.push({
              date,
              shift,
              teacherInput,
              area,
              slot_start_time,
              slot_end_time,
              user_id: match.user_id,
              matchedName: match.matchedName,
            });
          } else {
            parsed.push({
              date,
              shift,
              teacherInput,
              area,
              slot_start_time,
              slot_end_time,
              user_id: null,
              matchedName: null,
              error: match.error,
            });
          }
        }
        setParsedRows(parsed);
        const ok = parsed.filter((p) => p.user_id).length;
        const err = parsed.filter((p) => !p.user_id).length;
        const valid = parsed.filter((p) => p.user_id);
        const countByUser = new Map<string, number>();
        for (const p of valid) {
          if (p.user_id) countByUser.set(p.user_id, (countByUser.get(p.user_id) ?? 0) + 1);
        }
        const counts = [...countByUser.values()];
        const minCount = counts.length ? Math.min(...counts) : 0;
        const maxCount = counts.length ? Math.max(...counts) : 0;
        const diff = maxCount - minCount;
        toast.success(`${ok} satır eşleşti${err > 0 ? `, ${err} satır hatalı` : ''}.`);
        if (diff > 3 && counts.length > 1) {
          toast.warning(`Dağılım dengesiz: en az ${minCount}, en çok ${maxCount} nöbet. Adil dağılım için planları gözden geçirin.`);
        }
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Excel okunamadı.');
      }
      e.target.value = '';
    };
    reader.readAsArrayBuffer(file);
  };

  const PLAN_EXPORT_COL_WIDTHS = [
    { wch: 14 }, // Tarih
    { wch: 12 }, // Vardiya
    { wch: 26 }, // Öğretmen
    { wch: 18 }, // Alan
    { wch: 13 }, // Giriş Saati
    { wch: 13 }, // Çıkış Saati
  ];

  const SHIFT_LABELS: Record<string, string> = { morning: 'Sabah', afternoon: 'Öğle', '': '' };

  const handleExportPlan = async (planId: string) => {
    if (!token) return;
    setExportingId(planId);
    try {
      const plan = await apiFetch<{
        id: string;
        version: string | null;
        slots: Array<{
          date: string;
          shift?: string | null;
          area_name: string | null;
          slot_start_time?: string | null;
          slot_end_time?: string | null;
          user?: { display_name: string | null; email: string };
        }>;
      }>(`/duty/plans/${planId}`, { token });
      const slots = plan?.slots ?? [];
      if (slots.length === 0) {
        toast.error('Bu planda nöbet kaydı yok.');
        return;
      }
      const rows: string[][] = [
        ['Tarih', 'Vardiya', 'Öğretmen', 'Alan', 'Giriş Saati', 'Çıkış Saati'],
        ...slots.map((s) => [
          s.date,
          SHIFT_LABELS[s.shift ?? ''] ?? (s.shift ?? ''),
          s.user?.display_name || s.user?.email || '—',
          s.area_name || '',
          s.slot_start_time || '',
          s.slot_end_time || '',
        ]),
      ];
      const ws = XLSX.utils.aoa_to_sheet(rows, { cellDates: false });
      ws['!cols'] = PLAN_EXPORT_COL_WIDTHS;
      ws['!freeze'] = { xSplit: 0, ySplit: 1 };
      const wb = XLSX.utils.book_new();
      const safeVersion = (plan.version ?? 'plan').replace(/[^\w\-]/g, '_');
      XLSX.utils.book_append_sheet(wb, ws, safeVersion.slice(0, 31));
      XLSX.writeFile(wb, `nobet-plani-${safeVersion}.xlsx`);
      toast.success('Excel indirildi.');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'İndirilemedi.');
    } finally {
      setExportingId(null);
    }
  };

  const handleCreateFromExcel = async () => {
    if (!token || !parsedRows) return;
    const valid = parsedRows.filter((p) => p.user_id);
    if (valid.length === 0) {
      setCreateError('Oluşturulacak geçerli satır yok. Öğretmen eşleşmesini kontrol edin.');
      toast.error('Öğretmen eşleşmesi yapılamayan satırlar var.');
      return;
    }
    setCreateError(null);
    setUploading(true);
    try {
      const slots = valid.map((p) => ({
        date: p.date,
        shift: p.shift,
        user_id: p.user_id!,
        area_name: p.area || null,
        slot_start_time: p.slot_start_time || null,
        slot_end_time: p.slot_end_time || null,
      }));
      const periodStart = valid.reduce((a, p) => (p.date < a ? p.date : a), valid[0]!.date);
      const periodEnd = valid.reduce((a, p) => (p.date > a ? p.date : a), valid[0]!.date);
      await apiFetch('/duty/plans', {
        token,
        method: 'POST',
        body: JSON.stringify({
          version: `Excel ${new Date().toLocaleDateString('tr-TR')}`,
          period_start: periodStart,
          period_end: periodEnd,
          slots,
        }),
      });
      toast.success(`${valid.length} nöbet kaydı ile taslak plan oluşturuldu. Planlar listesinden yayınlayabilirsiniz.`);
      setParsedRows(null);
      setPlansRefreshKey((k) => k + 1);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Plan oluşturulamadı.';
      const details = (e as { details?: Record<string, unknown> })?.details;
      const invalidIds = details?.invalid_user_ids as string[] | undefined;
      const extra = invalidIds?.length
        ? ` (${invalidIds.length} öğretmen okulda kayıtlı değil veya atanamaz)`
        : '';
      setCreateError(msg + extra);
      toast.error(msg);
    } finally {
      setUploading(false);
    }
  };

  const handleSoftDelete = async (planId: string) => {
    if (!token) return;
    if (!confirm('Bu planı silmek istediğinize emin misiniz? Plan listeden kaldırılır ancak istatistikler korunur.')) return;
    setDeletingId(planId);
    try {
      await apiFetch(`/duty/plans/${planId}/soft-delete`, { token, method: 'POST' });
      toast.success('Plan silindi. İstatistikler korunur.');
      setPlansRefreshKey((k) => k + 1);
    } catch {
      toast.error('Plan silinemedi.');
    } finally {
      setDeletingId(null);
    }
  };

  const handleBulkDelete = async () => {
    if (!token || selectedPlanIds.size === 0) return;
    setBulkDeleting(true);
    try {
      const res = await apiFetch<{ deleted_count: number }>('/duty/plans/bulk-delete', {
        token,
        method: 'POST',
        body: JSON.stringify({ plan_ids: [...selectedPlanIds] }),
      });
      toast.success(`${res?.deleted_count ?? selectedPlanIds.size} plan silindi. İstatistikler korunur.`);
      setSelectedPlanIds(new Set());
      setBulkDeleteOpen(false);
      setPlansRefreshKey((k) => k + 1);
    } catch {
      toast.error('Planlar silinemedi.');
    } finally {
      setBulkDeleting(false);
    }
  };

  const togglePlanSelection = (id: string) => {
    setSelectedPlanIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleOpenDistributionReport = async (planId: string) => {
    if (!token) return;
    setDistributionLoadingId(planId);
    setAutoGenWarning(null);
    setPriorityAreaExtendedMsg(null);
    setLastCreatedPlanId(planId);
    try {
      const res = await apiFetch<{
        distribution: { user_id: string; display_name: string | null; email: string; weekday_labels: Record<string, number>; total: number }[];
      }>(`/duty/plans/${planId}/distribution`, { token });
      setDistributionReport(res?.distribution ?? []);
      setDistributionReportOpen(true);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Rapor yüklenemedi.');
    } finally {
      setDistributionLoadingId(null);
    }
  };

  const handleAutoGenerate = async () => {
    if (!token) return;
    if (autoGenerateError) {
      toast.error(autoGenerateError);
      return;
    }
    setAutoGenerating(true);
    setAutoGenWarning(null);
    setLastCreatedPlanId(null);
    try {
      type AutoGenResult = {
        id?: string;
        distribution?: { user_id: string; display_name: string | null; email: string; weekday_labels: Record<string, number>; total: number }[];
        warning?: string | null;
        priority_area_extended?: string | null;
      };
      const result = await apiFetch<AutoGenResult>('/duty/plans/auto-generate', {
        token,
        method: 'POST',
        body: JSON.stringify({
          period_start: autoForm.period_start,
          period_end: autoForm.period_end,
          slots_per_day: autoForm.slots_per_day || 3,
          version: autoForm.version?.trim() || undefined,
          shifts: dutyEducationMode === 'double' ? autoShifts : ['morning'],
          duty_days_per_week: dutyDaysPerWeek,
          max_per_week: autoForm.max_per_week > 0 ? autoForm.max_per_week : undefined,
          prevent_consecutive_days: ruleToggles.prevent_consecutive_days,
          respect_preferences: ruleToggles.respect_preferences,
          enable_weekday_balance: ruleToggles.enable_weekday_balance,
          prefer_fewer_lessons_day: ruleToggles.prefer_fewer_lessons_day,
          equal_plan_totals: ruleToggles.equal_plan_totals,
          same_day_each_week: true,
          max_per_month: ruleToggles.max_per_month > 0 ? ruleToggles.max_per_month : undefined,
          min_days_between: ruleToggles.min_days_between > 0 ? ruleToggles.min_days_between : undefined,
          rotate_area_by_week: rotateAreaByWeek || undefined,
        }),
      });
      if (result?.id) setLastCreatedPlanId(result.id);
      if (result?.warning) setAutoGenWarning(result.warning);
      setPriorityAreaExtendedMsg(result?.priority_area_extended ?? null);
      toast.success('Taslak oluşturuldu. İsterseniz takvimden düzenleyin.');
      setAdvancedRulesOpen(false);
      lastAutoVersionRef.current = '';
      setAutoForm((f) => ({ ...f, period_start: '', period_end: '', version: '' }));
      setPlansRefreshKey((k) => k + 1);
      if (result?.distribution && result.distribution.length > 0) {
        setDistributionReport(result.distribution);
        setDistributionReportOpen(true);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Plan oluşturulamadı.');
    } finally {
      setAutoGenerating(false);
    }
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      <DutyPageHeader
        icon={CalendarRange}
        title="Nöbet planları"
        description="Taslakları yayınlayınca nöbet takviminde görünür."
        color="indigo"
        actions={
          <Link
            href="/duty"
            className="inline-flex items-center gap-1.5 rounded-lg border border-border/60 bg-background/90 px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground sm:gap-2 sm:px-3 sm:text-sm"
          >
            <ArrowLeft className="size-3.5 sm:size-4" />
            Planlama
          </Link>
        }
      />

      {isAdmin && (
        <Card>
          <CardContent className="p-4 space-y-4">
            <div className="flex items-center gap-2">
              <Zap className="size-5 text-primary" />
              <h2 className="text-lg font-semibold">Otomatik nöbet planı</h2>
            </div>
            <p className="text-sm text-muted-foreground">
              Tercihler (varsa) önce okunur. Günlük nöbet sayısı, Yerler sayfasındaki kayıtlara göre en az o kadardır. Planı sonra takvimden düzenleyebilirsiniz.
            </p>
            <div className="rounded-xl border border-border bg-muted/20 p-4 space-y-3">
              <div className="flex items-center gap-2">
                <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">1</span>
                <span className="text-sm font-semibold">Tarih aralığı ve haftalık gün sayısı</span>
              </div>
            <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 space-y-2">
              <Label className="text-sm font-semibold">Her öğretmen haftada kaç gün nöbet tutsun?</Label>
              <div className="flex flex-col gap-3 sm:flex-row sm:gap-6">
                <label className="flex cursor-pointer items-center gap-2">
                  <input
                    type="radio"
                    name="duty_days_per_week"
                    checked={dutyDaysPerWeek === 1}
                    onChange={() => setDutyDaysPerWeek(1)}
                    className="accent-primary"
                  />
                  <span className="text-sm font-medium">1 gün</span>
                  <span className="text-xs text-muted-foreground">(Her hafta aynı tek gün)</span>
                </label>
                <label className="flex cursor-pointer items-center gap-2">
                  <input
                    type="radio"
                    name="duty_days_per_week"
                    checked={dutyDaysPerWeek === 2}
                    onChange={() => setDutyDaysPerWeek(2)}
                    className="accent-primary"
                  />
                  <span className="text-sm font-medium">2 gün</span>
                  <span className="text-xs text-muted-foreground">(Her hafta aynı iki gün)</span>
                </label>
              </div>
            </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Başlangıç tarihi</Label>
                  <Input type="date" value={autoForm.period_start} onChange={(e) => setAutoForm((f) => ({ ...f, period_start: e.target.value }))} className="w-full" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Bitiş tarihi</Label>
                  <Input type="date" value={autoForm.period_end} onChange={(e) => setAutoForm((f) => ({ ...f, period_end: e.target.value }))} className="w-full" />
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
              {PERIOD_PRESETS.map((preset) => (
                <Button key={preset.label} variant="outline" size="sm" onClick={() => applyPreset(preset)}>
                  {preset.label}
                </Button>
              ))}
              </div>
              {dutyEducationMode === 'double' && (
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Vardiya</Label>
                  <div className="flex gap-4">
                    <label className="inline-flex items-center gap-2 text-sm cursor-pointer">
                      <input type="checkbox" checked={autoShifts.includes('morning')} onChange={(e) => { const next = new Set(autoShifts); if (e.target.checked) next.add('morning'); else next.delete('morning'); if (next.size === 0) return; setAutoShifts([...next] as ('morning' | 'afternoon')[]); }} className="accent-primary" />
                      Sabah
                    </label>
                    <label className="inline-flex items-center gap-2 text-sm cursor-pointer">
                      <input type="checkbox" checked={autoShifts.includes('afternoon')} onChange={(e) => { const next = new Set(autoShifts); if (e.target.checked) next.add('afternoon'); else next.delete('afternoon'); if (next.size === 0) return; setAutoShifts([...next] as ('morning' | 'afternoon')[]); }} className="accent-primary" />
                      Öğle
                    </label>
                  </div>
                </div>
              )}
            </div>

            <div className="rounded-xl border border-border bg-muted/20 p-4 space-y-3">
              <div className="flex items-center gap-2">
                <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">2</span>
                <span className="text-sm font-semibold">Günlük nöbet sayısı ve plan adı</span>
              </div>
              {areasTotalSlots != null && areasTotalSlots > 0 && (
                <p className="text-xs text-muted-foreground rounded-lg bg-muted/50 px-3 py-2 space-y-1">
                  <span className="block">
                    Yerlerde tanımlı alanların günlük nöbetçi sayıları toplamı: <strong>{areasTotalSlots}</strong>. Otomatik planda bu,{' '}
                    <strong>vardiya başına</strong> minimum günlük nöbet sayısıdır (backend ile aynı toplam).
                  </span>
                  {dutyEducationMode === 'double' && (
                    <span className="block pt-1">
                      Çift öğretimde seçili her vardiya (sabah/öğle) için ayrı ayrı bu kadar slot açılır; gün içi toplam atanış ≈{' '}
                      <strong>{areasTotalSlots * Math.max(1, autoShifts.length)}</strong> (her iki vardiya seçiliyse).
                    </span>
                  )}
                  <span className="block pt-1">Aşağıdaki sayı bu minimumu geçebilir (üst sınır 200).</span>
                </p>
              )}
              <div className="flex flex-wrap items-end gap-4">
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Vardiya başına günlük kaç nöbet açılsın?</Label>
                  <Input
                    type="number"
                    min={areasTotalSlots ?? 1}
                    max={200}
                    value={autoForm.slots_per_day}
                    onChange={(e) => setAutoForm((f) => ({ ...f, slots_per_day: parseInt(e.target.value, 10) || (areasTotalSlots ?? 1) }))}
                    className="w-24"
                  />
                  <p className="text-xs text-muted-foreground">En az {areasTotalSlots ?? 1} (Yerler toplamı).</p>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Öğretmen başına (hafta)</Label>
                  <p className="text-sm font-medium text-foreground">
                    {dutyDaysPerWeek === 1 ? 'Haftada 1 nöbet' : 'Haftada 2 nöbet'}
                  </p>
                  <p className="text-xs text-muted-foreground">Yukarıdaki 1 veya 2 günlük seçime bağlıdır.</p>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Plan adı</Label>
                  <Input
                    value={autoForm.version}
                    onChange={(e) => setAutoForm((f) => ({ ...f, version: e.target.value }))}
                    className="min-w-56 max-w-full sm:w-72"
                    placeholder="Dönem seçilince dolar"
                  />
                  <p className="text-[10px] text-muted-foreground">Dönemle otomatik; elle yazarsanız tarih değişince korunur.</p>
                </div>
              </div>
            </div>

            {estimatedSlots != null && (
              <div className="space-y-2">
                <div className="rounded-lg border border-muted bg-muted/30 px-4 py-3 text-sm">
                  <div className="flex flex-wrap items-center gap-x-6 gap-y-1">
                    <span><strong>İş günü:</strong> {estimatedWorkDays}</span>
                    <span><strong>Tahmini toplam nöbet:</strong> ~{estimatedSlots}</span>
                    <span><strong>Öğretmen:</strong> {teachers.length}</span>
                    <span><strong>Haftalık nöbet günü:</strong> {dutyDaysPerWeek}</span>
                    {dutyEducationMode === 'double' && (
                      <span className="text-muted-foreground">
                        {autoShifts.includes('morning') ? 'Sabah' : ''}
                        {autoShifts.includes('morning') && autoShifts.includes('afternoon') ? ' · ' : ''}
                        {autoShifts.includes('afternoon') ? 'Öğle' : ''}
                      </span>
                    )}
                  </div>
                  {prefsInRange != null && (prefsInRange.preferConfirmed > 0 || prefsInRange.unavailable > 0) && (
                    <p className="mt-2 pt-2 border-t border-muted text-muted-foreground">
                      Bu tarihlerde: <strong className="text-emerald-600 dark:text-emerald-400">{prefsInRange.preferConfirmed}</strong> onaylı &quot;tercih ediyorum&quot;
                      {prefsInRange.unavailable > 0 && (
                        <> · <strong className="text-amber-600 dark:text-amber-400">{prefsInRange.unavailable}</strong> &quot;müsait değilim&quot;</>
                      )}
                    </p>
                  )}
                </div>
              </div>
            )}
            {autoGenerateError && (autoForm.period_start || autoForm.period_end) && (
              <Alert variant="warning" message={autoGenerateError} />
            )}
            {autoGenWarning && (
              <Alert variant="warning" message={autoGenWarning} />
            )}
            {estimatedSlots != null && estimatedWorkDays > 0 && teachers.length > 0 && (() => {
              const numWeeks = Math.ceil(estimatedWorkDays / 5) || 1;
              const capacity = teachers.length * dutyDaysPerWeek * numWeeks;
              const required = estimatedSlots;
              const ok = capacity >= required;
              return (
                <p className={cn('text-sm', ok ? 'text-muted-foreground' : 'text-amber-700 dark:text-amber-400')}>
                  Atanabilecek (yaklaşık): {capacity} · İhtiyaç (yaklaşık): {required}.
                  {!ok && ' Sayılar yetmeyebilir; planı sonra elden düzeltin.'}
                </p>
              );
            })()}

            <p className="text-xs text-muted-foreground">
              Hafta içi günler; tatiller sayılmaz. <Link href="/duty/tercihler" className="underline">Tercihler</Link> ·{' '}
              <Link href="/work-calendar" className="underline">Takvim</Link> · <Link href="/duty/yerler" className="underline">Yerler</Link>
            </p>

            {/* Kurallar – Tercihler vurgulu */}
            <div className="rounded-lg border border-primary/40 bg-primary/5 p-3">
              <label className="flex cursor-pointer items-start gap-3">
                <input type="checkbox" className="mt-0.5 accent-primary" checked={ruleToggles.respect_preferences} onChange={(e) => setRuleToggles((r) => ({ ...r, respect_preferences: e.target.checked }))} />
                <div>
                  <p className="text-sm font-semibold text-primary">Tercihleri kullan</p>
                  <p className="text-xs text-muted-foreground">Okulun onayladığı &quot;tercih ediyorum&quot; günleri önce gelir; &quot;müsait değilim&quot; günlere atanmaz.</p>
                </div>
              </label>
            </div>

            {/* Gelişmiş Kurallar akordiyon paneli */}
            <div className="border rounded-xl overflow-hidden">
              <button
                type="button"
                className="w-full flex items-center justify-between px-4 py-3 bg-muted/40 hover:bg-muted/70 transition-colors text-sm font-medium"
                onClick={() => setAdvancedRulesOpen((o) => !o)}
              >
                <span className="flex items-center gap-2">
                  <Settings2 className="size-4 text-muted-foreground" />
                  Ek kurallar
                  <span className="text-xs font-normal text-muted-foreground">(isteğe bağlı)</span>
                </span>
                {advancedRulesOpen ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
              </button>
              {advancedRulesOpen && (
                <div className="px-4 py-4 space-y-4 bg-background">
                  <p className="text-xs text-muted-foreground">Açık olanlar uygulanır.</p>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {[
                      { key: 'prevent_consecutive_days' as const, label: 'Üst üste iki gün verme', desc: 'Aynı kişiye arka arkaya nöbet günü atanmaz.' },
                      { key: 'enable_weekday_balance' as const, label: 'Günleri yay', desc: 'Herkesi mümkün olduğunca farklı hafta içi günlere yayar. (Üstteki sabit gün seçimiyle çakışırsa etkisi azalır.)' },
                      { key: 'prefer_fewer_lessons_day' as const, label: 'Az dersli güne öncelik', desc: 'O gün ders saati az olanlara önce düşünür.' },
                      { key: 'equal_plan_totals' as const, label: 'Bu planda eşit nöbet', desc: 'Geçmiş görevlendirme yükünü dikkate almaz; bu dönemde herkese mümkün olduğunca eşit atama (diğer kurallardan sonra).' },
                    ].map(({ key, label, desc }) => (
                      <label
                        key={key}
                        className="flex items-start gap-3 cursor-pointer rounded-lg border p-3 hover:bg-muted/30 transition-colors"
                      >
                        <input
                          type="checkbox"
                          className="mt-0.5 accent-primary"
                          checked={ruleToggles[key]}
                          onChange={(e) => setRuleToggles((r) => ({ ...r, [key]: e.target.checked }))}
                        />
                        <div>
                          <p className="text-sm font-medium">{label}</p>
                          <p className="text-xs text-muted-foreground">{desc}</p>
                        </div>
                      </label>
                    ))}
                  </div>
                  <div className="flex flex-wrap gap-6 pt-1">
                    <div className="space-y-1">
                      <Label className="text-xs" title="0 = sınırsız">
                        Ayda en çok kaç nöbet <span className="text-muted-foreground">(0=sınır yok)</span>
                      </Label>
                      <Input
                        type="number"
                        min={0}
                        max={30}
                        value={ruleToggles.max_per_month}
                        onChange={(e) => setRuleToggles((r) => ({ ...r, max_per_month: parseInt(e.target.value) || 0 }))}
                        className="w-24"
                        placeholder="0"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs" title="0 = kullanılmaz">
                        İki nöbet arası en az kaç gün <span className="text-muted-foreground">(0=yok)</span>
                      </Label>
                      <Input
                        type="number"
                        min={0}
                        max={30}
                        value={ruleToggles.min_days_between}
                        onChange={(e) => setRuleToggles((r) => ({ ...r, min_days_between: parseInt(e.target.value) || 0 }))}
                        className="w-24"
                        placeholder="0"
                      />
                    </div>
                  </div>
                  <label
                    className="flex items-start gap-3 cursor-pointer rounded-lg border p-3 hover:bg-muted/30 transition-colors border-dashed border-primary/30"
                    title="Yerler haftadan haftaya bir sıra kayar"
                  >
                    <input
                      type="checkbox"
                      className="mt-0.5 accent-primary"
                      checked={rotateAreaByWeek}
                      onChange={(e) => setRotateAreaByWeek(e.target.checked)}
                    />
                    <div>
                      <p className="text-sm font-medium">Nöbet yerini haftaya göre kaydır</p>
                      <p className="text-xs text-muted-foreground">Her yeni haftada koridor/bahçe vb. sırayla ilerler; günler değişmez.</p>
                    </div>
                  </label>
                </div>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Button onClick={handleAutoGenerate} disabled={autoGenerating || !!autoGenerateError}>
                {autoGenerating ? 'Oluşturuluyor…' : 'Otomatik Plan Oluştur'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {isAdmin && (
        <Card>
          <CardContent className="p-4 space-y-4">
            <h3 className="font-medium text-foreground">Excel’den yükle</h3>
            <p className="text-sm text-muted-foreground">
              Şablondaki sütunlara göre doldurun. Öğretmen, sistemdeki ad veya e-posta ile eşleşmeli. Vardiya ve saat zorunlu değil.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={downloadTemplate}>
                <Download className="size-4" />
                Şablon İndir
              </Button>
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-primary bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
                <Upload className="size-4" />
                Excel Yükle
                <input
                  type="file"
                  accept=".xlsx,.xls"
                  className="sr-only"
                  onChange={handleExcelUpload}
                />
              </label>
            </div>
            {parsedRows && (
              <div className="space-y-3">
                {createError && (
                  <Alert variant="error" message={createError} />
                )}
                {(() => {
                  const valid = parsedRows.filter((p) => p.user_id);
                  const countByUser = new Map<string, number>();
                  for (const p of valid) {
                    if (p.user_id) countByUser.set(p.user_id, (countByUser.get(p.user_id) ?? 0) + 1);
                  }
                  const counts = [...countByUser.values()];
                  const minC = counts.length ? Math.min(...counts) : 0;
                  const maxC = counts.length ? Math.max(...counts) : 0;
                  const unbalanced = counts.length > 1 && maxC - minC > 3;
                  return unbalanced ? (
                    <Alert
                      variant="warning"
                      message={`Dağılım dengesiz: en az ${minC}, en çok ${maxC} nöbet. Taslak oluşturabilirsiniz; adil dağılım için Toplam Görevlendirme sayfasından kontrol edin.`}
                    />
                  ) : null;
                })()}
                <div className="table-x-scroll max-h-[300px] overflow-y-auto rounded-lg border border-border">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50 sticky top-0">
                      <tr>
                        <th className="px-3 py-2 text-left">Tarih</th>
                        <th className="px-3 py-2 text-left">Vardiya</th>
                        <th className="px-3 py-2 text-left">Girilen Öğretmen</th>
                        <th className="px-3 py-2 text-left">Eşleşen</th>
                        <th className="px-3 py-2 text-left">Alan</th>
                        <th className="px-3 py-2 text-left">Giriş</th>
                        <th className="px-3 py-2 text-left">Çıkış</th>
                        <th className="px-3 py-2 text-left">Durum</th>
                      </tr>
                    </thead>
                    <tbody>
                      {parsedRows.map((row, i) => (
                        <tr key={i} className={cn('border-t', !row.user_id && 'bg-rose-50/50 dark:bg-rose-950/20')}>
                          <td className="px-3 py-2">{row.date}</td>
                          <td className="px-3 py-2 text-muted-foreground">{row.shift === 'afternoon' ? 'Öğle' : 'Sabah'}</td>
                          <td className="px-3 py-2">{row.teacherInput || '—'}</td>
                          <td className="px-3 py-2">{row.matchedName || '—'}</td>
                          <td className="px-3 py-2">{row.area || '—'}</td>
                          <td className="px-3 py-2">{row.slot_start_time || '—'}</td>
                          <td className="px-3 py-2">{row.slot_end_time || '—'}</td>
                          <td className="px-3 py-2">
                            {row.user_id ? (
                              <span className="text-emerald-600 dark:text-emerald-400">OK</span>
                            ) : (
                              <span className="text-rose-600 dark:text-rose-400">{row.error ?? 'Hata'}</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    onClick={handleCreateFromExcel}
                    disabled={uploading || parsedRows.filter((p) => p.user_id).length === 0}
                  >
                    {uploading ? 'Oluşturuluyor…' : 'Taslak Plan Oluştur'}
                  </Button>
                  <Button variant="outline" onClick={() => { setParsedRows(null); setCreateError(null); }}>
                    İptal
                  </Button>
                  <span className="text-sm text-muted-foreground">
                    {parsedRows.filter((p) => p.user_id).length} geçerli / {parsedRows.length} satır
                  </span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {isAdmin && (
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant={planScope === 'active' ? 'default' : 'outline'}
            size="sm"
            onClick={() => {
              setPlanScope('active');
              setPlansRefreshKey((k) => k + 1);
            }}
          >
            Aktif planlar
          </Button>
          <Button
            type="button"
            variant={planScope === 'archived' ? 'default' : 'outline'}
            size="sm"
            onClick={() => {
              setPlanScope('archived');
              setPlansRefreshKey((k) => k + 1);
            }}
          >
            <Archive className="size-4" />
            Arşiv
          </Button>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-12">
          <LoadingSpinner />
        </div>
      ) : !plans.length ? (
        <Card>
          <EmptyState
            icon={<FileText className="size-10 text-muted-foreground" />}
            title={planScope === 'archived' ? 'Arşivde plan yok' : 'Henüz plan yok'}
            description={
              planScope === 'archived'
                ? 'Arşivlenmiş plan burada listelenir. Aktif listeden planı arşivleyebilirsiniz.'
                : 'Nöbet sayfasından yeni plan oluşturabilir veya Excel ile yükleyebilirsiniz.'
            }
            action={
              planScope === 'archived' ? undefined : (
              <Link href="/duty">
                <Button>Planlama Sayfasına Git</Button>
              </Link>
            )
            }
          />
        </Card>
      ) : (
        <Card className="overflow-hidden rounded-xl">
          <CardContent className="p-0">
            {isAdmin && selectedPlanIds.size > 0 && (
              <div className="flex items-center gap-3 border-b px-4 py-3 bg-muted/50">
                <span className="text-sm font-medium text-muted-foreground">
                  {selectedPlanIds.size} plan seçildi
                </span>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => setBulkDeleteOpen(true)}
                >
                  <Trash2 className="size-4" />
                  Seçilenleri sil
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setSelectedPlanIds(new Set())}>
                  Seçimi temizle
                </Button>
              </div>
            )}
            <div className="table-x-scroll">
              <table className="evrak-admin-table w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/60">
                    {isAdmin && <th className="w-10 px-4 py-3.5">Seç</th>}
                    <th className="px-4 py-3.5 text-left text-sm font-semibold uppercase tracking-wide">Versiyon / Açıklama</th>
                    <th className="px-4 py-3.5 text-left text-sm font-semibold uppercase tracking-wide">Dönem</th>
                    <th className="px-4 py-3.5 text-left text-sm font-semibold uppercase tracking-wide">Durum</th>
                    <th className="px-4 py-3.5 text-left text-sm font-semibold uppercase tracking-wide">Oluşturulma</th>
                    <th className="px-4 py-3.5 text-right text-sm font-semibold uppercase tracking-wide">İşlem</th>
                  </tr>
                </thead>
                <tbody>
                  {plans.map((plan) => (
                    <tr key={plan.id} className="border-b last:border-b-0 hover:bg-muted/40 transition-colors">
                      {isAdmin && (
                        <td className="px-4 py-3">
                          <input
                            type="checkbox"
                            checked={selectedPlanIds.has(plan.id)}
                            onChange={() => togglePlanSelection(plan.id)}
                            className="rounded"
                          />
                        </td>
                      )}
                      <td className="px-4 py-3">
                        <Link
                          href={`/duty/planlar/${plan.id}`}
                          className="font-medium text-primary hover:underline"
                        >
                          {plan.version || '—'}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {plan.period_start || plan.period_end
                          ? `${formatDate(plan.period_start)} – ${formatDate(plan.period_end)}`
                          : plan.academic_year || '—'}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap items-center gap-1.5">
                          {planScope === 'archived' && (
                            <span className="inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium bg-slate-100 text-slate-800 dark:bg-slate-800/80 dark:text-slate-200">
                              Arşivde
                            </span>
                          )}
                          <span
                            className={cn(
                              'inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium',
                              plan.status === 'published'
                                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300'
                                : 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
                            )}
                          >
                            {plan.status === 'published' ? 'Yayınlandı' : 'Taslak'}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {formatDate(plan.created_at?.slice(0, 10))}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex justify-end gap-1 flex-wrap">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleExportPlan(plan.id)}
                            disabled={!!exportingId}
                            title="Excel indir"
                          >
                            <FileDown className="size-4" />
                          </Button>
                          {isAdmin && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleOpenDistributionReport(plan.id)}
                              disabled={!!distributionLoadingId}
                              title="Dağıtım raporu"
                            >
                              {distributionLoadingId === plan.id ? (
                                <LoadingSpinner className="size-4" />
                              ) : (
                                <BarChart2 className="size-4" />
                              )}
                            </Button>
                          )}
                          {isAdmin && planScope === 'active' && plan.status === 'draft' && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handlePublish(plan.id)}
                              disabled={!!publishing}
                            >
                              <Send className="size-4" />
                              Yayınla
                            </Button>
                          )}
                          {isAdmin && planScope === 'active' && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleArchivePlan(plan.id)}
                              disabled={!!archivingId}
                              title="Arşivle (günlük nöbet görünümünden düşer)"
                            >
                              {archivingId === plan.id ? <LoadingSpinner className="size-4" /> : <Archive className="size-4" />}
                              Arşivle
                            </Button>
                          )}
                          {isAdmin && planScope === 'archived' && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleUnarchivePlan(plan.id)}
                              disabled={!!archivingId}
                              title="Aktif planlar listesine al"
                            >
                              {archivingId === plan.id ? <LoadingSpinner className="size-4" /> : <ArchiveRestore className="size-4" />}
                              Arşivden çıkar
                            </Button>
                          )}
                          {isAdmin && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-rose-600 hover:text-rose-700"
                              onClick={() => handleSoftDelete(plan.id)}
                              disabled={!!deletingId}
                              title="Planı sil (istatistikler korunur)"
                            >
                              {deletingId === plan.id ? (
                                <LoadingSpinner className="size-4" />
                              ) : (
                                <Trash2 className="size-4" />
                              )}
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Toplu silme onay modal */}
      <Dialog open={bulkDeleteOpen} onOpenChange={setBulkDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Planları sil</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            {selectedPlanIds.size} plan silinecek. Planlar listeden kaldırılır ancak görevlendirme istatistikleri korunur.
            Devam etmek istiyor musunuz?
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkDeleteOpen(false)}>
              İptal
            </Button>
            <Button variant="destructive" onClick={handleBulkDelete} disabled={bulkDeleting}>
              {bulkDeleting ? <LoadingSpinner className="size-4" /> : 'Sil'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dağıtım Raporu Modal */}
      <Dialog open={distributionReportOpen} onOpenChange={(open) => { setDistributionReportOpen(open); if (!open) { setAutoGenWarning(null); setPriorityAreaExtendedMsg(null); } }}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Zap className="size-5 text-primary" />
              Nöbet Dağıtım Raporu
            </DialogTitle>
          </DialogHeader>
          {priorityAreaExtendedMsg && (
            <Alert variant="info" message={priorityAreaExtendedMsg} className="mb-4" />
          )}
          {autoGenWarning && (
            <Alert variant="warning" message={autoGenWarning} className="mb-4" />
          )}
          {lastCreatedPlanId && (
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <Link href={`/duty/planlar/${lastCreatedPlanId}`}>
                <Button size="sm">Planı düzenle (el ile değiştir)</Button>
              </Link>
              <span className="text-xs text-muted-foreground">Slotları değiştirip, öğretmen atayıp kaldırabilirsiniz.</span>
            </div>
          )}
          {distributionReport && distributionReport.length === 0 && (
            <p className="text-sm text-muted-foreground">Bu planda atanmış nöbet yok.</p>
          )}
          {distributionReport && distributionReport.length > 0 && (() => {
            const allDays = [...new Set(distributionReport.flatMap((r) => Object.keys(r.weekday_labels)))];
            const DAY_ORDER = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'];
            const days = DAY_ORDER.filter((d) => allDays.includes(d));
            return (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Plan oluşturulduktan sonra öğretmen bazlı haftalık nöbet dağılımı aşağıdadır.
                </p>
                <div className="table-x-scroll rounded-lg border border-border">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50">
                      <tr>
                        <th className="px-3 py-2 text-left font-medium sticky left-0 bg-muted/50">Öğretmen</th>
                        {days.map((d) => (
                          <th key={d} className="px-3 py-2 text-center font-medium min-w-[60px]">{d}</th>
                        ))}
                        <th className="px-3 py-2 text-center font-semibold bg-primary/10 text-primary">Toplam</th>
                      </tr>
                    </thead>
                    <tbody>
                      {distributionReport.map((r) => (
                        <tr key={r.user_id} className="border-t hover:bg-muted/20 transition-colors">
                          <td className="px-3 py-2 font-medium sticky left-0 bg-background">
                            {r.display_name || r.email}
                          </td>
                          {days.map((d) => (
                            <td key={d} className="px-3 py-2 text-center">
                              {r.weekday_labels[d] ? (
                                <span className="inline-flex items-center justify-center size-6 rounded-full bg-primary/15 text-primary text-xs font-semibold">
                                  {r.weekday_labels[d]}
                                </span>
                              ) : (
                                <span className="text-muted-foreground/40">—</span>
                              )}
                            </td>
                          ))}
                          <td className="px-3 py-2 text-center font-bold text-primary">{r.total}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="border-t bg-muted/30">
                      <tr>
                        <td className="px-3 py-2 font-semibold">Toplam</td>
                        {days.map((d) => {
                          const total = distributionReport.reduce((sum, r) => sum + (r.weekday_labels[d] ?? 0), 0);
                          return (
                            <td key={d} className="px-3 py-2 text-center font-semibold">{total}</td>
                          );
                        })}
                        <td className="px-3 py-2 text-center font-bold text-primary">
                          {distributionReport.reduce((s, r) => s + r.total, 0)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            );
          })()}
          <DialogFooter>
            {lastCreatedPlanId && (
              <Link href={`/duty/planlar/${lastCreatedPlanId}`}>
                <Button>Planı düzenle</Button>
              </Link>
            )}
            <Button variant="outline" onClick={() => setDistributionReportOpen(false)}>Kapat</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
